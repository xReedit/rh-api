// Self-check de las horas extra. Sin framework: se corre a mano.
//
//   npx ts-node src/services/asistencia.sobretiempo.test.ts
//
// Si algo aqui falla, se le paga de menos o de mas a alguien.

import {
    minutosTrabajados, sobretiempoDelDia, sumarSobretiempo, minutosATexto,
    PCT_PRIMERAS, PCT_SIGUIENTES
} from './asistencia.sobretiempo';

let fallos = 0;

function chk(etiqueta: string, esperado: any, real: any) {
    const ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(54)} esperado=${JSON.stringify(esperado)}  real=${JSON.stringify(real)}`);
}

const m = (tipo: string, hora: string) => ({ tipo, marcada_at: `2026-09-14 ${hora}:00` });

// ---------------------------------------------------------------------------
console.log('--- minutos trabajados ---');

chk('turno corrido 08:00-17:00 = 9 h', 540,
    minutosTrabajados([m('ENTRADA', '08:00'), m('SALIDA', '17:00')]));

// El punto del break: el hueco del medio NO se cuenta.
chk('con break 11-15 y 18-23 = 9 h, no 12', 540,
    minutosTrabajados([m('ENTRADA', '11:00'), m('SALIDA', '15:00'),
                       m('ENTRADA', '18:00'), m('SALIDA', '23:00')]));

chk('cruza medianoche 18:00-02:00 = 8 h', 480,
    minutosTrabajados([m('ENTRADA', '18:00'), m('SALIDA', '02:00')]));

chk('entrada sin salida no se cuenta', 0, minutosTrabajados([m('ENTRADA', '08:00')]));
chk('salida sin entrada no se cuenta', 0, minutosTrabajados([m('SALIDA', '17:00')]));
chk('sin marcas', 0, minutosTrabajados([]));

// Una entrada repetida por error no puede acortar el turno.
chk('dos entradas seguidas: vale la primera', 540,
    minutosTrabajados([m('ENTRADA', '08:00'), m('ENTRADA', '08:03'), m('SALIDA', '17:00')]));

// ---------------------------------------------------------------------------
console.log('\n--- sobretiempo de un dia ---');

// Un minuto vale 1: asi los importes se leen como minutos y la cuenta se ve.
const V = 1;

chk('trabajo justo su jornada -> nada', 0, sobretiempoDelDia(480, 480, 15, V).minutos);
chk('10 min de mas, umbral 15 -> nada', 0, sobretiempoDelDia(490, 480, 15, V).minutos);
chk('15 min exactos -> todavia nada', 0, sobretiempoDelDia(495, 480, 15, V).minutos);
chk('16 min -> cuentan los 16, no 1', 16, sobretiempoDelDia(496, 480, 15, V).minutos);

// 1 h extra: toda al 25%
const unaHora = sobretiempoDelDia(540, 480, 15, V);
chk('1 h extra: 60 min al 25%', 60, unaHora.min_25);
chk('   y nada al 35%', 0, unaHora.min_35);
chk('   importe = 60 * 1.25', 75, unaHora.importe);

// 3 h extra: 2 al 25% y 1 al 35%
const tresHoras = sobretiempoDelDia(660, 480, 15, V);
chk('3 h extra: 120 min al 25%', 120, tresHoras.min_25);
chk('   y 60 min al 35%', 60, tresHoras.min_35);
chk('   importe = 120*1.25 + 60*1.35', 231, tresHoras.importe);

chk('trabajo de menos -> no hay sobretiempo', 0, sobretiempoDelDia(400, 480, 15, V).minutos);
chk('sin horario cargado -> no se inventa', 0, sobretiempoDelDia(600, 0, 15, V).minutos);
chk('no marco -> nada', 0, sobretiempoDelDia(0, 480, 15, V).minutos);
chk('umbral 0: un minuto ya cuenta', 1, sobretiempoDelDia(481, 480, 0, V).minutos);

// Los porcentajes son el piso que fija la norma.
chk('el recargo de las 2 primeras es 25', 25, PCT_PRIMERAS);
chk('el de las siguientes es 35', 35, PCT_SIGUIENTES);

// ---------------------------------------------------------------------------
console.log('\n--- suma del periodo ---');

// Tres dias de 3 h extra cada uno. Lo que NO puede pasar es que el tramo del
// 25% se agote el primer dia y los otros dos vayan enteros al 35%.
const tres = sumarSobretiempo([tresHoras, tresHoras, tresHoras]);
chk('3 dias x 3 h: 360 min al 25%', 360, tres.min_25);
chk('   y 180 al 35%', 180, tres.min_35);
chk('   el tramo del 25% se reinicia cada dia', 693, tres.importe);

chk('sumar nada da cero', 0, sumarSobretiempo([]).importe);

// ---------------------------------------------------------------------------
console.log('\n--- texto ---');
chk('0', '0 min', minutosATexto(0));
chk('45', '45 min', minutosATexto(45));
chk('60', '1 h', minutosATexto(60));
chk('150', '2 h 30 min', minutosATexto(150));


// ---------------------------------------------------------------------------
console.log('\n--- redondeo ---');

// El caso que lo destapo: 12.50 la hora, 3 h extra por dia = 48.125 exactos.
// Redondeando cada dia (48.13) dos dias dan 96.26; redondeando al final, 96.25.
// Con veinte dias la diferencia deja de ser un centimo.
const vMin = 12.5 / 60;
const dia48 = sobretiempoDelDia(660, 480, 15, vMin);
chk('el dia NO viene redondeado', 48.125, dia48.importe);
chk('dos dias redondean una sola vez', 96.25, sumarSobretiempo([dia48, dia48]).importe);
chk('veinte dias no acumulan error', 962.5, sumarSobretiempo(Array(20).fill(dia48)).importe);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\ntodo ok');
process.exit(fallos ? 1 : 0);
