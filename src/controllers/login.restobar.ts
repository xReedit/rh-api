import { Request, Response } from 'express';
import * as express from "express";
import * as bcrypt from 'bcryptjs';
import * as userServices from '../services/usuario.service';
import { getErrorMessage } from '../utils/errors.util';
import { loginRestobar } from './usuario'


import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a login-restobar' })
});

// login user
router.post('/login', async (req: any, res:any) => {
    const _data = req.body    
    try {
        // verificar si existe usuario restobar
        let userRestobar: any = await getUserRestobar(_data.user.idusuario_restobar)                        

        if (userRestobar.length === 0) { //crea org, sede, usuario
            const dataOrg = _data.org            

            // crea org
            const rptOrg: any = await createOrg(dataOrg);

            // crea sede
            const dataSede = { ..._data.sede, idorg: rptOrg.idorg }
            const rptSede = await createSede(dataSede);
            
            //crea usuario
            const dataUser = { ..._data.user, idorg: rptOrg.idorg, idsede: rptSede.idsede, cargo: '' }
            userRestobar = await createUser(dataUser);



            // res.status(200).send(rptUsuario);    

            prisma.$disconnect();


        } else { // login
            // res.status(200).send(userRestobar[0]);     
            userRestobar = userRestobar[0]
            prisma.$disconnect();
        }

        userRestobar.idsede_restobar = _data.sede.idsede_restobar

        loginRestobar(req, res, userRestobar)
    
    } catch (error) {
        console.error(error);
        return res.status(500).send(getErrorMessage(error));
    }
})

const getUserRestobar = async (idusuario_restobar: number) => {    
    return await prisma.usuario.findMany({
        where: { idusuario_restobar: Number(idusuario_restobar) },            
    })    
}

const createOrg = async (dataOrg:any) => {   
    const userOrg = await prisma.org.findMany({
        where: {idorg_restobar: Number(dataOrg.idorg_restobar)}
    }) 
        
    if (userOrg.length === 0) { // sino existe crea
        return await prisma.org.create({
            data: dataOrg
        });
    } else {        
        return userOrg[0]
    }
}

const createSede = async (dataSede: any) => {
    const userSede = await prisma.sede.findMany({
        where: { idsede_restobar: Number(dataSede.idsede_restobar) }
    })

    if (userSede.length === 0) { // sino existe crea
        return await prisma.sede.create({
            data: dataSede
        });
    } else {
        return userSede[0]
    }
}


const createUser = async (dataUser: any) => {
    return await prisma.usuario.create({
        data: dataUser
    });
   
} 



export default router;