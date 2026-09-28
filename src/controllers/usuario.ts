import { Request, Response } from 'express';
import * as express from "express";
import * as bcrypt from 'bcryptjs';
import * as userServices from '../services/usuario.service';
import { getErrorMessage } from '../utils/errors.util';


import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();


// login user
export const login = async (req: Request, res: Response) => {    
    try {
        const foundUser = await userServices.login(req.body);
        delete foundUser.usuario['pass'];
        res.status(200).send(foundUser);
    } catch (error) {
        return res.status(500).send(getErrorMessage(error));
    }
}



/** Login con usuario y clave, para entrar a rrhh-1 sin pasar por el POS. */
export const loginPanel = async (req: Request, res: Response) => {
    try {
        const r = await userServices.loginPorUsuario(req.body?.usuario, req.body?.pass);
        res.status(200).send(r);
    } catch (error) {
        // 401 y no 500: el usuario se equivoco, el servidor esta bien.
        return res.status(401).send({ error: getErrorMessage(error) });
    }
}

export const loginRestobar = async (req: Request, res: Response, user: any) => {
    try {
        const foundUser = await userServices.login(user);
        delete foundUser.usuario['pass'];
        res.status(200).send(foundUser);
    } catch (error) {
        return res.status(500).send(getErrorMessage(error));
    }
}


// create
router.post('/create-from-resobar', async (req: any, res) => {
    const _data = { ...req.body }
    const rpt = await prisma.usuario.create({
        data: _data
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

export default router;