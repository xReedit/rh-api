"use strict";
// Cuantos intentos por minuto acepta el marcador de cada local.
//
// EL PROBLEMA QUE RESUELVE
// En un local todas las marcas salen por la MISMA IP -- la del local -- asi que
// un numero fijo no puede servir para todos: el que le sobra a un restaurante
// de seis personas le queda corto a uno de cuarenta saliendo juntos del turno.
// Y cuando queda corto, el sintoma es el peor: la gente escanea y el marcador
// les dice que esperen, justo cuando se estan por ir.
//
// COMO SE RESUELVE
// Se pregunta UNA cosa que el dueno sabe de memoria -- cuanta gente marca -- y
// los cinco limites salen de ahi. Si no configuro nada, se cuenta el personal
// cargado en la sede.
//
// POR QUE HAY CACHE
// El limite se consulta en CADA pedido publico, antes de tocar nada. Ir a la
// base cada vez convertiria el escudo en la carga que se queria evitar. Cinco
// minutos de cache: cambiar el numero tarda un rato en verse, y eso esta bien
// para un valor que se toca una vez al ano.
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
exports.olvidarCache = exports.limitesDeInvitacion = exports.limitesDeToken = exports.limitesDeKiosko = exports.LIMITES_POR_DEFECTO = exports.limitesPara = void 0;
var client_1 = require("@prisma/client");
var crypto = __importStar(require("crypto"));
var prisma = new client_1.PrismaClient();
/** Cuanta gente se asume cuando no hay ni configuracion ni personal cargado. */
var PERSONAS_POR_DEFECTO = 15;
/** Techo: mas que esto ya no protege de nada. */
var PERSONAS_MAX = 300;
var CACHE_MS = 5 * 60000;
/**
 * Los cinco limites a partir de cuanta gente marca.
 *
 * Los factores salen de como se usa cada endpoint, no de una formula:
 *   - `codigo` lo pide la PANTALLA cada 15 s, no las personas: 4 por minuto por
 *     pantalla. Se deja lugar para varias pantallas y para reintentos.
 *   - `marcar` es una vez por persona al entrar y otra al salir, pero todo el
 *     turno puede salir en el mismo minuto. Se da el doble de la gente.
 *   - enrolar pasa una vez por persona en la vida del celular: alcanza poco.
 */
function limitesPara(personas) {
    var n = Math.max(1, Math.min(personas || PERSONAS_POR_DEFECTO, PERSONAS_MAX));
    return {
        codigo: Math.max(60, n * 8),
        marcar: Math.max(20, n * 2),
        marcar_info: Math.max(30, n * 3),
        enrolar_info: Math.max(20, n),
        enrolar_confirmar: Math.max(15, n)
    };
}
exports.limitesPara = limitesPara;
exports.LIMITES_POR_DEFECTO = limitesPara(PERSONAS_POR_DEFECTO);
/**
 * Un solo cache para las tres formas de llegar al local, con la clave
 * prefijada: 'k:' por id de kiosko, 't:' por token y 'i:' por invitacion.
 *
 * TIENE TOPE A PROPOSITO. Las claves 't:' e 'i:' vienen de lo que MANDA EL
 * CLIENTE, y se guardan aunque no existan -- ese es justamente el caso que hay
 * que frenar barato. Sin tope, alguien probando valores al azar llenaria la
 * memoria del servidor a fuerza de pedidos fallidos.
 */
var TOPE_CACHE = 2000;
var cache = new Map();
function recordar(clave, limites) {
    // Al llenarse se vacia entero en vez de expulsar el mas viejo: un LRU aqui
    // seria codigo y estructura para ahorrar unas consultas cada tanto.
    if (cache.size >= TOPE_CACHE) {
        cache.clear();
    }
    cache.set(clave, { limites: limites, hasta: Date.now() + CACHE_MS });
}
/**
 * Cuanta gente marca en una sede, segun lo configurado o el personal cargado.
 * `idsede` es el de Recursos Humanos, no el del POS.
 */
function limitesDeSede(idorg, idsede) {
    return __awaiter(this, void 0, void 0, function () {
        var sede, configurado, personas, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.sede.findFirst({ where: { idorg: idorg, idsede: idsede } })];
                case 1:
                    sede = _b.sent();
                    configurado = Number(sede === null || sede === void 0 ? void 0 : sede.marcador_personas) || 0;
                    _a = configurado;
                    if (_a) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.colaborador.count({
                            where: { idorg: idorg, idsede: idsede, estado: 0 }
                        })];
                case 2:
                    _a = (_b.sent());
                    _b.label = 3;
                case 3:
                    personas = _a;
                    return [2 /*return*/, limitesPara(personas)];
            }
        });
    });
}
/**
 * El molde de las tres busquedas: cache, consulta, y por defecto si algo falla.
 *
 * Si el kiosko no existe, la invitacion no sirve o la base no responde,
 * devuelve los valores por defecto. Un error al LEER la configuracion no puede
 * dejar sin marcar a todo un local: el escudo se cae del lado seguro.
 */
