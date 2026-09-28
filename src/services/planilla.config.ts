// Como lleva la planilla esta empresa.
//
// Dos cosas, y las dos son decisiones del negocio que se contestan una vez:
//
//   1. CADA CUANTO SE PAGA. Semanal, quincenal, mensual o diario. Define los
//      periodos que se pueden cerrar.
//
//   2. QUE TAN FORMAL ES. Seis interruptores, todos apagados de fabrica. El
//      nivel 0 es "se cuanto le pago a cada uno y le imprimo su boleta", que es
//      lo que la mayoria necesita y lo unico que muchos van a usar nunca.
//      Encender uno agrega su bloque de conceptos; apagarlo los esconde sin
//      borrar nada de lo ya cargado.
//
// POR QUE APAGADOS POR DEFECTO
// Al reves -- todo encendido y que apague lo que no usa -- el primer contacto
// con el sistema es una boleta con AFP, CTS y renta de quinta que la persona no
// entiende y no sabe si puede tocar. Empezar simple y agregar es mas facil que
// empezar lleno y podar.

import { PrismaClient } from "@prisma/client";
import { anotar, Autor } from "./asistencia.bitacora";
import { Ctx, Invalido } from "./asistencia.config";
import {
    Regimen, REGIMENES, normalizarRegimen, normalizarRmv, interruptoresDe, beneficiosDe
} from "./planilla.regimen";
import {
    Frecuencia, normalizarFrecuencia, normalizarInicioSemana,
    periodoDe, ultimosPeriodos, periodoPorClave, Periodo
} from "./planilla.periodos";
import { ahoraLima } from "./asistencia.calendario";

const prisma = new PrismaClient();

/** Los interruptores, con el nombre que ve la gente y que agrega cada uno. */
export const INTERRUPTORES = [
    { campo: 'usa_pensiones', clave: 'pensiones', titulo: 'Descuento de pensiones (AFP / ONP)',
      ayuda: 'Agrega el descuento de pensiones a la boleta. Obligatorio para personal en planilla formal.' },
    { campo: 'usa_essalud', clave: 'essalud', titulo: 'Aporte a EsSalud',
      ayuda: 'El 9% que paga el empleador. No se le descuenta al trabajador: es costo de la empresa.' },
    { campo: 'usa_cts', clave: 'cts', titulo: 'CTS',
      ayuda: 'Compensacion por tiempo de servicios, que se deposita en mayo y noviembre.' },
    { campo: 'usa_gratificacion', clave: 'gratificacion', titulo: 'Gratificaciones',
      ayuda: 'Las de julio y diciembre.' },
    { campo: 'usa_renta_quinta', clave: 'renta_quinta', titulo: 'Renta de quinta categoria',
      ayuda: 'Retencion de impuesto a la renta. Solo aplica por encima de 7 UIT al ano.' },
    { campo: 'usa_formato_legal', clave: 'formato_legal', titulo: 'Boleta con formato de ley',
      ayuda: 'Imprime la boleta con los datos que exige la norma: RUC, regimen laboral, dias trabajados.' },
    { campo: 'usa_sobretiempo', clave: 'sobretiempo', titulo: 'Pagar horas extra',
      ayuda: 'Agrega a la boleta el tiempo trabajado de mas: 25% las dos primeras horas del dia y 35% las siguientes (D.S. 007-2002-TR). Las horas extra se REGISTRAN siempre, este activado o no; esto decide si ademas se pagan.' }
] as const;

/** Minutos de gracia por defecto antes de contar sobretiempo. */
export const UMBRAL_SOBRETIEMPO_DEFECTO = 15;

export interface ConfigPlanilla {
    regimen_laboral: Regimen;
    /** Remuneracion minima vigente. Cambia por decreto, por eso se guarda. */
    rmv: number;
    frecuencia_pago: Frecuencia;
    semana_empieza: number;
    usa_pensiones: boolean;
    usa_essalud: boolean;
    usa_cts: boolean;
    usa_gratificacion: boolean;
    usa_renta_quinta: boolean;
    usa_formato_legal: boolean;
    usa_sobretiempo: boolean;
    /** Minutos fuera de la jornada que NO cuentan como sobretiempo. */
    sobretiempo_min_umbral: number;
}

