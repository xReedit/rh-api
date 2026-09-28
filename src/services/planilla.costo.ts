// Cuanto cuesta el personal en un periodo.
//
// QUE SE ENTIENDE POR COSTO
// Lo que le sale al negocio, no lo que recibe el trabajador. Son cosas
// distintas: el aporte a EsSalud lo paga el empleador y NO se le descuenta a
// nadie, pero es plata que sale igual. Mostrar el neto de las boletas como
// "costo de personal" dejaria ese 9% afuera.
//
//   costo = sueldo del periodo
//         + recargos (descanso y feriado trabajados, horas extra)
//         - descuentos (tardanzas, faltas, permisos sin goce)
//         + aportes del empleador (EsSalud, si la empresa lo usa)
//
// POR QUE SE APOYA EN `calcular` Y NO HACE SUS PROPIAS CUENTAS
// Si el costo se calculara aparte, tarde o temprano diria un numero distinto
// al de la boleta, y no habria forma de saber cual esta bien. Reusando el
// mismo motor, el costo es la suma de lo que cada uno va a cobrar: si no
// coinciden es porque hay un error, no porque sean dos criterios.

import { Ctx } from "./asistencia.config";
import { calcular, CODIGOS } from "./asistencia.planilla";
import { configDe } from "./planilla.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const dosDec = (n: number) => Math.round(n * 100) / 100;

/**
 * Dias que se pagan en un periodo, segun la convencion peruana.
 *
 * Un mes son 30 dias SIEMPRE, tenga 28 o 31: es la misma convencion con la que
 * `tarifaDe` saca el valor del dia. Usar los dias reales del calendario haria
 * que el mismo sueldo costara distinto en febrero que en marzo.
 */
const DIAS_PAGABLES: Record<string, number> = {
    DIARIO: 1, SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30
};

/** El aporte del empleador a EsSalud: 9% de la remuneracion. */
export const PCT_ESSALUD = 9;

export interface CostoPersona {
    idcolaborador: number;
    nombres: string;
    area: string;
    /** Sin contrato cargado: no se le puede poner precio. */
    sin_contrato: boolean;
    sueldo_periodo: number;
    recargos: number;
    descuentos: number;
    /** Lo que cobra: sueldo + recargos - descuentos. */
    remuneracion: number;
    /** Lo que ademas paga la empresa por esta persona. */
    aportes: number;
    /** Lo que le cuesta al negocio: remuneracion + aportes. */
    costo: number;

    // --- lo que explica POR QUE cuesta eso -------------------------------
    /** Minutos trabajados de mas. Se informan se paguen o no. */
    sobretiempo_min: number;
    /** Lo que se paga por esas horas. 0 si el local no activo el pago. */
    sobretiempo_importe: number;
    tardanza_min: number;
    /** Lo que se le descuenta por esas tardanzas. */
    tardanza_importe: number;
    faltas: number;
    /** Lo que se le descuenta por faltar. */
    faltas_importe: number;
}

/**
 * El costo del personal de un periodo, por persona y en total.
 *
 * `body` es el mismo que toma la planilla: `{ periodo: '2026-03' }` o una
 * fecha de inicio de periodo.
 */
