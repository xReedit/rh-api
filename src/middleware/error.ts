import { Request, Response, NextFunction } from 'express';

function capturarErroresDePrisma(err: Error, res: any) {    
    console.error(err);
    return res.status(400).send({ error: 'Error al procesar la solicitud' });        
}

export { capturarErroresDePrisma };