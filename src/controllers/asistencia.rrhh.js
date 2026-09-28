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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var express = __importStar(require("express"));
var client_1 = require("@prisma/client");
var asistencia_1 = require("./asistencia");
var cfg = __importStar(require("../services/asistencia.config"));
var asistencia_config_1 = require("../services/asistencia.config");
var asistencia_bitacora_1 = require("../services/asistencia.bitacora");
var planilla = __importStar(require("../services/asistencia.planilla"));
var ausencias = __importStar(require("../services/asistencia.ausencias"));
var planillaCfg = __importStar(require("../services/planilla.config"));
var costo = __importStar(require("../services/planilla.costo"));
var ficha = __importStar(require("../services/asistencia.ficha"));
var reportes = __importStar(require("../services/asistencia.reportes"));
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
/**
 * Sobre que empresa y sede se trabaja.
 *
 * La EMPRESA sale siempre del token y no se puede pedir otra. La SEDE se puede
 * cambiar -- una cadena administra varios locales desde el mismo login -- pero
 * solo entre las de esa misma empresa, y se verifica contra la base.
 *
 * Ese chequeo es el unico que impide que cambiar un numero en la URL muestre el
 * personal y la planilla de otra empresa. Por eso vive aqui, en el camino
 * obligatorio de los 27 endpoints, y no repetido en cada uno.
 */
function tenantDe(req) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function () {
        var idorg, propia, pedida, s;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    idorg = Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.idorg);
                    propia = Number((_b = req.token) === null || _b === void 0 ? void 0 : _b.idsede);
                    if (!idorg || !propia) {
                        throw new asistencia_config_1.Invalido('El token no trae empresa o sede.', 401);
                    }
                    pedida = Number((_d = (_c = req.query) === null || _c === void 0 ? void 0 : _c.idsede) !== null && _d !== void 0 ? _d : (_e = req.body) === null || _e === void 0 ? void 0 : _e.idsede) || 0;
                    // El camino comun -- trabajar sobre el propio local -- no consulta nada.
                    // El alcance solo importa cuando se cruza de sede.
                    if (!pedida || pedida === propia) {
                        return [2 /*return*/, { idorg: idorg, idsede: propia }];
                    }
                    return [4 /*yield*/, prisma.sede.findFirst({
                            where: { idsede: pedida, idorg: idorg, estado: '0' }
                        })];
                case 1:
                    s = _f.sent();
                    if (!s) {
                        throw new asistencia_config_1.Invalido('Esa sede no es de tu empresa o no esta activa.', 403);
                    }
                    return [4 /*yield*/, puedeVerSede(req, idorg, pedida)];
                case 2:
                    if (!(_f.sent())) {
                        throw new asistencia_config_1.Invalido('Tu usuario no tiene acceso a ese local.', 403);
                    }
                    return [2 /*return*/, { idorg: idorg, idsede: pedida }];
            }
        });
    });
}
/**
 * Puede este usuario trabajar sobre esa sede?
 *
 * Se lee de la base y no del token a proposito: quitarle un local a alguien
 * tiene que valer en el proximo pedido, no cuando se le venza la sesion. Un
 * permiso que tarda ocho horas en revocarse no es un permiso.
 */
function puedeVerSede(req, idorg, idsede) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var u, asignada;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.usuario.findFirst({
                        where: { idusuario: Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.id) || 0, idorg: idorg, estado: '0' }
                    })];
                case 1:
                    u = _b.sent();
                    if (!u) {
                        return [2 /*return*/, false];
                    }
                    if (u.alcance === 'EMPRESA') {
                        return [2 /*return*/, true];
                    }
                    if (u.alcance !== 'ASIGNADAS') {
                        return [2 /*return*/, false];
                    } // SEDE, o un valor raro
                    return [4 /*yield*/, prisma.usuario_sede.findFirst({
                            where: { idusuario: u.idusuario, idsede: idsede }
                        })];
                case 2:
                    asignada = _b.sent();
                    return [2 /*return*/, !!asignada];
            }
        });
    });
}
/** Los locales sobre los que este usuario puede trabajar. */
function sedesPermitidas(req, idorg) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var u, propia, alcance, filas;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, prisma.usuario.findFirst({
                        where: { idusuario: Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.id) || 0, idorg: idorg, estado: '0' }
                    })];
                case 1:
                    u = _c.sent();
                    propia = Number((_b = req.token) === null || _b === void 0 ? void 0 : _b.idsede) || 0;
                    alcance = (u === null || u === void 0 ? void 0 : u.alcance) || 'SEDE';
                    if (alcance === 'EMPRESA') {
                        return [2 /*return*/, { alcance: alcance, ids: null }];
                    }
                    if (!(alcance === 'ASIGNADAS')) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.usuario_sede.findMany({
                            where: { idusuario: u.idusuario }
                        })];
                case 2:
                    filas = _c.sent();
                    // La propia va siempre: nadie deberia quedar sin acceso a su local por
                    // un olvido al armar la lista.
                    return [2 /*return*/, { alcance: alcance, ids: Array.from(new Set(__spreadArray([propia], filas.map(function (f) { return f.idsede; }), true))) }];
                case 3: return [2 /*return*/, { alcance: alcance, ids: [propia] }];
            }
        });
    });
}
/**
 * Las sedes entre las que se puede elegir.
 *
 * Trae cuanta gente tiene cada una para que el selector diga algo util: en una
 * cadena, saber cual local esta sin personal cargado es la mitad del trabajo.
 */
