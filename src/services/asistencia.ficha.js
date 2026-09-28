"use strict";
// El mes de UNA persona, dia por dia.
//
// PARA QUE
// La planilla y los reportes miran a todo el personal junto. Esto mira a una
// sola persona y responde lo que se pregunta cuando alguien reclama: "que paso
// el martes 10". Un calendario donde cada dia tiene color se lee de un vistazo;
// una tabla de veinte filas hay que recorrerla entera.
//
// Es tambien lo que se le muestra al trabajador cuando pregunta por que le
// descontaron. Por eso el resumen de plata va al lado del calendario: el numero
// y el motivo, juntos.
//
// MISMO MOTOR
// `resolverDia` decide si el dia era laborable, igual que en el marcador, el
// reporte y la boleta. Si esta pantalla dijera algo distinto de la planilla,
// seria un error -- no otra forma de verlo.
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
exports.fichaDelMes = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var asistencia_dialaboral_1 = require("./asistencia.dialaboral");
var asistencia_config_1 = require("./asistencia.config");
var asistencia_planilla_1 = require("./asistencia.planilla");
var planilla_config_1 = require("./planilla.config");
var asistencia_sobretiempo_1 = require("./asistencia.sobretiempo");
var prisma = new client_1.PrismaClient();
var dosDec = function (n) { return Math.round(n * 100) / 100; };
var soloHora = function (v) { return ((0, asistencia_calendario_1.aTextoLima)(v) || '').slice(11, 16) || null; };
/**
 * La ficha del mes de una persona.
 *
 * @param body `{ idcolaborador, periodo }`. El periodo es el mismo de la
 *             planilla; sin el, el que esta en curso.
 */
