"use strict";
// Cambio de turno entre companeros.
//
// EL CASO
// Alguien no puede venir y le pide a un companero que descansa ese dia que lo
// cubra. El que cubre asume el turno; el que falta asume el descanso del otro.
// Se arregla de palabra, entre ellos, y hasta ahora el sistema no se enteraba.
//
// POR QUE IMPORTA (no es burocracia, es plata)
// D. Leg. 713: trabajar en dia de descanso SIN descanso sustitutorio se paga
// con +100%. Si nadie registra el cambio, el sistema le carga ese recargo a
// quien cubrio -- aunque SI tuvo descanso sustitutorio, se lo dio el otro -- y
// ademas le descuenta el dia al que falto. Registrarlo bien es la diferencia
// entre pagar el dia una vez o dos.
//
// COMO SE CONFIRMA, SIN ADMINISTRADOR
// El que cubre lo propone al marcar. El que falto lo confirma la proxima vez
// que marca. Es el momento natural: el que falta no esta ese dia -- por eso
// hubo cambio -- pero vuelve al siguiente.
//
// MIENTRAS ESTA PENDIENTE NO CAMBIA NADA, y eso es lo correcto: si el cambio
// nunca se confirma, entonces de verdad hubo una falta y de verdad se trabajo
// un descanso sin sustituto.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.listar = exports.resolver = exports.pendientesDe = exports.proponer = exports.candidatos = exports.DIAS_PARA_CONFIRMAR = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_config_1 = require("./asistencia.config");
var prisma = new client_1.PrismaClient();
/**
 * Dias que tiene el que falto para confirmar.
 *
 * Una confirmacion un mes despues no es una confirmacion, es una
 * reconstruccion: nadie se acuerda. Ademas, pasada la semana el periodo de
 * planilla puede haber cerrado, y mover un dia de un periodo pagado es peor
 * que dejarlo como quedo.
 */
exports.DIAS_PARA_CONFIRMAR = 7;
/** Dias de la semana que se miran para el descanso obligatorio. */
var SEMANA = 7;
var hoyLima = function () { return (0, asistencia_calendario_1.ahoraLima)().slice(0, 10); };
var sumarDias = function (fecha, n) {
    return new Date(Date.parse(fecha + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
};
/**
 * Si a esta persona le quedaria al menos un dia de descanso en la semana.
 *
 * D. Leg. 713 art. 1: 24 horas continuas de descanso por semana. Dos
 * companeros arreglando entre ellos no van a pensar en esto -- estan
 * resolviendo un problema de hoy -- y el que queda expuesto a la multa es el
 * restaurante.
 *
 * Se mira la semana que CONTIENE el dia que se va a cubrir, de lunes a
 * domingo. Si en esa semana no le queda ningun dia libre, el cambio no se
 * puede hacer.
 */
function conservaDescansoSemanal(idorg, idsede, idcolaborador, fecha) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var dow, lunes, domingo, persona, c, libres, i, d, dl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    dow = (new Date(fecha + 'T00:00:00Z').getUTCDay() + 6) % 7;
                    lunes = sumarDias(fecha, -dow);
                    domingo = sumarDias(lunes, 6);
                    return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idcolaborador: idcolaborador } })];
                case 1:
                    persona = _b.sent();
                    if (!persona) {
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(idorg, idsede, lunes, domingo)];
                case 2:
                    c = _b.sent();
                    libres = 0;
                    for (i = 0; i < SEMANA; i++) {
                        d = sumarDias(lunes, i);
                        // El dia que se quiere cubrir pasa a ser trabajado: no cuenta como libre.
                        if (d === fecha) {
                            continue;
                        }
                        dl = (0, asistencia_dialaboral_1.resolverDia)({
                            fecha: d,
                            horario_semanal: persona.horario_semanal,
                            tolerancia_min: (_a = persona.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                            excepciones: c.porPersona(idcolaborador),
                            feriados: c.feriados,
                            dias_cierre: c.dias_cierre,
                            politica: c.politica
                        });
                        if (!dl.labora) {
                            libres++;
                        }
                    }
                    return [2 /*return*/, libres > 0];
            }
        });
    });
}
/**
 * A quienes puede decir que esta cubriendo.
 *
 * Solo la gente a la que HOY le tocaba trabajar y todavia no marco. Ofrecer la
 * lista entera del local invitaria a elegir cualquier nombre; asi, lo unico que
 * se puede declarar es lo que realmente pudo haber pasado.
 */