function listarSedes(idorg) {
    return __awaiter(this, void 0, void 0, function () {
        var sedes, personal, cuenta;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.sede.findMany({
                        where: { idorg: idorg, estado: '0' },
                        orderBy: [{ principal: 'desc' }, { nombre: 'asc' }]
                    })];
                case 1:
                    sedes = _a.sent();
                    return [4 /*yield*/, prisma.colaborador.groupBy({
                            by: ['idsede'],
                            where: { idorg: idorg, estado: 0 },
                            _count: { idcolaborador: true }
                        })];
                case 2:
                    personal = _a.sent();
                    cuenta = new Map(personal.map(function (p) { return [p.idsede, p._count.idcolaborador]; }));
                    return [2 /*return*/, sedes.map(function (s) { return ({
                            idsede: s.idsede,
                            nombre: s.nombre,
                            ciudad: s.ciudad,
                            principal: s.principal === '1',
                            personal: cuenta.get(s.idsede) || 0,
                            configurada: !!s.asis_configurado
                        }); })];
            }
        });
    });
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
// Las sedes de la empresa, para el selector. La empresa sale del token: aca no
// hay nada que elegir mas alla de sus propios locales.
router.get('/sedes', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var idorg, permitidas, todas, sedes;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                idorg = Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.idorg);
                if (!idorg) {
                    throw new asistencia_config_1.Invalido('El token no trae empresa.', 401);
                }
                return [4 /*yield*/, sedesPermitidas(req, idorg)];
            case 1:
                permitidas = _c.sent();
                return [4 /*yield*/, listarSedes(idorg)];
            case 2:
                todas = _c.sent();
                sedes = permitidas.ids === null
                    ? todas
                    : todas.filter(function (s) { return permitidas.ids.includes(s.idsede); });
                ok(res, {
                    sedes: sedes,
                    idsede_token: Number((_b = req.token) === null || _b === void 0 ? void 0 : _b.idsede) || 0,
                    // La pantalla lo usa para no ofrecer un combo de una sola opcion
                    alcance: permitidas.alcance
                });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Quien ve que locales
// ---------------------------------------------------------------------------
var ALCANCES = ['SEDE', 'ASIGNADAS', 'EMPRESA'];
/**
 * Solo un usuario con alcance EMPRESA puede repartir accesos.
 *
 * Es el candado que sostiene todo lo demas: sin el, cualquiera se asciende solo
 * con un pedido y los otros dos alcances son decorativos.
 */
