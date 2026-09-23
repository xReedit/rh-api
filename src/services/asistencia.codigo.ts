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

import * as crypto from "crypto";

// 15 s. Era 30 y se bajo a la mitad: el ataque realista es que un companero
// fotografie el QR y se lo mande por WhatsApp al que va a llegar tarde. Cuanto
// menos dure el codigo, menos chance de que el mensaje llegue, se abra y se
// toque a tiempo.
export const VENTANA_SEG = 15;

/** Cuantas ventanas hacia atras se siguen aceptando. */
// 1 = el codigo vive entre 15 y 30 s segun en que momento de la ventana se
// escanee. La tolerancia NO sobra: entre que la camara lee el QR, el celular
// abre el navegador, resuelve DNS y llega el pedido pasan varios segundos, y
// sin ella un celular lento rechazaria marcas legitimas todo el tiempo.
//
// Bajar VENTANA_SEG a 10 deja el techo en 20 s; mas abajo empiezan a fallar
// marcas de verdad, que es peor que el ataque que se quiere evitar.
export const VENTANAS_TOLERADAS = 1;

export function ventanaActual(ahoraMs?: number): number {
    return Math.floor((ahoraMs === undefined ? Date.now() : ahoraMs) / 1000 / VENTANA_SEG);
}

/** Segundos que le quedan a la ventana en curso (para el contador de la pantalla). */
export function segundosRestantes(ahoraMs?: number): number {
    const ms = ahoraMs === undefined ? Date.now() : ahoraMs;
    return VENTANA_SEG - Math.floor(ms / 1000) % VENTANA_SEG;
}

export function calcularCodigo(tokenHash: string, idkiosko: number, ventana: number): string {
    return crypto.createHmac('sha256', tokenHash)
        .update(`${idkiosko}:${ventana}`)
        .digest('hex')
        .slice(0, 10);
}

/**
 * Valida un codigo contra la ventana actual y las toleradas.
 * Comparacion en tiempo constante: comparar con === filtra por tiempo de
 * respuesta y deja adivinar el codigo caracter por caracter.
 */
export function codigoValido(tokenHash: string, idkiosko: number, codigo: string, ahoraMs?: number): boolean {
    if (typeof codigo !== 'string' || codigo.length !== 10) { return false; }

    const actual = ventanaActual(ahoraMs);
    const recibido = Buffer.from(codigo);

    for (let i = 0; i <= VENTANAS_TOLERADAS; i++) {
        const esperado = Buffer.from(calcularCodigo(tokenHash, idkiosko, actual - i));
        if (esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)) { return true; }
    }
    return false;
}
