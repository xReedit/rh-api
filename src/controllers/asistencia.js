"use strict";
// Modulo de Asistencia: padron y horarios.
//
// Lo llama SOLO el POS legacy (bdphp/log_asistencia.php), nunca un navegador.
// La empresa y la sede salen del token firmado (req.pos), jamas del body: es lo
// que impide que alguien con acceso al POS lea o escriba el padron de otra sede.
//
// Esta API no puede leer la BD `restobar` (vive en el servidor de cada sede,
// 30 de 45 sedes corren servidor local). Por eso los datos de restobar -- la
// ficha de la empresa y la lista de usuarios a importar -- los MANDA el POS y
// aqui solo se cotejan contra `rrhh`.
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
exports.publico = exports.datosDia = exports.contextoLaboral = void 0;
var express = __importStar(require("express"));
var crypto = __importStar(require("crypto"));
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("../services/asistencia.calendario");
var asistencia_codigo_1 = require("../services/asistencia.codigo");
var asistencia_gps_1 = require("../services/asistencia.gps");
var asistencia_dialaboral_1 = require("../services/asistencia.dialaboral");
var cfg = __importStar(require("../services/asistencia.config"));
var ausencias = __importStar(require("../services/asistencia.ausencias"));
var asistencia_config_1 = require("../services/asistencia.config");
exports.contextoLaboral = asistencia_config_1.contextoLaboral;
var prisma = new client_1.PrismaClient();
var router = express.Router();
// Cuanto vive cada cosa
var INVITACION_MIN = 15; // la invitacion se escanea en el momento, delante del admin
var DISPOSITIVO_DIAS = 180; // el celular queda enrolado medio ano
// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
var ok = function (res, datos) {
    if (datos === void 0) { datos = null; }
    return res.status(200).json({ success: true, datos: datos, error: '' });
};
var mal = function (res, error, code) {
    if (code === void 0) { code = 400; }
    return res.status(code).json({ success: false, datos: null, error: error });
};
var texto = function (v, max) {
    if (max === void 0) { max = 200; }
    return (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);
};
/** Para cotejar nombres: sin tildes, sin dobles espacios, en mayusculas. */
var normalizar = function (v) {
    return texto(v).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
};
var hoy = function () { return new Date().toISOString().slice(0, 10); };
/** Envuelve un handler async para que un throw no tumbe el proceso. */
var asinc = function (fn) { return function (req, res) {
    return fn(req, res)["catch"](function (e) {
        // Invalido es "pediste mal", no "se rompio": no ensucia el log ni sale 500
        if (e instanceof asistencia_config_1.Invalido) {
            return mal(res, e.message, e.code);
        }
        console.error('[asistencia]', req.path, e);
        mal(res, e.message || 'error interno', 500);
    });
}; };
function resolverTenant(pos, ficha) {
    return __awaiter(this, void 0, void 0, function () {
        var org, f, sede, f, corte, hora_corte;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ficha = ficha || {};
                    return [4 /*yield*/, prisma.org.findFirst({ where: { idorg_restobar: pos.ido, estado: '0' } })];
                case 1:
                    org = _a.sent();
                    if (!!org) return [3 /*break*/, 3];
                    f = ficha.org || {};
                    if (!texto(f.nombre)) {
                        throw new Error('la empresa no existe en rrhh y el POS no mando su ficha');
                    }
                    return [4 /*yield*/, prisma.org.create({
                            data: {
                                nombre: texto(f.nombre, 150),
                                direccion: texto(f.direccion, 150),
                                ruc: texto(f.ruc, 20),
                                telefono: texto(f.telefono, 50),
                                idorg_restobar: pos.ido,
                                estado: '0'
                            }
                        })];
                case 2:
                    org = _a.sent();
                    _a.label = 3;
                case 3: return [4 /*yield*/, prisma.sede.findFirst({ where: { idorg: org.idorg, idsede_restobar: pos.idsede } })];
                case 4:
                    sede = _a.sent();
                    if (!!sede) return [3 /*break*/, 6];
                    f = ficha.sede || {};
                    if (!texto(f.nombre)) {
                        throw new Error('la sede no existe en rrhh y el POS no mando su ficha');
                    }
                    return [4 /*yield*/, prisma.sede.create({
                            data: {
                                idorg: org.idorg,
                                idsede_restobar: pos.idsede,
                                ruc: texto(f.ruc, 15),
                                razon_social: texto(f.razon_social, 100),
                                nombre: texto(f.nombre, 150),
                                ciudad: texto(f.ciudad, 100),
                                direccion: texto(f.direccion, 100),
                                telefono: texto(f.telefono, 50),
                                estado: '0',
                                principal: '0'
                            }
                        })];
                case 5:
                    // rrhh.sede tiene casi todo NOT NULL sin default: nunca mandar null
                    sede = _a.sent();
                    _a.label = 6;
                case 6:
                    corte = org.asis_hora_corte;
                    hora_corte = corte instanceof Date ? corte.toISOString().slice(11, 19) : String(corte || '05:00:00');
                    return [2 /*return*/, { idorg: org.idorg, idsede: sede.idsede, hora_corte: hora_corte }];
            }
        });
    });
}
/**
 * Quien esta haciendo el cambio, para la bitacora.
 *
 * El nombre lo manda el POS porque esta API no puede leer `restobar.usuario`.
 * `autorizado` viene solo cuando el que opera NO es administrador y tuvo que
 * pedir la clave de uno: guardar las dos personas es el punto de la auditoria.
 */
