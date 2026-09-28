// Los reportes de asistencia.
//
// POR QUE ESTAN AQUI Y NO EN EL CONTROLADOR
// El reporte de rango calculaba las faltas con `horaEsperada` a secas: miraba
// el horario semanal y nada mas. No sabia de feriados, ni de dias que el local
// cierra, ni de vacaciones. La planilla si, porque usa `resolverDia`.
//
// Resultado: el reporte decia 17 faltas y la boleta descontaba 12. Dos numeros
// distintos para la misma pregunta, y quien atiende el reclamo tiene que
// explicar cual de los dos miente. Ahora los dos salen del mismo motor.
//
// Aqui viven dos reportes con publicos distintos:
//   - `reporteRango`: para el que administra. Cuanto trabajo cada uno y que
//     hay que pagarle o descontarle.
//   - `registroJornada`: el que exige el D.S. 004-2006-TR. Dia por dia, con el
//     RUC del empleador y el DNI del trabajador. Es el que se muestra en una
//     fiscalizacion, y por eso no resume nada.

import { PrismaClient } from "@prisma/client";
import {
    minutosTrabajados, sobretiempoDelDia, sumarSobretiempo, Sobretiempo
} from "./asistencia.sobretiempo";
import {
    ahoraLima, fechaSql, aTextoLima, diaOperativo, horasTurno, indexarMarcas, SIN_MARCAS,
    horasJornada
} from "./asistencia.calendario";
import { resolverDia, CATEGORIAS_PAGADAS } from "./asistencia.dialaboral";
import { contextoLaboral, Ctx, Invalido, ES_FECHA } from "./asistencia.config";
import { normalizarUmbral } from "./planilla.config";

const prisma = new PrismaClient();

/**
 * Tope de dias por consulta.
 *
 * Medio ano alcanza para cualquier periodo de planilla. Un rango abierto
 * barreria anos de marcas y la consulta se caeria sola.
 */
const RANGO_MAX_DIAS = 186;

const dosDec = (n: number) => Math.round(n * 100) / 100;
const soloHora = (d: any) => (d ? new Date(d).toISOString().slice(11, 16) : null);

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

function validarRango(desde: string, hasta: string) {
    if (!ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) {
        throw new Invalido('Las fechas deben ser YYYY-MM-DD.');
    }
    if (desde > hasta) { throw new Invalido('La fecha inicial es posterior a la final.'); }
    const dias = diasEntre(desde, hasta);
    if (dias.length > RANGO_MAX_DIAS) {
        throw new Invalido(`El rango no puede pasar de ${RANGO_MAX_DIAS} dias.`);
    }
    return dias;
}

/**
 * Todo lo que los dos reportes necesitan leer: el contexto laboral, el personal,
 * las marcas indexadas y hasta donde se puede hablar de faltas.
 */
async function base(ctx: Ctx, desde: string, hasta: string) {
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const corteRaw = org?.asis_hora_corte;
    const corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');

    // El dia en curso todavia no cerro: nadie puede contar como falta hasta que
    // pase su hora de salida. Contarlo daria faltas que se borran solas manana.
    const hoyOperativo = diaOperativo(corte, ahoraLima());

    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    const marcas: any[] = await prisma.asistencia_marca.findMany({
        where: {
            idorg: ctx.idorg,
            fecha_local: { gte: fechaSql(desde + ' 00:00:00'), lte: fechaSql(hasta + ' 00:00:00') }
        } as any,
        orderBy: { marcada_at: 'asc' }
    });

    // Indice por persona + dia: recorrer todas las marcas por celda seria
    // cuadratico y esto corre sobre medio ano.
    const idx = indexarMarcas(marcas, m => aTextoLima(m.fecha_local)!.slice(0, 10));

    const areas = await prisma.area.findMany({
        where: { estado: '0', OR: [{ idsede: 0 }, { idsede: ctx.idsede }] } as any,
        select: { idarea: true, descripcion: true }
    });
    const nombreArea = new Map<number, string>((areas as any[]).map(a => [a.idarea, a.descripcion]));

    const c = await contextoLaboral(ctx.idorg, ctx.idsede, desde, hasta);

    return {
        org, corte, hoyOperativo, personal, idx, nombreArea, ctxLab: c,
        // El margen configurado para el sobretiempo. El reporte lo respeta para
        // no mostrar como horas extra lo que la planilla no va a pagar: dos
        // numeros distintos para la misma cosa es peor que no mostrarla.
        umbralSobretiempo: normalizarUmbral(org?.sobretiempo_min_umbral)
    };
}

/** Resuelve un dia para una persona, con el mismo motor que usa la planilla. */
const resolver = (c: any, p: any, fecha: string) => resolverDia({
    fecha,
    horario_semanal: p.horario_semanal,
    tolerancia_min: p.tolerancia_min ?? 10,
    excepciones: c.porPersona(p.idcolaborador),
    feriados: c.feriados,
    dias_cierre: c.dias_cierre,
    politica: c.politica
});

// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------

/**
 * Resumen por colaborador para un rango de dias.
 *
 * Separa `horas_trabajadas` (turnos cerrados) de `dias_incompletos` (entro y no
 * marco salida). Un dia incompleto NO suma horas: contarlo con una salida
 * inventada seria pagar o descontar sobre un dato que nadie registro.
 */
export async function reporteRango(ctx: Ctx, desde: string, hasta: string) {
    const dias = validarRango(desde, hasta);
    const b = await base(ctx, desde, hasta);

    const filas = b.personal.map((p: any) => {
        let esperados = 0, asistencias = 0, tardanzas = 0, tardanzaMin = 0;
        let faltas = 0, horas = 0, incompletos = 0, manuales = 0;
        let descansosTrabajados = 0, feriadosTrabajados = 0;
        let pagadosSinTrabajar = 0, sinGoce = 0;
        const detalle: any[] = [];
        // El sobretiempo va en el reporte SIEMPRE, se pague o no: el
        // D.S. 004-2006-TR obliga a registrar las horas y minutos de
        // permanencia fuera de la jornada. Aqui no se valoriza -- eso es de la
        // planilla -- asi que el valor del minuto va en 0.
        const extrasDelRango: Sobretiempo[] = [];

        for (const dia of dias) {
            const dl = resolver(b.ctxLab, p, dia);
            const par = b.idx.get(`${p.idcolaborador}|${dia}`) || SIN_MARCAS;
            const entrada = par.ENTRADA || null;
            const salida = par.SALIDA || null;
            const cerrado = dia < b.hoyOperativo;

            if (dl.labora) { esperados++; }

            if (entrada) {
                asistencias++;
                if (par.tardanza_min > 0) { tardanzas++; tardanzaMin += par.tardanza_min; }
                if (entrada.metodo === 'MANUAL') { manuales++; }

                // Se cuentan con la marca en la mano, no con la excepcion
                // cargada: el recargo se paga por trabajar, no por estar previsto.
                if (dl.es_descanso_trabajado) { descansosTrabajados++; }
                if (dl.recargo_feriado_pct) { feriadosTrabajados++; }

                if (salida) {
                    // Se emparejan los tramos en vez de restar la ultima salida
                    // menos la primera entrada: con break, esa resta contaba
                    // como trabajadas las horas en que la persona estaba en su
                    // casa. Un turno corrido da exactamente lo mismo que antes.
                    horas += minutosTrabajados(par.todas) / 60;
                    if (salida.metodo === 'MANUAL') { manuales++; }

                    extrasDelRango.push(sobretiempoDelDia(
                        minutosTrabajados(par.todas),
                        Math.round(horasJornada(p.horario_semanal as any, dia) * 60),
                        b.umbralSobretiempo,
                        0
                    ));
                } else if (cerrado) {
                    incompletos++;
                }
            } else if (dl.labora && cerrado) {
                faltas++;
            } else if (!dl.labora && cerrado && dl.categoria !== 'NORMAL') {
                // Ausencia justificada: no es falta, y que se pague o no depende
                // de la categoria, no de si vino.
                if (CATEGORIAS_PAGADAS.includes(dl.categoria)) { pagadosSinTrabajar++; } else { sinGoce++; }
            }

            if (entrada || salida || (!dl.labora && dl.categoria !== 'NORMAL')) {
                detalle.push({
                    fecha: dia,
                    entrada: entrada ? soloHora(entrada.marcada_at) : null,
                    salida: salida ? soloHora(salida.marcada_at) : null,
                    tardanza_min: entrada ? entrada.tardanza_min : null,
                    horas: (entrada && salida)
                        ? dosDec(horasTurno(aTextoLima(entrada.marcada_at)!, aTextoLima(salida.marcada_at)!))
                        : null,
                    manual: !!((entrada && entrada.metodo === 'MANUAL') || (salida && salida.metodo === 'MANUAL')),
                    // Por que ese dia es distinto: el que lee el reporte no
                    // tiene que ir al calendario a averiguarlo.
                    motivo: dl.labora ? null : (dl.motivo || null),
                    categoria: dl.categoria !== 'NORMAL' ? dl.categoria : null,
                    descanso_trabajado: !!(entrada && dl.es_descanso_trabajado),
                    feriado: dl.feriado
                });
            }
        }

        return {
            idcolaborador: p.idcolaborador,
            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
            dni: p.dni,
            area: p.idarea ? (b.nombreArea.get(p.idarea) || '') : '',
            dias_esperados: esperados,
            asistencias,
            tardanzas,
            tardanza_min_total: tardanzaMin,
            faltas,
            dias_incompletos: incompletos,
            marcas_manuales: manuales,
            descansos_trabajados: descansosTrabajados,
            feriados_trabajados: feriadosTrabajados,
            dias_pagados_sin_trabajar: pagadosSinTrabajar,
            dias_sin_goce: sinGoce,
            horas_trabajadas: dosDec(horas),
            // Se informa siempre, se pague o no: es el registro que pide el
            // D.S. 004-2006-TR.
            sobretiempo_min: sumarSobretiempo(extrasDelRango).minutos,
            detalle
        };
    });

    const suma = (f: (x: any) => number) => filas.reduce((a: number, x: any) => a + f(x), 0);

    return {
        desde, hasta,
        dias: dias.length,
        hoy: b.hoyOperativo,
        hora_corte: b.corte,
        filas,
        totales: {
            personal: filas.length,
            asistencias: suma(f => f.asistencias),
            tardanzas: suma(f => f.tardanzas),
            tardanza_min_total: suma(f => f.tardanza_min_total),
            faltas: suma(f => f.faltas),
            dias_incompletos: suma(f => f.dias_incompletos),
            descansos_trabajados: suma(f => f.descansos_trabajados),
            feriados_trabajados: suma(f => f.feriados_trabajados),
            dias_pagados_sin_trabajar: suma(f => f.dias_pagados_sin_trabajar),
            dias_sin_goce: suma(f => f.dias_sin_goce),
            horas_trabajadas: dosDec(suma(f => f.horas_trabajadas)),
            sobretiempo_min: suma(f => f.sobretiempo_min)
        }
    };
}

