"use strict";
// API RECURSOS HUMANOS
// DATA 100323
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
// PRIMERO, antes que cualquier otro import: los modulos que siguen leen
// process.env al cargarse. Ver src/env.ts para por que no alcanza con
// 'dotenv/config' a secas.
require("./env");
var express_1 = __importDefault(require("express"));
var cors_1 = __importDefault(require("cors"));
// ANTES de importar las rutas, y por eso importado por su EFECTO: los routers
// se arman al importarse. Como los `import` corren antes que el cuerpo del
// modulo, una llamada aqui abajo llegaria tarde.
require("./middleware/blindaje");
var blindaje_1 = require("./middleware/blindaje");
var routes_1 = __importDefault(require("./routes"));
var app = (0, express_1["default"])();
app.use((0, cors_1["default"])());
app.use(express_1["default"].json());
app.use('/api-rrhh', routes_1["default"]);
// Va DESPUES de las rutas: Express elige el manejador de errores por el orden
// en que se registro, no por su tipo.
app.use(blindaje_1.manejadorDeErrores);
app.listen(10323, function () {
    return console.log('REST API server ready at: http://localhost:10323');
});
