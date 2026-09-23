"use strict";
// Asistencia vista desde la app de Recursos Humanos.
//
// El POS captura las marcas; aqui se leen. Son dos puertas distintas al mismo
// dato, y a proposito:
//   - /asistencia        lo llama el POS, con su token firmado (empresa+sede)
//   - /asistencia-rrhh   lo llama esta app, con el login de RRHH (middleware auth)
//
// Las MARCAS son de solo lectura: corregir una se hace en el marcador, con
// usuario y clave. Si tambien se pudiera desde la oficina habria dos caminos y
// uno de ellos sin esa compuerta.
//
// La CONFIGURACION (horarios, calendario, feriados) si se escribe desde aqui:
// es trabajo de Recursos Humanos y el POS no deberia ser el unico lugar donde
// se puede hacer. Las operaciones son literalmente las mismas que usa el POS
// -- services/asistencia.config -- asi que no hay forma de que las dos puertas
// apliquen reglas distintas. Lo unico que cambia es el `Autor` que queda en la
// bitacora: origen RRHH y el usuario del login, sin autorizante (quien entra
// aqui ya es del area).
//
// El tenant sale del token de RRHH (req.token.idorg / idsede), nunca de la URL:
// cambiar un numero en la barra de direcciones no debe mostrar otra empresa.
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
var express = __importStar(require("express"));
var client_1 = require("@prisma/client");
var asistencia_1 = require("./asistencia");
var cfg = __importStar(require("../services/asistencia.config"));
var asistencia_config_1 = require("../services/asistencia.config");
var planilla = __importStar(require("../services/asistencia.planilla"));
var ausencias = __importStar(require("../services/asistencia.ausencias"));
var planillaCfg = __importStar(require("../services/planilla.config"));
var asistencia_calendario_1 = require("../services/asistencia.calendario");
var prisma = new client_1.PrismaClient();
var router = express.Router();
var ok = function (res, datos) {
    if (datos === void 0) { datos = null; }
    return res.status(200).json({ success: true, datos: datos, error: '' });
};
var mal = function (res, error, code) {
    if (code === void 0) { code = 400; }
    return res.status(code).json({ success: false, datos: null, error: error });
};
var asinc = function (fn) { return function (req, res) {
    return fn(req, res)["catch"](function (e) {
        // Invalido es "pediste mal", no "se rompio": no ensucia el log ni sale 500
        if (e instanceof asistencia_config_1.Invalido) {
            return mal(res, e.message, e.code);
        }
        console.error('[asistencia-rrhh]', req.path, e);
        mal(res, e.message || 'error interno', 500);
    });
}; };
var ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Tope de dias por consulta: un rango abierto barreria anos de marcas. */
var RANGO_MAX_DIAS = 186; // medio ano, alcanza para cualquier periodo de planilla
function tenant(req) {
    var _a, _b;
    var idorg = Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.idorg);
    var idsede = Number((_b = req.token) === null || _b === void 0 ? void 0 : _b.idsede);
    if (!idorg || !idsede) {
        throw new Error('El token no trae empresa o sede.');
    }
    return { idorg: idorg, idsede: idsede };
}
/** Quien firma el cambio en la bitacora. Sale del token, nunca del body. */
function autorRrhh(req) {
    var _a, _b;
    return {
        origen: 'RRHH',
        idusuario: Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.id) || null,
        nombre: String(((_b = req.token) === null || _b === void 0 ? void 0 : _b.usuario) || '')
    };
}
router.get('/', function (_req, res) { return res.status(200).json({ message: 'Estas conectado a asistencia (RRHH)' }); });
// ---------------------------------------------------------------------------
// Personal y horarios
// ---------------------------------------------------------------------------
router.get('/personal', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, idorg, idsede, filas, areas, nombreArea;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = tenant(req), idorg = _a.idorg, idsede = _a.idsede;
                return [4 /*yield*/, prisma.colaborador.findMany({
                        where: { idorg: idorg, idsede: idsede, estado: 0 },
                        orderBy: { nombres: 'asc' }
                    })];
            case 1:
                filas = _b.sent();
                return [4 /*yield*/, prisma.area.findMany({
                        where: { estado: '0', OR: [{ idsede: 0 }, { idsede: idsede }] },
                        select: { idarea: true, descripcion: true }
                    })];
            case 2:
                areas = _b.sent();
                nombreArea = new Map(areas.map(function (a) { return [a.idarea, a.descripcion]; }));
                ok(res, {
                    personal: filas.map(function (c) {
                        var _a;
                        return ({
                            idcolaborador: c.idcolaborador,
                            nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
                            dni: c.dni,
                            area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
                            horario_semanal: c.horario_semanal,
                            tolerancia_min: (_a = c.tolerancia_min) !== null && _a !== void 0 ? _a : 10
                        });
                    }),
                    areas: areas.map(function (a) { return ({ idarea: a.idarea, descripcion: a.descripcion }); })
                });
                return [2 /*return*/];
        }
    });
}); }));
router.get('/areas', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.listarAreas(tenant(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/personal/area', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.asignarArea(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// El mismo horario para todo un grupo: la cocina entera suele entrar a la
// misma hora y cargarlo uno por uno son quince dialogos identicos.
router.post('/personal/horario-masivo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.horarioMasivo(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.put('/personal/:id/horario', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarHorario(tenant(req), __assign(__assign({}, req.body), { idcolaborador: req.params.id }), autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------
router.get('/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.leerConfiguracion(tenant(req), (_c = req.query) === null || _c === void 0 ? void 0 : _c.anio)];
            case 1:
                _a.apply(void 0, _b.concat([_d.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/configuracion/listo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.marcarConfigurado(tenant(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarConfiguracion(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/calendario/:mes', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.calendarioMes(tenant(req), req.params.mes)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/calendario/dia/:fecha', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.calendarioDia(tenant(req), req.params.fecha)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/calendario/excepcion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarExcepcion(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router["delete"]('/calendario/excepcion/:id', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.eliminarExcepcion(tenant(req), req.params.id, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/calendario/dias-cierre', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarDiasCierre(tenant(req), req.body.dias, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/feriados/:anio?', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.listarFeriados(tenant(req), req.params.anio)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/feriados', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarFeriado(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router["delete"]('/feriados/:id', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.eliminarFeriado(tenant(req), req.params.id, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Ausencias: por que alguien no esta marcando
// ---------------------------------------------------------------------------
router.get('/ausencias/alertas', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, ausencias.alertas(tenant(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/ausencias/registrar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, ausencias.registrarAusencia(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/ausencias/baja', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, ausencias.darDeBaja(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Planilla: de las marcas a la boleta
// ---------------------------------------------------------------------------
//
// Dos pasos a proposito. `calcular` no escribe nada y muestra de donde sale
// cada importe; `aplicar` recien ahi lo manda a la boleta. Ver antes de firmar
// es lo minimo cuando lo que sigue es pagarle a alguien.
router.get('/planilla/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, planillaCfg.leerConfig(tenant(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, planillaCfg.guardarConfig(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/calcular', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, planilla.calcular(tenant(req), req.body)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/aplicar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, planilla.aplicar(tenant(req), req.body, autorRrhh(req))];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------
router.get('/bitacora', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.listarBitacora(tenant(req), req.query)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Un dia
// ---------------------------------------------------------------------------
router.get('/dia/:fecha?', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, idorg, idsede, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = tenant(req), idorg = _a.idorg, idsede = _a.idsede;
                _b = ok;
                _c = [res];
                return [4 /*yield*/, (0, asistencia_1.datosDia)(idorg, idsede, req.params.fecha)];
            case 1:
                _b.apply(void 0, _c.concat([_d.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------
var soloHora = function (d) { return (d ? new Date(d).toISOString().slice(11, 16) : null); };
/** Lista de dias 'YYYY-MM-DD' entre dos fechas, ambas incluidas. */
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
/**
 * Resumen por colaborador para un rango de dias.
 *
 * Es lo que despues alimenta el descuento por tardanza en la boleta: por eso
 * separa `horas_trabajadas` (turnos cerrados) de `dias_incompletos` (entro y no
 * marco salida). Un dia incompleto NO suma horas: contarlo con una salida
 * inventada seria pagar o descontar sobre un dato que nadie registro.
 */
router.get('/reporte/:desde/:hasta', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, idorg, idsede, desde, hasta, dias, org, c, corte, hoyOperativo, personal, marcas, areas, nombreArea, _i, _b, a, idx, _c, _d, m, dia, k, filas;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = tenant(req), idorg = _a.idorg, idsede = _a.idsede;
                desde = String(req.params.desde);
                hasta = String(req.params.hasta);
                if (!ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) {
                    return [2 /*return*/, mal(res, 'Las fechas deben ser YYYY-MM-DD.')];
                }
                if (desde > hasta) {
                    return [2 /*return*/, mal(res, 'La fecha inicial es posterior a la final.')];
                }
                dias = diasEntre(desde, hasta);
                if (dias.length > RANGO_MAX_DIAS) {
                    return [2 /*return*/, mal(res, "El rango no puede pasar de ".concat(RANGO_MAX_DIAS, " dias."))];
                }
                return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: idorg } })];
            case 1:
                org = _e.sent();
                c = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                corte = c instanceof Date ? c.toISOString().slice(11, 19) : String(c || '05:00:00');
                hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                return [4 /*yield*/, prisma.colaborador.findMany({
                        where: { idorg: idorg, idsede: idsede, estado: 0 },
                        orderBy: { nombres: 'asc' }
                    })];
            case 2:
                personal = _e.sent();
                return [4 /*yield*/, prisma.asistencia_marca.findMany({
                        where: {
                            idorg: idorg,
                            fecha_local: {
                                gte: new Date(desde + 'T00:00:00Z'),
                                lte: new Date(hasta + 'T00:00:00Z')
                            }
                        },
                        orderBy: { marcada_at: 'asc' }
                    })];
            case 3:
                marcas = _e.sent();
                return [4 /*yield*/, prisma.area.findMany({
                        where: { estado: '0', OR: [{ idsede: 0 }, { idsede: idsede }] },
                        select: { idarea: true, descripcion: true }
                    })];
            case 4:
                areas = _e.sent();
                nombreArea = new Map();
                for (_i = 0, _b = areas; _i < _b.length; _i++) {
                    a = _b[_i];
                    nombreArea.set(a.idarea, a.descripcion);
                }
                idx = new Map();
                for (_c = 0, _d = marcas; _c < _d.length; _c++) {
                    m = _d[_c];
                    dia = (0, asistencia_calendario_1.aTextoLima)(m.fecha_local).slice(0, 10);
                    k = "".concat(m.idcolaborador, "|").concat(dia);
                    if (!idx.has(k)) {
                        idx.set(k, {});
                    }
                    idx.get(k)[m.tipo] = m;
                }
                filas = personal.map(function (p) {
                    var esperados = 0, asistencias = 0, tardanzas = 0, tardanzaMin = 0;
                    var faltas = 0, horas = 0, incompletos = 0, manuales = 0;
                    var detalle = [];
                    for (var _i = 0, dias_1 = dias; _i < dias_1.length; _i++) {
                        var dia = dias_1[_i];
                        var esperada = (0, asistencia_calendario_1.horaEsperada)(p.horario_semanal, dia);
                        var par = idx.get("".concat(p.idcolaborador, "|").concat(dia)) || {};
                        var entrada = par.ENTRADA || null;
                        var salida = par.SALIDA || null;
                        var cerrado = dia < hoyOperativo;
                        if (esperada) {
                            esperados++;
                        }
                        if (entrada) {
                            asistencias++;
                            if ((entrada.tardanza_min || 0) > 0) {
                                tardanzas++;
                                tardanzaMin += entrada.tardanza_min;
                            }
                            if (entrada.metodo === 'MANUAL') {
                                manuales++;
                            }
                            if (salida) {
                                horas += (0, asistencia_calendario_1.horasTurno)((0, asistencia_calendario_1.aTextoLima)(entrada.marcada_at), (0, asistencia_calendario_1.aTextoLima)(salida.marcada_at));
                                if (salida.metodo === 'MANUAL') {
                                    manuales++;
                                }
                            }
                            else if (cerrado) {
                                incompletos++;
                            }
                        }
                        else if (esperada && cerrado) {
                            faltas++;
                        }
                        if (entrada || salida) {
                            detalle.push({
                                fecha: dia,
                                entrada: entrada ? soloHora(entrada.marcada_at) : null,
                                salida: salida ? soloHora(salida.marcada_at) : null,
                                tardanza_min: entrada ? entrada.tardanza_min : null,
                                horas: (entrada && salida) ? (0, asistencia_calendario_1.horasTurno)((0, asistencia_calendario_1.aTextoLima)(entrada.marcada_at), (0, asistencia_calendario_1.aTextoLima)(salida.marcada_at)) : null,
                                manual: !!((entrada && entrada.metodo === 'MANUAL') || (salida && salida.metodo === 'MANUAL'))
                            });
                        }
                    }
                    return {
                        idcolaborador: p.idcolaborador,
                        nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                        dni: p.dni,
                        area: p.idarea ? (nombreArea.get(p.idarea) || '') : '',
                        dias_esperados: esperados,
                        asistencias: asistencias,
                        tardanzas: tardanzas,
                        tardanza_min_total: tardanzaMin,
                        faltas: faltas,
                        dias_incompletos: incompletos,
                        marcas_manuales: manuales,
                        horas_trabajadas: Math.round(horas * 100) / 100,
                        detalle: detalle
                    };
                });
                ok(res, {
                    desde: desde,
                    hasta: hasta,
                    dias: dias.length,
                    hoy: hoyOperativo,
                    hora_corte: corte,
                    filas: filas,
                    totales: {
                        personal: filas.length,
                        asistencias: filas.reduce(function (a, f) { return a + f.asistencias; }, 0),
                        tardanzas: filas.reduce(function (a, f) { return a + f.tardanzas; }, 0),
                        tardanza_min_total: filas.reduce(function (a, f) { return a + f.tardanza_min_total; }, 0),
                        faltas: filas.reduce(function (a, f) { return a + f.faltas; }, 0),
                        dias_incompletos: filas.reduce(function (a, f) { return a + f.dias_incompletos; }, 0),
                        horas_trabajadas: Math.round(filas.reduce(function (a, f) { return a + f.horas_trabajadas; }, 0) * 100) / 100
                    }
                });
                return [2 /*return*/];
        }
    });
}); }));
exports["default"] = router;