function exigirAlcanceEmpresa(req, idorg) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var u;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.usuario.findFirst({
                        where: { idusuario: Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.id) || 0, idorg: idorg, estado: '0' }
                    })];
                case 1:
                    u = _b.sent();
                    if (!u || u.alcance !== 'EMPRESA') {
                        throw new asistencia_config_1.Invalido('Solo quien administra todos los locales puede cambiar estos accesos.', 403);
                    }
                    return [2 /*return*/, u];
            }
        });
    });
}
router.get('/usuarios', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var idorg, usuarios, asignadas, porUsuario, _i, asignadas_1, a, sedes, nombreSede;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                idorg = Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.idorg);
                if (!idorg) {
                    throw new asistencia_config_1.Invalido('El token no trae empresa.', 401);
                }
                return [4 /*yield*/, exigirAlcanceEmpresa(req, idorg)];
            case 1:
                _c.sent();
                return [4 /*yield*/, prisma.usuario.findMany({
                        where: { idorg: idorg, estado: '0' },
                        orderBy: { nombres: 'asc' }
                    })];
            case 2:
                usuarios = _c.sent();
                return [4 /*yield*/, prisma.usuario_sede.findMany({
                        where: { idusuario: { "in": usuarios.map(function (u) { return u.idusuario; }) } }
                    })];
            case 3:
                asignadas = _c.sent();
                porUsuario = new Map();
                for (_i = 0, asignadas_1 = asignadas; _i < asignadas_1.length; _i++) {
                    a = asignadas_1[_i];
                    if (!porUsuario.has(a.idusuario)) {
                        porUsuario.set(a.idusuario, []);
                    }
                    porUsuario.get(a.idusuario).push(a.idsede);
                }
                return [4 /*yield*/, listarSedes(idorg)];
            case 4:
                sedes = _c.sent();
                nombreSede = new Map(sedes.map(function (x) { return [x.idsede, x.nombre]; }));
                ok(res, {
                    sedes: sedes,
                    yo: Number((_b = req.token) === null || _b === void 0 ? void 0 : _b.id) || 0,
                    usuarios: usuarios.map(function (u) { return ({
                        idusuario: u.idusuario,
                        nombres: u.nombres,
                        usuario: u.usuario,
                        cargo: u.cargo,
                        alcance: u.alcance,
                        sede_propia: u.idsede,
                        sede_propia_nombre: nombreSede.get(u.idsede) || '',
                        asignadas: porUsuario.get(u.idusuario) || []
                    }); })
                });
                return [2 /*return*/];
        }
    });
}); }));
router.put('/usuarios/:id/alcance', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var idorg, yo, id, destino, alcance, ids, validas, sede;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                idorg = Number((_a = req.token) === null || _a === void 0 ? void 0 : _a.idorg);
                if (!idorg) {
                    throw new asistencia_config_1.Invalido('El token no trae empresa.', 401);
                }
                return [4 /*yield*/, exigirAlcanceEmpresa(req, idorg)];
            case 1:
                yo = _e.sent();
                id = Number(req.params.id) || 0;
                return [4 /*yield*/, prisma.usuario.findFirst({
                        where: { idusuario: id, idorg: idorg, estado: '0' }
                    })];
            case 2:
                destino = _e.sent();
                if (!destino) {
                    throw new asistencia_config_1.Invalido('Ese usuario no es de tu empresa.', 404);
                }
                alcance = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.alcance) || '').toUpperCase();
                if (!ALCANCES.includes(alcance)) {
                    throw new asistencia_config_1.Invalido('Alcance no valido.');
                }
                // Nadie se quita a si mismo el permiso de repartir permisos: si es el
                // unico con alcance EMPRESA, la empresa queda sin quien pueda devolverselo
                // y hay que arreglarlo con SQL.
                if (destino.idusuario === yo.idusuario && alcance !== 'EMPRESA') {
                    throw new asistencia_config_1.Invalido('No puedes quitarte a ti mismo el acceso a todos los locales.');
                }
                ids = (Array.isArray((_c = req.body) === null || _c === void 0 ? void 0 : _c.sedes) ? req.body.sedes : []).map(Number).filter(Boolean);
                if (!(alcance === 'ASIGNADAS')) return [3 /*break*/, 4];
                if (!ids.length) {
                    throw new asistencia_config_1.Invalido('Elige al menos un local, o usa otro alcance.');
                }
                return [4 /*yield*/, prisma.sede.findMany({
                        where: { idsede: { "in": ids }, idorg: idorg, estado: '0' },
                        select: { idsede: true }
                    })];
            case 3:
                validas = _e.sent();
                if (validas.length !== ids.length) {
                    throw new asistencia_config_1.Invalido('Alguno de esos locales no es de tu empresa o esta dado de baja.', 403);
                }
                _e.label = 4;
            case 4: return [4 /*yield*/, prisma.usuario.update({
                    where: { idusuario: id },
                    data: { alcance: alcance }
                })];
            case 5:
                _e.sent();
                // La lista se reescribe entera: es mas simple de razonar que calcular
                // altas y bajas, y aqui son pocas filas.
                return [4 /*yield*/, prisma.usuario_sede.deleteMany({ where: { idusuario: id } })];
            case 6:
                // La lista se reescribe entera: es mas simple de razonar que calcular
                // altas y bajas, y aqui son pocas filas.
                _e.sent();
                if (!(alcance === 'ASIGNADAS')) return [3 /*break*/, 8];
                return [4 /*yield*/, prisma.usuario_sede.createMany({
                        data: ids.map(function (idsede) { return ({
                            idusuario: id,
                            idsede: idsede,
                            creado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)())
                        }); })
                    })];
            case 7:
                _e.sent();
                _e.label = 8;
            case 8: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: destino.idsede } })];
            case 9:
                sede = _e.sent();
                return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                        idorg: idorg,
                        idsede_restobar: (_d = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _d !== void 0 ? _d : 0,
                        entidad: 'POLITICA', accion: 'MODIFICA',
                        detalle: "Acceso de ".concat(destino.nombres, ": ").concat(destino.alcance, " -> ").concat(alcance) +
                            (alcance === 'ASIGNADAS' ? " (".concat(ids.length, " local(es))") : ''),
                        anterior: { alcance: destino.alcance },
                        nuevo: { alcance: alcance, sedes: ids }
                    }, autorRrhh(req))];
            case 10:
                _e.sent();
                ok(res, { idusuario: id, alcance: alcance, sedes: ids });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Personal y horarios
