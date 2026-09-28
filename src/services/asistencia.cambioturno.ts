// Cambio de turno entre companeros.
//
// EL CASO
// Alguien no puede venir y le pide a un companero que descansa ese dia que lo
// cubra. El que cubre asume el turno; el que falta asume el descanso del otro.
// Se arregla de palabra, entre ellos, y hasta ahora el sistema no se enteraba.
//
// POR QUE IMPORTA (no es burocracia, es plata)
// D. Leg. 713: trabajar en dia de descanso SIN descanso sustitutorio se paga
// con +100%. Si nadie registra el cambio, el sistema le carga ese recargo a
// quien cubrio -- aunque SI tuvo descanso sustitutorio, se lo dio el otro -- y
// ademas le descuenta el dia al que falto. Registrarlo bien es la diferencia
// entre pagar el dia una vez o dos.
//
// COMO SE CONFIRMA, SIN ADMINISTRADOR
// El que cubre lo propone al marcar. El que falto lo confirma la proxima vez
// que marca. Es el momento natural: el que falta no esta ese dia -- por eso
// hubo cambio -- pero vuelve al siguiente.
//
// MIENTRAS ESTA PENDIENTE NO CAMBIA NADA, y eso es lo correcto: si el cambio
// nunca se confirma, entonces de verdad hubo una falta y de verdad se trabajo
// un descanso sin sustituto.

import { PrismaClient } from "@prisma/client";
import { ahoraLima, fechaSql, aTextoLima, diaSemana, tramosDe } from "./asistencia.calendario";
import { resolverDia } from "./asistencia.dialaboral";
import { contextoLaboral, Invalido } from "./asistencia.config";

const prisma = new PrismaClient();

/**
 * Dias que tiene el que falto para confirmar.
 *
 * Una confirmacion un mes despues no es una confirmacion, es una
 * reconstruccion: nadie se acuerda. Ademas, pasada la semana el periodo de
 * planilla puede haber cerrado, y mover un dia de un periodo pagado es peor
 * que dejarlo como quedo.
 */
export const DIAS_PARA_CONFIRMAR = 7;

/** Dias de la semana que se miran para el descanso obligatorio. */
const SEMANA = 7;

const hoyLima = () => ahoraLima().slice(0, 10);

