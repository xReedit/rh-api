"use strict";
// Los reportes de asistencia.
//
// POR QUE ESTAN AQUI Y NO EN EL CONTROLADOR
// El reporte de rango calculaba las faltas con `horaEsperada` a secas: miraba
// el horario semanal y nada mas. No sabia de feriados, ni de dias que el local
// cierra, ni de vacaciones. La planilla si, porque usa `resolverDia`.
//
// Resultado: el reporte decia 17 faltas y la boleta descontaba 12. Dos numeros
// distintos para la misma pregunta, y quien atiende el reclamo tiene que
// explicar cual de los dos miente. Ahora los dos salen del mismo motor.
//
// Aqui viven dos reportes con publicos distintos:
//   - `reporteRango`: para el que administra. Cuanto trabajo cada uno y que
//     hay que pagarle o descontarle.
//   - `registroJornada`: el que exige el D.S. 004-2006-TR. Dia por dia, con el
//     RUC del empleador y el DNI del trabajador. Es el que se muestra en una
//     fiscalizacion, y por eso no resume nada.
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
exports.registroJornada = exports.reporteRango = void 0;
var client_1 = require("@prisma/client");
var asistencia_sobretiempo_1 = require("./asistencia.sobretiempo");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_config_1 = require("./asistencia.config");
var planilla_config_1 = require("./planilla.config");
var prisma = new client_1.PrismaClient();
/**
 * Tope de dias por consulta.
 *
 * Medio ano alcanza para cualquier periodo de planilla. Un rango abierto
 * barreria anos de marcas y la consulta se caeria sola.
 */
var RANGO_MAX_DIAS = 186;
var dosDec = function (n) { return Math.round(n * 100) / 100; };
var soloHora = function (d) { return (d ? new Date(d).toISOString().slice(11, 16) : null); };
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
function validarRango(desde, hasta) {
    if (!asistencia_config_1.ES_FECHA.test(desde) || !asistencia_config_1.ES_FECHA.test(hasta)) {
        throw new asistencia_config_1.Invalido('Las fechas deben ser YYYY-MM-DD.');
    }
    if (desde > hasta) {
        throw new asistencia_config_1.Invalido('La fecha inicial es posterior a la final.');
    }
    var dias = diasEntre(desde, hasta);
    if (dias.length > RANGO_MAX_DIAS) {
        throw new asistencia_config_1.Invalido("El rango no puede pasar de ".concat(RANGO_MAX_DIAS, " dias."));
    }
    return dias;
}
/**
 * Todo lo que los dos reportes necesitan leer: el contexto laboral, el personal,
 * las marcas indexadas y hasta donde se puede hablar de faltas.
 */
