// Configuracion de asistencia: horarios, dias de cierre, feriados y excepciones.
//
// Vive aqui y no en un controlador porque se opera desde DOS puertas:
//   - el POS (token firmado de la sede, con compuerta de administrador)
//   - rrhh-1 (login de Recursos Humanos)
//
// Si cada puerta tuviera su copia, el dia que cambie una regla -- por ejemplo
// que el recargo minimo sea 100% -- una de las dos quedaria vieja y la planilla
// saldria distinta segun por donde se cargo el dato. Las puertas se diferencian
// en QUIEN puede entrar y en que queda en la bitacora (`Autor`), no en que hace
// cada operacion.

import { PrismaClient, Prisma } from "@prisma/client";
import {
    validarHorario, ahoraLima, fechaSql, aTextoLima, horaEsperada, diaSemana
} from "./asistencia.calendario";
import { resolverDia, Excepcion as ExcepcionDia } from "./asistencia.dialaboral";
import { anotar, Autor, detalleHorario, detalleExcepcion, horarioATexto } from "./asistencia.bitacora";

const prisma = new PrismaClient();

/** Empresa y sede ya resueltas. Ninguna operacion las toma del body. */
export interface Ctx { idorg: number; idsede: number }

/**
 * Error de lo que pidio el usuario, no del servidor. El controlador lo traduce
 * a 400/404; cualquier otro Error sigue siendo un 500 con su stack en el log.
 */
export class Invalido extends Error {
    code: number;
    constructor(mensaje: string, code = 400) {
        super(mensaje);
        // El proyecto compila a ES5, donde heredar de Error rompe el prototipo y
        // `instanceof Invalido` da false: el controlador lo tomaria por un error
        // interno y devolveria 500 en vez del mensaje. Se restituye a mano.
        Object.setPrototypeOf(this, Invalido.prototype);
        this.code = code;
    }
}

export const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_SEM = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const CATEGORIAS = ['NORMAL', 'VACACIONES', 'LICENCIA', 'DESCANSO_MEDICO', 'PERMISO_SIN_GOCE'];

const texto = (v: any, max = 200) => (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);

/** Todos los dias de un mes 'YYYY-MM' como 'YYYY-MM-DD'. */
export function diasDelMes(mes: string): string[] {
    const [a, m] = mes.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const out: string[] = [];
    for (let d = 1; d <= ultimo; d++) { out.push(`${mes}-${String(d).padStart(2, '0')}`); }
    return out;
}

/**
 * Lo que la sede decidio una vez: si abre los feriados y que pasa si alguien
 * trabaja en su dia de descanso. Se lee con la fila de sede ya cargada para no
 * repetir la consulta en el camino del marcado, que es el mas caliente.
 */
export function politicaDe(sede: any) {
    return {
        feriado_abre: !!sede?.feriado_abre,
        feriado_recargo_pct: Number(sede?.feriado_recargo_pct ?? 0),
        descanso_trabajado: String(sede?.descanso_trabajado || 'PERMISO'),
        descanso_recargo_pct: Number(sede?.descanso_recargo_pct ?? 100)
    };
}

/** El id de sede del POS, que es por el que se guardan las excepciones. */
async function sedeRestobar(idsede: number): Promise<number> {
    const s: any = await prisma.sede.findUnique({ where: { idsede } });
    return s?.idsede_restobar ?? 0;
}

// ---------------------------------------------------------------------------
// Contexto laboral
// ---------------------------------------------------------------------------

/**
 * Todo lo que hace falta para decidir si alguien trabaja un dia: los dias fijos
 * de cierre, los feriados y las excepciones cargadas.
 *
 * Se lee una vez por rango y se reusa para todas las personas y todos los dias.
 * Consultarlo por celda seria una consulta por persona por dia.
 */
