// De las marcas a la boleta.
//
// Es el unico lugar donde la asistencia se convierte en plata. Todo lo anterior
// -- horarios, calendario, politica, marcas -- existe para que esto salga bien.
//
// QUE CALCULA
//   + Recargo por dia de descanso trabajado   (D.Leg. 713 art. 3)
//   + Recargo por feriado trabajado           (D.Leg. 713 art. 9)
//   - Descuento por tardanzas                 (proporcional a los minutos)
//   - Descuento por dias no trabajados        (proporcional a los dias)
//
// LO QUE NO HACE, A PROPOSITO
// No multa. El D.S. 004-2006-TR solo permite descontar el tiempo efectivamente
// no trabajado; cobrar "una multa de S/ 20 por llegar tarde" es infraccion, por
// mas que sea lo que muchos locales hacen hoy en papel.
//
// No escribe nada hasta que alguien lo confirma. El calculo se muestra primero
// -- con el detalle de como salio cada importe -- y recien despues se aplica.
// Un numero que aparece solo en la boleta y nadie puede explicar es un reclamo
// asegurado.

import { PrismaClient } from "@prisma/client";
import {
    ahoraLima, fechaSql, aTextoLima, diaOperativo, horaEsperada, horasTurno
} from "./asistencia.calendario";
import { resolverDia, CATEGORIAS_PAGADAS } from "./asistencia.dialaboral";
import { contextoLaboral, Ctx, Invalido } from "./asistencia.config";
import { anotar, Autor } from "./asistencia.bitacora";
import { resolverPeriodoDeOrg } from "./planilla.config";
import { Periodo as PeriodoPago } from "./planilla.periodos";

const prisma = new PrismaClient();

/** Los cuatro conceptos, por su codigo estable (migracion 055). */
export const CODIGOS = {
    RECARGO_DESCANSO: 'ASIS_RECARGO_DESCANSO',
    RECARGO_FERIADO: 'ASIS_RECARGO_FERIADO',
    DESC_TARDANZA: 'ASIS_DESC_TARDANZA',
    DESC_FALTAS: 'ASIS_DESC_FALTAS'
} as const;

/**
 * Dias que se le paga a un mes.
 *
 * Son 30 SIEMPRE, tenga el mes 28 o 31. Es la convencion legal peruana para el
 * valor del dia, y usar los dias reales haria que el mismo sueldo valiera
 * distinto por dia en febrero que en marzo.
 */
const DIAS_MES = 30;

/** Tope de dias por calculo. Un periodo de planilla nunca pasa de un mes largo. */
const RANGO_MAX_DIAS = 45;

const dosDec = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// El periodo
// ---------------------------------------------------------------------------

/**
 * La clave con la que el concepto entra a la boleta: el primer dia del periodo.
 *
 * Antes era siempre el primero del mes. Con pago semanal eso juntaria las
 * cuatro semanas de marzo en una sola boleta, asi que ahora es el primer dia
 * del periodo real -- que para el pago mensual sigue siendo el dia 1.
 */
const periodoBoleta = (p: PeriodoPago) => p.clave;

function diasEntre(desde: string, hasta: string): string[] {
    const salida: string[] = [];
    let t = Date.parse(desde + 'T00:00:00Z');
    const fin = Date.parse(hasta + 'T00:00:00Z');
    while (t <= fin) {
        salida.push(new Date(t).toISOString().slice(0, 10));
        t += 86400000;
    }
    return salida;
}

// ---------------------------------------------------------------------------
// El sueldo
// ---------------------------------------------------------------------------

/**
 * El sueldo NO esta en `colaborador`: vive en el detalle del contrato activo,
 * junto con la unidad (mensual, quincenal, semanal) y las horas de jornada.
 * Sin contrato activo no hay con que calcular, y eso se informa en vez de
 * asumir un sueldo.
 */
async function contratoDe(idcolaborador: number) {
    const filas: any[] = await prisma.$queryRawUnsafe(
        `SELECT ccd.importe, ccd.unidad_remuneracion, ccd.horas
           FROM colaborador_contrato cc
           INNER JOIN colaborador_contrato_detalle ccd
                   ON ccd.idcolaborador_contrato = cc.idcolaborador_contrato
          WHERE cc.idcolaborador = ? AND cc.estado = '0' AND cc.activo = '1'
          ORDER BY ccd.idcolaborador_contrato_detalle DESC
          LIMIT 1`, idcolaborador);
    return filas.length ? filas[0] : null;
}

export interface Tarifa { valor_dia: number; valor_minuto: number; unidad: string; horas_dia: number }

