"use strict";
// Self-check del regimen laboral y la RMV. Sin framework: se corre a mano.
//
//   npx ts-node src/services/planilla.regimen.test.ts
//
// Si algo aqui falla, se arma una planilla que el regimen de la empresa no
// contempla, o se deja pasar un sueldo por debajo del minimo legal.
exports.__esModule = true;
var planilla_regimen_1 = require("./planilla.regimen");
var fallos = 0;
function chk(etiqueta, esperado, real) {
    var ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) {
        fallos++;
    }
    console.log("".concat(ok ? 'OK  ' : 'FALLA', "  ").concat(etiqueta.padEnd(52), " esperado=").concat(JSON.stringify(esperado), "  real=").concat(JSON.stringify(real)));
}
// ---------------------------------------------------------------------------
console.log('--- regimen ---');
chk('reconoce MICRO', 'MICRO', (0, planilla_regimen_1.normalizarRegimen)('micro'));
chk('reconoce PEQUENA', 'PEQUENA', (0, planilla_regimen_1.normalizarRegimen)('PEQUENA'));
chk('cualquier cosa cae en GENERAL', 'GENERAL', (0, planilla_regimen_1.normalizarRegimen)('marciano'));
chk('vacio cae en GENERAL', 'GENERAL', (0, planilla_regimen_1.normalizarRegimen)(null));
// ---------------------------------------------------------------------------
console.log('\n--- beneficios (Ley MYPE) ---');
// Lo que la ley NIEGA a la microempresa es lo que mas importa: encenderlo
// armaria una boleta que su regimen no contempla.
var micro = (0, planilla_regimen_1.beneficiosDe)('MICRO');
chk('micro: sin CTS', false, micro.cts);
chk('micro: sin gratificaciones', false, micro.gratificacion);
chk('micro: 15 dias de vacaciones', 15, micro.vacaciones_dias);
chk('micro: salud por SIS, no EsSalud', false, micro.essalud);
var pequena = (0, planilla_regimen_1.beneficiosDe)('PEQUENA');
chk('pequena: si tiene CTS', true, pequena.cts);
chk('pequena: MEDIA gratificacion', 0.5, pequena.gratificacion_factor);
chk('pequena: 15 dias de vacaciones', 15, pequena.vacaciones_dias);
chk('pequena: EsSalud si', true, pequena.essalud);
var general = (0, planilla_regimen_1.beneficiosDe)('GENERAL');
chk('general: gratificacion completa', 1, general.gratificacion_factor);
chk('general: 30 dias de vacaciones', 30, general.vacaciones_dias);
// ---------------------------------------------------------------------------
console.log('\n--- interruptores que deja cada regimen ---');
chk('micro apaga CTS, gratificacion y EsSalud', { usa_cts: false, usa_gratificacion: false, usa_essalud: false }, (0, planilla_regimen_1.interruptoresDe)('MICRO'));
chk('pequena deja los tres encendidos', { usa_cts: true, usa_gratificacion: true, usa_essalud: true }, (0, planilla_regimen_1.interruptoresDe)('PEQUENA'));
// Los que NO dependen del regimen no se tocan: valen para todos.
chk('no decide sobre pensiones', false, 'usa_pensiones' in (0, planilla_regimen_1.interruptoresDe)('MICRO'));
chk('no decide sobre renta de quinta', false, 'usa_renta_quinta' in (0, planilla_regimen_1.interruptoresDe)('MICRO'));
chk('no decide sobre el formato legal', false, 'usa_formato_legal' in (0, planilla_regimen_1.interruptoresDe)('MICRO'));
// ---------------------------------------------------------------------------
console.log('\n--- remuneracion minima ---');
chk('la de hoy son 1130 (D.S. 006-2024-TR)', 1130, planilla_regimen_1.RMV_POR_DEFECTO);
chk('acepta un valor nuevo', 1300, (0, planilla_regimen_1.normalizarRmv)(1300));
chk('un cero vuelve al conocido', 1130, (0, planilla_regimen_1.normalizarRmv)(0));
chk('un negativo tambien', 1130, (0, planilla_regimen_1.normalizarRmv)(-5));
chk('texto tambien', 1130, (0, planilla_regimen_1.normalizarRmv)('mil'));
chk('jornada completa: la RMV entera', 1130, (0, planilla_regimen_1.rmvProporcional)(1130, 8));
chk('media jornada: la mitad', 565, (0, planilla_regimen_1.rmvProporcional)(1130, 4));
chk('6 horas: tres cuartos', 847.5, (0, planilla_regimen_1.rmvProporcional)(1130, 6));
// Trabajar de mas no sube el piso: eso se paga como sobretiempo.
chk('10 horas NO sube el minimo', 1130, (0, planilla_regimen_1.rmvProporcional)(1130, 10));
console.log('\n--- aviso de sueldo bajo el minimo ---');
chk('1130 con jornada completa esta bien', null, (0, planilla_regimen_1.debajoDelMinimo)(1130, 8, 1130));
chk('1500 esta bien', null, (0, planilla_regimen_1.debajoDelMinimo)(1500, 8, 1130));
chk('1000 esta por debajo', 1130, (0, planilla_regimen_1.debajoDelMinimo)(1000, 8, 1130));
// Media jornada: 600 es legal aunque sea menos que la RMV entera.
chk('600 en media jornada esta bien', null, (0, planilla_regimen_1.debajoDelMinimo)(600, 4, 1130));
chk('500 en media jornada esta por debajo', 565, (0, planilla_regimen_1.debajoDelMinimo)(500, 4, 1130));
// El centimo de margen, para que una proporcion con decimales no avise de mas.
chk('justo en el limite no avisa', null, (0, planilla_regimen_1.debajoDelMinimo)(847.5, 6, 1130));
console.log(fallos ? "\n".concat(fallos, " FALLO(S)") : '\ntodo ok');
process.exit(fallos ? 1 : 0);