export async function contextoLaboral(idorg: number, idsede: number, desde: string, hasta: string) {
    const sede: any = await prisma.sede.findUnique({ where: { idsede } });
    const idsedeRestobar = sede?.idsede_restobar ?? 0;

    const desdeD = fechaSql(desde + ' 00:00:00');
    const hastaD = fechaSql(hasta + ' 00:00:00');

    // Se traen tambien las excepciones cuyo fecha_sustituto cae en el rango:
    // son las que hacen que un dia de esta semana sea descanso aunque la
    // excepcion que lo origino este fuera del rango consultado.
    const filas: any[] = await prisma.asistencia_excepcion.findMany({
        where: {
            idsede_restobar: idsedeRestobar,
            OR: [
                { fecha: { gte: desdeD, lte: hastaD } },
                { fecha_sustituto: { gte: desdeD, lte: hastaD } }
            ]
        } as any
    });

    const feriados: any[] = await prisma.asistencia_feriado.findMany({
        where: {
            estado: '0',
            OR: [{ idorg: 0 }, { idorg }],
            fecha: { gte: desdeD, lte: hastaD }
        } as any
    });

    const excepciones: ExcepcionDia[] = filas.map(f => ({
        idcolaborador: f.idcolaborador,
        fecha: aTextoLima(f.fecha)!.slice(0, 10),
        tipo: f.tipo,
        motivo: f.motivo,
        compensacion: f.compensacion,
        fecha_sustituto: f.fecha_sustituto ? aTextoLima(f.fecha_sustituto)!.slice(0, 10) : null,
        recargo_pct: f.recargo_pct,
        categoria: f.categoria || 'NORMAL'
    }));

    return {
        idsedeRestobar,
        politica: politicaDe(sede),
        dias_cierre: String(sede?.dias_cierre || '').split(',').map(s => s.trim()).filter(Boolean),
        excepciones,
        // idcolaborador 0 = de la sede; se pasan siempre, mas las de la persona
        deSede: excepciones.filter(e => e.idcolaborador === 0),
        porPersona: (id: number) => excepciones.filter(e => e.idcolaborador === 0 || e.idcolaborador === id),
        feriados: new Map<string, string>(feriados.map(f => [aTextoLima(f.fecha)!.slice(0, 10), f.descripcion])),
        ids: filas.reduce((m: Map<string, number>, f: any) => {
            m.set(`${f.idcolaborador}|${aTextoLima(f.fecha)!.slice(0, 10)}`, f.idexcepcion);
            return m;
        }, new Map<string, number>())
    };
}

// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------

/**
 * Da por terminado el asistente inicial.
 *
 * Solo apaga el asistente. No valida que la configuracion este "completa" a
 * proposito: si el dueno quiere saltearse el paso del personal y cargarlo
 * manana, es su negocio; forzarlo lo dejaria dando vueltas sin poder entrar.
 */
export async function marcarConfigurado(ctx: Ctx) {
    await prisma.sede.update({
        where: { idsede: ctx.idsede },
        data: { asis_configurado: true } as any
    });
    return { configurado: true };
}

export async function guardarHorario(ctx: Ctx, body: any, autor: Autor) {
    const id = Number(body.idcolaborador) || 0;
    if (!id) { throw new Invalido('id invalido'); }

    let horario;
    try {
        horario = validarHorario(body.horario_semanal);
    } catch (e: any) {
        throw new Invalido(e.message);
    }

    let tolerancia = Number(body.tolerancia_min);
    if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 240) { tolerancia = 10; }

    // Se lee ANTES de escribir: la bitacora necesita el valor anterior, y
    // despues del update ya se perdio.
    const antes: any = await prisma.colaborador.findFirst({ where: { idcolaborador: id, idorg: ctx.idorg } });
    if (!antes) { throw new Invalido('ese colaborador no es de esta empresa', 404); }

    // Una columna JSON nullable no acepta `null` plano: Prisma exige DbNull
    // (NULL de SQL) para distinguirlo de JsonNull (el literal JSON `null`).
    // Aqui "sin horario" es NULL de verdad.
    const r = await prisma.colaborador.updateMany({
        where: { idcolaborador: id, idorg: ctx.idorg },
        data: { horario_semanal: horario === null ? Prisma.DbNull : horario, tolerancia_min: tolerancia } as any
    });
    if (!r.count) { throw new Invalido('ese colaborador no es de esta empresa', 404); }

    await anotar({
        idorg: ctx.idorg, idsede_restobar: await sedeRestobar(ctx.idsede),
        entidad: 'HORARIO', identidad: id, idcolaborador: id, accion: 'MODIFICA',
        detalle: detalleHorario(
            ((antes.nombres || '') + ' ' + (antes.apellidos || '')).trim(),
            antes.horario_semanal, horario, antes.tolerancia_min ?? 10, tolerancia
        ),
        anterior: { horario_semanal: antes.horario_semanal, tolerancia_min: antes.tolerancia_min },
        nuevo: { horario_semanal: horario, tolerancia_min: tolerancia }
    }, autor);

    return { idcolaborador: id, horario_semanal: horario, tolerancia_min: tolerancia };
}

/** Las areas que puede usar esta sede: las comunes (idsede 0) mas las suyas. */
const areasDeLaSede = (idsede: number) => ({ estado: '0', OR: [{ idsede: 0 }, { idsede }] });

export async function listarAreas(ctx: Ctx) {
    const areas: any[] = await prisma.area.findMany({
        where: areasDeLaSede(ctx.idsede) as any,
        orderBy: { descripcion: 'asc' }
    });
    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        select: { idarea: true }
    });

    const cuenta = new Map<number, number>();
    for (const c of personal as any[]) {
        const k = c.idarea || 0;
        cuenta.set(k, (cuenta.get(k) || 0) + 1);
    }

    return {
        areas: areas.map(a => ({
            idarea: a.idarea, descripcion: a.descripcion, personal: cuenta.get(a.idarea) || 0
        })),
        sin_area: cuenta.get(0) || 0
    };
}

