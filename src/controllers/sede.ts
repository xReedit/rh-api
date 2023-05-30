import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a sedes' })
});


// create
router.post('/create', async (req: any, res) => {
    const _data = { ...req.body, idsede: req['token'].idsede }
    const rpt = await prisma.rrhh_rol.create({
        data: _data
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.post('/create-sucursal', async (req: any, res) => {
    const _data = { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.sede.create({
        data: _data
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

router.put('/update-sucursal/:id', async (req: any, res) => {
    const { id } = req.params
    const _data = { ...req.body, idorg: req['token'].idorg }
    const rpt = await prisma.sede.update({
        data: _data,
        where: { idsede: Number(id) }
    })

    // res.json(rpt)    
    res.status(200).send(rpt);
    prisma.$disconnect();
});

//by idOrg
router.get('/byIdorg/:id', async (req: any, res) => {
    const { id } = req.params
    const rpt = await prisma.sede.findMany({        
        where: { idorg: Number(id) },
        select: {
            idsede: true,
            nombre: true,
            ciudad: true,
            direccion: true,
            telefono: true            
        },
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})

//princiapl by idOrg 
router.get('/byIdOrg-principal/:id', async (req: any, res) => {
    const { id } = req.params
    const rpt = await prisma.sede.findMany({
        take: 1,
        where: {
            AND: {
                idorg: Number(id),
                principal: '1'
            }
        },
        select: {
            idsede: true,
            nombre: true,
            ciudad: true,
            direccion: true,
            telefono: true,
            ruc: true,
        },
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})

router.get('/byListOrg/:id', async (req: any, res) => {
    const { id } = req.params
    const rpt = await prisma.$queryRawUnsafe(`select rr.*, cast(COALESCE(cc.cantidad, 0) as char) cantidad 
                from sede rr
                	left join (
                		select ccd.idsede_trabajo idsede, COUNT(ccd.idcolaborador_contrato) cantidad  from colaborador_contrato_detalle  ccd
							inner join colaborador_contrato cc on cc.idcolaborador_contrato  = ccd.idcolaborador_contrato
						where cc.activo = '1' and cc.idorg=${id}
						GROUP by ccd.idsede_trabajo
                	) as cc on cc.idsede = rr.idsede 
                where rr.idorg=${id} or rr.idsede = 0 
                GROUP by rr.idsede
                order by cantidad desc, rr.nombre`);

    res.status(200).send(rpt);
    prisma.$disconnect();
});


export default router;