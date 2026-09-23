// Quien deberia haber marcado y no marco, y por que.
//
// EL PROBLEMA QUE RESUELVE
// El sistema sabe que alguien no vino, pero no por que. Y desde que los dias no
// trabajados se descuentan solos de la boleta, esa diferencia vale plata:
//
//   - se fue de vacaciones  -> se le paga igual, no se descuenta
//   - esta con descanso medico -> idem
//   - renuncio y nadie lo dio de baja -> le siguen contando faltas para siempre
//   - falto de verdad -> ahi si, se descuenta
//
// Nadie va a entrar a revisar esto todos los dias. Por eso el sistema avisa
// solo: si alguien lleva varios dias seguidos sin marcar, algo pasa, y hay que
// preguntarlo ANTES de que cierre la planilla y el descuento ya este hecho.

import { PrismaClient } from "@prisma/client";
import { ahoraLima, fechaSql, aTextoLima, diaOperativo } from "./asistencia.calendario";
import { resolverDia, Categoria, CATEGORIAS_PAGADAS } from "./asistencia.dialaboral";
import { contextoLaboral, Ctx, Invalido, ES_FECHA, guardarExcepcion } from "./asistencia.config";
import { anotar, Autor } from "./asistencia.bitacora";

const prisma = new PrismaClient();

/**
 * Dias seguidos sin marcar antes de avisar.
 *
 * Tres y no uno: faltar un dia pasa todo el tiempo y avisar por cada uno
 * entrenaria a ignorar el aviso. Tres dias seguidos ya no es un olvido.
 */
export const DIAS_PARA_ALERTAR = 3;

/** Hasta cuantos dias hacia atras se busca. Mas que eso ya es trabajo de reportes. */
const VENTANA_DIAS = 30;

const texto = (v: any, max = 200) => (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);

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

const restarDias = (fecha: string, n: number) =>
    new Date(Date.parse(fecha + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Detectar
// ---------------------------------------------------------------------------

export interface Alerta {
    idcolaborador: number;
    nombres: string;
    dni: string;
    dias: number;
    desde: string;
    hasta: string;
    ultima_marca: string | null;
}

/**
 * Esta el modulo realmente en uso?
 *
 * Importa porque si nadie PUEDE marcar, todo el personal aparece como ausente y
 * el aviso deja de significar algo: seria una alarma que suena siempre, que es
 * lo mismo que una alarma apagada.
 *
 * Hacen falta las dos mitades: una pantalla donde escanear y alguien capaz de
 * escanear. Se acepta tambien que haya marcas recientes, porque una sede que
 * solo usa marcado manual no tiene celulares vinculados y si esta operando.
 */
async function estadoDelModulo(ctx: Ctx, desde: string) {
    const marcadores = await prisma.asistencia_kiosko.count({
        where: { idorg: ctx.idorg, revocado_at: null } as any
    });

    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        select: { idcolaborador: true }
    });
    const ids = personal.map(p => p.idcolaborador);

    const conDispositivo = ids.length
        ? await prisma.colaborador_dispositivo.count({
            where: { idcolaborador: { in: ids }, activo: true } as any
        })
        : 0;

    const marcasRecientes = await prisma.asistencia_marca.count({
        where: { idorg: ctx.idorg, fecha_local: { gte: fechaSql(desde + ' 00:00:00') } } as any
    });

    return {
        operativo: marcadores > 0 && (conDispositivo > 0 || marcasRecientes > 0),
        marcadores,
        personal: ids.length,
        con_dispositivo: conDispositivo,
        marcas_recientes: marcasRecientes
    };
}

/**
 * Quien lleva varios dias seguidos sin marcar un dia que le tocaba.
 *
 * Se cuenta hacia atras desde el ultimo dia CERRADO: el dia en curso no cuenta
 * porque la persona todavia puede llegar, y avisar a las 10 de la manana de que
 * alguien "no vino" seria falso la mitad de las veces.
 *
 * La racha se corta con una marca o con un dia que no le tocaba trabajar: unas
 * vacaciones ya cargadas, o el domingo de por medio, no rompen nada.
 */
