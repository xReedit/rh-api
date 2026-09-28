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

import { Request, Response, NextFunction } from 'express';

interface Ventana { desde: number; intentos: number }

const VENTANA_MS = 60_000;

/** Contadores por clave. Se limpia solo al vencer cada ventana. */
const contadores = new Map<string, Ventana>();

/**
 * La IP del que llama.
 *
 * Se mira `x-forwarded-for` porque en produccion la API vive detras de un proxy
 * y sin eso TODAS las peticiones compartirian la IP del proxy: el limite se
 * gastaria entre todos y el primer local que marque dejaria fuera al resto.
 */
function ipDe(req: Request): string {
    const fwd = String(req.headers['x-forwarded-for'] || '');
    if (fwd) { return fwd.split(',')[0].trim(); }
    return String(req.socket?.remoteAddress || 'desconocida');
}

/**
 * Corta despues de `maximo` intentos por minuto y por IP.
 *
 * El maximo se elige por endpoint: marcar es algo que una persona hace dos
 * veces al dia, pero en un local con un solo marcador y treinta personas
 * saliendo a la vez, todas comparten la IP del local. Por eso los numeros son
 * holgados: la idea es frenar un ataque, no al turno de la noche.
 */
export function limite(maximo: number | ((req: Request) => Promise<number>)) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // El maximo puede ser fijo o salir de la configuracion del local. Se
        // resuelve ANTES de contar: si la consulta falla, el que la resuelve
        // devuelve el valor por defecto y el pedido sigue.
        const tope = typeof maximo === 'number' ? maximo : await maximo(req);

        const clave = `${req.baseUrl}${req.path}|${ipDe(req)}`;
        const ahora = Date.now();
        const v = contadores.get(clave);

        if (!v || ahora - v.desde > VENTANA_MS) {
            contadores.set(clave, { desde: ahora, intentos: 1 });
            return next();
        }

        v.intentos++;
        if (v.intentos > tope) {
            const faltan = Math.ceil((VENTANA_MS - (ahora - v.desde)) / 1000);
            res.setHeader('Retry-After', String(faltan));
            return res.status(429).json({
                success: false,
                datos: null,
                // Mensaje para el trabajador parado frente a la pantalla, no
                // para un programador: tiene que saber que hacer.
                error: `Demasiados intentos. Espera ${faltan} segundo(s) y vuelve a escanear el QR.`
            });
        }

        next();
    };
}

/**
 * Saca de memoria las ventanas vencidas.
 *
 * Sin esto, cada IP que pasa una vez deja su entrada para siempre y el mapa
 * crece sin techo. Se corre cada cinco minutos, que para ventanas de un minuto
 * es de sobra.
 */
const limpieza = setInterval(() => {
    const corte = Date.now() - VENTANA_MS;
    // forEach y no for...of: el proyecto compila a ES5 y recorrer un Map con
    // for...of pide --downlevelIteration. Es el mismo target que ya rompio el
    // `instanceof` de los errores.
    const vencidas: string[] = [];
    contadores.forEach((v, k) => { if (v.desde < corte) { vencidas.push(k); } });
    vencidas.forEach(k => contadores.delete(k));
}, 5 * 60_000);

// Que el temporizador no impida que el proceso termine cuando se lo pide
limpieza.unref?.();

/** Solo para las pruebas: vacia los contadores. */
export function _reiniciarLimites() { contadores.clear(); }
