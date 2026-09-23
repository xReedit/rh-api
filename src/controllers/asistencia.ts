// Modulo de Asistencia: padron y horarios.
//
// Lo llama SOLO el POS legacy (bdphp/log_asistencia.php), nunca un navegador.
// La empresa y la sede salen del token firmado (req.pos), jamas del body: es lo
// que impide que alguien con acceso al POS lea o escriba el padron de otra sede.
//
// Esta API no puede leer la BD `restobar` (vive en el servidor de cada sede,
// 30 de 45 sedes corren servidor local). Por eso los datos de restobar -- la
// ficha de la empresa y la lista de usuarios a importar -- los MANDA el POS y
// aqui solo se cotejan contra `rrhh`.

import * as express from "express";
import * as crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PosRequest } from "../middleware/pos.auth";
import {
    validarHorario, ahoraLima, fechaSql, diaOperativo,
    horaEsperada, tardanzaMin, horasTurno, aTextoLima, minutosDesde, diaSemana
} from "../services/asistencia.calendario";
import { codigoValido, calcularCodigo, ventanaActual, segundosRestantes, VENTANA_SEG } from "../services/asistencia.codigo";
import { verificarUbicacion } from "../services/asistencia.gps";
import { resolverDia } from "../services/asistencia.dialaboral";
import { anotar, Autor, horarioATexto } from "../services/asistencia.bitacora";
import * as cfg from "../services/asistencia.config";
import * as ausencias from "../services/asistencia.ausencias";
import { contextoLaboral, Invalido } from "../services/asistencia.config";

export { contextoLaboral };

const prisma = new PrismaClient();
const router = express.Router();

// Cuanto vive cada cosa
const INVITACION_MIN = 15;        // la invitacion se escanea en el momento, delante del admin
const DISPOSITIVO_DIAS = 180;     // el celular queda enrolado medio ano

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const ok = (res: any, datos: any = null) => res.status(200).json({ success: true, datos, error: '' });
const mal = (res: any, error: string, code = 400) => res.status(code).json({ success: false, datos: null, error });

const texto = (v: any, max = 200) => (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);

/** Para cotejar nombres: sin tildes, sin dobles espacios, en mayusculas. */
const normalizar = (v: any) =>
    texto(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const hoy = () => new Date().toISOString().slice(0, 10);

/** Envuelve un handler async para que un throw no tumbe el proceso. */
const asinc = (fn: any) => (req: any, res: any) =>
    fn(req, res).catch((e: any) => {
        // Invalido es "pediste mal", no "se rompio": no ensucia el log ni sale 500
        if (e instanceof Invalido) { return mal(res, e.message, e.code); }
        console.error('[asistencia]', req.path, e);
        mal(res, e.message || 'error interno', 500);
    });

// ---------------------------------------------------------------------------
// Tenant: la empresa/sede de `rrhh` que corresponde a la del POS
// ---------------------------------------------------------------------------
//
// Replica lo que ya hace login.restobar.ts, para que la app SvelteKit de RRHH y
// el modulo de asistencia vean el mismo tenant y no se pisen. El lookup es por
// idorg_restobar, asi que los org huerfanos de pruebas no estorban.

interface Tenant { idorg: number; idsede: number; hora_corte: string }

async function resolverTenant(pos: PosRequest['pos'], ficha: any): Promise<Tenant> {
    ficha = ficha || {};

    let org = await prisma.org.findFirst({ where: { idorg_restobar: pos.ido, estado: '0' } });

    if (!org) {
        const f = ficha.org || {};
        if (!texto(f.nombre)) { throw new Error('la empresa no existe en rrhh y el POS no mando su ficha'); }
        org = await prisma.org.create({
            data: {
                nombre: texto(f.nombre, 150),
                direccion: texto(f.direccion, 150),
                ruc: texto(f.ruc, 20),
                telefono: texto(f.telefono, 50),
                idorg_restobar: pos.ido,
                estado: '0'
            }
        });
    }

    let sede = await prisma.sede.findFirst({ where: { idorg: org.idorg, idsede_restobar: pos.idsede } });

    if (!sede) {
        const f = ficha.sede || {};
        if (!texto(f.nombre)) { throw new Error('la sede no existe en rrhh y el POS no mando su ficha'); }
        // rrhh.sede tiene casi todo NOT NULL sin default: nunca mandar null
        sede = await prisma.sede.create({
            data: {
                idorg: org.idorg,
                idsede_restobar: pos.idsede,
                ruc: texto(f.ruc, 15),
                razon_social: texto(f.razon_social, 100),
                nombre: texto(f.nombre, 150),
                ciudad: texto(f.ciudad, 100),
                direccion: texto(f.direccion, 100),
                telefono: texto(f.telefono, 50),
                estado: '0',
                principal: '0'
            }
        });
    }

    // asis_hora_corte llega como Date (Prisma mapea TIME); se normaliza a 'HH:MM:SS'
    const corte: any = (org as any).asis_hora_corte;
    const hora_corte = corte instanceof Date ? corte.toISOString().slice(11, 19) : String(corte || '05:00:00');

    return { idorg: org.idorg, idsede: sede.idsede, hora_corte };
}

/**
 * Quien esta haciendo el cambio, para la bitacora.
 *
 * El nombre lo manda el POS porque esta API no puede leer `restobar.usuario`.
 * `autorizado` viene solo cuando el que opera NO es administrador y tuvo que
 * pedir la clave de uno: guardar las dos personas es el punto de la auditoria.
 */
function autorPos(req: PosRequest): Autor {
    const u = (req.body && req.body.usuario) || {};
    const a = (req.body && req.body.autorizado) || {};
    return {
        origen: 'POS',
        idusuario: req.pos.idusuario || null,
        nombre: String(u.nombre || ''),
        autorizado_por: Number(a.idusuario) || null,
        autorizado_nombre: String(a.nombre || '')
    };
}

router.get('/', (_req, res) => res.status(200).json({ message: 'Estas conectado a asistencia' }));

router.post('/tenant', asinc(async (req: PosRequest, res: any) => {
    ok(res, await resolverTenant(req.pos, req.body));
}));

// ---------------------------------------------------------------------------
// Padron
// ---------------------------------------------------------------------------

/** Colaboradores activos de la sede, con su horario y si ya tienen celular enrolado. */
router.post('/personal/listar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const filas = await prisma.colaborador.findMany({
        where: { idorg: t.idorg, idsede: t.idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    // Una sola consulta para todos, no una por fila (N+1)
    const ids = filas.map((c: any) => c.idcolaborador);
    const dispositivos = ids.length
        ? await prisma.colaborador_dispositivo.findMany({
            where: { idcolaborador: { in: ids }, activo: true },
            select: { idcolaborador: true, creado_at: true, expira_at: true }
        })
        : [];
    const porColab = new Map<number, any>();
    for (const d of dispositivos as any[]) { porColab.set(d.idcolaborador, d); }

    // Nombre del area en la misma respuesta: si no, la tabla mostraria numeros
    // o habria que pedir el catalogo aparte en cada carga.
    const areas = await prisma.area.findMany({
        where: areasDeLaSede(t.idsede) as any,
        select: { idarea: true, descripcion: true }
    });
    const nombreArea = new Map<number, string>();
    for (const a of areas as any[]) { nombreArea.set(a.idarea, a.descripcion); }

    ok(res, {
        tenant: t,
        personal: filas.map((c: any) => {
            const d = porColab.get(c.idcolaborador);
            return {
                idcolaborador: c.idcolaborador,
                nombres: c.nombres,
                apellidos: c.apellidos || '',
                dni: c.dni,
                idarea: c.idarea,
                area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
                idusuario_restobar: c.idusuario_restobar,
                horario_semanal: c.horario_semanal,
                tolerancia_min: c.tolerancia_min,
                tiene_dispositivo: !!d,
                dispositivo_desde: d ? d.creado_at : null,
                dispositivo_expira: d ? d.expira_at : null
            };
        })
    });
}));