/**
 * El umbral, acotado a algo que tenga sentido.
 *
 * Un umbral enorme apagaria el sobretiempo sin que nadie se entere: la pantalla
 * diria que esta activado y no pagaria nunca. Dos horas es el tope: mas que eso
 * ya no es "margen para marcar", es media jornada regalada.
 */
export function normalizarUmbral(v: any): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { return UMBRAL_SOBRETIEMPO_DEFECTO; }
    return Math.min(Math.round(n), 120);
}

export function configDe(org: any): ConfigPlanilla {
    return {
        regimen_laboral: normalizarRegimen(org?.regimen_laboral),
        rmv: normalizarRmv(org?.rmv),
        frecuencia_pago: normalizarFrecuencia(org?.frecuencia_pago),
        semana_empieza: normalizarInicioSemana(org?.semana_empieza),
        usa_pensiones: !!org?.usa_pensiones,
        usa_essalud: !!org?.usa_essalud,
        usa_cts: !!org?.usa_cts,
        usa_gratificacion: !!org?.usa_gratificacion,
        usa_renta_quinta: !!org?.usa_renta_quinta,
        usa_formato_legal: !!org?.usa_formato_legal,
        usa_sobretiempo: !!org?.usa_sobretiempo,
        sobretiempo_min_umbral: normalizarUmbral(org?.sobretiempo_min_umbral)
    };
}

export async function leerConfig(ctx: Ctx) {
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const cfg = configDe(org);
    const hoy = ahoraLima().slice(0, 10);

    return {
        ...cfg,
        interruptores: INTERRUPTORES.map(i => ({
            ...i,
            activo: (cfg as any)[i.campo]
        })),
        // La pantalla no tiene por que saberse la Ley MYPE: se le manda la
        // lista de regimenes y que corresponde a cada uno.
        regimenes: REGIMENES,
        beneficios: beneficiosDe(cfg.regimen_laboral),
        // El periodo en curso y los anteriores, para que la pantalla no tenga
        // que reimplementar las cuentas de calendario.
        periodo_actual: periodoDe(hoy, cfg.frecuencia_pago, cfg.semana_empieza),
        periodos: ultimosPeriodos(hoy, cfg.frecuencia_pago, cfg.semana_empieza, 12)
    };
}

