"use strict";
// Configuracion de asistencia: horarios, dias de cierre, feriados y excepciones.
//
// Vive aqui y no en un controlador porque se opera desde DOS puertas:
//   - el POS (token firmado de la sede, con compuerta de administrador)
//   - rrhh-1 (login de Recursos Humanos)
//
// Si cada puerta tuviera su copia, el dia que cambie una regla -- por ejemplo
// que el recargo minimo sea 100% -- una de las dos quedaria vieja y la planilla
// saldria distinta segun por donde se cargo el dato. Las puertas se diferencian
// en QUIEN puede entrar y en que queda en la bitacora (`Autor`), no en que hace
// cada operacion.
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.listarBitacora = exports.eliminarFeriado = exports.guardarFeriado = exports.listarFeriados = exports.guardarConfiguracion = exports.leerConfiguracion = exports.guardarDiasCierre = exports.eliminarExcepcion = exports.guardarExcepcion = exports.calendarioDia = exports.calendarioMes = exports.horarioMasivo = exports.asignarArea = exports.listarAreas = exports.guardarHorario = exports.marcarConfigurado = exports.contextoLaboral = exports.politicaDe = exports.diasDelMes = exports.ES_FECHA = exports.Invalido = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_bitacora_1 = require("./asistencia.bitacora");
var prisma = new client_1.PrismaClient();
/**
 * Error de lo que pidio el usuario, no del servidor. El controlador lo traduce
 * a 400/404; cualquier otro Error sigue siendo un 500 con su stack en el log.
 */
var Invalido = /** @class */ (function (_super) {
    __extends(Invalido, _super);
    function Invalido(mensaje, code) {
        if (code === void 0) { code = 400; }
        var _this = _super.call(this, mensaje) || this;
        // El proyecto compila a ES5, donde heredar de Error rompe el prototipo y
        // `instanceof Invalido` da false: el controlador lo tomaria por un error
        // interno y devolveria 500 en vez del mensaje. Se restituye a mano.
        Object.setPrototypeOf(_this, Invalido.prototype);
        _this.code = code;
        return _this;
    }
    return Invalido;
}(Error));
exports.Invalido = Invalido;
exports.ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
var DIAS_SEM = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
var CATEGORIAS = ['NORMAL', 'VACACIONES', 'LICENCIA', 'DESCANSO_MEDICO', 'PERMISO_SIN_GOCE'];
var texto = function (v, max) {
    if (max === void 0) { max = 200; }
    return (v === null || v === undefined ? '' : String(v)).trim().slice(0, max);
};
/** Todos los dias de un mes 'YYYY-MM' como 'YYYY-MM-DD'. */
function diasDelMes(mes) {
    var _a = mes.split('-').map(Number), a = _a[0], m = _a[1];
    var ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    var out = [];
    for (var d = 1; d <= ultimo; d++) {
        out.push("".concat(mes, "-").concat(String(d).padStart(2, '0')));
    }
    return out;
}
exports.diasDelMes = diasDelMes;
/**
 * Lo que la sede decidio una vez: si abre los feriados y que pasa si alguien
 * trabaja en su dia de descanso. Se lee con la fila de sede ya cargada para no
 * repetir la consulta en el camino del marcado, que es el mas caliente.
 */
function politicaDe(sede) {
    var _a, _b;
    return {
        feriado_abre: !!(sede === null || sede === void 0 ? void 0 : sede.feriado_abre),
        feriado_recargo_pct: Number((_a = sede === null || sede === void 0 ? void 0 : sede.feriado_recargo_pct) !== null && _a !== void 0 ? _a : 0),
        descanso_trabajado: String((sede === null || sede === void 0 ? void 0 : sede.descanso_trabajado) || 'PERMISO'),
        descanso_recargo_pct: Number((_b = sede === null || sede === void 0 ? void 0 : sede.descanso_recargo_pct) !== null && _b !== void 0 ? _b : 100)
    };
}
exports.politicaDe = politicaDe;
/** El id de sede del POS, que es por el que se guardan las excepciones. */
function sedeRestobar(idsede) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var s;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: idsede } })];
                case 1:
                    s = _b.sent();
                    return [2 /*return*/, (_a = s === null || s === void 0 ? void 0 : s.idsede_restobar) !== null && _a !== void 0 ? _a : 0];
            }
        });
    });
}
// ---------------------------------------------------------------------------
// Contexto laboral
// ---------------------------------------------------------------------------
/**
 * Todo lo que hace falta para decidir si alguien trabaja un dia: los dias fijos
 * de cierre, los feriados y las excepciones cargadas.
 *
 * Se lee una vez por rango y se reusa para todas las personas y todos los dias.
 * Consultarlo por celda seria una consulta por persona por dia.
 */