/** Asigna area a una o varias personas de una vez. */
export async function asignarArea(ctx: Ctx, body: any, autor: Autor) {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
    if (!ids.length) { throw new Invalido('No se selecciono a nadie.'); }

    const idarea = Number(body.idarea) || null;
    if (idarea) {
        const a = await prisma.area.findFirst({ where: { idarea, ...areasDeLaSede(ctx.idsede) } as any });
        if (!a) { throw new Invalido('Esa area no es de esta sede.', 404); }
    }

    const r = await prisma.colaborador.updateMany({
        where: { idcolaborador: { in: ids }, idorg: ctx.idorg, idsede: ctx.idsede },
        data: { idarea } as any
    });
    return { actualizados: r.count };
}

/**
 * El mismo horario para todo un grupo.
 *
 * Existe porque la cocina entera suele entrar a la misma hora: cargarlo uno por
 * uno son quince dialogos identicos, y a la quinta persona alguien se equivoca.
 *
 * `solo_contar` devuelve a cuantos alcanzaria sin tocar nada, para que la
 * pantalla pueda decir "se va a aplicar a 12" ANTES de que se confirme.
 */
export async function horarioMasivo(ctx: Ctx, body: any, autor: Autor) {
    const base: any = { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 };
    const alcance = String(body.alcance || '');

    if (alcance === 'area') {
        const idarea = Number(body.idarea) || null;
        if (idarea) {
            const a = await prisma.area.findFirst({ where: { idarea, ...areasDeLaSede(ctx.idsede) } as any });
            if (!a) { throw new Invalido('Esa area no es de esta sede.', 404); }
        }
        base.idarea = idarea;   // null = "sin area"
    } else if (alcance === 'seleccion') {
        const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
        if (!ids.length) { throw new Invalido('No se selecciono a nadie.'); }
        base.idcolaborador = { in: ids };
    } else if (alcance !== 'todos') {
        throw new Invalido('Alcance no reconocido.');
    }

    if (body.solo_contar) {
        return { alcanzados: await prisma.colaborador.count({ where: base }) };
    }

    let horario;
    try {
        horario = validarHorario(body.horario_semanal);
    } catch (e: any) {
        throw new Invalido(e.message);
    }

    let tolerancia = Number(body.tolerancia_min);
    if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 240) { tolerancia = 10; }

    // Los nombres se leen antes para poder decir A QUIENES alcanzo el cambio.
    // "se aplico a 12 personas" sin la lista no sirve ante un reclamo.
    const alcanzados: any[] = await prisma.colaborador.findMany({
        where: base, select: { idcolaborador: true, nombres: true }
    });

    const r = await prisma.colaborador.updateMany({
        where: base,
        data: {
            horario_semanal: horario === null ? Prisma.DbNull : horario,
            tolerancia_min: tolerancia
        } as any
    });

    const comoSeEligio = alcance === 'todos' ? 'todo el personal'
        : alcance === 'area' ? (Number(body.idarea) ? 'un area' : 'los que no tienen area')
        : 'una seleccion';

    await anotar({
        idorg: ctx.idorg, idsede_restobar: await sedeRestobar(ctx.idsede),
        entidad: 'HORARIO', accion: 'MODIFICA',
        detalle: `Horario masivo a ${comoSeEligio} (${r.count} persona(s)): ` +
            `${horarioATexto(horario)}, tolerancia ${tolerancia} min`,
        nuevo: {
            horario_semanal: horario, tolerancia_min: tolerancia, alcance,
            alcanzados: alcanzados.map(c => ({ id: c.idcolaborador, nombre: c.nombres }))
        }
    }, autor);

    return { actualizados: r.count };
}

// ---------------------------------------------------------------------------
// Calendario: lectura
// ---------------------------------------------------------------------------

/**
 * El mes completo tal como lo ve el calendario: que dias abre el local, cuales
 * son feriado y que excepciones hay cargadas.
 *
 * Devuelve el estado de la SEDE por dia. El detalle por persona se pide aparte
 * al tocar un dia: traer 17 personas x 30 dias en cada apertura del mes seria
 * pesado y casi nunca se mira.
 */
export async function calendarioMes(ctx: Ctx, mesPedido: any) {
    const mes = /^\d{4}-\d{2}$/.test(String(mesPedido || '')) ? String(mesPedido) : ahoraLima().slice(0, 7);

    const dias = diasDelMes(mes);
    const c = await contextoLaboral(ctx.idorg, ctx.idsede, dias[0], dias[dias.length - 1]);

    // Cuantas excepciones personales hay por dia, para pintar el badge
    const personalesPorDia = new Map<string, number>();
    for (const e of c.excepciones) {
        if (e.idcolaborador === 0) { continue; }
        personalesPorDia.set(e.fecha, (personalesPorDia.get(e.fecha) || 0) + 1);
    }

    return {
        mes,
        dias_cierre: c.dias_cierre,
        dias: dias.map(fecha => {
            const sem = diaSemana(fecha);
            const feriado = c.feriados.get(fecha) || null;
            const exc = c.deSede.find(e => e.fecha === fecha) || null;

            // Que pasa con el LOCAL ese dia (no con una persona)
            const abre = exc ? exc.tipo === 'LABORABLE'
                : feriado ? false
                : !c.dias_cierre.includes(sem);

            return {
                fecha,
                dia_semana: sem,
                abre,
                feriado,
                excepcion: exc ? { tipo: exc.tipo, motivo: exc.motivo } : null,
                idexcepcion: c.ids.get(`0|${fecha}`) || null,
                personas_con_excepcion: personalesPorDia.get(fecha) || 0
            };
        })
    };
}