function autorPos(req) {
    var u = (req.body && req.body.usuario) || {};
    var a = (req.body && req.body.autorizado) || {};
    return {
        origen: 'POS',
        idusuario: req.pos.idusuario || null,
        nombre: String(u.nombre || ''),
        autorizado_por: Number(a.idusuario) || null,
        autorizado_nombre: String(a.nombre || '')
    };
}
router.get('/', function (_req, res) { return res.status(200).json({ message: 'Estas conectado a asistencia' }); });
router.post('/tenant', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = ok;
                _b = [res];
                return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Padron
// ---------------------------------------------------------------------------
/** Colaboradores activos de la sede, con su horario y si ya tienen celular enrolado. */
router.post('/personal/listar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, filas, ids, dispositivos, _a, porColab, _i, _b, d, areas, nombreArea, _c, _d, a;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _e.sent();
                return [4 /*yield*/, prisma.colaborador.findMany({
                        where: { idorg: t.idorg, idsede: t.idsede, estado: 0 },
                        orderBy: { nombres: 'asc' }
                    })];
            case 2:
                filas = _e.sent();
                ids = filas.map(function (c) { return c.idcolaborador; });
                if (!ids.length) return [3 /*break*/, 4];
                return [4 /*yield*/, prisma.colaborador_dispositivo.findMany({
                        where: { idcolaborador: { "in": ids }, activo: true },
                        select: { idcolaborador: true, creado_at: true, expira_at: true }
                    })];
            case 3:
                _a = _e.sent();
                return [3 /*break*/, 5];
            case 4:
                _a = [];
                _e.label = 5;
            case 5:
                dispositivos = _a;
                porColab = new Map();
                for (_i = 0, _b = dispositivos; _i < _b.length; _i++) {
                    d = _b[_i];
                    porColab.set(d.idcolaborador, d);
                }
                return [4 /*yield*/, prisma.area.findMany({
                        where: areasDeLaSede(t.idsede),
                        select: { idarea: true, descripcion: true }
                    })];
            case 6:
                areas = _e.sent();
                nombreArea = new Map();
                for (_c = 0, _d = areas; _c < _d.length; _c++) {
                    a = _d[_c];
                    nombreArea.set(a.idarea, a.descripcion);
                }
                ok(res, {
                    tenant: t,
                    personal: filas.map(function (c) {
                        var d = porColab.get(c.idcolaborador);
                        return {
                            idcolaborador: c.idcolaborador,
                            nombres: c.nombres,
                            apellidos: c.apellidos || '',
                            dni: c.dni,
                            idarea: c.idarea,
                            area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
                            idusuario_restobar: c.idusuario_restobar,
                            horario_semanal: c.horario_semanal,
                            tolerancia_min: c.tolerancia_min,
                            tiene_dispositivo: !!d,
                            dispositivo_desde: d ? d.creado_at : null,
                            dispositivo_expira: d ? d.expira_at : null
                        };
                    })
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * Previsualizar el import: el POS manda los usuarios de SU sede y aqui se marca
 * cuales ya existen. Nunca inserta. El admin destilda y recien confirma.
 *
 * El match va en cascada: idusuario_restobar -> dni -> nombre normalizado.
 * Asi re-importar no duplica ni siquiera a quien se creo a mano antes.
 */
router.post('/personal/importar/preview', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, entrantes, existentes, porUsuario, porDni, porNombre, _i, _a, c, filas;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _b.sent();
                entrantes = Array.isArray(req.body.usuarios) ? req.body.usuarios : [];
                if (!entrantes.length) {
                    return [2 /*return*/, mal(res, 'el POS no mando usuarios')];
                }
                return [4 /*yield*/, prisma.colaborador.findMany({ where: { idorg: t.idorg } })];
            case 2:
                existentes = _b.sent();
                porUsuario = new Map();
                porDni = new Map();
                porNombre = new Map();
                for (_i = 0, _a = existentes; _i < _a.length; _i++) {
                    c = _a[_i];
                    if (c.idusuario_restobar) {
                        porUsuario.set(Number(c.idusuario_restobar), c);
                    }
                    if (texto(c.dni)) {
                        porDni.set(texto(c.dni), c);
                    }
                    porNombre.set(normalizar("".concat(c.nombres, " ").concat(c.apellidos || '')), c);
                }
                filas = entrantes.map(function (u) {
                    var idus = Number(u.idusuario) || 0;
                    var dni = texto(u.dni, 20);
                    var nombre = texto(u.nombres, 200);
                    var halla = porUsuario.get(idus)
                        || (dni ? porDni.get(dni) : null)
                        || porNombre.get(normalizar(nombre));
                    return {
                        idusuario: idus,
                        nombres: nombre,
                        dni: dni,
                        existe: !!halla,
                        idcolaborador: halla ? halla.idcolaborador : null,
                        // ya esta en rrhh pero sin el puente al POS: conviene enlazarlo
                        enlazar: !!(halla && !halla.idusuario_restobar)
                    };
                });
                ok(res, { tenant: t, filas: filas, nuevos: filas.filter(function (f) { return !f.existe; }).length });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * Confirmar el import. Inserta los que no existen y enlaza (solo el puente) a
 * los que ya estaban sin idusuario_restobar. Nunca pisa datos de planilla.
 */
router.post('/personal/importar/confirmar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, entrantes, creados, enlazados, _i, entrantes_1, u, idus, nombres, dni, yaEsta, _a, suelto;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _b.sent();
                entrantes = Array.isArray(req.body.usuarios) ? req.body.usuarios : [];
                if (!entrantes.length) {
                    return [2 /*return*/, mal(res, 'no se selecciono a nadie')];
                }
                creados = 0, enlazados = 0;
                _i = 0, entrantes_1 = entrantes;
                _b.label = 2;
            case 2:
                if (!(_i < entrantes_1.length)) return [3 /*break*/, 11];
                u = entrantes_1[_i];
                idus = Number(u.idusuario) || 0;
                nombres = texto(u.nombres, 200);
                dni = texto(u.dni, 20);
                if (!nombres) {
                    return [3 /*break*/, 10];
                }
                if (!idus) return [3 /*break*/, 4];
                return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idorg: t.idorg, idusuario_restobar: idus } })];
            case 3:
                _a = _b.sent();
                return [3 /*break*/, 5];
            case 4:
                _a = null;
                _b.label = 5;
            case 5:
                yaEsta = _a;
                if (yaEsta) {
                    return [3 /*break*/, 10];
                }
                return [4 /*yield*/, prisma.colaborador.findFirst({
                        where: __assign({ idorg: t.idorg, idusuario_restobar: null }, (dni ? { dni: dni } : { nombres: nombres }))
                    })];
            case 6:
                suelto = _b.sent();
                if (!suelto) return [3 /*break*/, 8];
                return [4 /*yield*/, prisma.colaborador.update({
                        where: { idcolaborador: suelto.idcolaborador },
                        data: { idusuario_restobar: idus }
                    })];
            case 7:
                _b.sent();
                enlazados++;
                return [3 /*break*/, 10];
            case 8: 
            // Los campos que el POS no tiene van en blanco (son NOT NULL sin default)
            // y se completan despues en la ficha o desde la app de RRHH.
            return [4 /*yield*/, prisma.colaborador.create({
                    data: {
                        idorg: t.idorg,
                        idsede: t.idsede,
                        nombres: nombres,
                        dni: dni,
                        sexo: '',
                        correo: '',
                        direccion: '',
                        telefono: '',
                        f_nac: '',
                        f_ingreso: hoy(),
                        estado: 0,
                        idusuario_restobar: idus || null,
                        tolerancia_min: 10
                    }
                })];
            case 9:
                // Los campos que el POS no tiene van en blanco (son NOT NULL sin default)
                // y se completan despues en la ficha o desde la app de RRHH.
                _b.sent();
                creados++;
                _b.label = 10;
            case 10:
                _i++;
                return [3 /*break*/, 2];
            case 11:
                ok(res, { creados: creados, enlazados: enlazados });
                return [2 /*return*/];
        }
    });
}); }));
/** Alta manual: para quien trabaja en la sede pero no tiene usuario en el POS. */
router.post('/personal/crear', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, nombres, dni, repetido, c;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                nombres = texto(req.body.nombres, 200);
                if (!nombres) {
                    return [2 /*return*/, mal(res, 'el nombre es obligatorio')];
                }
                dni = texto(req.body.dni, 20);
                if (!dni) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idorg: t.idorg, dni: dni } })];
            case 2:
                repetido = _a.sent();
                if (repetido) {
                    return [2 /*return*/, mal(res, "ya existe un colaborador con el DNI ".concat(dni))];
                }
                _a.label = 3;
            case 3: return [4 /*yield*/, prisma.colaborador.create({
                    data: {
                        idorg: t.idorg,
                        idsede: t.idsede,
                        nombres: nombres,
                        dni: dni,
                        apellidos: texto(req.body.apellidos, 120),
                        sexo: '', correo: '', direccion: '', telefono: '', f_nac: '',
                        f_ingreso: hoy(),
                        estado: 0,
                        tolerancia_min: 10
                    }
                })];
            case 4:
                c = _a.sent();
                ok(res, { idcolaborador: c.idcolaborador });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * Horario semanal y tolerancia.
 * El WHERE lleva idorg: un id de otra empresa no actualiza nada en vez de
 * actualizar lo ajeno.
 */
router.put('/personal/:id/horario', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _c.sent();
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.guardarHorario(t, __assign(__assign({}, req.body), { idcolaborador: req.params.id }), autorPos(req))];
            case 2:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------
