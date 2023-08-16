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
    res.status(200).json({ message: 'Estás conectado a tipo contrato boleta' });
});
// create
router.post('/create', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _data, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _data = __assign(__assign({}, req.body), { idorg: req['token'].idorg });
                return [4 /*yield*/, prisma.colaborador_boleta.create({
                        data: _data
                    })
                    // res.json(rpt)    
                ];
            case 1:
                rpt = _a.sent();
                // res.json(rpt)    
                res.status(200).send(rpt);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
router.get('/byIdColaborador/:id/:periodo', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, periodo, rpt, newData;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                periodo = req.params.periodo;
                return [4 /*yield*/, prisma.$queryRawUnsafe("call procedure_get_datos_boleta(".concat(id, ", '").concat(periodo, "')"))];
            case 1:
                rpt = _a.sent();
                newData = [];
                if (rpt.length > 0) {
                    newData = rpt.map(function (item) { return ({
                        idcolaborador_boleta: item.f0,
                        idcolaborador: item.f1,
                        permanente: item.f2,
                        importe: item.f3,
                        nom_variable: item.f4,
                        idtipo_variable: item.f5,
                        idvariables: item.f6,
                        fecha_registro: item.f7,
                        observaciones: item.f8
                    }); });
                }
                res.status(200).send(newData);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
router.put('/update/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _data, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                _data = req.body;
                return [4 /*yield*/, prisma.colaborador_boleta.update({
                        data: _data,
                        where: { idcolaborador_boleta: Number(id) }
                    })
                    // res.json(rpt)    
                ];
            case 1:
                rpt = _a.sent();
                // res.json(rpt)    
                res.status(200).send(rpt);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
router.put('/remove', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _data, fechaActual, fechaRestada, _dataSend, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _data = req.body;
                fechaActual = new Date();
                fechaActual.setDate(fechaActual.getDate() - 1);
                fechaRestada = fechaActual.toISOString().split('T')[0];
                console.log('fechaRestada', fechaRestada);
                console.log('_data.idcolaborador_boleta', _data);
                _dataSend = {
                    estado: '1',
                    f_remove: fechaRestada.toString()
                };
                return [4 /*yield*/, prisma.colaborador_boleta.update({
                        data: _dataSend,
                        where: {
                            idcolaborador_boleta: Number(_data.idcolaborador_boleta)
                        }
                    })
                    // res.json(rpt)    
                ];
            case 1:
                rpt = _a.sent();
                // res.json(rpt)    
                res.status(200).send(rpt);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
exports["default"] = router;
