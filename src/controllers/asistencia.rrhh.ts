// Asistencia vista desde la app de Recursos Humanos.
//
// El POS captura las marcas; aqui se leen. Son dos puertas distintas al mismo
// dato, y a proposito:
//   - /asistencia        lo llama el POS, con su token firmado (empresa+sede)
//   - /asistencia-rrhh   lo llama esta app, con el login de RRHH (middleware auth)
//
// Las MARCAS son de solo lectura: corregir una se hace en el marcador, con
// usuario y clave. Si tambien se pudiera desde la oficina habria dos caminos y
// uno de ellos sin esa compuerta.
//
// La CONFIGURACION (horarios, calendario, feriados) si se escribe desde aqui:
// es trabajo de Recursos Humanos y el POS no deberia ser el unico lugar donde
// se puede hacer. Las operaciones son literalmente las mismas que usa el POS
// -- services/asistencia.config -- asi que no hay forma de que las dos puertas
// apliquen reglas distintas. Lo unico que cambia es el `Autor` que queda en la
// bitacora: origen RRHH y el usuario del login, sin autorizante (quien entra
// aqui ya es del area).
//
// El tenant sale del token de RRHH (req.token.idorg / idsede), nunca de la URL:
// cambiar un numero en la barra de direcciones no debe mostrar otra empresa.

import * as express from "express";
import { PrismaClient } from "@prisma/client";
import { datosDia } from "./asistencia";
import * as cfg from "../services/asistencia.config";
import { Invalido } from "../services/asistencia.config";
import { Autor, anotar } from "../services/asistencia.bitacora";
import * as planilla from "../services/asistencia.planilla";
import * as ausencias from "../services/asistencia.ausencias";
import * as planillaCfg from "../services/planilla.config";
import * as costo from "../services/planilla.costo";
import * as ficha from "../services/asistencia.ficha";
import * as reportes from "../services/asistencia.reportes";
import { ahoraLima, fechaSql } from "../services/asistencia.calendario";
const prisma = new PrismaClient();
const router = express.Router();

const ok = (res: any, datos: any = null) => res.status(200).json({ success: true, datos, error: '' });
const mal = (res: any, error: string, code = 400) => res.status(code).json({ success: false, datos: null, error });

const asinc = (fn: any) => (req: any, res: any) =>
    fn(req, res).catch((e: any) => {
        // Invalido es "pediste mal", no "se rompio": no ensucia el log ni sale 500
        if (e instanceof Invalido) { return mal(res, e.message, e.code); }
        console.error('[asistencia-rrhh]', req.path, e);
        mal(res, e.message || 'error interno', 500);
    });

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sobre que empresa y sede se trabaja.
 *
 * La EMPRESA sale siempre del token y no se puede pedir otra. La SEDE se puede
 * cambiar -- una cadena administra varios locales desde el mismo login -- pero
 * solo entre las de esa misma empresa, y se verifica contra la base.
 *
 * Ese chequeo es el unico que impide que cambiar un numero en la URL muestre el
 * personal y la planilla de otra empresa. Por eso vive aqui, en el camino
 * obligatorio de los 27 endpoints, y no repetido en cada uno.
 */
async function tenantDe(req: any) {
    const idorg = Number(req.token?.idorg);
    const propia = Number(req.token?.idsede);
    if (!idorg || !propia) { throw new Invalido('El token no trae empresa o sede.', 401); }

    const pedida = Number(req.query?.idsede ?? req.body?.idsede) || 0;

    // El camino comun -- trabajar sobre el propio local -- no consulta nada.
    // El alcance solo importa cuando se cruza de sede.
    if (!pedida || pedida === propia) { return { idorg, idsede: propia }; }

    const s = await prisma.sede.findFirst({
        where: { idsede: pedida, idorg, estado: '0' } as any
    });
    if (!s) { throw new Invalido('Esa sede no es de tu empresa o no esta activa.', 403); }

    if (!(await puedeVerSede(req, idorg, pedida))) {
        throw new Invalido('Tu usuario no tiene acceso a ese local.', 403);
    }

    return { idorg, idsede: pedida };
}

