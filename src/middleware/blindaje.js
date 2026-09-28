"use strict";
// Que una peticion mal formada no tumbe el servidor entero.
//
// EL PROBLEMA QUE RESUELVE
// Express 4 no sabe nada de funciones `async`: si un handler asincrono lanza,
// la promesa queda rechazada sin dueno, y Node (15 en adelante) termina el
// proceso. No es teoria -- asi se caia este API:
//
//     GET /colaborador-contrato/byIdColaborador/undefined
//       -> Number('undefined') = NaN
//       -> Prisma rechaza el filtro
//       -> nadie atrapa el error
//       -> el proceso muere
//
// Una sola peticion, y se cae el API para TODOS: los kioskos dejan de poder
// marcar por una pantalla del panel que pidio mal un contrato. De los 91
// handlers asincronos, 35 estaban en esa situacion.
//
// POR QUE SE PARCHEA EL ROUTER Y NO SE ARREGLAN LOS 35
// Arreglarlos uno por uno son 35 oportunidades de equivocarse, y no protege al
// numero 36 que alguien escriba el mes que viene. Aqui se envuelve el metodo
// que los registra a todos, una vez y en un solo lugar.
//
// Esto NO reemplaza validar la entrada: que el servidor siga en pie despues de
// un error no vuelve bueno al error. Es la red debajo del trapecio.
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
exports.noMorirPorUnRechazo = exports.manejadorDeErrores = exports.blindarRouters = void 0;
var express = __importStar(require("express"));
var VERBOS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'];
/**
 * Envuelve un handler para que un rechazo termine en `next(err)` y no en el
 * aire. Lo que no es funcion se devuelve tal cual (rutas anidadas, strings).
 */
function envolver(fn) {
    if (typeof fn !== 'function') {
        return fn;
    }
    // Los manejadores de error de Express llevan 4 argumentos. Envolverlos
    // cambiaria su aridad y Express dejaria de reconocerlos como tales.
    if (fn.length === 4) {
        return fn;
    }
    // Un router de express tambien es funcion: envolverlo lo romperia.
    if (fn.stack !== undefined) {
        return fn;
    }
    var envuelto = function (req, res, next) {
        try {
            var r = fn.call(this, req, res, next);
            if (r && typeof r.then === 'function') {
                r["catch"](next);
            }
            return r;
        }
        catch (e) {
            next(e);
        }
    };
    // Se conserva el nombre para que los rastros de pila sigan siendo legibles.
    Object.defineProperty(envuelto, 'name', { value: fn.name || 'handler' });
    return envuelto;
}
/**
 * Se aplica UNA vez, antes de que se carguen los controladores.
 *
 * OJO CON EL ORDEN: no alcanza con llamarla arriba del todo en app.ts. Los
 * `import` se ejecutan ANTES que cualquier linea del cuerpo del modulo, asi
 * que para cuando corriera esa llamada los routers ya estarian armados y el
 * parche no alcanzaria a ninguno. Paso: el parche parecia puesto y el servidor
 * se seguia cayendo igual.
 *
 * Por eso se ejecuta al pie de este archivo, como efecto de importarlo, y
 * app.ts lo importa ANTES que a las rutas -- el mismo truco que ./env.
 */
function blindarRouters() {
    var proto = express.Router;
    VERBOS.forEach(function (verbo) {
        var original = proto[verbo];
        if (typeof original !== 'function' || original.__blindado) {
            return;
        }
        var nuevo = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return original.apply(this, args.map(envolver));
        };
        nuevo.__blindado = true;
        proto[verbo] = nuevo;
    });
}
exports.blindarRouters = blindarRouters;
/**
 * Ultimo eslabon: responde 500 y DEJA CONSTANCIA en el log del servidor.
 *
 * Al cliente no se le cuenta el detalle -- un error de base de datos dice mas
 * de la estructura interna que lo que cualquiera de afuera tiene que saber --
 * pero al log si, completo, porque es lo unico con lo que se arregla despues.
 */
function manejadorDeErrores(err, req, res, _next) {
    console.error('[error no atrapado]', req.method, req.originalUrl, err);
    if (res.headersSent) {
        return;
    }
    res.status(500).send({ success: false, datos: null, error: 'Error interno.' });
}
exports.manejadorDeErrores = manejadorDeErrores;
/**
 * Red de seguridad final, para lo que se escape de todo lo anterior: un
 * setTimeout, un evento, algo fuera del ciclo de una peticion.
 *
 * Se registra y se SIGUE. Un API de asistencia que se apaga sola deja a la
 * gente sin poder marcar su entrada; quedar en pie con un error anotado es
 * siempre mejor que apagarse prolijamente.
 */
function noMorirPorUnRechazo() {
    process.on('unhandledRejection', function (razon) {
        console.error('[promesa rechazada sin dueno]', razon);
    });
    process.on('uncaughtException', function (e) {
        console.error('[excepcion no atrapada]', e);
    });
}
exports.noMorirPorUnRechazo = noMorirPorUnRechazo;
// --------------------------------------------------------------------------
// Efecto de importar este archivo. Va aqui y no en app.ts por lo explicado
// arriba: importar corre antes que ejecutar.
// --------------------------------------------------------------------------
blindarRouters();
noMorirPorUnRechazo();