function fichaDelMes(ctx, body) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var idcolaborador, persona, periodo, cfg, _b, org, corteRaw, corte, hoyOperativo, c, marcas, idx, tarifa, _c, dias, extras, trabajados, noTrabajados, tardanzas, tardanzaMin, justificados, f, fecha, dl, par, entrada, salida, cerrado, estado, horas, sobre, s, sobretiempo, descTardanza, descFaltas, pagoSobretiempo;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    idcolaborador = Number(body === null || body === void 0 ? void 0 : body.idcolaborador) || 0;
                    if (!idcolaborador) {
                        throw new asistencia_config_1.Invalido('falta el colaborador');
                    }
                    return [4 /*yield*/, prisma.colaborador.findFirst({
                            where: { idcolaborador: idcolaborador, idorg: ctx.idorg, idsede: ctx.idsede }
                        })];
                case 1:
                    persona = _d.sent();
                    if (!persona) {
                        throw new asistencia_config_1.Invalido('esa persona no es de esta sede', 404);
                    }
                    return [4 /*yield*/, (0, planilla_config_1.resolverPeriodoDeOrg)(ctx, body)];
                case 2:
                    periodo = _d.sent();
                    _b = planilla_config_1.configDe;
                    return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 3:
                    cfg = _b.apply(void 0, [_d.sent()]);
                    return [4 /*yield*/, prisma.org.findUnique({ where: { idorg: ctx.idorg } })];
                case 4:
                    org = _d.sent();
                    corteRaw = org === null || org === void 0 ? void 0 : org.asis_hora_corte;
                    corte = corteRaw instanceof Date ? corteRaw.toISOString().slice(11, 19) : String(corteRaw || '05:00:00');
                    hoyOperativo = (0, asistencia_calendario_1.diaOperativo)(corte, (0, asistencia_calendario_1.ahoraLima)());
                    return [4 /*yield*/, (0, asistencia_config_1.contextoLaboral)(ctx.idorg, ctx.idsede, periodo.desde, periodo.hasta)];
                case 5:
                    c = _d.sent();
                    return [4 /*yield*/, prisma.asistencia_marca.findMany({
                            where: {
                                idcolaborador: idcolaborador,
                                fecha_local: {
                                    gte: (0, asistencia_calendario_1.fechaSql)(periodo.desde + ' 00:00:00'),
                                    lte: (0, asistencia_calendario_1.fechaSql)(periodo.hasta + ' 00:00:00')
                                }
                            },
                            orderBy: { marcada_at: 'asc' }
                        })];
                case 6:
                    marcas = _d.sent();
                    idx = (0, asistencia_calendario_1.indexarMarcas)(marcas, function (m) { return (0, asistencia_calendario_1.aTextoLima)(m.fecha_local).slice(0, 10); });
                    _c = asistencia_planilla_1.tarifaDe;
                    return [4 /*yield*/, (0, asistencia_planilla_1.contratoDe)(idcolaborador)];
                case 7:
                    tarifa = _c.apply(void 0, [_d.sent()]);
                    dias = [];
                    extras = [];
                    trabajados = 0, noTrabajados = 0, tardanzas = 0, tardanzaMin = 0, justificados = 0;
                    for (f = new Date(periodo.desde + 'T00:00:00Z'); f.toISOString().slice(0, 10) <= periodo.hasta; f = new Date(f.getTime() + 86400000)) {
                        fecha = f.toISOString().slice(0, 10);
                        dl = (0, asistencia_dialaboral_1.resolverDia)({
                            fecha: fecha,
                            horario_semanal: persona.horario_semanal,
                            tolerancia_min: (_a = persona.tolerancia_min) !== null && _a !== void 0 ? _a : 10,
                            excepciones: c.porPersona(idcolaborador),
                            feriados: c.feriados,
                            dias_cierre: c.dias_cierre,
                            politica: c.politica
                        });
                        par = idx.get("".concat(idcolaborador, "|").concat(fecha)) || asistencia_calendario_1.SIN_MARCAS;
                        entrada = par.ENTRADA, salida = par.SALIDA;
                        cerrado = fecha < hoyOperativo;
                        estado = void 0;
                        horas = 0;
                        sobre = 0;
                        if (entrada) {
                            trabajados++;
                            horas = dosDec((0, asistencia_sobretiempo_1.minutosTrabajados)(par.todas) / 60);
                            if (par.tardanza_min > 0) {
                                tardanzas++;
                                tardanzaMin += par.tardanza_min;
                            }
                            if (salida) {
                                s = (0, asistencia_sobretiempo_1.sobretiempoDelDia)((0, asistencia_sobretiempo_1.minutosTrabajados)(par.todas), Math.round((0, asistencia_calendario_1.horasJornada)(persona.horario_semanal, fecha) * 60), cfg.sobretiempo_min_umbral, tarifa ? tarifa.valor_minuto : 0);
                                extras.push(s);
                                sobre = s.minutos;
                                estado = par.tardanza_min > 0 ? 'TARDANZA' : 'ASISTIO';
                            }
                            else {
                                // Entro y no marco salida. No es falta -- vino -- pero tampoco
                                // se le pueden contar horas que nadie registro.
                                estado = cerrado ? 'SIN_SALIDA' : 'ASISTIO';
                            }
                        }
                        else if (!dl.labora) {
                            // No le tocaba. Si ademas hay una categoria (vacaciones, licencia),
                            // se distingue: no es lo mismo descansar que estar de vacaciones.
                            estado = dl.categoria !== 'NORMAL' ? 'JUSTIFICADO' : 'DESCANSO';
                            if (dl.categoria !== 'NORMAL' && asistencia_dialaboral_1.CATEGORIAS_PAGADAS.includes(dl.categoria)) {
                                justificados++;
                            }
                        }
                        else if (cerrado) {
                            estado = 'FALTA';
                            noTrabajados++;
                        }
                        else {
                            // Le toca hoy y todavia no marco: el dia sigue abierto.
                            estado = 'PENDIENTE';
                        }
                        dias.push({
                            fecha: fecha,
                            dia: Number(fecha.slice(8, 10)),
                            estado: estado,
                            entrada: entrada ? soloHora(entrada.marcada_at) : null,
                            salida: salida ? soloHora(salida.marcada_at) : null,
                            tardanza_min: par.tardanza_min,
                            horas: horas,
                            sobretiempo_min: sobre,
                            motivo: dl.labora ? null : (dl.motivo || null),
                            feriado: dl.feriado,
                            descanso_trabajado: !!(entrada && dl.es_descanso_trabajado)
                        });
                    }
                    sobretiempo = (0, asistencia_sobretiempo_1.sumarSobretiempo)(extras);
                    descTardanza = tarifa ? dosDec(tardanzaMin * tarifa.valor_minuto) : 0;
                    descFaltas = tarifa ? dosDec(noTrabajados * tarifa.valor_dia) : 0;
                    pagoSobretiempo = cfg.usa_sobretiempo ? sobretiempo.importe : 0;
                    return [2 /*return*/, {
                            colaborador: {
                                idcolaborador: idcolaborador,
                                nombres: ((persona.nombres || '') + ' ' + (persona.apellidos || '')).trim(),
                                dni: persona.dni,
                                sin_contrato: !tarifa,
                                valor_dia: tarifa ? tarifa.valor_dia : null
                            },
                            periodo: periodo.etiqueta,
                            clave: periodo.clave,
                            desde: periodo.desde,
                            hasta: periodo.hasta,
                            en_curso: periodo.hasta >= hoyOperativo,
                            hoy: hoyOperativo,
                            dias: dias,
                            resumen: {
                                trabajados: trabajados,
                                no_trabajados: noTrabajados,
                                justificados: justificados,
                                tardanzas: tardanzas,
                                tardanza_min: tardanzaMin,
                                sobretiempo_min: sobretiempo.minutos
                            },
                            calculo: {
                                desc_tardanza: descTardanza,
                                desc_faltas: descFaltas,
                                pago_sobretiempo: pagoSobretiempo,
                                sobretiempo_se_paga: cfg.usa_sobretiempo,
                                // "Listo para planilla" solo si el periodo cerro Y no hay nada que
                                // aclarar. Un dia sin salida es justamente lo que hay que aclarar
                                // antes de pagar: no se sabe cuanto trabajo.
                                listo: periodo.hasta < hoyOperativo
                                    && !!tarifa
                                    && !dias.some(function (d) { return d.estado === 'SIN_SALIDA'; })
                            }
                        }];
            }
        });
    });
}
exports.fichaDelMes = fichaDelMes;
