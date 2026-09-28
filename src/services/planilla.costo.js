"use strict";
// Cuanto cuesta el personal en un periodo.
//
// QUE SE ENTIENDE POR COSTO
// Lo que le sale al negocio, no lo que recibe el trabajador. Son cosas
// distintas: el aporte a EsSalud lo paga el empleador y NO se le descuenta a
// nadie, pero es plata que sale igual. Mostrar el neto de las boletas como
// "costo de personal" dejaria ese 9% afuera.
//
//   costo = sueldo del periodo
//         + recargos (descanso y feriado trabajados, horas extra)
//         - descuentos (tardanzas, faltas, permisos sin goce)
//         + aportes del empleador (EsSalud, si la empresa lo usa)
//
// POR QUE SE APOYA EN `calcular` Y NO HACE SUS PROPIAS CUENTAS
// Si el costo se calculara aparte, tarde o temprano diria un numero distinto
// al de la boleta, y no habria forma de saber cual esta bien. Reusando el
// mismo motor, el costo es la suma de lo que cada uno va a cobrar: si no
// coinciden es porque hay un error, no porque sean dos criterios.
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
exports.costoDeSedes = exports.costoDePersonal = exports.PCT_ESSALUD = void 0;
var asistencia_planilla_1 = require("./asistencia.planilla");
var planilla_config_1 = require("./planilla.config");
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var dosDec = function (n) { return Math.round(n * 100) / 100; };
/**
 * Dias que se pagan en un periodo, segun la convencion peruana.
 *
 * Un mes son 30 dias SIEMPRE, tenga 28 o 31: es la misma convencion con la que
 * `tarifaDe` saca el valor del dia. Usar los dias reales del calendario haria
 * que el mismo sueldo costara distinto en febrero que en marzo.
 */
var DIAS_PAGABLES = {
    DIARIO: 1, SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30
};
/** El aporte del empleador a EsSalud: 9% de la remuneracion. */
exports.PCT_ESSALUD = 9;
/**
 * El costo del personal de un periodo, por persona y en total.
 *
 * `body` es el mismo que toma la planilla: `{ periodo: '2026-03' }` o una
 * fecha de inicio de periodo.
 */
function costoDePersonal(ctx, body) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var pl, cfg, _b, dias, pctAportes, areas, colaboradores, areaDe, listaAreas, personas, suma, porArea, _i, personas_1, p, k, a;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, asistencia_planilla_1.calcular)(ctx, body)];
                case 1:
                    pl = _c.sent();
                    _b = planilla_config_1.configDe;
                    return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 2:
                    cfg = _b.apply(void 0, [_c.sent()]);
                    dias = (_a = DIAS_PAGABLES[pl.tipo]) !== null && _a !== void 0 ? _a : 30;
                    pctAportes = cfg.usa_essalud ? exports.PCT_ESSALUD : 0;
                    areas = new Map();
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            select: { idcolaborador: true, idarea: true }
                        })];
                case 3:
                    colaboradores = _c.sent();
                    areaDe = new Map(colaboradores.map(function (c) { return [c.idcolaborador, c.idarea || 0]; }));
                    return [4 /*yield*/, prisma.area.findMany({
                            where: { estado: '0', OR: [{ idsede: 0 }, { idsede: ctx.idsede }] },
                            select: { idarea: true, descripcion: true }
                        })];
                case 4:
                    listaAreas = _c.sent();
                    listaAreas.forEach(function (a) { return areas.set(a.idarea, a.descripcion); });
                    personas = pl.filas.map(function (f) {
                        // Sin contrato no hay sueldo que sumar. Se lista igual, en cero y
                        // marcado: un costo que le falta gente es peor que uno incompleto que
                        // lo dice.
                        var sueldo = f.valor_dia ? dosDec(f.valor_dia * dias) : 0;
                        var remuneracion = dosDec(sueldo + f.total_ingresos - f.total_descuentos);
                        var aportes = dosDec(remuneracion * pctAportes / 100);
                        var idarea = areaDe.get(f.idcolaborador) || 0;
                        // Los importes salen de las lineas que ya armo la planilla, buscadas
                        // por su codigo estable. Recalcularlos aqui seria pedirle al costo que
                        // se ponga de acuerdo con la boleta, y eso es justo lo que se evita.
                        var linea = function (codigo) { var _a; return ((_a = f.conceptos.find(function (c) { return c.codigo === codigo; })) === null || _a === void 0 ? void 0 : _a.importe) || 0; };
                        return {
                            idcolaborador: f.idcolaborador,
                            nombres: f.nombres,
                            area: areas.get(idarea) || '',
                            sin_contrato: f.sin_contrato,
                            sueldo_periodo: sueldo,
                            recargos: f.total_ingresos,
                            descuentos: f.total_descuentos,
                            remuneracion: remuneracion,
                            aportes: aportes,
                            costo: dosDec(remuneracion + aportes),
                            sobretiempo_min: f.sobretiempo_min || 0,
                            sobretiempo_importe: f.sobretiempo_importe || 0,
                            tardanza_min: f.tardanza_min || 0,
                            tardanza_importe: linea(asistencia_planilla_1.CODIGOS.DESC_TARDANZA),
                            faltas: f.faltas || 0,
                            faltas_importe: linea(asistencia_planilla_1.CODIGOS.DESC_FALTAS)
                        };
                    });
                    suma = function (f) { return dosDec(personas.reduce(function (a, p) { return a + f(p); }, 0)); };
                    porArea = new Map();
                    for (_i = 0, personas_1 = personas; _i < personas_1.length; _i++) {
                        p = personas_1[_i];
                        k = p.area || 'Sin area';
                        a = porArea.get(k) || { area: k, personas: 0, costo: 0 };
                        a.personas++;
                        a.costo = dosDec(a.costo + p.costo);
                        porArea.set(k, a);
                    }
                    return [2 /*return*/, {
                            periodo: pl.periodo,
                            clave: pl.clave,
                            tipo: pl.tipo,
                            desde: pl.desde,
                            hasta: pl.hasta,
                            en_curso: pl.en_curso,
                            /** Con el periodo sin cerrar los numeros todavia se mueven. */
                            pct_aportes: pctAportes,
                            personas: personas,
                            por_area: Array.from(porArea.values()).sort(function (a, b) { return b.costo - a.costo; }),
                            totales: {
                                personal: personas.length,
                                sin_contrato: personas.filter(function (p) { return p.sin_contrato; }).length,
                                sueldos: suma(function (p) { return p.sueldo_periodo; }),
                                recargos: suma(function (p) { return p.recargos; }),
                                descuentos: suma(function (p) { return p.descuentos; }),
                                remuneraciones: suma(function (p) { return p.remuneracion; }),
                                aportes: suma(function (p) { return p.aportes; }),
                                costo: suma(function (p) { return p.costo; }),
                                sobretiempo_min: personas.reduce(function (a, p) { return a + p.sobretiempo_min; }, 0),
                                sobretiempo_importe: suma(function (p) { return p.sobretiempo_importe; }),
                                tardanza_min: personas.reduce(function (a, p) { return a + p.tardanza_min; }, 0),
                                tardanza_importe: suma(function (p) { return p.tardanza_importe; }),
                                faltas: personas.reduce(function (a, p) { return a + p.faltas; }, 0),
                                faltas_importe: suma(function (p) { return p.faltas_importe; })
                            }
                        }];
            }
        });
    });
}
exports.costoDePersonal = costoDePersonal;
/**
 * El costo de VARIAS sedes de la misma empresa, para compararlas.
 *
 * Se recorren del lado del servidor y no desde la pantalla: cada sede es un
 * calculo de planilla entero, y hacerlo con una llamada por sede convertiria
 * una comparacion de cinco locales en cinco viajes de ida y vuelta.
 *
 * Solo devuelve el resumen de cada una. El detalle persona por persona se pide
 * aparte, cuando alguien entra a mirar un local en particular.
 */