/**
 * Previsualizar el import: el POS manda los usuarios de SU sede y aqui se marca
 * cuales ya existen. Nunca inserta. El admin destilda y recien confirma.
 *
 * El match va en cascada: idusuario_restobar -> dni -> nombre normalizado.
 * Asi re-importar no duplica ni siquiera a quien se creo a mano antes.
 */
router.post('/personal/importar/preview', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const entrantes: any[] = Array.isArray(req.body.usuarios) ? req.body.usuarios : [];
    if (!entrantes.length) { return mal(res, 'el POS no mando usuarios'); }

    const existentes = await prisma.colaborador.findMany({ where: { idorg: t.idorg } });

    const porUsuario = new Map<number, any>();
    const porDni = new Map<string, any>();
    const porNombre = new Map<string, any>();
    for (const c of existentes as any[]) {
        if (c.idusuario_restobar) { porUsuario.set(Number(c.idusuario_restobar), c); }
        if (texto(c.dni)) { porDni.set(texto(c.dni), c); }
        porNombre.set(normalizar(`${c.nombres} ${c.apellidos || ''}`), c);
    }

    const filas = entrantes.map((u) => {
        const idus = Number(u.idusuario) || 0;
        const dni = texto(u.dni, 20);
        const nombre = texto(u.nombres, 200);

        const halla = porUsuario.get(idus)
            || (dni ? porDni.get(dni) : null)
            || porNombre.get(normalizar(nombre));

        return {
            idusuario: idus,
            nombres: nombre,
            dni,
            existe: !!halla,
            idcolaborador: halla ? halla.idcolaborador : null,
            // ya esta en rrhh pero sin el puente al POS: conviene enlazarlo
            enlazar: !!(halla && !halla.idusuario_restobar)
        };
    });

    ok(res, { tenant: t, filas, nuevos: filas.filter(f => !f.existe).length });
}));

/**
 * Confirmar el import. Inserta los que no existen y enlaza (solo el puente) a
 * los que ya estaban sin idusuario_restobar. Nunca pisa datos de planilla.
 */
router.post('/personal/importar/confirmar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const entrantes: any[] = Array.isArray(req.body.usuarios) ? req.body.usuarios : [];
    if (!entrantes.length) { return mal(res, 'no se selecciono a nadie'); }

    let creados = 0, enlazados = 0;

    for (const u of entrantes) {
        const idus = Number(u.idusuario) || 0;
        const nombres = texto(u.nombres, 200);
        const dni = texto(u.dni, 20);
        if (!nombres) { continue; }

        const yaEsta = idus
            ? await prisma.colaborador.findFirst({ where: { idorg: t.idorg, idusuario_restobar: idus } })
            : null;
        if (yaEsta) { continue; }

        // ¿existe sin puente? entonces solo se enlaza
        const suelto = await prisma.colaborador.findFirst({
            where: { idorg: t.idorg, idusuario_restobar: null, ...(dni ? { dni } : { nombres }) }
        });

        if (suelto) {
            await prisma.colaborador.update({
                where: { idcolaborador: suelto.idcolaborador },
                data: { idusuario_restobar: idus } as any
            });
            enlazados++;
            continue;
        }

        // Los campos que el POS no tiene van en blanco (son NOT NULL sin default)
        // y se completan despues en la ficha o desde la app de RRHH.
        await prisma.colaborador.create({
            data: {
                idorg: t.idorg,
                idsede: t.idsede,
                nombres,
                dni,
                sexo: '',
                correo: '',
                direccion: '',
                telefono: '',
                f_nac: '',
                f_ingreso: hoy(),
                estado: 0,
                idusuario_restobar: idus || null,
                tolerancia_min: 10
            } as any
        });
        creados++;
    }

    ok(res, { creados, enlazados });
}));

/** Alta manual: para quien trabaja en la sede pero no tiene usuario en el POS. */
router.post('/personal/crear', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const nombres = texto(req.body.nombres, 200);
    if (!nombres) { return mal(res, 'el nombre es obligatorio'); }

    const dni = texto(req.body.dni, 20);
    if (dni) {
        const repetido = await prisma.colaborador.findFirst({ where: { idorg: t.idorg, dni } });
        if (repetido) { return mal(res, `ya existe un colaborador con el DNI ${dni}`); }
    }

    const c = await prisma.colaborador.create({
        data: {
            idorg: t.idorg,
            idsede: t.idsede,
            nombres,
            dni,
            apellidos: texto(req.body.apellidos, 120),
            sexo: '', correo: '', direccion: '', telefono: '', f_nac: '',
            f_ingreso: hoy(),
            estado: 0,
            tolerancia_min: 10
        } as any
    });

    ok(res, { idcolaborador: c.idcolaborador });
}));

/**
 * Horario semanal y tolerancia.
 * El WHERE lleva idorg: un id de otra empresa no actualiza nada en vez de
 * actualizar lo ajeno.
 */
router.put('/personal/:id/horario', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    ok(res, await cfg.guardarHorario(t, { ...req.body, idcolaborador: req.params.id }, autorPos(req)));
}));

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------
//
// Se reusa el catalogo `rrhh.area` que ya usa la app de planilla: idsede = 0
// son las areas comunes (COCINA, ALMACEN, SALON, ADMINISTRATIVO) y el resto
// pertenecen a una sede. Crear otro catalogo habria dejado dos listas de areas
// que se desfasan.

const areasDeLaSede = (idsede: number) => ({ estado: '0', OR: [{ idsede: 0 }, { idsede }] });