const sumarDias = (fecha: string, n: number) =>
    new Date(Date.parse(fecha + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/**
 * Si a esta persona le quedaria al menos un dia de descanso en la semana.
 *
 * D. Leg. 713 art. 1: 24 horas continuas de descanso por semana. Dos
 * companeros arreglando entre ellos no van a pensar en esto -- estan
 * resolviendo un problema de hoy -- y el que queda expuesto a la multa es el
 * restaurante.
 *
 * Se mira la semana que CONTIENE el dia que se va a cubrir, de lunes a
 * domingo. Si en esa semana no le queda ningun dia libre, el cambio no se
 * puede hacer.
 */
async function conservaDescansoSemanal(
    idorg: number, idsede: number, idcolaborador: number, fecha: string
): Promise<boolean> {
    // Lunes de esa semana
    const dow = (new Date(fecha + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const lunes = sumarDias(fecha, -dow);
    const domingo = sumarDias(lunes, 6);

    const persona: any = await prisma.colaborador.findFirst({ where: { idcolaborador } as any });
    if (!persona) { return false; }

    const c = await contextoLaboral(idorg, idsede, lunes, domingo);

    let libres = 0;
    for (let i = 0; i < SEMANA; i++) {
        const d = sumarDias(lunes, i);
        // El dia que se quiere cubrir pasa a ser trabajado: no cuenta como libre.
        if (d === fecha) { continue; }

        const dl = resolverDia({
            fecha: d,
            horario_semanal: persona.horario_semanal as any,
            tolerancia_min: persona.tolerancia_min ?? 10,
            excepciones: c.porPersona(idcolaborador),
            feriados: c.feriados,
            dias_cierre: c.dias_cierre,
            politica: c.politica
        });
        if (!dl.labora) { libres++; }
    }

    return libres > 0;
}

/**
 * A quienes puede decir que esta cubriendo.
 *
 * Solo la gente a la que HOY le tocaba trabajar y todavia no marco. Ofrecer la
 * lista entera del local invitaria a elegir cualquier nombre; asi, lo unico que
 * se puede declarar es lo que realmente pudo haber pasado.
 */
export async function candidatos(
    idorg: number, idsede: number, idsedeRestobar: number, idcolaborador: number, fecha: string
) {
    const personal = await prisma.colaborador.findMany({
        where: { idorg, idsede, estado: 0 } as any,
        select: {
            idcolaborador: true, nombres: true, apellidos: true,
            horario_semanal: true, tolerancia_min: true
        },
        orderBy: { nombres: 'asc' }
    });

    const c = await contextoLaboral(idorg, idsede, fecha, fecha);

    const marcaron = new Set(
        (await prisma.asistencia_marca.findMany({
            where: { fecha_local: fechaSql(fecha + ' 00:00:00'), tipo: 'ENTRADA' } as any,
            select: { idcolaborador: true }
        })).map(m => m.idcolaborador)
    );

    const lista = [];
    for (const p of personal as any[]) {
        if (p.idcolaborador === idcolaborador) { continue; }   // no se cubre a si mismo
        if (marcaron.has(p.idcolaborador)) { continue; }        // ese vino

        const dl = resolverDia({
            fecha,
            horario_semanal: p.horario_semanal,
            tolerancia_min: p.tolerancia_min ?? 10,
            excepciones: c.porPersona(p.idcolaborador),
            feriados: c.feriados,
            dias_cierre: c.dias_cierre,
            politica: c.politica
        });
        if (!dl.labora) { continue; }                           // a ese tampoco le tocaba

        lista.push({
            idcolaborador: p.idcolaborador,
            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
            hora_esperada: dl.hora_esperada
        });
    }

    return lista;
}

/** Lo propone quien vino a cubrir, en el momento de marcar. */
export async function proponer(
    idorg: number, idsedeRestobar: number, idsede: number,
    idcolaboradorCubre: number, idcolaboradorFalta: number,
    fecha: string, idmarca: number | null
) {
    if (idcolaboradorCubre === idcolaboradorFalta) {
        throw new Invalido('no se puede cubrir a uno mismo');
    }

    const validos = await candidatos(idorg, idsede, idsedeRestobar, idcolaboradorCubre, fecha);
    if (!validos.some(v => v.idcolaborador === idcolaboradorFalta)) {
        throw new Invalido('a esa persona no le tocaba trabajar hoy, o ya vino');
    }

    // LA REGLA QUE ELLOS NO VAN A VER.
    if (!await conservaDescansoSemanal(idorg, idsede, idcolaboradorCubre, fecha)) {
        throw new Invalido(
            'Con este cambio te quedarias sin ningun dia de descanso esta semana, ' +
            'y la ley exige uno. Habla con el administrador.');
    }

    const ya = await prisma.asistencia_cambio_turno.findFirst({
        where: { idcolaborador_cubre: idcolaboradorCubre, fecha: fechaSql(fecha + ' 00:00:00') } as any
    });
    if (ya) { return { idcambio: (ya as any).idcambio, estado: (ya as any).estado, repetido: true }; }

    const ahora = fechaSql(ahoraLima());

    // La excepcion de quien cubre se crea YA, no al confirmar.
    //
    // Esta persona esta parada frente al marcador, en su dia de descanso, y con
    // la politica normal el marcador no la deja marcar hasta que un
    // administrador habilite el dia. Si la excepcion esperara a la
    // confirmacion, seguiria haciendo falta el administrador -- justo lo que
    // esto viene a evitar.
    //
    // Nace con compensacion RECARGO, que es el default SEGURO: mientras nadie
    // confirme, esta persona trabajo su descanso sin sustituto y se le debe el
    // 100% (D. Leg. 713). Confirmar la pasa a SUSTITUTORIO.
    const [c] = await prisma.$transaction([
        prisma.asistencia_cambio_turno.create({
            data: {
                idorg, idsede_restobar: idsedeRestobar,
                fecha: fechaSql(fecha + ' 00:00:00'),
                idcolaborador_cubre: idcolaboradorCubre,
                idcolaborador_falta: idcolaboradorFalta,
                estado: 'PENDIENTE',
                idmarca_origen: idmarca,
                creado_at: ahora
            } as any
        }),
        prisma.asistencia_excepcion.create({
            data: {
                idorg,
                idsede_restobar: idsedeRestobar,
                idcolaborador: idcolaboradorCubre,
                fecha: fechaSql(fecha + ' 00:00:00'),
                tipo: 'LABORABLE',
                motivo: 'Cambio de turno: cubre a un companero (sin confirmar)',
                compensacion: 'RECARGO',
                recargo_pct: 100,
                categoria: 'NORMAL',
                origen: 'KIOSKO',
                creado_at: ahora
            } as any
        })
    ]);

    return { idcambio: (c as any).idcambio, estado: 'PENDIENTE', repetido: false };
}

/**
 * Lo que este colaborador tiene para confirmar.
 *
 * Se le muestra al marcar: es el momento en que esta persona vuelve al local
 * despues del dia que falto.
 */
export async function pendientesDe(idcolaborador: number) {
    const limite = sumarDias(hoyLima(), -DIAS_PARA_CONFIRMAR);

    const filas: any[] = await prisma.asistencia_cambio_turno.findMany({
        where: {
            idcolaborador_falta: idcolaborador,
            estado: 'PENDIENTE',
            fecha: { gte: fechaSql(limite + ' 00:00:00') }
        } as any,
        orderBy: { fecha: 'desc' }
    });

    if (!filas.length) { return []; }

    const quienes = await prisma.colaborador.findMany({
        where: { idcolaborador: { in: filas.map(f => f.idcolaborador_cubre) } } as any,
        select: { idcolaborador: true, nombres: true, apellidos: true }
    });
    const nombre = new Map(quienes.map((q: any) =>
        [q.idcolaborador, ((q.nombres || '') + ' ' + (q.apellidos || '')).trim()]));

    return filas.map(f => ({
        idcambio: f.idcambio,
        fecha: aTextoLima(f.fecha)!.slice(0, 10),
        idcolaborador_cubre: f.idcolaborador_cubre,
        cubrio: nombre.get(f.idcolaborador_cubre) || 'un companero'
    }));
}

/**
 * El que falto dice si es cierto.
 *
 * Al confirmar se mueven los DOS dias, y recien ahi cambia la plata:
 *   - el que falto pasa a tener descanso ese dia -> deja de ser falta;
 *   - el que cubrio pasa a tener descanso SUSTITUTORIO -> deja de cobrar el
 *     recargo del 100%, porque ya tuvo su descanso.
 */
export async function resolver(idcolaborador: number, idcambio: number, acepta: boolean) {
    const c: any = await prisma.asistencia_cambio_turno.findFirst({
        where: { idcambio, idcolaborador_falta: idcolaborador } as any
    });
    if (!c) { throw new Invalido('ese cambio no es tuyo', 404); }
    if (c.estado !== 'PENDIENTE') { throw new Invalido('ese cambio ya se resolvio'); }

    const fecha = aTextoLima(c.fecha)!.slice(0, 10);

    if (fecha < sumarDias(hoyLima(), -DIAS_PARA_CONFIRMAR)) {
        await prisma.asistencia_cambio_turno.update({
            where: { idcambio } as any,
            data: { estado: 'VENCIDO', resuelto_at: fechaSql(ahoraLima()) } as any
        });
        throw new Invalido(
            `Pasaron mas de ${DIAS_PARA_CONFIRMAR} dias: este cambio ya no se puede confirmar aqui. ` +
            'Lo tiene que resolver el administrador.');
    }

    if (!acepta) {
        // Se deja la excepcion de quien cubrio TAL CUAL, con su RECARGO: si el
        // otro dice que no hubo acuerdo, entonces trabajo su descanso sin
        // sustituto y se le debe el 100%. Borrarla le quitaria el dia
        // trabajado, que si existio.
        await prisma.asistencia_cambio_turno.update({
            where: { idcambio } as any,
            data: { estado: 'RECHAZADO', resuelto_at: fechaSql(ahoraLima()) } as any
        });
        return { estado: 'RECHAZADO' };
    }

    const ahora = fechaSql(ahoraLima());

    // Al confirmar cambian DOS cosas, y van juntas. A medio aplicar seria lo
    // peor de los dos mundos: uno deja de cobrar el recargo y el otro sigue con
    // la falta.
    //   1. el que falto pasa a tener descanso ese dia -> deja de ser falta;
    //   2. el que cubrio pasa de RECARGO a SUSTITUTORIO -> deja de cobrar el
    //      100%, porque el descanso del otro fue su sustituto.
    await prisma.$transaction([
        prisma.asistencia_excepcion.create({
            data: {
                idorg: c.idorg,
                idsede_restobar: c.idsede_restobar,
                fecha: fechaSql(fecha + ' 00:00:00'),
                origen: 'KIOSKO' as any,
                creado_at: ahora,
                idcolaborador: c.idcolaborador_falta,
                tipo: 'NO_LABORABLE',
                motivo: 'Cambio de turno: lo cubrio un companero',
                categoria: 'NORMAL'
            } as any
        }),
        prisma.asistencia_excepcion.updateMany({
            where: {
                idcolaborador: c.idcolaborador_cubre,
                fecha: fechaSql(fecha + ' 00:00:00'),
                tipo: 'LABORABLE'
            } as any,
            data: {
                compensacion: 'SUSTITUTORIO',
                fecha_sustituto: fechaSql(fecha + ' 00:00:00'),
                motivo: 'Cambio de turno: cubrio a un companero'
            } as any
        }),
        prisma.asistencia_cambio_turno.update({
            where: { idcambio } as any,
            data: { estado: 'CONFIRMADO', resuelto_at: ahora } as any
        })
    ]);

    return { estado: 'CONFIRMADO', fecha };
}

/** Los cambios del local, para que el administrador los vea. No los configura. */
export async function listar(idorg: number, idsedeRestobar: number, desde: string, hasta: string) {
    const filas: any[] = await prisma.asistencia_cambio_turno.findMany({
        where: {
            idorg, idsede_restobar: idsedeRestobar,
            fecha: {
                gte: fechaSql(desde + ' 00:00:00'),
                lte: fechaSql(hasta + ' 00:00:00')
            }
        } as any,
        orderBy: { fecha: 'desc' }
    });

    if (!filas.length) { return []; }

    const ids = Array.from(new Set(filas.flatMap(f => [f.idcolaborador_cubre, f.idcolaborador_falta])));
    const gente = await prisma.colaborador.findMany({
        where: { idcolaborador: { in: ids } } as any,
        select: { idcolaborador: true, nombres: true, apellidos: true }
    });
    const nombre = new Map(gente.map((q: any) =>
        [q.idcolaborador, ((q.nombres || '') + ' ' + (q.apellidos || '')).trim()]));

    const vencidos = sumarDias(hoyLima(), -DIAS_PARA_CONFIRMAR);

    return filas.map(f => {
        const fecha = aTextoLima(f.fecha)!.slice(0, 10);
        return {
            idcambio: f.idcambio,
            fecha,
            cubrio: nombre.get(f.idcolaborador_cubre) || '',
            falto: nombre.get(f.idcolaborador_falta) || '',
            // Un pendiente viejo ya no se va a poder confirmar: se muestra como
            // vencido aunque en la base siga diciendo PENDIENTE. Marcarlos con
            // un proceso nocturno seria una pieza mas para mantener.
            estado: (f.estado === 'PENDIENTE' && fecha < vencidos) ? 'VENCIDO' : f.estado,
            creado_at: aTextoLima(f.creado_at)
        };
    });
}