//
// Se reusa el catalogo `rrhh.area` que ya usa la app de planilla: idsede = 0
// son las areas comunes (COCINA, ALMACEN, SALON, ADMINISTRATIVO) y el resto
// pertenecen a una sede. Crear otro catalogo habria dejado dos listas de areas
// que se desfasan.
var areasDeLaSede = function (idsede) { return ({ estado: '0', OR: [{ idsede: 0 }, { idsede: idsede }] }); };
router.post('/area/listar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, areas, conteo, porArea, _i, _a, c;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _b.sent();
                return [4 /*yield*/, prisma.area.findMany({
                        where: areasDeLaSede(t.idsede),
                        orderBy: { descripcion: 'asc' },
                        select: { idarea: true, descripcion: true, idsede: true }
                    })];
            case 2:
                areas = _b.sent();
                return [4 /*yield*/, prisma.colaborador.groupBy({
                        by: ['idarea'],
                        where: { idorg: t.idorg, idsede: t.idsede, estado: 0 },
                        _count: { _all: true }
                    })];
            case 3:
                conteo = _b.sent();
                porArea = new Map();
                for (_i = 0, _a = conteo; _i < _a.length; _i++) {
                    c = _a[_i];
                    porArea.set(c.idarea, c._count._all);
                }
                ok(res, {
                    areas: areas.map(function (a) { return (__assign(__assign({}, a), { personal: porArea.get(a.idarea) || 0 })); }),
                    sin_area: porArea.get(null) || 0
                });
                return [2 /*return*/];
        }
    });
}); }));
router.post('/area/crear', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, descripcion, repetida, a;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                descripcion = texto(req.body.descripcion, 50).toUpperCase();
                if (!descripcion) {
                    return [2 /*return*/, mal(res, 'Ponle un nombre al area.')];
                }
                return [4 /*yield*/, prisma.area.findFirst({ where: __assign(__assign({}, areasDeLaSede(t.idsede)), { descripcion: descripcion }) })];
            case 2:
                repetida = _a.sent();
                if (repetida) {
                    return [2 /*return*/, mal(res, "Ya existe un area \"".concat(descripcion, "\"."))];
                }
                return [4 /*yield*/, prisma.area.create({ data: { descripcion: descripcion, idsede: t.idsede, estado: '0' } })];
            case 3:
                a = _a.sent();
                ok(res, { idarea: a.idarea, descripcion: descripcion });
                return [2 /*return*/];
        }
    });
}); }));
/** Asigna area a uno o varios colaboradores de una vez. */
router.post('/personal/area', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, ids, idarea, a, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
                if (!ids.length) {
                    return [2 /*return*/, mal(res, 'No se selecciono a nadie.')];
                }
                idarea = Number(req.body.idarea) || null;
                if (!idarea) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.area.findFirst({ where: __assign({ idarea: idarea }, areasDeLaSede(t.idsede)) })];
            case 2:
                a = _a.sent();
                if (!a) {
                    return [2 /*return*/, mal(res, 'Esa area no es de esta sede.', 404)];
                }
                _a.label = 3;
            case 3: return [4 /*yield*/, prisma.colaborador.updateMany({
                    where: { idcolaborador: { "in": ids }, idorg: t.idorg, idsede: t.idsede },
                    data: { idarea: idarea }
                })];
            case 4:
                r = _a.sent();
                ok(res, { actualizados: r.count });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Horario masivo
// ---------------------------------------------------------------------------
/**
 * Aplica el MISMO horario a un grupo. Es lo que evita configurar 40 personas de
 * a una cuando toda la cocina entra a la misma hora.
 *
 * alcance:
 *   'todos'     -> todo el personal activo de la sede
 *   'area'      -> los de un area (idarea null = los que no tienen area)
 *   'seleccion' -> los ids tildados en la tabla
 *
 * Devuelve a cuantos alcanzo. `solo_contar` permite preguntar "a cuantos les
 * va a caer esto" antes de aplicarlo, sin escribir nada.
 */
router.post('/personal/horario-masivo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _c.sent();
                _a = ok;
                _b = [res];
                return [4 /*yield*/, cfg.horarioMasivo(t, req.body, autorPos(req))];
            case 2:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Vista del dia
// ---------------------------------------------------------------------------
/** Hora de corte de la empresa, normalizada a 'HH:MM:SS'. */
function horaCorte(idorg) {
    return __awaiter(this, void 0, void 0, function () {
        var org, c;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: idorg } })];
                case 1:
                    org = _a.sent();
                    c = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                    return [2 /*return*/, c instanceof Date ? c.toISOString().slice(11, 19) : String(c || '05:00:00')];
            }
        });
    });
}
var soloHora = function (d) { return (d ? new Date(d).toISOString().slice(11, 16) : null); };
/**
 * Quien llego, quien llego tarde y quien falta, para un dia operativo.
 *
 * El estado se resuelve aca y no en el navegador porque depende de si el dia YA
 * CERRO, y eso solo se sabe comparando con la hora de Lima: a las 02:00 el
 * turno de la noche sigue corriendo y nadie puede contar como falta todavia.
 */
