// Calendario del modulo de Asistencia.
//
// Todas las funciones son PURAS y trabajan sobre STRINGS 'YYYY-MM-DD HH:mm:ss'
// en hora de Lima. A proposito: si usaran Date, el resultado dependeria de la
// zona horaria del proceso de Node (UTC en la mayoria de los despliegues) y una
// marca de las 23:50 en Lima se guardaria con la fecha del dia siguiente.
//
// El POS manda la hora ya en Lima; aqui no se convierte nada, solo se calcula.

/** 'YYYY-MM-DD HH:mm:ss' -> segundos desde epoch, tratando el string como UTC. */
function aSegundos(momento: string): number {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(momento.trim());
    if (!m) { throw new Error(`momento invalido: ${momento}`); }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000;
}

/** segundos desde epoch -> 'YYYY-MM-DD' */
function aFecha(segundos: number): string {
    return new Date(segundos * 1000).toISOString().slice(0, 10);
}

/**
 * Ahora mismo en Lima, como 'YYYY-MM-DD HH:mm:ss'.
 *
 * El proceso de Node casi siempre corre en UTC, asi que `new Date()` daria una
 * marca 5 horas adelantada y una entrada de las 20:00 quedaria registrada al
 * dia siguiente. Intl hace la conversion sin traer ninguna dependencia.
 */
export function ahoraLima(base?: Date): string {
    const d = base || new Date();
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d).reduce((a: any, x) => (a[x.type] = x.value, a), {});

    // en-CA da hour "24" a medianoche en algunos runtimes; se normaliza a "00"
    const hora = p.hour === '24' ? '00' : p.hour;
    return `${p.year}-${p.month}-${p.day} ${hora}:${p.minute}:${p.second}`;
}

/**
 * Convierte 'YYYY-MM-DD HH:mm:ss' de Lima en el Date que Prisma debe escribir
 * para que la columna DATETIME guarde EXACTAMENTE esos digitos.
 *
 * Prisma convierte todo Date a UTC antes de escribir. Marcando el string como
 * UTC, esa conversion es la identidad y en la base queda la hora de Lima, que
 * es la que usa el resto del sistema legacy.
 */
export function fechaSql(momentoLima: string): Date {
    return new Date(momentoLima.replace(' ', 'T') + 'Z');
}

/**
 * Date de Prisma -> 'YYYY-MM-DD HH:mm:ss' de Lima.
 *
 * Es el inverso de fechaSql. Las columnas DATETIME guardan hora de Lima, y
 * Prisma las devuelve como si fueran UTC; si ese Date se manda tal cual en el
 * JSON sale con una "Z" mentirosa y el navegador lo corre por su propio huso:
 * una senal de hace 2 minutos aparece como de hace 5 horas.
 *
 * Toda fecha que salga de esta API hacia una pantalla pasa por aqui.
 */
export function aTextoLima(d: Date | string | null | undefined): string | null {
    if (!d) { return null; }
    const iso = (d instanceof Date) ? d.toISOString() : String(d);
    return iso.slice(0, 19).replace('T', ' ');
}

/** Minutos transcurridos desde un momento de Lima hasta ahora. */
export function minutosDesde(momentoLima: string | null | undefined): number | null {
    if (!momentoLima) { return null; }
    const ms = Date.parse(momentoLima.replace(' ', 'T') + 'Z') ;
    if (isNaN(ms)) { return null; }
    return Math.floor((Date.parse(ahoraLima().replace(' ', 'T') + 'Z') - ms) / 60000);
}

/** 'HH:MM' o 'HH:MM:SS' -> segundos desde medianoche */
function horaEnSegundos(hora: string): number {
    const p = hora.split(':');
    return (+p[0]) * 3600 + (+(p[1] || 0)) * 60 + (+(p[2] || 0));
}