function contextoLaboral(idorg, idsede, desde, hasta) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var sede, idsedeRestobar, desdeD, hastaD, filas, feriados, excepciones;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: idsede } })];
                case 1:
                    sede = _b.sent();
                    idsedeRestobar = (_a = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _a !== void 0 ? _a : 0;
                    desdeD = (0, asistencia_calendario_1.fechaSql)(desde + ' 00:00:00');
                    hastaD = (0, asistencia_calendario_1.fechaSql)(hasta + ' 00:00:00');
                    return [4 /*yield*/, prisma.asistencia_excepcion.findMany({
                            where: {
                                idsede_restobar: idsedeRestobar,
                                OR: [
                                    { fecha: { gte: desdeD, lte: hastaD } },
                                    { fecha_sustituto: { gte: desdeD, lte: hastaD } }
                                ]
                            }
                        })];
                case 2:
                    filas = _b.sent();
                    return [4 /*yield*/, prisma.asistencia_feriado.findMany({
                            where: {
                                estado: '0',
                                OR: [{ idorg: 0 }, { idorg: idorg }],
                                fecha: { gte: desdeD, lte: hastaD }
                            }
                        })];
                case 3:
                    feriados = _b.sent();
                    excepciones = filas.map(function (f) { return ({
                        idcolaborador: f.idcolaborador,
                        fecha: (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10),
                        tipo: f.tipo,
                        motivo: f.motivo,
                        compensacion: f.compensacion,
                        fecha_sustituto: f.fecha_sustituto ? (0, asistencia_calendario_1.aTextoLima)(f.fecha_sustituto).slice(0, 10) : null,
                        recargo_pct: f.recargo_pct,
                        categoria: f.categoria || 'NORMAL'
                    }); });
                    return [2 /*return*/, {
                            idsedeRestobar: idsedeRestobar,
                            politica: politicaDe(sede),
                            dias_cierre: String((sede === null || sede === void 0 ? void 0 : sede.dias_cierre) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
                            excepciones: excepciones,
                            // idcolaborador 0 = de la sede; se pasan siempre, mas las de la persona
                            deSede: excepciones.filter(function (e) { return e.idcolaborador === 0; }),
                            porPersona: function (id) { return excepciones.filter(function (e) { return e.idcolaborador === 0 || e.idcolaborador === id; }); },
                            feriados: new Map(feriados.map(function (f) { return [(0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10), f.descripcion]; })),
                            ids: filas.reduce(function (m, f) {
                                m.set("".concat(f.idcolaborador, "|").concat((0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10)), f.idexcepcion);
                                return m;
                            }, new Map())
                        }];
            }
        });
    });
}
exports.contextoLaboral = contextoLaboral;
// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------
/**
 * Da por terminado el asistente inicial.
 *
 * Solo apaga el asistente. No valida que la configuracion este "completa" a
 * proposito: si el dueno quiere saltearse el paso del personal y cargarlo
 * manana, es su negocio; forzarlo lo dejaria dando vueltas sin poder entrar.
 */
function marcarConfigurado(ctx) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.sede.update({
                        where: { idsede: ctx.idsede },
                        data: { asis_configurado: true }
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { configurado: true }];
            }
        });
    });
}
exports.marcarConfigurado = marcarConfigurado;
function guardarHorario(ctx, body, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var id, horario, tolerancia, antes, r, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    id = Number(body.idcolaborador) || 0;
                    if (!id) {
                        throw new Invalido('id invalido');
                    }
                    try {
                        horario = (0, asistencia_calendario_1.validarHorario)(body.horario_semanal);
                    }
                    catch (e) {
                        throw new Invalido(e.message);
                    }
                    tolerancia = Number(body.tolerancia_min);
                    if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 240) {
                        tolerancia = 10;
                    }
                    return [4 /*yield*/, prisma.colaborador.findFirst({ where: { idcolaborador: id, idorg: ctx.idorg } })];
                case 1:
                    antes = _d.sent();
                    if (!antes) {
                        throw new Invalido('ese colaborador no es de esta empresa', 404);
                    }
                    return [4 /*yield*/, prisma.colaborador.updateMany({
                            where: { idcolaborador: id, idorg: ctx.idorg },
                            data: { horario_semanal: horario === null ? client_1.Prisma.DbNull : horario, tolerancia_min: tolerancia }
                        })];
                case 2:
                    r = _d.sent();
                    if (!r.count) {
                        throw new Invalido('ese colaborador no es de esta empresa', 404);
                    }
                    _b = asistencia_bitacora_1.anotar;
                    _c = {
                        idorg: ctx.idorg
                    };
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 3: return [4 /*yield*/, _b.apply(void 0, [(_c.idsede_restobar = _d.sent(),
                            _c.entidad = 'HORARIO',
                            _c.identidad = id,
                            _c.idcolaborador = id,
                            _c.accion = 'MODIFICA',
                            _c.detalle = (0, asistencia_bitacora_1.detalleHorario)(((antes.nombres || '') + ' ' + (antes.apellidos || '')).trim(), antes.horario_semanal, horario, (_a = antes.tolerancia_min) !== null && _a !== void 0 ? _a : 10, tolerancia),
                            _c.anterior = { horario_semanal: antes.horario_semanal, tolerancia_min: antes.tolerancia_min },
                            _c.nuevo = { horario_semanal: horario, tolerancia_min: tolerancia },
                            _c), autor])];
                case 4:
                    _d.sent();
                    return [2 /*return*/, { idcolaborador: id, horario_semanal: horario, tolerancia_min: tolerancia }];
            }
        });
    });
}
exports.guardarHorario = guardarHorario;
/** Las areas que puede usar esta sede: las comunes (idsede 0) mas las suyas. */
var areasDeLaSede = function (idsede) { return ({ estado: '0', OR: [{ idsede: 0 }, { idsede: idsede }] }); };
function listarAreas(ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var areas, personal, cuenta, _i, _a, c, k;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.area.findMany({
                        where: areasDeLaSede(ctx.idsede),
                        orderBy: { descripcion: 'asc' }
                    })];
                case 1:
                    areas = _b.sent();
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            select: { idarea: true }
                        })];
                case 2:
                    personal = _b.sent();
                    cuenta = new Map();
                    for (_i = 0, _a = personal; _i < _a.length; _i++) {
                        c = _a[_i];
                        k = c.idarea || 0;
                        cuenta.set(k, (cuenta.get(k) || 0) + 1);
                    }
                    return [2 /*return*/, {
                            areas: areas.map(function (a) { return ({
                                idarea: a.idarea, descripcion: a.descripcion, personal: cuenta.get(a.idarea) || 0
                            }); }),
                            sin_area: cuenta.get(0) || 0
                        }];
            }
        });
    });
}
exports.listarAreas = listarAreas;
/** Asigna area a una o varias personas de una vez. */
function asignarArea(ctx, body, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var ids, idarea, a, r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
                    if (!ids.length) {
                        throw new Invalido('No se selecciono a nadie.');
                    }
                    idarea = Number(body.idarea) || null;
                    if (!idarea) return [3 /*break*/, 2];
                    return [4 /*yield*/, prisma.area.findFirst({ where: __assign({ idarea: idarea }, areasDeLaSede(ctx.idsede)) })];
                case 1:
                    a = _a.sent();
                    if (!a) {
                        throw new Invalido('Esa area no es de esta sede.', 404);
                    }
                    _a.label = 2;
                case 2: return [4 /*yield*/, prisma.colaborador.updateMany({
                        where: { idcolaborador: { "in": ids }, idorg: ctx.idorg, idsede: ctx.idsede },
                        data: { idarea: idarea }
                    })];
                case 3:
                    r = _a.sent();
                    return [2 /*return*/, { actualizados: r.count }];
            }
        });
    });
}
exports.asignarArea = asignarArea;
/**
 * El mismo horario para todo un grupo.
 *
 * Existe porque la cocina entera suele entrar a la misma hora: cargarlo uno por
 * uno son quince dialogos identicos, y a la quinta persona alguien se equivoca.
 *
 * `solo_contar` devuelve a cuantos alcanzaria sin tocar nada, para que la
 * pantalla pueda decir "se va a aplicar a 12" ANTES de que se confirme.
 */