/**
 * Puede este usuario trabajar sobre esa sede?
 *
 * Se lee de la base y no del token a proposito: quitarle un local a alguien
 * tiene que valer en el proximo pedido, no cuando se le venza la sesion. Un
 * permiso que tarda ocho horas en revocarse no es un permiso.
 */
async function puedeVerSede(req: any, idorg: number, idsede: number): Promise<boolean> {
    const u: any = await prisma.usuario.findFirst({
        where: { idusuario: Number(req.token?.id) || 0, idorg, estado: '0' } as any
    });
    if (!u) { return false; }

    if (u.alcance === 'EMPRESA') { return true; }
    if (u.alcance !== 'ASIGNADAS') { return false; }   // SEDE, o un valor raro

    const asignada = await prisma.usuario_sede.findFirst({
        where: { idusuario: u.idusuario, idsede } as any
    });
    return !!asignada;
}

/** Los locales sobre los que este usuario puede trabajar. */
async function sedesPermitidas(req: any, idorg: number) {
    const u: any = await prisma.usuario.findFirst({
        where: { idusuario: Number(req.token?.id) || 0, idorg, estado: '0' } as any
    });
    const propia = Number(req.token?.idsede) || 0;
    const alcance = u?.alcance || 'SEDE';

    if (alcance === 'EMPRESA') { return { alcance, ids: null as number[] | null }; }

    if (alcance === 'ASIGNADAS') {
        const filas: any[] = await prisma.usuario_sede.findMany({
            where: { idusuario: u.idusuario } as any
        });
        // La propia va siempre: nadie deberia quedar sin acceso a su local por
        // un olvido al armar la lista.
        return { alcance, ids: Array.from(new Set([propia, ...filas.map(f => f.idsede)])) };
    }

    return { alcance, ids: [propia] };
}

/**
 * Las sedes entre las que se puede elegir.
 *
 * Trae cuanta gente tiene cada una para que el selector diga algo util: en una
 * cadena, saber cual local esta sin personal cargado es la mitad del trabajo.
 */
async function listarSedes(idorg: number) {
    const sedes: any[] = await prisma.sede.findMany({
        where: { idorg, estado: '0' } as any,
        orderBy: [{ principal: 'desc' }, { nombre: 'asc' }]
    });

    const personal = await prisma.colaborador.groupBy({
        by: ['idsede'],
        where: { idorg, estado: 0 } as any,
        _count: { idcolaborador: true }
    } as any);
    const cuenta = new Map<number, number>(
        (personal as any[]).map(p => [p.idsede, p._count.idcolaborador]));

    return sedes.map(s => ({
        idsede: s.idsede,
        nombre: s.nombre,
        ciudad: s.ciudad,
        principal: s.principal === '1',
        personal: cuenta.get(s.idsede) || 0,
        configurada: !!s.asis_configurado
    }));
}

/** Quien firma el cambio en la bitacora. Sale del token, nunca del body. */
function autorRrhh(req: any): Autor {
    return {
        origen: 'RRHH',
        idusuario: Number(req.token?.id) || null,
        nombre: String(req.token?.usuario || '')
    };
}

router.get('/', (_req, res) => res.status(200).json({ message: 'Estas conectado a asistencia (RRHH)' }));

// Las sedes de la empresa, para el selector. La empresa sale del token: aca no
// hay nada que elegir mas alla de sus propios locales.
router.get('/sedes', asinc(async (req: any, res: any) => {
    const idorg = Number(req.token?.idorg);
    if (!idorg) { throw new Invalido('El token no trae empresa.', 401); }

    const permitidas = await sedesPermitidas(req, idorg);
    const todas = await listarSedes(idorg);
    const sedes = permitidas.ids === null
        ? todas
        : todas.filter(s => permitidas.ids!.includes(s.idsede));

    ok(res, {
        sedes,
        idsede_token: Number(req.token?.idsede) || 0,
        // La pantalla lo usa para no ofrecer un combo de una sola opcion
        alcance: permitidas.alcance
    });
}));