router.post('/area/listar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const areas = await prisma.area.findMany({
        where: areasDeLaSede(t.idsede) as any,
        orderBy: { descripcion: 'asc' },
        select: { idarea: true, descripcion: true, idsede: true }
    });

    // Cuantos colaboradores hay en cada area, para que el admin sepa a cuantos
    // va a alcanzar un horario masivo antes de aplicarlo.
    const conteo = await prisma.colaborador.groupBy({
        by: ['idarea'],
        where: { idorg: t.idorg, idsede: t.idsede, estado: 0 },
        _count: { _all: true }
    } as any);
    const porArea = new Map<number | null, number>();
    for (const c of conteo as any[]) { porArea.set(c.idarea, c._count._all); }

    ok(res, {
        areas: areas.map((a: any) => ({ ...a, personal: porArea.get(a.idarea) || 0 })),
        sin_area: porArea.get(null) || 0
    });
}));

router.post('/area/crear', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const descripcion = texto(req.body.descripcion, 50).toUpperCase();
    if (!descripcion) { return mal(res, 'Ponle un nombre al area.'); }

    const repetida = await prisma.area.findFirst({ where: { ...areasDeLaSede(t.idsede), descripcion } as any });
    if (repetida) { return mal(res, `Ya existe un area "${descripcion}".`); }

    // Nace atada a la sede, no global: una sede no deberia ensuciar el catalogo
    // comun de todas las demas.
    const a = await prisma.area.create({ data: { descripcion, idsede: t.idsede, estado: '0' } as any });
    ok(res, { idarea: a.idarea, descripcion });
}));

/** Asigna area a uno o varios colaboradores de una vez. */
router.post('/personal/area', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
    if (!ids.length) { return mal(res, 'No se selecciono a nadie.'); }

    let idarea: number | null = Number(req.body.idarea) || null;
    if (idarea) {
        const a = await prisma.area.findFirst({ where: { idarea, ...areasDeLaSede(t.idsede) } as any });
        if (!a) { return mal(res, 'Esa area no es de esta sede.', 404); }
    }

    // idorg e idsede en el WHERE: nunca se toca gente de otra empresa o sede
    const r = await prisma.colaborador.updateMany({
        where: { idcolaborador: { in: ids }, idorg: t.idorg, idsede: t.idsede },
        data: { idarea } as any
    });

    ok(res, { actualizados: r.count });
}));

// ---------------------------------------------------------------------------
// Horario masivo
// ---------------------------------------------------------------------------

/**
 * Aplica el MISMO horario a un grupo. Es lo que evita configurar 40 personas de
 * a una cuando toda la cocina entra a la misma hora.
 *
 * alcance:
 *   'todos'     -> todo el personal activo de la sede
 *   'area'      -> los de un area (idarea null = los que no tienen area)
 *   'seleccion' -> los ids tildados en la tabla
 *
 * Devuelve a cuantos alcanzo. `solo_contar` permite preguntar "a cuantos les
 * va a caer esto" antes de aplicarlo, sin escribir nada.
 */
router.post('/personal/horario-masivo', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    ok(res, await cfg.horarioMasivo(t, req.body, autorPos(req)));
}));

// ---------------------------------------------------------------------------
// Vista del dia
// ---------------------------------------------------------------------------

/** Hora de corte de la empresa, normalizada a 'HH:MM:SS'. */
async function horaCorte(idorg: number): Promise<string> {
    const org: any = await prisma.org.findUnique({ where: { idorg } });
    const c = org?.asis_hora_corte;
    return c instanceof Date ? c.toISOString().slice(11, 19) : String(c || '05:00:00');
}

const soloHora = (d: any) => (d ? new Date(d).toISOString().slice(11, 16) : null);

/**
 * Quien llego, quien llego tarde y quien falta, para un dia operativo.
 *
 * El estado se resuelve aca y no en el navegador porque depende de si el dia YA
 * CERRO, y eso solo se sabe comparando con la hora de Lima: a las 02:00 el
 * turno de la noche sigue corriendo y nadie puede contar como falta todavia.
 */
export async function datosDia(idorg: number, idsede: number, fechaPedida?: string) {
    const corte = await horaCorte(idorg);

    const hoyOperativo = diaOperativo(corte, ahoraLima());
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(fechaPedida || '')) ? String(fechaPedida) : hoyOperativo;
    const enCurso = fecha >= hoyOperativo;   // el dia todavia no cerro

    const personal = await prisma.colaborador.findMany({
        where: { idorg: idorg, idsede: idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    const marcas = await prisma.asistencia_marca.findMany({
        where: { idorg: idorg, fecha_local: fechaSql(fecha + ' 00:00:00') },
        orderBy: { marcada_at: 'asc' }
    });

    const areas = await prisma.area.findMany({ where: areasDeLaSede(idsede) as any, select: { idarea: true, descripcion: true } });
    const nombreArea = new Map<number, string>();
    for (const a of areas as any[]) { nombreArea.set(a.idarea, a.descripcion); }

    const ctx = await contextoLaboral(idorg, idsede, fecha, fecha);

    const porColab = new Map<number, any[]>();
    for (const m of marcas as any[]) {
        if (!porColab.has(m.idcolaborador)) { porColab.set(m.idcolaborador, []); }
        porColab.get(m.idcolaborador)!.push(m);
    }

    const filas = personal.map((c: any) => {
        const suyas = porColab.get(c.idcolaborador) || [];
        const entrada = suyas.find(m => m.tipo === 'ENTRADA') || null;
        const salida = suyas.find(m => m.tipo === 'SALIDA') || null;

        // Ya no alcanza con mirar el horario semanal: el local puede cerrar ese
        // dia, puede ser feriado, o la persona puede tener el descanso corrido.
        const dl = resolverDia({
            fecha,
            horario_semanal: c.horario_semanal as any,
            tolerancia_min: c.tolerancia_min ?? 10,
            excepciones: ctx.porPersona(c.idcolaborador),
            feriados: ctx.feriados,
            dias_cierre: ctx.dias_cierre,
            politica: ctx.politica
        });
        const esperada = dl.hora_esperada;

        // El orden importa: primero lo que paso, despues lo que falto.
        let estado: string;
        if (entrada && salida) { estado = 'COMPLETO'; }
        else if (entrada) { estado = enCurso ? 'PRESENTE' : 'INCOMPLETO'; }
        else if (!dl.labora) {
            // Distinguir POR QUE no trabaja: "dia libre" y "el local cerro" se
            // explican distinto ante un reclamo, y ninguno es una falta.
            estado = dl.origen === 'FERIADO' ? 'FERIADO'
                : dl.origen === 'CIERRE_SEDE' || dl.origen === 'EXCEPCION_SEDE' ? 'CERRADO'
                : dl.origen === 'DESCANSO_SUSTITUTO' ? 'DESCANSO_MOVIDO'
                : c.horario_semanal ? 'LIBRE' : 'SIN_HORARIO';
        }
        else if (enCurso) { estado = 'PENDIENTE'; }
        else { estado = 'FALTA'; }

        return {
            idcolaborador: c.idcolaborador,
            nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
            area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
            hora_esperada: esperada,
            tolerancia_min: c.tolerancia_min,
            // Contexto del dia: lo que explica el estado
            motivo_dia: dl.motivo,
            feriado: dl.feriado,
            es_descanso_trabajado: dl.es_descanso_trabajado,
            compensacion: dl.compensacion,
            recargo_pct: dl.recargo_pct,
            fecha_sustituto: dl.fecha_sustituto,
            entrada: entrada ? {
                id: entrada.idasistencia_marca,
                hora: soloHora(entrada.marcada_at),
                tardanza_min: entrada.tardanza_min,
                metodo: entrada.metodo,
                motivo: entrada.manual_motivo
            } : null,
            salida: salida ? {
                id: salida.idasistencia_marca,
                hora: soloHora(salida.marcada_at),
                metodo: salida.metodo,
                motivo: salida.manual_motivo
            } : null,
            horas: (entrada && salida)
                ? horasTurno(aTextoLima(entrada.marcada_at)!, aTextoLima(salida.marcada_at)!)
                : null,
            estado
        };
    });

    const cuenta = (e: string) => filas.filter(f => f.estado === e).length;

    const descansos = filas.filter(f => f.es_descanso_trabajado);

    return {
        fecha,
        hoy: hoyOperativo,
        en_curso: enCurso,
        hora_corte: corte,
        // Contexto del dia para la cabecera: "hoy el local no abre", "hoy es feriado"
        feriado: ctx.feriados.get(fecha) || null,
        cierre_sede: ctx.dias_cierre.includes(diaSemana(fecha)),
        excepcion_sede: ctx.deSede.find(e => e.fecha === fecha) || null,
        filas,
        resumen: {
            personal: filas.length,
            presentes: cuenta('PRESENTE') + cuenta('COMPLETO') + cuenta('INCOMPLETO'),
            tardanzas: filas.filter(f => f.entrada && (f.entrada.tardanza_min || 0) > 0).length,
            faltas: cuenta('FALTA'),
            incompletos: cuenta('INCOMPLETO'),
            pendientes: cuenta('PENDIENTE'),
            libres: cuenta('LIBRE') + cuenta('CERRADO') + cuenta('FERIADO') + cuenta('DESCANSO_MOVIDO'),
            // Trabajaron un dia que les tocaba descansar: es lo que despues
            // entra a la boleta como recargo
            descanso_trabajado: descansos.length,
            con_recargo: descansos.filter(f => f.compensacion === 'RECARGO').length,
            // Sin compensacion elegida es un error de carga, no un caso valido
            sin_compensar: descansos.filter(f => !f.compensacion).length
        }
    };
}

router.post('/dia', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    ok(res, await datosDia(t.idorg, t.idsede, req.body.fecha));
}));


