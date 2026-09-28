// El mes de UNA persona, dia por dia.
//
// PARA QUE
// La planilla y los reportes miran a todo el personal junto. Esto mira a una
// sola persona y responde lo que se pregunta cuando alguien reclama: "que paso
// el martes 10". Un calendario donde cada dia tiene color se lee de un vistazo;
// una tabla de veinte filas hay que recorrerla entera.
//
// Es tambien lo que se le muestra al trabajador cuando pregunta por que le
// descontaron. Por eso el resumen de plata va al lado del calendario: el numero
// y el motivo, juntos.
//
// MISMO MOTOR
// `resolverDia` decide si el dia era laborable, igual que en el marcador, el
// reporte y la boleta. Si esta pantalla dijera algo distinto de la planilla,
// seria un error -- no otra forma de verlo.

import { PrismaClient } from "@prisma/client";
import {
    ahoraLima, fechaSql, aTextoLima, diaOperativo, indexarMarcas, SIN_MARCAS, horasJornada
} from "./asistencia.calendario";
import { resolverDia, CATEGORIAS_PAGADAS } from "./asistencia.dialaboral";
import { contextoLaboral, Ctx, Invalido } from "./asistencia.config";
import { tarifaDe, contratoDe } from "./asistencia.planilla";
import { configDe, resolverPeriodoDeOrg } from "./planilla.config";
import { minutosTrabajados, sobretiempoDelDia, sumarSobretiempo, Sobretiempo } from "./asistencia.sobretiempo";

const prisma = new PrismaClient();

const dosDec = (n: number) => Math.round(n * 100) / 100;

/**
 * En que estado quedo un dia.
 *
 * JUSTIFICADO existe aparte de FALTA a proposito: vacaciones y descanso medico
 * en rojo, al lado de las faltas de verdad, le harian creer a cualquiera que la
 * persona falto -- y a esa persona se le paga el dia.
 */
export type EstadoDia =
    | 'ASISTIO'
    | 'TARDANZA'
    | 'FALTA'
    | 'DESCANSO'
    | 'JUSTIFICADO'
    | 'SIN_SALIDA'
    | 'PENDIENTE';

export interface DiaFicha {
    fecha: string;
    dia: number;
    estado: EstadoDia;
    entrada: string | null;
    salida: string | null;
    tardanza_min: number;
    /** Horas efectivamente trabajadas: los tramos, sin el break del medio. */
    horas: number;
    sobretiempo_min: number;
    /** Por que el dia es distinto: feriado, cierre, vacaciones... */
    motivo: string | null;
    feriado: string | null;
    descanso_trabajado: boolean;
}

const soloHora = (v: any) => (aTextoLima(v) || '').slice(11, 16) || null;

/**
 * La ficha del mes de una persona.
 *
 * @param body `{ idcolaborador, periodo }`. El periodo es el mismo de la
 *             planilla; sin el, el que esta en curso.
 */
