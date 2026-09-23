"use strict";
// Como lleva la planilla esta empresa.
//
// Dos cosas, y las dos son decisiones del negocio que se contestan una vez:
//
//   1. CADA CUANTO SE PAGA. Semanal, quincenal, mensual o diario. Define los
//      periodos que se pueden cerrar.
//
//   2. QUE TAN FORMAL ES. Seis interruptores, todos apagados de fabrica. El
//      nivel 0 es "se cuanto le pago a cada uno y le imprimo su boleta", que es
//      lo que la mayoria necesita y lo unico que muchos van a usar nunca.
//      Encender uno agrega su bloque de conceptos; apagarlo los esconde sin
//      borrar nada de lo ya cargado.
//
// POR QUE APAGADOS POR DEFECTO
// Al reves -- todo encendido y que apague lo que no usa -- el primer contacto
// con el sistema es una boleta con AFP, CTS y renta de quinta que la persona no
// entiende y no sabe si puede tocar. Empezar simple y agregar es mas facil que
// empezar lleno y podar.
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
exports.resolverPeriodoDeOrg = exports.guardarConfig = exports.leerConfig = exports.configDe = exports.INTERRUPTORES = void 0;
var client_1 = require("@prisma/client");
var asistencia_bitacora_1 = require("./asistencia.bitacora");
var asistencia_config_1 = require("./asistencia.config");
var planilla_periodos_1 = require("./planilla.periodos");
var asistencia_calendario_1 = require("./asistencia.calendario");
var prisma = new client_1.PrismaClient();
/** Los interruptores, con el nombre que ve la gente y que agrega cada uno. */
exports.INTERRUPTORES = [
    { campo: 'usa_pensiones', clave: 'pensiones', titulo: 'Descuento de pensiones (AFP / ONP)',
        ayuda: 'Agrega el descuento de pensiones a la boleta. Obligatorio para personal en planilla formal.' },
    { campo: 'usa_essalud', clave: 'essalud', titulo: 'Aporte a EsSalud',
        ayuda: 'El 9% que paga el empleador. No se le descuenta al trabajador: es costo de la empresa.' },
    { campo: 'usa_cts', clave: 'cts', titulo: 'CTS',
        ayuda: 'Compensacion por tiempo de servicios, que se deposita en mayo y noviembre.' },
    { campo: 'usa_gratificacion', clave: 'gratificacion', titulo: 'Gratificaciones',
        ayuda: 'Las de julio y diciembre.' },
    { campo: 'usa_renta_quinta', clave: 'renta_quinta', titulo: 'Renta de quinta categoria',
        ayuda: 'Retencion de impuesto a la renta. Solo aplica por encima de 7 UIT al ano.' },
    { campo: 'usa_formato_legal', clave: 'formato_legal', titulo: 'Boleta con formato de ley',
        ayuda: 'Imprime la boleta con los datos que exige la norma: RUC, regimen laboral, dias trabajados.' }
];
function configDe(org) {
    return {
        frecuencia_pago: (0, planilla_periodos_1.normalizarFrecuencia)(org === null || org === void 0 ? void 0 : org.frecuencia_pago),
        semana_empieza: (0, planilla_periodos_1.normalizarInicioSemana)(org === null || org === void 0 ? void 0 : org.semana_empieza),
        usa_pensiones: !!(org === null || org === void 0 ? void 0 : org.usa_pensiones),
        usa_essalud: !!(org === null || org === void 0 ? void 0 : org.usa_essalud),
        usa_cts: !!(org === null || org === void 0 ? void 0 : org.usa_cts),
        usa_gratificacion: !!(org === null || org === void 0 ? void 0 : org.usa_gratificacion),
        usa_renta_quinta: !!(org === null || org === void 0 ? void 0 : org.usa_renta_quinta),
        usa_formato_legal: !!(org === null || org === void 0 ? void 0 : org.usa_formato_legal)
    };
}
exports.configDe = configDe;
function leerConfig(ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var org, cfg, hoy;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 1:
                    org = _a.sent();
                    cfg = configDe(org);
                    hoy = (0, asistencia_calendario_1.ahoraLima)().slice(0, 10);
                    return [2 /*return*/, __assign(__assign({}, cfg), { interruptores: exports.INTERRUPTORES.map(function (i) { return (__assign(__assign({}, i), { activo: cfg[i.campo] })); }), 
                            // El periodo en curso y los anteriores, para que la pantalla no tenga
                            // que reimplementar las cuentas de calendario.
                            periodo_actual: (0, planilla_periodos_1.periodoDe)(hoy, cfg.frecuencia_pago, cfg.semana_empieza), periodos: (0, planilla_periodos_1.ultimosPeriodos)(hoy, cfg.frecuencia_pago, cfg.semana_empieza, 12) })];
            }
        });
    });
}
exports.leerConfig = leerConfig;
function guardarConfig(ctx, body, autor) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var org, antes, frecuencia, semana, flag, nuevo, encendidos, frase, sede;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 1:
                    org = _d.sent();
                    antes = configDe(org);
                    frecuencia = (0, planilla_periodos_1.normalizarFrecuencia)((_a = body.frecuencia_pago) !== null && _a !== void 0 ? _a : antes.frecuencia_pago);
                    semana = (0, planilla_periodos_1.normalizarInicioSemana)((_b = body.semana_empieza) !== null && _b !== void 0 ? _b : antes.semana_empieza);
                    flag = function (campo) {
                        return body[campo] === undefined ? antes[campo] : !!body[campo];
                    };
                    nuevo = {
                        frecuencia_pago: frecuencia,
                        semana_empieza: semana,
                        usa_pensiones: flag('usa_pensiones'),
                        usa_essalud: flag('usa_essalud'),
                        usa_cts: flag('usa_cts'),
                        usa_gratificacion: flag('usa_gratificacion'),
                        usa_renta_quinta: flag('usa_renta_quinta'),
                        usa_formato_legal: flag('usa_formato_legal')
                    };
                    return [4 /*yield*/, prisma.org.update({ where: { idorg: ctx.idorg }, data: nuevo })];
                case 2:
                    _d.sent();
                    encendidos = function (c) {
                        return exports.INTERRUPTORES.filter(function (i) { return c[i.campo]; }).map(function (i) { return i.clave; }).join(', ') || 'ninguno';
                    };
                    frase = function (c) {
                        return "pago ".concat(c.frecuencia_pago.toLowerCase()) +
                            (c.frecuencia_pago === 'SEMANAL' ? " (empieza dia ".concat(c.semana_empieza, ")") : '') +
                            "; formalidad: ".concat(encendidos(c));
                    };
                    if (!(frase(antes) !== frase(nuevo))) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 3:
                    sede = _d.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg, idsede_restobar: (_c = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _c !== void 0 ? _c : 0,
                            entidad: 'PLANILLA', accion: 'MODIFICA',
                            detalle: 'Planilla: ' + frase(antes) + ' -> ' + frase(nuevo),
                            anterior: antes,
                            nuevo: nuevo
                        }, autor)];
                case 4:
                    _d.sent();
                    _d.label = 5;
                case 5: return [2 /*return*/, leerConfig(ctx)];
            }
        });
    });
}
exports.guardarConfig = guardarConfig;
/**
 * El periodo sobre el que hay que calcular.
 *
 * Acepta tres formas, en este orden:
 *   - `periodo` con la clave completa ('2026-03-09'): el periodo que abre ahi
 *   - `periodo` con solo el mes ('2026-03'): el mes entero, como siempre
 *   - `desde`/`hasta`: un rango libre, para mirar algo puntual
 *
 * Se resuelve contra la frecuencia de LA EMPRESA, no contra la que mande el
 * cliente: si alguien pide una semana en una empresa que paga por mes, la
 * boleta saldria cortada por un rango que la planilla despues no reconoce.
 */
