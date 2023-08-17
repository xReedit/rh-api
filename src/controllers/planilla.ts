import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();


router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a planilla' })
});

// lista por organizacion
router.get('/byIdorg/:id/:periodo', async (req: any, res) => {
    const { id } = req.params
    const { periodo } = req.params
    /*const rpt = await prisma.$queryRaw`SELECT c.idcolaborador,cc.idcolaborador_contrato,c.nombres, c.apellidos, c.dni,c.sexo, c.profesion
		,s.nombre nom_sede, s.ciudad ciudad_sede
		,ccd.unidad_remuneracion, format(ccd.importe, 2)importe_remuneracion
        ,rr.descripcion rol
        ,format(COALESCE(pp.total_pagado, 0),2) total_pagado
        ,cc.fecha_empieza
from colaborador c 
 inner join colaborador_contrato cc on cc.idcolaborador = c.idcolaborador 
 inner join colaborador_contrato_detalle ccd on ccd.idcolaborador_contrato = cc.idcolaborador_contrato 
 inner join rrhh_rol rr on ccd.idrrhh_rol = rr.idrrhh_rol
 inner join sede s on s.idsede = ccd.idsede_trabajo 
 left join planilla_periodo pp 
    ON pp.idcolaborador = c.idcolaborador
    and cast(pp.periodo as date) = cast(${periodo} as date)
where c.idorg = ${id} and cc.estado = 0 and cc.activo='1' 
    and cast(cc.fecha_empieza as date) <= cast(${periodo} as date)
order by s.nombre`;*/

    let rpt: any = await prisma.$queryRawUnsafe(`call procedure_get_planilla_periodo(${id}, '${periodo}')`);

    let newData: any = []
    if (rpt.length > 0) {
        newData = rpt.map((item: any) => ({
            idcolaborador: item.f0,
            idcolaborador_contrato: item.f1,
            nombres: item.f2,
            apellidos: item.f3,
            dni: item.f4,
            sexo: item.f5,
            profesion: item.f6,
            nom_sede: item.f7,
            ciudad_sede: item.f8,
            unidad_remuneracion: item.f9,
            importe_remuneracion: item.f10,
            rol: item.f11,
            total_pagado: item.f12,
            fecha_empieza: item.f13,
            totales: item.f14
        }));
    }

    res.status(200).send(newData);
    prisma.$disconnect();    
});


// Datos de colaborador -boleta de pago - 
router.get('/colaborador-datos/:id', async (req: any, res) => {
    const { id } = req.params
    const idorg = Number(req['token'].idorg)
    const rpt = await prisma.$queryRaw`SELECT c.idcolaborador,cc.idcolaborador_contrato,c.nombres, c.apellidos, c.dni,c.sexo, c.profesion
		,c.f_ingreso 
		,s.nombre nom_sede, s.ciudad ciudad_sede
		,ccd.unidad_remuneracion, format(ccd.importe, 2) suedo_basico
		,rr.descripcion cargo, a.descripcion nom_area
		,tc.descripcion tipo_contrato
        ,cc.fecha_empieza,ccd.horas, c.cuenta, c.nom_banco
from colaborador c 
 inner join colaborador_contrato cc on cc.idcolaborador = c.idcolaborador 
 inner join colaborador_contrato_detalle ccd on ccd.idcolaborador_contrato = cc.idcolaborador_contrato 
 inner join rrhh_rol rr on ccd.idrrhh_rol = rr.idrrhh_rol 
 inner join area a on ccd.idarea = a.idarea 
 inner join sede s on s.idsede = ccd.idsede_trabajo 
 inner join tipo_contrato tc on ccd.idtipo_contrato = tc.idtipo_contrato 
where (c.idcolaborador = ${id} and c.idorg = ${idorg}) and cc.estado = 0 and cc.activo='1'`;


    res.status(200).send(rpt);
    prisma.$disconnect();
});


router.get('/byIdColaborador/:id/:periodo', async (req: any, res) => {
    const { id } = req.params
    const { periodo } = req.params
    const idorg = Number(req['token'].idorg)
    const rpt = await prisma.planilla_periodo.findMany({
        where: {
            AND:[
                { idcolaborador: Number(id) },
                { idorg: Number(idorg) },
                { periodo: periodo },
                { estado: '0'}
            ]
        }     
    })    

    res.status(200).send(rpt);
    prisma.$disconnect();
})

router.post('/create-cierre-periodo', async (req: any, res) => {    
    const _data = { ...req.body,
        idorg: req['token'].idorg,        
        f_cierre: new Date().toISOString().split('T')[0]
    }
    const rpt = await prisma.planilla_periodo.create({
        data: _data
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})

router.put('/update-cierre-periodo/:id', async (req: any, res) => {
    const { id } = req.params
    const _data = req.body;
    const rpt = await prisma.planilla_periodo.update({
        data: _data,
        where: { idplanilla_periodo: Number(id) }
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})


export default router;