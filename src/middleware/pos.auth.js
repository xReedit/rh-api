"use strict";
// Autenticacion del POS legacy contra esta API.
//
// El POS (PHP) es el unico que llama estos endpoints: el navegador nunca ve el
// token ni habla directo con la API. bdphp/log_asistencia.php arma un JWT corto
// con lo que hay en $_SESSION y lo manda por HTTPS.
//
// Por que un JWT firmado y no solo una API key: la key probaria que la llamada
// viene del POS, pero no DE QUE empresa. Como ido/idsede viajan dentro de la
// firma, un usuario avanzado del POS no puede cambiarlos para leer o marcar en
// otra sede: tendria que falsificar la firma, y el secreto solo vive en el
// servidor (private/asistencia_secrets.php), nunca en el navegador.
//
// PENDIENTE (fase de seguridad): rate limit por sede, y clave por sede en vez
// de un unico secreto compartido.
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
exports.posAuth = exports.posPublicAuth = void 0;
var jwt = __importStar(require("jsonwebtoken"));
var SECRET = process.env.POS_SHARED_SECRET || '';
/**
 * Para las paginas que abre el CELULAR del trabajador (enrolar, marcar).
 * Esas paginas no tienen sesion del POS, asi que el token no puede llevar
 * empresa ni sede: solo prueba que la llamada sale de un servidor del POS.
 *
 * Quien autoriza la operacion es el codigo que viaja en el body (la invitacion
 * o el codigo del kiosko): de un solo uso y con caducidad corta. La empresa y
 * la sede se deducen del colaborador al que pertenece ese codigo, nunca de lo
 * que mande el cliente.
 */
var posPublicAuth = function (req, res, next) {
    if (!SECRET) {
        console.error('[asistencia] falta POS_SHARED_SECRET en el .env');
        return res.status(500).json({ success: false, error: 'API sin configurar' });
    }
    var token = (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'sin token' });
    }
    try {
        var d = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
        // El claim `pub` separa los dos tipos de token: uno de panel no sirve
        // aqui y uno publico no sirve en los endpoints con tenant.
        if (!d.pub) {
            throw new Error('no es un token publico');
        }
        next();
    }
    catch (e) {
        // El cliente sigue viendo solo "token invalido" -- decirle POR QUE le
        // daria pistas para adivinar el secreto. Pero el servidor tiene que
        // dejarlo escrito: sin esto, un secreto mal copiado y un token vencido
        // se ven identicos desde afuera y se depuran a ciegas.
        console.error('[asistencia/publico] token rechazado:', e.message);
        res.status(401).json({ success: false, error: 'token invalido' });
    }
};
exports.posPublicAuth = posPublicAuth;
var posAuth = function (req, res, next) {
    if (!SECRET) {
        // Fallar cerrado: sin secreto configurado no se atiende a nadie.
        console.error('[asistencia] falta POS_SHARED_SECRET en el .env');
        return res.status(500).json({ success: false, error: 'API sin configurar' });
    }
    var token = (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'sin token' });
    }
    try {
        var d = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
        // Un token publico (el del celular) no puede entrar por aqui aunque
        // llevara ido/idsede: los dos tipos no son intercambiables.
        if (d.pub) {
            throw new Error('token publico en endpoint de panel');
        }
        var ido = Number(d.ido);
        var idsede = Number(d.idsede);
        if (!ido || !idsede) {
            throw new Error('token sin empresa o sede');
        }
        req.pos = { ido: ido, idsede: idsede, idusuario: Number(d.idusuario) || 0 };
        next();
    }
    catch (e) {
        // Idem: al cliente el motivo no, al log si.
        //   'invalid signature'  -> el secreto del POS y el de la API no coinciden
        //   'jwt expired'        -> relojes desfasados entre el POS y la API
        //   'token sin empresa'  -> el POS no mando ido/idsede
        console.error('[asistencia] token rechazado:', e.message);
        res.status(401).json({ success: false, error: 'token invalido' });
    }
};
exports.posAuth = posAuth;
