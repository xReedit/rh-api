import * as jwt from 'jsonwebtoken';
import * as express from "express";
import * as bcrypt from 'bcryptjs';
import { SECRET_KEY } from '../middleware/auth';
import { PrismaClient } from "@prisma/client";


// const _SECRET_KEY = SECRET_KEY;
const prisma = new PrismaClient();
const router = express.Router();


/**
 * La base del POS. Es el mismo servidor MySQL, otra base.
 *
 * Se deja configurable porque el nombre puede no ser `restobar` en todos los
 * despliegues. Va como IDENTIFICADOR dentro del SQL -- eso no se puede
 * parametrizar -- asi que se valida a mano antes de usarlo: si alguien pone
 * cualquier cosa en la variable de entorno, se cae aqui y no dentro de una
 * consulta armada a mano.
 */
const POS_DB = (() => {
    const n = process.env.POS_DB || 'restobar';
    if (!/^[A-Za-z0-9_]+$/.test(n)) {
        throw new Error(`POS_DB invalido: ${n}. Solo letras, numeros y guion bajo.`);
    }
    return n;
})();

/**
 * Login con nombre de usuario y clave, para entrar a rrhh-1 sin pasar por el POS.
 *
 * LA CLAVE SE VALIDA CONTRA EL POS, NO CONTRA `rrhh.usuario`.
 *
 * Antes se comparaba contra `rrhh.usuario.pass`, creyendo que era una copia de
 * la clave del POS. No lo es: el SSO manda `pass: ''` (ver getDataUsRRHH en
 * xm_all.js del POS), asi que esa columna queda VACIA para todo el que entro
 * por ahi. El login nunca pudo funcionar, y donde tenia algo cargado a mano
 * era una clave vieja que nadie volvia a tocar -- en desarrollo habia una en
 * `123456`.
 *
 * Con el POS como unica fuente: cambiar la clave alli vale aqui en el acto, y
 * no queda un segundo lugar donde una clave se pudra sin que nadie la mire.
 */
export async function loginPorUsuario(usuario: string, pass: string) {
    const u = String(usuario || '').trim();
    const p = String(pass ?? '');

    if (!u || !p) { throw new Error('Escribe tu usuario y tu clave.'); }

    // Se traen TODAS las coincidencias: `usuario` no es unico entre empresas.
    //
    // La condicion es la MISMA del login del POS (log.php): texto plano y
    // estado=0. Deliberadamente igual, incluyendo que la colacion de la tabla
    // hace la comparacion sin distinguir mayusculas. Ser mas estricto aqui
    // dejaria afuera a gente cuya clave si entra en el POS, que es exactamente
    // la confusion que este cambio viene a sacar.
    const enElPos: any[] = await prisma.$queryRawUnsafe(
        `SELECT idusuario, idorg, usuario FROM ${POS_DB}.usuario
          WHERE usuario = ? AND pass = ? AND estado = 0`, u, p);

    if (enElPos.length === 0) {
        // El mismo mensaje para "no existe" y para "clave mala": distinguirlos
        // le confirma a cualquiera que un usuario existe.
        throw new Error('Usuario o clave incorrectos.');
    }

    if (enElPos.length > 1) {
        // Adivinar seria peor que fallar: se meteria a la persona en la
        // planilla de otro negocio.
        throw new Error(
            'Ese usuario existe en mas de una empresa. Entra desde el POS, que ya sabe cual es la tuya.');
    }

    const pos = enElPos[0];

    // Autenticado. Ahora hace falta la ficha de RRHH, que es la que dice que
    // locales puede ver (`alcance`) y con que nombre queda en la bitacora.
    const org: any = await prisma.org.findFirst({
        where: { idorg_restobar: Number(pos.idorg) } as any
    });

    const usr: any = org && await prisma.usuario.findFirst({
        where: { idorg: org.idorg, idusuario_restobar: Number(pos.idusuario) } as any
    });

    if (!usr) {
        // La clave estaba bien; lo que falta es la ficha, y esa la crea el SSO.
        // Se lo decimos tal cual: mandarlo a revisar la clave seria mentirle.
        throw new Error(
            'Tu clave es correcta, pero todavia no tienes ficha en Recursos Humanos. ' +
            'Entra una vez desde el POS, en Recursos Humanos, y despues ya puedes entrar por aqui.');
    }

    const sede: any = await prisma.sede.findUnique({ where: { idsede: usr.idsede } });

    const token = jwt.sign(
        {
            id: usr.idusuario, usuario: usr.usuario,
            // El nombre de la persona, para saludarla por su nombre en la barra.
            // Sin esto la pantalla mostraba el usuario interno -- alguien que
            // entraba como "easoporte" veia "SISTEMA" y no se reconocia.
            nombres: usr.nombres || usr.usuario,
            idsede: usr.idsede, idorg: usr.idorg,
            idsede_restobar: sede?.idsede_restobar ?? 0
        },
        SECRET_KEY, { expiresIn: '1d' });

    return { usuario: { ...usr, pass: undefined }, token };
}
// solo para restobar
export async function login(_usuario: any) {
    try {        
        // const usuario = <any>await prisma.usuario.findFirst({ where: { usuario: _usuario.usuario } });        
        const usuario = <any>await prisma.usuario.findFirst({ where: { idusuario_restobar: Number(_usuario.idusuario_restobar) } });

        if (!usuario) {
            throw new Error("Usuario o Clave incorrectos");
        }

        // const isMatch = bcrypt.compareSync(_usuario.pass, usuario.pass);
        const isMatch = _usuario.pass === usuario.pass;

        if (isMatch) {
            const token = jwt.sign({ id: usuario.idusuario, usuario: usuario.usuario, nombres: usuario.nombres || usuario.usuario, idsede: usuario.idsede, idorg: usuario.idorg, idsede_restobar: _usuario.idsede_restobar }, SECRET_KEY,
                {
                    expiresIn: "1d",
                })

            return { usuario: usuario, token: token };
        } else {
            throw new Error(`Usuario o Clave incorrectos`);
        }
    }
    catch (err) {
        throw err;
    }

}
