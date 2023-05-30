import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a variables' })
});

router.get('/all', async (req: any, res) => {    
    const idorg = Number(req['token'].idorg)
    const rpt = await prisma.variables.findMany({
        where: {
            OR: [
                { idorg: 0 },
                { idorg: Number(idorg) }
            ],
            AND: {
                estado: '0'
            }
        },
        include: {
            variables_globales: true
        }
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})


// create
router.post('/create', async (req: any, res) => {
    const _data = { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.variables.create({
        data: _data
    })
    
    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.put('/update/:id', async (req: any, res) => {
    const { id } = req.params
    const _data = req.body;// { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.variables.update({
        data: _data,
        where: { idvariables: Number(id) }
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.put('/removeById/:id', async (req: any, res) => {
    const { id } = req.params    
    const rpt = await prisma.variables.update({
        data: {
            estado: '1'
        },
        where: { idvariables: Number(id) }
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.post('/byIdTipoVariable/:id', async (req: any, res) => {
    const { id } = req.params
    const idorg = req.body.idorg
    const rpt = await prisma.variables.findMany({
        include: {
            tipo_variable: true,
            variables_globales: true
        },
        where: {
            OR: [
                { idorg: Number(idorg) },
                { idorg: Number(0) },
            ],
            AND: [
                { idtipo_variable: Number(id) },
                { estado: String('0') }
            ]
        }        
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
});


export default router;