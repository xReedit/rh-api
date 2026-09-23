// Resuelve la pregunta mas basica del modulo: esta persona, este dia, trabaja?
//
// Parece trivial y no lo es. Compiten cinco fuentes:
//   - el horario semanal de la persona        (regla)
//   - los dias que el local cierra             (regla de la sede)
//   - los feriados                             (calendario)
//   - las excepciones de la sede               ("este lunes abrimos")
//   - las excepciones de la persona            ("Juan viene en su dia libre")
//
// Todo es una FUNCION PURA a proposito: recibe los datos ya leidos y no toca la
// base. Asi se puede probar cada combinacion sin montar un tenant, que es la
// unica forma de tener confianza en algo que despues decide cuanto se le paga a
// alguien.

import { horaEsperada, diaSemana, HorarioSemanal } from './asistencia.calendario';

export type Origen =
    | 'EXCEPCION_PERSONA'   // "Juan trabaja / descansa este dia" -- gana siempre
    | 'DESCANSO_SUSTITUTO'  // es el dia al que corrio su descanso
    | 'EXCEPCION_SEDE'      // "el local abre / cierra este dia"
    | 'FERIADO'
    | 'CIERRE_SEDE'         // dia fijo de cierre semanal
    | 'HORARIO';            // su horario semanal, el caso normal

export type Compensacion = 'SUSTITUTORIO' | 'RECARGO';

/**
 * Por que no vino. Decide si el dia se paga.
 *
 * NORMAL no es una ausencia justificada: es "este dia no trabaja" a secas (el
 * local cerro, se cambio el descanso). Las otras cuatro si son ausencias de la
 * persona, y solo PERMISO_SIN_GOCE se descuenta.
 */
export type Categoria = 'NORMAL' | 'VACACIONES' | 'LICENCIA' | 'DESCANSO_MEDICO' | 'PERMISO_SIN_GOCE';

/** Las que el empleador paga igual: no generan descuento por dia no trabajado. */
export const CATEGORIAS_PAGADAS: Categoria[] = ['VACACIONES', 'LICENCIA', 'DESCANSO_MEDICO'];

export interface Excepcion {
    idcolaborador: number;          // 0 = toda la sede
    fecha: string;                  // 'YYYY-MM-DD'
    tipo: 'LABORABLE' | 'NO_LABORABLE';
    motivo: string;
    compensacion: Compensacion | null;
    fecha_sustituto: string | null;
    recargo_pct: number;
    categoria?: Categoria;
}

/**
 * Lo que la sede decidio UNA VEZ, para no tener que decidirlo cada dia.
 *
 * Es opcional y por omision reproduce el comportamiento anterior (el feriado
 * no se trabaja): una sede que todavia no configuro nada no cambia de
 * conducta de golpe.
 */
export interface Politica {
    /** El local abre los feriados. La mayoria de restaurantes si: la gente sale a comer. */
    feriado_abre: boolean;
    /** Recargo % por trabajar un feriado. 0 = se paga como cualquier dia. */
    feriado_recargo_pct: number;
}

const SIN_POLITICA: Politica = { feriado_abre: false, feriado_recargo_pct: 0 };

export interface Entrada {
    fecha: string;
    horario_semanal: HorarioSemanal | null;
    tolerancia_min: number;
    excepciones: Excepcion[];       // de la persona Y de la sede, mezcladas
    feriados: Map<string, string>;  // fecha -> descripcion
    dias_cierre: string[];          // ['lun','mar'] -- dias fijos que el local no abre
    politica?: Politica;
}

export interface DiaLaboral {
    labora: boolean;
    origen: Origen;
    motivo: string;
    hora_esperada: string | null;

    /** Trabaja un dia en el que, por la regla, le tocaba descansar. */
    es_descanso_trabajado: boolean;
    compensacion: Compensacion | null;
    recargo_pct: number | null;
    fecha_sustituto: string | null;

    feriado: string | null;

    /** Por que no vino, cuando la ausencia esta justificada. */
    categoria: Categoria;

    /**
     * Recargo % por trabajar un feriado, cuando el local abre y esta persona
     * trabaja. Es DISTINTO de `es_descanso_trabajado`: aquel es un dia extra
     * sobre los que le tocaban; este es un dia que ya le tocaba pero cae en
     * feriado. Pueden darse los dos a la vez y son dos lineas de la boleta.
     */
    recargo_feriado_pct: number | null;
}

/**
 * Que dice la REGLA (sin mirar las excepciones de la persona).
 *
 * Se calcula aparte porque es lo que define si un dia trabajado merece
 * compensacion: si por la regla le tocaba descansar y vino igual, hay que
 * pagarle doble o correrle el descanso.
 */