// ---------------------------------------------------------------------------
// Calendario: cierres, feriados y excepciones
// ---------------------------------------------------------------------------


// Las operaciones viven en services/asistencia.config.ts porque rrhh-1 las
// ejecuta igual por su propia puerta. Aqui solo se resuelve el tenant y quien
// firma el cambio.

const calOp = (ruta: string, fn: (t: any, req: PosRequest) => Promise<any>) =>
    router.post(ruta, asinc(async (req: PosRequest, res: any) => {
        ok(res, await fn(await resolverTenant(req.pos, req.body), req));
    }));

calOp('/calendario/mes', (t, req) => cfg.calendarioMes(t, req.body.mes));
calOp('/calendario/dia', (t, req) => cfg.calendarioDia(t, req.body.fecha));
calOp('/calendario/excepcion', (t, req) => cfg.guardarExcepcion(t, req.body, autorPos(req)));
calOp('/calendario/excepcion/:id/eliminar', (t, req) => cfg.eliminarExcepcion(t, req.params.id, autorPos(req)));
calOp('/calendario/dias-cierre', (t, req) => cfg.guardarDiasCierre(t, req.body.dias, autorPos(req)));
calOp('/calendario/feriados', (t, req) => cfg.listarFeriados(t, req.body.anio));
calOp('/calendario/feriado/guardar', (t, req) => cfg.guardarFeriado(t, req.body, autorPos(req)));
calOp('/calendario/feriado/:id/eliminar', (t, req) => cfg.eliminarFeriado(t, req.params.id, autorPos(req)));
calOp('/ausencias/alertas', (t) => ausencias.alertas(t));
calOp('/ausencias/registrar', (t, req) => ausencias.registrarAusencia(t, req.body, autorPos(req)));
calOp('/ausencias/baja', (t, req) => ausencias.darDeBaja(t, req.body, autorPos(req)));
calOp('/configuracion', (t, req) => cfg.leerConfiguracion(t, req.body.anio));
calOp('/configuracion/listo', (t) => cfg.marcarConfigurado(t));
calOp('/configuracion/guardar', (t, req) => cfg.guardarConfiguracion(t, req.body, autorPos(req)));
calOp('/bitacora', (t, req) => cfg.listarBitacora(t, req.body));

// ---------------------------------------------------------------------------
// Marca manual
// ---------------------------------------------------------------------------
//
// Es la salida para quien no tiene smartphone, para el que se olvido de marcar
// y para corregir un error. Siempre queda registrada como MANUAL, con motivo y
// con el usuario del POS que la hizo: la diferencia entre una marca real y una
// puesta a mano tiene que ser visible en el reporte y en la planilla.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

