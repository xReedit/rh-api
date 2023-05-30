"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var express = __importStar(require("express"));
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var router = express.Router();
router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a colaborador contrato' });
});
// create
router.post('/create', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var dataBody, _data, contrato, _dataDetalle, rpt, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                dataBody = req.body;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, , 6]);
                // marca como actual
                return [4 /*yield*/, prisma.colaborador_contrato.updateMany({
                        data: { activo: '0' },
                        where: { idcolaborador: Number(dataBody.idcolaborador) }
                    })];
            case 2:
                // marca como actual
                _a.sent();
                _data = {
                    idcolaborador: Number(dataBody.idcolaborador),
                    idorg: Number(req['token'].idorg),
                    fecha_empieza: dataBody.fecha_empieza,
                    fecha_registro: new Date().toJSON().slice(0, 10),
                    activo: '1'
                };
                return [4 /*yield*/, prisma.colaborador_contrato.create({
                        data: _data
                    })
                    // guarda detalle de contrato
                ];
            case 3:
                contrato = _a.sent();
                // guarda detalle de contrato
                delete dataBody.fecha_empieza;
                delete dataBody.idcolaborador;
                // dataBody.idsede_trabajo = Number(dataBody.idsede_trabajo)
                dataBody.idrrhh_rol = Number(dataBody.idrrhh_rol);
                dataBody.idarea = Number(dataBody.idarea);
                dataBody.idsede_trabajo = Number(dataBody.idsede_trabajo);
                _dataDetalle = __assign(__assign({}, dataBody), { idcolaborador_contrato: contrato.idcolaborador_contrato });
                return [4 /*yield*/, prisma.colaborador_contrato_detalle.create({
                        data: _dataDetalle
                    })
                    // res.json(rpt)    
                ];
            case 4:
                rpt = _a.sent();
                // res.json(rpt)    
                res.status(200).send(rpt);
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error(error_1);
                return [2 /*return*/, res.status(400).send({ success: false, error: 'Error al procesar la solicitud' })];
            case 6:
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
// update
router.put('/update/:id', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var id, dataBody, _dataContrado, _dataDetalle, rpt, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                dataBody = req.body;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                _dataContrado = dataBody.contrato;
                _dataDetalle = dataBody.detalle;
                return [4 /*yield*/, prisma.colaborador_contrato.update({
                        data: _dataContrado,
                        where: { idcolaborador_contrato: Number(id) }
                    })];
            case 2:
                _a.sent();
                console.log('_dataContrado', _dataDetalle);
                // guarda detalle de contrato            
                _dataDetalle.idrrhh_rol = Number(_dataDetalle.idrrhh_rol);
                _dataDetalle.idarea = Number(_dataDetalle.idarea);
                _dataDetalle.idsede_trabajo = Number(_dataDetalle.idsede_trabajo);
                return [4 /*yield*/, prisma.colaborador_contrato_detalle.update({
                        data: _dataDetalle,
                        where: { idcolaborador_contrato_detalle: Number(_dataDetalle.idcolaborador_contrato_detalle) }
                    })
                    // res.json(rpt)    
                ];
            case 3:
                rpt = _a.sent();
                // res.json(rpt)    
                res.status(200).send(rpt);
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                console.error(error_2);
                return [2 /*return*/, res.status(400).send({ success: false, error: 'Error al procesar la solicitud' })];
            case 5:
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
router.get('/byIdColaborador/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, idorg, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                idorg = req['token'].idorg;
                return [4 /*yield*/, prisma.colaborador_contrato.findMany({
                        include: {
                            colaborador_contrato_detalle: true
                        },
                        where: {
                            AND: [
                                { idcolaborador: Number(id) },
                                { idorg: Number(idorg) },
                            ]
                        }
                    })];
            case 1:
                rpt = _a.sent();
                res.status(200).send(rpt);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
exports["default"] = router;
