"use strict";
// Bitacora de cambios: quien toco que, cuando y con la autorizacion de quien.
//
// Se registra todo lo que puede cambiar cuanto cobra alguien: horarios, dias de
// cierre, excepciones, feriados. Ante un reclamo ("mi horario no era ese") hay
// que poder responder con un hecho, no con la memoria de nadie.
//
// El detalle se arma AQUI, en el momento del cambio, y se guarda como frase.
// No se reconstruye al leer: si manana cambia el formato de los horarios, lo
// que se escribio ayer tiene que seguir leyendose igual.
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
exports.detalleExcepcion = exports.detalleHorario = exports.horarioATexto = exports.anotar = void 0;
var client_1 = require("@prisma/client");
var asistencia_calendario_1 = require("./asistencia.calendario");
var prisma = new client_1.PrismaClient();
/**
 * Deja el apunte. Nunca lanza: un fallo al auditar no debe impedir el cambio
 * que el usuario ya confirmo, pero si tiene que quedar en el log del servidor
 * para que alguien lo note.
 */
function anotar(a, autor) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma.asistencia_bitacora.create({
                            data: {
                                idorg: a.idorg,
                                idsede_restobar: a.idsede_restobar,
                                entidad: a.entidad,
                                identidad: (_a = a.identidad) !== null && _a !== void 0 ? _a : null,
                                idcolaborador: (_b = a.idcolaborador) !== null && _b !== void 0 ? _b : null,
                                accion: a.accion,
                                detalle: a.detalle.slice(0, 500),
                                valor_anterior: a.anterior === undefined ? null : JSON.stringify(a.anterior),
                                valor_nuevo: a.nuevo === undefined ? null : JSON.stringify(a.nuevo),
                                origen: autor.origen,
                                idusuario: (_c = autor.idusuario) !== null && _c !== void 0 ? _c : null,
                                usuario_nombre: (autor.nombre || '').slice(0, 120),
                                autorizado_por: (_d = autor.autorizado_por) !== null && _d !== void 0 ? _d : null,
                                autorizado_nombre: (autor.autorizado_nombre || '').slice(0, 120),
                                creado_at: (0, asistencia_calendario_1.fechaSql)((0, asistencia_calendario_1.ahoraLima)())
                            }
                        })];
                case 1:
                    _e.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _e.sent();
                    console.error('[bitacora] no se pudo anotar', a.entidad, a.accion, e_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.anotar = anotar;
// ---------------------------------------------------------------------------
// Frases legibles
// ---------------------------------------------------------------------------
var DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
var DIAS_TXT = { lun: 'Lun', mar: 'Mar', mie: 'Mie', jue: 'Jue', vie: 'Vie', sab: 'Sab', dom: 'Dom' };
/**
 * Horario en una linea, agrupando dias consecutivos con el mismo tramo.
 * "Lun-Vie 08:00-17:00 · Sab 10:00-14:00" se entiende de un vistazo; siete
 * lineas sueltas obligan a leerlas todas para ver que cambio.
 */
function horarioATexto(h) {
    if (!h || !Object.keys(h).length) {
        return 'sin horario';
    }
    var partes = [];
    var i = 0;
    while (i < DIAS.length) {
        var d = DIAS[i], t = h[d];
        if (!t) {
            i++;
            continue;
        }
        var j = i;
        while (j + 1 < DIAS.length) {
            var sig = h[DIAS[j + 1]];
            if (!sig || sig.e !== t.e || sig.s !== t.s) {
                break;
            }
            j++;
        }
        partes.push((j > i ? "".concat(DIAS_TXT[d], "-").concat(DIAS_TXT[DIAS[j]]) : DIAS_TXT[d]) + " ".concat(t.e, "-").concat(t.s));
        i = j + 1;
    }
    return partes.join(' · ') || 'sin horario';
}
exports.horarioATexto = horarioATexto;
function detalleHorario(nombre, antes, despues, tolAntes, tolDespues) {
    var a = horarioATexto(antes), b = horarioATexto(despues);
    var cambioHorario = a !== b;
    var cambioTol = tolAntes !== tolDespues;
    if (cambioHorario && cambioTol) {
        return "".concat(nombre, ": ").concat(a, " -> ").concat(b, "; tolerancia ").concat(tolAntes, " -> ").concat(tolDespues, " min");
    }
    if (cambioHorario) {
        return "".concat(nombre, ": ").concat(a, " -> ").concat(b);
    }
    if (cambioTol) {
        return "".concat(nombre, ": tolerancia ").concat(tolAntes, " -> ").concat(tolDespues, " min");
    }
    return "".concat(nombre, ": sin cambios");
}
exports.detalleHorario = detalleHorario;
function detalleExcepcion(quien, fecha, tipo, motivo, compensacion, sustituto) {
    var que = tipo === 'LABORABLE' ? 'trabaja' : 'no trabaja';
    var txt = "".concat(quien, " ").concat(que, " el ").concat(fecha, " (").concat(motivo, ")");
    if (compensacion === 'RECARGO') {
        txt += ' - se paga con recargo';
    }
    if (compensacion === 'SUSTITUTORIO') {
        txt += " - descansa el ".concat(sustituto);
    }
    return txt;
}
exports.detalleExcepcion = detalleExcepcion;