/** El detalle de un dia: quien trabaja, quien descansa y por que. */
export async function calendarioDia(ctx: Ctx, fechaPedida: any) {
    const fecha = String(fechaPedida || '');
    if (!ES_FECHA.test(fecha)) { throw new Invalido('Falta el dia.'); }

    const c = await contextoLaboral(ctx.idorg, ctx.idsede, fecha, fecha);
    const personal = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    return {
        fecha,
        feriado: c.feriados.get(fecha) || null,
        excepcion_sede: c.deSede.find(e => e.fecha === fecha) || null,
        idexcepcion_sede: c.ids.get(`0|${fecha}`) || null,
        personal: personal.map((p: any) => {
            const dl = resolverDia({
                fecha,
                horario_semanal: p.horario_semanal as any,
                tolerancia_min: p.tolerancia_min ?? 10,
                excepciones: c.porPersona(p.idcolaborador),
                feriados: c.feriados,
                dias_cierre: c.dias_cierre,
                politica: c.politica
            });
            return {
                idcolaborador: p.idcolaborador,
                nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                labora: dl.labora,
                origen: dl.origen,
                motivo: dl.motivo,
                hora_esperada: dl.hora_esperada,
                es_descanso_trabajado: dl.es_descanso_trabajado,
                compensacion: dl.compensacion,
                fecha_sustituto: dl.fecha_sustituto,
                idexcepcion: c.ids.get(`${p.idcolaborador}|${fecha}`) || null
            };
        })
    };
}

// ---------------------------------------------------------------------------
// Calendario: escritura
// ---------------------------------------------------------------------------

/**
 * Guarda una excepcion. Con idcolaborador 0 aplica a toda la sede.
 *
 * Es un upsert por (sede, persona, fecha): volver a guardar el mismo dia
 * corrige en vez de duplicar, que es lo que el admin espera cuando se
 * equivoco de opcion.
 */
