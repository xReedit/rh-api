// API RECURSOS HUMANOS
// DATA 100323


import express from 'express'
import cors from "cors";

import routes from './routes';

const app = express()

app.use(cors());
app.use(express.json());

app.use('/rrhh', routes)

app.listen(10323, () =>
    console.log('REST API server ready at: http://localhost:10323'),
)