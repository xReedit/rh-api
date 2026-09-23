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
import { Autor } from "../services/asistencia.bitacora";
import * as planilla from "../services/asistencia.planilla";
import * as ausencias from "../services/asistencia.ausencias";
import * as planillaCfg from "../services/planilla.config";
import {
    ahoraLima, diaOperativo, horaEsperada, horasTurno, aTextoLima
} from "../services/asistencia.calendario";

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

/** Tope de dias por consulta: un rango abierto barreria anos de marcas. */
const RANGO_MAX_DIAS = 186;   // medio ano, alcanza para cualquier periodo de planilla

function tenant(req: any) {
    const idorg = Number(req.token?.idorg);
    const idsede = Number(req.token?.idsede);
    if (!idorg || !idsede) { throw new Error('El token no trae empresa o sede.'); }
    return { idorg, idsede };
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

// ---------------------------------------------------------------------------
// Personal y horarios
// ---------------------------------------------------------------------------

router.get('/personal', asinc(async (req: any, res: any) => {
    const { idorg, idsede } = tenant(req);
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
    ok(res, await cfg.listarAreas(tenant(req)));
}));

router.post('/personal/area', asinc(async (req: any, res: any) => {
    ok(res, await cfg.asignarArea(tenant(req), req.body, autorRrhh(req)));
}));

// El mismo horario para todo un grupo: la cocina entera suele entrar a la
// misma hora y cargarlo uno por uno son quince dialogos identicos.
router.post('/personal/horario-masivo', asinc(async (req: any, res: any) => {
    ok(res, await cfg.horarioMasivo(tenant(req), req.body, autorRrhh(req)));
}));

router.put('/personal/:id/horario', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarHorario(tenant(req), { ...req.body, idcolaborador: req.params.id }, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------

router.get('/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.leerConfiguracion(tenant(req), req.query?.anio));
}));

router.post('/configuracion/listo', asinc(async (req: any, res: any) => {
    ok(res, await cfg.marcarConfigurado(tenant(req)));
}));

router.post('/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarConfiguracion(tenant(req), req.body, autorRrhh(req)));
}));

router.get('/calendario/:mes', asinc(async (req: any, res: any) => {
    ok(res, await cfg.calendarioMes(tenant(req), req.params.mes));
}));

router.get('/calendario/dia/:fecha', asinc(async (req: any, res: any) => {
    ok(res, await cfg.calendarioDia(tenant(req), req.params.fecha));
}));

router.post('/calendario/excepcion', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarExcepcion(tenant(req), req.body, autorRrhh(req)));
}));

router.delete('/calendario/excepcion/:id', asinc(async (req: any, res: any) => {
    ok(res, await cfg.eliminarExcepcion(tenant(req), req.params.id, autorRrhh(req)));
}));

router.post('/calendario/dias-cierre', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarDiasCierre(tenant(req), req.body.dias, autorRrhh(req)));
}));

router.get('/feriados/:anio?', asinc(async (req: any, res: any) => {
    ok(res, await cfg.listarFeriados(tenant(req), req.params.anio));
}));

router.post('/feriados', asinc(async (req: any, res: any) => {
    ok(res, await cfg.guardarFeriado(tenant(req), req.body, autorRrhh(req)));
}));

router.delete('/feriados/:id', asinc(async (req: any, res: any) => {
    ok(res, await cfg.eliminarFeriado(tenant(req), req.params.id, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Ausencias: por que alguien no esta marcando
// ---------------------------------------------------------------------------

router.get('/ausencias/alertas', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.alertas(tenant(req)));
}));

router.post('/ausencias/registrar', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.registrarAusencia(tenant(req), req.body, autorRrhh(req)));
}));

