import * as jwt from 'jsonwebtoken';
import { Secret, JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

/**
 * El secreto que firma el login de Recursos Humanos.
 *
 * Estaba escrito aqui y versionado en git. Cualquiera con acceso al repositorio
 * podia firmarse un token de cualquier empresa y leer o escribir su planilla;
 * desde que la asistencia baja importes a la boleta, eso ya es plata.
 *
 * Revienta al arrancar si falta, a proposito. La alternativa -- seguir con un
 * valor por defecto -- deja el agujero abierto justo donde nadie lo mira, y
 * firmar con `undefined` haria que todos los tokens validen contra cualquier
 * cosa. Es mejor que el servidor no levante y se vea en el primer intento.
 *
 * OJO al cambiarlo: invalida todas las sesiones abiertas y la gente vuelve a
 * loguearse una vez.
 */
if (!process.env.SECRET_KEY) {
    throw new Error(
        'Falta SECRET_KEY en el .env. Es el secreto que firma el login de RRHH. ' +
        'Generar uno con:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

export const SECRET_KEY: Secret = process.env.SECRET_KEY;

export interface CustomRequest extends Request {
    token: string | JwtPayload;
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        (req as CustomRequest).token = decoded;

        next();
    } catch (err) {
        res.status(401).send('Autentificacion Incorrecta');
    }
};

export const authVerify = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.body.token;

        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        (req as CustomRequest).token = decoded;

        res.status(200).send('Ok');
    } catch (err) {
        res.status(401).send('Autentificacion Incorrecta');
    }
};