function base(ctx, desde, hasta) {
    return __awaiter(this, void 0, void 0, function () {
        var org, corteRaw, corte, hoyOperativo, personal, marcas, idx, areas, nombreArea, c;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 1:
                    org = _a.sent();
                    corteRaw = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                    corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
                    hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                    return [4 /*yield*/, prisma.colaborador.findMany({
                            where: { idorg: ctx.idorg, idsede: ctx.idsede, estado: 0 },
                            orderBy: { nombres: 'asc' }
                        })];
                case 2:
                    personal = _a.sent();
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: {
                                idorg: ctx.idorg,
                                fecha_local: { gte: (0, asistencia_calendario_1.fechaSql)(desde + ' 00:00:00'), lte: (0, asistencia_calendario_1.fechaSql)(hasta + ' 00:00:00') }
                            },
                            orderBy: { marcada_at: 'asc' }
                        })];
                case 3:
                    marcas = _a.sent();
                    idx = (0, asistencia_calendario_1.indexarMarcas)(marcas, function (m) { return (0, asistencia_calendario_1.aTextoLima)(m.fecha_local).slice(0, 10); });
                    return [4 /*yield*/, prisma.area.findMany({
                            where: { estado: '0', OR: [{ idsede: 0 }, { idsede: ctx.idsede }] },
                            select: { idarea: true, descripcion: true }
                        })];
                case 4:
                    areas = _a.sent();
                    nombreArea = new Map(areas.map(function (a) { return [a.idarea, a.descripcion]; }));
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(ctx.idorg, ctx.idsede, desde, hasta)];
                case 5:
                    c = _a.sent();
                    return [2 /*return*/, {
                            org: org,
                            corte: corte,
                            hoyOperativo: hoyOperativo,
                            personal: personal,
                            idx: idx,
                            nombreArea: nombreArea,
                            ctxLab: c,
                            // El margen configurado para el sobretiempo. El reporte lo respeta para
                            // no mostrar como horas extra lo que la planilla no va a pagar: dos
                            // numeros distintos para la misma cosa es peor que no mostrarla.
                            umbralSobretiempo: (0, planilla_config_1.normalizarUmbral)(org === null || org === void 0 ? void 0 : org.sobretiempo_min_umbral)
                        }];
            }
        });
    });
}
/** Resuelve un dia para una persona, con el mismo motor que usa la planilla. */
var resolver = function (c, p, fecha) {
    var _a;
    return (0, asistencia_dialaboral_1.resolverDia)({
        fecha: fecha,
        horario_semanal: p.horario_semanal,
        tolerancia_min: (_a = p.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
        excepciones: c.porPersona(p.idcolaborador),
        feriados: c.feriados,
        dias_cierre: c.dias_cierre,
        politica: c.politica
    });
};
// ---------------------------------------------------------------------------
// Reporte por rango
// ---------------------------------------------------------------------------
/**
 * Resumen por colaborador para un rango de dias.
 *
 * Separa `horas_trabajadas` (turnos cerrados) de `dias_incompletos` (entro y no
 * marco salida). Un dia incompleto NO suma horas: contarlo con una salida
 * inventada seria pagar o descontar sobre un dato que nadie registro.
 */
function reporteRango(ctx, desde, hasta) {
    return __awaiter(this, void 0, void 0, function () {
        var dias, b, filas, suma;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dias = validarRango(desde, hasta);
                    return [4 /*yield*/, base(ctx, desde, hasta)];
                case 1:
                    b = _a.sent();
                    filas = b.personal.map(function (p) {
                        var esperados = 0, asistencias = 0, tardanzas = 0, tardanzaMin = 0;
                        var faltas = 0, horas = 0, incompletos = 0, manuales = 0;
                        var descansosTrabajados = 0, feriadosTrabajados = 0;
                        var pagadosSinTrabajar = 0, sinGoce = 0;
                        var detalle = [];
                        // El sobretiempo va en el reporte SIEMPRE, se pague o no: el
                        // D.S. 004-2006-TR obliga a registrar las horas y minutos de
                        // permanencia fuera de la jornada. Aqui no se valoriza -- eso es de la
                        // planilla -- asi que el valor del minuto va en 0.
                        var extrasDelRango = [];
                        for (var _i = 0, dias_1 = dias; _i < dias_1.length; _i++) {
                            var dia = dias_1[_i];
                            var dl = resolver(b.ctxLab, p, dia);
                            var par = b.idx.get("".concat(p.idcolaborador, "|").concat(dia)) || asistencia_calendario_1.SIN_MARCAS;
                            var entrada = par.ENTRADA || null;
                            var salida = par.SALIDA || null;
                            var cerrado = dia < b.hoyOperativo;
                            if (dl.labora) {
                                esperados++;
                            }
                            if (entrada) {
                                asistencias++;
                                if (par.tardanza_min > 0) {
                                    tardanzas++;
                                    tardanzaMin += par.tardanza_min;
                                }
                                if (entrada.metodo === 'MANUAL') {
                                    manuales++;
                                }
                                // Se cuentan con la marca en la mano, no con la excepcion
                                // cargada: el recargo se paga por trabajar, no por estar previsto.
                                if (dl.es_descanso_trabajado) {
                                    descansosTrabajados++;
                                }
                                if (dl.recargo_feriado_pct) {
                                    feriadosTrabajados++;
                                }
                                if (salida) {
                                    // Se emparejan los tramos en vez de restar la ultima salida
                                    // menos la primera entrada: con break, esa resta contaba
                                    // como trabajadas las horas en que la persona estaba en su
                                    // casa. Un turno corrido da exactamente lo mismo que antes.
                                    horas += (0, asistencia_sobretiempo_1.minutosTrabajados)(par.todas) / 60;
                                    if (salida.metodo === 'MANUAL') {
                                        manuales++;
                                    }
                                    extrasDelRango.push((0, asistencia_sobretiempo_1.sobretiempoDelDia)((0, asistencia_sobretiempo_1.minutosTrabajados)(par.todas), Math.round((0, asistencia_calendario_1.horasJornada)(p.horario_semanal, dia) * 60), b.umbralSobretiempo, 0));
                                }
                                else if (cerrado) {
                                    incompletos++;
                                }
                            }
                            else if (dl.labora && cerrado) {
                                faltas++;
                            }
                            else if (!dl.labora && cerrado && dl.categoria !== 'NORMAL') {
                                // Ausencia justificada: no es falta, y que se pague o no depende
                                // de la categoria, no de si vino.
                                if (asistencia_dialaboral_1.CATEGORIAS_PAGADAS.includes(dl.categoria)) {
                                    pagadosSinTrabajar++;
                                }
                                else {
                                    sinGoce++;
                                }
                            }
                            if (entrada || salida || (!dl.labora && dl.categoria !== 'NORMAL')) {
                                detalle.push({
                                    fecha: dia,
                                    entrada: entrada ? soloHora(entrada.marcada_at) : null,
                                    salida: salida ? soloHora(salida.marcada_at) : null,
                                    tardanza_min: entrada ? entrada.tardanza_min : null,
                                    horas: (entrada && salida)
                                        ? dosDec((0, asistencia_calendario_1.horasTurno)((0, asistencia_calendario_1.aTextoLima)(entrada.marcada_at), (0, asistencia_calendario_1.aTextoLima)(salida.marcada_at)))
                                        : null,
                                    manual: !!((entrada && entrada.metodo === 'MANUAL') || (salida && salida.metodo === 'MANUAL')),
                                    // Por que ese dia es distinto: el que lee el reporte no
                                    // tiene que ir al calendario a averiguarlo.
                                    motivo: dl.labora ? null : (dl.motivo || null),
                                    categoria: dl.categoria !== 'NORMAL' ? dl.categoria : null,
                                    descanso_trabajado: !!(entrada && dl.es_descanso_trabajado),
                                    feriado: dl.feriado
                                });
                            }
                        }
                        return {
                            idcolaborador: p.idcolaborador,
                            nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                            dni: p.dni,
                            area: p.idarea ? (b.nombreArea.get(p.idarea) || '') : '',
                            dias_esperados: esperados,
                            asistencias: asistencias,
                            tardanzas: tardanzas,
                            tardanza_min_total: tardanzaMin,
                            faltas: faltas,
                            dias_incompletos: incompletos,
                            marcas_manuales: manuales,
                            descansos_trabajados: descansosTrabajados,
                            feriados_trabajados: feriadosTrabajados,
                            dias_pagados_sin_trabajar: pagadosSinTrabajar,
                            dias_sin_goce: sinGoce,
                            horas_trabajadas: dosDec(horas),
                            // Se informa siempre, se pague o no: es el registro que pide el
                            // D.S. 004-2006-TR.
                            sobretiempo_min: (0, asistencia_sobretiempo_1.sumarSobretiempo)(extrasDelRango).minutos,
                            detalle: detalle
                        };
                    });
                    suma = function (f) { return filas.reduce(function (a, x) { return a + f(x); }, 0); };
                    return [2 /*return*/, {
                            desde: desde,
                            hasta: hasta,
                            dias: dias.length,
                            hoy: b.hoyOperativo,
                            hora_corte: b.corte,
                            filas: filas,
                            totales: {
                                personal: filas.length,
                                asistencias: suma(function (f) { return f.asistencias; }),
                                tardanzas: suma(function (f) { return f.tardanzas; }),
                                tardanza_min_total: suma(function (f) { return f.tardanza_min_total; }),
                                faltas: suma(function (f) { return f.faltas; }),
                                dias_incompletos: suma(function (f) { return f.dias_incompletos; }),
                                descansos_trabajados: suma(function (f) { return f.descansos_trabajados; }),
                                feriados_trabajados: suma(function (f) { return f.feriados_trabajados; }),
                                dias_pagados_sin_trabajar: suma(function (f) { return f.dias_pagados_sin_trabajar; }),
                                dias_sin_goce: suma(function (f) { return f.dias_sin_goce; }),
                                horas_trabajadas: dosDec(suma(function (f) { return f.horas_trabajadas; })),
                                sobretiempo_min: suma(function (f) { return f.sobretiempo_min; })
                            }
                        }];
            }
        });
    });
}
exports.reporteRango = reporteRango;
// ---------------------------------------------------------------------------
// Registro de jornada (D.S. 004-2006-TR)
// ---------------------------------------------------------------------------
/**
 * El registro que la norma obliga a llevar y a mostrar en una fiscalizacion.
 *
 * El D.S. 004-2006-TR pide, por cada trabajador y cada dia: nombre y DNI, RUC
 * del empleador, hora de entrada y de salida, y las horas trabajadas. Debe
 * conservarse CINCO anos.
 *
 * No resume nada a proposito: una fila por persona y por dia trabajado. El
 * reporte de arriba es para decidir; este es para mostrar, y ahi el resumen
 * juega en contra.
 *
 * Los dias sin marca aparecen igual, diciendo por que: un hueco sin explicacion
 * es lo que un inspector pregunta primero.
 */