export async function guardarConfig(ctx: Ctx, body: any, autor: Autor) {
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const antes = configDe(org);

    const frecuencia = normalizarFrecuencia(body.frecuencia_pago ?? antes.frecuencia_pago);
    const semana = normalizarInicioSemana(body.semana_empieza ?? antes.semana_empieza);
    const regimen = normalizarRegimen(body.regimen_laboral ?? antes.regimen_laboral);

    // Al CAMBIAR de regimen se acomodan los interruptores que ese regimen
    // decide: encender CTS en una microempresa arma una boleta que la Ley MYPE
    // no contempla. Solo al cambiar -- si el regimen no se toco, el empleador
    // manda, porque puede pagar por encima del minimo de su regimen.
    const cambioRegimen = regimen !== antes.regimen_laboral;
    const porRegimen: Record<string, boolean> = cambioRegimen ? interruptoresDe(regimen) : {};

    const flag = (campo: string) => {
        if (body[campo] !== undefined) { return !!body[campo]; }
        if (campo in porRegimen) { return porRegimen[campo]; }
        return (antes as any)[campo];
    };

    const nuevo: ConfigPlanilla = {
        regimen_laboral: regimen,
        rmv: body.rmv === undefined ? antes.rmv : normalizarRmv(body.rmv),
        frecuencia_pago: frecuencia,
        semana_empieza: semana,
        usa_pensiones: flag('usa_pensiones'),
        usa_essalud: flag('usa_essalud'),
        usa_cts: flag('usa_cts'),
        usa_gratificacion: flag('usa_gratificacion'),
        usa_renta_quinta: flag('usa_renta_quinta'),
        usa_formato_legal: flag('usa_formato_legal'),
        usa_sobretiempo: flag('usa_sobretiempo'),
        sobretiempo_min_umbral: body.sobretiempo_min_umbral === undefined
            ? antes.sobretiempo_min_umbral
            : normalizarUmbral(body.sobretiempo_min_umbral)
    };

    await prisma.org.update({ where: { idorg: ctx.idorg }, data: nuevo as any });

    const encendidos = (c: ConfigPlanilla) =>
        INTERRUPTORES.filter(i => (c as any)[i.campo]).map(i => i.clave).join(', ') || 'ninguno';
    const frase = (c: ConfigPlanilla) =>
        `pago ${c.frecuencia_pago.toLowerCase()}` +
        (c.frecuencia_pago === 'SEMANAL' ? ` (empieza dia ${c.semana_empieza})` : '') +
        `; formalidad: ${encendidos(c)}`;

    // Guardar lo mismo no se anota: seria ruido que esconde los cambios reales
    if (frase(antes) !== frase(nuevo)) {
        const sede: any = await prisma.sede.findUnique({ where: { idsede: ctx.idsede } });
        await anotar({
            idorg: ctx.idorg, idsede_restobar: sede?.idsede_restobar ?? 0,
            entidad: 'PLANILLA', accion: 'MODIFICA',
            detalle: 'Planilla: ' + frase(antes) + ' -> ' + frase(nuevo),
            anterior: antes, nuevo
        }, autor);
    }

    return leerConfig(ctx);
}

/**
 * El periodo sobre el que hay que calcular.
 *
 * Acepta tres formas, en este orden:
 *   - `periodo` con la clave completa ('2026-03-09'): el periodo que abre ahi
 *   - `periodo` con solo el mes ('2026-03'): el mes entero, como siempre
 *   - `desde`/`hasta`: un rango libre, para mirar algo puntual
 *
 * Se resuelve contra la frecuencia de LA EMPRESA, no contra la que mande el
 * cliente: si alguien pide una semana en una empresa que paga por mes, la
 * boleta saldria cortada por un rango que la planilla despues no reconoce.
 */
export async function resolverPeriodoDeOrg(ctx: Ctx, body: any): Promise<Periodo> {
    const org: any = await prisma.org.findUnique({ where: { idorg: ctx.idorg } });
    const cfg = configDe(org);
    const pedido = String(body?.periodo || '');

    if (/^\d{4}-\d{2}-\d{2}$/.test(pedido)) {
        const p = periodoPorClave(pedido, cfg.frecuencia_pago, cfg.semana_empieza);
        if (!p) {
            throw new Invalido(
                `El ${pedido} no es el primer dia de un periodo de pago ${cfg.frecuencia_pago.toLowerCase()}.`);
        }
        return p;
    }

    if (/^\d{4}-\d{2}$/.test(pedido)) {
        return periodoDe(pedido + '-01', 'MENSUAL', cfg.semana_empieza);
    }

    // Basura NO cae en el periodo en curso. Calcular en silencio un rango
    // distinto al pedido es la forma mas cara de equivocarse: la boleta sale,
    // se paga, y nadie mira de que periodo era.
    if (pedido) {
        throw new Invalido(`"${pedido}" no es un periodo valido. Manda la fecha en que empieza (YYYY-MM-DD) o el mes (YYYY-MM).`);
    }

    const desde = String(body?.desde || '');
    const hasta = String(body?.hasta || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
        if (desde > hasta) { throw new Invalido('La fecha inicial es posterior a la final.'); }
        return { clave: desde, desde, hasta, tipo: cfg.frecuencia_pago, etiqueta: `${desde} a ${hasta}` };
    }

    // Sin nada: el periodo en curso, que es lo que se quiere ver el 99% de las veces
    return periodoDe(ahoraLima().slice(0, 10), cfg.frecuencia_pago, cfg.semana_empieza);
}
