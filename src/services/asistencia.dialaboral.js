"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.resumenDescansosTrabajados = exports.resolverDia = exports.CATEGORIAS_PAGADAS = void 0;
var asistencia_calendario_1 = require("./asistencia.calendario");
/** Las que el empleador paga igual: no generan descuento por dia no trabajado. */
exports.CATEGORIAS_PAGADAS = ['VACACIONES', 'LICENCIA', 'DESCANSO_MEDICO'];
var SIN_POLITICA = { feriado_abre: false, feriado_recargo_pct: 0 };
/**
 * Que dice la REGLA (sin mirar las excepciones de la persona).
 *
 * Se calcula aparte porque es lo que define si un dia trabajado merece
 * compensacion: si por la regla le tocaba descansar y vino igual, hay que
 * pagarle doble o correrle el descanso.
 */
function porLaRegla(e) {
    var pol = e.politica || SIN_POLITICA;
    var feriado = e.feriados.get(e.fecha);
    // La excepcion de la SEDE le gana al feriado y al cierre fijo: es
    // justamente lo que se usa para abrir un feriado ("Fiestas Patrias").
    var deSede = e.excepciones.find(function (x) { return x.idcolaborador === 0 && x.fecha === e.fecha; });
    if (deSede) {
        // Cerrar alcanza a todos: si el local no abre, nadie trabaja.
        if (deSede.tipo === 'NO_LABORABLE') {
            return { labora: false, origen: 'EXCEPCION_SEDE', motivo: deSede.motivo };
        }
        // Abrir NO convoca a nadie. Que el local abra habilita el dia, pero
        // quien trabaja sigue saliendo del horario de cada uno: al que le toca
        // descansar hay que agregarlo a mano, y por eso le corresponde
        // compensacion. Si abrir convocara a todos, nadie cobraria el recargo.
        var esperadaSede = (0, asistencia_calendario_1.horaEsperada)(e.horario_semanal, e.fecha);
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
    if (e.dias_cierre.includes((0, asistencia_calendario_1.diaSemana)(e.fecha))) {
        return { labora: false, origen: 'CIERRE_SEDE', motivo: 'El local no abre este dia' };
    }
    var esperada = (0, asistencia_calendario_1.horaEsperada)(e.horario_semanal, e.fecha);
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
function conRecargoFeriado(d, e) {
    var pol = e.politica || SIN_POLITICA;
    // No se mira `feriado_abre`: da igual QUE hizo laborable el dia -- el
    // default del ano, una excepcion de sede o una de la persona. Si es feriado
    // y esta trabajando, el recargo corresponde.
    if (!d.labora || !d.feriado || pol.feriado_recargo_pct <= 0) {
        return d;
    }
    return __assign(__assign({}, d), { recargo_feriado_pct: pol.feriado_recargo_pct });
}
function resolverDia(e) {
    return conRecargoFeriado(resolverDiaBase(e), e);
}
exports.resolverDia = resolverDia;
function resolverDiaBase(e) {
    var esperada = (0, asistencia_calendario_1.horaEsperada)(e.horario_semanal, e.fecha);
    var feriado = e.feriados.get(e.fecha) || null;
    var regla = porLaRegla(e);
    var base = {
        labora: regla.labora,
        origen: regla.origen,
        motivo: regla.motivo,
        hora_esperada: regla.labora ? esperada : null,
        es_descanso_trabajado: false,
        compensacion: null,
        recargo_pct: null,
        fecha_sustituto: null,
        feriado: feriado,
        categoria: 'NORMAL',
        recargo_feriado_pct: null
    };
    // --- 1. Excepcion propia de la persona: gana sobre todo lo demas ---
    var propia = e.excepciones.find(function (x) { return x.idcolaborador !== 0 && x.fecha === e.fecha; });
    if (propia) {
        var trabaja = propia.tipo === 'LABORABLE';
        return __assign(__assign({}, base), { labora: trabaja, origen: 'EXCEPCION_PERSONA', motivo: propia.motivo, 
            // Si la regla decia que NO trabajaba y vino igual, corresponde
            // compensacion. Si la regla ya decia que trabajaba, no: es un dia
            // normal y la excepcion solo esta documentando algo.
            es_descanso_trabajado: trabaja && !regla.labora, compensacion: trabaja && !regla.labora ? propia.compensacion : null, recargo_pct: trabaja && !regla.labora && propia.compensacion === 'RECARGO'
                ? propia.recargo_pct : null, fecha_sustituto: trabaja && !regla.labora ? propia.fecha_sustituto : null, 
            // Sin horario asignado no hay hora esperada aunque venga a trabajar
            hora_esperada: trabaja ? esperada : null, 
            // La categoria describe una AUSENCIA. Si vino a trabajar no aplica,
            // por mas que la fila diga 'VACACIONES' de una carga anterior.
            categoria: trabaja ? 'NORMAL' : (propia.categoria || 'NORMAL') });
    }
    // --- 2. Es el dia al que corrio su descanso ---
    // Se deriva de fecha_sustituto en vez de exigir una segunda fila: con dos
    // filas podrian quedar desparejas y la persona perderia su descanso.
    var corrido = e.excepciones.find(function (x) { return x.idcolaborador !== 0 && x.compensacion === 'SUSTITUTORIO' && x.fecha_sustituto === e.fecha; });
    if (corrido) {
        return __assign(__assign({}, base), { labora: false, origen: 'DESCANSO_SUSTITUTO', motivo: "Descanso movido desde el ".concat(corrido.fecha), hora_esperada: null });
    }
    return base;
}
/**
 * Cuantos dias de descanso trabajados hay en un rango, separados por como se
 * compensan. Es la linea que despues entra a la boleta.
 */
function resumenDescansosTrabajados(dias) {
    var trabajados = dias.filter(function (d) { return d.es_descanso_trabajado; });
    return {
        total: trabajados.length,
        con_sustitutorio: trabajados.filter(function (d) { return d.compensacion === 'SUSTITUTORIO'; }).length,
        con_recargo: trabajados.filter(function (d) { return d.compensacion === 'RECARGO'; }).length,
        // Sin compensacion elegida: es un error de carga que hay que mostrar,
        // no un caso valido. La ley obliga a una de las dos salidas.
        sin_definir: trabajados.filter(function (d) { return !d.compensacion; }).length
    };
}
exports.resumenDescansosTrabajados = resumenDescansosTrabajados;