router.post('/marca/manual', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const idcolaborador = Number(req.body.idcolaborador) || 0;
    const tipo = String(req.body.tipo || '').toUpperCase();
    const hora = String(req.body.hora || '');
    const motivo = texto(req.body.motivo, 200);
    const fecha = String(req.body.fecha || '');

    if (!idcolaborador) { return mal(res, 'Falta el colaborador.'); }
    if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') { return mal(res, 'El tipo debe ser ENTRADA o SALIDA.'); }
    if (!HHMM.test(hora)) { return mal(res, 'La hora debe tener el formato HH:MM.'); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { return mal(res, 'Falta el dia.'); }
    // El motivo es obligatorio a proposito: una marca puesta a mano sin
    // explicacion es indistinguible de un favor.
    if (!motivo) { return mal(res, 'Escribe el motivo de la marca manual.'); }

    const c: any = await prisma.colaborador.findFirst({ where: { idcolaborador, idorg: t.idorg, idsede: t.idsede } });
    if (!c) { return mal(res, 'Ese colaborador no es de esta sede.', 404); }

    const corte = await horaCorte(t.idorg);

    // La hora que escribe el admin es del DIA OPERATIVO elegido, no de la fecha
    // calendario: en un turno que cruza medianoche, "01:30" pertenece al dia
    // anterior. Se prueba con la fecha siguiente y se toma la que cae en el dia.
    let momento = `${fecha} ${hora}:00`;
    if (diaOperativo(corte, momento) !== fecha) {
        const siguiente = new Date(Date.parse(fecha + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
        const alterno = `${siguiente} ${hora}:00`;
        if (diaOperativo(corte, alterno) === fecha) { momento = alterno; }
        else { return mal(res, `Las ${hora} no pertenecen al dia ${fecha} (el dia operativo empieza a las ${corte.slice(0, 5)}).`); }
    }

    const esperada = tipo === 'ENTRADA' ? horaEsperada(c.horario_semanal as any, fecha) : null;
    const tardanza = tipo === 'ENTRADA' ? tardanzaMin(esperada, momento, c.tolerancia_min ?? 10) : null;

    const datos: any = {
        idcolaborador,
        idorg: t.idorg,
        idsede_restobar: req.pos.idsede,
        tipo,
        fecha_local: fechaSql(fecha + ' 00:00:00'),
        marcada_at: fechaSql(momento),
        metodo: 'MANUAL',
        hora_esperada: esperada ? fechaSql('1970-01-01 ' + esperada.slice(0, 5) + ':00') : null,
        tardanza_min: tardanza,
        manual_idusuario_restobar: req.pos.idusuario,
        manual_motivo: motivo
    };

    // ux_marca_dia impide dos marcas del mismo tipo en el dia: si ya hay una,
    // esto es una CORRECCION y se actualiza en lugar de fallar.
    const previa = await prisma.asistencia_marca.findFirst({
        where: { idcolaborador, fecha_local: fechaSql(fecha + ' 00:00:00'), tipo: tipo as any }
    });

    if (previa) {
        await prisma.asistencia_marca.update({ where: { idasistencia_marca: previa.idasistencia_marca }, data: datos });
        return ok(res, { accion: 'CORREGIDA', idasistencia_marca: previa.idasistencia_marca, hora });
    }

    const creada = await prisma.asistencia_marca.create({ data: datos });
    ok(res, { accion: 'CREADA', idasistencia_marca: creada.idasistencia_marca, hora });
}));

/** Borra una marca. Solo de esta empresa, y pidiendo motivo igual que al crear. */
router.post('/marca/:id/eliminar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id) || 0;
    if (!id) { return mal(res, 'id invalido'); }
    if (!texto(req.body.motivo, 200)) { return mal(res, 'Escribe el motivo para borrar la marca.'); }

    const r = await prisma.asistencia_marca.deleteMany({ where: { idasistencia_marca: id, idorg: t.idorg } });
    if (!r.count) { return mal(res, 'Esa marca no es de esta empresa.', 404); }

    ok(res, { eliminada: true });
}));

// ---------------------------------------------------------------------------
// Enrolamiento del celular
// ---------------------------------------------------------------------------
//
// Dos pruebas distintas, las dos necesarias para que una marca valga:
//   - el QR del kiosko (fase 4) prueba PRESENCIA: caduca en segundos, sacarle
//     foto y mandarla por WhatsApp no sirve
//   - la cookie de este celular prueba IDENTIDAD: quien marca es quien es
//
// El enrolamiento es el momento en que se ata un celular a una persona, y pasa
// una sola vez, delante del administrador, escaneando una invitacion que dura
// 15 minutos y se quema al usarse.

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

/** Genera la invitacion. El POS la convierte en un QR que el trabajador escanea. */
router.post('/personal/:id/invitacion', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id);
    if (!id) { return mal(res, 'id invalido'); }

    const uuid = crypto.randomUUID();
    const exp = new Date(Date.now() + INVITACION_MIN * 60000);

    // El WHERE lleva idorg: invitar a alguien de otra empresa no hace nada.
    const r = await prisma.colaborador.updateMany({
        where: { idcolaborador: id, idorg: t.idorg },
        data: { qr_invitacion: uuid, qr_invitacion_exp: exp } as any
    });
    if (!r.count) { return mal(res, 'ese colaborador no es de esta empresa', 404); }

    ok(res, { invitacion: uuid, expira_at: exp, minutos: INVITACION_MIN });
}));

/** Revoca el celular enrolado. El siguiente enrolamiento vuelve a empezar. */
router.post('/personal/:id/dispositivo/revocar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id);
    if (!id) { return mal(res, 'id invalido'); }

    const c = await prisma.colaborador.findFirst({ where: { idcolaborador: id, idorg: t.idorg } });
    if (!c) { return mal(res, 'ese colaborador no es de esta empresa', 404); }

    // activo pasa a NULL, no a 0: el indice unico ignora los NULL, asi se puede
    // guardar historial ilimitado de revocados y a la vez tener un solo activo.
    const r = await prisma.colaborador_dispositivo.updateMany({
        where: { idcolaborador: id, activo: true },
        data: { activo: null, revocado_at: new Date() } as any
    });

    ok(res, { revocados: r.count });
}));

/** Busca una invitacion vigente. Devuelve null si no existe, ya se uso o vencio. */
async function invitacionVigente(uuid: string) {
    if (!uuid || typeof uuid !== 'string' || uuid.length > 36) { return null; }

    const c: any = await prisma.colaborador.findFirst({ where: { qr_invitacion: uuid } as any });
    if (!c) { return null; }
    if (!c.qr_invitacion_exp || new Date(c.qr_invitacion_exp).getTime() < Date.now()) { return null; }
    return c;
}

// Router aparte: estas dos las abre el CELULAR, que no tiene sesion del POS.
// Se montan con posPublicAuth y antes que el router principal (ver routes/index.ts).
export const publico = express.Router();

/**
 * Lo que ve el celular ANTES de confirmar: a quien va a quedar atado.
 * Si dice otro nombre, el trabajador se da cuenta antes de enrolar.
 */
publico.post('/enrolar/info', asinc(async (_req: any, res: any) => {
    const c = await invitacionVigente(_req.body.invitacion);
    if (!c) { return mal(res, 'Este codigo ya no es valido. Pide al administrador que genere uno nuevo.', 410); }

    const yaTiene = await prisma.colaborador_dispositivo.findFirst({
        where: { idcolaborador: c.idcolaborador, activo: true }
    });

    ok(res, {
        nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
        reemplaza: !!yaTiene   // ya tenia otro celular: enrolar este desactiva el anterior
    });
}));