/**
 * Dia operativo al que pertenece un instante.
 *
 * El local cierra pasada la medianoche: el turno del 14 termina a la 01:30 del
 * 15. Con fecha calendario esa salida caeria en otro dia y el turno quedaria
 * eternamente incompleto. Toda marca anterior a la hora de corte pertenece al
 * dia operativo ANTERIOR.
 *
 * @param horaCorte 'HH:MM:SS' de rrhh.org.asis_hora_corte
 * @param momento   'YYYY-MM-DD HH:mm:ss' en hora de Lima
 */
export function diaOperativo(horaCorte: string, momento: string): string {
    return aFecha(aSegundos(momento) - horaEnSegundos(horaCorte));
}

/**
 * Minutos de tardanza de una ENTRADA. Solo aplica a ENTRADA.
 * null = ese dia no tenia horario, asi que no hay tardanza que calcular.
 */
export function tardanzaMin(
    horaEsperada: string | null,
    marcadaAt: string,
    toleranciaMin: number
): number | null {
    if (!horaEsperada) { return null; }

    const dia = marcadaAt.slice(0, 10);
    const real = aSegundos(marcadaAt);
    const esperado = aSegundos(`${dia} ${horaEsperada.slice(0, 5)}:00`);

    const min = Math.floor((real - esperado) / 60) - toleranciaMin;
    return min > 0 ? min : 0;
}

/**
 * Horas trabajadas entre dos marcas del mismo dia operativo.
 *
 * Un turno 18:00 -> 01:30 da un delta negativo porque la salida cae en el dia
 * calendario siguiente. Sumarle 24 h lo corrige: 7.5, no -16.5.
 */