export async function alertas(ctx: Ctx): Promise<any> {
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const corteRaw = org?.asis_hora_corte;
    const corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
    const hoyOperativo = diaOperativo(corte, ahoraLima());

    const hasta = restarDias(hoyOperativo, 1);      // el ultimo dia cerrado
    const desde = restarDias(hasta, VENTANA_DIAS - 1);

    const estado = await estadoDelModulo(ctx, desde);
    if (!estado.operativo) { return { alertas: [], desde, hasta, ...estado }; }

    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });
    if (!personal.length) { return { alertas: [], desde, hasta, ...estado }; }

    const c = await contextoLaboral(ctx.idorg, ctx.idsede, desde, hasta);

    const marcas: any[] = await prisma.asistencia_marca.findMany({
        where: {
            idorg: ctx.idorg,
            tipo: 'ENTRADA',
            fecha_local: { gte: fechaSql(desde + ' 00:00:00'), lte: fechaSql(hasta + ' 00:00:00') }
        } as any
    });
    const marco = new Set<string>(
        marcas.map(m => `${m.idcolaborador}|${aTextoLima(m.fecha_local)!.slice(0, 10)}`)
    );

    // Del mas reciente al mas viejo: la racha se cuenta hacia atras
    const dias = diasEntre(desde, hasta).reverse();
    const salida: Alerta[] = [];

    for (const p of personal as any[]) {
        let racha = 0;
        let primerDia: string | null = null;
        let ultimoDia: string | null = null;

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

            // Un dia que no le tocaba no suma ni corta: simplemente no cuenta
            if (!dl.labora) { continue; }
            if (marco.has(`${p.idcolaborador}|${fecha}`)) { break; }

            racha++;
            if (!ultimoDia) { ultimoDia = fecha; }
            primerDia = fecha;
        }

        if (racha >= DIAS_PARA_ALERTAR) {
            const ult: any = await prisma.asistencia_marca.findFirst({
                where: { idcolaborador: p.idcolaborador, tipo: 'ENTRADA' } as any,
                orderBy: { marcada_at: 'desc' }
            });
            salida.push({
                idcolaborador: p.idcolaborador,
                nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                dni: p.dni,
                dias: racha,
                desde: primerDia!,
                hasta: ultimoDia!,
                ultima_marca: ult ? aTextoLima(ult.marcada_at)!.slice(0, 10) : null
            });
        }
    }

    // Primero el que lleva mas tiempo sin aparecer: es el caso mas urgente
    salida.sort((a, b) => b.dias - a.dias);
    return { alertas: salida, desde, hasta, ...estado };
}

// ---------------------------------------------------------------------------
// Resolver: esta de vacaciones / con licencia
// ---------------------------------------------------------------------------

const ETIQUETA: Record<string, string> = {
    VACACIONES: 'Vacaciones',
    LICENCIA: 'Licencia con goce',
    DESCANSO_MEDICO: 'Descanso medico',
    PERMISO_SIN_GOCE: 'Permiso sin goce de haber'
};

/**
 * Registra una ausencia justificada sobre un RANGO de dias.
 *
 * Va por rango y no por dia porque nadie se toma vacaciones de un dia: pedirlo
 * dia por dia son quince formularios para una sola decision.
 *
 * Solo escribe los dias que la persona iba a trabajar. Marcar el domingo como
 * vacaciones no cambia nada y despues ensucia cualquier conteo de "cuantos dias
 * de vacaciones se tomo".
 */