/** Confirma: quema la invitacion y entrega el token que el POS guarda como cookie. */
publico.post('/enrolar/confirmar', asinc(async (req: any, res: any) => {
    const c = await invitacionVigente(req.body.invitacion);
    if (!c) { return mal(res, 'Este codigo ya no es valido. Pide al administrador que genere uno nuevo.', 410); }

    const token = crypto.randomBytes(32).toString('hex');
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + DISPOSITIVO_DIAS * 86400000);

    await prisma.$transaction([
        // un solo celular activo por persona: el anterior se revoca
        prisma.colaborador_dispositivo.updateMany({
            where: { idcolaborador: c.idcolaborador, activo: true },
            data: { activo: null, revocado_at: ahora } as any
        }),
        prisma.colaborador_dispositivo.create({
            data: {
                idcolaborador: c.idcolaborador,
                token_hash: sha256(token),   // nunca se guarda el token en claro
                activo: true,
                creado_at: ahora,
                expira_at: expira,
                user_agent: String(req.body.user_agent || '').slice(0, 255)
            } as any
        }),
        // la invitacion se quema: de un solo uso
        prisma.colaborador.updateMany({
            where: { idcolaborador: c.idcolaborador },
            data: { qr_invitacion: null, qr_invitacion_exp: null } as any
        })
    ]);

    ok(res, {
        token,
        nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
        expira_at: expira,
        dias: DISPOSITIVO_DIAS
    });
}));

// ---------------------------------------------------------------------------
// Kioskos (la pantalla de la puerta)
// ---------------------------------------------------------------------------

/** Da de alta un kiosko. El token se muestra UNA vez: solo se guarda su hash. */
router.post('/kiosko/crear', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const nombre = texto(req.body.nombre, 80) || 'Puerta principal';

    const token = crypto.randomBytes(32).toString('hex');
    const k = await prisma.asistencia_kiosko.create({
        data: {
            idorg: t.idorg,
            idsede_restobar: req.pos.idsede,
            nombre,
            token_hash: sha256(token),
            creado_at: fechaSql(ahoraLima())
        } as any
    });

    ok(res, { idkiosko: k.idkiosko, nombre, token });
}));

// Un marcador vivo pide codigo cada 30 s. Pasados 3 minutos sin senal esta
// apagado, sin internet o con el navegador cerrado, y nadie puede marcar ahi.
const MIN_SIN_SENAL = 3;

router.post('/kiosko/listar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const filas = await prisma.asistencia_kiosko.findMany({
        where: { idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
        orderBy: { idkiosko: 'asc' },
        select: { idkiosko: true, nombre: true, creado_at: true, ultimo_visto_at: true, permite_manual: true }
    });

    // El estado se decide AQUI, no en el navegador: este proceso sabe que hora
    // es en Lima; el navegador de la tablet puede tener el huso mal puesto.
    ok(res, {
        marcadores: filas.map((k: any) => {
            const visto = aTextoLima(k.ultimo_visto_at);
            const min = minutosDesde(visto);
            return {
                idkiosko: k.idkiosko,
                nombre: k.nombre,
                creado_at: aTextoLima(k.creado_at),
                ultimo_visto_at: visto,
                minutos_sin_senal: min,
                encendido: min !== null && min < MIN_SIN_SENAL,
                permite_manual: !!k.permite_manual
            };
        })
    });
}));

/** Enciende o apaga el boton de marca manual en ese marcador. */
router.post('/kiosko/:id/manual', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id);
    if (!id) { return mal(res, 'id invalido'); }

    const permite = !!req.body.permite_manual;
    const r = await prisma.asistencia_kiosko.updateMany({
        where: { idkiosko: id, idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
        data: { permite_manual: permite } as any
    });
    if (!r.count) { return mal(res, 'ese marcador no es de esta sede', 404); }

    ok(res, { idkiosko: id, permite_manual: permite });
}));

/**
 * "Activar en esta pantalla": entrega un token NUEVO para ese marcador.
 *
 * Es la forma de encender un marcador sin depender de que alguien haya guardado
 * un favorito. El que llega primero entra al POS, elige "Cocina" y listo.
 *
 * El token se ROTA en cada activacion, a proposito: asi no hay que guardar el
 * token en claro en ningun lado (solo su hash), y un marcador queda encendido
 * en una sola pantalla a la vez. Si la tablet vieja seguia abierta, deja de
 * entregar codigos y muestra el aviso de volver a vincular.
 */
router.post('/kiosko/:id/activar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id);
    if (!id) { return mal(res, 'id invalido'); }

    const token = crypto.randomBytes(32).toString('hex');
    const r = await prisma.asistencia_kiosko.updateMany({
        where: { idkiosko: id, idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
        data: { token_hash: sha256(token), ultimo_visto_at: null } as any
    });
    if (!r.count) { return mal(res, 'ese marcador no es de esta sede', 404); }

    const k = await prisma.asistencia_kiosko.findUnique({ where: { idkiosko: id } });
    ok(res, { idkiosko: id, nombre: k?.nombre || '', token });
}));

router.post('/kiosko/:id/revocar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const id = Number(req.params.id);
    if (!id) { return mal(res, 'id invalido'); }

    const r = await prisma.asistencia_kiosko.updateMany({
        where: { idkiosko: id, idorg: t.idorg, revocado_at: null },
        data: { revocado_at: fechaSql(ahoraLima()) } as any
    });
    if (!r.count) { return mal(res, 'ese kiosko no es de esta sede', 404); }
    ok(res, { revocado: true });
}));

// ---------------------------------------------------------------------------
// Ubicacion del local (GPS)
// ---------------------------------------------------------------------------

const RADIO_MIN = 30;     // menos que esto y el error normal del GPS rechaza a gente que si esta
const RADIO_MAX = 2000;

router.post('/gps/estado', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);
    const s: any = await prisma.sede.findUnique({ where: { idsede: t.idsede } });

    ok(res, {
        activo: !!s?.gps_activo,
        lat: s?.gps_lat !== null && s?.gps_lat !== undefined ? Number(s.gps_lat) : null,
        lng: s?.gps_lng !== null && s?.gps_lng !== undefined ? Number(s.gps_lng) : null,
        radio_m: s?.gps_radio_m ?? 150,
        radio_min: RADIO_MIN,
        radio_max: RADIO_MAX
    });
}));

/**
 * Guarda el punto del local y la configuracion.
 *
 * El POS ya escribio las mismas coordenadas en restobar.sede (que es lo que usa
 * Tracker); aca se espejan para que esta API pueda validar las marcas sin salir
 * a buscarlas a una base que no alcanza.
 */
router.post('/gps/guardar', asinc(async (req: PosRequest, res: any) => {
    const t = await resolverTenant(req.pos, req.body);

    const activo = !!req.body.activo;
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const hayPunto = isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0);

    if (hayPunto && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
        return mal(res, 'Esas coordenadas no son validas.');
    }
    // Encender la exigencia sin haber marcado el local dejaria a todos afuera.
    if (activo && !hayPunto) {
        return mal(res, 'Primero marca en el mapa donde esta el local.');
    }

    let radio = Number(req.body.radio_m);
    if (!isFinite(radio)) { radio = 150; }
    radio = Math.min(RADIO_MAX, Math.max(RADIO_MIN, Math.round(radio)));

    await prisma.sede.update({
        where: { idsede: t.idsede },
        data: {
            gps_activo: activo,
            gps_lat: hayPunto ? lat : null,
            gps_lng: hayPunto ? lng : null,
            gps_radio_m: radio
        } as any
    });

    ok(res, { activo, lat: hayPunto ? lat : null, lng: hayPunto ? lng : null, radio_m: radio });
}));

