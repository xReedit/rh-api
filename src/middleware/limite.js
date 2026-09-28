"use strict";
// Limite de intentos para los endpoints publicos del marcador.
//
// POR QUE HACE FALTA
// `/asistencia/publico/*` no exige sesion: lo llama el celular de cualquiera que
// tenga el QR delante. El codigo rotativo es inadivinable por fuerza bruta -- 10
// hexadecimales en una ventana de 15 segundos -- pero nada impedia que alguien
// martillara la API miles de veces por minuto. Eso no roba nada; tumba el
// servicio, que para el local es lo mismo.
//
// POR QUE EN MEMORIA Y NO EN REDIS
// La API corre en un solo proceso. Un contador en memoria alcanza, no agrega una
// dependencia que despues hay que operar, y si el proceso reinicia el peor caso
// es que alguien recupere sus intentos. El dia que la API escale a varios
// procesos esto hay que mover a un almacen compartido: queda dicho aqui para que
// se note antes de que falle.
//
// NO SE APLICA AL PANEL: ahi la sesion ya identifica a la persona y un limite
// por IP castigaria a todo un local que sale por la misma conexion.
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
var _a;
exports.__esModule = true;
exports._reiniciarLimites = exports.limite = void 0;
var VENTANA_MS = 60000;
/** Contadores por clave. Se limpia solo al vencer cada ventana. */
var contadores = new Map();
/**
 * La IP del que llama.
 *
 * Se mira `x-forwarded-for` porque en produccion la API vive detras de un proxy
 * y sin eso TODAS las peticiones compartirian la IP del proxy: el limite se
 * gastaria entre todos y el primer local que marque dejaria fuera al resto.
 */
function ipDe(req) {
    var _a;
    var fwd = String(req.headers['x-forwarded-for'] || '');
    if (fwd) {
        return fwd.split(',')[0].trim();
    }
    return String(((_a = req.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'desconocida');
}
/**
 * Corta despues de `maximo` intentos por minuto y por IP.
 *
 * El maximo se elige por endpoint: marcar es algo que una persona hace dos
 * veces al dia, pero en un local con un solo marcador y treinta personas
 * saliendo a la vez, todas comparten la IP del local. Por eso los numeros son
 * holgados: la idea es frenar un ataque, no al turno de la noche.
 */
function limite(maximo) {
    var _this = this;
    return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var tope, _a, clave, ahora, v, faltan;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(typeof maximo === 'number')) return [3 /*break*/, 1];
                    _a = maximo;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, maximo(req)];
                case 2:
                    _a = _b.sent();
                    _b.label = 3;
                case 3:
                    tope = _a;
                    clave = "".concat(req.baseUrl).concat(req.path, "|").concat(ipDe(req));
                    ahora = Date.now();
                    v = contadores.get(clave);
                    if (!v || ahora - v.desde > VENTANA_MS) {
                        contadores.set(clave, { desde: ahora, intentos: 1 });
                        return [2 /*return*/, next()];
                    }
                    v.intentos++;
                    if (v.intentos > tope) {
                        faltan = Math.ceil((VENTANA_MS - (ahora - v.desde)) / 1000);
                        res.setHeader('Retry-After', String(faltan));
                        return [2 /*return*/, res.status(429).json({
                                success: false,
                                datos: null,
                                // Mensaje para el trabajador parado frente a la pantalla, no
                                // para un programador: tiene que saber que hacer.
                                error: "Demasiados intentos. Espera ".concat(faltan, " segundo(s) y vuelve a escanear el QR.")
                            })];
                    }
                    next();
                    return [2 /*return*/];
            }
        });
    }); };
}
exports.limite = limite;
/**
 * Saca de memoria las ventanas vencidas.
 *
 * Sin esto, cada IP que pasa una vez deja su entrada para siempre y el mapa
 * crece sin techo. Se corre cada cinco minutos, que para ventanas de un minuto
 * es de sobra.
 */
var limpieza = setInterval(function () {
    var corte = Date.now() - VENTANA_MS;
    // forEach y no for...of: el proyecto compila a ES5 y recorrer un Map con
    // for...of pide --downlevelIteration. Es el mismo target que ya rompio el
    // `instanceof` de los errores.
    var vencidas = [];
    contadores.forEach(function (v, k) { if (v.desde < corte) {
        vencidas.push(k);
    } });
    vencidas.forEach(function (k) { return contadores["delete"](k); });
}, 5 * 60000);
// Que el temporizador no impida que el proceso termine cuando se lo pide
(_a = limpieza.unref) === null || _a === void 0 ? void 0 : _a.call(limpieza);
/** Solo para las pruebas: vacia los contadores. */
function _reiniciarLimites() { contadores.clear(); }
exports._reiniciarLimites = _reiniciarLimites;