function horarioMasivo(ctx, body, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var base, alcance, idarea, a, ids, horario, tolerancia, alcanzados, r, comoSeEligio, _a;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    base = { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 };
                    alcance = String(body.alcance || '');
                    if (!(alcance === 'area')) return [3 /*break*/, 3];
                    idarea = Number(body.idarea) || null;
                    if (!idarea) return [3 /*break*/, 2];
                    return [4 /*yield*/, prisma.area.findFirst({ where: __assign({ idarea: idarea }, areasDeLaSede(ctx.idsede)) })];
                case 1:
                    a = _d.sent();
                    if (!a) {
                        throw new Invalido('Esa area no es de esta sede.', 404);
                    }
                    _d.label = 2;
                case 2:
                    base.idarea = idarea; // null = "sin area"
                    return [3 /*break*/, 4];
                case 3:
                    if (alcance === 'seleccion') {
                        ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
                        if (!ids.length) {
                            throw new Invalido('No se selecciono a nadie.');
                        }
                        base.idcolaborador = { "in": ids };
                    }
                    else if (alcance !== 'todos') {
                        throw new Invalido('Alcance no reconocido.');
                    }
                    _d.label = 4;
                case 4:
                    if (!body.solo_contar) return [3 /*break*/, 6];
                    _b = {};
                    return [4 /*yield*/, prisma.colaborador.count({ where: base })];
                case 5: return [2 /*return*/, (_b.alcanzados = _d.sent(), _b)];
                case 6:
                    try {
                        horario = (0, asistencia_calendario_1.validarHorario)(body.horario_semanal);
                    }
                    catch (e) {
                        throw new Invalido(e.message);
                    }
                    tolerancia = Number(body.tolerancia_min);
                    if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 240) {
                        tolerancia = 10;
                    }
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: base, select: { idcolaborador: true, nombres: true }
                        })];
                case 7:
                    alcanzados = _d.sent();
                    return [4 /*yield*/, prisma.colaborador.updateMany({
                            where: base,
                            data: {
                                horario_semanal: horario === null ? client_1.Prisma.DbNull : horario,
                                tolerancia_min: tolerancia
                            }
                        })];
                case 8:
                    r = _d.sent();
                    comoSeEligio = alcance === 'todos' ? 'todo el personal'
                        : alcance === 'area' ? (Number(body.idarea) ? 'un area' : 'los que no tienen area')
                            : 'una seleccion';
                    _a = asistencia_bitacora_1.anotar;
                    _c = {
                        idorg: ctx.idorg
                    };
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 9: return [4 /*yield*/, _a.apply(void 0, [(_c.idsede_restobar = _d.sent(),
                            _c.entidad = 'HORARIO',
                            _c.accion = 'MODIFICA',
                            _c.detalle = "Horario masivo a ".concat(comoSeEligio, " (").concat(r.count, " persona(s)): ") +
                                "".concat((0, asistencia_bitacora_1.horarioATexto)(horario), ", tolerancia ").concat(tolerancia, " min"),
                            _c.nuevo = {
                                horario_semanal: horario, tolerancia_min: tolerancia,
                                alcance: alcance,
                                alcanzados: alcanzados.map(function (c) { return ({ id: c.idcolaborador, nombre: c.nombres }); })
                            },
                            _c), autor])];
                case 10:
                    _d.sent();
                    return [2 /*return*/, { actualizados: r.count }];
            }
        });
    });
}
exports.horarioMasivo = horarioMasivo;
// ---------------------------------------------------------------------------
// Calendario: lectura
// ---------------------------------------------------------------------------
/**
 * El mes completo tal como lo ve el calendario: que dias abre el local, cuales
 * son feriado y que excepciones hay cargadas.
 *
 * Devuelve el estado de la SEDE por dia. El detalle por persona se pide aparte
 * al tocar un dia: traer 17 personas x 30 dias en cada apertura del mes seria
 * pesado y casi nunca se mira.
 */