export async function guardarExcepcion(ctx: Ctx, body: any, autor: Autor, desdeKiosko = false) {
    const fecha = String(body.fecha || '');
    if (!ES_FECHA.test(fecha)) { throw new Invalido('Falta el dia.'); }

    const tipo = String(body.tipo || '').toUpperCase();
    if (tipo !== 'LABORABLE' && tipo !== 'NO_LABORABLE') { throw new Invalido('Tipo no valido.'); }

    const motivo = texto(body.motivo, 200);
    if (!motivo) { throw new Invalido('Escribe el motivo: es lo que explica el cambio despues.'); }

    const idcolaborador = Number(body.idcolaborador) || 0;
    if (idcolaborador) {
        const c = await prisma.colaborador.findFirst({
            where: { idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
        });
        if (!c) { throw new Invalido('Ese colaborador no es de esta sede.', 404); }
    }

    // La categoria explica una AUSENCIA de una persona. En un dia laborable, o
    // en una excepcion de toda la sede, no significa nada.
    const cat = String(body.categoria || 'NORMAL').toUpperCase();
    const categoria = (idcolaborador && tipo === 'NO_LABORABLE' && CATEGORIAS.includes(cat)) ? cat : 'NORMAL';

    // --- compensacion: solo tiene sentido si una PERSONA viene a trabajar ---
    let compensacion: string | null = null;
    let fechaSustituto: string | null = null;
    let recargo = 100;

    if (idcolaborador && tipo === 'LABORABLE') {
        const comp = String(body.compensacion || '').toUpperCase();
        if (comp === 'SUSTITUTORIO') {
            fechaSustituto = String(body.fecha_sustituto || '');
            if (!ES_FECHA.test(fechaSustituto)) { throw new Invalido('Elige que dia descansa a cambio.'); }
            if (fechaSustituto === fecha) { throw new Invalido('El dia de descanso no puede ser el mismo que trabaja.'); }
            compensacion = 'SUSTITUTORIO';
        } else if (comp === 'RECARGO') {
            compensacion = 'RECARGO';
            const p = Number(body.recargo_pct);
            // 100% es lo que manda el D.Leg. 713 para el dia de descanso y el
            // feriado. Se deja editable por si pactan mas, nunca menos.
            recargo = Number.isFinite(p) && p >= 100 && p <= 300 ? Math.round(p) : 100;
        }
        // Sin compensacion elegida se guarda igual: el reporte lo marca como
        // pendiente de definir en vez de bloquear la carga en la puerta.
    }

    const idsedeRestobar = await sedeRestobar(ctx.idsede);

    const datos: any = {
        idorg: ctx.idorg,
        idsede_restobar: idsedeRestobar,
        idcolaborador,
        fecha: fechaSql(fecha + ' 00:00:00'),
        tipo,
        motivo,
        compensacion,
        fecha_sustituto: fechaSustituto ? fechaSql(fechaSustituto + ' 00:00:00') : null,
        recargo_pct: recargo,
        categoria,
        origen: desdeKiosko ? 'KIOSKO' : 'MANUAL',
        creado_por: autor.idusuario,
        creado_at: fechaSql(ahoraLima())
    };

    const previa = await prisma.asistencia_excepcion.findFirst({
        where: { idsede_restobar: idsedeRestobar, idcolaborador, fecha: datos.fecha } as any
    });

    // Para el detalle hace falta el nombre: "Juan trabaja el 14" se entiende,
    // "el colaborador 37 trabaja el 14" no.
    const quien = idcolaborador
        ? ((await prisma.colaborador.findUnique({ where: { idcolaborador } }))?.nombres || ('#' + idcolaborador))
        : 'Todo el local';
    const frase = detalleExcepcion(quien, fecha, tipo, motivo, compensacion, fechaSustituto);

    if (previa) {
        await prisma.asistencia_excepcion.update({ where: { idexcepcion: previa.idexcepcion }, data: datos });
        await anotar({
            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
            entidad: 'EXCEPCION', identidad: previa.idexcepcion,
            idcolaborador: idcolaborador || null, accion: 'MODIFICA',
            detalle: frase,
            anterior: { tipo: previa.tipo, motivo: previa.motivo, compensacion: (previa as any).compensacion },
            nuevo: { tipo, motivo, compensacion, fecha_sustituto: fechaSustituto, recargo_pct: recargo }
        }, autor);
        return { accion: 'ACTUALIZADA', idexcepcion: previa.idexcepcion };
    }

    const creada = await prisma.asistencia_excepcion.create({ data: datos });
    await anotar({
        idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
        entidad: 'EXCEPCION', identidad: creada.idexcepcion,
        idcolaborador: idcolaborador || null, accion: 'CREA',
        detalle: frase,
        nuevo: { tipo, motivo, compensacion, fecha_sustituto: fechaSustituto, recargo_pct: recargo }
    }, autor);
    return { accion: 'CREADA', idexcepcion: creada.idexcepcion };
}

export async function eliminarExcepcion(ctx: Ctx, idPedido: any, autor: Autor) {
    const id = Number(idPedido) || 0;
    if (!id) { throw new Invalido('id invalido'); }

    const previa: any = await prisma.asistencia_excepcion.findFirst({
        where: { idexcepcion: id, idorg: ctx.idorg } as any
    });
    if (!previa) { throw new Invalido('Esa excepcion no es de esta empresa.', 404); }

    await prisma.asistencia_excepcion.deleteMany({ where: { idexcepcion: id, idorg: ctx.idorg } as any });
    await anotar({
        idorg: ctx.idorg, idsede_restobar: await sedeRestobar(ctx.idsede),
        entidad: 'EXCEPCION', identidad: id,
        idcolaborador: previa.idcolaborador || null, accion: 'ELIMINA',
        detalle: 'Se quito la excepcion del ' + aTextoLima(previa.fecha)!.slice(0, 10) + ' (' + previa.motivo + ')',
        anterior: { tipo: previa.tipo, motivo: previa.motivo, compensacion: previa.compensacion }
    }, autor);
    return { eliminada: true };
}

/** Dias fijos que el local no abre. Es una regla; las excepciones le ganan. */
export async function guardarDiasCierre(ctx: Ctx, diasPedidos: any, autor: Autor) {
    const pedidos: string[] = Array.isArray(diasPedidos) ? diasPedidos : [];
    const dias = pedidos.map(d => String(d).toLowerCase().trim()).filter(d => DIAS_SEM.includes(d));
    // Sin dedupe, guardar dos veces 'lun' rompe el ancho de la columna sin motivo
    const unicos = Array.from(new Set(dias));

    if (unicos.length === 7) { throw new Invalido('No se pueden cerrar los siete dias de la semana.'); }

    const antes: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });
    const previos = String(antes?.dias_cierre || '');

    await prisma.sede.update({ where: { idsede: ctx.idsede }, data: { dias_cierre: unicos.join(',') } as any });

    if (previos !== unicos.join(',')) {
        await anotar({
            idorg: ctx.idorg, idsede_restobar: antes?.idsede_restobar ?? 0,
            entidad: 'DIAS_CIERRE', accion: 'MODIFICA',
            detalle: 'Dias que el local no abre: ' + (previos || 'ninguno') + ' -> ' + (unicos.join(',') || 'ninguno'),
            anterior: { dias_cierre: previos },
            nuevo: { dias_cierre: unicos.join(',') }
        }, autor);
    }

    return { dias_cierre: unicos };
}