// ---------------------------------------------------------------------------
// Quien ve que locales
// ---------------------------------------------------------------------------

const ALCANCES = ['SEDE', 'ASIGNADAS', 'EMPRESA'];

/**
 * Solo un usuario con alcance EMPRESA puede repartir accesos.
 *
 * Es el candado que sostiene todo lo demas: sin el, cualquiera se asciende solo
 * con un pedido y los otros dos alcances son decorativos.
 */
async function exigirAlcanceEmpresa(req: any, idorg: number) {
    const u: any = await prisma.usuario.findFirst({
        where: { idusuario: Number(req.token?.id) || 0, idorg, estado: '0' } as any
    });
    if (!u || u.alcance !== 'EMPRESA') {
        throw new Invalido('Solo quien administra todos los locales puede cambiar estos accesos.', 403);
    }
    return u;
}

router.get('/usuarios', asinc(async (req: any, res: any) => {
    const idorg = Number(req.token?.idorg);
    if (!idorg) { throw new Invalido('El token no trae empresa.', 401); }
    await exigirAlcanceEmpresa(req, idorg);

    const usuarios: any[] = await prisma.usuario.findMany({
        where: { idorg, estado: '0' } as any,
        orderBy: { nombres: 'asc' }
    });

    const asignadas: any[] = await prisma.usuario_sede.findMany({
        where: { idusuario: { in: usuarios.map(u => u.idusuario) } } as any
    });
    const porUsuario = new Map<number, number[]>();
    for (const a of asignadas) {
        if (!porUsuario.has(a.idusuario)) { porUsuario.set(a.idusuario, []); }
        porUsuario.get(a.idusuario)!.push(a.idsede);
    }

    const sedes = await listarSedes(idorg);
    const nombreSede = new Map<number, string>(sedes.map(x => [x.idsede, x.nombre]));

    ok(res, {
        sedes,
        yo: Number(req.token?.id) || 0,
        usuarios: usuarios.map(u => ({
            idusuario: u.idusuario,
            nombres: u.nombres,
            usuario: u.usuario,
            cargo: u.cargo,
            alcance: u.alcance,
            sede_propia: u.idsede,
            sede_propia_nombre: nombreSede.get(u.idsede) || '',
            asignadas: porUsuario.get(u.idusuario) || []
        }))
    });
}));