function datosDia(idorg, idsede, fechaPedida) {
    return __awaiter(this, void 0, void 0, function () {
        var corte, hoyOperativo, fecha, enCurso, personal, marcas, areas, nombreArea, _i, _a, a, ctx, porColab, _b, _c, m, filas, cuenta, descansos;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, horaCorte(idorg)];
                case 1:
                    corte = _d.sent();
                    hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                    fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(fechaPedida || '')) ? String(fechaPedida) : hoyOperativo;
                    enCurso = fecha >= hoyOperativo;
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: idorg, idsede: idsede, estado: 0 },
                            orderBy: { nombres: 'asc' }
                        })];
                case 2:
                    personal = _d.sent();
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: { idorg: idorg, fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00') },
                            orderBy: { marcada_at: 'asc' }
                        })];
                case 3:
                    marcas = _d.sent();
                    return [4 /*yield*/, prisma.area.findMany({ where: areasDeLaSede(idsede), select: { idarea: true, descripcion: true } })];
                case 4:
                    areas = _d.sent();
                    nombreArea = new Map();
                    for (_i = 0, _a = areas; _i < _a.length; _i++) {
                        a = _a[_i];
                        nombreArea.set(a.idarea, a.descripcion);
                    }
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(idorg, idsede, fecha, fecha)];
                case 5:
                    ctx = _d.sent();
                    porColab = new Map();
                    for (_b = 0, _c = marcas; _b < _c.length; _b++) {
                        m = _c[_b];
                        if (!porColab.has(m.idcolaborador)) {
                            porColab.set(m.idcolaborador, []);
                        }
                        porColab.get(m.idcolaborador).push(m);
                    }
                    filas = personal.map(function (c) {
                        var _a;
                        var suyas = porColab.get(c.idcolaborador) || [];
                        var entrada = suyas.find(function (m) { return m.tipo === 'ENTRADA'; }) || null;
                        var salida = suyas.find(function (m) { return m.tipo === 'SALIDA'; }) || null;
                        // Ya no alcanza con mirar el horario semanal: el local puede cerrar ese
                        // dia, puede ser feriado, o la persona puede tener el descanso corrido.
                        var dl = (0, asistencia_dialaboral_1.resolverDia)({
                            fecha: fecha,
                            horario_semanal: c.horario_semanal,
                            tolerancia_min: (_a = c.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                            excepciones: ctx.porPersona(c.idcolaborador),
                            feriados: ctx.feriados,
                            dias_cierre: ctx.dias_cierre,
                            politica: ctx.politica
                        });
                        var esperada = dl.hora_esperada;
                        // El orden importa: primero lo que paso, despues lo que falto.
                        var estado;
                        if (entrada && salida) {
                            estado = 'COMPLETO';
                        }
                        else if (entrada) {
                            estado = enCurso ? 'PRESENTE' : 'INCOMPLETO';
                        }
                        else if (!dl.labora) {
                            // Distinguir POR QUE no trabaja: "dia libre" y "el local cerro" se
                            // explican distinto ante un reclamo, y ninguno es una falta.
                            estado = dl.origen === 'FERIADO' ? 'FERIADO'
                                : dl.origen === 'CIERRE_SEDE' || dl.origen === 'EXCEPCION_SEDE' ? 'CERRADO'
                                    : dl.origen === 'DESCANSO_SUSTITUTO' ? 'DESCANSO_MOVIDO'
                                        : c.horario_semanal ? 'LIBRE' : 'SIN_HORARIO';
                        }
                        else if (enCurso) {
                            estado = 'PENDIENTE';
                        }
                        else {
                            estado = 'FALTA';
                        }
                        return {
                            idcolaborador: c.idcolaborador,
                            nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
                            area: c.idarea ? (nombreArea.get(c.idarea) || '') : '',
                            hora_esperada: esperada,
                            tolerancia_min: c.tolerancia_min,
                            // Contexto del dia: lo que explica el estado
                            motivo_dia: dl.motivo,
                            feriado: dl.feriado,
                            es_descanso_trabajado: dl.es_descanso_trabajado,
                            compensacion: dl.compensacion,
                            recargo_pct: dl.recargo_pct,
                            fecha_sustituto: dl.fecha_sustituto,
                            entrada: entrada ? {
                                id: entrada.idasistencia_marca,
                                hora: soloHora(entrada.marcada_at),
                                tardanza_min: entrada.tardanza_min,
                                metodo: entrada.metodo,
                                motivo: entrada.manual_motivo
                            } : null,
                            salida: salida ? {
                                id: salida.idasistencia_marca,
                                hora: soloHora(salida.marcada_at),
                                metodo: salida.metodo,
                                motivo: salida.manual_motivo
                            } : null,
                            horas: (entrada && salida)
                                ? (0, asistencia_calendario_1.horasTurno)((0, asistencia_calendario_1.aTextoLima)(entrada.marcada_at), (0, asistencia_calendario_1.aTextoLima)(salida.marcada_at))
                                : null,
                            estado: estado
                        };
                    });
                    cuenta = function (e) { return filas.filter(function (f) { return f.estado === e; }).length; };
                    descansos = filas.filter(function (f) { return f.es_descanso_trabajado; });
                    return [2 /*return*/, {
                            fecha: fecha,
                            hoy: hoyOperativo,
                            en_curso: enCurso,
                            hora_corte: corte,
                            // Contexto del dia para la cabecera: "hoy el local no abre", "hoy es feriado"
                            feriado: ctx.feriados.get(fecha) || null,
                            cierre_sede: ctx.dias_cierre.includes((0, asistencia_calendario_1.diaSemana)(fecha)),
                            excepcion_sede: ctx.deSede.find(function (e) { return e.fecha === fecha; }) || null,
                            filas: filas,
                            resumen: {
                                personal: filas.length,
                                presentes: cuenta('PRESENTE') + cuenta('COMPLETO') + cuenta('INCOMPLETO'),
                                tardanzas: filas.filter(function (f) { return f.entrada && (f.entrada.tardanza_min || 0) > 0; }).length,
                                faltas: cuenta('FALTA'),
                                incompletos: cuenta('INCOMPLETO'),
                                pendientes: cuenta('PENDIENTE'),
                                libres: cuenta('LIBRE') + cuenta('CERRADO') + cuenta('FERIADO') + cuenta('DESCANSO_MOVIDO'),
                                // Trabajaron un dia que les tocaba descansar: es lo que despues
                                // entra a la boleta como recargo
                                descanso_trabajado: descansos.length,
                                con_recargo: descansos.filter(function (f) { return f.compensacion === 'RECARGO'; }).length,
                                // Sin compensacion elegida es un error de carga, no un caso valido
                                sin_compensar: descansos.filter(function (f) { return !f.compensacion; }).length
                            }
                        }];
            }
        });
    });
}
exports.datosDia = datosDia;
router.post('/dia', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _c.sent();
                _a = ok;
                _b = [res];
                return [4 /*yield*/, datosDia(t.idorg, t.idsede, req.body.fecha)];
            case 2:
                _a.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Calendario: cierres, feriados y excepciones
// ---------------------------------------------------------------------------
// Las operaciones viven en services/asistencia.config.ts porque rrhh-1 las
// ejecuta igual por su propia puerta. Aqui solo se resuelve el tenant y quien
// firma el cambio.
var calOp = function (ruta, fn) {
    return router.post(ruta, asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = ok;
                    _b = [res];
                    _c = fn;
                    return [4 /*yield*/, resolverTenant(req.pos, req.body)];
                case 1: return [4 /*yield*/, _c.apply(void 0, [_d.sent(), req])];
                case 2:
                    _a.apply(void 0, _b.concat([_d.sent()]));
                    return [2 /*return*/];
            }
        });
    }); }));
};
calOp('/calendario/mes', function (t, req) { return cfg.calendarioMes(t, req.body.mes); });
calOp('/calendario/dia', function (t, req) { return cfg.calendarioDia(t, req.body.fecha); });
calOp('/calendario/excepcion', function (t, req) { return cfg.guardarExcepcion(t, req.body, autorPos(req)); });
calOp('/calendario/excepcion/:id/eliminar', function (t, req) { return cfg.eliminarExcepcion(t, req.params.id, autorPos(req)); });
calOp('/calendario/dias-cierre', function (t, req) { return cfg.guardarDiasCierre(t, req.body.dias, autorPos(req)); });
calOp('/calendario/feriados', function (t, req) { return cfg.listarFeriados(t, req.body.anio); });
calOp('/calendario/feriado/guardar', function (t, req) { return cfg.guardarFeriado(t, req.body, autorPos(req)); });
calOp('/calendario/feriado/:id/eliminar', function (t, req) { return cfg.eliminarFeriado(t, req.params.id, autorPos(req)); });
calOp('/ausencias/alertas', function (t) { return ausencias.alertas(t); });
calOp('/ausencias/registrar', function (t, req) { return ausencias.registrarAusencia(t, req.body, autorPos(req)); });
calOp('/ausencias/baja', function (t, req) { return ausencias.darDeBaja(t, req.body, autorPos(req)); });
calOp('/configuracion', function (t, req) { return cfg.leerConfiguracion(t, req.body.anio); });
calOp('/configuracion/listo', function (t) { return cfg.marcarConfigurado(t); });
calOp('/configuracion/guardar', function (t, req) { return cfg.guardarConfiguracion(t, req.body, autorPos(req)); });
calOp('/bitacora', function (t, req) { return cfg.listarBitacora(t, req.body); });
// ---------------------------------------------------------------------------
// Marca manual
// ---------------------------------------------------------------------------
//
// Es la salida para quien no tiene smartphone, para el que se olvido de marcar
// y para corregir un error. Siempre queda registrada como MANUAL, con motivo y
// con el usuario del POS que la hizo: la diferencia entre una marca real y una
// puesta a mano tiene que ser visible en el reporte y en la planilla.
var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
router.post('/marca/manual', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, idcolaborador, tipo, hora, motivo, fecha, c, corte, momento, siguiente, alterno, esperada, tardanza, datos, previa, creada;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _b.sent();
                idcolaborador = Number(req.body.idcolaborador) || 0;
                tipo = String(req.body.tipo || '').toUpperCase();
                hora = String(req.body.hora || '');
                motivo = texto(req.body.motivo, 200);
                fecha = String(req.body.fecha || '');
                if (!idcolaborador) {
                    return [2 /*return*/, mal(res, 'Falta el colaborador.')];
                }
                if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') {
                    return [2 /*return*/, mal(res, 'El tipo debe ser ENTRADA o SALIDA.')];
                }
                if (!HHMM.test(hora)) {
                    return [2 /*return*/, mal(res, 'La hora debe tener el formato HH:MM.')];
                }
                if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                    return [2 /*return*/, mal(res, 'Falta el dia.')];
                }
                // El motivo es obligatorio a proposito: una marca puesta a mano sin
                // explicacion es indistinguible de un favor.
                if (!motivo) {
                    return [2 /*return*/, mal(res, 'Escribe el motivo de la marca manual.')];
                }
                return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idcolaborador: idcolaborador, idorg: t.idorg, idsede: t.idsede } })];
            case 2:
                c = _b.sent();
                if (!c) {
                    return [2 /*return*/, mal(res, 'Ese colaborador no es de esta sede.', 404)];
                }
                return [4 /*yield*/, horaCorte(t.idorg)];
            case 3:
                corte = _b.sent();
                momento = "".concat(fecha, " ").concat(hora, ":00");
                if ((0, asistencia_calendario_1.diaOperativo)(corte, momento) !== fecha) {
                    siguiente = new Date(Date.parse(fecha + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
                    alterno = "".concat(siguiente, " ").concat(hora, ":00");
                    if ((0, asistencia_calendario_1.diaOperativo)(corte, alterno) === fecha) {
                        momento = alterno;
                    }
                    else {
                        return [2 /*return*/, mal(res, "Las ".concat(hora, " no pertenecen al dia ").concat(fecha, " (el dia operativo empieza a las ").concat(corte.slice(0, 5), ")."))];
                    }
                }
                esperada = tipo === 'ENTRADA' ? (0, asistencia_calendario_1.horaEsperada)(c.horario_semanal, fecha) : null;
                tardanza = tipo === 'ENTRADA' ? (0, asistencia_calendario_1.tardanzaMin)(esperada, momento, (_a = c.tolerancia_min) !== null && _a !== void 0 ? _a : 10) : null;
                datos = {
                    idcolaborador: idcolaborador,
                    idorg: t.idorg,
                    idsede_restobar: req.pos.idsede,
                    tipo: tipo,
                    fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                    marcada_at: (0, asistencia_calendario_1.fechaSql)(momento),
                    metodo: 'MANUAL',
                    hora_esperada: esperada ? (0, asistencia_calendario_1.fechaSql)('1970-01-01 ' + esperada.slice(0, 5) + ':00') : null,
                    tardanza_min: tardanza,
                    manual_idusuario_restobar: req.pos.idusuario,
                    manual_motivo: motivo
                };
                return [4 /*yield*/, prisma.asistencia_marca.findFirst({
                        where: { idcolaborador: idcolaborador, fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'), tipo: tipo }
                    })];
            case 4:
                previa = _b.sent();
                if (!previa) return [3 /*break*/, 6];
                return [4 /*yield*/, prisma.asistencia_marca.update({ where: { idasistencia_marca: previa.idasistencia_marca }, data: datos })];
            case 5:
                _b.sent();
                return [2 /*return*/, ok(res, { accion: 'CORREGIDA', idasistencia_marca: previa.idasistencia_marca, hora: hora })];
            case 6: return [4 /*yield*/, prisma.asistencia_marca.create({ data: datos })];
            case 7:
                creada = _b.sent();
                ok(res, { accion: 'CREADA', idasistencia_marca: creada.idasistencia_marca, hora: hora });
                return [2 /*return*/];
        }
    });
}); }));
/** Borra una marca. Solo de esta empresa, y pidiendo motivo igual que al crear. */
router.post('/marca/:id/eliminar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id) || 0;
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                if (!texto(req.body.motivo, 200)) {
                    return [2 /*return*/, mal(res, 'Escribe el motivo para borrar la marca.')];
                }
                return [4 /*yield*/, prisma.asistencia_marca.deleteMany({ where: { idasistencia_marca: id, idorg: t.idorg } })];
            case 2:
                r = _a.sent();
                if (!r.count) {
                    return [2 /*return*/, mal(res, 'Esa marca no es de esta empresa.', 404)];
                }
                ok(res, { eliminada: true });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Enrolamiento del celular
// ---------------------------------------------------------------------------
//
// Dos pruebas distintas, las dos necesarias para que una marca valga:
//   - el QR del kiosko (fase 4) prueba PRESENCIA: caduca en segundos, sacarle
//     foto y mandarla por WhatsApp no sirve
//   - la cookie de este celular prueba IDENTIDAD: quien marca es quien es
//
// El enrolamiento es el momento en que se ata un celular a una persona, y pasa
// una sola vez, delante del administrador, escaneando una invitacion que dura
// 15 minutos y se quema al usarse.
var sha256 = function (v) { return crypto.createHash('sha256').update(v).digest('hex'); };
/** Genera la invitacion. El POS la convierte en un QR que el trabajador escanea. */
router.post('/personal/:id/invitacion', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, uuid, exp, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id);
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                uuid = crypto.randomUUID();
                exp = new Date(Date.now() + INVITACION_MIN * 60000);
                return [4 /*yield*/, prisma.colaborador.updateMany({
                        where: { idcolaborador: id, idorg: t.idorg },
                        data: { qr_invitacion: uuid, qr_invitacion_exp: exp }
                    })];
            case 2:
                r = _a.sent();
                if (!r.count) {
                    return [2 /*return*/, mal(res, 'ese colaborador no es de esta empresa', 404)];
                }
                ok(res, { invitacion: uuid, expira_at: exp, minutos: INVITACION_MIN });
                return [2 /*return*/];
        }
    });
}); }));
/** Revoca el celular enrolado. El siguiente enrolamiento vuelve a empezar. */
router.post('/personal/:id/dispositivo/revocar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, c, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id);
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idcolaborador: id, idorg: t.idorg } })];
            case 2:
                c = _a.sent();
                if (!c) {
                    return [2 /*return*/, mal(res, 'ese colaborador no es de esta empresa', 404)];
                }
                return [4 /*yield*/, prisma.colaborador_dispositivo.updateMany({
                        where: { idcolaborador: id, activo: true },
                        data: { activo: null, revocado_at: new Date() }
                    })];
            case 3:
                r = _a.sent();
                ok(res, { revocados: r.count });
                return [2 /*return*/];
        }
    });
}); }));
/** Busca una invitacion vigente. Devuelve null si no existe, ya se uso o vencio. */
function invitacionVigente(uuid) {
    return __awaiter(this, void 0, void 0, function () {
        var c;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!uuid || typeof uuid !== 'string' || uuid.length > 36) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, prisma.colaborador.findFirst({ where: { qr_invitacion: uuid } })];
                case 1:
                    c = _a.sent();
                    if (!c) {
                        return [2 /*return*/, null];
                    }
                    if (!c.qr_invitacion_exp || new Date(c.qr_invitacion_exp).getTime() < Date.now()) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, c];
            }
        });
    });
}
// Router aparte: estas dos las abre el CELULAR, que no tiene sesion del POS.
// Se montan con posPublicAuth y antes que el router principal (ver routes/index.ts).
exports.publico = express.Router();
/**
 * Lo que ve el celular ANTES de confirmar: a quien va a quedar atado.
 * Si dice otro nombre, el trabajador se da cuenta antes de enrolar.
 */
