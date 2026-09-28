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
exports.indexarMarcas = exports.SIN_MARCAS = exports.validarHorario = exports.horasJornada = exports.horaEsperada = exports.tramosDe = exports.diaSemana = exports.TRAMOS_MAX = exports.DIAS = exports.horasTurno = exports.tardanzaMin = exports.diaOperativo = exports.minutosDesde = exports.aTextoLima = exports.fechaSql = exports.ahoraLima = void 0;
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
/** Cuantos tramos se aceptan por dia. Dos son lo normal; tres ya es raro. */
exports.TRAMOS_MAX = 4;
/** Dia de la semana ('lun', 'mar', ...) de una fecha 'YYYY-MM-DD'. */
function diaSemana(fecha) {
    return exports.DIAS[new Date("".concat(fecha, "T00:00:00Z")).getUTCDay()];
}
exports.diaSemana = diaSemana;
/**
 * Los tramos de ese dia, siempre como lista y en orden.
 *
 * Es el unico lugar que sabe que existen dos formas guardadas. Todo lo demas
 * pregunta por aqui y recibe siempre una lista.
 */
function tramosDe(horario, fecha) {
    if (!horario) {
        return [];
    }
    var t = horario[diaSemana(fecha)];
    if (!t) {
        return [];
    }
    var lista = Array.isArray(t) ? t : [t];
    return lista.filter(function (x) { return x && x.e && x.s; });
}
exports.tramosDe = tramosDe;
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
function horaEsperada(horario, fecha, marcadaAt) {
    var tramos = tramosDe(horario, fecha);
    if (!tramos.length) {
        return null;
    }
    if (!marcadaAt || tramos.length === 1) {
        return tramos[0].e;
    }
    var real = horaEnSegundos(marcadaAt.slice(11));
    var mejor = tramos[0];
    var menor = Infinity;
    for (var _i = 0, tramos_1 = tramos; _i < tramos_1.length; _i++) {
        var t = tramos_1[_i];
        // Distancia circular: un tramo que empieza 23:00 esta cerca de las
        // 00:30, no a 22 horas.
        var d = Math.abs(real - horaEnSegundos(t.e));
        var dist = Math.min(d, 86400 - d);
        if (dist < menor) {
            menor = dist;
            mejor = t;
        }
    }
    return mejor.e;
}
exports.horaEsperada = horaEsperada;
/**
 * Horas que la persona DEBE estar ese dia, sumando los tramos.
 *
 * Suma los tramos en vez de restar la ultima salida menos la primera entrada:
 * asi el hueco del turno partido -- que es cuando la persona se va -- no cuenta
 * como trabajado. Es la base contra la que se miden las horas extra.
 */
function horasJornada(horario, fecha) {
    var tramos = tramosDe(horario, fecha);
    if (!tramos.length) {
        return 0;
    }
    var seg = 0;
    for (var _i = 0, tramos_2 = tramos; _i < tramos_2.length; _i++) {
        var t = tramos_2[_i];
        var d = horaEnSegundos(t.s) - horaEnSegundos(t.e);
        if (d < 0) {
            d += 86400;
        } // cruza la medianoche
        seg += d;
    }
    return Math.round((seg / 3600) * 100) / 100;
}
exports.horasJornada = horasJornada;
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
        var crudo = obj[dia];
        if (!crudo) {
            continue;
        } // dia sin tramos = no trabaja
        // Se acepta la forma vieja (un tramo suelto) y la nueva (lista).
        var lista = Array.isArray(crudo) ? crudo : [crudo];
        if (!lista.length) {
            continue;
        }
        if (lista.length > exports.TRAMOS_MAX) {
            throw new Error("horario: ".concat(dia, " tiene ").concat(lista.length, " tramos, el maximo es ").concat(exports.TRAMOS_MAX));
        }
        var tramos = [];
        for (var _b = 0, lista_1 = lista; _b < lista_1.length; _b++) {
            var t = lista_1[_b];
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
        for (var i = 1; i < tramos.length; i++) {
            var previo = tramos[i - 1];
            if (previo.s <= previo.e) {
                throw new Error("horario: ".concat(dia, " solo el ultimo tramo puede pasar la medianoche"));
            }
            if (tramos[i].e < previo.s) {
                throw new Error("horario: ".concat(dia, " el tramo ").concat(tramos[i].e, "-").concat(tramos[i].s, " se pisa con ").concat(previo.e, "-").concat(previo.s));
            }
        }
        salida[dia] = tramos;
    }
    // Un objeto vacio es "no trabaja ningun dia"; se guarda como NULL (sin horario).
    return Object.keys(salida).length ? salida : null;
}
exports.validarHorario = validarHorario;
/** Un dia sin ninguna marca. Congelado: lo comparten todos los llamadores. */
exports.SIN_MARCAS = Object.freeze({ ENTRADA: null, SALIDA: null, entradas: [], todas: [], tardanza_min: 0 });
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
function indexarMarcas(marcas, diaDe) {
    var idx = new Map();
    for (var _i = 0, marcas_1 = marcas; _i < marcas_1.length; _i++) {
        var m = marcas_1[_i];
        var k = "".concat(m.idcolaborador, "|").concat(diaDe(m));
        var d = idx.get(k);
        if (!d) {
            d = { ENTRADA: null, SALIDA: null, entradas: [], todas: [], tardanza_min: 0 };
            idx.set(k, d);
        }
        d.todas.push(m);
        if (m.tipo === 'ENTRADA') {
            d.entradas.push(m);
            if (!d.ENTRADA) {
                d.ENTRADA = m;
            } // la primera manda
            d.tardanza_min += Math.max(0, m.tardanza_min || 0);
        }
        else if (m.tipo === 'SALIDA') {
            d.SALIDA = m; // la ultima manda
        }
    }
    return idx;
}
exports.indexarMarcas = indexarMarcas;