export async function costoDePersonal(ctx: Ctx, body: any) {
    const pl = await calcular(ctx, body);
    const cfg = configDe(await prisma.org.findUnique({ where: { idorg: ctx.idorg } }));

    const dias = DIAS_PAGABLES[pl.tipo] ?? 30;
    const pctAportes = cfg.usa_essalud ? PCT_ESSALUD : 0;

    const areas = new Map<number, string>();
    const colaboradores = await prisma.colaborador.findMany({
        where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 } as any,
        select: { idcolaborador: true, idarea: true }
    });
    const areaDe = new Map(colaboradores.map((c: any) => [c.idcolaborador, c.idarea || 0]));

    const listaAreas = await prisma.area.findMany({
        where: { estado: '0', OR: [{ idsede: 0 }, { idsede: ctx.idsede }] } as any,
        select: { idarea: true, descripcion: true }
    });
    listaAreas.forEach((a: any) => areas.set(a.idarea, a.descripcion));

    const personas: CostoPersona[] = pl.filas.map((f: any) => {
        // Sin contrato no hay sueldo que sumar. Se lista igual, en cero y
        // marcado: un costo que le falta gente es peor que uno incompleto que
        // lo dice.
        const sueldo = f.valor_dia ? dosDec(f.valor_dia * dias) : 0;
        const remuneracion = dosDec(sueldo + f.total_ingresos - f.total_descuentos);
        const aportes = dosDec(remuneracion * pctAportes / 100);

        const idarea = areaDe.get(f.idcolaborador) || 0;

        // Los importes salen de las lineas que ya armo la planilla, buscadas
        // por su codigo estable. Recalcularlos aqui seria pedirle al costo que
        // se ponga de acuerdo con la boleta, y eso es justo lo que se evita.
        const linea = (codigo: string) =>
            f.conceptos.find((c: any) => c.codigo === codigo)?.importe || 0;

        return {
            idcolaborador: f.idcolaborador,
            nombres: f.nombres,
            area: areas.get(idarea) || '',
            sin_contrato: f.sin_contrato,
            sueldo_periodo: sueldo,
            recargos: f.total_ingresos,
            descuentos: f.total_descuentos,
            remuneracion,
            aportes,
            costo: dosDec(remuneracion + aportes),

            sobretiempo_min: f.sobretiempo_min || 0,
            sobretiempo_importe: f.sobretiempo_importe || 0,
            tardanza_min: f.tardanza_min || 0,
            tardanza_importe: linea(CODIGOS.DESC_TARDANZA),
            faltas: f.faltas || 0,
            faltas_importe: linea(CODIGOS.DESC_FALTAS)
        };
    });

    const suma = (f: (p: CostoPersona) => number) => dosDec(personas.reduce((a, p) => a + f(p), 0));

    // Por area, para saber donde esta la plata: cocina y salon no cuestan lo
    // mismo y el dueno decide sobre eso, no sobre el total.
    const porArea = new Map<string, { area: string; personas: number; costo: number }>();
    for (const p of personas) {
        const k = p.area || 'Sin area';
        const a = porArea.get(k) || { area: k, personas: 0, costo: 0 };
        a.personas++;
        a.costo = dosDec(a.costo + p.costo);
        porArea.set(k, a);
    }

    return {
        periodo: pl.periodo,
        clave: pl.clave,
        tipo: pl.tipo,
        desde: pl.desde,
        hasta: pl.hasta,
        en_curso: pl.en_curso,
        /** Con el periodo sin cerrar los numeros todavia se mueven. */
        pct_aportes: pctAportes,
        personas,
        por_area: Array.from(porArea.values()).sort((a, b) => b.costo - a.costo),
        totales: {
            personal: personas.length,
            sin_contrato: personas.filter(p => p.sin_contrato).length,
            sueldos: suma(p => p.sueldo_periodo),
            recargos: suma(p => p.recargos),
            descuentos: suma(p => p.descuentos),
            remuneraciones: suma(p => p.remuneracion),
            aportes: suma(p => p.aportes),
            costo: suma(p => p.costo),

            sobretiempo_min: personas.reduce((a, p) => a + p.sobretiempo_min, 0),
            sobretiempo_importe: suma(p => p.sobretiempo_importe),
            tardanza_min: personas.reduce((a, p) => a + p.tardanza_min, 0),
            tardanza_importe: suma(p => p.tardanza_importe),
            faltas: personas.reduce((a, p) => a + p.faltas, 0),
            faltas_importe: suma(p => p.faltas_importe)
        }
    };
}

/**
 * El costo de VARIAS sedes de la misma empresa, para compararlas.
 *
 * Se recorren del lado del servidor y no desde la pantalla: cada sede es un
 * calculo de planilla entero, y hacerlo con una llamada por sede convertiria
 * una comparacion de cinco locales en cinco viajes de ida y vuelta.
 *
 * Solo devuelve el resumen de cada una. El detalle persona por persona se pide
 * aparte, cuando alguien entra a mirar un local en particular.
 */
export async function costoDeSedes(
    idorg: number,
    sedes: Array<{ idsede: number; idsede_restobar: number; nombre: string }>,
    body: any
) {
    const filas = [];

    for (const s of sedes) {
        try {
            const c = await costoDePersonal({ idorg, idsede: s.idsede } as any, body);
            filas.push({
                idsede: s.idsede,
                idsede_restobar: s.idsede_restobar,
                nombre: s.nombre,
                periodo: c.periodo,
                personal: c.totales.personal,
                sin_contrato: c.totales.sin_contrato,
                costo: c.totales.costo,
                sueldos: c.totales.sueldos,
                recargos: c.totales.recargos,
                descuentos: c.totales.descuentos,
                aportes: c.totales.aportes,
                sobretiempo_min: c.totales.sobretiempo_min,
                sobretiempo_importe: c.totales.sobretiempo_importe,
                tardanza_min: c.totales.tardanza_min,
                faltas: c.totales.faltas,
                // El detalle va tambien: sin esto no se puede responder "en que
                // area se va la plata de toda la cadena" ni "quien es el que
                // mas cuesta, este donde este". Ya estaba calculado.
                por_area: c.por_area,
                personas: c.personas.map(p => ({ ...p, sede: s.nombre }))
            });
        } catch (e: any) {
            // Una sede que falla no puede dejar sin comparacion a las otras:
            // se lista con el problema anotado y las demas siguen.
            console.error('[costo] no se pudo calcular la sede', s.idsede, e?.message);
            filas.push({
                idsede: s.idsede,
                idsede_restobar: s.idsede_restobar,
                nombre: s.nombre,
                error: String(e?.message || 'no se pudo calcular')
            });
        }
    }

    return { sedes: filas };
}
