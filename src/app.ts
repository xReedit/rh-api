// API RECURSOS HUMANOS
// DATA 100323


// PRIMERO, antes que cualquier otro import: los modulos que siguen leen
// process.env al cargarse. Ver src/env.ts para por que no alcanza con
// 'dotenv/config' a secas.
import './env'
import express from 'express'
import cors from "cors";

import routes from './routes';

const app = express()

app.use(cors());
app.use(express.json());

app.use('/api-rrhh', routes)

app.listen(10323, () =>
    console.log('REST API server ready at: http://localhost:10323'),
)