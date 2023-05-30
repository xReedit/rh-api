import * as express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a tipo contrato' })
});


router.get('/all', async (req: any, res) => {
    const { id } = req.params
    const rpt = await prisma.tipo_contrato.findMany({
        where: { estado: '0' }
    })

    res.status(200).send(rpt);
    prisma.$disconnect();
})



export default router;