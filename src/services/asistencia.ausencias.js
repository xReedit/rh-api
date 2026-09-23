"use strict";
// Quien deberia haber marcado y no marco, y por que.
//
// EL PROBLEMA QUE RESUELVE
// El sistema sabe que alguien no vino, pero no por que. Y desde que los dias no
// trabajados se descuentan solos de la boleta, esa diferencia vale plata:
//
//   - se fue de vacaciones  -> se le paga igual, no se descuenta
//   - esta con descanso medico -> idem
//   - renuncio y nadie lo dio de baja -> le siguen contando faltas para siempre
//   - falto de verdad -> ahi si, se descuenta
//
// Nadie va a entrar a revisar esto todos los dias. Por eso el sistema avisa
// solo: si alguien lleva varios dias seguidos sin marcar, algo pasa, y hay que
// preguntarlo ANTES de que cierre la planilla y el descuento ya este hecho.
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
exports.darDeBaja = exports.registrarAusencia = exports.alertas = exports.DIAS_PARA_ALERTAR = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_config_1 = require("./asistencia.config");
var asistencia_bitacora_1 = require("./asistencia.bitacora");
var prisma = new client_1.PrismaClient();
/**
 * Dias seguidos sin marcar antes de avisar.
 *
 * Tres y no uno: faltar un dia pasa todo el tiempo y avisar por cada uno
 * entrenaria a ignorar el aviso. Tres dias seguidos ya no es un olvido.
 */
exports.DIAS_PARA_ALERTAR = 3;
/** Hasta cuantos dias hacia atras se busca. Mas que eso ya es trabajo de reportes. */
var VENTANA_DIAS = 30;
var texto = function (v, max) {
    if (max === void 0) { max = 200; }
    return (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);
};
function diasEntre(desde, hasta) {
    var salida = [];
    var t = Date.parse(desde + 'T00:00:00Z');
    var fin = Date.parse(hasta + 'T00:00:00Z');
    while (t <= fin) {
        salida.push(new Date(t).toISOString().slice(0, 10));
        t += 86400000;
    }
    return salida;
}
var restarDias = function (fecha, n) {
    return new Date(Date.parse(fecha + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);
};
/**
 * Esta el modulo realmente en uso?
 *
 * Importa porque si nadie PUEDE marcar, todo el personal aparece como ausente y
 * el aviso deja de significar algo: seria una alarma que suena siempre, que es
 * lo mismo que una alarma apagada.
 *
 * Hacen falta las dos mitades: una pantalla donde escanear y alguien capaz de
 * escanear. Se acepta tambien que haya marcas recientes, porque una sede que
 * solo usa marcado manual no tiene celulares vinculados y si esta operando.
 */
function estadoDelModulo(ctx, desde) {
    return __awaiter(this, void 0, void 0, function () {
        var marcadores, personal, ids, conDispositivo, _a, marcasRecientes;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.asistencia_kiosko.count({
                        where: { idorg: ctx.idorg, revocado_at: null }
                    })];
                case 1:
                    marcadores = _b.sent();
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            select: { idcolaborador: true }
                        })];
                case 2:
                    personal = _b.sent();
                    ids = personal.map(function (p) { return p.idcolaborador; });
                    if (!ids.length) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma.colaborador_dispositivo.count({
                            where: { idcolaborador: { "in": ids }, activo: true }
                        })];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = 0;
                    _b.label = 5;
                case 5:
                    conDispositivo = _a;
                    return [4 /*yield*/, prisma.asistencia_marca.count({
                            where: { idorg: ctx.idorg, fecha_local: { gte: (0, asistencia_calendario_1.fechaSql)(desde + ' 00:00:00') } }
                        })];
                case 6:
                    marcasRecientes = _b.sent();
                    return [2 /*return*/, {
                            operativo: marcadores > 0 && (conDispositivo > 0 || marcasRecientes > 0),
                            marcadores: marcadores,
                            personal: ids.length,
                            con_dispositivo: conDispositivo,
                            marcas_recientes: marcasRecientes
                        }];
            }
        });
    });
}
/**
 * Quien lleva varios dias seguidos sin marcar un dia que le tocaba.
 *
 * Se cuenta hacia atras desde el ultimo dia CERRADO: el dia en curso no cuenta
 * porque la persona todavia puede llegar, y avisar a las 10 de la manana de que
 * alguien "no vino" seria falso la mitad de las veces.
 *
 * La racha se corta con una marca o con un dia que no le tocaba trabajar: unas
 * vacaciones ya cargadas, o el domingo de por medio, no rompen nada.
 */
