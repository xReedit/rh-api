"use strict";
exports.__esModule = true;
exports.capturarErroresDePrisma = void 0;
function capturarErroresDePrisma(err, res) {
    console.error(err);
    return res.status(400).send({ error: 'Error al procesar la solicitud' });
}
exports.capturarErroresDePrisma = capturarErroresDePrisma;
