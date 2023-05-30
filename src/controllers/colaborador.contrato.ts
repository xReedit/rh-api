import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();


router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a colaborador contrato' })
});


// create
router.post('/create', async (req: any, res, next) => {
    const dataBody = req.body
    try {
        // marca como actual
        await prisma.colaborador_contrato.updateMany({
            data: { activo: '0' },            
            where: { idcolaborador: Number(dataBody.idcolaborador)}
        })

        const _data = {
            idcolaborador: Number(dataBody.idcolaborador),
            idorg: Number(req['token'].idorg),
            fecha_empieza: dataBody.fecha_empieza,
            fecha_registro: new Date().toJSON().slice(0, 10),
            activo: '1'
        }

        const contrato = await prisma.colaborador_contrato.create({
            data: _data
        })

        // guarda detalle de contrato
        delete dataBody.fecha_empieza;
        delete dataBody.idcolaborador;

        // dataBody.idsede_trabajo = Number(dataBody.idsede_trabajo)
        dataBody.idrrhh_rol = Number(dataBody.idrrhh_rol)
        dataBody.idarea = Number(dataBody.idarea)
        dataBody.idsede_trabajo = Number(dataBody.idsede_trabajo)
        const _dataDetalle = { ...dataBody, idcolaborador_contrato: contrato.idcolaborador_contrato }

        const rpt = await prisma.colaborador_contrato_detalle.create({
            data: _dataDetalle
        })

        // res.json(rpt)    
        res.status(200).send(rpt);
    } catch (error) {
        console.error(error);
        return res.status(400).send({ success:false, error: 'Error al procesar la solicitud' });        
    }
    
    prisma.$disconnect();
});

// update
router.put('/update/:id', async (req: any, res, next) => {
    const { id } = req.params
    const dataBody = req.body
    try {
        const _dataContrado = dataBody.contrato
        const _dataDetalle = dataBody.detalle

        await prisma.colaborador_contrato.update({
            data: _dataContrado,
            where: { idcolaborador_contrato: Number(id)}
        })

        console.log('_dataContrado', _dataDetalle);

        // guarda detalle de contrato            
        _dataDetalle.idrrhh_rol = Number(_dataDetalle.idrrhh_rol)
        _dataDetalle.idarea = Number(_dataDetalle.idarea)
        _dataDetalle.idsede_trabajo = Number(_dataDetalle.idsede_trabajo)
        // const _dataDetalle = { ...dataBody, idcolaborador_contrato: contrato.idcolaborador_contrato }

        const rpt = await prisma.colaborador_contrato_detalle.update({
            data: _dataDetalle,
            where: { idcolaborador_contrato_detalle: Number(_dataDetalle.idcolaborador_contrato_detalle) }
        })

        // res.json(rpt)    
        res.status(200).send(rpt);
    } catch (error) {
        console.error(error);
        return res.status(400).send({ success: false, error: 'Error al procesar la solicitud' });
    }

    prisma.$disconnect();
});

router.get('/byIdColaborador/:id', async (req: any, res) => {
    const { id } = req.params
    const idorg = req['token'].idorg
    const rpt = await prisma.colaborador_contrato.findMany({
        include: {
            colaborador_contrato_detalle: true
        },
        where: {
            AND: [
                { idcolaborador: Number(id) },
                { idorg: Number(idorg) },
            ]
        }
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
});


export default router;