export function horasTurno(entradaAt: string, salidaAt: string): number {
    let seg = aSegundos(salidaAt) - aSegundos(entradaAt);
    if (seg < 0) { seg += 86400; }
    return Math.round((seg / 3600) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Horario semanal
// ---------------------------------------------------------------------------

export const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const;

export interface TramoDia { e: string; s: string }

/**
 * El horario de la semana. Cada dia tiene una LISTA de tramos.
 *
 * POR QUE UNA LISTA Y NO UN SOLO PAR
 * El turno partido es el normal en un restaurante: se abre al mediodia, se
 * cierra a media tarde y se vuelve a abrir de noche. Con un solo par
 * entrada/salida eso no se podia escribir: 11:00-15:00 y 18:00-23:00 habia que
 * cargarlo como 11:00-23:00, y entonces el sistema contaba 12 horas en vez de
 * 9 -- las tres horas que la persona estuvo en su casa figuraban trabajadas.
 *
 * COMPATIBILIDAD
 * Lo ya guardado tiene la forma vieja ({e,s} suelto). No hay migracion de esos
 * datos: `tramosDe` entiende las dos formas al leer, y `validarHorario`
 * normaliza a lista al guardar. Un horario viejo se convierte solo la proxima
 * vez que alguien lo edite.
 */
export type HorarioSemanal = { [dia: string]: TramoDia | TramoDia[] };

/** Cuantos tramos se aceptan por dia. Dos son lo normal; tres ya es raro. */
export const TRAMOS_MAX = 4;

/** Dia de la semana ('lun', 'mar', ...) de una fecha 'YYYY-MM-DD'. */
export function diaSemana(fecha: string): string {
    return DIAS[new Date(`${fecha}T00:00:00Z`).getUTCDay()];
}

/**
 * Los tramos de ese dia, siempre como lista y en orden.
 *
 * Es el unico lugar que sabe que existen dos formas guardadas. Todo lo demas
 * pregunta por aqui y recibe siempre una lista.
 */
export function tramosDe(horario: HorarioSemanal | null, fecha: string): TramoDia[] {
    if (!horario) { return []; }

    const t = horario[diaSemana(fecha)];
    if (!t) { return []; }

    const lista = Array.isArray(t) ? t : [t];
    return lista.filter(x => x && x.e && x.s);
}

/**
 * Hora de entrada esperada, o null si no trabaja / no tiene horario.
 *
 * Con turno partido hay mas de una entrada esperada en el dia. Si se pasa la
 * hora en que la persona MARCO, se devuelve la del tramo al que evidentemente
 * venia: el de entrada mas cercana. Sin eso, quien entra a las 18:00 de un
 * turno 11-15 / 18-23 aparecia con siete horas de tardanza.
 *
 * @param marcadaAt 'YYYY-MM-DD HH:mm:ss' opcional. Sin esto se devuelve la
 *                  primera entrada del dia, que es lo correcto para un turno
 *                  corrido y lo que hacian todos los llamadores de antes.
 */
export function horaEsperada(
    horario: HorarioSemanal | null,
    fecha: string,
    marcadaAt?: string
): string | null {
    const tramos = tramosDe(horario, fecha);
    if (!tramos.length) { return null; }
    if (!marcadaAt || tramos.length === 1) { return tramos[0].e; }

    const real = horaEnSegundos(marcadaAt.slice(11));
    let mejor = tramos[0];
    let menor = Infinity;

    for (const t of tramos) {
        // Distancia circular: un tramo que empieza 23:00 esta cerca de las
        // 00:30, no a 22 horas.
        const d = Math.abs(real - horaEnSegundos(t.e));
        const dist = Math.min(d, 86400 - d);
        if (dist < menor) { menor = dist; mejor = t; }
    }
    return mejor.e;
}

/**
 * Horas que la persona DEBE estar ese dia, sumando los tramos.
 *
 * Suma los tramos en vez de restar la ultima salida menos la primera entrada:
 * asi el hueco del turno partido -- que es cuando la persona se va -- no cuenta
 * como trabajado. Es la base contra la que se miden las horas extra.
 */
export function horasJornada(horario: HorarioSemanal | null, fecha: string): number {
    const tramos = tramosDe(horario, fecha);
    if (!tramos.length) { return 0; }

    let seg = 0;
    for (const t of tramos) {
        let d = horaEnSegundos(t.s) - horaEnSegundos(t.e);
        if (d < 0) { d += 86400; }   // cruza la medianoche
        seg += d;
    }
    return Math.round((seg / 3600) * 100) / 100;
}

/**
 * Valida el JSON del horario antes de guardarlo. Devuelve el objeto saneado.
 * Rechazar aqui evita que un horario corrupto haga que nadie tenga tardanzas.
 */
export function validarHorario(entrada: any): HorarioSemanal | null {
    if (entrada === null || entrada === undefined || entrada === '') { return null; }

    const obj = (typeof entrada === 'string') ? JSON.parse(entrada) : entrada;
    if (typeof obj !== 'object' || Array.isArray(obj)) { throw new Error('horario: se esperaba un objeto'); }

    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    const salida: HorarioSemanal = {};

    for (const dia of Object.keys(obj)) {
        if (!DIAS.includes(dia as any)) { throw new Error(`horario: dia invalido "${dia}"`); }

        const crudo = obj[dia];
        if (!crudo) { continue; }   // dia sin tramos = no trabaja

        // Se acepta la forma vieja (un tramo suelto) y la nueva (lista).
        const lista = Array.isArray(crudo) ? crudo : [crudo];
        if (!lista.length) { continue; }
        if (lista.length > TRAMOS_MAX) {
            throw new Error(`horario: ${dia} tiene ${lista.length} tramos, el maximo es ${TRAMOS_MAX}`);
        }

        const tramos: TramoDia[] = [];
        for (const t of lista) {
            if (!t || typeof t !== 'object') { throw new Error(`horario: ${dia} sin tramo`); }
            if (!hhmm.test(t.e)) { throw new Error(`horario: ${dia} entrada invalida "${t.e}"`); }
            if (!hhmm.test(t.s)) { throw new Error(`horario: ${dia} salida invalida "${t.s}"`); }
            // e === s seria un turno de 0 h o de 24 h: ambiguo, se rechaza.
            if (t.e === t.s) { throw new Error(`horario: ${dia} entrada y salida iguales`); }
            tramos.push({ e: t.e, s: t.s });
        }

        // Los tramos van en orden y NO se pueden pisar.
        //
        // Dos tramos superpuestos no son un turno partido, son un error de
        // carga -- y uno que despues no se ve: las horas del solape se
        // contarian dos veces en la jornada esperada y la persona apareceria
        // debiendo horas que nunca dejo de trabajar.
        //
        // El ultimo tramo puede cruzar la medianoche (18:00-01:30) y por eso
        // queda fuera de la comprobacion de orden.
        for (let i = 1; i < tramos.length; i++) {
            const previo = tramos[i - 1];
            if (previo.s <= previo.e) {
                throw new Error(`horario: ${dia} solo el ultimo tramo puede pasar la medianoche`);
            }
            if (tramos[i].e < previo.s) {
                throw new Error(
                    `horario: ${dia} el tramo ${tramos[i].e}-${tramos[i].s} se pisa con ${previo.e}-${previo.s}`);
            }
        }

        salida[dia] = tramos;
    }

    // Un objeto vacio es "no trabaja ningun dia"; se guarda como NULL (sin horario).
    return Object.keys(salida).length ? salida : null;
}

// ---------------------------------------------------------------------------
// Marcas de un dia
// ---------------------------------------------------------------------------

export interface DiaMarcas {
    /** La PRIMERA entrada del dia: es la que dice a que hora llego. */
    ENTRADA: any | null;
    /** La ULTIMA salida del dia: es la que dice a que hora se fue. */
    SALIDA: any | null;
    /** Todas las entradas, en orden. Un turno partido tiene mas de una. */
    entradas: any[];
    /** TODAS las marcas del dia, en orden. Con esto se emparejan los turnos
     *  para saber cuanto se trabajo de verdad (ver asistencia.sobretiempo). */
    todas: any[];
    /** Tardanza del dia: la suma de la de cada entrada. */
    tardanza_min: number;
}

/** Un dia sin ninguna marca. Congelado: lo comparten todos los llamadores. */
export const SIN_MARCAS: DiaMarcas = Object.freeze(
    { ENTRADA: null, SALIDA: null, entradas: [], todas: [], tardanza_min: 0 }) as DiaMarcas;

/**
 * Agrupa las marcas por persona y dia.
 *
 * POR QUE NO ALCANZA CON GUARDAR LA ULTIMA DE CADA TIPO
 * Antes esto era `idx[m.tipo] = m`, que se queda con la ultima. Con turno
 * corrido da igual -- hay una entrada y una salida -- pero con turno partido
 * hay dos de cada una, y entonces:
 *   - la ENTRADA del dia pasaba a ser la de las 18:00, no la de las 11:00;
 *   - la tardanza del dia era solo la del segundo tramo, y la del primero
 *     desaparecia de la planilla.
 *
 * Aqui se guarda la primera entrada, la ultima salida, y la tardanza SUMADA.
 * Con un solo tramo el resultado es identico al de antes.
 *
 * @param diaDe como sacar el dia operativo 'YYYY-MM-DD' de una marca
 */
export function indexarMarcas(
    marcas: any[],
    diaDe: (m: any) => string
): Map<string, DiaMarcas> {
    const idx = new Map<string, DiaMarcas>();

    for (const m of marcas) {
        const k = `${m.idcolaborador}|${diaDe(m)}`;
        let d = idx.get(k);
        if (!d) {
            d = { ENTRADA: null, SALIDA: null, entradas: [], todas: [], tardanza_min: 0 };
            idx.set(k, d);
        }

        d.todas.push(m);

        if (m.tipo === 'ENTRADA') {
            d.entradas.push(m);
            if (!d.ENTRADA) { d.ENTRADA = m; }        // la primera manda
            d.tardanza_min += Math.max(0, m.tardanza_min || 0);
        } else if (m.tipo === 'SALIDA') {
            d.SALIDA = m;                              // la ultima manda
        }
    }

    return idx;
}