export async function registrarAusencia(ctx: Ctx, body: any, autor: Autor) {
    const idcolaborador = Number(body.idcolaborador) || 0;
    if (!idcolaborador) { throw new Invalido('Falta el colaborador.'); }

    const desde = String(body.desde || '');
    const hasta = String(body.hasta || desde);
    if (!ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) { throw new Invalido('Faltan las fechas.'); }
    if (desde > hasta) { throw new Invalido('La fecha inicial es posterior a la final.'); }

    const dias = diasEntre(desde, hasta);
    if (dias.length > 366) { throw new Invalido('El rango no puede pasar de un ano.'); }

    const categoria = String(body.categoria || '').toUpperCase() as Categoria;
    if (!ETIQUETA[categoria]) {
        throw new Invalido('Elige el tipo de ausencia: vacaciones, licencia, descanso medico o permiso sin goce.');
    }

    const c = await prisma.colaborador.findFirst({
        where: { idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
    });
    if (!c) { throw new Invalido('Ese colaborador no es de esta sede.', 404); }

    const motivo = texto(body.motivo, 200) || ETIQUETA[categoria];
    const ctxLab = await contextoLaboral(ctx.idorg, ctx.idsede, desde, hasta);

    let escritos = 0;
    for (const fecha of dias) {
        const dl = resolverDia({
            fecha,
            horario_semanal: (c as any).horario_semanal,
            tolerancia_min: (c as any).tolerancia_min ?? 10,
            excepciones: ctxLab.porPersona(idcolaborador),
            feriados: ctxLab.feriados,
            dias_cierre: ctxLab.dias_cierre,
            politica: ctxLab.politica
        });
        if (!dl.labora) { continue; }

        await guardarExcepcion(ctx, {
            fecha, idcolaborador, tipo: 'NO_LABORABLE', motivo, categoria
        }, autor);
        escritos++;
    }

    // Una sola linea en la bitacora para todo el rango: quince lineas seguidas
    // diciendo lo mismo esconden el resto del historial.
    await anotar({
        idorg: ctx.idorg, idsede_restobar: ctxLab.idsedeRestobar,
        entidad: 'EXCEPCION', idcolaborador, accion: 'CREA',
        detalle: `${(c as any).nombres}: ${ETIQUETA[categoria]} del ${desde} al ${hasta} ` +
            `(${escritos} dia(s) de trabajo)` +
            (CATEGORIAS_PAGADAS.includes(categoria) ? ' - se paga' : ' - no se paga'),
        nuevo: { desde, hasta, categoria, dias: escritos }
    }, autor);

    return { dias: escritos, desde, hasta, categoria, pagado: CATEGORIAS_PAGADAS.includes(categoria) };
}

// ---------------------------------------------------------------------------
// Resolver: ya no trabaja aqui
// ---------------------------------------------------------------------------

/**
 * Da de baja al colaborador.
 *
 * No borra nada: sus marcas, sus horarios y sus boletas quedan, porque el
 * D.S. 004-2006-TR obliga a conservar el registro de jornada cinco anos. Lo que
 * cambia es que deja de aparecer en el dia, en los reportes y en la planilla, y
 * por lo tanto deja de acumular faltas.
 */
export async function darDeBaja(ctx: Ctx, body: any, autor: Autor) {
    const idcolaborador = Number(body.idcolaborador) || 0;
    if (!idcolaborador) { throw new Invalido('Falta el colaborador.'); }

    const fecha = ES_FECHA.test(String(body.fecha || '')) ? String(body.fecha) : ahoraLima().slice(0, 10);
    const motivo = texto(body.motivo, 150);
    if (!motivo) { throw new Invalido('Escribe por que deja de trabajar: renuncia, fin de contrato, despido.'); }

    const c: any = await prisma.colaborador.findFirst({
        where: { idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
    });
    if (!c) { throw new Invalido('Ese colaborador no es de esta sede.', 404); }
    if (c.estado !== 0) { throw new Invalido('Ese colaborador ya esta dado de baja.'); }

    await prisma.colaborador.update({
        where: { idcolaborador },
        data: { estado: 1, f_baja: fecha, motivo_baja: motivo } as any
    });

    // El celular se revoca en el mismo acto: dejarlo activo permitiria marcar a
    // alguien que ya no trabaja aqui.
    await prisma.colaborador_dispositivo.updateMany({
        where: { idcolaborador, activo: true } as any,
        data: { activo: null, revocado_at: fechaSql(ahoraLima()) } as any
    });

    const sede: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });
    await anotar({
        idorg: ctx.idorg, idsede_restobar: sede?.idsede_restobar ?? 0,
        entidad: 'HORARIO', identidad: idcolaborador, idcolaborador, accion: 'ELIMINA',
        detalle: `Baja de ${((c.nombres || '') + ' ' + (c.apellidos || '')).trim()} el ${fecha}: ${motivo}`,
        anterior: { estado: 0 },
        nuevo: { estado: 1, f_baja: fecha, motivo_baja: motivo }
    }, autor);

    return { idcolaborador, f_baja: fecha, motivo_baja: motivo };
}