router.put('/usuarios/:id/alcance', asinc(async (req: any, res: any) => {
    const idorg = Number(req.token?.idorg);
    if (!idorg) { throw new Invalido('El token no trae empresa.', 401); }
    const yo = await exigirAlcanceEmpresa(req, idorg);

    const id = Number(req.params.id) || 0;
    const destino: any = await prisma.usuario.findFirst({
        where: { idusuario: id, idorg, estado: '0' } as any
    });
    if (!destino) { throw new Invalido('Ese usuario no es de tu empresa.', 404); }

    const alcance = String(req.body?.alcance || '').toUpperCase();
    if (!ALCANCES.includes(alcance)) { throw new Invalido('Alcance no valido.'); }

    // Nadie se quita a si mismo el permiso de repartir permisos: si es el
    // unico con alcance EMPRESA, la empresa queda sin quien pueda devolverselo
    // y hay que arreglarlo con SQL.
    if (destino.idusuario === yo.idusuario && alcance !== 'EMPRESA') {
        throw new Invalido('No puedes quitarte a ti mismo el acceso a todos los locales.');
    }

    const ids = (Array.isArray(req.body?.sedes) ? req.body.sedes : []).map(Number).filter(Boolean);

    if (alcance === 'ASIGNADAS') {
        if (!ids.length) { throw new Invalido('Elige al menos un local, o usa otro alcance.'); }
        // Que todas sean de esta empresa: sin esto, la lista es una via para
        // darle a alguien un local ajeno.
        const validas = await prisma.sede.findMany({
            where: { idsede: { in: ids }, idorg, estado: '0' } as any,
            select: { idsede: true }
        });
        if (validas.length !== ids.length) {
            throw new Invalido('Alguno de esos locales no es de tu empresa o esta dado de baja.', 403);
        }
    }

    await prisma.usuario.update({
        where: { idusuario: id },
        data: { alcance } as any
    });

    // La lista se reescribe entera: es mas simple de razonar que calcular
    // altas y bajas, y aqui son pocas filas.
    await prisma.usuario_sede.deleteMany({ where: { idusuario: id } as any });
    if (alcance === 'ASIGNADAS') {
        await prisma.usuario_sede.createMany({
            data: ids.map((idsede: number) => ({
                idusuario: id, idsede, creado_at: fechaSql(ahoraLima())
            })) as any
        });
    }

    const sede: any = await prisma.sede.findUnique({ where: { idsede: destino.idsede } });
    await anotar({
        idorg, idsede_restobar: sede?.idsede_restobar ?? 0,
        entidad: 'POLITICA', accion: 'MODIFICA',
        detalle: `Acceso de ${destino.nombres}: ${destino.alcance} -> ${alcance}` +
            (alcance === 'ASIGNADAS' ? ` (${ids.length} local(es))` : ''),
        anterior: { alcance: destino.alcance },
        nuevo: { alcance, sedes: ids }
    }, autorRrhh(req));

    ok(res, { idusuario: id, alcance, sedes: ids });
}));

// ---------------------------------------------------------------------------
// Personal y horarios
// ---------------------------------------------------------------------------

router.get('/personal', asinc(async (req: any, res: any) => {
    const { idorg, idsede } = await tenantDe(req);
    const filas: any[] = await prisma.colaborador.findMany({
        where: { idorg, idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });
    const areas: any[] = await prisma.area.findMany({
        where: { estado: '0', OR: [{ idsede: 0 }, { idsede }] } as any,
        select: { idarea: true, descripcion: true }
    });
    const nombreArea = new Map<number, string>(areas.map(a => [a.idarea, a.descripcion]));

    ok(res, {
        personal: filas.map(c => ({
            idcolaborador: c.idcolaborador,
            nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
            dni: c.dni,
            area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
            horario_semanal: c.horario_semanal,
            tolerancia_min: c.tolerancia_min ?? 10
        })),
        areas: areas.map(a => ({ idarea: a.idarea, descripcion: a.descripcion }))
    });
}));

router.get('/areas', asinc(async (req: any, res: any) => {
    ok(res, await cfg.listarAreas(await tenantDe(req)));
}));

router.post('/personal/area', asinc(async (req: any, res: any) => {
    ok(res, await cfg.asignarArea(await tenantDe(req), req.body, autorRrhh(req)));
}));

// El mismo horario para todo un grupo: la cocina entera suele entrar a la
// misma hora y cargarlo uno por uno son quince dialogos identicos.
router.post('/personal/horario-masivo', asinc(async (req: any, res: any) => {
    ok(res, await cfg.horarioMasivo(await tenantDe(req), req.body, autorRrhh(req)));
}));

router.put('/personal/:id/horario', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarHorario(await tenantDe(req), { ...req.body, idcolaborador: req.params.id }, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------

router.get('/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.leerConfiguracion(await tenantDe(req), req.query?.anio));
}));

router.post('/configuracion/listo', asinc(async (req: any, res: any) => {
    ok(res, await cfg.marcarConfigurado(await tenantDe(req)));
}));

router.post('/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarConfiguracion(await tenantDe(req), req.body, autorRrhh(req)));
}));

router.get('/calendario/:mes', asinc(async (req: any, res: any) => {
    ok(res, await cfg.calendarioMes(await tenantDe(req), req.params.mes));
}));