// ---------------------------------------------------------------------------
// Configuracion: las tres preguntas
// ---------------------------------------------------------------------------
//
// Todo el modulo se opera con esto contestado una vez. Son tres decisiones del
// negocio, no tareas diarias:
//   1. que dias no abre el local
//   2. si abre los feriados y si se pagan extra
//   3. que pasa si alguien trabaja en su dia de descanso
//
// Van juntas en una sola pantalla y un solo guardado a proposito: partirlas en
// tres formularios haria que la gente conteste una y deje las otras en el
// default sin enterarse.

export async function leerConfiguracion(ctx: Ctx, anioPedido?: any) {
    const sede: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });
    const pol = politicaDe(sede);
    const anio = /^\d{4}$/.test(String(anioPedido || '')) ? Number(anioPedido) : Number(ahoraLima().slice(0, 4));

    const feriados: any[] = await prisma.asistencia_feriado.findMany({
        where: {
            estado: '0',
            OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
            fecha: { gte: fechaSql(`${anio}-01-01 00:00:00`), lte: fechaSql(`${anio}-12-31 00:00:00`) }
        } as any,
        orderBy: { fecha: 'asc' }
    });

    // Que feriados se trabajan se guarda como excepcion de sede, igual que
    // "este lunes abrimos". No hace falta otra tabla: es exactamente el mismo
    // hecho, y asi el motor de dias no tiene que aprender un caso mas.
    const abiertos = new Set<string>(
        (await prisma.asistencia_excepcion.findMany({
            where: {
                idsede_restobar: sede?.idsede_restobar ?? 0,
                idcolaborador: 0,
                tipo: 'LABORABLE',
                fecha: { gte: fechaSql(`${anio}-01-01 00:00:00`), lte: fechaSql(`${anio}-12-31 00:00:00`) }
            } as any
        })).map((e: any) => aTextoLima(e.fecha)!.slice(0, 10))
    );

    return {
        anio,
        configurado: !!sede?.asis_configurado,
        dias_cierre: String(sede?.dias_cierre || '').split(',').map((d: string) => d.trim()).filter(Boolean),
        ...pol,
        feriados: feriados.map(f => {
            const fecha = aTextoLima(f.fecha)!.slice(0, 10);
            return {
                idferiado: f.idferiado,
                fecha,
                descripcion: f.descripcion,
                propio: f.idorg !== 0,
                // Sin excepcion cargada manda el default del ano; con excepcion,
                // manda la excepcion. Asi un feriado nuevo del ano que viene
                // hereda lo que la sede ya decidio en vez de cerrar de golpe.
                labora: abiertos.has(fecha) ? true : pol.feriado_abre
            };
        })
    };
}

/** El ano que se esta configurando: el que viene en el cuerpo o el de las fechas. */
function anioDe(body: any, fechas: string[]): number {
    if (/^\d{4}$/.test(String(body?.anio || ''))) { return Number(body.anio); }
    if (fechas.length) { return Number(fechas[0].slice(0, 4)); }
    return Number(ahoraLima().slice(0, 4));
}

/**
 * Deja las excepciones de sede de un ano igual a lo que el usuario marco.
 *
 * Escribe SOLO las diferencias contra el default (`feriado_abre`): si trabajan
 * todos los feriados, el default ya lo dice y no hace falta una excepcion por
 * dia; si es una seleccion, cada dia trabajado lleva la suya. Menos filas y,
 * sobre todo, ningun dia queda con dos fuentes de verdad que puedan
 * contradecirse.
 *
 * Solo toca los dias que son feriado. Una excepcion cargada a mano en un dia
 * cualquiera ("este lunes abrimos") no se ve afectada.
 */
async function sincronizarFeriados(ctx: Ctx, trabajados: string[], todos: boolean, anio: number, autor: Autor) {
    const feriados: any[] = await prisma.asistencia_feriado.findMany({
        where: {
            estado: '0',
            OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
            fecha: { gte: fechaSql(`${anio}-01-01 00:00:00`), lte: fechaSql(`${anio}-12-31 00:00:00`) }
        } as any
    });

    const idsedeRestobar = await sedeRestobar(ctx.idsede);
    const quiere = new Set(trabajados);

    for (const f of feriados) {
        const fecha = aTextoLima(f.fecha)!.slice(0, 10);
        const previa: any = await prisma.asistencia_excepcion.findFirst({
            where: { idsede_restobar: idsedeRestobar, idcolaborador: 0, fecha: f.fecha } as any
        });

        // Con el default en "se trabajan todos", una excepcion LABORABLE seria
        // redundante; y un feriado desmarcado no puede existir ahi porque
        // entonces no estarian todos.
        const hace_falta = !todos && quiere.has(fecha);

        if (hace_falta && !previa) {
            await prisma.asistencia_excepcion.create({
                data: {
                    idorg: ctx.idorg, idsede_restobar: idsedeRestobar, idcolaborador: 0,
                    fecha: f.fecha, tipo: 'LABORABLE',
                    motivo: f.descripcion, compensacion: null, fecha_sustituto: null,
                    recargo_pct: 100, origen: 'MANUAL',
                    creado_por: autor.idusuario, creado_at: fechaSql(ahoraLima())
                } as any
            });
        } else if (!hace_falta && previa && previa.tipo === 'LABORABLE') {
            await prisma.asistencia_excepcion.delete({ where: { idexcepcion: previa.idexcepcion } });
        }
    }
}