// ---------------------------------------------------------------------------
// Marcacion
// ---------------------------------------------------------------------------

/** Kiosko vigente a partir del token que manda la pantalla. */
async function kioskoPorToken(token: any) {
    if (!token || typeof token !== 'string' || token.length !== 64) { return null; }
    const k: any = await prisma.asistencia_kiosko.findFirst({ where: { token_hash: sha256(token), revocado_at: null } });
    return k || null;
}

/**
 * Codigo que la pantalla debe mostrar ahora. Lo pide cada pocos segundos.
 * Devuelve tambien los segundos que le quedan, para el contador visual.
 */
publico.post('/codigo', asinc(async (req: any, res: any) => {
    const k = await kioskoPorToken(req.body.kiosko_token);
    if (!k) { return mal(res, 'Esta pantalla ya no esta autorizada. Vuelve a vincularla desde el POS.', 410); }

    // Huella de vida, para que el panel muestre si la pantalla sigue encendida.
    await prisma.asistencia_kiosko.updateMany({
        where: { idkiosko: k.idkiosko },
        data: { ultimo_visto_at: fechaSql(ahoraLima()) } as any
    });

    ok(res, {
        idkiosko: k.idkiosko,
        nombre: k.nombre,
        codigo: calcularCodigo(k.token_hash, k.idkiosko, ventanaActual()),
        segundos: segundosRestantes(),
        ventana: VENTANA_SEG,
        // La pantalla consulta esto en cada ciclo, asi que apagar la marca
        // manual desde el panel se ve en el marcador sin tocar la tablet.
        permite_manual: !!k.permite_manual
    });
}));

/**
 * Registra la marca. Necesita las DOS pruebas:
 *   - codigo del kiosko  -> que esta fisicamente en el local (caduca en 30-60 s)
 *   - cookie del celular -> que es quien dice ser
 * Con una sola no alcanza, y ese es justamente el punto del diseno.
 */
/**
 * Que necesita el celular ANTES de marcar. Lo pide marcar.php para saber si
 * tiene que pedirle la ubicacion al navegador: pedir permiso de GPS cuando la
 * sede no lo exige es molesto y entrena a la gente a decir que no.
 */
publico.post('/marcar/info', asinc(async (req: any, res: any) => {
    const k: any = await prisma.asistencia_kiosko.findFirst({
        where: { idkiosko: Number(req.body.idkiosko), revocado_at: null }
    });
    if (!k) { return mal(res, 'Pantalla no valida.', 410); }

    const s: any = await prisma.sede.findFirst({ where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } });
    const exige = !!(s?.gps_activo && s?.gps_lat !== null && s?.gps_lng !== null);

    ok(res, { gps_requerido: exige, radio_m: s?.gps_radio_m ?? 150 });
}));

/**
 * Por que NO se puede marcar hoy, o null si la politica lo deja pasar.
 *
 * El corte es entre lo que decide el LOCAL y lo que decide la PERSONA:
 *   - si el local no abre, nadie marca hasta que un administrador habilite el
 *     dia. Que uno se presente no puede abrir el restaurante.
 *   - si el local abre y es el descanso de esta persona, ahi si manda la
 *     politica: o se pide permiso, o se acepta y se paga doble.
 *
 * Una exclusion cargada a mano ("Juan esta de licencia") nunca la pisa la
 * politica: alguien la escribio a proposito.
 */
interface Puerta { mensaje: string; habilitable: boolean }

function puertaCerrada(dl: any, politica: string): Puerta | null {
    // `habilitable` dice si un administrador puede resolverlo ahi mismo, en el
    // marcador. Es la diferencia entre "esperen a que alguien arregle esto" y
    // "llamen al encargado y siguen trabajando en un minuto".
    if (dl.origen === 'FERIADO' || dl.origen === 'CIERRE_SEDE' || dl.origen === 'EXCEPCION_SEDE') {
        return {
            mensaje: `Hoy el local no abre (${dl.motivo}). Si van a trabajar, el administrador tiene que habilitar el dia.`,
            habilitable: true
        };
    }
    if (dl.origen === 'EXCEPCION_PERSONA') {
        return { mensaje: `Hoy no te toca trabajar: ${dl.motivo}. Habla con el administrador.`, habilitable: true };
    }
    if (dl.origen === 'DESCANSO_SUSTITUTO') {
        return { mensaje: `${dl.motivo}. Si vas a trabajar igual, el administrador tiene que habilitar el dia.`, habilitable: true };
    }
    // Sin horario cargado no es un dia de descanso, es una ficha incompleta: no
    // corresponde pagarle recargo por un horario que nadie definio, y no se
    // arregla habilitando el dia sino cargandole el horario.
    if (!dl.hora_esperada && /Sin horario/i.test(dl.motivo || '')) {
        return { mensaje: 'Todavia no tienes horario asignado. Pide al administrador que te lo cargue.', habilitable: false };
    }
    if (politica !== 'RECARGO') {
        return { mensaje: 'Hoy es tu dia de descanso. Si vas a trabajar, el administrador tiene que habilitar el dia.', habilitable: true };
    }
    return null;
}