// ---------------------------------------------------------------------------
router.get('/personal', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, idorg, idsede, filas, areas, nombreArea;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tenantDe(req)];
            case 1:
                _a = _b.sent(), idorg = _a.idorg, idsede = _a.idsede;
                return [4 /*yield*/, prisma.colaborador.findMany({
                        where: { idorg: idorg, idsede: idsede, estado: 0 },
                        orderBy: { nombres: 'asc' }
                    })];
            case 2:
                filas = _b.sent();
                return [4 /*yield*/, prisma.area.findMany({
                        where: { estado: '0', OR: [{ idsede: 0 }, { idsede: idsede }] },
                        select: { idarea: true, descripcion: true }
                    })];
            case 3:
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
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).listarAreas;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent()])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/personal/area', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).asignarArea;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// El mismo horario para todo un grupo: la cocina entera suele entrar a la
// misma hora y cargarlo uno por uno son quince dialogos identicos.
router.post('/personal/horario-masivo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).horarioMasivo;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.put('/personal/:id/horario', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).guardarHorario;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), __assign(__assign({}, req.body), { idcolaborador: req.params.id }), autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------
router.get('/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    var _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).leerConfiguracion;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_f.sent(), (_e = req.query) === null || _e === void 0 ? void 0 : _e.anio])];
            case 2:
                _a.apply(void 0, _b.concat([_f.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/configuracion/listo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).marcarConfigurado;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent()])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).guardarConfiguracion;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/calendario/:mes', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).calendarioMes;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.params.mes])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/calendario/dia/:fecha', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).calendarioDia;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.params.fecha])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/calendario/excepcion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).guardarExcepcion;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router["delete"]('/calendario/excepcion/:id', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).eliminarExcepcion;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.params.id, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/calendario/dias-cierre', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).guardarDiasCierre;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body.dias, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.get('/feriados/:anio?', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).listarFeriados;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.params.anio])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/feriados', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).guardarFeriado;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router["delete"]('/feriados/:id', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).eliminarFeriado;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.params.id, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Ausencias: por que alguien no esta marcando
// ---------------------------------------------------------------------------
router.get('/ausencias/alertas', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = ausencias).alertas;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent()])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/ausencias/registrar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = ausencias).registrarAusencia;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/ausencias/baja', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = ausencias).darDeBaja;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
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
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = planillaCfg).leerConfig;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent()])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/configuracion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = planillaCfg).guardarConfig;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// El mes de UNA persona, dia por dia. Es lo que se mira cuando alguien
// pregunta por que le descontaron.
router.post('/asistencia/ficha', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = ficha).fichaDelMes;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// Cuanto cuesta el personal del periodo. Es la misma cuenta que la planilla,
// sumada y con el aporte del empleador encima.
router.post('/planilla/costo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = costo).costoDePersonal;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/calcular', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = planilla).calcular;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
router.post('/planilla/aplicar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = planilla).aplicar;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.body, autorRrhh(req)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------
router.get('/bitacora', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = cfg).listarBitacora;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), req.query])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
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
            case 0: return [4 /*yield*/, tenantDe(req)];
            case 1:
                _a = _d.sent(), idorg = _a.idorg, idsede = _a.idsede;
                _b = ok;
                _c = [res];
                return [4 /*yield*/, (0, asistencia_1.datosDia)(idorg, idsede, req.params.fecha)];
            case 2:
                _b.apply(void 0, _c.concat([_d.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------
router.get('/reporte/:desde/:hasta', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = reportes).reporteRango;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), String(req.params.desde), String(req.params.hasta)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// El registro que exige el D.S. 004-2006-TR: dia por dia, sin resumir, con el
// RUC del empleador y el DNI de cada trabajador. Se conserva 5 anos.
router.get('/registro-jornada/:desde/:hasta', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = ok;
                _b = [res];
                _d = (_c = reportes).registroJornada;
                return [4 /*yield*/, tenantDe(req)];
            case 1: return [4 /*yield*/, _d.apply(_c, [_e.sent(), String(req.params.desde), String(req.params.hasta)])];
            case 2:
                _a.apply(void 0, _b.concat([_e.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
exports["default"] = router;