router.get('/calendario/dia/:fecha', asinc(async (req: any, res: any) => {
    ok(res, await cfg.calendarioDia(await tenantDe(req), req.params.fecha));
}));

router.post('/calendario/excepcion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarExcepcion(await tenantDe(req), req.body, autorRrhh(req)));
}));

router.delete('/calendario/excepcion/:id', asinc(async (req: any, res: any) => {
    ok(res, await cfg.eliminarExcepcion(await tenantDe(req), req.params.id, autorRrhh(req)));
}));

router.post('/calendario/dias-cierre', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarDiasCierre(await tenantDe(req), req.body.dias, autorRrhh(req)));
}));

router.get('/feriados/:anio?', asinc(async (req: any, res: any) => {
    ok(res, await cfg.listarFeriados(await tenantDe(req), req.params.anio));
}));

router.post('/feriados', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarFeriado(await tenantDe(req), req.body, autorRrhh(req)));
}));

router.delete('/feriados/:id', asinc(async (req: any, res: any) => {
    ok(res, await cfg.eliminarFeriado(await tenantDe(req), req.params.id, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Ausencias: por que alguien no esta marcando
// ---------------------------------------------------------------------------

router.get('/ausencias/alertas', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.alertas(await tenantDe(req)));
}));

router.post('/ausencias/registrar', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.registrarAusencia(await tenantDe(req), req.body, autorRrhh(req)));
}));

router.post('/ausencias/baja', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.darDeBaja(await tenantDe(req), req.body, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Planilla: de las marcas a la boleta
// ---------------------------------------------------------------------------
//
// Dos pasos a proposito. `calcular` no escribe nada y muestra de donde sale
// cada importe; `aplicar` recien ahi lo manda a la boleta. Ver antes de firmar
// es lo minimo cuando lo que sigue es pagarle a alguien.

router.get('/planilla/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await planillaCfg.leerConfig(await tenantDe(req)));
}));

router.post('/planilla/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await planillaCfg.guardarConfig(await tenantDe(req), req.body, autorRrhh(req)));
}));

// El mes de UNA persona, dia por dia. Es lo que se mira cuando alguien
// pregunta por que le descontaron.
router.post('/asistencia/ficha', asinc(async (req: any, res: any) => {
    ok(res, await ficha.fichaDelMes(await tenantDe(req), req.body));
}));

// Cuanto cuesta el personal del periodo. Es la misma cuenta que la planilla,
// sumada y con el aporte del empleador encima.
router.post('/planilla/costo', asinc(async (req: any, res: any) => {
    ok(res, await costo.costoDePersonal(await tenantDe(req), req.body));
}));

router.post('/planilla/calcular', asinc(async (req: any, res: any) => {
    ok(res, await planilla.calcular(await tenantDe(req), req.body));
}));

router.post('/planilla/aplicar', asinc(async (req: any, res: any) => {
    ok(res, await planilla.aplicar(await tenantDe(req), req.body, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------

router.get('/bitacora', asinc(async (req: any, res: any) => {
    ok(res, await cfg.listarBitacora(await tenantDe(req), req.query));
}));

// ---------------------------------------------------------------------------
// Un dia
// ---------------------------------------------------------------------------

router.get('/dia/:fecha?', asinc(async (req: any, res: any) => {
    const { idorg, idsede } = await tenantDe(req);
    ok(res, await datosDia(idorg, idsede, req.params.fecha));
}));

// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------

router.get('/reporte/:desde/:hasta', asinc(async (req: any, res: any) => {
    ok(res, await reportes.reporteRango(await tenantDe(req), String(req.params.desde), String(req.params.hasta)));
}));

// El registro que exige el D.S. 004-2006-TR: dia por dia, sin resumir, con el
// RUC del empleador y el DNI de cada trabajador. Se conserva 5 anos.
router.get('/registro-jornada/:desde/:hasta', asinc(async (req: any, res: any) => {
    ok(res, await reportes.registroJornada(await tenantDe(req), String(req.params.desde), String(req.params.hasta)));
}));

export default router;