exports.publico.post('/enrolar/info', asinc(function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var c, yaTiene;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, invitacionVigente(_req.body.invitacion)];
            case 1:
                c = _a.sent();
                if (!c) {
                    return [2 /*return*/, mal(res, 'Este codigo ya no es valido. Pide al administrador que genere uno nuevo.', 410)];
                }
                return [4 /*yield*/, prisma.colaborador_dispositivo.findFirst({
                        where: { idcolaborador: c.idcolaborador, activo: true }
                    })];
            case 2:
                yaTiene = _a.sent();
                ok(res, {
                    nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
                    reemplaza: !!yaTiene // ya tenia otro celular: enrolar este desactiva el anterior
                });
                return [2 /*return*/];
        }
    });
}); }));
/** Confirma: quema la invitacion y entrega el token que el POS guarda como cookie. */
exports.publico.post('/enrolar/confirmar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var c, token, ahora, expira;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, invitacionVigente(req.body.invitacion)];
            case 1:
                c = _a.sent();
                if (!c) {
                    return [2 /*return*/, mal(res, 'Este codigo ya no es valido. Pide al administrador que genere uno nuevo.', 410)];
                }
                token = crypto.randomBytes(32).toString('hex');
                ahora = new Date();
                expira = new Date(ahora.getTime() + DISPOSITIVO_DIAS * 86400000);
                return [4 /*yield*/, prisma.$transaction([
                        // un solo celular activo por persona: el anterior se revoca
                        prisma.colaborador_dispositivo.updateMany({
                            where: { idcolaborador: c.idcolaborador, activo: true },
                            data: { activo: null, revocado_at: ahora }
                        }),
                        prisma.colaborador_dispositivo.create({
                            data: {
                                idcolaborador: c.idcolaborador,
                                token_hash: sha256(token),
                                activo: true,
                                creado_at: ahora,
                                expira_at: expira,
                                user_agent: String(req.body.user_agent || '').slice(0, 255)
                            }
                        }),
                        // la invitacion se quema: de un solo uso
                        prisma.colaborador.updateMany({
                            where: { idcolaborador: c.idcolaborador },
                            data: { qr_invitacion: null, qr_invitacion_exp: null }
                        })
                    ])];
            case 2:
                _a.sent();
                ok(res, {
                    token: token,
                    nombres: ((c.nombres || '') + ' ' + (c.apellidos || '')).trim(),
                    expira_at: expira,
                    dias: DISPOSITIVO_DIAS
                });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Kioskos (la pantalla de la puerta)
// ---------------------------------------------------------------------------
/** Da de alta un kiosko. El token se muestra UNA vez: solo se guarda su hash. */
router.post('/kiosko/crear', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, nombre, token, k;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                nombre = texto(req.body.nombre, 80) || 'Puerta principal';
                token = crypto.randomBytes(32).toString('hex');
                return [4 /*yield*/, prisma.asistencia_kiosko.create({
                        data: {
                            idorg: t.idorg,
                            idsede_restobar: req.pos.idsede,
                            nombre: nombre,
                            token_hash: sha256(token),
                            creado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)())
                        }
                    })];
            case 2:
                k = _a.sent();
                ok(res, { idkiosko: k.idkiosko, nombre: nombre, token: token });
                return [2 /*return*/];
        }
    });
}); }));
// Un marcador vivo pide codigo cada 30 s. Pasados 3 minutos sin senal esta
// apagado, sin internet o con el navegador cerrado, y nadie puede marcar ahi.
var MIN_SIN_SENAL = 3;
router.post('/kiosko/listar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, filas;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                return [4 /*yield*/, prisma.asistencia_kiosko.findMany({
                        where: { idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
                        orderBy: { idkiosko: 'asc' },
                        select: { idkiosko: true, nombre: true, creado_at: true, ultimo_visto_at: true, permite_manual: true }
                    })];
            case 2:
                filas = _a.sent();
                // El estado se decide AQUI, no en el navegador: este proceso sabe que hora
                // es en Lima; el navegador de la tablet puede tener el huso mal puesto.
                ok(res, {
                    marcadores: filas.map(function (k) {
                        var visto = (0, asistencia_calendario_1.aTextoLima)(k.ultimo_visto_at);
                        var min = (0, asistencia_calendario_1.minutosDesde)(visto);
                        return {
                            idkiosko: k.idkiosko,
                            nombre: k.nombre,
                            creado_at: (0, asistencia_calendario_1.aTextoLima)(k.creado_at),
                            ultimo_visto_at: visto,
                            minutos_sin_senal: min,
                            encendido: min !== null && min < MIN_SIN_SENAL,
                            permite_manual: !!k.permite_manual
                        };
                    })
                });
                return [2 /*return*/];
        }
    });
}); }));
/** Enciende o apaga el boton de marca manual en ese marcador. */
router.post('/kiosko/:id/manual', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, permite, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id);
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                permite = !!req.body.permite_manual;
                return [4 /*yield*/, prisma.asistencia_kiosko.updateMany({
                        where: { idkiosko: id, idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
                        data: { permite_manual: permite }
                    })];
            case 2:
                r = _a.sent();
                if (!r.count) {
                    return [2 /*return*/, mal(res, 'ese marcador no es de esta sede', 404)];
                }
                ok(res, { idkiosko: id, permite_manual: permite });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * "Activar en esta pantalla": entrega un token NUEVO para ese marcador.
 *
 * Es la forma de encender un marcador sin depender de que alguien haya guardado
 * un favorito. El que llega primero entra al POS, elige "Cocina" y listo.
 *
 * El token se ROTA en cada activacion, a proposito: asi no hay que guardar el
 * token en claro en ningun lado (solo su hash), y un marcador queda encendido
 * en una sola pantalla a la vez. Si la tablet vieja seguia abierta, deja de
 * entregar codigos y muestra el aviso de volver a vincular.
 */
router.post('/kiosko/:id/activar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, token, r, k;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id);
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                token = crypto.randomBytes(32).toString('hex');
                return [4 /*yield*/, prisma.asistencia_kiosko.updateMany({
                        where: { idkiosko: id, idorg: t.idorg, idsede_restobar: req.pos.idsede, revocado_at: null },
                        data: { token_hash: sha256(token), ultimo_visto_at: null }
                    })];
            case 2:
                r = _a.sent();
                if (!r.count) {
                    return [2 /*return*/, mal(res, 'ese marcador no es de esta sede', 404)];
                }
                return [4 /*yield*/, prisma.asistencia_kiosko.findUnique({ where: { idkiosko: id } })];
            case 3:
                k = _a.sent();
                ok(res, { idkiosko: id, nombre: (k === null || k === void 0 ? void 0 : k.nombre) || '', token: token });
                return [2 /*return*/];
        }
    });
}); }));
router.post('/kiosko/:id/revocar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, id, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                id = Number(req.params.id);
                if (!id) {
                    return [2 /*return*/, mal(res, 'id invalido')];
                }
                return [4 /*yield*/, prisma.asistencia_kiosko.updateMany({
                        where: { idkiosko: id, idorg: t.idorg, revocado_at: null },
                        data: { revocado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)()) }
                    })];
            case 2:
                r = _a.sent();
                if (!r.count) {
                    return [2 /*return*/, mal(res, 'ese kiosko no es de esta sede', 404)];
                }
                ok(res, { revocado: true });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Ubicacion del local (GPS)