function alertas(ctx) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var org, corteRaw, corte, hoyOperativo, hasta, desde, estado, personal, c, marcas, marco, dias, salida, _i, _b, p, racha, primerDia, ultimoDia, _c, dias_1, fecha, dl, ult;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 1:
                    org = _d.sent();
                    corteRaw = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                    corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
                    hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                    hasta = restarDias(hoyOperativo, 1);
                    desde = restarDias(hasta, VENTANA_DIAS - 1);
                    return [4 /*yield*/, estadoDelModulo(ctx, desde)];
                case 2:
                    estado = _d.sent();
                    if (!estado.operativo) {
                        return [2 /*return*/, __assign({ alertas: [], desde: desde, hasta: hasta }, estado)];
                    }
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            orderBy: { nombres: 'asc' }
                        })];
                case 3:
                    personal = _d.sent();
                    if (!personal.length) {
                        return [2 /*return*/, __assign({ alertas: [], desde: desde, hasta: hasta }, estado)];
                    }
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(ctx.idorg, ctx.idsede, desde, hasta)];
                case 4:
                    c = _d.sent();
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: {
                                idorg: ctx.idorg,
                                tipo: 'ENTRADA',
                                fecha_local: { gte: (0, asistencia_calendario_1.fechaSql)(desde + ' 00:00:00'), lte: (0, asistencia_calendario_1.fechaSql)(hasta + ' 00:00:00') }
                            }
                        })];
                case 5:
                    marcas = _d.sent();
                    marco = new Set(marcas.map(function (m) { return "".concat(m.idcolaborador, "|").concat((0, asistencia_calendario_1.aTextoLima)(m.fecha_local).slice(0, 10)); }));
                    dias = diasEntre(desde, hasta).reverse();
                    salida = [];
                    _i = 0, _b = personal;
                    _d.label = 6;
                case 6:
                    if (!(_i < _b.length)) return [3 /*break*/, 9];
                    p = _b[_i];
                    racha = 0;
                    primerDia = null;
                    ultimoDia = null;
                    for (_c = 0, dias_1 = dias; _c < dias_1.length; _c++) {
                        fecha = dias_1[_c];
                        dl = (0, asistencia_dialaboral_1.resolverDia)({
                            fecha: fecha,
                            horario_semanal: p.horario_semanal,
                            tolerancia_min: (_a = p.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                            excepciones: c.porPersona(p.idcolaborador),
                            feriados: c.feriados,
                            dias_cierre: c.dias_cierre,
                            politica: c.politica
                        });
                        // Un dia que no le tocaba no suma ni corta: simplemente no cuenta
                        if (!dl.labora) {
                            continue;
                        }
                        if (marco.has("".concat(p.idcolaborador, "|").concat(fecha))) {
                            break;
                        }
                        racha++;
                        if (!ultimoDia) {
                            ultimoDia = fecha;
                        }
                        primerDia = fecha;
                    }
                    if (!(racha >= exports.DIAS_PARA_ALERTAR)) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.asistencia_marca.findFirst({
                            where: { idcolaborador: p.idcolaborador, tipo: 'ENTRADA' },
                            orderBy: { marcada_at: 'desc' }
                        })];
                case 7:
                    ult = _d.sent();
                    salida.push({
                        idcolaborador: p.idcolaborador,
                        nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                        dni: p.dni,
                        dias: racha,
                        desde: primerDia,
                        hasta: ultimoDia,
                        ultima_marca: ult ? (0, asistencia_calendario_1.aTextoLima)(ult.marcada_at).slice(0, 10) : null
                    });
                    _d.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9:
                    // Primero el que lleva mas tiempo sin aparecer: es el caso mas urgente
                    salida.sort(function (a, b) { return b.dias - a.dias; });
                    return [2 /*return*/, __assign({ alertas: salida, desde: desde, hasta: hasta }, estado)];
            }
        });
    });
}
exports.alertas = alertas;
// ---------------------------------------------------------------------------
// Resolver: esta de vacaciones / con licencia
// ---------------------------------------------------------------------------
var ETIQUETA = {
    VACACIONES: 'Vacaciones',
    LICENCIA: 'Licencia con goce',
    DESCANSO_MEDICO: 'Descanso medico',
    PERMISO_SIN_GOCE: 'Permiso sin goce de haber'
};
/**
 * Registra una ausencia justificada sobre un RANGO de dias.
 *
 * Va por rango y no por dia porque nadie se toma vacaciones de un dia: pedirlo
 * dia por dia son quince formularios para una sola decision.
 *
 * Solo escribe los dias que la persona iba a trabajar. Marcar el domingo como
 * vacaciones no cambia nada y despues ensucia cualquier conteo de "cuantos dias
 * de vacaciones se tomo".
 */