function candidatos(idorg, idsede, idsedeRestobar, idcolaborador, fecha) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var personal, c, marcaron, _b, lista, _i, _c, p, dl;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, prisma.colaborador.findMany({
                        where: { idorg: idorg, idsede: idsede, estado: 0 },
                        select: {
                            idcolaborador: true, nombres: true, apellidos: true,
                            horario_semanal: true, tolerancia_min: true
                        },
                        orderBy: { nombres: 'asc' }
                    })];
                case 1:
                    personal = _d.sent();
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(idorg, idsede, fecha, fecha)];
                case 2:
                    c = _d.sent();
                    _b = Set.bind;
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: { fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'), tipo: 'ENTRADA' },
                            select: { idcolaborador: true }
                        })];
                case 3:
                    marcaron = new (_b.apply(Set, [void 0, (_d.sent()).map(function (m) { return m.idcolaborador; })]))();
                    lista = [];
                    for (_i = 0, _c = personal; _i < _c.length; _i++) {
                        p = _c[_i];
                        if (p.idcolaborador === idcolaborador) {
                            continue;
                        } // no se cubre a si mismo
                        if (marcaron.has(p.idcolaborador)) {
                            continue;
                        } // ese vino
                        dl = (0, asistencia_dialaboral_1.resolverDia)({
                            fecha: fecha,
                            horario_semanal: p.horario_semanal,
                            tolerancia_min: (_a = p.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                            excepciones: c.porPersona(p.idcolaborador),
                            feriados: c.feriados,
                            dias_cierre: c.dias_cierre,
                            politica: c.politica
                        });
                        if (!dl.labora) {
                            continue;
                        } // a ese tampoco le tocaba
                        lista.push({
                            idcolaborador: p.idcolaborador,
                            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                            hora_esperada: dl.hora_esperada
                        });
                    }
                    return [2 /*return*/, lista];
            }
        });
    });
}
exports.candidatos = candidatos;
/** Lo propone quien vino a cubrir, en el momento de marcar. */
function proponer(idorg, idsedeRestobar, idsede, idcolaboradorCubre, idcolaboradorFalta, fecha, idmarca) {
    return __awaiter(this, void 0, void 0, function () {
        var validos, ya, ahora, c;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (idcolaboradorCubre === idcolaboradorFalta) {
                        throw new asistencia_config_1.Invalido('no se puede cubrir a uno mismo');
                    }
                    return [4 /*yield*/, candidatos(idorg, idsede, idsedeRestobar, idcolaboradorCubre, fecha)];
                case 1:
                    validos = _a.sent();
                    if (!validos.some(function (v) { return v.idcolaborador === idcolaboradorFalta; })) {
                        throw new asistencia_config_1.Invalido('a esa persona no le tocaba trabajar hoy, o ya vino');
                    }
                    return [4 /*yield*/, conservaDescansoSemanal(idorg, idsede, idcolaboradorCubre, fecha)];
                case 2:
                    // LA REGLA QUE ELLOS NO VAN A VER.
                    if (!(_a.sent())) {
                        throw new asistencia_config_1.Invalido('Con este cambio te quedarias sin ningun dia de descanso esta semana, ' +
                            'y la ley exige uno. Habla con el administrador.');
                    }
                    return [4 /*yield*/, prisma.asistencia_cambio_turno.findFirst({
                            where: { idcolaborador_cubre: idcolaboradorCubre, fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00') }
                        })];
                case 3:
                    ya = _a.sent();
                    if (ya) {
                        return [2 /*return*/, { idcambio: ya.idcambio, estado: ya.estado, repetido: true }];
                    }
                    ahora = (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)());
                    return [4 /*yield*/, prisma.$transaction([
                            prisma.asistencia_cambio_turno.create({
                                data: {
                                    idorg: idorg,
                                    idsede_restobar: idsedeRestobar,
                                    fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                                    idcolaborador_cubre: idcolaboradorCubre,
                                    idcolaborador_falta: idcolaboradorFalta,
                                    estado: 'PENDIENTE',
                                    idmarca_origen: idmarca,
                                    creado_at: ahora
                                }
                            }),
                            prisma.asistencia_excepcion.create({
                                data: {
                                    idorg: idorg,
                                    idsede_restobar: idsedeRestobar,
                                    idcolaborador: idcolaboradorCubre,
                                    fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                                    tipo: 'LABORABLE',
                                    motivo: 'Cambio de turno: cubre a un companero (sin confirmar)',
                                    compensacion: 'RECARGO',
                                    recargo_pct: 100,
                                    categoria: 'NORMAL',
                                    origen: 'KIOSKO',
                                    creado_at: ahora
                                }
                            })
                        ])];
                case 4:
                    c = (_a.sent())[0];
                    return [2 /*return*/, { idcambio: c.idcambio, estado: 'PENDIENTE', repetido: false }];
            }
        });
    });
}
exports.proponer = proponer;
/**
 * Lo que este colaborador tiene para confirmar.
 *
 * Se le muestra al marcar: es el momento en que esta persona vuelve al local
 * despues del dia que falto.
 */