// ---------------------------------------------------------------------------
var RADIO_MIN = 30; // menos que esto y el error normal del GPS rechaza a gente que si esta
var RADIO_MAX = 2000;
router.post('/gps/estado', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, s;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _b.sent();
                return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: t.idsede } })];
            case 2:
                s = _b.sent();
                ok(res, {
                    activo: !!(s === null || s === void 0 ? void 0 : s.gps_activo),
                    lat: (s === null || s === void 0 ? void 0 : s.gps_lat) !== null && (s === null || s === void 0 ? void 0 : s.gps_lat) !== undefined ? Number(s.gps_lat) : null,
                    lng: (s === null || s === void 0 ? void 0 : s.gps_lng) !== null && (s === null || s === void 0 ? void 0 : s.gps_lng) !== undefined ? Number(s.gps_lng) : null,
                    radio_m: (_a = s === null || s === void 0 ? void 0 : s.gps_radio_m) !== null && _a !== void 0 ? _a : 150,
                    radio_min: RADIO_MIN,
                    radio_max: RADIO_MAX
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * Guarda el punto del local y la configuracion.
 *
 * El POS ya escribio las mismas coordenadas en restobar.sede (que es lo que usa
 * Tracker); aca se espejan para que esta API pueda validar las marcas sin salir
 * a buscarlas a una base que no alcanza.
 */
router.post('/gps/guardar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var t, activo, lat, lng, hayPunto, radio;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resolverTenant(req.pos, req.body)];
            case 1:
                t = _a.sent();
                activo = !!req.body.activo;
                lat = Number(req.body.lat);
                lng = Number(req.body.lng);
                hayPunto = isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0);
                if (hayPunto && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
                    return [2 /*return*/, mal(res, 'Esas coordenadas no son validas.')];
                }
                // Encender la exigencia sin haber marcado el local dejaria a todos afuera.
                if (activo && !hayPunto) {
                    return [2 /*return*/, mal(res, 'Primero marca en el mapa donde esta el local.')];
                }
                radio = Number(req.body.radio_m);
                if (!isFinite(radio)) {
                    radio = 150;
                }
                radio = Math.min(RADIO_MAX, Math.max(RADIO_MIN, Math.round(radio)));
                return [4 /*yield*/, prisma.sede.update({
                        where: { idsede: t.idsede },
                        data: {
                            gps_activo: activo,
                            gps_lat: hayPunto ? lat : null,
                            gps_lng: hayPunto ? lng : null,
                            gps_radio_m: radio
                        }
                    })];
            case 2:
                _a.sent();
                ok(res, { activo: activo, lat: hayPunto ? lat : null, lng: hayPunto ? lng : null, radio_m: radio });
                return [2 /*return*/];
        }
    });
}); }));
// ---------------------------------------------------------------------------
// Marcacion
// ---------------------------------------------------------------------------
/** Kiosko vigente a partir del token que manda la pantalla. */
function kioskoPorToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var k;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token || typeof token !== 'string' || token.length !== 64) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, prisma.asistencia_kiosko.findFirst({ where: { token_hash: sha256(token), revocado_at: null } })];
                case 1:
                    k = _a.sent();
                    return [2 /*return*/, k || null];
            }
        });
    });
}
/**
 * Codigo que la pantalla debe mostrar ahora. Lo pide cada pocos segundos.
 * Devuelve tambien los segundos que le quedan, para el contador visual.
 */