function registroJornada(ctx, desde, hasta) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var dias, b, sede, filas, _i, _c, p, _d, dias_2, dia, dl, par, entrada, salida, cerrado;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    dias = validarRango(desde, hasta);
                    return [4 /*yield*/, base(ctx, desde, hasta)];
                case 1:
                    b = _e.sent();
                    return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: ctx.idsede } })];
                case 2:
                    sede = _e.sent();
                    filas = [];
                    for (_i = 0, _c = b.personal; _i < _c.length; _i++) {
                        p = _c[_i];
                        for (_d = 0, dias_2 = dias; _d < dias_2.length; _d++) {
                            dia = dias_2[_d];
                            dl = resolver(b.ctxLab, p, dia);
                            par = b.idx.get("".concat(p.idcolaborador, "|").concat(dia)) || asistencia_calendario_1.SIN_MARCAS;
                            entrada = par.ENTRADA || null;
                            salida = par.SALIDA || null;
                            cerrado = dia < b.hoyOperativo;
                            // Un dia que no le tocaba y en el que no vino no es parte de su
                            // jornada: no va al registro. Lo que si va es todo dia trabajado y
                            // toda ausencia en un dia que si le tocaba.
                            if (!entrada && !dl.labora && dl.categoria === 'NORMAL') {
                                continue;
                            }
                            if (!entrada && !cerrado) {
                                continue;
                            }
                            filas.push({
                                fecha: dia,
                                idcolaborador: p.idcolaborador,
                                nombres: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(),
                                dni: p.dni,
                                area: p.idarea ? (b.nombreArea.get(p.idarea) || '') : '',
                                hora_entrada: entrada ? soloHora(entrada.marcada_at) : null,
                                hora_salida: salida ? soloHora(salida.marcada_at) : null,
                                horas: (entrada && salida)
                                    ? dosDec((0, asistencia_calendario_1.horasTurno)((0, asistencia_calendario_1.aTextoLima)(entrada.marcada_at), (0, asistencia_calendario_1.aTextoLima)(salida.marcada_at)))
                                    : null,
                                hora_esperada: dl.hora_esperada,
                                tardanza_min: entrada ? par.tardanza_min : null,
                                // El metodo importa para la norma: una marca puesta a mano por
                                // un tercero no prueba lo mismo que una hecha por el trabajador.
                                metodo: entrada ? entrada.metodo : null,
                                observacion: entrada
                                    ? (dl.es_descanso_trabajado ? 'Descanso trabajado'
                                        : dl.recargo_feriado_pct ? "Feriado trabajado (".concat(dl.feriado, ")")
                                            : null)
                                    : (dl.categoria !== 'NORMAL' ? dl.categoria.replace(/_/g, ' ')
                                        : 'Falta')
                            });
                        }
                    }
                    return [2 /*return*/, {
                            desde: desde,
                            hasta: hasta,
                            // La cabecera que la norma pide en el documento
                            empleador: {
                                razon_social: ((_a = b.org) === null || _a === void 0 ? void 0 : _a.nombre) || '',
                                ruc: ((_b = b.org) === null || _b === void 0 ? void 0 : _b.ruc) || '',
                                sede: (sede === null || sede === void 0 ? void 0 : sede.nombre) || '',
                                direccion: (sede === null || sede === void 0 ? void 0 : sede.direccion) || ''
                            },
                            filas: filas,
                            totales: {
                                registros: filas.length,
                                personas: new Set(filas.map(function (f) { return f.idcolaborador; })).size,
                                horas: dosDec(filas.reduce(function (a, f) { return a + (f.horas || 0); }, 0))
                            }
                        }];
            }
        });
    });
}
exports.registroJornada = registroJornada;
