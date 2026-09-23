// Cada cuanto se cierra la planilla.
//
// En un restaurante el pago casi nunca es mensual: se paga los viernes, o el
// 15 y el 30, o al final del dia. La planilla solo sabia de meses, asi que el
// que paga semanal no tenia forma de cerrar su semana.
//
// Todo aca es FUNCION PURA a proposito: son cuentas de calendario y se prueban
// solas, sin montar una empresa. Es tambien la parte donde un error de un dia
// se convierte en un dia de sueldo de mas o de menos para todo el personal.
//
// LA CLAVE DEL PERIODO es su primer dia ('2026-03-09'). Es lo que se guarda en
// `colaborador_boleta.periodo` y lo que identifica la boleta. Se eligio la
// fecha y no un correlativo porque se ordena sola, se lee sin traducir y no
// depende de que nadie lleve la cuenta.

export type Frecuencia = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL' | 'DIARIO';

export const FRECUENCIAS: Frecuencia[] = ['MENSUAL', 'QUINCENAL', 'SEMANAL', 'DIARIO'];

export interface Periodo {
    clave: string;      // 'YYYY-MM-DD', el primer dia
    desde: string;
    hasta: string;
    tipo: Frecuencia;
    etiqueta: string;   // como se le muestra a una persona
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dia = (f: string) => Date.parse(f + 'T00:00:00Z');
const aFecha = (t: number) => new Date(t).toISOString().slice(0, 10);
const sumar = (f: string, n: number) => aFecha(dia(f) + n * 86400000);

/** 1 = lunes ... 7 = domingo. getUTCDay() da 0 para domingo. */
const diaSemanaIso = (f: string) => new Date(dia(f)).getUTCDay() || 7;

const ultimoDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

export function normalizarFrecuencia(v: any): Frecuencia {
    const f = String(v || '').toUpperCase();
    return (FRECUENCIAS as string[]).includes(f) ? (f as Frecuencia) : 'MENSUAL';
}

/** 1..7; cualquier otra cosa cae en lunes, que es lo mas comun. */
export function normalizarInicioSemana(v: any): number {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 1;
}

// ---------------------------------------------------------------------------
// El periodo que contiene una fecha
// ---------------------------------------------------------------------------

function etiquetaDe(tipo: Frecuencia, desde: string, hasta: string): string {
    const [a, m, d] = desde.split('-').map(Number);
    const mesTxt = MESES[m - 1];

    if (tipo === 'MENSUAL') { return `${mesTxt} ${a}`; }
    if (tipo === 'DIARIO') { return `${d} de ${mesTxt} ${a}`; }
    if (tipo === 'QUINCENAL') {
        return `${d === 1 ? '1ra' : '2da'} quincena de ${mesTxt} ${a}`;
    }
    // Semanal: el rango completo, porque una semana puede cruzar de mes
    const [, m2, d2] = hasta.split('-').map(Number);
    return m2 === m
        ? `${d} al ${d2} de ${mesTxt}`
        : `${d} de ${mesTxt} al ${d2} de ${MESES[m2 - 1]}`;
}

/**
 * En que periodo cae esta fecha.
 *
 * Es la operacion central: de aqui salen tanto "el periodo en curso" como el
 * que corresponde a una marca cualquiera.
 */
export function periodoDe(fecha: string, frecuencia: Frecuencia, inicioSemana = 1): Periodo {
    const [a, m, d] = fecha.split('-').map(Number);
    let desde: string, hasta: string;

    if (frecuencia === 'DIARIO') {
        desde = fecha;
        hasta = fecha;

    } else if (frecuencia === 'SEMANAL') {
        // Cuantos dias hay que retroceder para llegar al dia en que arranca la
        // semana de esta empresa. El +7 evita el negativo cuando la fecha cae
        // antes del dia de inicio.
        const atras = (diaSemanaIso(fecha) - inicioSemana + 7) % 7;
        desde = sumar(fecha, -atras);
        hasta = sumar(desde, 6);

    } else if (frecuencia === 'QUINCENAL') {
        // La segunda quincena termina el ultimo dia del mes, sea 28, 29, 30 o
        // 31. Cortarla siempre el 30 dejaria el 31 fuera de toda planilla.
        if (d <= 15) {
            desde = `${fecha.slice(0, 7)}-01`;
            hasta = `${fecha.slice(0, 7)}-15`;
        } else {
            desde = `${fecha.slice(0, 7)}-16`;
            hasta = `${fecha.slice(0, 7)}-${String(ultimoDelMes(a, m)).padStart(2, '0')}`;
        }

    } else {
        desde = `${fecha.slice(0, 7)}-01`;
        hasta = `${fecha.slice(0, 7)}-${String(ultimoDelMes(a, m)).padStart(2, '0')}`;
    }

    return { clave: desde, desde, hasta, tipo: frecuencia, etiqueta: etiquetaDe(frecuencia, desde, hasta) };
}

/** El periodo que empieza exactamente en esa clave, o null si la clave no corresponde. */
export function periodoPorClave(clave: string, frecuencia: Frecuencia, inicioSemana = 1): Periodo | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) { return null; }
    const p = periodoDe(clave, frecuencia, inicioSemana);
    // Si la clave no es el primer dia de su periodo, quien la mando se
    // equivoco de fecha. Devolver el periodo que la contiene escondería el
    // error y la boleta saldría de otro rango.
    return p.clave === clave ? p : null;
}

// ---------------------------------------------------------------------------
// Los periodos de un tramo
// ---------------------------------------------------------------------------

/**
 * Los periodos que se solapan con un rango, del mas reciente al mas viejo.
 *
 * Es lo que llena el selector de la pantalla. Va al reves porque el que se
 * quiere cerrar es casi siempre el ultimo, y hacerlo bajar por doce meses para
 * llegar es una molestia diaria.
 */
export function periodosEntre(desde: string, hasta: string, frecuencia: Frecuencia, inicioSemana = 1): Periodo[] {
    const salida: Periodo[] = [];
    let cursor = periodoDe(desde, frecuencia, inicioSemana);

    // Tope duro: un ano de diarios son 366 vueltas, cualquier cosa por encima
    // de eso es un rango mal armado y no hay que intentar resolverlo.
    let vueltas = 0;
    while (cursor.desde <= hasta && vueltas < 400) {
        salida.push(cursor);
        cursor = periodoDe(sumar(cursor.hasta, 1), frecuencia, inicioSemana);
        vueltas++;
    }
    return salida.reverse();
}

/**
 * Los ultimos N periodos hasta hoy, incluido el que esta en curso.
 *
 * El primero de la lista es el que corresponde cerrar ahora; el resto queda
 * disponible para corregir algo de atras.
 */
export function ultimosPeriodos(hoy: string, frecuencia: Frecuencia, inicioSemana = 1, cuantos = 12): Periodo[] {
    const actual = periodoDe(hoy, frecuencia, inicioSemana);
    const salida: Periodo[] = [actual];
    let cursor = actual;

    for (let i = 1; i < cuantos; i++) {
        cursor = periodoDe(sumar(cursor.desde, -1), frecuencia, inicioSemana);
        salida.push(cursor);
    }
    return salida;
}