exports.publico.post('/codigo', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var k;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, kioskoPorToken(req.body.kiosko_token)];
            case 1:
                k = _a.sent();
                if (!k) {
                    return [2 /*return*/, mal(res, 'Esta pantalla ya no esta autorizada. Vuelve a vincularla desde el POS.', 410)];
                }
                // Huella de vida, para que el panel muestre si la pantalla sigue encendida.
                return [4 /*yield*/, prisma.asistencia_kiosko.updateMany({
                        where: { idkiosko: k.idkiosko },
                        data: { ultimo_visto_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)()) }
                    })];
            case 2:
                // Huella de vida, para que el panel muestre si la pantalla sigue encendida.
                _a.sent();
                ok(res, {
                    idkiosko: k.idkiosko,
                    nombre: k.nombre,
                    codigo: (0, asistencia_codigo_1.calcularCodigo)(k.token_hash, k.idkiosko, (0, asistencia_codigo_1.ventanaActual)()),
                    segundos: (0, asistencia_codigo_1.segundosRestantes)(),
                    ventana: asistencia_codigo_1.VENTANA_SEG,
                    // La pantalla consulta esto en cada ciclo, asi que apagar la marca
                    // manual desde el panel se ve en el marcador sin tocar la tablet.
                    permite_manual: !!k.permite_manual
                });
                return [2 /*return*/];
        }
    });
}); }));
/**
 * Registra la marca. Necesita las DOS pruebas:
 *   - codigo del kiosko  -> que esta fisicamente en el local (caduca en 30-60 s)
 *   - cookie del celular -> que es quien dice ser
 * Con una sola no alcanza, y ese es justamente el punto del diseno.
 */
/**
 * Que necesita el celular ANTES de marcar. Lo pide marcar.php para saber si
 * tiene que pedirle la ubicacion al navegador: pedir permiso de GPS cuando la
 * sede no lo exige es molesto y entrena a la gente a decir que no.
 */