/**
 * Cuanto vale un dia y un minuto de esta persona.
 *
 * El valor del minuto sale de SU jornada, no de las 8 horas de oficina: para
 * quien trabaja 6 horas, un minuto de tardanza pesa mas que para quien trabaja
 * 10. Descontar todos por el mismo divisor le cobraria de menos a unos y de
 * mas a otros.
 */
export function tarifaDe(contrato: any): Tarifa | null {
    const importe = Number(String(contrato?.importe || '').replace(/,/g, ''));
    if (!Number.isFinite(importe) || importe <= 0) { return null; }

    const unidad = String(contrato?.unidad_remuneracion || 'MENSUAL').toUpperCase();
    const divisor = unidad === 'DIARIO' ? 1
        : unidad === 'SEMANAL' ? 7
        : unidad === 'QUINCENAL' ? 15
        : DIAS_MES;

    const horas = Number(contrato?.horas);
    // 8 h es el tope legal de la jornada y el default razonable cuando el
    // contrato no lo dice. Un 0 aqui dividiria por cero.
    const horas_dia = Number.isFinite(horas) && horas > 0 && horas <= 24 ? horas : 8;

    const valor_dia = importe / divisor;
    return {
        valor_dia: dosDec(valor_dia),
        valor_minuto: valor_dia / (horas_dia * 60),
        unidad,
        horas_dia
    };
}

// ---------------------------------------------------------------------------
// El calculo
// ---------------------------------------------------------------------------

export interface LineaConcepto {
    codigo: string;
    idvariables: number;
    descripcion: string;
    tipo: 'INGRESO' | 'DESCUENTO';
    importe: number;
    detalle: string;
}

export interface FilaPlanilla {
    idcolaborador: number;
    nombres: string;
    dni: string;
    sin_contrato: boolean;
    sueldo: number | null;
    unidad: string | null;
    valor_dia: number | null;
    dias_trabajados: number;
    faltas: number;
    /** Dias de vacaciones, licencia o descanso medico: no vino y se le paga igual. */
    dias_pagados_sin_trabajar: number;
    /** Permisos sin goce: no vino y no se le paga. Se descuentan como una falta. */
    dias_sin_goce: number;
    tardanza_min: number;
    descansos_trabajados: number;
    feriados_trabajados: number;
    conceptos: LineaConcepto[];
    total_ingresos: number;
    total_descuentos: number;
}

/** Los cuatro conceptos con el id que tienen en ESTA base. */
async function catalogo() {
    const filas: any[] = await prisma.variables.findMany({
        where: { codigo: { in: Object.values(CODIGOS) as string[] } } as any
    });
    const porCodigo = new Map<string, any>(filas.map(f => [f.codigo, f]));
    if (porCodigo.size < 4) {
        throw new Invalido('Faltan los conceptos de asistencia en la tabla de variables. Revisa la migracion 055.', 500);
    }
    return porCodigo;
}

/**
 * Calcula, sin escribir nada.
 *
 * Recorre dia por dia porque cada dia puede ser distinto por cinco motivos
 * (horario, cierre, feriado, excepcion de sede, excepcion propia) y solo
 * `resolverDia` sabe combinarlos. Es el mismo motor que usa el marcador, asi
 * que la boleta no puede discrepar de lo que la pantalla le dijo al trabajador.
 */
