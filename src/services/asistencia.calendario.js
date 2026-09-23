"use strict";
// Calendario del modulo de Asistencia.
//
// Todas las funciones son PURAS y trabajan sobre STRINGS 'YYYY-MM-DD HH:mm:ss'
// en hora de Lima. A proposito: si usaran Date, el resultado dependeria de la
// zona horaria del proceso de Node (UTC en la mayoria de los despliegues) y una
// marca de las 23:50 en Lima se guardaria con la fecha del dia siguiente.
//
// El POS manda la hora ya en Lima; aqui no se convierte nada, solo se calcula.
exports.__esModule = true;
exports.validarHorario = exports.horaEsperada = exports.diaSemana = exports.DIAS = exports.horasTurno = exports.tardanzaMin = exports.diaOperativo = exports.minutosDesde = exports.aTextoLima = exports.fechaSql = exports.ahoraLima = void 0;
/** 'YYYY-MM-DD HH:mm:ss' -> segundos desde epoch, tratando el string como UTC. */
function aSegundos(momento) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(momento.trim());
    if (!m) {
        throw new Error("momento invalido: ".concat(momento));
    }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000;
}
/** segundos desde epoch -> 'YYYY-MM-DD' */
function aFecha(segundos) {
    return new Date(segundos * 1000).toISOString().slice(0, 10);
}
/**
 * Ahora mismo en Lima, como 'YYYY-MM-DD HH:mm:ss'.
 *
 * El proceso de Node casi siempre corre en UTC, asi que `new Date()` daria una
 * marca 5 horas adelantada y una entrada de las 20:00 quedaria registrada al
 * dia siguiente. Intl hace la conversion sin traer ninguna dependencia.
 */
function ahoraLima(base) {
    var d = base || new Date();
    var p = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d).reduce(function (a, x) { return (a[x.type] = x.value, a); }, {});
    // en-CA da hour "24" a medianoche en algunos runtimes; se normaliza a "00"
    var hora = p.hour === '24' ? '00' : p.hour;
    return "".concat(p.year, "-").concat(p.month, "-").concat(p.day, " ").concat(hora, ":").concat(p.minute, ":").concat(p.second);
}
exports.ahoraLima = ahoraLima;
/**
 * Convierte 'YYYY-MM-DD HH:mm:ss' de Lima en el Date que Prisma debe escribir
 * para que la columna DATETIME guarde EXACTAMENTE esos digitos.
 *
 * Prisma convierte todo Date a UTC antes de escribir. Marcando el string como
 * UTC, esa conversion es la identidad y en la base queda la hora de Lima, que
 * es la que usa el resto del sistema legacy.
 */
function fechaSql(momentoLima) {
    return new Date(momentoLima.replace(' ', 'T') + 'Z');
}
exports.fechaSql = fechaSql;
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
function aTextoLima(d) {
    if (!d) {
        return null;
    }
    var iso = (d instanceof Date) ? d.toISOString() : String(d);
    return iso.slice(0, 19).replace('T', ' ');
}
exports.aTextoLima = aTextoLima;
/** Minutos transcurridos desde un momento de Lima hasta ahora. */
function minutosDesde(momentoLima) {
    if (!momentoLima) {
        return null;
    }
    var ms = Date.parse(momentoLima.replace(' ', 'T') + 'Z');
    if (isNaN(ms)) {
        return null;
    }
    return Math.floor((Date.parse(ahoraLima().replace(' ', 'T') + 'Z') - ms) / 60000);
}
exports.minutosDesde = minutosDesde;
/** 'HH:MM' o 'HH:MM:SS' -> segundos desde medianoche */
function horaEnSegundos(hora) {
    var p = hora.split(':');
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
function diaOperativo(horaCorte, momento) {
    return aFecha(aSegundos(momento) - horaEnSegundos(horaCorte));
}
exports.diaOperativo = diaOperativo;
/**
 * Minutos de tardanza de una ENTRADA. Solo aplica a ENTRADA.
 * null = ese dia no tenia horario, asi que no hay tardanza que calcular.
 */
function tardanzaMin(horaEsperada, marcadaAt, toleranciaMin) {
    if (!horaEsperada) {
        return null;
    }
    var dia = marcadaAt.slice(0, 10);
    var real = aSegundos(marcadaAt);
    var esperado = aSegundos("".concat(dia, " ").concat(horaEsperada.slice(0, 5), ":00"));
    var min = Math.floor((real - esperado) / 60) - toleranciaMin;
    return min > 0 ? min : 0;
}
exports.tardanzaMin = tardanzaMin;
/**
 * Horas trabajadas entre dos marcas del mismo dia operativo.
 *
 * Un turno 18:00 -> 01:30 da un delta negativo porque la salida cae en el dia
 * calendario siguiente. Sumarle 24 h lo corrige: 7.5, no -16.5.
 */
function horasTurno(entradaAt, salidaAt) {
    var seg = aSegundos(salidaAt) - aSegundos(entradaAt);
    if (seg < 0) {
        seg += 86400;
    }
    return Math.round((seg / 3600) * 100) / 100;
}
exports.horasTurno = horasTurno;
// ---------------------------------------------------------------------------
// Horario semanal
// ---------------------------------------------------------------------------
exports.DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
/** Dia de la semana ('lun', 'mar', ...) de una fecha 'YYYY-MM-DD'. */
function diaSemana(fecha) {
    return exports.DIAS[new Date("".concat(fecha, "T00:00:00Z")).getUTCDay()];
}
exports.diaSemana = diaSemana;
/** Hora de entrada esperada ese dia, o null si no trabaja / no tiene horario. */
function horaEsperada(horario, fecha) {
    if (!horario) {
        return null;
    }
    var tramo = horario[diaSemana(fecha)];
    return tramo && tramo.e ? tramo.e : null;
}
exports.horaEsperada = horaEsperada;
/**
 * Valida el JSON del horario antes de guardarlo. Devuelve el objeto saneado.
 * Rechazar aqui evita que un horario corrupto haga que nadie tenga tardanzas.
 */
function validarHorario(entrada) {
    if (entrada === null || entrada === undefined || entrada === '') {
        return null;
    }
    var obj = (typeof entrada === 'string') ? JSON.parse(entrada) : entrada;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error('horario: se esperaba un objeto');
    }
    var hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    var salida = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var dia = _a[_i];
        if (!exports.DIAS.includes(dia)) {
            throw new Error("horario: dia invalido \"".concat(dia, "\""));
        }
        var t = obj[dia];
        if (!t || typeof t !== 'object') {
            throw new Error("horario: ".concat(dia, " sin tramo"));
        }
        if (!hhmm.test(t.e)) {
            throw new Error("horario: ".concat(dia, " entrada invalida \"").concat(t.e, "\""));
        }
        if (!hhmm.test(t.s)) {
            throw new Error("horario: ".concat(dia, " salida invalida \"").concat(t.s, "\""));
        }
        // e === s seria un turno de 0 h o de 24 h: ambiguo, se rechaza.
        if (t.e === t.s) {
            throw new Error("horario: ".concat(dia, " entrada y salida iguales"));
        }
        salida[dia] = { e: t.e, s: t.s };
    }
    // Un objeto vacio es "no trabaja ningun dia"; se guarda como NULL (sin horario).
    return Object.keys(salida).length ? salida : null;
}
exports.validarHorario = validarHorario;
