"use strict";
// De las marcas a la boleta.
//
// Es el unico lugar donde la asistencia se convierte en plata. Todo lo anterior
// -- horarios, calendario, politica, marcas -- existe para que esto salga bien.
//
// QUE CALCULA
//   + Recargo por dia de descanso trabajado   (D.Leg. 713 art. 3)
//   + Recargo por feriado trabajado           (D.Leg. 713 art. 9)
//   - Descuento por tardanzas                 (proporcional a los minutos)
//   - Descuento por dias no trabajados        (proporcional a los dias)
//
// LO QUE NO HACE, A PROPOSITO
// No multa. El D.S. 004-2006-TR solo permite descontar el tiempo efectivamente
// no trabajado; cobrar "una multa de S/ 20 por llegar tarde" es infraccion, por
// mas que sea lo que muchos locales hacen hoy en papel.
//
// No escribe nada hasta que alguien lo confirma. El calculo se muestra primero
// -- con el detalle de como salio cada importe -- y recien despues se aplica.
// Un numero que aparece solo en la boleta y nadie puede explicar es un reclamo
// asegurado.
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
exports.aplicar = exports.calcular = exports.tarifaDe = exports.CODIGOS = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_config_1 = require("./asistencia.config");
var asistencia_bitacora_1 = require("./asistencia.bitacora");
var planilla_config_1 = require("./planilla.config");
var prisma = new client_1.PrismaClient();
/** Los cuatro conceptos, por su codigo estable (migracion 055). */
exports.CODIGOS = {
    RECARGO_DESCANSO: 'ASIS_RECARGO_DESCANSO',
    RECARGO_FERIADO: 'ASIS_RECARGO_FERIADO',
    DESC_TARDANZA: 'ASIS_DESC_TARDANZA',
    DESC_FALTAS: 'ASIS_DESC_FALTAS'
};
/**
 * Dias que se le paga a un mes.
 *
 * Son 30 SIEMPRE, tenga el mes 28 o 31. Es la convencion legal peruana para el
 * valor del dia, y usar los dias reales haria que el mismo sueldo valiera
 * distinto por dia en febrero que en marzo.
 */
var DIAS_MES = 30;
/** Tope de dias por calculo. Un periodo de planilla nunca pasa de un mes largo. */
var RANGO_MAX_DIAS = 45;
var dosDec = function (n) { return Math.round(n * 100) / 100; };
// ---------------------------------------------------------------------------
// El periodo
// ---------------------------------------------------------------------------
/**
 * La clave con la que el concepto entra a la boleta: el primer dia del periodo.
 *
 * Antes era siempre el primero del mes. Con pago semanal eso juntaria las
 * cuatro semanas de marzo en una sola boleta, asi que ahora es el primer dia
 * del periodo real -- que para el pago mensual sigue siendo el dia 1.
 */
var periodoBoleta = function (p) { return p.clave; };
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
// ---------------------------------------------------------------------------
// El sueldo
// ---------------------------------------------------------------------------
/**
 * El sueldo NO esta en `colaborador`: vive en el detalle del contrato activo,
 * junto con la unidad (mensual, quincenal, semanal) y las horas de jornada.
 * Sin contrato activo no hay con que calcular, y eso se informa en vez de
 * asumir un sueldo.
 */
function contratoDe(idcolaborador) {
    return __awaiter(this, void 0, void 0, function () {
        var filas;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.$queryRawUnsafe("SELECT ccd.importe, ccd.unidad_remuneracion, ccd.horas\n           FROM colaborador_contrato cc\n           INNER JOIN colaborador_contrato_detalle ccd\n                   ON ccd.idcolaborador_contrato = cc.idcolaborador_contrato\n          WHERE cc.idcolaborador = ? AND cc.estado = '0' AND cc.activo = '1'\n          ORDER BY ccd.idcolaborador_contrato_detalle DESC\n          LIMIT 1", idcolaborador)];
                case 1:
                    filas = _a.sent();
                    return [2 /*return*/, filas.length ? filas[0] : null];
            }
        });
    });
}
/**
 * Cuanto vale un dia y un minuto de esta persona.
 *
 * El valor del minuto sale de SU jornada, no de las 8 horas de oficina: para
 * quien trabaja 6 horas, un minuto de tardanza pesa mas que para quien trabaja
 * 10. Descontar todos por el mismo divisor le cobraria de menos a unos y de
 * mas a otros.
 */