publico.post('/marcar', asinc(async (req: any, res: any) => {
    const idkiosko = Number(req.body.idkiosko);
    const dispositivo = req.body.dispositivo;

    if (!dispositivo || typeof dispositivo !== 'string' || dispositivo.length !== 64) {
        return mal(res, 'Este celular no esta activado. Pide al administrador que te active.', 403);
    }

    const k: any = await prisma.asistencia_kiosko.findFirst({ where: { idkiosko, revocado_at: null } });
    if (!k) { return mal(res, 'Pantalla no valida.', 410); }
    if (!codigoValido(k.token_hash, k.idkiosko, String(req.body.codigo || ''))) {
        return mal(res, 'El codigo ya vencio. Vuelve a escanear el QR de la pantalla.', 410);
    }

    const disp: any = await prisma.colaborador_dispositivo.findFirst({
        where: { token_hash: sha256(dispositivo), activo: true }
    });
    if (!disp) { return mal(res, 'Este celular no esta activado. Pide al administrador que te active.', 403); }
    if (new Date(disp.expira_at).getTime() < Date.now()) {
        return mal(res, 'La activacion de este celular vencio. Pide al administrador que la renueve.', 403);
    }

    const c: any = await prisma.colaborador.findUnique({ where: { idcolaborador: disp.idcolaborador } });
    if (!c || c.estado !== 0) { return mal(res, 'Tu ficha no esta activa. Avisa al administrador.', 403); }
    if (c.idorg !== k.idorg) { return mal(res, 'Esta pantalla no es de tu empresa.', 403); }

    // --- GPS -------------------------------------------------------------
    // Se valida DESPUES de identificar a la persona y ANTES de escribir nada:
    // asi el mensaje de error puede decir el nombre y la distancia, y un
    // rechazo por ubicacion no deja ninguna fila a medias.
    const sedeGps: any = await prisma.sede.findFirst({ where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } });
    if (!sedeGps) { return mal(res, 'Esta sede no esta configurada en Recursos Humanos.', 409); }
    let gps: any = null;

    if (sedeGps?.gps_activo && sedeGps.gps_lat !== null && sedeGps.gps_lng !== null) {
        const lectura = (req.body.lat !== undefined && req.body.lat !== null)
            ? { lat: Number(req.body.lat), lng: Number(req.body.lng), precision: req.body.precision !== undefined && req.body.precision !== null ? Number(req.body.precision) : null }
            : null;

        const v = verificarUbicacion(
            { lat: Number(sedeGps.gps_lat), lng: Number(sedeGps.gps_lng), radio_m: sedeGps.gps_radio_m ?? 150 },
            lectura
        );
        if (!v.ok) { return mal(res, v.error, 403); }
        gps = { lat: lectura!.lat, lng: lectura!.lng, distancia: v.distancia_m };
    }

    const org: any = await prisma.org.findUnique({ where: { idorg: c.idorg } });
    const corte = org?.asis_hora_corte instanceof Date
        ? org.asis_hora_corte.toISOString().slice(11, 19)
        : String(org?.asis_hora_corte || '05:00:00');

    const ahora = ahoraLima();
    const fecha = diaOperativo(corte, ahora);

    const delDia = await prisma.asistencia_marca.findMany({
        where: { idcolaborador: c.idcolaborador, fecha_local: fechaSql(fecha + ' 00:00:00') },
        orderBy: { marcada_at: 'asc' }
    });

    const entrada = delDia.find((m: any) => m.tipo === 'ENTRADA');
    const salida = delDia.find((m: any) => m.tipo === 'SALIDA');
    const nombre = ((c.nombres || '') + ' ' + (c.apellidos || '')).trim();

    // Doble escaneo o reintento del navegador: se muestra, no se inserta.
    const ultima: any = delDia.length ? delDia[delDia.length - 1] : null;
    if (ultima && (Date.parse(ahora + 'Z') - new Date(ultima.marcada_at).getTime()) < 2 * 60000) {
        return ok(res, {
            resultado: 'DEDUPE', nombres: nombre, tipo: ultima.tipo,
            hora: new Date(ultima.marcada_at).toISOString().slice(11, 16),
            mensaje: 'Ya registramos tu ' + ultima.tipo.toLowerCase() + ' hace un momento.'
        });
    }

    if (entrada && salida) {
        return ok(res, {
            resultado: 'COMPLETO', nombres: nombre,
            mensaje: 'Ya marcaste entrada y salida hoy. Si necesitas otra marca, pide al administrador.'
        });
    }

    const tipo = entrada ? 'SALIDA' : 'ENTRADA';

    // --- Hoy se trabaja? -------------------------------------------------
    // Solo se pregunta en la ENTRADA. Al que ya entro jamas se le niega la
    // SALIDA: dejarlo sin marcar el cierre le borraria las horas del dia.
    let nota: string | null = null;

    if (tipo === 'ENTRADA') {
        const ctx = await contextoLaboral(c.idorg, sedeGps.idsede, fecha, fecha);
        const dl = resolverDia({
            fecha,
            horario_semanal: c.horario_semanal as any,
            tolerancia_min: c.tolerancia_min ?? 10,
            excepciones: ctx.porPersona(c.idcolaborador),
            feriados: ctx.feriados,
            dias_cierre: ctx.dias_cierre,
            politica: ctx.politica
        });

        if (!dl.labora) {
            const puerta = puertaCerrada(dl, ctx.politica.descanso_trabajado);
            if (puerta) {
                return res.status(409).json({
                    success: false,
                    datos: { habilitable: puerta.habilitable, nombres: nombre, fecha },
                    error: puerta.mensaje
                });
            }

            // La politica del local dice que el que viene en su descanso cobra
            // doble. Se deja la excepcion escrita en vez de un flag en la marca:
            // la planilla ya lee las excepciones, y asi el administrador puede
            // cambiarla despues a "descansa otro dia" si lo coordinan distinto.
            await cfg.guardarExcepcion(
                { idorg: c.idorg, idsede: sedeGps.idsede },
                {
                    fecha, idcolaborador: c.idcolaborador, tipo: 'LABORABLE',
                    motivo: 'Marco en su dia de descanso',
                    compensacion: 'RECARGO', recargo_pct: ctx.politica.descanso_recargo_pct
                },
                { origen: 'POS', idusuario: null, nombre: 'Marcador (politica del local)' },
                true
            );
            nota = ctx.politica.descanso_recargo_pct >= 100
                ? 'Hoy es tu descanso: queda registrado con pago doble.'
                : `Hoy es tu descanso: queda registrado con ${ctx.politica.descanso_recargo_pct}% de recargo.`;
        } else if (dl.recargo_feriado_pct) {
            nota = `Hoy es feriado (${dl.feriado}): se registra con ${dl.recargo_feriado_pct}% de recargo.`;
        }
    }

    // La tardanza solo aplica a la ENTRADA, y se guarda como SNAPSHOT: si manana
    // le cambian el horario, la historia de hoy no se reescribe.
    const esperada = tipo === 'ENTRADA' ? horaEsperada(c.horario_semanal as any, fecha) : null;
    const tardanza = tipo === 'ENTRADA' ? tardanzaMin(esperada, ahora, c.tolerancia_min ?? 10) : null;

    await prisma.asistencia_marca.create({
        data: {
            idcolaborador: c.idcolaborador,
            idorg: c.idorg,
            idsede_restobar: k.idsede_restobar,
            tipo: tipo as any,
            fecha_local: fechaSql(fecha + ' 00:00:00'),
            marcada_at: fechaSql(ahora),
            metodo: 'QR' as any,
            hora_esperada: esperada ? fechaSql('1970-01-01 ' + esperada.slice(0, 5) + ':00') : null,
            tardanza_min: tardanza,
            iddispositivo: disp.iddispositivo,
            idkiosko: k.idkiosko,
            ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 45),
            // Se guarda de donde vino, para poder auditar un reclamo despues
            gps_lat: gps ? gps.lat : null,
            gps_lng: gps ? gps.lng : null,
            gps_distancia_m: gps ? gps.distancia : null
        } as any
    });

    ok(res, {
        resultado: tipo,
        nombres: nombre,
        hora: ahora.slice(11, 16),
        tardanza_min: tardanza,
        horas: tipo === 'SALIDA' && entrada
            ? horasTurno(new Date(entrada.marcada_at).toISOString().slice(0, 19).replace('T', ' '), ahora)
            : null,
        nota
    });
}));

export default router;
