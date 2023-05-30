"use strict";
// API RECURSOS HUMANOS
// DATA 100323
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var express_1 = __importDefault(require("express"));
var cors_1 = __importDefault(require("cors"));
var routes_1 = __importDefault(require("./routes"));
var app = (0, express_1["default"])();
app.use((0, cors_1["default"])());
app.use(express_1["default"].json());
app.use('/api-rrhh', routes_1["default"]);
app.listen(10323, function () {
    return console.log('REST API server ready at: http://localhost:10323');
});
