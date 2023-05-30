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
    res.status(200).json({ message: 'Estás conectado a sedes' });
});
// create
router.post('/create', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _data, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _data = __assign(__assign({}, req.body), { idsede: req['token'].idsede });
                return [4 /*yield*/, prisma.rrhh_rol.create({
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
router.post('/create-sucursal', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _data, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _data = __assign(__assign({}, req.body), { idorg: req['token'].idorg });
                return [4 /*yield*/, prisma.sede.create({
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
router.put('/update-sucursal/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _data, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                _data = __assign(__assign({}, req.body), { idorg: req['token'].idorg });
                return [4 /*yield*/, prisma.sede.update({
                        data: _data,
                        where: { idsede: Number(id) }
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
//by idOrg
router.get('/byIdorg/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                return [4 /*yield*/, prisma.sede.findMany({
                        where: { idorg: Number(id) },
                        select: {
                            idsede: true,
                            nombre: true,
                            ciudad: true,
                            direccion: true,
                            telefono: true
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
//princiapl by idOrg 
router.get('/byIdOrg-principal/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                return [4 /*yield*/, prisma.sede.findMany({
                        take: 1,
                        where: {
                            AND: {
                                idorg: Number(id),
                                principal: '1'
                            }
                        },
                        select: {
                            idsede: true,
                            nombre: true,
                            ciudad: true,
                            direccion: true,
                            telefono: true,
                            ruc: true
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
router.get('/byListOrg/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, rpt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                id = req.params.id;
                return [4 /*yield*/, prisma.$queryRawUnsafe("select rr.*, cast(COALESCE(cc.cantidad, 0) as char) cantidad \n                from sede rr\n                \tleft join (\n                \t\tselect ccd.idsede_trabajo idsede, COUNT(ccd.idcolaborador_contrato) cantidad  from colaborador_contrato_detalle  ccd\n\t\t\t\t\t\t\tinner join colaborador_contrato cc on cc.idcolaborador_contrato  = ccd.idcolaborador_contrato\n\t\t\t\t\t\twhere cc.activo = '1' and cc.idorg=".concat(id, "\n\t\t\t\t\t\tGROUP by ccd.idsede_trabajo\n                \t) as cc on cc.idsede = rr.idsede \n                where rr.idorg=").concat(id, " or rr.idsede = 0 \n                GROUP by rr.idsede\n                order by cantidad desc, rr.nombre"))];
            case 1:
                rpt = _a.sent();
                res.status(200).send(rpt);
                prisma.$disconnect();
                return [2 /*return*/];
        }
    });
}); });
exports["default"] = router;
