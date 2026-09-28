// Self-check del regimen laboral y la RMV. Sin framework: se corre a mano.
//
//   npx ts-node src/services/planilla.regimen.test.ts
//
// Si algo aqui falla, se arma una planilla que el regimen de la empresa no
// contempla, o se deja pasar un sueldo por debajo del minimo legal.

import {
    normalizarRegimen, beneficiosDe, interruptoresDe,
    normalizarRmv, rmvProporcional, debajoDelMinimo, RMV_POR_DEFECTO
} from './planilla.regimen';

let fallos = 0;

function chk(etiqueta: string, esperado: any, real: any) {
    const ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(52)} esperado=${JSON.stringify(esperado)}  real=${JSON.stringify(real)}`);
}

// ---------------------------------------------------------------------------
console.log('--- regimen ---');

chk('reconoce MICRO', 'MICRO', normalizarRegimen('micro'));
chk('reconoce PEQUENA', 'PEQUENA', normalizarRegimen('PEQUENA'));
chk('cualquier cosa cae en GENERAL', 'GENERAL', normalizarRegimen('marciano'));
chk('vacio cae en GENERAL', 'GENERAL', normalizarRegimen(null));

// ---------------------------------------------------------------------------
console.log('\n--- beneficios (Ley MYPE) ---');

// Lo que la ley NIEGA a la microempresa es lo que mas importa: encenderlo
// armaria una boleta que su regimen no contempla.
const micro = beneficiosDe('MICRO');
chk('micro: sin CTS', false, micro.cts);
chk('micro: sin gratificaciones', false, micro.gratificacion);
chk('micro: 15 dias de vacaciones', 15, micro.vacaciones_dias);
chk('micro: salud por SIS, no EsSalud', false, micro.essalud);

const pequena = beneficiosDe('PEQUENA');
chk('pequena: si tiene CTS', true, pequena.cts);
chk('pequena: MEDIA gratificacion', 0.5, pequena.gratificacion_factor);
chk('pequena: 15 dias de vacaciones', 15, pequena.vacaciones_dias);
chk('pequena: EsSalud si', true, pequena.essalud);

const general = beneficiosDe('GENERAL');
chk('general: gratificacion completa', 1, general.gratificacion_factor);
chk('general: 30 dias de vacaciones', 30, general.vacaciones_dias);

// ---------------------------------------------------------------------------
console.log('\n--- interruptores que deja cada regimen ---');

chk('micro apaga CTS, gratificacion y EsSalud',
    { usa_cts: false, usa_gratificacion: false, usa_essalud: false },
    interruptoresDe('MICRO'));
chk('pequena deja los tres encendidos',
    { usa_cts: true, usa_gratificacion: true, usa_essalud: true },
    interruptoresDe('PEQUENA'));

// Los que NO dependen del regimen no se tocan: valen para todos.
chk('no decide sobre pensiones', false, 'usa_pensiones' in interruptoresDe('MICRO'));
chk('no decide sobre renta de quinta', false, 'usa_renta_quinta' in interruptoresDe('MICRO'));
chk('no decide sobre el formato legal', false, 'usa_formato_legal' in interruptoresDe('MICRO'));

// ---------------------------------------------------------------------------
console.log('\n--- remuneracion minima ---');

chk('la de hoy son 1130 (D.S. 006-2024-TR)', 1130, RMV_POR_DEFECTO);
chk('acepta un valor nuevo', 1300, normalizarRmv(1300));
chk('un cero vuelve al conocido', 1130, normalizarRmv(0));
chk('un negativo tambien', 1130, normalizarRmv(-5));
chk('texto tambien', 1130, normalizarRmv('mil'));

chk('jornada completa: la RMV entera', 1130, rmvProporcional(1130, 8));
chk('media jornada: la mitad', 565, rmvProporcional(1130, 4));
chk('6 horas: tres cuartos', 847.5, rmvProporcional(1130, 6));
// Trabajar de mas no sube el piso: eso se paga como sobretiempo.
chk('10 horas NO sube el minimo', 1130, rmvProporcional(1130, 10));

console.log('\n--- aviso de sueldo bajo el minimo ---');

chk('1130 con jornada completa esta bien', null, debajoDelMinimo(1130, 8, 1130));
chk('1500 esta bien', null, debajoDelMinimo(1500, 8, 1130));
chk('1000 esta por debajo', 1130, debajoDelMinimo(1000, 8, 1130));
// Media jornada: 600 es legal aunque sea menos que la RMV entera.
chk('600 en media jornada esta bien', null, debajoDelMinimo(600, 4, 1130));
chk('500 en media jornada esta por debajo', 565, debajoDelMinimo(500, 4, 1130));
// El centimo de margen, para que una proporcion con decimales no avise de mas.
chk('justo en el limite no avisa', null, debajoDelMinimo(847.5, 6, 1130));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\ntodo ok');
process.exit(fallos ? 1 : 0);
