"use strict";
// Codigo rotativo del kiosko (estilo TOTP).
//
// El QR de la pantalla de la puerta cambia cada 30 segundos. Eso es lo que
// prueba PRESENCIA FISICA: sacarle foto y mandarla por WhatsApp no sirve, para
// cuando el otro la abre el codigo ya vencio.
//
// No se guarda nada: el codigo se DERIVA del token del kiosko y de la ventana
// de tiempo, asi que las dos puntas (el PHP que lo pinta y esta API que lo
// valida) llegan al mismo valor sin coordinarse ni escribir en la base.
//
// La clave del HMAC es el `token_hash` del kiosko, no el token en claro: es lo
// unico que esta API tiene guardado, y el POS lo puede calcular porque el
// kiosko le entrega su token en cada pedido.
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
exports.__esModule = true;
exports.codigoValido = exports.calcularCodigo = exports.segundosRestantes = exports.ventanaActual = exports.VENTANAS_TOLERADAS = exports.VENTANA_SEG = void 0;
var crypto = __importStar(require("crypto"));
// 15 s. Era 30 y se bajo a la mitad: el ataque realista es que un companero
// fotografie el QR y se lo mande por WhatsApp al que va a llegar tarde. Cuanto
// menos dure el codigo, menos chance de que el mensaje llegue, se abra y se
// toque a tiempo.
exports.VENTANA_SEG = 15;
/** Cuantas ventanas hacia atras se siguen aceptando. */
// 1 = el codigo vive entre 15 y 30 s segun en que momento de la ventana se
// escanee. La tolerancia NO sobra: entre que la camara lee el QR, el celular
// abre el navegador, resuelve DNS y llega el pedido pasan varios segundos, y
// sin ella un celular lento rechazaria marcas legitimas todo el tiempo.
//
// Bajar VENTANA_SEG a 10 deja el techo en 20 s; mas abajo empiezan a fallar
// marcas de verdad, que es peor que el ataque que se quiere evitar.
exports.VENTANAS_TOLERADAS = 1;
function ventanaActual(ahoraMs) {
    return Math.floor((ahoraMs === undefined ? Date.now() : ahoraMs) / 1000 / exports.VENTANA_SEG);
}
exports.ventanaActual = ventanaActual;
/** Segundos que le quedan a la ventana en curso (para el contador de la pantalla). */
function segundosRestantes(ahoraMs) {
    var ms = ahoraMs === undefined ? Date.now() : ahoraMs;
    return exports.VENTANA_SEG - Math.floor(ms / 1000) % exports.VENTANA_SEG;
}
exports.segundosRestantes = segundosRestantes;
function calcularCodigo(tokenHash, idkiosko, ventana) {
    return crypto.createHmac('sha256', tokenHash)
        .update("".concat(idkiosko, ":").concat(ventana))
        .digest('hex')
        .slice(0, 10);
}
exports.calcularCodigo = calcularCodigo;
/**
 * Valida un codigo contra la ventana actual y las toleradas.
 * Comparacion en tiempo constante: comparar con === filtra por tiempo de
 * respuesta y deja adivinar el codigo caracter por caracter.
 */
function codigoValido(tokenHash, idkiosko, codigo, ahoraMs) {
    if (typeof codigo !== 'string' || codigo.length !== 10) {
        return false;
    }
    var actual = ventanaActual(ahoraMs);
    var recibido = Buffer.from(codigo);
    for (var i = 0; i <= exports.VENTANAS_TOLERADAS; i++) {
        var esperado = Buffer.from(calcularCodigo(tokenHash, idkiosko, actual - i));
        if (esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)) {
            return true;
        }
    }
    return false;
}
exports.codigoValido = codigoValido;