function registrarAusencia(ctx, body, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var idcolaborador, desde, hasta, dias, categoria, c, motivo, ctxLab, escritos, _i, dias_2, fecha, dl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    idcolaborador = Number(body.idcolaborador) || 0;
                    if (!idcolaborador) {
                        throw new asistencia_config_1.Invalido('Falta el colaborador.');
                    }
                    desde = String(body.desde || '');
                    hasta = String(body.hasta || desde);
                    if (!asistencia_config_1.ES_FECHA.test(desde) || !asistencia_config_1.ES_FECHA.test(hasta)) {
                        throw new asistencia_config_1.Invalido('Faltan las fechas.');
                    }
                    if (desde > hasta) {
                        throw new asistencia_config_1.Invalido('La fecha inicial es posterior a la final.');
                    }
                    dias = diasEntre(desde, hasta);
                    if (dias.length > 366) {
                        throw new asistencia_config_1.Invalido('El rango no puede pasar de un ano.');
                    }
                    categoria = String(body.categoria || '').toUpperCase();
                    if (!ETIQUETA[categoria]) {
                        throw new asistencia_config_1.Invalido('Elige el tipo de ausencia: vacaciones, licencia, descanso medico o permiso sin goce.');
                    }
                    return [4 /*yield*/, prisma.colaborador.findFirst({
                            where: { idcolaborador: idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
                        })];
                case 1:
                    c = _b.sent();
                    if (!c) {
                        throw new asistencia_config_1.Invalido('Ese colaborador no es de esta sede.', 404);
                    }
                    motivo = texto(body.motivo, 200) || ETIQUETA[categoria];
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(ctx.idorg, ctx.idsede, desde, hasta)];
                case 2:
                    ctxLab = _b.sent();
                    escritos = 0;
                    _i = 0, dias_2 = dias;
                    _b.label = 3;
                case 3:
                    if (!(_i < dias_2.length)) return [3 /*break*/, 6];
                    fecha = dias_2[_i];
                    dl = (0, asistencia_dialaboral_1.resolverDia)({
                        fecha: fecha,
                        horario_semanal: c.horario_semanal,
                        tolerancia_min: (_a = c.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                        excepciones: ctxLab.porPersona(idcolaborador),
                        feriados: ctxLab.feriados,
                        dias_cierre: ctxLab.dias_cierre,
                        politica: ctxLab.politica
                    });
                    if (!dl.labora) {
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, (0, asistencia_config_1.guardarExcepcion)(ctx, {
                            fecha: fecha,
                            idcolaborador: idcolaborador,
                            tipo: 'NO_LABORABLE',
                            motivo: motivo,
                            categoria: categoria
                        }, autor)];
                case 4:
                    _b.sent();
                    escritos++;
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: 
                // Una sola linea en la bitacora para todo el rango: quince lineas seguidas
                // diciendo lo mismo esconden el resto del historial.
                return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                        idorg: ctx.idorg, idsede_restobar: ctxLab.idsedeRestobar,
                        entidad: 'EXCEPCION',
                        idcolaborador: idcolaborador,
                        accion: 'CREA',
                        detalle: "".concat(c.nombres, ": ").concat(ETIQUETA[categoria], " del ").concat(desde, " al ").concat(hasta, " ") +
                            "(".concat(escritos, " dia(s) de trabajo)") +
                            (asistencia_dialaboral_1.CATEGORIAS_PAGADAS.includes(categoria) ? ' - se paga' : ' - no se paga'),
                        nuevo: { desde: desde, hasta: hasta, categoria: categoria, dias: escritos }
                    }, autor)];
                case 7:
                    // Una sola linea en la bitacora para todo el rango: quince lineas seguidas
                    // diciendo lo mismo esconden el resto del historial.
                    _b.sent();
                    return [2 /*return*/, { dias: escritos, desde: desde, hasta: hasta, categoria: categoria, pagado: asistencia_dialaboral_1.CATEGORIAS_PAGADAS.includes(categoria) }];
            }
        });
    });
}
exports.registrarAusencia = registrarAusencia;
// ---------------------------------------------------------------------------
// Resolver: ya no trabaja aqui
// ---------------------------------------------------------------------------
/**
 * Da de baja al colaborador.
 *
 * No borra nada: sus marcas, sus horarios y sus boletas quedan, porque el
 * D.S. 004-2006-TR obliga a conservar el registro de jornada cinco anos. Lo que
 * cambia es que deja de aparecer en el dia, en los reportes y en la planilla, y
 * por lo tanto deja de acumular faltas.
 */