export async function guardarConfiguracion(ctx: Ctx, body: any, autor: Autor) {
    // Los dias de cierre ya tienen su propia operacion con su propia bitacora:
    // se delega en vez de duplicar la validacion de los siete dias.
    if (Array.isArray(body.dias_cierre)) {
        await guardarDiasCierre(ctx, body.dias_cierre, autor);
    }

    const antes: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });
    const prev = politicaDe(antes);

    // Los feriados llegan como la lista de fechas que SI se trabajan. Si estan
    // todos, se guarda como default del ano (feriado_abre) y no hace falta
    // ninguna excepcion: asi los feriados del ano que viene tambien se trabajan
    // sin que nadie los vuelva a marcar. Si es una seleccion parcial, el
    // default queda cerrado y cada dia abierto lleva su excepcion.
    const trabajados: string[] = Array.isArray(body.feriados_labora)
        ? body.feriados_labora.map((f: any) => String(f)).filter((f: string) => ES_FECHA.test(f))
        : [];
    const hayListaFeriados = Array.isArray(body.feriados_labora);
    const totalFeriados = Number(body.feriados_total) || 0;
    const todosTrabajados = hayListaFeriados && totalFeriados > 0 && trabajados.length === totalFeriados;

    const feriadoAbre = hayListaFeriados ? todosTrabajados : !!body.feriado_abre;
    const descanso = String(body.descanso_trabajado || '').toUpperCase() === 'RECARGO' ? 'RECARGO' : 'PERMISO';

    // El recargo se topa entre 0 y 300: por debajo de 100 se estaria pagando
    // menos que el minimo legal para el descanso, y por encima de 300 es casi
    // seguro un error de tipeo.
    const pct = (v: any, min: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= min && n <= 300 ? Math.round(n) : min;
    };
    // El recargo vive aparte de "que dias se abren": se puede trabajar un solo
    // feriado al ano y ese dia igual se paga con recargo.
    const feriadoPct = pct(body.feriado_recargo_pct, 0);
    const descansoPct = pct(body.descanso_recargo_pct, 100);

    await prisma.sede.update({
        where: { idsede: ctx.idsede },
        data: {
            feriado_abre: feriadoAbre,
            feriado_recargo_pct: feriadoPct,
            descanso_trabajado: descanso as any,
            descanso_recargo_pct: descansoPct
        } as any
    });

    if (hayListaFeriados) {
        await sincronizarFeriados(ctx, trabajados, todosTrabajados, anioDe(body, trabajados), autor);
    }

    const frase = (p: any) =>
        (p.feriado_abre ? 'trabaja todos los feriados' : 'trabaja solo los feriados marcados') +
        (p.feriado_recargo_pct ? ` (+${p.feriado_recargo_pct}%)` : ' sin extra') +
        '; descanso trabajado: ' +
        (p.descanso_trabajado === 'RECARGO' ? `se paga +${p.descanso_recargo_pct}%` : 'con permiso del administrador');

    const ahora = { feriado_abre: feriadoAbre, feriado_recargo_pct: feriadoPct, descanso_trabajado: descanso, descanso_recargo_pct: descansoPct };

    // Guardar lo mismo no se anota: seria ruido que esconde los cambios reales
    if (frase(prev) !== frase(ahora)) {
        await anotar({
            idorg: ctx.idorg, idsede_restobar: antes?.idsede_restobar ?? 0,
            entidad: 'POLITICA', accion: 'MODIFICA',
            detalle: 'Politica: ' + frase(prev) + ' -> ' + frase(ahora),
            anterior: prev, nuevo: ahora
        }, autor);
    }

    return leerConfiguracion(ctx);
}

// ---------------------------------------------------------------------------
// Feriados
// ---------------------------------------------------------------------------