exports.publico.post('/marcar/info', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var k, s, exige;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, prisma.asistencia_kiosko.findFirst({
                    where: { idkiosko: Number(req.body.idkiosko), revocado_at: null }
                })];
            case 1:
                k = _b.sent();
                if (!k) {
                    return [2 /*return*/, mal(res, 'Pantalla no valida.', 410)];
                }
                return [4 /*yield*/, prisma.sede.findFirst({ where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } })];
            case 2:
                s = _b.sent();
                exige = !!((s === null || s === void 0 ? void 0 : s.gps_activo) && (s === null || s === void 0 ? void 0 : s.gps_lat) !== null && (s === null || s === void 0 ? void 0 : s.gps_lng) !== null);
                ok(res, { gps_requerido: exige, radio_m: (_a = s === null || s === void 0 ? void 0 : s.gps_radio_m) !== null && _a !== void 0 ? _a : 150 });
                return [2 /*return*/];
        }
    });
}); }));
function puertaCerrada(dl, politica) {
    // `habilitable` dice si un administrador puede resolverlo ahi mismo, en el
    // marcador. Es la diferencia entre "esperen a que alguien arregle esto" y
    // "llamen al encargado y siguen trabajando en un minuto".
    if (dl.origen === 'FERIADO' || dl.origen === 'CIERRE_SEDE' || dl.origen === 'EXCEPCION_SEDE') {
        return {
            mensaje: "Hoy el local no abre (".concat(dl.motivo, "). Si van a trabajar, el administrador tiene que habilitar el dia."),
            habilitable: true
        };
    }
    if (dl.origen === 'EXCEPCION_PERSONA') {
        return { mensaje: "Hoy no te toca trabajar: ".concat(dl.motivo, ". Habla con el administrador."), habilitable: true };
    }
    if (dl.origen === 'DESCANSO_SUSTITUTO') {
        return { mensaje: "".concat(dl.motivo, ". Si vas a trabajar igual, el administrador tiene que habilitar el dia."), habilitable: true };
    }
    // Sin horario cargado no es un dia de descanso, es una ficha incompleta: no
    // corresponde pagarle recargo por un horario que nadie definio, y no se
    // arregla habilitando el dia sino cargandole el horario.
    if (!dl.hora_esperada && /Sin horario/i.test(dl.motivo || '')) {
        return { mensaje: 'Todavia no tienes horario asignado. Pide al administrador que te lo cargue.', habilitable: false };
    }
    if (politica !== 'RECARGO') {
        return { mensaje: 'Hoy es tu dia de descanso. Si vas a trabajar, el administrador tiene que habilitar el dia.', habilitable: true };
    }
    return null;
}
exports.publico.post('/marcar', asinc(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var idkiosko, dispositivo, k, disp, c, sedeGps, gps, lectura, v, org, corte, ahora, fecha, delDia, entrada, salida, nombre, ultima, tipo, nota, ctx, dl, puerta, esperada, tardanza;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                idkiosko = Number(req.body.idkiosko);
                dispositivo = req.body.dispositivo;
                if (!dispositivo || typeof dispositivo !== 'string' || dispositivo.length !== 64) {
                    return [2 /*return*/, mal(res, 'Este celular no esta activado. Pide al administrador que te active.', 403)];
                }
                return [4 /*yield*/, prisma.asistencia_kiosko.findFirst({ where: { idkiosko: idkiosko, revocado_at: null } })];
            case 1:
                k = _e.sent();
                if (!k) {
                    return [2 /*return*/, mal(res, 'Pantalla no valida.', 410)];
                }
                if (!(0, asistencia_codigo_1.codigoValido)(k.token_hash, k.idkiosko, String(req.body.codigo || ''))) {
                    return [2 /*return*/, mal(res, 'El codigo ya vencio. Vuelve a escanear el QR de la pantalla.', 410)];
                }
                return [4 /*yield*/, prisma.colaborador_dispositivo.findFirst({
                        where: { token_hash: sha256(dispositivo), activo: true }
                    })];
            case 2:
                disp = _e.sent();
                if (!disp) {
                    return [2 /*return*/, mal(res, 'Este celular no esta activado. Pide al administrador que te active.', 403)];
                }
                if (new Date(disp.expira_at).getTime() < Date.now()) {
                    return [2 /*return*/, mal(res, 'La activacion de este celular vencio. Pide al administrador que la renueve.', 403)];
                }
                return [4 /*yield*/, prisma.colaborador.findUnique({ where: { idcolaborador: disp.idcolaborador } })];
            case 3:
                c = _e.sent();
                if (!c || c.estado !== 0) {
                    return [2 /*return*/, mal(res, 'Tu ficha no esta activa. Avisa al administrador.', 403)];
                }
                if (c.idorg !== k.idorg) {
                    return [2 /*return*/, mal(res, 'Esta pantalla no es de tu empresa.', 403)];
                }
                return [4 /*yield*/, prisma.sede.findFirst({ where: { idorg: k.idorg, idsede_restobar: k.idsede_restobar } })];
            case 4:
                sedeGps = _e.sent();
                if (!sedeGps) {
                    return [2 /*return*/, mal(res, 'Esta sede no esta configurada en Recursos Humanos.', 409)];
                }
                gps = null;
                if ((sedeGps === null || sedeGps === void 0 ? void 0 : sedeGps.gps_activo) && sedeGps.gps_lat !== null && sedeGps.gps_lng !== null) {
                    lectura = (req.body.lat !== undefined && req.body.lat !== null)
                        ? { lat: Number(req.body.lat), lng: Number(req.body.lng), precision: req.body.precision !== undefined && req.body.precision !== null ? Number(req.body.precision) : null }
                        : null;
                    v = (0, asistencia_gps_1.verificarUbicacion)({ lat: Number(sedeGps.gps_lat), lng: Number(sedeGps.gps_lng), radio_m: (_a = sedeGps.gps_radio_m) !== null && _a !== void 0 ? _a : 150 }, lectura);
                    if (!v.ok) {
                        return [2 /*return*/, mal(res, v.error, 403)];
                    }
                    gps = { lat: lectura.lat, lng: lectura.lng, distancia: v.distancia_m };
                }
                return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: c.idorg } })];
            case 5:
                org = _e.sent();
                corte = (org === null || org === void 0 ? void 0 : org.asis_hora_corte) instanceof Date
                    ? org.asis_hora_corte.toISOString().slice(11, 19)
                    : String((org === null || org === void 0 ? void 0 : org.asis_hora_corte) || '05:00:00');
                ahora = (0, asistencia_calendario_1.ahoraLima)();
                fecha = (0, asistencia_calendario_1.diaOperativo)(corte, ahora);
                return [4 /*yield*/, prisma.asistencia_marca.findMany({
                        where: { idcolaborador: c.idcolaborador, fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00') },
                        orderBy: { marcada_at: 'asc' }
                    })];
            case 6:
                delDia = _e.sent();
                entrada = delDia.find(function (m) { return m.tipo === 'ENTRADA'; });
                salida = delDia.find(function (m) { return m.tipo === 'SALIDA'; });
                nombre = ((c.nombres || '') + ' ' + (c.apellidos || '')).trim();
                ultima = delDia.length ? delDia[delDia.length - 1] : null;
                if (ultima && (Date.parse(ahora + 'Z') - new Date(ultima.marcada_at).getTime()) < 2 * 60000) {
                    return [2 /*return*/, ok(res, {
                            resultado: 'DEDUPE', nombres: nombre, tipo: ultima.tipo,
                            hora: new Date(ultima.marcada_at).toISOString().slice(11, 16),
                            mensaje: 'Ya registramos tu ' + ultima.tipo.toLowerCase() + ' hace un momento.'
                        })];
                }
                if (entrada && salida) {
                    return [2 /*return*/, ok(res, {
                            resultado: 'COMPLETO', nombres: nombre,
                            mensaje: 'Ya marcaste entrada y salida hoy. Si necesitas otra marca, pide al administrador.'
                        })];
                }
                tipo = entrada ? 'SALIDA' : 'ENTRADA';
                nota = null;
                if (!(tipo === 'ENTRADA')) return [3 /*break*/, 10];
                return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(c.idorg, sedeGps.idsede, fecha, fecha)];
            case 7:
                ctx = _e.sent();
                dl = (0, asistencia_dialaboral_1.resolverDia)({
                    fecha: fecha,
                    horario_semanal: c.horario_semanal,
                    tolerancia_min: (_b = c.tolerancia_min) !== null && _b !== void 0 ? _b : 10,
                    excepciones: ctx.porPersona(c.idcolaborador),
                    feriados: ctx.feriados,
                    dias_cierre: ctx.dias_cierre,
                    politica: ctx.politica
                });
                if (!!dl.labora) return [3 /*break*/, 9];
                puerta = puertaCerrada(dl, ctx.politica.descanso_trabajado);
                if (puerta) {
                    return [2 /*return*/, res.status(409).json({
                            success: false,
                            datos: { habilitable: puerta.habilitable, nombres: nombre, fecha: fecha },
                            error: puerta.mensaje
                        })];
                }
                // La politica del local dice que el que viene en su descanso cobra
                // doble. Se deja la excepcion escrita en vez de un flag en la marca:
                // la planilla ya lee las excepciones, y asi el administrador puede
                // cambiarla despues a "descansa otro dia" si lo coordinan distinto.
                return [4 /*yield*/, cfg.guardarExcepcion({ idorg: c.idorg, idsede: sedeGps.idsede }, {
                        fecha: fecha,
                        idcolaborador: c.idcolaborador, tipo: 'LABORABLE',
                        motivo: 'Marco en su dia de descanso',
                        compensacion: 'RECARGO', recargo_pct: ctx.politica.descanso_recargo_pct
                    }, { origen: 'POS', idusuario: null, nombre: 'Marcador (politica del local)' }, true)];
            case 8:
                // La politica del local dice que el que viene en su descanso cobra
                // doble. Se deja la excepcion escrita en vez de un flag en la marca:
                // la planilla ya lee las excepciones, y asi el administrador puede
                // cambiarla despues a "descansa otro dia" si lo coordinan distinto.
                _e.sent();
                nota = ctx.politica.descanso_recargo_pct >= 100
                    ? 'Hoy es tu descanso: queda registrado con pago doble.'
                    : "Hoy es tu descanso: queda registrado con ".concat(ctx.politica.descanso_recargo_pct, "% de recargo.");
                return [3 /*break*/, 10];
            case 9:
                if (dl.recargo_feriado_pct) {
                    nota = "Hoy es feriado (".concat(dl.feriado, "): se registra con ").concat(dl.recargo_feriado_pct, "% de recargo.");
                }
                _e.label = 10;
            case 10:
                esperada = tipo === 'ENTRADA' ? (0, asistencia_calendario_1.horaEsperada)(c.horario_semanal, fecha) : null;
                tardanza = tipo === 'ENTRADA' ? (0, asistencia_calendario_1.tardanzaMin)(esperada, ahora, (_c = c.tolerancia_min) !== null && _c !== void 0 ? _c : 10) : null;
                return [4 /*yield*/, prisma.asistencia_marca.create({
                        data: {
                            idcolaborador: c.idcolaborador,
                            idorg: c.idorg,
                            idsede_restobar: k.idsede_restobar,
                            tipo: tipo,
                            fecha_local: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                            marcada_at: (0, asistencia_calendario_1.fechaSql)(ahora),
                            metodo: 'QR',
                            hora_esperada: esperada ? (0, asistencia_calendario_1.fechaSql)('1970-01-01 ' + esperada.slice(0, 5) + ':00') : null,
                            tardanza_min: tardanza,
                            iddispositivo: disp.iddispositivo,
                            idkiosko: k.idkiosko,
                            ip: String(req.headers['x-forwarded-for'] || ((_d = req.socket) === null || _d === void 0 ? void 0 : _d.remoteAddress) || '').slice(0, 45),
                            // Se guarda de donde vino, para poder auditar un reclamo despues
                            gps_lat: gps ? gps.lat : null,
                            gps_lng: gps ? gps.lng : null,
                            gps_distancia_m: gps ? gps.distancia : null
                        }
                    })];
            case 11:
                _e.sent();
                ok(res, {
                    resultado: tipo,
                    nombres: nombre,
                    hora: ahora.slice(11, 16),
                    tardanza_min: tardanza,
                    horas: tipo === 'SALIDA' && entrada
                        ? (0, asistencia_calendario_1.horasTurno)(new Date(entrada.marcada_at).toISOString().slice(0, 19).replace('T', ' '), ahora)
                        : null,
                    nota: nota
                });
                return [2 /*return*/];
        }
    });
}); }));
exports["default"] = router;