function pendientesDe(idcolaborador) {
    return __awaiter(this, void 0, void 0, function () {
        var limite, filas, quienes, nombre;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    limite = sumarDias(hoyLima(), -exports.DIAS_PARA_CONFIRMAR);
                    return [4 /*yield*/, prisma.asistencia_cambio_turno.findMany({
                            where: {
                                idcolaborador_falta: idcolaborador,
                                estado: 'PENDIENTE',
                                fecha: { gte: (0, asistencia_calendario_1.fechaSql)(limite + ' 00:00:00') }
                            },
                            orderBy: { fecha: 'desc' }
                        })];
                case 1:
                    filas = _a.sent();
                    if (!filas.length) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idcolaborador: { "in": filas.map(function (f) { return f.idcolaborador_cubre; }) } },
                            select: { idcolaborador: true, nombres: true, apellidos: true }
                        })];
                case 2:
                    quienes = _a.sent();
                    nombre = new Map(quienes.map(function (q) {
                        return [q.idcolaborador, ((q.nombres || '') + ' ' + (q.apellidos || '')).trim()];
                    }));
                    return [2 /*return*/, filas.map(function (f) { return ({
                            idcambio: f.idcambio,
                            fecha: (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10),
                            idcolaborador_cubre: f.idcolaborador_cubre,
                            cubrio: nombre.get(f.idcolaborador_cubre) || 'un companero'
                        }); })];
            }
        });
    });
}
exports.pendientesDe = pendientesDe;
/**
 * El que falto dice si es cierto.
 *
 * Al confirmar se mueven los DOS dias, y recien ahi cambia la plata:
 *   - el que falto pasa a tener descanso ese dia -> deja de ser falta;
 *   - el que cubrio pasa a tener descanso SUSTITUTORIO -> deja de cobrar el
 *     recargo del 100%, porque ya tuvo su descanso.
 */
