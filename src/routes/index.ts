import * as express from "express";
import { login } from "../controllers/usuario";
import usuario from "../controllers/usuario";
import loginRestobar from "../controllers/login.restobar";
import { auth, authVerify } from '../middleware/auth';
import rol from "../controllers/rol";
import area from "../controllers/area";
import sede from "../controllers/sede";
import colaborador from "../controllers/colaborador";
import colaborador_contrato from "../controllers/colaborador.contrato";
import variables_globales from "../controllers/variables_globales";
import variables from "../controllers/varables";
import planilla from "../controllers/planilla";
import tipo_contrato from "../controllers/tipo.contrato";
import colaborador_boleta from "../controllers/colaborador.boleta";
import asistencia, { publico as asistenciaPublico } from "../controllers/asistencia";
import asistenciaRrhh from "../controllers/asistencia.rrhh";
import { posAuth, posPublicAuth } from '../middleware/pos.auth';


const router = express.Router();

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a nuestra API RRHH port: 10323' })
});

router.use('/login', login);
router.use('/login-restobar', loginRestobar);
router.use('/verify-login', authVerify);
router.use('/rol', auth, rol);
router.use('/area', auth, area);
router.use('/sede', auth, sede);
router.use('/colaborador', auth, colaborador);
router.use('/colaborador-contrato', auth, colaborador_contrato);
router.use('/usuario', auth, usuario);
router.use('/variables_globales', auth, variables_globales);
router.use('/variables', auth, variables);
router.use('/planilla', auth, planilla);
router.use('/tipo-contrato', auth, tipo_contrato);
router.use('/colaborador-boleta', auth, colaborador_boleta);

// Asistencia: la llama el POS legacy, no la app SvelteKit. Por eso lleva su
// propio middleware en vez del `auth` de usuario de RRHH.
//
// /asistencia/publico/* lo abren el CELULAR del trabajador y la pantalla del
// kiosko, que no tienen sesion del POS. Van bajo un prefijo propio y con el
// middleware publico: asi ninguna ruta del panel puede quedar expuesta por
// descuido, y se ve de un vistazo cual es cual.
router.use('/asistencia/publico', posPublicAuth, asistenciaPublico);
router.use('/asistencia', posAuth, asistencia);

// La app de Recursos Humanos entra por otra puerta: usa su propio login
// (middleware auth) y solo LEE. Corregir marcas sigue siendo del marcador.
router.use('/asistencia-rrhh', auth, asistenciaRrhh);


export default router;