// Self-check de la resolucion de dia laboral.
//
//   npx ts-node src/services/asistencia.dialaboral.test.ts
//
// Aca se decide si un dia cuenta como falta, si se paga doble o si el descanso
// corrio a otra fecha. Un error no se ve en pantalla: se ve en la boleta.

import { resolverDia, resumenDescansosTrabajados, Excepcion, Entrada } from './asistencia.dialaboral';
import { HorarioSemanal } from './asistencia.calendario';

let fallos = 0;
function chk(etiqueta: string, esperado: any, real: any) {
    const ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(56)} esperado=${JSON.stringify(esperado)}  real=${JSON.stringify(real)}`);
}

// Semana de referencia (2026): lun 14, mar 15, mie 16, jue 17, vie 18, sab 19, dom 20
const LUN = '2026-09-14', MAR = '2026-09-15', MIE = '2026-09-16', JUE = '2026-09-17';
const VIE = '2026-09-18', SAB = '2026-09-19', DOM = '2026-09-20';

// Juan: trabaja de martes a domingo 10:00-18:00. Descansa los LUNES.
const HORARIO: HorarioSemanal = {
    mar: { e: '10:00', s: '18:00' }, mie: { e: '10:00', s: '18:00' },
    jue: { e: '10:00', s: '18:00' }, vie: { e: '10:00', s: '18:00' },
    sab: { e: '10:00', s: '18:00' }, dom: { e: '10:00', s: '18:00' }
};

// Alguien que SI trabaja los lunes, para contrastar
const HORARIO_LUN: HorarioSemanal = { ...HORARIO, lun: { e: '10:00', s: '18:00' } };

const base = (fecha: string, extra: Partial<Entrada> = {}): Entrada => ({
    fecha,
    horario_semanal: HORARIO,
    tolerancia_min: 10,
    excepciones: [],
    feriados: new Map(),
    dias_cierre: [],
    ...extra
});

const exc = (o: Partial<Excepcion>): Excepcion => ({
    idcolaborador: 1, fecha: LUN, tipo: 'LABORABLE', motivo: '',
    compensacion: null, fecha_sustituto: null, recargo_pct: 100, ...o
});

console.log('--- el caso normal: manda el horario ---');
chk('martes trabaja', true, resolverDia(base(MAR)).labora);
chk('...a las 10:00', '10:00', resolverDia(base(MAR)).hora_esperada);
chk('lunes es su dia libre', false, resolverDia(base(LUN)).labora);
chk('...y lo dice', 'Dia libre', resolverDia(base(LUN)).motivo);
chk('sin horario cargado no trabaja', false, resolverDia(base(MAR, { horario_semanal: null })).labora);
chk('...y lo distingue de un dia libre', 'Sin horario asignado',
    resolverDia(base(MAR, { horario_semanal: null })).motivo);

console.log('\n--- el local cierra los lunes ---');
const cierra = { dias_cierre: ['lun'] };
chk('lunes: cerrado', false, resolverDia(base(LUN, cierra)).labora);
chk('...por cierre de sede', 'CIERRE_SEDE', resolverDia(base(LUN, cierra)).origen);
chk('martes: abre igual', true, resolverDia(base(MAR, cierra)).labora);

// Alguien que SI trabajaria el lunes segun su horario, pero el local cierra
chk('el cierre le gana al horario propio', false,
    resolverDia(base(LUN, { ...cierra, horario_semanal: HORARIO_LUN })).labora);

console.log('\n--- feriados ---');
const feriado = { feriados: new Map([[MAR, 'Fiestas Patrias']]) };
chk('feriado: no se trabaja', false, resolverDia(base(MAR, feriado)).labora);
chk('...y dice cual es', 'Fiestas Patrias', resolverDia(base(MAR, feriado)).motivo);
chk('el feriado se reporta igual en un dia normal', 'Fiestas Patrias', resolverDia(base(MAR, feriado)).feriado);
chk('un feriado en su dia libre no cambia nada', false, resolverDia(base(LUN, { feriados: new Map([[LUN, 'Navidad']]) })).labora);

console.log('\n--- "este lunes abrimos" (excepcion de la sede) ---');
const abre = {
    ...cierra,
    excepciones: [exc({ idcolaborador: 0, fecha: LUN, tipo: 'LABORABLE', motivo: 'Dia del Pollo a la Brasa' })]
};
// Juan NO tiene el lunes en su horario. Que el local abra NO lo convoca:
// si abrir convocara a todos, el que viene en su dia libre no cobraria recargo.
chk('abrir el local no obliga a quien no tiene ese dia', false, resolverDia(base(LUN, abre)).labora);
chk('...y el motivo sigue siendo su dia libre', 'Dia libre', resolverDia(base(LUN, abre)).motivo);
chk('...sin hora esperada', null, resolverDia(base(LUN, abre)).hora_esperada);

// Quien SI tiene el lunes en su horario, con el local abierto, trabaja normal
const abreConLunes = { ...abre, horario_semanal: HORARIO_LUN };
chk('el local abre y a este le toca: trabaja', true, resolverDia(base(LUN, abreConLunes)).labora);
chk('...por excepcion de sede', 'EXCEPCION_SEDE', resolverDia(base(LUN, abreConLunes)).origen);
chk('...con el motivo cargado', 'Dia del Pollo a la Brasa', resolverDia(base(LUN, abreConLunes)).motivo);
chk('...y con su hora', '10:00', resolverDia(base(LUN, abreConLunes)).hora_esperada);

// Abrir en feriado: la excepcion de sede le gana al feriado
const abreFeriado = {
    excepciones: [exc({ idcolaborador: 0, fecha: MAR, tipo: 'LABORABLE', motivo: 'Fiestas Patrias, abrimos' })],
    feriados: new Map([[MAR, 'Fiestas Patrias']])
};
chk('la excepcion de sede le gana al feriado', true, resolverDia(base(MAR, abreFeriado)).labora);

// Y el cierre puntual: "este martes no abrimos"
const cierraHoy = { excepciones: [exc({ idcolaborador: 0, fecha: MAR, tipo: 'NO_LABORABLE', motivo: 'Fumigacion' })] };
chk('cierre puntual de la sede', false, resolverDia(base(MAR, cierraHoy)).labora);
chk('...con su motivo', 'Fumigacion', resolverDia(base(MAR, cierraHoy)).motivo);

console.log('\n--- Juan trabaja en su dia libre ---');

// (a) Se le paga doble
const doble = {
    excepciones: [exc({ fecha: LUN, tipo: 'LABORABLE', motivo: 'Feriado, acordado', compensacion: 'RECARGO' })]
};
const rDoble = resolverDia(base(LUN, doble));
chk('trabaja', true, rDoble.labora);
chk('es descanso trabajado', true, rDoble.es_descanso_trabajado);
chk('se paga con recargo', 'RECARGO', rDoble.compensacion);
chk('al 100%', 100, rDoble.recargo_pct);

// (b) Corre su descanso al jueves
const corre = {
    excepciones: [exc({ fecha: LUN, tipo: 'LABORABLE', motivo: 'Cambio de descanso', compensacion: 'SUSTITUTORIO', fecha_sustituto: JUE })]
};
chk('el lunes trabaja', true, resolverDia(base(LUN, corre)).labora);
chk('es descanso trabajado', true, resolverDia(base(LUN, corre)).es_descanso_trabajado);
chk('sin recargo (descansa otro dia)', null, resolverDia(base(LUN, corre)).recargo_pct);
chk('y apunta a que dia lo corrio', JUE, resolverDia(base(LUN, corre)).fecha_sustituto);

// El jueves se DERIVA como descanso, sin una segunda fila
const rJue = resolverDia(base(JUE, corre));
chk('el jueves NO trabaja (derivado)', false, rJue.labora);
chk('...por descanso corrido', 'DESCANSO_SUSTITUTO', rJue.origen);
chk('...diciendo de donde vino', `Descanso movido desde el ${LUN}`, rJue.motivo);
chk('el viernes sigue normal', true, resolverDia(base(VIE, corre)).labora);

console.log('\n--- quien SI trabajaba ese dia no genera compensacion ---');
// El martes es dia normal de Juan; una excepcion LABORABLE ahi no es descanso trabajado
const martesNormal = {
    excepciones: [exc({ fecha: MAR, tipo: 'LABORABLE', motivo: 'Convocado', compensacion: 'RECARGO' })]
};
const rMar = resolverDia(base(MAR, martesNormal));
chk('trabaja', true, rMar.labora);
chk('NO es descanso trabajado', false, rMar.es_descanso_trabajado);
chk('...y por eso NO lleva recargo', null, rMar.recargo_pct);

console.log('\n--- precedencia: la persona le gana a la sede ---');
const chocan = {
    ...cierra,
    excepciones: [
        exc({ idcolaborador: 0, fecha: LUN, tipo: 'LABORABLE', motivo: 'Abrimos' }),
        exc({ idcolaborador: 1, fecha: LUN, tipo: 'NO_LABORABLE', motivo: 'Juan de licencia' })
    ]
};
chk('la sede abre pero Juan no viene', false, resolverDia(base(LUN, chocan)).labora);
chk('...gana la excepcion de la persona', 'EXCEPCION_PERSONA', resolverDia(base(LUN, chocan)).origen);

// Y al reves: la sede cierra pero Juan viene igual (inventario, limpieza)
const soloJuan = {
    ...cierra,
    excepciones: [exc({ idcolaborador: 1, fecha: LUN, tipo: 'LABORABLE', motivo: 'Inventario', compensacion: 'RECARGO' })]
};
chk('la sede cierra pero Juan viene', true, resolverDia(base(LUN, soloJuan)).labora);
chk('...y le corresponde recargo', true, resolverDia(base(LUN, soloJuan)).es_descanso_trabajado);

console.log('\n--- politica: el local abre los feriados ---');
// Sin esto, un restaurante que trabaja todos los dias tendria que "abrir" a
// mano los 16 feriados del ano, uno por uno. Es justo el trabajo que se quiere
// evitar.
const FER = new Map([[MAR, 'Fiestas Patrias']]);
const ferAbre = { feriados: FER, politica: { feriado_abre: true, feriado_recargo_pct: 100 } };
const ferCerrado = { feriados: FER };

chk('sin politica el feriado cierra', false, resolverDia(base(MAR, ferCerrado)).labora);
chk('...y lo dice', 'FERIADO', resolverDia(base(MAR, ferCerrado)).origen);
chk('con el local abierto, el martes se trabaja', true, resolverDia(base(MAR, ferAbre)).labora);
chk('...por su horario, no por el feriado', 'HORARIO', resolverDia(base(MAR, ferAbre)).origen);
chk('...con recargo de feriado', 100, resolverDia(base(MAR, ferAbre)).recargo_feriado_pct);
chk('...y sigue sabiendo que es feriado', 'Fiestas Patrias', resolverDia(base(MAR, ferAbre)).feriado);

// Abrir el feriado NO pisa el descanso de cada uno: el que descansa los lunes
// sigue descansando aunque el lunes sea feriado y el local abra.
const ferLun = {
    feriados: new Map([[LUN, 'Feriado lunes']]),
    politica: { feriado_abre: true, feriado_recargo_pct: 100 }
};
chk('el que descansa el lunes sigue descansando', false, resolverDia(base(LUN, ferLun)).labora);
chk('el que si trabaja los lunes, trabaja', true,
    resolverDia(base(LUN, { ...ferLun, horario_semanal: HORARIO_LUN })).labora);
chk('...y cobra el recargo', 100,
    resolverDia(base(LUN, { ...ferLun, horario_semanal: HORARIO_LUN })).recargo_feriado_pct);

// El cierre semanal le gana al feriado abierto: si el local no abre los lunes,
// que ese lunes sea feriado no lo hace abrir.
chk('el cierre semanal manda igual', false,
    resolverDia(base(LUN, { ...ferLun, dias_cierre: ['lun'] })).labora);

chk('abrir sin recargo configurado no inventa uno', null,
    resolverDia(base(MAR, { feriados: FER, politica: { feriado_abre: true, feriado_recargo_pct: 0 } })).recargo_feriado_pct);
chk('el que no trabaja no cobra recargo de feriado', null,
    resolverDia(base(LUN, ferLun)).recargo_feriado_pct);

// Los dos conceptos pueden darse juntos: vino en su descanso Y era feriado
const dobleFeriado = resolverDia(base(LUN, {
    ...ferLun,
    excepciones: [exc({ fecha: LUN, tipo: 'LABORABLE', motivo: 'Vino igual', compensacion: 'RECARGO' })]
}));
chk('descanso trabajado en feriado: trabaja', true, dobleFeriado.labora);
chk('...cuenta como descanso trabajado', true, dobleFeriado.es_descanso_trabajado);
chk('...y ademas cobra el recargo de feriado', 100, dobleFeriado.recargo_feriado_pct);

console.log('\n--- resumen del periodo ---');
const dias = [
    resolverDia(base(LUN, doble)),
    resolverDia(base(MAR)),
    resolverDia(base(LUN, corre)),
    resolverDia(base(LUN, { excepciones: [exc({ fecha: LUN, tipo: 'LABORABLE', motivo: 'sin definir' })] }))
];
const res = resumenDescansosTrabajados(dias);
chk('3 descansos trabajados', 3, res.total);
chk('1 con recargo', 1, res.con_recargo);
chk('1 con sustitutorio', 1, res.con_sustitutorio);
chk('1 SIN definir (hay que avisarlo)', 1, res.sin_definir);

console.log('\n' + (fallos ? `${fallos} FALLO(S)` : 'todo ok'));
process.exit(fallos ? 1 : 0);