function resolver(clave, buscar) {
    return __awaiter(this, void 0, void 0, function () {
        var en, limites, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    en = cache.get(clave);
                    if (en && en.hasta > Date.now()) {
                        return [2 /*return*/, en.limites];
                    }
                    limites = exports.LIMITES_POR_DEFECTO;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, buscar()];
                case 2:
                    limites = (_a.sent()) || exports.LIMITES_POR_DEFECTO;
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('[limites] no se pudo leer la configuracion de', clave, e_1);
                    return [3 /*break*/, 4];
                case 4:
                    recordar(clave, limites);
                    return [2 /*return*/, limites];
            }
        });
    });
}
/** Los limites del local al que pertenece un marcador, por su id. */
function limitesDeKiosko(idkiosko) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (!idkiosko) {
                return [2 /*return*/, exports.LIMITES_POR_DEFECTO];
            }
            return [2 /*return*/, resolver('k:' + idkiosko, function () { return __awaiter(_this, void 0, void 0, function () {
                    var k, sede;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, prisma.asistencia_kiosko.findFirst({
                                    where: { idkiosko: idkiosko, revocado_at: null }
                                })];
                            case 1:
                                k = _a.sent();
                                if (!k) {
                                    return [2 /*return*/, null];
                                }
                                return [4 /*yield*/, prisma.sede.findFirst({
                                        where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar }
                                    })];
                            case 2:
                                sede = _a.sent();
                                return [2 /*return*/, sede ? limitesDeSede(k.idorg, sede.idsede) : null];
                        }
                    });
                }); })];
        });
    });
}
exports.limitesDeKiosko = limitesDeKiosko;
/**
 * Lo mismo, pero cuando lo unico que llega es el token de la pantalla.
 *
 * Es el caso de /codigo, que se pide cada 15 segundos y no manda idkiosko. Se
 * busca por `token_hash`, que tiene indice unico: un token inventado cuesta una
 * busqueda por indice, no un recorrido de la tabla.
 */
function limitesDeToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var hash;
        var _this = this;
        return __generator(this, function (_a) {
            if (!token) {
                return [2 /*return*/, exports.LIMITES_POR_DEFECTO];
            }
            hash = crypto.createHash('sha256').update(token).digest('hex');
            return [2 /*return*/, resolver('t:' + hash, function () { return __awaiter(_this, void 0, void 0, function () {
                    var k, sede;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, prisma.asistencia_kiosko.findFirst({
                                    where: { token_hash: hash, revocado_at: null }
                                })];
                            case 1:
                                k = _a.sent();
                                if (!k) {
                                    return [2 /*return*/, null];
                                }
                                return [4 /*yield*/, prisma.sede.findFirst({
                                        where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar }
                                    })];
                            case 2:
                                sede = _a.sent();
                                return [2 /*return*/, sede ? limitesDeSede(k.idorg, sede.idsede) : null];
                        }
                    });
                }); })];
        });
    });
}
exports.limitesDeToken = limitesDeToken;
/**
 * Lo mismo, cuando lo unico que llega es el codigo de invitacion a enrolarse.
 *
 * Busca por `colaborador.qr_invitacion`, indexado en la migracion 061. Sin ese
 * indice cada intento fallido recorreria la tabla entera de colaboradores, que
 * es precisamente el gasto que el limite existe para evitar.
 */
function limitesDeInvitacion(uuid) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (!uuid) {
                return [2 /*return*/, exports.LIMITES_POR_DEFECTO];
            }
            return [2 /*return*/, resolver('i:' + uuid, function () { return __awaiter(_this, void 0, void 0, function () {
                    var c;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, prisma.colaborador.findFirst({
                                    where: { qr_invitacion: uuid }
                                })];
                            case 1:
                                c = _a.sent();
                                return [2 /*return*/, c ? limitesDeSede(c.idorg, c.idsede) : null];
                        }
                    });
                }); })];
        });
    });
}
exports.limitesDeInvitacion = limitesDeInvitacion;
/** Para que un cambio de configuracion se vea sin esperar los cinco minutos. */
function olvidarCache() { cache.clear(); }
exports.olvidarCache = olvidarCache;