export async function calcular(ctx: Ctx, body: any): Promise<any> {
    const periodo = await resolverPeriodoDeOrg(ctx, body);
    const dias = diasEntre(periodo.desde, periodo.hasta);
    if (dias.length > RANGO_MAX_DIAS) {
        throw new Invalido(`El periodo no puede pasar de ${RANGO_MAX_DIAS} dias.`);
    }

    const conceptos = await catalogo();
    const c = await contextoLaboral(ctx.idorg, ctx.idsede, periodo.desde, periodo.hasta);

    // Hasta donde se puede hablar de faltas: el dia en curso todavia no cerro,
    // y descontarle el dia a alguien que todavia puede llegar seria un error
    // que se descubre en la boleta.
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const corteRaw = org?.asis_hora_corte;
    const corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
    const hoyOperativo = diaOperativo(corte, ahoraLima());

    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    const marcas: any[] = await prisma.asistencia_marca.findMany({
        where: {
            idorg: ctx.idorg,
            fecha_local: {
                gte: fechaSql(periodo.desde + ' 00:00:00'),
                lte: fechaSql(periodo.hasta + ' 00:00:00')
            }
        } as any
    });

    // Indice por persona + dia: recorrer todas las marcas por celda seria
    // cuadratico y este calculo corre sobre un mes entero.
    const idx = new Map<string, any>();
    for (const m of marcas) {
        const dia = aTextoLima(m.fecha_local)!.slice(0, 10);
        const k = `${m.idcolaborador}|${dia}`;
        if (!idx.has(k)) { idx.set(k, {}); }
        idx.get(k)[m.tipo] = m;
    }

    const filas: FilaPlanilla[] = [];

    for (const p of personal as any[]) {
        const contrato = await contratoDe(p.idcolaborador);
        const tarifa = tarifaDe(contrato);

        let faltas = 0, tardanzaMin = 0, trabajados = 0;
        let pagadosSinTrabajar = 0, sinGoce = 0;
        const descansos: string[] = [];
        const feriados: Array<{ fecha: string; pct: number }> = [];

        for (const fecha of dias) {
            const dl = resolverDia({
                fecha,
                horario_semanal: p.horario_semanal as any,
                tolerancia_min: p.tolerancia_min ?? 10,
                excepciones: c.porPersona(p.idcolaborador),
                feriados: c.feriados,
                dias_cierre: c.dias_cierre,
                politica: c.politica
            });

            const par = idx.get(`${p.idcolaborador}|${fecha}`) || {};
            const entrada = par.ENTRADA || null;
            const cerrado = fecha < hoyOperativo;

            if (entrada) {
                trabajados++;
                if ((entrada.tardanza_min || 0) > 0) { tardanzaMin += entrada.tardanza_min; }

                // El recargo se paga por trabajar, no por estar programado: se
                // cuenta con la marca en la mano, no con la excepcion cargada.
                if (dl.es_descanso_trabajado && dl.compensacion === 'RECARGO') {
                    descansos.push(fecha);
                }
                if (dl.recargo_feriado_pct) {
                    feriados.push({ fecha, pct: dl.recargo_feriado_pct });
                }
            } else if (dl.labora && cerrado) {
                faltas++;
            } else if (!dl.labora && cerrado && dl.categoria !== 'NORMAL') {
                // Una ausencia justificada. Que se descuente o no depende de la
                // categoria, no de si vino: unas vacaciones se pagan y un
                // permiso sin goce no, y las dos son "no vino".
                if (CATEGORIAS_PAGADAS.includes(dl.categoria)) { pagadosSinTrabajar++; } else { sinGoce++; }
            }
        }

        const lineas: LineaConcepto[] = [];

        if (tarifa) {
            const recDescanso = descansos.reduce((a, f) => {
                const e = c.excepciones.find(x => x.idcolaborador === p.idcolaborador && x.fecha === f);
                return a + tarifa.valor_dia * ((e?.recargo_pct ?? 100) / 100);
            }, 0);
            if (recDescanso > 0) {
                lineas.push(linea(conceptos, CODIGOS.RECARGO_DESCANSO, recDescanso,
                    `${descansos.length} dia(s) de descanso trabajados: ${descansos.join(', ')}`));
            }

            const recFeriado = feriados.reduce((a, f) => a + tarifa.valor_dia * (f.pct / 100), 0);
            if (recFeriado > 0) {
                lineas.push(linea(conceptos, CODIGOS.RECARGO_FERIADO, recFeriado,
                    `${feriados.length} feriado(s) trabajados: ${feriados.map(f => f.fecha).join(', ')}`));
            }

            const descTardanza = tardanzaMin * tarifa.valor_minuto;
            if (descTardanza > 0) {
                lineas.push(linea(conceptos, CODIGOS.DESC_TARDANZA, descTardanza,
                    `${tardanzaMin} min de tardanza a ${dosDec(tarifa.valor_minuto * 60)} por hora`));
            }

            // La falta y el permiso sin goce se descuentan igual -- es el mismo
            // dia no trabajado y no pagado -- pero se nombran distinto en el
            // detalle para que nadie tenga que adivinar de donde salio el monto.
            const noPagados = faltas + sinGoce;
            const descFaltas = noPagados * tarifa.valor_dia;
            if (descFaltas > 0) {
                const partes = [];
                if (faltas) { partes.push(`${faltas} falta(s)`); }
                if (sinGoce) { partes.push(`${sinGoce} dia(s) de permiso sin goce`); }
                lineas.push(linea(conceptos, CODIGOS.DESC_FALTAS, descFaltas,
                    `${partes.join(' y ')} a ${tarifa.valor_dia} por dia`));
            }
        }

        filas.push({
            idcolaborador: p.idcolaborador,
            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
            dni: p.dni,
            // Se informa en vez de asumir un sueldo: inventarlo saldria en la
            // boleta como un numero que nadie puede justificar.
            sin_contrato: !tarifa,
            sueldo: tarifa ? Number(String(contrato.importe).replace(/,/g, '')) : null,
            unidad: tarifa ? tarifa.unidad : null,
            valor_dia: tarifa ? tarifa.valor_dia : null,
            dias_trabajados: trabajados,
            faltas,
            dias_pagados_sin_trabajar: pagadosSinTrabajar,
            dias_sin_goce: sinGoce,
            tardanza_min: tardanzaMin,
            descansos_trabajados: descansos.length,
            feriados_trabajados: feriados.length,
            conceptos: lineas,
            total_ingresos: dosDec(lineas.filter(l => l.tipo === 'INGRESO').reduce((a, l) => a + l.importe, 0)),
            total_descuentos: dosDec(lineas.filter(l => l.tipo === 'DESCUENTO').reduce((a, l) => a + l.importe, 0))
        });
    }

    return {
        periodo: periodo.etiqueta,
        clave: periodo.clave,
        tipo: periodo.tipo,
        desde: periodo.desde,
        hasta: periodo.hasta,
        hoy: hoyOperativo,
        // El periodo se puede calcular antes de que termine, para ir viendo
        // como viene; se avisa porque los numeros todavia pueden cambiar.
        en_curso: periodo.hasta >= hoyOperativo,
        filas,
        totales: {
            personal: filas.length,
            sin_contrato: filas.filter(f => f.sin_contrato).length,
            ingresos: dosDec(filas.reduce((a, f) => a + f.total_ingresos, 0)),
            descuentos: dosDec(filas.reduce((a, f) => a + f.total_descuentos, 0)),
            dias_pagados_sin_trabajar: filas.reduce((a, f) => a + f.dias_pagados_sin_trabajar, 0)
        }
    };
}