// ---------------------------------------------------------------------------
// Registro de jornada (D.S. 004-2006-TR)
// ---------------------------------------------------------------------------

/**
 * El registro que la norma obliga a llevar y a mostrar en una fiscalizacion.
 *
 * El D.S. 004-2006-TR pide, por cada trabajador y cada dia: nombre y DNI, RUC
 * del empleador, hora de entrada y de salida, y las horas trabajadas. Debe
 * conservarse CINCO anos.
 *
 * No resume nada a proposito: una fila por persona y por dia trabajado. El
 * reporte de arriba es para decidir; este es para mostrar, y ahi el resumen
 * juega en contra.
 *
 * Los dias sin marca aparecen igual, diciendo por que: un hueco sin explicacion
 * es lo que un inspector pregunta primero.
 */
export async function registroJornada(ctx: Ctx, desde: string, hasta: string) {
    const dias = validarRango(desde, hasta);
    const b = await base(ctx, desde, hasta);
    const sede: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });

    const filas: any[] = [];

    for (const p of b.personal as any[]) {
        for (const dia of dias) {
            const dl = resolver(b.ctxLab, p, dia);
            const par = b.idx.get(`${p.idcolaborador}|${dia}`) || SIN_MARCAS;
            const entrada = par.ENTRADA || null;
            const salida = par.SALIDA || null;
            const cerrado = dia < b.hoyOperativo;

            // Un dia que no le tocaba y en el que no vino no es parte de su
            // jornada: no va al registro. Lo que si va es todo dia trabajado y
            // toda ausencia en un dia que si le tocaba.
            if (!entrada && !dl.labora && dl.categoria === 'NORMAL') { continue; }
            if (!entrada && !cerrado) { continue; }

            filas.push({
                fecha: dia,
                idcolaborador: p.idcolaborador,
                nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                dni: p.dni,
                area: p.idarea ? (b.nombreArea.get(p.idarea) || '') : '',
                hora_entrada: entrada ? soloHora(entrada.marcada_at) : null,
                hora_salida: salida ? soloHora(salida.marcada_at) : null,
                horas: (entrada && salida)
                    ? dosDec(horasTurno(aTextoLima(entrada.marcada_at)!, aTextoLima(salida.marcada_at)!))
                    : null,
                hora_esperada: dl.hora_esperada,
                tardanza_min: entrada ? par.tardanza_min : null,
                // El metodo importa para la norma: una marca puesta a mano por
                // un tercero no prueba lo mismo que una hecha por el trabajador.
                metodo: entrada ? entrada.metodo : null,
                observacion: entrada
                    ? (dl.es_descanso_trabajado ? 'Descanso trabajado'
                        : dl.recargo_feriado_pct ? `Feriado trabajado (${dl.feriado})`
                        : null)
                    : (dl.categoria !== 'NORMAL' ? dl.categoria.replace(/_/g, ' ')
                        : 'Falta')
            });
        }
    }

    return {
        desde, hasta,
        // La cabecera que la norma pide en el documento
        empleador: {
            razon_social: b.org?.nombre || '',
            ruc: b.org?.ruc || '',
            sede: sede?.nombre || '',
            direccion: sede?.direccion || ''
        },
        filas,
        totales: {
            registros: filas.length,
            personas: new Set(filas.map(f => f.idcolaborador)).size,
            horas: dosDec(filas.reduce((a, f) => a + (f.horas || 0), 0))
        }
    };
}
