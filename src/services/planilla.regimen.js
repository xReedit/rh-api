"use strict";
// Que beneficios corresponden segun el regimen laboral de la empresa.
//
// LA NORMA
// TUO de la Ley MYPE (D.S. 013-2013-PRODUCE). Los beneficios de la micro y la
// pequena empresa NO son una eleccion del empleador: son los que la ley fija
// para ese regimen.
//
//   MICROEMPRESA    15 dias de vacaciones. SIN CTS. SIN gratificaciones.
//                   Salud por el SIS, no por EsSalud.
//   PEQUENA EMPRESA 15 dias de vacaciones. CTS de 15 remuneraciones diarias
//                   por ano. MEDIA remuneracion de gratificacion. EsSalud si.
//   GENERAL         30 dias de vacaciones. CTS y gratificaciones completas.
//
// POR QUE ESTO EXISTE
// Antes los interruptores de la planilla se marcaban a mano, uno por uno. Un
// microempresario podia encender CTS y gratificaciones sin que nada se lo
// impidiera, y armar una boleta que su regimen no contempla. Preguntar el
// regimen -- un dato que el dueno tiene en su ficha REMYPE -- deja los
// interruptores bien puestos de una sola vez.
//
// NO BLOQUEA, ORIENTA
// Al elegir el regimen se ACOMODAN los interruptores. Despues el empleador
// puede volver a tocarlos: puede pagar por encima del minimo de su regimen, y
// eso es legal. Lo que no puede es pagar por debajo, y para eso esta el aviso.
exports.__esModule = true;
exports.debajoDelMinimo = exports.rmvProporcional = exports.normalizarRmv = exports.RMV_POR_DEFECTO = exports.interruptoresDe = exports.beneficiosDe = exports.normalizarRegimen = exports.REGIMENES = void 0;
exports.REGIMENES = [
    {
        clave: 'GENERAL',
        titulo: 'Regimen general',
        ayuda: 'El comun. Vacaciones de 30 dias, CTS y gratificaciones completas.'
    },
    {
        clave: 'PEQUENA',
        titulo: 'Pequena empresa (MYPE)',
        ayuda: 'Hasta 1700 UIT de ventas al ano. Vacaciones de 15 dias, media gratificacion y CTS reducida. Requiere estar inscrito en el REMYPE.'
    },
    {
        clave: 'MICRO',
        titulo: 'Microempresa (MYPE)',
        ayuda: 'Hasta 150 UIT de ventas al ano. Vacaciones de 15 dias, SIN CTS y SIN gratificaciones. Salud por el SIS. Requiere estar inscrito en el REMYPE.'
    }
];
var BENEFICIOS = {
    GENERAL: { vacaciones_dias: 30, cts: true, gratificacion: true, gratificacion_factor: 1, essalud: true },
    PEQUENA: { vacaciones_dias: 15, cts: true, gratificacion: true, gratificacion_factor: 0.5, essalud: true },
    MICRO: { vacaciones_dias: 15, cts: false, gratificacion: false, gratificacion_factor: 0, essalud: false }
};
function normalizarRegimen(v) {
    var r = String(v || '').toUpperCase();
    return (r === 'MICRO' || r === 'PEQUENA') ? r : 'GENERAL';
}
exports.normalizarRegimen = normalizarRegimen;
function beneficiosDe(regimen) {
    return BENEFICIOS[normalizarRegimen(regimen)];
}
exports.beneficiosDe = beneficiosDe;
/**
 * Los interruptores que corresponden a un regimen.
 *
 * Se devuelve solo lo que el regimen DECIDE. `usa_pensiones`,
 * `usa_renta_quinta` y `usa_formato_legal` no dependen del regimen -- valen
 * para todos -- asi que no se tocan: el empleador los deja como los tenia.
 */
function interruptoresDe(regimen) {
    var b = beneficiosDe(regimen);
    return {
        usa_cts: b.cts,
        usa_gratificacion: b.gratificacion,
        usa_essalud: b.essalud
    };
}
exports.interruptoresDe = interruptoresDe;
// ---------------------------------------------------------------------------
// Remuneracion minima
// ---------------------------------------------------------------------------
/**
 * La RMV por defecto: S/ 1,130 desde el 01/01/2025 (D.S. 006-2024-TR).
 *
 * Es solo el valor inicial de la columna. El numero que manda es el que tenga
 * cargado cada empresa, porque esto cambia por decreto y no se puede depender
 * de un despliegue para reflejarlo.
 */
exports.RMV_POR_DEFECTO = 1130;
function normalizarRmv(v) {
    var n = Number(v);
    // Un cero o un negativo apagarian el aviso sin que nadie se entere. Ante un
    // valor imposible se vuelve al conocido.
    if (!Number.isFinite(n) || n <= 0) {
        return exports.RMV_POR_DEFECTO;
    }
    return Math.round(n * 100) / 100;
}
exports.normalizarRmv = normalizarRmv;
/** Jornada completa en horas. Por debajo de esto, el minimo es proporcional. */
var JORNADA_COMPLETA_H = 8;
/**
 * El minimo que corresponde a una jornada.
 *
 * La RMV esta fijada para la jornada ordinaria completa. Quien trabaja menos
 * horas tiene un minimo proporcional; quien trabaja mas no tiene un minimo
 * mayor -- las horas de mas se pagan como sobretiempo, no subiendo el piso.
 * De ahi el tope en 1.
 */
function rmvProporcional(rmv, horasDia) {
    var h = Number(horasDia);
    var factor = Number.isFinite(h) && h > 0 ? Math.min(1, h / JORNADA_COMPLETA_H) : 1;
    return Math.round(normalizarRmv(rmv) * factor * 100) / 100;
}
exports.rmvProporcional = rmvProporcional;
/**
 * Si un sueldo queda por debajo del minimo que le corresponde.
 *
 * @param sueldoMensual el equivalente mensual de lo que cobra
 * @param horasDia      las horas de su jornada
 *
 * Devuelve null si esta bien, o el minimo que le corresponde si esta por
 * debajo. Se avisa, no se bloquea: el sistema no puede saber si un caso raro
 * es un error de carga o una situacion legitima, y frenar la planilla entera
 * por una duda seria peor que mostrarla con una advertencia.
 */
function debajoDelMinimo(sueldoMensual, horasDia, rmv) {
    var minimo = rmvProporcional(rmv, horasDia);
    // Un centimo de margen: con sueldos redondos y jornadas partidas, la
    // proporcion puede dar 565.0000001 y no tiene sentido avisar por eso.
    return sueldoMensual + 0.01 < minimo ? minimo : null;
}
exports.debajoDelMinimo = debajoDelMinimo;