function linea(conceptos: Map<string, any>, codigo: string, importe: number, detalle: string): LineaConcepto {
    const v = conceptos.get(codigo);
    return {
        codigo,
        idvariables: v.idvariables,
        descripcion: v.descripcion,
        tipo: v.idtipo_variable === 1 ? 'INGRESO' : 'DESCUENTO',
        importe: dosDec(importe),
        detalle
    };
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

/**
 * Escribe los conceptos en la boleta del periodo.
 *
 * Es RE-EJECUTABLE: primero borra lo que este calculo puso antes para ese
 * periodo y despues inserta. Sin eso, recalcular despues de corregir una marca
 * dejaria el importe viejo y el nuevo sumados, y nadie lo notaria hasta el
 * momento de pagar.
 *
 * Solo toca sus propias lineas -- las de los cuatro codigos ASIS_* -- asi que
 * un adelanto o un bono cargado a mano en el mismo periodo queda intacto.
 */
export async function aplicar(ctx: Ctx, body: any, autor: Autor) {
    const calculo = await calcular(ctx, body);
    const conceptos = await catalogo();
    const ids = Array.from(conceptos.values()).map((v: any) => v.idvariables);
    const periodo = calculo.clave;

    const deLaSede = calculo.filas.map((f: any) => f.idcolaborador);
    if (!deLaSede.length) { return { ...calculo, aplicados: 0 }; }

    const borradas = await prisma.colaborador_boleta.deleteMany({
        where: {
            idorg: ctx.idorg,
            idcolaborador: { in: deLaSede },
            idvariables: { in: ids },
            periodo
        } as any
    });

    const ahora = ahoraLima();
    const nuevas: any[] = [];
    for (const f of calculo.filas) {
        for (const l of f.conceptos) {
            nuevas.push({
                idcolaborador: f.idcolaborador,
                idorg: ctx.idorg,
                idvariables: l.idvariables,
                f_add: ahora.slice(0, 10),
                estado: '0',
                importe: String(l.importe),
                // permanente '0': vale solo para este periodo. Un recargo del
                // mes pasado no se vuelve a pagar el mes que viene.
                permanente: '0',
                periodo,
                fecha_registro: ahora,
                observaciones: l.detalle.slice(0, 100)
            });
        }
    }

    if (nuevas.length) {
        await prisma.colaborador_boleta.createMany({ data: nuevas as any });
    }

    const sede: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });

    await anotar({
        idorg: ctx.idorg,
        idsede_restobar: sede?.idsede_restobar ?? 0,
        entidad: 'PLANILLA', accion: 'MODIFICA',
        detalle: `Conceptos de asistencia del periodo ${calculo.periodo} (${calculo.clave}): ` +
            `${nuevas.length} linea(s) en ${calculo.filas.filter((f: any) => f.conceptos.length).length} boleta(s), ` +
            `+${calculo.totales.ingresos} / -${calculo.totales.descuentos}`,
        anterior: { lineas_previas: borradas.count },
        nuevo: { lineas: nuevas.length, ingresos: calculo.totales.ingresos, descuentos: calculo.totales.descuentos }
    }, autor);

    return { ...calculo, aplicados: nuevas.length, reemplazados: borradas.count };
}