export async function fichaDelMes(ctx: Ctx, body: any) {
    const idcolaborador = Number(body?.idcolaborador) || 0;
    if (!idcolaborador) { throw new Invalido('falta el colaborador'); }

    const persona: any = await prisma.colaborador.findFirst({
        where: { idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede } as any
    });
    if (!persona) { throw new Invalido('esa persona no es de esta sede', 404); }

    const periodo = await resolverPeriodoDeOrg(ctx, body);
    const cfg = configDe(await prisma.org.findUnique({ where: { idorg: ctx.idorg } }));

    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const corteRaw = org?.asis_hora_corte;
    const corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
    const hoyOperativo = diaOperativo(corte, ahoraLima());

    const c = await contextoLaboral(ctx.idorg, ctx.idsede, periodo.desde, periodo.hasta);

    const marcas = await prisma.asistencia_marca.findMany({
        where: {
            idcolaborador,
            fecha_local: {
                gte: fechaSql(periodo.desde + ' 00:00:00'),
                lte: fechaSql(periodo.hasta + ' 00:00:00')
            }
        } as any,
        orderBy: { marcada_at: 'asc' }
    });
    const idx = indexarMarcas(marcas, m => aTextoLima(m.fecha_local)!.slice(0, 10));

    const tarifa = tarifaDe(await contratoDe(idcolaborador));

    const dias: DiaFicha[] = [];
    const extras: Sobretiempo[] = [];
    let trabajados = 0, noTrabajados = 0, tardanzas = 0, tardanzaMin = 0, justificados = 0;

    for (let f = new Date(periodo.desde + 'T00:00:00Z');
         f.toISOString().slice(0, 10) <= periodo.hasta;
         f = new Date(f.getTime() + 86400000)) {

        const fecha = f.toISOString().slice(0, 10);
        const dl = resolverDia({
            fecha,
            horario_semanal: persona.horario_semanal as any,
            tolerancia_min: persona.tolerancia_min ?? 10,
            excepciones: c.porPersona(idcolaborador),
            feriados: c.feriados,
            dias_cierre: c.dias_cierre,
            politica: c.politica
        });

        const par = idx.get(`${idcolaborador}|${fecha}`) || SIN_MARCAS;
        const entrada = par.ENTRADA, salida = par.SALIDA;
        // El dia en curso no cerro: nadie puede ser falta hasta que pase su
        // hora de salida. Contarlo daria faltas que se borran solas manana.
        const cerrado = fecha < hoyOperativo;

        let estado: EstadoDia;
        let horas = 0;
        let sobre = 0;

        if (entrada) {
            trabajados++;
            horas = dosDec(minutosTrabajados(par.todas) / 60);

            if (par.tardanza_min > 0) { tardanzas++; tardanzaMin += par.tardanza_min; }

            if (salida) {
                const s = sobretiempoDelDia(
                    minutosTrabajados(par.todas),
                    Math.round(horasJornada(persona.horario_semanal as any, fecha) * 60),
                    cfg.sobretiempo_min_umbral,
                    tarifa ? tarifa.valor_minuto : 0
                );
                extras.push(s);
                sobre = s.minutos;
                estado = par.tardanza_min > 0 ? 'TARDANZA' : 'ASISTIO';
            } else {
                // Entro y no marco salida. No es falta -- vino -- pero tampoco
                // se le pueden contar horas que nadie registro.
                estado = cerrado ? 'SIN_SALIDA' : 'ASISTIO';
            }

        } else if (!dl.labora) {
            // No le tocaba. Si ademas hay una categoria (vacaciones, licencia),
            // se distingue: no es lo mismo descansar que estar de vacaciones.
            estado = dl.categoria !== 'NORMAL' ? 'JUSTIFICADO' : 'DESCANSO';
            if (dl.categoria !== 'NORMAL' && CATEGORIAS_PAGADAS.includes(dl.categoria)) { justificados++; }

        } else if (cerrado) {
            estado = 'FALTA';
            noTrabajados++;

        } else {
            // Le toca hoy y todavia no marco: el dia sigue abierto.
            estado = 'PENDIENTE';
        }

        dias.push({
            fecha,
            dia: Number(fecha.slice(8, 10)),
            estado,
            entrada: entrada ? soloHora(entrada.marcada_at) : null,
            salida: salida ? soloHora(salida.marcada_at) : null,
            tardanza_min: par.tardanza_min,
            horas,
            sobretiempo_min: sobre,
            motivo: dl.labora ? null : (dl.motivo || null),
            feriado: dl.feriado,
            descanso_trabajado: !!(entrada && dl.es_descanso_trabajado)
        });
    }

    const sobretiempo = sumarSobretiempo(extras);

    // La plata. Es la MISMA cuenta de la boleta; aqui se muestra sola para que
    // la persona pueda ver de donde sale cada descuento.
    const descTardanza = tarifa ? dosDec(tardanzaMin * tarifa.valor_minuto) : 0;
    const descFaltas = tarifa ? dosDec(noTrabajados * tarifa.valor_dia) : 0;
    const pagoSobretiempo = cfg.usa_sobretiempo ? sobretiempo.importe : 0;

    return {
        colaborador: {
            idcolaborador,
            nombres: ((persona.nombres || '') + ' ' + (persona.apellidos || '')).trim(),
            dni: persona.dni,
            sin_contrato: !tarifa,
            valor_dia: tarifa ? tarifa.valor_dia : null
        },
        periodo: periodo.etiqueta,
        clave: periodo.clave,
        desde: periodo.desde,
        hasta: periodo.hasta,
        en_curso: periodo.hasta >= hoyOperativo,
        hoy: hoyOperativo,
        dias,
        resumen: {
            trabajados,
            no_trabajados: noTrabajados,
            justificados,
            tardanzas,
            tardanza_min: tardanzaMin,
            sobretiempo_min: sobretiempo.minutos
        },
        calculo: {
            desc_tardanza: descTardanza,
            desc_faltas: descFaltas,
            pago_sobretiempo: pagoSobretiempo,
            sobretiempo_se_paga: cfg.usa_sobretiempo,
            // "Listo para planilla" solo si el periodo cerro Y no hay nada que
            // aclarar. Un dia sin salida es justamente lo que hay que aclarar
            // antes de pagar: no se sabe cuanto trabajo.
            listo: periodo.hasta < hoyOperativo
                && !!tarifa
                && !dias.some(d => d.estado === 'SIN_SALIDA')
        }
    };
}
