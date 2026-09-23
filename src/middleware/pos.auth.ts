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

import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SECRET = process.env.POS_SHARED_SECRET || '';

export interface PosContexto {
    ido: number;        // restobar.org.idorg
    idsede: number;     // restobar.sede.idsede
    idusuario: number;  // restobar.usuario.idusuario (quien opera el panel)
}

export interface PosRequest extends Request {
    pos: PosContexto;
}

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
export const posPublicAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!SECRET) {
        console.error('[asistencia] falta POS_SHARED_SECRET en el .env');
        return res.status(500).json({ success: false, error: 'API sin configurar' });
    }

    const token = (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) { return res.status(401).json({ success: false, error: 'sin token' }); }

    try {
        const d: any = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
        // El claim `pub` separa los dos tipos de token: uno de panel no sirve
        // aqui y uno publico no sirve en los endpoints con tenant.
        if (!d.pub) { throw new Error('no es un token publico'); }
        next();
    } catch (e: any) {
        res.status(401).json({ success: false, error: 'token invalido' });
    }
};

export const posAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!SECRET) {
        // Fallar cerrado: sin secreto configurado no se atiende a nadie.
        console.error('[asistencia] falta POS_SHARED_SECRET en el .env');
        return res.status(500).json({ success: false, error: 'API sin configurar' });
    }

    const token = (req.header('Authorization') || '').replace('Bearer ', '');
    if (!token) { return res.status(401).json({ success: false, error: 'sin token' }); }

    try {
        const d: any = jwt.verify(token, SECRET, { algorithms: ['HS256'] });

        // Un token publico (el del celular) no puede entrar por aqui aunque
        // llevara ido/idsede: los dos tipos no son intercambiables.
        if (d.pub) { throw new Error('token publico en endpoint de panel'); }

        const ido = Number(d.ido);
        const idsede = Number(d.idsede);
        if (!ido || !idsede) { throw new Error('token sin empresa o sede'); }

        (req as PosRequest).pos = { ido, idsede, idusuario: Number(d.idusuario) || 0 };
        next();
    } catch (e: any) {
        res.status(401).json({ success: false, error: 'token invalido' });
    }
};