function calendarioMes(ctx, mesPedido) {
    return __awaiter(this, void 0, void 0, function () {
        var mes, dias, c, personalesPorDia, _i, _a, e;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mes = /^\d{4}-\d{2}$/.test(String(mesPedido || '')) ? String(mesPedido) : (0, asistencia_calendario_1.ahoraLima)().slice(0, 7);
                    dias = diasDelMes(mes);
                    return [4 /*yield*/, contextoLaboral(ctx.idorg, ctx.idsede, dias[0], dias[dias.length - 1])];
                case 1:
                    c = _b.sent();
                    personalesPorDia = new Map();
                    for (_i = 0, _a = c.excepciones; _i < _a.length; _i++) {
                        e = _a[_i];
                        if (e.idcolaborador === 0) {
                            continue;
                        }
                        personalesPorDia.set(e.fecha, (personalesPorDia.get(e.fecha) || 0) + 1);
                    }
                    return [2 /*return*/, {
                            mes: mes,
                            dias_cierre: c.dias_cierre,
                            dias: dias.map(function (fecha) {
                                var sem = (0, asistencia_calendario_1.diaSemana)(fecha);
                                var feriado = c.feriados.get(fecha) || null;
                                var exc = c.deSede.find(function (e) { return e.fecha === fecha; }) || null;
                                // Que pasa con el LOCAL ese dia (no con una persona)
                                var abre = exc ? exc.tipo === 'LABORABLE'
                                    : feriado ? false
                                        : !c.dias_cierre.includes(sem);
                                return {
                                    fecha: fecha,
                                    dia_semana: sem,
                                    abre: abre,
                                    feriado: feriado,
                                    excepcion: exc ? { tipo: exc.tipo, motivo: exc.motivo } : null,
                                    idexcepcion: c.ids.get("0|".concat(fecha)) || null,
                                    personas_con_excepcion: personalesPorDia.get(fecha) || 0
                                };
                            })
                        }];
            }
        });
    });
}
exports.calendarioMes = calendarioMes;
/** El detalle de un dia: quien trabaja, quien descansa y por que. */
function calendarioDia(ctx, fechaPedida) {
    return __awaiter(this, void 0, void 0, function () {
        var fecha, c, personal;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fecha = String(fechaPedida || '');
                    if (!exports.ES_FECHA.test(fecha)) {
                        throw new Invalido('Falta el dia.');
                    }
                    return [4 /*yield*/, contextoLaboral(ctx.idorg, ctx.idsede, fecha, fecha)];
                case 1:
                    c = _a.sent();
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            orderBy: { nombres: 'asc' }
                        })];
                case 2:
                    personal = _a.sent();
                    return [2 /*return*/, {
                            fecha: fecha,
                            feriado: c.feriados.get(fecha) || null,
                            excepcion_sede: c.deSede.find(function (e) { return e.fecha === fecha; }) || null,
                            idexcepcion_sede: c.ids.get("0|".concat(fecha)) || null,
                            personal: personal.map(function (p) {
                                var _a;
                                var dl = (0, asistencia_dialaboral_1.resolverDia)({
                                    fecha: fecha,
                                    horario_semanal: p.horario_semanal,
                                    tolerancia_min: (_a = p.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                                    excepciones: c.porPersona(p.idcolaborador),
                                    feriados: c.feriados,
                                    dias_cierre: c.dias_cierre,
                                    politica: c.politica
                                });
                                return {
                                    idcolaborador: p.idcolaborador,
                                    nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                                    labora: dl.labora,
                                    origen: dl.origen,
                                    motivo: dl.motivo,
                                    hora_esperada: dl.hora_esperada,
                                    es_descanso_trabajado: dl.es_descanso_trabajado,
                                    compensacion: dl.compensacion,
                                    fecha_sustituto: dl.fecha_sustituto,
                                    idexcepcion: c.ids.get("".concat(p.idcolaborador, "|").concat(fecha)) || null
                                };
                            })
                        }];
            }
        });
    });
}
exports.calendarioDia = calendarioDia;
// ---------------------------------------------------------------------------
// Calendario: escritura
// ---------------------------------------------------------------------------
/**
 * Guarda una excepcion. Con idcolaborador 0 aplica a toda la sede.
 *
 * Es un upsert por (sede, persona, fecha): volver a guardar el mismo dia
 * corrige en vez de duplicar, que es lo que el admin espera cuando se
 * equivoco de opcion.
 */