function costoDeSedes(idorg, sedes, body) {
    return __awaiter(this, void 0, void 0, function () {
        var filas, _loop_1, _i, sedes_1, s;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    filas = [];
                    _loop_1 = function (s) {
                        var c, e_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, costoDePersonal({ idorg: idorg, idsede: s.idsede }, body)];
                                case 1:
                                    c = _b.sent();
                                    filas.push({
                                        idsede: s.idsede,
                                        idsede_restobar: s.idsede_restobar,
                                        nombre: s.nombre,
                                        periodo: c.periodo,
                                        personal: c.totales.personal,
                                        sin_contrato: c.totales.sin_contrato,
                                        costo: c.totales.costo,
                                        sueldos: c.totales.sueldos,
                                        recargos: c.totales.recargos,
                                        descuentos: c.totales.descuentos,
                                        aportes: c.totales.aportes,
                                        sobretiempo_min: c.totales.sobretiempo_min,
                                        sobretiempo_importe: c.totales.sobretiempo_importe,
                                        tardanza_min: c.totales.tardanza_min,
                                        faltas: c.totales.faltas,
                                        // El detalle va tambien: sin esto no se puede responder "en que
                                        // area se va la plata de toda la cadena" ni "quien es el que
                                        // mas cuesta, este donde este". Ya estaba calculado.
                                        por_area: c.por_area,
                                        personas: c.personas.map(function (p) { return (__assign(__assign({}, p), { sede: s.nombre })); })
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    e_1 = _b.sent();
                                    // Una sede que falla no puede dejar sin comparacion a las otras:
                                    // se lista con el problema anotado y las demas siguen.
                                    console.error('[costo] no se pudo calcular la sede', s.idsede, e_1 === null || e_1 === void 0 ? void 0 : e_1.message);
                                    filas.push({
                                        idsede: s.idsede,
                                        idsede_restobar: s.idsede_restobar,
                                        nombre: s.nombre,
                                        error: String((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || 'no se pudo calcular')
                                    });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, sedes_1 = sedes;
                    _a.label = 1;
                case 1:
                    if (!(_i < sedes_1.length)) return [3 /*break*/, 4];
                    s = sedes_1[_i];
                    return [5 /*yield**/, _loop_1(s)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, { sedes: filas }];
            }
        });
    });
}
exports.costoDeSedes = costoDeSedes;
