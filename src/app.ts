// API RECURSOS HUMANOS
// DATA 100323


// PRIMERO, antes que cualquier otro import: los modulos que siguen leen
// process.env al cargarse. Ver src/env.ts para por que no alcanza con
// 'dotenv/config' a secas.
import './env'
import express from 'express'
import cors from "cors";

// ANTES de importar las rutas, y por eso importado por su EFECTO: los routers
// se arman al importarse. Como los `import` corren antes que el cuerpo del
// modulo, una llamada aqui abajo llegaria tarde.
import './middleware/blindaje';
import { manejadorDeErrores } from './middleware/blindaje';

import routes from './routes';

const app = express()

app.use(cors());
app.use(express.json());

app.use('/api-rrhh', routes)

// Va DESPUES de las rutas: Express elige el manejador de errores por el orden
// en que se registro, no por su tipo.
app.use(manejadorDeErrores);

app.listen(10323, () =>
    console.log('REST API server ready at: http://localhost:10323'),
)