function tarifaDe(contrato) {
    var importe = Number(String((contrato === null || contrato === void 0 ? void 0 : contrato.importe) || '').replace(/,/g, ''));
    if (!Number.isFinite(importe) || importe <= 0) {
        return null;
    }
    var unidad = String((contrato === null || contrato === void 0 ? void 0 : contrato.unidad_remuneracion) || 'MENSUAL').toUpperCase();
    var divisor = unidad === 'DIARIO' ? 1
        : unidad === 'SEMANAL' ? 7
            : unidad === 'QUINCENAL' ? 15
                : DIAS_MES;
    var horas = Number(contrato === null || contrato === void 0 ? void 0 : contrato.horas);
    // 8 h es el tope legal de la jornada y el default razonable cuando el
    // contrato no lo dice. Un 0 aqui dividiria por cero.
    var horas_dia = Number.isFinite(horas) && horas > 0 && horas <= 24 ? horas : 8;
    var valor_dia = importe / divisor;
    return {
        valor_dia: dosDec(valor_dia),
        valor_minuto: valor_dia / (horas_dia * 60),
        unidad: unidad,
        horas_dia: horas_dia
    };
}
exports.tarifaDe = tarifaDe;
/** Los cuatro conceptos con el id que tienen en ESTA base. */
function catalogo() {
    return __awaiter(this, void 0, void 0, function () {
        var filas, porCodigo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.variables.findMany({
                        where: { codigo: { "in": Object.values(exports.CODIGOS) } }
                    })];
                case 1:
                    filas = _a.sent();
                    porCodigo = new Map(filas.map(function (f) { return [f.codigo, f]; }));
                    if (porCodigo.size < 4) {
                        throw new asistencia_config_1.Invalido('Faltan los conceptos de asistencia en la tabla de variables. Revisa la migracion 055.', 500);
                    }
                    return [2 /*return*/, porCodigo];
            }
        });
    });
}
/**
 * Calcula, sin escribir nada.
 *
 * Recorre dia por dia porque cada dia puede ser distinto por cinco motivos
 * (horario, cierre, feriado, excepcion de sede, excepcion propia) y solo
 * `resolverDia` sabe combinarlos. Es el mismo motor que usa el marcador, asi
 * que la boleta no puede discrepar de lo que la pantalla le dijo al trabajador.
 */