function guardarExcepcion(ctx, body, autor, desdeKiosko) {
    var _a;
    if (desdeKiosko === void 0) { desdeKiosko = false; }
    return __awaiter(this, void 0, void 0, function () {
        var fecha, tipo, motivo, idcolaborador, c, cat, categoria, compensacion, fechaSustituto, recargo, comp, p, idsedeRestobar, datos, previa, quien, _b, frase, creada;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    fecha = String(body.fecha || '');
                    if (!exports.ES_FECHA.test(fecha)) {
                        throw new Invalido('Falta el dia.');
                    }
                    tipo = String(body.tipo || '').toUpperCase();
                    if (tipo !== 'LABORABLE' && tipo !== 'NO_LABORABLE') {
                        throw new Invalido('Tipo no valido.');
                    }
                    motivo = texto(body.motivo, 200);
                    if (!motivo) {
                        throw new Invalido('Escribe el motivo: es lo que explica el cambio despues.');
                    }
                    idcolaborador = Number(body.idcolaborador) || 0;
                    if (!idcolaborador) return [3 /*break*/, 2];
                    return [4 /*yield*/, prisma.colaborador.findFirst({
                            where: { idcolaborador: idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
                        })];
                case 1:
                    c = _c.sent();
                    if (!c) {
                        throw new Invalido('Ese colaborador no es de esta sede.', 404);
                    }
                    _c.label = 2;
                case 2:
                    cat = String(body.categoria || 'NORMAL').toUpperCase();
                    categoria = (idcolaborador && tipo === 'NO_LABORABLE' && CATEGORIAS.includes(cat)) ? cat : 'NORMAL';
                    compensacion = null;
                    fechaSustituto = null;
                    recargo = 100;
                    if (idcolaborador && tipo === 'LABORABLE') {
                        comp = String(body.compensacion || '').toUpperCase();
                        if (comp === 'SUSTITUTORIO') {
                            fechaSustituto = String(body.fecha_sustituto || '');
                            if (!exports.ES_FECHA.test(fechaSustituto)) {
                                throw new Invalido('Elige que dia descansa a cambio.');
                            }
                            if (fechaSustituto === fecha) {
                                throw new Invalido('El dia de descanso no puede ser el mismo que trabaja.');
                            }
                            compensacion = 'SUSTITUTORIO';
                        }
                        else if (comp === 'RECARGO') {
                            compensacion = 'RECARGO';
                            p = Number(body.recargo_pct);
                            // 100% es lo que manda el D.Leg. 713 para el dia de descanso y el
                            // feriado. Se deja editable por si pactan mas, nunca menos.
                            recargo = Number.isFinite(p) && p >= 100 && p <= 300 ? Math.round(p) : 100;
                        }
                        // Sin compensacion elegida se guarda igual: el reporte lo marca como
                        // pendiente de definir en vez de bloquear la carga en la puerta.
                    }
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 3:
                    idsedeRestobar = _c.sent();
                    datos = {
                        idorg: ctx.idorg,
                        idsede_restobar: idsedeRestobar,
                        idcolaborador: idcolaborador,
                        fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'),
                        tipo: tipo,
                        motivo: motivo,
                        compensacion: compensacion,
                        fecha_sustituto: fechaSustituto ? (0, asistencia_calendario_1.fechaSql)(fechaSustituto + ' 00:00:00') : null,
                        recargo_pct: recargo,
                        categoria: categoria,
                        origen: desdeKiosko ? 'KIOSKO' : 'MANUAL',
                        creado_por: autor.idusuario,
                        creado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)())
                    };
                    return [4 /*yield*/, prisma.asistencia_excepcion.findFirst({
                            where: { idsede_restobar: idsedeRestobar, idcolaborador: idcolaborador, fecha: datos.fecha }
                        })];
                case 4:
                    previa = _c.sent();
                    if (!idcolaborador) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma.colaborador.findUnique({ where: { idcolaborador: idcolaborador } })];
                case 5:
                    _b = (((_a = (_c.sent())) === null || _a === void 0 ? void 0 : _a.nombres) || ('#' + idcolaborador));
                    return [3 /*break*/, 7];
                case 6:
                    _b = 'Todo el local';
                    _c.label = 7;
                case 7:
                    quien = _b;
                    frase = (0, asistencia_bitacora_1.detalleExcepcion)(quien, fecha, tipo, motivo, compensacion, fechaSustituto);
                    if (!previa) return [3 /*break*/, 10];
                    return [4 /*yield*/, prisma.asistencia_excepcion.update({ where: { idexcepcion: previa.idexcepcion }, data: datos })];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
                            entidad: 'EXCEPCION', identidad: previa.idexcepcion,
                            idcolaborador: idcolaborador || null, accion: 'MODIFICA',
                            detalle: frase,
                            anterior: { tipo: previa.tipo, motivo: previa.motivo, compensacion: previa.compensacion },
                            nuevo: { tipo: tipo, motivo: motivo, compensacion: compensacion, fecha_sustituto: fechaSustituto, recargo_pct: recargo }
                        }, autor)];
                case 9:
                    _c.sent();
                    return [2 /*return*/, { accion: 'ACTUALIZADA', idexcepcion: previa.idexcepcion }];
                case 10: return [4 /*yield*/, prisma.asistencia_excepcion.create({ data: datos })];
                case 11:
                    creada = _c.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
                            entidad: 'EXCEPCION', identidad: creada.idexcepcion,
                            idcolaborador: idcolaborador || null, accion: 'CREA',
                            detalle: frase,
                            nuevo: { tipo: tipo, motivo: motivo, compensacion: compensacion, fecha_sustituto: fechaSustituto, recargo_pct: recargo }
                        }, autor)];
                case 12:
                    _c.sent();
                    return [2 /*return*/, { accion: 'CREADA', idexcepcion: creada.idexcepcion }];
            }
        });
    });
}
exports.guardarExcepcion = guardarExcepcion;
function eliminarExcepcion(ctx, idPedido, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var id, previa, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    id = Number(idPedido) || 0;
                    if (!id) {
                        throw new Invalido('id invalido');
                    }
                    return [4 /*yield*/, prisma.asistencia_excepcion.findFirst({
                            where: { idexcepcion: id, idorg: ctx.idorg }
                        })];
                case 1:
                    previa = _c.sent();
                    if (!previa) {
                        throw new Invalido('Esa excepcion no es de esta empresa.', 404);
                    }
                    return [4 /*yield*/, prisma.asistencia_excepcion.deleteMany({ where: { idexcepcion: id, idorg: ctx.idorg } })];
                case 2:
                    _c.sent();
                    _a = asistencia_bitacora_1.anotar;
                    _b = {
                        idorg: ctx.idorg
                    };
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 3: return [4 /*yield*/, _a.apply(void 0, [(_b.idsede_restobar = _c.sent(),
                            _b.entidad = 'EXCEPCION',
                            _b.identidad = id,
                            _b.idcolaborador = previa.idcolaborador || null,
                            _b.accion = 'ELIMINA',
                            _b.detalle = 'Se quito la excepcion del ' + (0, asistencia_calendario_1.aTextoLima)(previa.fecha).slice(0, 10) + ' (' + previa.motivo + ')',
                            _b.anterior = { tipo: previa.tipo, motivo: previa.motivo, compensacion: previa.compensacion },
                            _b), autor])];
                case 4:
                    _c.sent();
                    return [2 /*return*/, { eliminada: true }];
            }
        });
    });
}
exports.eliminarExcepcion = eliminarExcepcion;
/** Dias fijos que el local no abre. Es una regla; las excepciones le ganan. */
function guardarDiasCierre(ctx, diasPedidos, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var pedidos, dias, unicos, antes, previos;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    pedidos = Array.isArray(diasPedidos) ? diasPedidos : [];
                    dias = pedidos.map(function (d) { return String(d).toLowerCase().trim(); }).filter(function (d) { return DIAS_SEM.includes(d); });
                    unicos = Array.from(new Set(dias));
                    if (unicos.length === 7) {
                        throw new Invalido('No se pueden cerrar los siete dias de la semana.');
                    }
                    return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 1:
                    antes = _b.sent();
                    previos = String((antes === null || antes === void 0 ? void 0 : antes.dias_cierre) || '');
                    return [4 /*yield*/, prisma.sede.update({ where: { idsede: ctx.idsede }, data: { dias_cierre: unicos.join(',') } })];
                case 2:
                    _b.sent();
                    if (!(previos !== unicos.join(','))) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: (_a = antes === null || antes === void 0 ? void 0 : antes.idsede_restobar) !== null && _a !== void 0 ? _a : 0,
                            entidad: 'DIAS_CIERRE', accion: 'MODIFICA',
                            detalle: 'Dias que el local no abre: ' + (previos || 'ninguno') + ' -> ' + (unicos.join(',') || 'ninguno'),
                            anterior: { dias_cierre: previos },
                            nuevo: { dias_cierre: unicos.join(',') }
                        }, autor)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/, { dias_cierre: unicos }];
            }
        });
    });
}
exports.guardarDiasCierre = guardarDiasCierre;
// ---------------------------------------------------------------------------
// Configuracion: las tres preguntas
// ---------------------------------------------------------------------------
//
// Todo el modulo se opera con esto contestado una vez. Son tres decisiones del
// negocio, no tareas diarias:
//   1. que dias no abre el local
//   2. si abre los feriados y si se pagan extra
//   3. que pasa si alguien trabaja en su dia de descanso
//
// Van juntas en una sola pantalla y un solo guardado a proposito: partirlas en
// tres formularios haria que la gente conteste una y deje las otras en el
// default sin enterarse.
function leerConfiguracion(ctx, anioPedido) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var sede, pol, anio, feriados, abiertos, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 1:
                    sede = _c.sent();
                    pol = politicaDe(sede);
                    anio = /^\d{4}$/.test(String(anioPedido || '')) ? Number(anioPedido) : Number((0, asistencia_calendario_1.ahoraLima)().slice(0, 4));
                    return [4 /*yield*/, prisma.asistencia_feriado.findMany({
                            where: {
                                estado: '0',
                                OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
                                fecha: { gte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-01-01 00:00:00")), lte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-12-31 00:00:00")) }
                            },
                            orderBy: { fecha: 'asc' }
                        })];
                case 2:
                    feriados = _c.sent();
                    _b = Set.bind;
                    return [4 /*yield*/, prisma.asistencia_excepcion.findMany({
                            where: {
                                idsede_restobar: (_a = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _a !== void 0 ? _a : 0,
                                idcolaborador: 0,
                                tipo: 'LABORABLE',
                                fecha: { gte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-01-01 00:00:00")), lte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-12-31 00:00:00")) }
                            }
                        })];
                case 3:
                    abiertos = new (_b.apply(Set, [void 0, (_c.sent()).map(function (e) { return (0, asistencia_calendario_1.aTextoLima)(e.fecha).slice(0, 10); })]))();
                    return [2 /*return*/, __assign(__assign({ anio: anio, configurado: !!(sede === null || sede === void 0 ? void 0 : sede.asis_configurado), dias_cierre: String((sede === null || sede === void 0 ? void 0 : sede.dias_cierre) || '').split(',').map(function (d) { return d.trim(); }).filter(Boolean) }, pol), { feriados: feriados.map(function (f) {
                                var fecha = (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10);
                                return {
                                    idferiado: f.idferiado,
                                    fecha: fecha,
                                    descripcion: f.descripcion,
                                    propio: f.idorg !== 0,
                                    // Sin excepcion cargada manda el default del ano; con excepcion,
                                    // manda la excepcion. Asi un feriado nuevo del ano que viene
                                    // hereda lo que la sede ya decidio en vez de cerrar de golpe.
                                    labora: abiertos.has(fecha) ? true : pol.feriado_abre
                                };
                            }) })];
            }
        });
    });
}
exports.leerConfiguracion = leerConfiguracion;
/** El ano que se esta configurando: el que viene en el cuerpo o el de las fechas. */
function anioDe(body, fechas) {
    if (/^\d{4}$/.test(String((body === null || body === void 0 ? void 0 : body.anio) || ''))) {
        return Number(body.anio);
    }
    if (fechas.length) {
        return Number(fechas[0].slice(0, 4));
    }
    return Number((0, asistencia_calendario_1.ahoraLima)().slice(0, 4));
}
/**
 * Deja las excepciones de sede de un ano igual a lo que el usuario marco.
 *
 * Escribe SOLO las diferencias contra el default (`feriado_abre`): si trabajan
 * todos los feriados, el default ya lo dice y no hace falta una excepcion por
 * dia; si es una seleccion, cada dia trabajado lleva la suya. Menos filas y,
 * sobre todo, ningun dia queda con dos fuentes de verdad que puedan
 * contradecirse.
 *
 * Solo toca los dias que son feriado. Una excepcion cargada a mano en un dia
 * cualquiera ("este lunes abrimos") no se ve afectada.
 */
