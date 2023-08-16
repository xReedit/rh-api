import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a tipo contrato boleta' })
});

// create
router.post('/create', async (req: any, res) => {
    const _data = { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.colaborador_boleta.create({
        data: _data
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.get('/byIdColaborador/:id/:periodo', async (req: any, res) => {
    const { id } = req.params
    const { periodo } = req.params    
    // const idorg = Number(req['token'].idorg)
    // const rpt = await prisma.colaborador_boleta.findMany({
    //     where: {
    //         AND:[
    //             { idcolaborador: Number(id) },
    //             { idorg: Number(idorg) },
    //             { estado: '0'}
    //         ]
    //     },
    //     include: {
    //         variables: true
    //     }         
    // })

    // const rawProcedure = `call procedure_get_datos_boleta(${id}, '${periodo}')`
    let rpt: any = await prisma.$queryRawUnsafe(`call procedure_get_datos_boleta(${id}, '${periodo}')`);    
    let newData: any = []
    if (rpt.length >0 ) {
        newData = rpt.map((item: any) => ({
            idcolaborador_boleta: item.f0,
            idcolaborador: item.f1,
            permanente: item.f2,
            importe: item.f3,
            nom_variable: item.f4,
            idtipo_variable: item.f5,
            idvariables: item.f6,
            fecha_registro: item.f7,
            observaciones: item.f8
        }));
    }

    res.status(200).send(newData);
    prisma.$disconnect();
})

router.put('/update/:id', async (req: any, res) => {
    const { id } = req.params
    const _data = req.body;// { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.colaborador_boleta.update({
        data: _data,
        where: { idcolaborador_boleta: Number(id) }
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.put('/remove', async (req: any, res) => {    
    const _data = req.body;// { ...req.body, idorg: req['token'].idorg }

    // restamos un dia para que no figure
    let fechaActual = new Date();
    fechaActual.setDate(fechaActual.getDate() - 1);
    const fechaRestada = fechaActual.toISOString().split('T')[0];
    console.log('fechaRestada', fechaRestada);
    console.log('_data.idcolaborador_boleta', _data);

    const _dataSend = {
        estado: '1',
        f_remove: fechaRestada.toString()
    }

    const rpt = await prisma.colaborador_boleta.update({
        data: _dataSend,
        where: {
            idcolaborador_boleta: Number(_data.idcolaborador_boleta)             
        }
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});



export default router;