function resolverPeriodoDeOrg(ctx, body) {
    return __awaiter(this, void 0, void 0, function () {
        var org, cfg, pedido, p, desde, hasta;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 1:
                    org = _a.sent();
                    cfg = configDe(org);
                    pedido = String((body === null || body === void 0 ? void 0 : body.periodo) || '');
                    if (/^\d{4}-\d{2}-\d{2}$/.test(pedido)) {
                        p = (0, planilla_periodos_1.periodoPorClave)(pedido, cfg.frecuencia_pago, cfg.semana_empieza);
                        if (!p) {
                            throw new asistencia_config_1.Invalido("El ".concat(pedido, " no es el primer dia de un periodo de pago ").concat(cfg.frecuencia_pago.toLowerCase(), "."));
                        }
                        return [2 /*return*/, p];
                    }
                    if (/^\d{4}-\d{2}$/.test(pedido)) {
                        return [2 /*return*/, (0, planilla_periodos_1.periodoDe)(pedido + '-01', 'MENSUAL', cfg.semana_empieza)];
                    }
                    // Basura NO cae en el periodo en curso. Calcular en silencio un rango
                    // distinto al pedido es la forma mas cara de equivocarse: la boleta sale,
                    // se paga, y nadie mira de que periodo era.
                    if (pedido) {
                        throw new asistencia_config_1.Invalido("\"".concat(pedido, "\" no es un periodo valido. Manda la fecha en que empieza (YYYY-MM-DD) o el mes (YYYY-MM)."));
                    }
                    desde = String((body === null || body === void 0 ? void 0 : body.desde) || '');
                    hasta = String((body === null || body === void 0 ? void 0 : body.hasta) || '');
                    if (/^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
                        if (desde > hasta) {
                            throw new asistencia_config_1.Invalido('La fecha inicial es posterior a la final.');
                        }
                        return [2 /*return*/, { clave: desde, desde: desde, hasta: hasta, tipo: cfg.frecuencia_pago, etiqueta: "".concat(desde, " a ").concat(hasta) }];
                    }
                    // Sin nada: el periodo en curso, que es lo que se quiere ver el 99% de las veces
                    return [2 /*return*/, (0, planilla_periodos_1.periodoDe)((0, asistencia_calendario_1.ahoraLima)().slice(0, 10), cfg.frecuencia_pago, cfg.semana_empieza)];
            }
        });
    });
}
exports.resolverPeriodoDeOrg = resolverPeriodoDeOrg;
