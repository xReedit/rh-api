"use strict";
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
exports.__esModule = true;
exports.ultimosPeriodos = exports.periodosEntre = exports.periodoPorClave = exports.periodoDe = exports.normalizarInicioSemana = exports.normalizarFrecuencia = exports.FRECUENCIAS = void 0;
exports.FRECUENCIAS = ['MENSUAL', 'QUINCENAL', 'SEMANAL', 'DIARIO'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var dia = function (f) { return Date.parse(f + 'T00:00:00Z'); };
var aFecha = function (t) { return new Date(t).toISOString().slice(0, 10); };
var sumar = function (f, n) { return aFecha(dia(f) + n * 86400000); };
/** 1 = lunes ... 7 = domingo. getUTCDay() da 0 para domingo. */
var diaSemanaIso = function (f) { return new Date(dia(f)).getUTCDay() || 7; };
var ultimoDelMes = function (anio, mes) { return new Date(Date.UTC(anio, mes, 0)).getUTCDate(); };
function normalizarFrecuencia(v) {
    var f = String(v || '').toUpperCase();
    return exports.FRECUENCIAS.includes(f) ? f : 'MENSUAL';
}
exports.normalizarFrecuencia = normalizarFrecuencia;
/** 1..7; cualquier otra cosa cae en lunes, que es lo mas comun. */
function normalizarInicioSemana(v) {
    var n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 1;
}
exports.normalizarInicioSemana = normalizarInicioSemana;
// ---------------------------------------------------------------------------
// El periodo que contiene una fecha
// ---------------------------------------------------------------------------
function etiquetaDe(tipo, desde, hasta) {
    var _a = desde.split('-').map(Number), a = _a[0], m = _a[1], d = _a[2];
    var mesTxt = MESES[m - 1];
    if (tipo === 'MENSUAL') {
        return "".concat(mesTxt, " ").concat(a);
    }
    if (tipo === 'DIARIO') {
        return "".concat(d, " de ").concat(mesTxt, " ").concat(a);
    }
    if (tipo === 'QUINCENAL') {
        return "".concat(d === 1 ? '1ra' : '2da', " quincena de ").concat(mesTxt, " ").concat(a);
    }
    // Semanal: el rango completo, porque una semana puede cruzar de mes
    var _b = hasta.split('-').map(Number), m2 = _b[1], d2 = _b[2];
    return m2 === m
        ? "".concat(d, " al ").concat(d2, " de ").concat(mesTxt)
        : "".concat(d, " de ").concat(mesTxt, " al ").concat(d2, " de ").concat(MESES[m2 - 1]);
}
/**
 * En que periodo cae esta fecha.
 *
 * Es la operacion central: de aqui salen tanto "el periodo en curso" como el
 * que corresponde a una marca cualquiera.
 */
function periodoDe(fecha, frecuencia, inicioSemana) {
    if (inicioSemana === void 0) { inicioSemana = 1; }
    var _a = fecha.split('-').map(Number), a = _a[0], m = _a[1], d = _a[2];
    var desde, hasta;
    if (frecuencia === 'DIARIO') {
        desde = fecha;
        hasta = fecha;
    }
    else if (frecuencia === 'SEMANAL') {
        // Cuantos dias hay que retroceder para llegar al dia en que arranca la
        // semana de esta empresa. El +7 evita el negativo cuando la fecha cae
        // antes del dia de inicio.
        var atras = (diaSemanaIso(fecha) - inicioSemana + 7) % 7;
        desde = sumar(fecha, -atras);
        hasta = sumar(desde, 6);
    }
    else if (frecuencia === 'QUINCENAL') {
        // La segunda quincena termina el ultimo dia del mes, sea 28, 29, 30 o
        // 31. Cortarla siempre el 30 dejaria el 31 fuera de toda planilla.
        if (d <= 15) {
            desde = "".concat(fecha.slice(0, 7), "-01");
            hasta = "".concat(fecha.slice(0, 7), "-15");
        }
        else {
            desde = "".concat(fecha.slice(0, 7), "-16");
            hasta = "".concat(fecha.slice(0, 7), "-").concat(String(ultimoDelMes(a, m)).padStart(2, '0'));
        }
    }
    else {
        desde = "".concat(fecha.slice(0, 7), "-01");
        hasta = "".concat(fecha.slice(0, 7), "-").concat(String(ultimoDelMes(a, m)).padStart(2, '0'));
    }
    return { clave: desde, desde: desde, hasta: hasta, tipo: frecuencia, etiqueta: etiquetaDe(frecuencia, desde, hasta) };
}
exports.periodoDe = periodoDe;
/** El periodo que empieza exactamente en esa clave, o null si la clave no corresponde. */
function periodoPorClave(clave, frecuencia, inicioSemana) {
    if (inicioSemana === void 0) { inicioSemana = 1; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) {
        return null;
    }
    var p = periodoDe(clave, frecuencia, inicioSemana);
    // Si la clave no es el primer dia de su periodo, quien la mando se
    // equivoco de fecha. Devolver el periodo que la contiene escondería el
    // error y la boleta saldría de otro rango.
    return p.clave === clave ? p : null;
}
exports.periodoPorClave = periodoPorClave;
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
function periodosEntre(desde, hasta, frecuencia, inicioSemana) {
    if (inicioSemana === void 0) { inicioSemana = 1; }
    var salida = [];
    var cursor = periodoDe(desde, frecuencia, inicioSemana);
    // Tope duro: un ano de diarios son 366 vueltas, cualquier cosa por encima
    // de eso es un rango mal armado y no hay que intentar resolverlo.
    var vueltas = 0;
    while (cursor.desde <= hasta && vueltas < 400) {
        salida.push(cursor);
        cursor = periodoDe(sumar(cursor.hasta, 1), frecuencia, inicioSemana);
        vueltas++;
    }
    return salida.reverse();
}
exports.periodosEntre = periodosEntre;
/**
 * Los ultimos N periodos hasta hoy, incluido el que esta en curso.
 *
 * El primero de la lista es el que corresponde cerrar ahora; el resto queda
 * disponible para corregir algo de atras.
 */
function ultimosPeriodos(hoy, frecuencia, inicioSemana, cuantos) {
    if (inicioSemana === void 0) { inicioSemana = 1; }
    if (cuantos === void 0) { cuantos = 12; }
    var actual = periodoDe(hoy, frecuencia, inicioSemana);
    var salida = [actual];
    var cursor = actual;
    for (var i = 1; i < cuantos; i++) {
        cursor = periodoDe(sumar(cursor.desde, -1), frecuencia, inicioSemana);
        salida.push(cursor);
    }
    return salida;
}
exports.ultimosPeriodos = ultimosPeriodos;