function calcular(ctx, body) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var periodo, dias, conceptos, c, org, corteRaw, corte, hoyOperativo, personal, marcas, idx, _i, marcas_1, m, dia, k, filas, _loop_1, _b, _c, p;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, (0, planilla_config_1.resolverPeriodoDeOrg)(ctx, body)];
                case 1:
                    periodo = _d.sent();
                    dias = diasEntre(periodo.desde, periodo.hasta);
                    if (dias.length > RANGO_MAX_DIAS) {
                        throw new asistencia_config_1.Invalido("El periodo no puede pasar de ".concat(RANGO_MAX_DIAS, " dias."));
                    }
                    return [4 /*yield*/, catalogo()];
                case 2:
                    conceptos = _d.sent();
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(ctx.idorg, ctx.idsede, periodo.desde, periodo.hasta)];
                case 3:
                    c = _d.sent();
                    return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 4:
                    org = _d.sent();
                    corteRaw = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                    corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
                    hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            orderBy: { nombres: 'asc' }
                        })];
                case 5:
                    personal = _d.sent();
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: {
                                idorg: ctx.idorg,
                                fecha_local: {
                                    gte: (0, asistencia_calendario_1.fechaSql)(periodo.desde + ' 00:00:00'),
                                    lte: (0, asistencia_calendario_1.fechaSql)(periodo.hasta + ' 00:00:00')
                                }
                            }
                        })];
                case 6:
                    marcas = _d.sent();
                    idx = new Map();
                    for (_i = 0, marcas_1 = marcas; _i < marcas_1.length; _i++) {
                        m = marcas_1[_i];
                        dia = (0, asistencia_calendario_1.aTextoLima)(m.fecha_local).slice(0, 10);
                        k = "".concat(m.idcolaborador, "|").concat(dia);
                        if (!idx.has(k)) {
                            idx.set(k, {});
                        }
                        idx.get(k)[m.tipo] = m;
                    }
                    filas = [];
                    _loop_1 = function (p) {
                        var contrato, tarifa, faltas, tardanzaMin, trabajados, pagadosSinTrabajar, sinGoce, descansos, feriados, _e, dias_1, fecha, dl, par, entrada, cerrado, lineas, recDescanso, recFeriado, descTardanza, noPagados, descFaltas, partes;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0: return [4 /*yield*/, contratoDe(p.idcolaborador)];
                                case 1:
                                    contrato = _f.sent();
                                    tarifa = tarifaDe(contrato);
                                    faltas = 0, tardanzaMin = 0, trabajados = 0;
                                    pagadosSinTrabajar = 0, sinGoce = 0;
                                    descansos = [];
                                    feriados = [];
                                    for (_e = 0, dias_1 = dias; _e < dias_1.length; _e++) {
                                        fecha = dias_1[_e];
                                        dl = (0, asistencia_dialaboral_1.resolverDia)({
                                            fecha: fecha,
                                            horario_semanal: p.horario_semanal,
                                            tolerancia_min: (_a = p.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                                            excepciones: c.porPersona(p.idcolaborador),
                                            feriados: c.feriados,
                                            dias_cierre: c.dias_cierre,
                                            politica: c.politica
                                        });
                                        par = idx.get("".concat(p.idcolaborador, "|").concat(fecha)) || {};
                                        entrada = par.ENTRADA || null;
                                        cerrado = fecha < hoyOperativo;
                                        if (entrada) {
                                            trabajados++;
                                            if ((entrada.tardanza_min || 0) > 0) {
                                                tardanzaMin += entrada.tardanza_min;
                                            }
                                            // El recargo se paga por trabajar, no por estar programado: se
                                            // cuenta con la marca en la mano, no con la excepcion cargada.
                                            if (dl.es_descanso_trabajado && dl.compensacion === 'RECARGO') {
                                                descansos.push(fecha);
                                            }
                                            if (dl.recargo_feriado_pct) {
                                                feriados.push({ fecha: fecha, pct: dl.recargo_feriado_pct });
                                            }
                                        }
                                        else if (dl.labora && cerrado) {
                                            faltas++;
                                        }
                                        else if (!dl.labora && cerrado && dl.categoria !== 'NORMAL') {
                                            // Una ausencia justificada. Que se descuente o no depende de la
                                            // categoria, no de si vino: unas vacaciones se pagan y un
                                            // permiso sin goce no, y las dos son "no vino".
                                            if (asistencia_dialaboral_1.CATEGORIAS_PAGADAS.includes(dl.categoria)) {
                                                pagadosSinTrabajar++;
                                            }
                                            else {
                                                sinGoce++;
                                            }
                                        }
                                    }
                                    lineas = [];
                                    if (tarifa) {
                                        recDescanso = descansos.reduce(function (a, f) {
                                            var _a;
                                            var e = c.excepciones.find(function (x) { return x.idcolaborador === p.idcolaborador && x.fecha === f; });
                                            return a + tarifa.valor_dia * (((_a = e === null || e === void 0 ? void 0 : e.recargo_pct) !== null && _a !== void 0 ? _a : 100) / 100);
                                        }, 0);
                                        if (recDescanso > 0) {
                                            lineas.push(linea(conceptos, exports.CODIGOS.RECARGO_DESCANSO, recDescanso, "".concat(descansos.length, " dia(s) de descanso trabajados: ").concat(descansos.join(', '))));
                                        }
                                        recFeriado = feriados.reduce(function (a, f) { return a + tarifa.valor_dia * (f.pct / 100); }, 0);
                                        if (recFeriado > 0) {
                                            lineas.push(linea(conceptos, exports.CODIGOS.RECARGO_FERIADO, recFeriado, "".concat(feriados.length, " feriado(s) trabajados: ").concat(feriados.map(function (f) { return f.fecha; }).join(', '))));
                                        }
                                        descTardanza = tardanzaMin * tarifa.valor_minuto;
                                        if (descTardanza > 0) {
                                            lineas.push(linea(conceptos, exports.CODIGOS.DESC_TARDANZA, descTardanza, "".concat(tardanzaMin, " min de tardanza a ").concat(dosDec(tarifa.valor_minuto * 60), " por hora")));
                                        }
                                        noPagados = faltas + sinGoce;
                                        descFaltas = noPagados * tarifa.valor_dia;
                                        if (descFaltas > 0) {
                                            partes = [];
                                            if (faltas) {
                                                partes.push("".concat(faltas, " falta(s)"));
                                            }
                                            if (sinGoce) {
                                                partes.push("".concat(sinGoce, " dia(s) de permiso sin goce"));
                                            }
                                            lineas.push(linea(conceptos, exports.CODIGOS.DESC_FALTAS, descFaltas, "".concat(partes.join(' y '), " a ").concat(tarifa.valor_dia, " por dia")));
                                        }
                                    }
                                    filas.push({
                                        idcolaborador: p.idcolaborador,
                                        nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                                        dni: p.dni,
                                        // Se informa en vez de asumir un sueldo: inventarlo saldria en la
                                        // boleta como un numero que nadie puede justificar.
                                        sin_contrato: !tarifa,
                                        sueldo: tarifa ? Number(String(contrato.importe).replace(/,/g, '')) : null,
                                        unidad: tarifa ? tarifa.unidad : null,
                                        valor_dia: tarifa ? tarifa.valor_dia : null,
                                        dias_trabajados: trabajados,
                                        faltas: faltas,
                                        dias_pagados_sin_trabajar: pagadosSinTrabajar,
                                        dias_sin_goce: sinGoce,
                                        tardanza_min: tardanzaMin,
                                        descansos_trabajados: descansos.length,
                                        feriados_trabajados: feriados.length,
                                        conceptos: lineas,
                                        total_ingresos: dosDec(lineas.filter(function (l) { return l.tipo === 'INGRESO'; }).reduce(function (a, l) { return a + l.importe; }, 0)),
                                        total_descuentos: dosDec(lineas.filter(function (l) { return l.tipo === 'DESCUENTO'; }).reduce(function (a, l) { return a + l.importe; }, 0))
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, _c = personal;
                    _d.label = 7;
                case 7:
                    if (!(_b < _c.length)) return [3 /*break*/, 10];
                    p = _c[_b];
                    return [5 /*yield**/, _loop_1(p)];
                case 8:
                    _d.sent();
                    _d.label = 9;
                case 9:
                    _b++;
                    return [3 /*break*/, 7];
                case 10: return [2 /*return*/, {
                        periodo: periodo.etiqueta,
                        clave: periodo.clave,
                        tipo: periodo.tipo,
                        desde: periodo.desde,
                        hasta: periodo.hasta,
                        hoy: hoyOperativo,
                        // El periodo se puede calcular antes de que termine, para ir viendo
                        // como viene; se avisa porque los numeros todavia pueden cambiar.
                        en_curso: periodo.hasta >= hoyOperativo,
                        filas: filas,
                        totales: {
                            personal: filas.length,
                            sin_contrato: filas.filter(function (f) { return f.sin_contrato; }).length,
                            ingresos: dosDec(filas.reduce(function (a, f) { return a + f.total_ingresos; }, 0)),
                            descuentos: dosDec(filas.reduce(function (a, f) { return a + f.total_descuentos; }, 0)),
                            dias_pagados_sin_trabajar: filas.reduce(function (a, f) { return a + f.dias_pagados_sin_trabajar; }, 0)
                        }
                    }];
            }
        });
    });
}
exports.calcular = calcular;
function linea(conceptos, codigo, importe, detalle) {
    var v = conceptos.get(codigo);
    return {
        codigo: codigo,
        idvariables: v.idvariables,
        descripcion: v.descripcion,
        tipo: v.idtipo_variable === 1 ? 'INGRESO' : 'DESCUENTO',
        importe: dosDec(importe),
        detalle: detalle
    };
}
// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------
/**
 * Escribe los conceptos en la boleta del periodo.
 *
 * Es RE-EJECUTABLE: primero borra lo que este calculo puso antes para ese
 * periodo y despues inserta. Sin eso, recalcular despues de corregir una marca
 * dejaria el importe viejo y el nuevo sumados, y nadie lo notaria hasta el
 * momento de pagar.
 *
 * Solo toca sus propias lineas -- las de los cuatro codigos ASIS_* -- asi que
 * un adelanto o un bono cargado a mano en el mismo periodo queda intacto.
 */