router.post('/ausencias/baja', asinc(async (req: any, res: any) => {
    ok(res, await ausencias.darDeBaja(tenant(req), req.body, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Planilla: de las marcas a la boleta
// ---------------------------------------------------------------------------
//
// Dos pasos a proposito. `calcular` no escribe nada y muestra de donde sale
// cada importe; `aplicar` recien ahi lo manda a la boleta. Ver antes de firmar
// es lo minimo cuando lo que sigue es pagarle a alguien.

router.get('/planilla/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await planillaCfg.leerConfig(tenant(req)));
}));

router.post('/planilla/configuracion', asinc(async (req: any, res: any) => {
    ok(res, await planillaCfg.guardarConfig(tenant(req), req.body, autorRrhh(req)));
}));

router.post('/planilla/calcular', asinc(async (req: any, res: any) => {
    ok(res, await planilla.calcular(tenant(req), req.body));
}));

router.post('/planilla/aplicar', asinc(async (req: any, res: any) => {
    ok(res, await planilla.aplicar(tenant(req), req.body, autorRrhh(req)));
}));

// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------

router.get('/bitacora', asinc(async (req: any, res: any) => {
    ok(res, await cfg.listarBitacora(tenant(req), req.query));
}));

// ---------------------------------------------------------------------------
// Un dia
// ---------------------------------------------------------------------------

router.get('/dia/:fecha?', asinc(async (req: any, res: any) => {
    const { idorg, idsede } = tenant(req);
    ok(res, await datosDia(idorg, idsede, req.params.fecha));
}));

// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------

const soloHora = (d: any) => (d ? new Date(d).toISOString().slice(11, 16) : null);

/** Lista de dias 'YYYY-MM-DD' entre dos fechas, ambas incluidas. */
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

/**
 * Resumen por colaborador para un rango de dias.
 *
 * Es lo que despues alimenta el descuento por tardanza en la boleta: por eso
 * separa `horas_trabajadas` (turnos cerrados) de `dias_incompletos` (entro y no
 * marco salida). Un dia incompleto NO suma horas: contarlo con una salida
 * inventada seria pagar o descontar sobre un dato que nadie registro.
 */
router.get('/reporte/:desde/:hasta', asinc(async (req: any, res: any) => {
    const { idorg, idsede } = tenant(req);
    const desde = String(req.params.desde);
    const hasta = String(req.params.hasta);

    if (!ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) { return mal(res, 'Las fechas deben ser YYYY-MM-DD.'); }
    if (desde > hasta) { return mal(res, 'La fecha inicial es posterior a la final.'); }

    const dias = diasEntre(desde, hasta);
    if (dias.length > RANGO_MAX_DIAS) {
        return mal(res, `El rango no puede pasar de ${RANGO_MAX_DIAS} dias.`);
    }

    // Hasta donde se puede hablar de faltas: el dia en curso todavia no cerro
    const org: any = await prisma.org.findUnique({ where: { idorg } });
    const c = org?.asis_hora_corte;
    const corte = c instanceof Date ? c.toISOString().slice(11, 19) : String(c || '05:00:00');
    const hoyOperativo = diaOperativo(corte, ahoraLima());

    const personal = await prisma.colaborador.findMany({
        where: { idorg, idsede, estado: 0 },
        orderBy: { nombres: 'asc' }
    });

    const marcas = await prisma.asistencia_marca.findMany({
        where: {
            idorg,
            fecha_local: {
                gte: new Date(desde + 'T00:00:00Z'),
                lte: new Date(hasta + 'T00:00:00Z')
            }
        },
        orderBy: { marcada_at: 'asc' }
    });

    const areas = await prisma.area.findMany({
        where: { estado: '0', OR: [{ idsede: 0 }, { idsede }] } as any,
        select: { idarea: true, descripcion: true }
    });
    const nombreArea = new Map<number, string>();
    for (const a of areas as any[]) { nombreArea.set(a.idarea, a.descripcion); }

    // Indice por colaborador + dia, para no recorrer todas las marcas por celda
    const idx = new Map<string, any>();
    for (const m of marcas as any[]) {
        const dia = aTextoLima(m.fecha_local)!.slice(0, 10);
        const k = `${m.idcolaborador}|${dia}`;
        if (!idx.has(k)) { idx.set(k, {}); }
        idx.get(k)[m.tipo] = m;
    }

    const filas = personal.map((p: any) => {
        let esperados = 0, asistencias = 0, tardanzas = 0, tardanzaMin = 0;
        let faltas = 0, horas = 0, incompletos = 0, manuales = 0;
        const detalle: any[] = [];

        for (const dia of dias) {
            const esperada = horaEsperada(p.horario_semanal as any, dia);
            const par = idx.get(`${p.idcolaborador}|${dia}`) || {};
            const entrada = par.ENTRADA || null;
            const salida = par.SALIDA || null;
            const cerrado = dia < hoyOperativo;

            if (esperada) { esperados++; }

            if (entrada) {
                asistencias++;
                if ((entrada.tardanza_min || 0) > 0) { tardanzas++; tardanzaMin += entrada.tardanza_min; }
                if (entrada.metodo === 'MANUAL') { manuales++; }

                if (salida) {
                    horas += horasTurno(aTextoLima(entrada.marcada_at)!, aTextoLima(salida.marcada_at)!);
                    if (salida.metodo === 'MANUAL') { manuales++; }
                } else if (cerrado) {
                    incompletos++;
                }
            } else if (esperada && cerrado) {
                faltas++;
            }

            if (entrada || salida) {
                detalle.push({
                    fecha: dia,
                    entrada: entrada ? soloHora(entrada.marcada_at) : null,
                    salida: salida ? soloHora(salida.marcada_at) : null,
                    tardanza_min: entrada ? entrada.tardanza_min : null,
                    horas: (entrada && salida) ? horasTurno(aTextoLima(entrada.marcada_at)!, aTextoLima(salida.marcada_at)!) : null,
                    manual: !!((entrada && entrada.metodo === 'MANUAL') || (salida && salida.metodo === 'MANUAL'))
                });
            }
        }

        return {
            idcolaborador: p.idcolaborador,
            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
            dni: p.dni,
            area: p.idarea ? (nombreArea.get(p.idarea) || '') : '',
            dias_esperados: esperados,
            asistencias,
            tardanzas,
            tardanza_min_total: tardanzaMin,
            faltas,
            dias_incompletos: incompletos,
            marcas_manuales: manuales,
            horas_trabajadas: Math.round(horas * 100) / 100,
            detalle
        };
    });

    ok(res, {
        desde, hasta,
        dias: dias.length,
        hoy: hoyOperativo,
        hora_corte: corte,
        filas,
        totales: {
            personal: filas.length,
            asistencias: filas.reduce((a, f) => a + f.asistencias, 0),
            tardanzas: filas.reduce((a, f) => a + f.tardanzas, 0),
            tardanza_min_total: filas.reduce((a, f) => a + f.tardanza_min_total, 0),
            faltas: filas.reduce((a, f) => a + f.faltas, 0),
            dias_incompletos: filas.reduce((a, f) => a + f.dias_incompletos, 0),
            horas_trabajadas: Math.round(filas.reduce((a, f) => a + f.horas_trabajadas, 0) * 100) / 100
        }
    });
}));

export default router;
