"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var express = __importStar(require("express"));
var usuario_1 = require("../controllers/usuario");
var usuario_2 = __importDefault(require("../controllers/usuario"));
var login_restobar_1 = __importDefault(require("../controllers/login.restobar"));
var auth_1 = require("../middleware/auth");
var rol_1 = __importDefault(require("../controllers/rol"));
var area_1 = __importDefault(require("../controllers/area"));
var sede_1 = __importDefault(require("../controllers/sede"));
var colaborador_1 = __importDefault(require("../controllers/colaborador"));
var colaborador_contrato_1 = __importDefault(require("../controllers/colaborador.contrato"));
var variables_globales_1 = __importDefault(require("../controllers/variables_globales"));
var varables_1 = __importDefault(require("../controllers/varables"));
var planilla_1 = __importDefault(require("../controllers/planilla"));
var tipo_contrato_1 = __importDefault(require("../controllers/tipo.contrato"));
var colaborador_boleta_1 = __importDefault(require("../controllers/colaborador.boleta"));
var router = express.Router();
router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a nuestra API RRHH port: 100323' });
});
router.use('/login', usuario_1.login);
router.use('/login-restobar', login_restobar_1["default"]);
router.use('/verify-login', auth_1.authVerify);
router.use('/rol', auth_1.auth, rol_1["default"]);
router.use('/area', auth_1.auth, area_1["default"]);
router.use('/sede', auth_1.auth, sede_1["default"]);
router.use('/colaborador', auth_1.auth, colaborador_1["default"]);
router.use('/colaborador-contrato', auth_1.auth, colaborador_contrato_1["default"]);
router.use('/usuario', auth_1.auth, usuario_2["default"]);
router.use('/variables_globales', auth_1.auth, variables_globales_1["default"]);
router.use('/variables', auth_1.auth, varables_1["default"]);
router.use('/planilla', auth_1.auth, planilla_1["default"]);
router.use('/tipo-contrato', auth_1.auth, tipo_contrato_1["default"]);
router.use('/colaborador-boleta', auth_1.auth, colaborador_boleta_1["default"]);
exports["default"] = router;