function resolver(idcolaborador, idcambio, acepta) {
    return __awaiter(this, void 0, void 0, function () {
        var c, fecha, ahora;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.asistencia_cambio_turno.findFirst({
                        where: { idcambio: idcambio, idcolaborador_falta: idcolaborador }
                    })];
                case 1:
                    c = _a.sent();
                    if (!c) {
                        throw new asistencia_config_1.Invalido('ese cambio no es tuyo', 404);
                    }
                    if (c.estado !== 'PENDIENTE') {
                        throw new asistencia_config_1.Invalido('ese cambio ya se resolvio');
                    }
                    fecha = (0, asistencia_calendario_1.aTextoLima)(c.fecha).slice(0, 10);
                    if (!(fecha < sumarDias(hoyLima(), -exports.DIAS_PARA_CONFIRMAR))) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.asistencia_cambio_turno.update({
                            where: { idcambio: idcambio },
                            data: { estado: 'VENCIDO', resuelto_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)()) }
                        })];
                case 2:
                    _a.sent();
                    throw new asistencia_config_1.Invalido("Pasaron mas de ".concat(exports.DIAS_PARA_CONFIRMAR, " dias: este cambio ya no se puede confirmar aqui. ") +
                        'Lo tiene que resolver el administrador.');
                case 3:
                    if (!!acepta) return [3 /*break*/, 5];
                    // Se deja la excepcion de quien cubrio TAL CUAL, con su RECARGO: si el
                    // otro dice que no hubo acuerdo, entonces trabajo su descanso sin
                    // sustituto y se le debe el 100%. Borrarla le quitaria el dia
                    // trabajado, que si existio.
                    return [4 /*yield*/, prisma.asistencia_cambio_turno.update({
                            where: { idcambio: idcambio },
                            data: { estado: 'RECHAZADO', resuelto_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)()) }
                        })];
                case 4:
                    // Se deja la excepcion de quien cubrio TAL CUAL, con su RECARGO: si el
                    // otro dice que no hubo acuerdo, entonces trabajo su descanso sin
                    // sustituto y se le debe el 100%. Borrarla le quitaria el dia
                    // trabajado, que si existio.
                    _a.sent();
                    return [2 /*return*/, { estado: 'RECHAZADO' }];
                case 5:
                    ahora = (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)());
                    // Al confirmar cambian DOS cosas, y van juntas. A medio aplicar seria lo
                    // peor de los dos mundos: uno deja de cobrar el recargo y el otro sigue con
                    // la falta.
                    //   1. el que falto pasa a tener descanso ese dia -> deja de ser falta;
                    //   2. el que cubrio pasa de RECARGO a SUSTITUTORIO -> deja de cobrar el
                    //      100%, porque el descanso del otro fue su sustituto.
                    return [4 /*yield*/, prisma.$transaction([
                            prisma.asistencia_excepcion.create({
                                data: {
                                    idorg: c.idorg,
                                    idsede_restobar: c.idsede_restobar,
                                    fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                                    origen: 'KIOSKO',
                                    creado_at: ahora,
                                    idcolaborador: c.idcolaborador_falta,
                                    tipo: 'NO_LABORABLE',
                                    motivo: 'Cambio de turno: lo cubrio un companero',
                                    categoria: 'NORMAL'
                                }
                            }),
                            prisma.asistencia_excepcion.updateMany({
                                where: {
                                    idcolaborador: c.idcolaborador_cubre,
                                    fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                                    tipo: 'LABORABLE'
                                },
                                data: {
                                    compensacion: 'SUSTITUTORIO',
                                    fecha_sustituto: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                                    motivo: 'Cambio de turno: cubrio a un companero'
                                }
                            }),
                            prisma.asistencia_cambio_turno.update({
                                where: { idcambio: idcambio },
                                data: { estado: 'CONFIRMADO', resuelto_at: ahora }
                            })
                        ])];
                case 6:
                    // Al confirmar cambian DOS cosas, y van juntas. A medio aplicar seria lo
                    // peor de los dos mundos: uno deja de cobrar el recargo y el otro sigue con
                    // la falta.
                    //   1. el que falto pasa a tener descanso ese dia -> deja de ser falta;
                    //   2. el que cubrio pasa de RECARGO a SUSTITUTORIO -> deja de cobrar el
                    //      100%, porque el descanso del otro fue su sustituto.
                    _a.sent();
                    return [2 /*return*/, { estado: 'CONFIRMADO', fecha: fecha }];
            }
        });
    });
}
exports.resolver = resolver;
/** Los cambios del local, para que el administrador los vea. No los configura. */
function listar(idorg, idsedeRestobar, desde, hasta) {
    return __awaiter(this, void 0, void 0, function () {
        var filas, ids, gente, nombre, vencidos;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.asistencia_cambio_turno.findMany({
                        where: {
                            idorg: idorg,
                            idsede_restobar: idsedeRestobar,
                            fecha: {
                                gte: (0, asistencia_calendario_1.fechaSql)(desde + ' 00:00:00'),
                                lte: (0, asistencia_calendario_1.fechaSql)(hasta + ' 00:00:00')
                            }
                        },
                        orderBy: { fecha: 'desc' }
                    })];
                case 1:
                    filas = _a.sent();
                    if (!filas.length) {
                        return [2 /*return*/, []];
                    }
                    ids = Array.from(new Set(filas.flatMap(function (f) { return [f.idcolaborador_cubre, f.idcolaborador_falta]; })));
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idcolaborador: { "in": ids } },
                            select: { idcolaborador: true, nombres: true, apellidos: true }
                        })];
                case 2:
                    gente = _a.sent();
                    nombre = new Map(gente.map(function (q) {
                        return [q.idcolaborador, ((q.nombres || '') + ' ' + (q.apellidos || '')).trim()];
                    }));
                    vencidos = sumarDias(hoyLima(), -exports.DIAS_PARA_CONFIRMAR);
                    return [2 /*return*/, filas.map(function (f) {
                            var fecha = (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10);
                            return {
                                idcambio: f.idcambio,
                                fecha: fecha,
                                cubrio: nombre.get(f.idcolaborador_cubre) || '',
                                falto: nombre.get(f.idcolaborador_falta) || '',
                                // Un pendiente viejo ya no se va a poder confirmar: se muestra como
                                // vencido aunque en la base siga diciendo PENDIENTE. Marcarlos con
                                // un proceso nocturno seria una pieza mas para mantener.
                                estado: (f.estado === 'PENDIENTE' && fecha < vencidos) ? 'VENCIDO' : f.estado,
                                creado_at: (0, asistencia_calendario_1.aTextoLima)(f.creado_at)
                            };
                        })];
            }
        });
    });
}
exports.listar = listar;
