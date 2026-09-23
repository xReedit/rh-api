// Self-check del calendario de asistencia. Sin framework: se corre a mano.
//
//   npx ts-node src/services/asistencia.calendario.test.ts
//
// Si algo aqui falla, las tardanzas y las horas de la planilla salen mal.

import { diaOperativo, tardanzaMin, horasTurno, diaSemana, horaEsperada, validarHorario } from './asistencia.calendario';

let fallos = 0;

function chk(etiqueta: string, esperado: any, real: any) {
    const ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(48)} esperado=${JSON.stringify(esperado)}  real=${JSON.stringify(real)}`);
}

function chkTira(etiqueta: string, fn: () => any) {
    try { fn(); fallos++; console.log(`FALLA  ${etiqueta.padEnd(48)} no lanzo error`); }
    catch { console.log(`OK    ${etiqueta.padEnd(48)} rechazado`); }
}

console.log('--- dia operativo (corte 05:00) ---');
chk('entrada 14-sep 18:00', '2026-09-14', diaOperativo('05:00:00', '2026-09-14 18:00:00'));
chk('salida 15-sep 01:30 = turno del 14', '2026-09-14', diaOperativo('05:00:00', '2026-09-15 01:30:00'));
chk('entrada 15-sep 06:00 = turno manana', '2026-09-15', diaOperativo('05:00:00', '2026-09-15 06:00:00'));
chk('borde exacto 15-sep 05:00', '2026-09-15', diaOperativo('05:00:00', '2026-09-15 05:00:00'));
chk('un segundo antes 04:59:59', '2026-09-14', diaOperativo('05:00:00', '2026-09-15 04:59:59'));
chk('corte 00:00 = fecha calendario', '2026-09-15', diaOperativo('00:00:00', '2026-09-15 01:30:00'));
chk('cruce de mes', '2026-08-31', diaOperativo('05:00:00', '2026-09-01 02:00:00'));
chk('acepta formato ISO con T', '2026-09-14', diaOperativo('05:00:00', '2026-09-15T01:30'));
chkTira('rechaza momento basura', () => diaOperativo('05:00:00', 'ayer por la tarde'));

console.log('\n--- tardanza (tolerancia 10) ---');
chk('llega 08:05 -> 0', 0, tardanzaMin('08:00', '2026-09-14 08:05:00', 10));
chk('llega 08:10 exacto -> 0', 0, tardanzaMin('08:00', '2026-09-14 08:10:00', 10));
chk('llega 08:25 -> 15', 15, tardanzaMin('08:00', '2026-09-14 08:25:00', 10));
chk('llega temprano 07:50 -> 0', 0, tardanzaMin('08:00', '2026-09-14 07:50:00', 10));
chk('sin horario -> null', null, tardanzaMin(null, '2026-09-14 08:25:00', 10));
chk('acepta HH:MM:SS', 15, tardanzaMin('08:00:00', '2026-09-14 08:25:00', 10));
chk('tolerancia 0', 25, tardanzaMin('08:00', '2026-09-14 08:25:00', 0));

console.log('\n--- horas del turno ---');
chk('08:00 -> 17:00', 9, horasTurno('2026-09-14 08:00:00', '2026-09-14 17:00:00'));
chk('18:00 -> 01:30 cruza medianoche', 7.5, horasTurno('2026-09-14 18:00:00', '2026-09-15 01:30:00'));
chk('18:00 -> 01:30 misma fecha (delta negativo)', 7.5, horasTurno('2026-09-14 18:00:00', '2026-09-14 01:30:00'));

console.log('\n--- horario semanal ---');
chk('2026-09-14 es lunes', 'lun', diaSemana('2026-09-14'));
chk('2026-09-20 es domingo', 'dom', diaSemana('2026-09-20'));

const h = { lun: { e: '08:00', s: '17:00' }, vie: { e: '18:00', s: '02:00' } };
chk('hora esperada del lunes', '08:00', horaEsperada(h, '2026-09-14'));
chk('martes no trabaja -> null', null, horaEsperada(h, '2026-09-15'));
chk('sin horario -> null', null, horaEsperada(null, '2026-09-14'));

chk('valida un horario correcto', h, validarHorario(h));
chk('acepta el horario como string', h, validarHorario(JSON.stringify(h)));
chk('objeto vacio -> null (sin horario)', null, validarHorario({}));
chk('null -> null', null, validarHorario(null));
chkTira('rechaza hora 25:00', () => validarHorario({ lun: { e: '25:00', s: '17:00' } }));
chkTira('rechaza dia "lunes"', () => validarHorario({ lunes: { e: '08:00', s: '17:00' } }));
chkTira('rechaza entrada = salida', () => validarHorario({ lun: { e: '08:00', s: '08:00' } }));
chkTira('rechaza tramo sin salida', () => validarHorario({ lun: { e: '08:00' } }));
chkTira('rechaza un array', () => validarHorario([1, 2, 3]));

console.log('\n' + (fallos ? `${fallos} FALLO(S)` : 'todo ok'));
process.exit(fallos ? 1 : 0);
