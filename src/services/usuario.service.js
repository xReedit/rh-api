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
exports.login = exports.loginPorUsuario = void 0;
var jwt = __importStar(require("jsonwebtoken"));
var express = __importStar(require("express"));
var auth_1 = require("../middleware/auth");
var client_1 = require("@prisma/client");
// const _SECRET_KEY = SECRET_KEY;
var prisma = new client_1.PrismaClient();
var router = express.Router();
/**
 * La base del POS. Es el mismo servidor MySQL, otra base.
 *
 * Se deja configurable porque el nombre puede no ser `restobar` en todos los
 * despliegues. Va como IDENTIFICADOR dentro del SQL -- eso no se puede
 * parametrizar -- asi que se valida a mano antes de usarlo: si alguien pone
 * cualquier cosa en la variable de entorno, se cae aqui y no dentro de una
 * consulta armada a mano.
 */
var POS_DB = (function () {
    var n = process.env.POS_DB || 'restobar';
    if (!/^[A-Za-z0-9_]+$/.test(n)) {
        throw new Error("POS_DB invalido: ".concat(n, ". Solo letras, numeros y guion bajo."));
    }
    return n;
})();
/**
 * Login con nombre de usuario y clave, para entrar a rrhh-1 sin pasar por el POS.
 *
 * LA CLAVE SE VALIDA CONTRA EL POS, NO CONTRA `rrhh.usuario`.
 *
 * Antes se comparaba contra `rrhh.usuario.pass`, creyendo que era una copia de
 * la clave del POS. No lo es: el SSO manda `pass: ''` (ver getDataUsRRHH en
 * xm_all.js del POS), asi que esa columna queda VACIA para todo el que entro
 * por ahi. El login nunca pudo funcionar, y donde tenia algo cargado a mano
 * era una clave vieja que nadie volvia a tocar -- en desarrollo habia una en
 * `123456`.
 *
 * Con el POS como unica fuente: cambiar la clave alli vale aqui en el acto, y
 * no queda un segundo lugar donde una clave se pudra sin que nadie la mire.
 */
function loginPorUsuario(usuario, pass) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var u, p, enElPos, pos, org, usr, _b, sede, token;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    u = String(usuario || '').trim();
                    p = String(pass !== null && pass !== void 0 ? pass : '');
                    if (!u || !p) {
                        throw new Error('Escribe tu usuario y tu clave.');
                    }
                    return [4 /*yield*/, prisma.$queryRawUnsafe("SELECT idusuario, idorg, usuario FROM ".concat(POS_DB, ".usuario\n          WHERE usuario = ? AND pass = ? AND estado = 0"), u, p)];
                case 1:
                    enElPos = _c.sent();
                    if (enElPos.length === 0) {
                        // El mismo mensaje para "no existe" y para "clave mala": distinguirlos
                        // le confirma a cualquiera que un usuario existe.
                        throw new Error('Usuario o clave incorrectos.');
                    }
                    if (enElPos.length > 1) {
                        // Adivinar seria peor que fallar: se meteria a la persona en la
                        // planilla de otro negocio.
                        throw new Error('Ese usuario existe en mas de una empresa. Entra desde el POS, que ya sabe cual es la tuya.');
                    }
                    pos = enElPos[0];
                    return [4 /*yield*/, prisma.org.findFirst({
                            where: { idorg_restobar: Number(pos.idorg) }
                        })];
                case 2:
                    org = _c.sent();
                    _b = org;
                    if (!_b) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma.usuario.findFirst({
                            where: { idorg: org.idorg, idusuario_restobar: Number(pos.idusuario) }
                        })];
                case 3:
                    _b = (_c.sent());
                    _c.label = 4;
                case 4:
                    usr = _b;
                    if (!usr) {
                        // La clave estaba bien; lo que falta es la ficha, y esa la crea el SSO.
                        // Se lo decimos tal cual: mandarlo a revisar la clave seria mentirle.
                        throw new Error('Tu clave es correcta, pero todavia no tienes ficha en Recursos Humanos. ' +
                            'Entra una vez desde el POS, en Recursos Humanos, y despues ya puedes entrar por aqui.');
                    }
                    return [4 /*yield*/, prisma.sede.findUnique({ where: { idsede: usr.idsede } })];
                case 5:
                    sede = _c.sent();
                    token = jwt.sign({
                        id: usr.idusuario, usuario: usr.usuario,
                        // El nombre de la persona, para saludarla por su nombre en la barra.
                        // Sin esto la pantalla mostraba el usuario interno -- alguien que
                        // entraba como "easoporte" veia "SISTEMA" y no se reconocia.
                        nombres: usr.nombres || usr.usuario,
                        idsede: usr.idsede, idorg: usr.idorg,
                        idsede_restobar: (_a = sede === null || sede === void 0 ? void 0 : sede.idsede_restobar) !== null && _a !== void 0 ? _a : 0
                    }, auth_1.SECRET_KEY, { expiresIn: '1d' });
                    return [2 /*return*/, { usuario: __assign(__assign({}, usr), { pass: undefined }), token: token }];
            }
        });
    });
}
exports.loginPorUsuario = loginPorUsuario;
// solo para restobar
function login(_usuario) {
    return __awaiter(this, void 0, void 0, function () {
        var usuario, isMatch, token, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma.usuario.findFirst({ where: { idusuario_restobar: Number(_usuario.idusuario_restobar) } })];
                case 1:
                    usuario = _a.sent();
                    if (!usuario) {
                        throw new Error("Usuario o Clave incorrectos");
                    }
                    isMatch = _usuario.pass === usuario.pass;
                    if (isMatch) {
                        token = jwt.sign({ id: usuario.idusuario, usuario: usuario.usuario, nombres: usuario.nombres || usuario.usuario, idsede: usuario.idsede, idorg: usuario.idorg, idsede_restobar: _usuario.idsede_restobar }, auth_1.SECRET_KEY, {
                            expiresIn: "1d"
                        });
                        return [2 /*return*/, { usuario: usuario, token: token }];
                    }
                    else {
                        throw new Error("Usuario o Clave incorrectos");
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    throw err_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.login = login;
