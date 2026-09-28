// Horas extra.
//
// LA NORMA
// D.S. 007-2002-TR, arts. 10 y 12: el sobretiempo se paga con un recargo NO
// MENOR al 25% por las dos primeras horas del dia y 35% por las siguientes, y
// el valor de la hora sale de la remuneracion diaria dividida por las horas de
// la jornada.
//
// Los porcentajes son un PISO legal: se puede pagar mas, nunca menos. Van como
// constantes y no como configuracion porque en este segmento nadie paga por
// encima, y un campo mas es un campo donde equivocarse. El dia que haga falta,
// es una migracion.
//
// EL TRAMO DE 25% ES POR DIA, NO POR PERIODO
// "Las dos primeras horas" se cuentan cada dia y se reinician al siguiente.
// Acumularlas por mes daria 35% desde el tercer dia con horas extra, que es
// mas de lo que corresponde. Por eso el calculo es diario y la planilla suma
// los importes ya resueltos.

/** Piso legal del recargo por las dos primeras horas del dia (D.S. 007-2002-TR). */
export const PCT_PRIMERAS = 25;

/** Piso legal del recargo de la tercera hora en adelante. */
export const PCT_SIGUIENTES = 35;

/** Cuantos minutos de sobretiempo van al 25% antes de pasar al 35%. */
export const MIN_AL_25 = 120;

export interface Sobretiempo {
    /** Minutos fuera de la jornada que SI cuentan (ya descontado el umbral). */
    minutos: number;
    min_25: number;
    min_35: number;
    importe: number;
}

export const SIN_SOBRETIEMPO: Sobretiempo =
    Object.freeze({ minutos: 0, min_25: 0, min_35: 0, importe: 0 }) as Sobretiempo;

const dosDec = (n: number) => Math.round(n * 100) / 100;

/**
 * Minutos efectivamente trabajados en un dia, emparejando las marcas.
 *
 * Empareja cada ENTRADA con la SALIDA que le sigue. Lo que queda sin pareja se
 * ignora: una entrada sin salida no dice cuanto se trabajo, y adivinar seria
 * peor que no contarla.
 *
 * El hueco entre una salida y la siguiente entrada -- el break -- no se suma,
 * que es justamente el punto: quien sale al mediodia y vuelve de noche no
 * estuvo trabajando en el medio.
 *
 * @param marcas las del dia, ORDENADAS por hora, con `tipo` y `marcada_at`
 */
export function minutosTrabajados(marcas: any[]): number {
    let total = 0;
    let abierta: any = null;

    for (const m of marcas) {
        if (m.tipo === 'ENTRADA') {
            // Dos entradas seguidas: se queda la primera. La segunda seria una
            // marca repetida, y tomarla acortaria el turno.
            if (!abierta) { abierta = m; }
            continue;
        }

        if (m.tipo === 'SALIDA' && abierta) {
            let seg = (new Date(m.marcada_at).getTime() - new Date(abierta.marcada_at).getTime()) / 1000;
            // Un turno que cruza la medianoche da negativo por el dia
            // calendario; sumarle 24 h lo corrige.
            if (seg < 0) { seg += 86400; }
            total += seg / 60;
            abierta = null;
        }
    }

    return Math.round(total);
}

/**
 * El sobretiempo de UN dia.
 *
 * @param minTrabajados minutos que estuvo, segun las marcas
 * @param minJornada    minutos que debia estar, segun su horario
 * @param umbralMin     minutos de gracia que no cuentan como sobretiempo
 * @param valorMinuto   cuanto vale un minuto normal de esta persona
 *
 * POR QUE EL UMBRAL
 * En un restaurante la gente llega antes y se queda despues. Sin umbral, cinco
 * minutos de anticipacion todos los dias son horas extra todos los dias: el
 * local terminaria pagando la costumbre de llegar temprano.
 *
 * SIN HORARIO NO HAY SOBRETIEMPO
 * Si no se sabe cuanto debia trabajar, no se puede saber que parte fue de mas.
 * Se devuelve cero en vez de suponer ocho horas: suponer le inventaria horas
 * extra a quien todavia no tiene el horario cargado.
 */
export function sobretiempoDelDia(
    minTrabajados: number,
    minJornada: number,
    umbralMin: number,
    valorMinuto: number
): Sobretiempo {
    if (minJornada <= 0 || minTrabajados <= 0) { return SIN_SOBRETIEMPO; }

    const exceso = minTrabajados - minJornada;
    if (exceso <= Math.max(0, umbralMin)) { return SIN_SOBRETIEMPO; }

    // El umbral es una franquicia, no un escalon: pasado el limite se paga
    // TODO el exceso. Descontar el umbral tambien del pago le cobraria al
    // trabajador los minutos de gracia justo cuando dejan de ser gracia.
    const min_25 = Math.min(exceso, MIN_AL_25);
    const min_35 = exceso - min_25;

    const importe =
        min_25 * valorMinuto * (1 + PCT_PRIMERAS / 100) +
        min_35 * valorMinuto * (1 + PCT_SIGUIENTES / 100);

    // SIN redondear: el importe del dia es un parcial.
    //
    // Redondear cada dia y despues sumar arrastra el error. Con 12.50 la hora,
    // tres horas extra dan 48.125: redondeado a 48.13 cada dia, veinte dias se
    // van diez centavos por encima de lo que corresponde. Se redondea una sola
    // vez, en sumarSobretiempo, que es lo que llega a la boleta.
    return { minutos: exceso, min_25, min_35, importe };
}

/**
 * Suma el sobretiempo de varios dias y redondea UNA vez.
 *
 * Los minutos del 25% no se acumulan entre dias: cada dia trae los suyos ya
 * resueltos. Lo unico que se hace aqui es sumar y redondear al centimo.
 */
export function sumarSobretiempo(dias: Sobretiempo[]): Sobretiempo {
    const t = dias.reduce((a, d) => ({
        minutos: a.minutos + d.minutos,
        min_25: a.min_25 + d.min_25,
        min_35: a.min_35 + d.min_35,
        importe: a.importe + d.importe
    }), { minutos: 0, min_25: 0, min_35: 0, importe: 0 });

    return { ...t, importe: dosDec(t.importe) };
}

/** "2 h 30 min", para mostrarlo sin hacer cuentas mentales. */
export function minutosATexto(min: number): string {
    if (!min) { return '0 min'; }
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) { return `${m} min`; }
    return m ? `${h} h ${m} min` : `${h} h`;
}