/** Feriados visibles para la sede: los nacionales mas los propios de la empresa. */
export async function listarFeriados(ctx: Ctx, anioPedido: any) {
    const anio = /^\d{4}$/.test(String(anioPedido || '')) ? Number(anioPedido) : Number(ahoraLima().slice(0, 4));

    const filas: any[] = await prisma.asistencia_feriado.findMany({
        where: {
            estado: '0',
            OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
            fecha: { gte: fechaSql(`${anio}-01-01 00:00:00`), lte: fechaSql(`${anio}-12-31 00:00:00`) }
        } as any,
        orderBy: { fecha: 'asc' }
    });

    return {
        anio,
        feriados: filas.map(f => ({
            idferiado: f.idferiado,
            fecha: aTextoLima(f.fecha)!.slice(0, 10),
            descripcion: f.descripcion,
            // Los nacionales no se editan desde una empresa: son de todas
            propio: f.idorg !== 0
        }))
    };
}

/** Feriado propio de la empresa (aniversario del local, feriado regional). */
export async function guardarFeriado(ctx: Ctx, body: any, autor: Autor) {
    const fecha = String(body.fecha || '');
    if (!ES_FECHA.test(fecha)) { throw new Invalido('Falta la fecha.'); }
    const descripcion = texto(body.descripcion, 120);
    if (!descripcion) { throw new Invalido('Ponle un nombre al feriado.'); }

    const nacional = await prisma.asistencia_feriado.findFirst({
        where: { idorg: 0, fecha: fechaSql(fecha + ' 00:00:00'), estado: '0' } as any
    });
    if (nacional) { throw new Invalido(`Ese dia ya es feriado nacional (${nacional.descripcion}).`); }

    const idsedeRestobar = await sedeRestobar(ctx.idsede);

    const previo = await prisma.asistencia_feriado.findFirst({
        where: { idorg: ctx.idorg, fecha: fechaSql(fecha + ' 00:00:00') } as any
    });
    if (previo) {
        await prisma.asistencia_feriado.update({
            where: { idferiado: previo.idferiado }, data: { descripcion, estado: '0' } as any
        });
        await anotar({
            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
            entidad: 'FERIADO', identidad: previo.idferiado, accion: 'MODIFICA',
            detalle: 'Feriado del ' + fecha + ': ' + previo.descripcion + ' -> ' + descripcion,
            anterior: { descripcion: previo.descripcion }, nuevo: { descripcion }
        }, autor);
        return { idferiado: previo.idferiado, accion: 'ACTUALIZADO' };
    }

    const f = await prisma.asistencia_feriado.create({
        data: { idorg: ctx.idorg, fecha: fechaSql(fecha + ' 00:00:00'), descripcion, estado: '0' } as any
    });
    await anotar({
        idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
        entidad: 'FERIADO', identidad: f.idferiado, accion: 'CREA',
        detalle: 'Nuevo feriado propio: ' + fecha + ' ' + descripcion,
        nuevo: { fecha, descripcion }
    }, autor);
    return { idferiado: f.idferiado, accion: 'CREADO' };
}

export async function eliminarFeriado(ctx: Ctx, idPedido: any, autor: Autor) {
    const id = Number(idPedido) || 0;
    if (!id) { throw new Invalido('id invalido'); }

    // idorg en el WHERE: los feriados nacionales (idorg 0) no se pueden borrar
    // desde una empresa, son de todas.
    const previo: any = await prisma.asistencia_feriado.findFirst({
        where: { idferiado: id, idorg: ctx.idorg } as any
    });
    if (!previo) { throw new Invalido('Los feriados nacionales no se pueden borrar.', 404); }

    await prisma.asistencia_feriado.deleteMany({ where: { idferiado: id, idorg: ctx.idorg } as any });
    await anotar({
        idorg: ctx.idorg, idsede_restobar: await sedeRestobar(ctx.idsede),
        entidad: 'FERIADO', identidad: id, accion: 'ELIMINA',
        detalle: 'Se quito el feriado ' + aTextoLima(previo.fecha)!.slice(0, 10) + ' ' + previo.descripcion,
        anterior: { fecha: aTextoLima(previo.fecha)!.slice(0, 10), descripcion: previo.descripcion }
    }, autor);
    return { eliminado: true };
}

// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------

/** Historial de cambios, para responder un reclamo con un hecho. */
export async function listarBitacora(ctx: Ctx, body: any) {
    const idcolaborador = Number(body?.idcolaborador) || 0;
    const limite = Math.min(200, Math.max(1, Number(body?.limite) || 50));

    const filas: any[] = await prisma.asistencia_bitacora.findMany({
        where: {
            idorg: ctx.idorg,
            ...(idcolaborador ? { idcolaborador } : {})
        } as any,
        // creado_at solo tiene precision de segundo: dos cambios seguidos
        // saldrian en cualquier orden. El id si es estrictamente creciente.
        orderBy: { idbitacora: 'desc' },
        take: limite
    });

    return {
        cambios: filas.map(f => ({
            idbitacora: f.idbitacora,
            fecha: aTextoLima(f.creado_at),
            entidad: f.entidad,
            accion: f.accion,
            detalle: f.detalle,
            origen: f.origen,
            usuario: f.usuario_nombre,
            autorizado_por: f.autorizado_nombre || null
        }))
    };
}