function darDeBaja(ctx, body, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var idcolaborador, fecha, motivo, c, sede;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    idcolaborador = Number(body.idcolaborador) || 0;
                    if (!idcolaborador) {
                        throw new asistencia_config_1.Invalido('Falta el colaborador.');
                    }
                    fecha = asistencia_config_1.ES_FECHA.test(String(body.fecha || '')) ? String(body.fecha) : (0, asistencia_calendario_1.ahoraLima)().slice(0, 10);
                    motivo = texto(body.motivo, 150);
                    if (!motivo) {
                        throw new asistencia_config_1.Invalido('Escribe por que deja de trabajar: renuncia, fin de contrato, despido.');
                    }
                    return [4 /*yield*/, prisma.colaborador.findFirst({
                            where: { idcolaborador: idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
                        })];
                case 1:
                    c = _b.sent();
                    if (!c) {
                        throw new asistencia_config_1.Invalido('Ese colaborador no es de esta sede.', 404);
                    }
                    if (c.estado !== 0) {
                        throw new asistencia_config_1.Invalido('Ese colaborador ya esta dado de baja.');
                    }
                    return [4 /*yield*/, prisma.colaborador.update({
                            where: { idcolaborador: idcolaborador },
                            data: { estado: 1, f_baja: fecha, motivo_baja: motivo }
                        })];
                case 2:
                    _b.sent();
                    // El celular se revoca en el mismo acto: dejarlo activo permitiria marcar a
                    // alguien que ya no trabaja aqui.
                    return [4 /*yield*/, prisma.colaborador_dispositivo.updateMany({
                            where: { idcolaborador: idcolaborador, activo: true },
                            data: { activo: null, revocado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)()) }
                        })];
                case 3:
                    // El celular se revoca en el mismo acto: dejarlo activo permitiria marcar a
                    // alguien que ya no trabaja aqui.
                    _b.sent();
                    return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 4:
                    sede = _b.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: (_a = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _a !== void 0 ? _a : 0,
                            entidad: 'HORARIO', identidad: idcolaborador,
                            idcolaborador: idcolaborador,
                            accion: 'ELIMINA',
                            detalle: "Baja de ".concat(((c.nombres || '') + ' ' + (c.apellidos || '')).trim(), " el ").concat(fecha, ": ").concat(motivo),
                            anterior: { estado: 0 },
                            nuevo: { estado: 1, f_baja: fecha, motivo_baja: motivo }
                        }, autor)];
                case 5:
                    _b.sent();
                    return [2 /*return*/, { idcolaborador: idcolaborador, f_baja: fecha, motivo_baja: motivo }];
            }
        });
    });
}
exports.darDeBaja = darDeBaja;
