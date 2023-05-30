import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a variables globales' })
});


// create
router.post('/create', async (req: any, res) => {
    const _data = { ...req.body, idsede: req['token'].idsede }
    const rpt = await prisma.variables_globales.create({
        data: _data
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.get('/byIdOrg/:id', async (req: any, res) => {
    const { id } = req.params
    const rpt = await prisma.variables_globales.findMany({
        where: {
            OR: [
                { idorg: Number(id) },
                { idorg: Number(0) },
            ],
            AND: {
                estado: String('0')
            }
        },
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
});


export default router;