function sincronizarFeriados(ctx, trabajados, todos, anio, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var feriados, idsedeRestobar, quiere, _i, feriados_1, f, fecha, previa, hace_falta;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.asistencia_feriado.findMany({
                        where: {
                            estado: '0',
                            OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
                            fecha: { gte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-01-01 00:00:00")), lte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-12-31 00:00:00")) }
                        }
                    })];
                case 1:
                    feriados = _a.sent();
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 2:
                    idsedeRestobar = _a.sent();
                    quiere = new Set(trabajados);
                    _i = 0, feriados_1 = feriados;
                    _a.label = 3;
                case 3:
                    if (!(_i < feriados_1.length)) return [3 /*break*/, 9];
                    f = feriados_1[_i];
                    fecha = (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10);
                    return [4 /*yield*/, prisma.asistencia_excepcion.findFirst({
                            where: { idsede_restobar: idsedeRestobar, idcolaborador: 0, fecha: f.fecha }
                        })];
                case 4:
                    previa = _a.sent();
                    hace_falta = !todos && quiere.has(fecha);
                    if (!(hace_falta && !previa)) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma.asistencia_excepcion.create({
                            data: {
                                idorg: ctx.idorg, idsede_restobar: idsedeRestobar, idcolaborador: 0,
                                fecha: f.fecha, tipo: 'LABORABLE',
                                motivo: f.descripcion, compensacion: null, fecha_sustituto: null,
                                recargo_pct: 100, origen: 'MANUAL',
                                creado_por: autor.idusuario, creado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)())
                            }
                        })];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 6:
                    if (!(!hace_falta && previa && previa.tipo === 'LABORABLE')) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.asistencia_excepcion["delete"]({ where: { idexcepcion: previa.idexcepcion } })];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function guardarConfiguracion(ctx, body, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var antes, prev, trabajados, hayListaFeriados, totalFeriados, todosTrabajados, feriadoAbre, descanso, pct, feriadoPct, descansoPct, frase, ahora;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!Array.isArray(body.dias_cierre)) return [3 /*break*/, 2];
                    return [4 /*yield*/, guardarDiasCierre(ctx, body.dias_cierre, autor)];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 3:
                    antes = _b.sent();
                    prev = politicaDe(antes);
                    trabajados = Array.isArray(body.feriados_labora)
                        ? body.feriados_labora.map(function (f) { return String(f); }).filter(function (f) { return exports.ES_FECHA.test(f); })
                        : [];
                    hayListaFeriados = Array.isArray(body.feriados_labora);
                    totalFeriados = Number(body.feriados_total) || 0;
                    todosTrabajados = hayListaFeriados && totalFeriados > 0 && trabajados.length === totalFeriados;
                    feriadoAbre = hayListaFeriados ? todosTrabajados : !!body.feriado_abre;
                    descanso = String(body.descanso_trabajado || '').toUpperCase() === 'RECARGO' ? 'RECARGO' : 'PERMISO';
                    pct = function (v, min) {
                        var n = Number(v);
                        return Number.isFinite(n) && n >= min && n <= 300 ? Math.round(n) : min;
                    };
                    feriadoPct = pct(body.feriado_recargo_pct, 0);
                    descansoPct = pct(body.descanso_recargo_pct, 100);
                    return [4 /*yield*/, prisma.sede.update({
                            where: { idsede: ctx.idsede },
                            data: {
                                feriado_abre: feriadoAbre,
                                feriado_recargo_pct: feriadoPct,
                                descanso_trabajado: descanso,
                                descanso_recargo_pct: descansoPct
                            }
                        })];
                case 4:
                    _b.sent();
                    if (!hayListaFeriados) return [3 /*break*/, 6];
                    return [4 /*yield*/, sincronizarFeriados(ctx, trabajados, todosTrabajados, anioDe(body, trabajados), autor)];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    frase = function (p) {
                        return (p.feriado_abre ? 'trabaja todos los feriados' : 'trabaja solo los feriados marcados') +
                            (p.feriado_recargo_pct ? " (+".concat(p.feriado_recargo_pct, "%)") : ' sin extra') +
                            '; descanso trabajado: ' +
                            (p.descanso_trabajado === 'RECARGO' ? "se paga +".concat(p.descanso_recargo_pct, "%") : 'con permiso del administrador');
                    };
                    ahora = { feriado_abre: feriadoAbre, feriado_recargo_pct: feriadoPct, descanso_trabajado: descanso, descanso_recargo_pct: descansoPct };
                    if (!(frase(prev) !== frase(ahora))) return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: (_a = antes === null || antes === void 0 ? void 0 : antes.idsede_restobar) !== null && _a !== void 0 ? _a : 0,
                            entidad: 'POLITICA', accion: 'MODIFICA',
                            detalle: 'Politica: ' + frase(prev) + ' -> ' + frase(ahora),
                            anterior: prev, nuevo: ahora
                        }, autor)];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8: return [2 /*return*/, leerConfiguracion(ctx)];
            }
        });
    });
}
exports.guardarConfiguracion = guardarConfiguracion;
// ---------------------------------------------------------------------------
// Feriados
// ---------------------------------------------------------------------------
/** Feriados visibles para la sede: los nacionales mas los propios de la empresa. */
function listarFeriados(ctx, anioPedido) {
    return __awaiter(this, void 0, void 0, function () {
        var anio, filas;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    anio = /^\d{4}$/.test(String(anioPedido || '')) ? Number(anioPedido) : Number((0, asistencia_calendario_1.ahoraLima)().slice(0, 4));
                    return [4 /*yield*/, prisma.asistencia_feriado.findMany({
                            where: {
                                estado: '0',
                                OR: [{ idorg: 0 }, { idorg: ctx.idorg }],
                                fecha: { gte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-01-01 00:00:00")), lte: (0, asistencia_calendario_1.fechaSql)("".concat(anio, "-12-31 00:00:00")) }
                            },
                            orderBy: { fecha: 'asc' }
                        })];
                case 1:
                    filas = _a.sent();
                    return [2 /*return*/, {
                            anio: anio,
                            feriados: filas.map(function (f) { return ({
                                idferiado: f.idferiado,
                                fecha: (0, asistencia_calendario_1.aTextoLima)(f.fecha).slice(0, 10),
                                descripcion: f.descripcion,
                                // Los nacionales no se editan desde una empresa: son de todas
                                propio: f.idorg !== 0
                            }); })
                        }];
            }
        });
    });
}
exports.listarFeriados = listarFeriados;
/** Feriado propio de la empresa (aniversario del local, feriado regional). */
function guardarFeriado(ctx, body, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var fecha, descripcion, nacional, idsedeRestobar, previo, f;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fecha = String(body.fecha || '');
                    if (!exports.ES_FECHA.test(fecha)) {
                        throw new Invalido('Falta la fecha.');
                    }
                    descripcion = texto(body.descripcion, 120);
                    if (!descripcion) {
                        throw new Invalido('Ponle un nombre al feriado.');
                    }
                    return [4 /*yield*/, prisma.asistencia_feriado.findFirst({
                            where: { idorg: 0, fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'), estado: '0' }
                        })];
                case 1:
                    nacional = _a.sent();
                    if (nacional) {
                        throw new Invalido("Ese dia ya es feriado nacional (".concat(nacional.descripcion, ")."));
                    }
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 2:
                    idsedeRestobar = _a.sent();
                    return [4 /*yield*/, prisma.asistencia_feriado.findFirst({
                            where: { idorg: ctx.idorg, fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00') }
                        })];
                case 3:
                    previo = _a.sent();
                    if (!previo) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma.asistencia_feriado.update({
                            where: { idferiado: previo.idferiado }, data: { descripcion: descripcion, estado: '0' }
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
                            entidad: 'FERIADO', identidad: previo.idferiado, accion: 'MODIFICA',
                            detalle: 'Feriado del ' + fecha + ': ' + previo.descripcion + ' -> ' + descripcion,
                            anterior: { descripcion: previo.descripcion }, nuevo: { descripcion: descripcion }
                        }, autor)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, { idferiado: previo.idferiado, accion: 'ACTUALIZADO' }];
                case 6: return [4 /*yield*/, prisma.asistencia_feriado.create({
                        data: { idorg: ctx.idorg, fecha: (0, asistencia_calendario_1.fechaSql)(fecha + ' 00:00:00'), descripcion: descripcion, estado: '0' }
                    })];
                case 7:
                    f = _a.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: idsedeRestobar,
                            entidad: 'FERIADO', identidad: f.idferiado, accion: 'CREA',
                            detalle: 'Nuevo feriado propio: ' + fecha + ' ' + descripcion,
                            nuevo: { fecha: fecha, descripcion: descripcion }
                        }, autor)];
                case 8:
                    _a.sent();
                    return [2 /*return*/, { idferiado: f.idferiado, accion: 'CREADO' }];
            }
        });
    });
}
exports.guardarFeriado = guardarFeriado;
function eliminarFeriado(ctx, idPedido, autor) {
    return __awaiter(this, void 0, void 0, function () {
        var id, previo, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    id = Number(idPedido) || 0;
                    if (!id) {
                        throw new Invalido('id invalido');
                    }
                    return [4 /*yield*/, prisma.asistencia_feriado.findFirst({
                            where: { idferiado: id, idorg: ctx.idorg }
                        })];
                case 1:
                    previo = _c.sent();
                    if (!previo) {
                        throw new Invalido('Los feriados nacionales no se pueden borrar.', 404);
                    }
                    return [4 /*yield*/, prisma.asistencia_feriado.deleteMany({ where: { idferiado: id, idorg: ctx.idorg } })];
                case 2:
                    _c.sent();
                    _a = asistencia_bitacora_1.anotar;
                    _b = {
                        idorg: ctx.idorg
                    };
                    return [4 /*yield*/, sedeRestobar(ctx.idsede)];
                case 3: return [4 /*yield*/, _a.apply(void 0, [(_b.idsede_restobar = _c.sent(),
                            _b.entidad = 'FERIADO',
                            _b.identidad = id,
                            _b.accion = 'ELIMINA',
                            _b.detalle = 'Se quito el feriado ' + (0, asistencia_calendario_1.aTextoLima)(previo.fecha).slice(0, 10) + ' ' + previo.descripcion,
                            _b.anterior = { fecha: (0, asistencia_calendario_1.aTextoLima)(previo.fecha).slice(0, 10), descripcion: previo.descripcion },
                            _b), autor])];
                case 4:
                    _c.sent();
                    return [2 /*return*/, { eliminado: true }];
            }
        });
    });
}
exports.eliminarFeriado = eliminarFeriado;
// ---------------------------------------------------------------------------
// Bitacora
// ---------------------------------------------------------------------------
/** Historial de cambios, para responder un reclamo con un hecho. */
function listarBitacora(ctx, body) {
    return __awaiter(this, void 0, void 0, function () {
        var idcolaborador, limite, filas;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    idcolaborador = Number(body === null || body === void 0 ? void 0 : body.idcolaborador) || 0;
                    limite = Math.min(200, Math.max(1, Number(body === null || body === void 0 ? void 0 : body.limite) || 50));
                    return [4 /*yield*/, prisma.asistencia_bitacora.findMany({
                            where: __assign({ idorg: ctx.idorg }, (idcolaborador ? { idcolaborador: idcolaborador } : {})),
                            // creado_at solo tiene precision de segundo: dos cambios seguidos
                            // saldrian en cualquier orden. El id si es estrictamente creciente.
                            orderBy: { idbitacora: 'desc' },
                            take: limite
                        })];
                case 1:
                    filas = _a.sent();
                    return [2 /*return*/, {
                            cambios: filas.map(function (f) { return ({
                                idbitacora: f.idbitacora,
                                fecha: (0, asistencia_calendario_1.aTextoLima)(f.creado_at),
                                entidad: f.entidad,
                                accion: f.accion,
                                detalle: f.detalle,
                                origen: f.origen,
                                usuario: f.usuario_nombre,
                                autorizado_por: f.autorizado_nombre || null
                            }); })
                        }];
            }
        });
    });
}
exports.listarBitacora = listarBitacora;