function aplicar(ctx, body, autor) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var calculo, conceptos, ids, periodo, deLaSede, borradas, ahora, nuevas, _i, _b, f, _c, _d, l, sede;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, calcular(ctx, body)];
                case 1:
                    calculo = _e.sent();
                    return [4 /*yield*/, catalogo()];
                case 2:
                    conceptos = _e.sent();
                    ids = Array.from(conceptos.values()).map(function (v) { return v.idvariables; });
                    periodo = calculo.clave;
                    deLaSede = calculo.filas.map(function (f) { return f.idcolaborador; });
                    if (!deLaSede.length) {
                        return [2 /*return*/, __assign(__assign({}, calculo), { aplicados: 0 })];
                    }
                    return [4 /*yield*/, prisma.colaborador_boleta.deleteMany({
                            where: {
                                idorg: ctx.idorg,
                                idcolaborador: { "in": deLaSede },
                                idvariables: { "in": ids },
                                periodo: periodo
                            }
                        })];
                case 3:
                    borradas = _e.sent();
                    ahora = (0, asistencia_calendario_1.ahoraLima)();
                    nuevas = [];
                    for (_i = 0, _b = calculo.filas; _i < _b.length; _i++) {
                        f = _b[_i];
                        for (_c = 0, _d = f.conceptos; _c < _d.length; _c++) {
                            l = _d[_c];
                            nuevas.push({
                                idcolaborador: f.idcolaborador,
                                idorg: ctx.idorg,
                                idvariables: l.idvariables,
                                f_add: ahora.slice(0, 10),
                                estado: '0',
                                importe: String(l.importe),
                                // permanente '0': vale solo para este periodo. Un recargo del
                                // mes pasado no se vuelve a pagar el mes que viene.
                                permanente: '0',
                                periodo: periodo,
                                fecha_registro: ahora,
                                observaciones: l.detalle.slice(0, 100)
                            });
                        }
                    }
                    if (!nuevas.length) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.colaborador_boleta.createMany({ data: nuevas })];
                case 4:
                    _e.sent();
                    _e.label = 5;
                case 5: return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 6:
                    sede = _e.sent();
                    return [4 /*yield*/, (0, asistencia_bitacora_1.anotar)({
                            idorg: ctx.idorg,
                            idsede_restobar: (_a = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _a !== void 0 ? _a : 0,
                            entidad: 'PLANILLA', accion: 'MODIFICA',
                            detalle: "Conceptos de asistencia del periodo ".concat(calculo.periodo, " (").concat(calculo.clave, "): ") +
                                "".concat(nuevas.length, " linea(s) en ").concat(calculo.filas.filter(function (f) { return f.conceptos.length; }).length, " boleta(s), ") +
                                "+".concat(calculo.totales.ingresos, " / -").concat(calculo.totales.descuentos),
                            anterior: { lineas_previas: borradas.count },
                            nuevo: { lineas: nuevas.length, ingresos: calculo.totales.ingresos, descuentos: calculo.totales.descuentos }
                        }, autor)];
                case 7:
                    _e.sent();
                    return [2 /*return*/, __assign(__assign({}, calculo), { aplicados: nuevas.length, reemplazados: borradas.count })];
            }
        });
    });
}
exports.aplicar = aplicar;
