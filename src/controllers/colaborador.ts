import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a colaborador' })
});


// create
router.post('/create', async (req: any, res) => {
    const _data = { ...req.body, idsede: req['token'].idsede, idorg: req['token'].idorg }
    let rpt = await prisma.colaborador.create({
        data: _data
    })

    // res.json(rpt)        
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.put('/update/:id', async (req: any, res) => {
    const { id } = req.params
    const idorg = req['token'].idorg
    const _data = { ...req.body, idsede: req['token'].idsede, idorg: req['token'].idorg }
    const rpt = await prisma.colaborador.updateMany({
            data: _data,
            where: { 
                AND: [
                    {idcolaborador: Number(id)},
                    { idorg: Number(idorg)},
                ]
            }
            
        }
    )
    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.get('/byId/:id', async (req: any, res) => {
    const { id } = req.params
    const idorg = req['token'].idorg
    const rpt = await prisma.colaborador.findMany({
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


router.get('/byIdorg/:id', async (req: any, res) => {    
    const { id } = req.params
    const rpt = await prisma.$queryRawUnsafe(`select c.*, COALESCE(s.nombre, '-') nom_sede, COALESCE(s.ciudad, '-') ciudad_sede from colaborador c 	
	left join colaborador_contrato cc on cc.idcolaborador = c.idcolaborador 
	left join colaborador_contrato_detalle ccd on ccd.idcolaborador_contrato = cc.idcolaborador_contrato 
	left join sede s on s.idsede = ccd.idsede_trabajo 
where c.idorg = ${id}
GROUP by c.idcolaborador`);


    res.status(200).send(rpt);
    prisma.$disconnect();
});








export default router;