function porLaRegla(e: Entrada): { labora: boolean; origen: Origen; motivo: string } {
    const pol = e.politica || SIN_POLITICA;
    const feriado = e.feriados.get(e.fecha);

    // La excepcion de la SEDE le gana al feriado y al cierre fijo: es
    // justamente lo que se usa para abrir un feriado ("Fiestas Patrias").
    const deSede = e.excepciones.find(x => x.idcolaborador === 0 && x.fecha === e.fecha);
    if (deSede) {
        // Cerrar alcanza a todos: si el local no abre, nadie trabaja.
        if (deSede.tipo === 'NO_LABORABLE') {
            return { labora: false, origen: 'EXCEPCION_SEDE', motivo: deSede.motivo };
        }
        // Abrir NO convoca a nadie. Que el local abra habilita el dia, pero
        // quien trabaja sigue saliendo del horario de cada uno: al que le toca
        // descansar hay que agregarlo a mano, y por eso le corresponde
        // compensacion. Si abrir convocara a todos, nadie cobraria el recargo.
        const esperadaSede = horaEsperada(e.horario_semanal, e.fecha);
        return esperadaSede
            ? { labora: true, origen: 'EXCEPCION_SEDE', motivo: deSede.motivo }
            : { labora: false, origen: 'HORARIO', motivo: 'Dia libre' };
    }

    // Si el local abre los feriados, el feriado deja de decidir: el dia sigue
    // su curso normal (cierre semanal, horario de cada uno) y el recargo se
    // resuelve aparte. Esto es lo que evita tener que "abrir" a mano cada
    // feriado del ano en un restaurante que trabaja siempre.
    if (feriado && !pol.feriado_abre) {
        return { labora: false, origen: 'FERIADO', motivo: feriado };
    }

    if (e.dias_cierre.includes(diaSemana(e.fecha))) {
        return { labora: false, origen: 'CIERRE_SEDE', motivo: 'El local no abre este dia' };
    }

    const esperada = horaEsperada(e.horario_semanal, e.fecha);
    return {
        labora: !!esperada,
        origen: 'HORARIO',
        motivo: esperada ? '' : (e.horario_semanal ? 'Dia libre' : 'Sin horario asignado')
    };
}

/**
 * El recargo de feriado se aplica al final y sobre CUALQUIER camino: da igual
 * si la persona vino por su horario, porque el local abrio el dia o porque se
 * le cargo una excepcion. Si trabaja y el dia es feriado, corresponde.
 */
function conRecargoFeriado(d: DiaLaboral, e: Entrada): DiaLaboral {
    const pol = e.politica || SIN_POLITICA;
    // No se mira `feriado_abre`: da igual QUE hizo laborable el dia -- el
    // default del ano, una excepcion de sede o una de la persona. Si es feriado
    // y esta trabajando, el recargo corresponde.
    if (!d.labora || !d.feriado || pol.feriado_recargo_pct <= 0) { return d; }
    return { ...d, recargo_feriado_pct: pol.feriado_recargo_pct };
}

export function resolverDia(e: Entrada): DiaLaboral {
    return conRecargoFeriado(resolverDiaBase(e), e);
}

function resolverDiaBase(e: Entrada): DiaLaboral {
    const esperada = horaEsperada(e.horario_semanal, e.fecha);
    const feriado = e.feriados.get(e.fecha) || null;
    const regla = porLaRegla(e);

    const base: DiaLaboral = {
        labora: regla.labora,
        origen: regla.origen,
        motivo: regla.motivo,
        hora_esperada: regla.labora ? esperada : null,
        es_descanso_trabajado: false,
        compensacion: null,
        recargo_pct: null,
        fecha_sustituto: null,
        feriado,
        categoria: 'NORMAL',
        recargo_feriado_pct: null
    };

    // --- 1. Excepcion propia de la persona: gana sobre todo lo demas ---
    const propia = e.excepciones.find(x => x.idcolaborador !== 0 && x.fecha === e.fecha);
    if (propia) {
        const trabaja = propia.tipo === 'LABORABLE';
        return {
            ...base,
            labora: trabaja,
            origen: 'EXCEPCION_PERSONA',
            motivo: propia.motivo,
            // Si la regla decia que NO trabajaba y vino igual, corresponde
            // compensacion. Si la regla ya decia que trabajaba, no: es un dia
            // normal y la excepcion solo esta documentando algo.
            es_descanso_trabajado: trabaja && !regla.labora,
            compensacion: trabaja && !regla.labora ? propia.compensacion : null,
            recargo_pct: trabaja && !regla.labora && propia.compensacion === 'RECARGO'
                ? propia.recargo_pct : null,
            fecha_sustituto: trabaja && !regla.labora ? propia.fecha_sustituto : null,
            // Sin horario asignado no hay hora esperada aunque venga a trabajar
            hora_esperada: trabaja ? esperada : null,
            // La categoria describe una AUSENCIA. Si vino a trabajar no aplica,
            // por mas que la fila diga 'VACACIONES' de una carga anterior.
            categoria: trabaja ? 'NORMAL' : (propia.categoria || 'NORMAL')
        };
    }

    // --- 2. Es el dia al que corrio su descanso ---
    // Se deriva de fecha_sustituto en vez de exigir una segunda fila: con dos
    // filas podrian quedar desparejas y la persona perderia su descanso.
    const corrido = e.excepciones.find(
        x => x.idcolaborador !== 0 && x.compensacion === 'SUSTITUTORIO' && x.fecha_sustituto === e.fecha
    );
    if (corrido) {
        return {
            ...base,
            labora: false,
            origen: 'DESCANSO_SUSTITUTO',
            motivo: `Descanso movido desde el ${corrido.fecha}`,
            hora_esperada: null
        };
    }

    return base;
}

/**
 * Cuantos dias de descanso trabajados hay en un rango, separados por como se
 * compensan. Es la linea que despues entra a la boleta.
 */
export function resumenDescansosTrabajados(dias: DiaLaboral[]) {
    const trabajados = dias.filter(d => d.es_descanso_trabajado);
    return {
        total: trabajados.length,
        con_sustitutorio: trabajados.filter(d => d.compensacion === 'SUSTITUTORIO').length,
        con_recargo: trabajados.filter(d => d.compensacion === 'RECARGO').length,
        // Sin compensacion elegida: es un error de carga que hay que mostrar,
        // no un caso valido. La ley obliga a una de las dos salidas.
        sin_definir: trabajados.filter(d => !d.compensacion).length
    };
}
