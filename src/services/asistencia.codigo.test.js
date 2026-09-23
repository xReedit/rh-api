"use strict";
// Self-check del codigo rotativo del kiosko y de la hora de Lima.
//
//   npx ts-node src/services/asistencia.codigo.test.ts
exports.__esModule = true;
var asistencia_codigo_1 = require("./asistencia.codigo");
var asistencia_calendario_1 = require("./asistencia.calendario");
var fallos = 0;
function chk(etiqueta, esperado, real) {
    var ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) {
        fallos++;
    }
    console.log("".concat(ok ? 'OK  ' : 'FALLA', "  ").concat(etiqueta.padEnd(52), " esperado=").concat(JSON.stringify(esperado), "  real=").concat(JSON.stringify(real)));
}
var HASH = 'a'.repeat(64);
var OTRO = 'b'.repeat(64);
console.log('--- codigo rotativo ---');
var v = (0, asistencia_codigo_1.ventanaActual)();
var cod = (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v);
chk('el codigo mide 10 hex', true, /^[0-9a-f]{10}$/.test(cod));
chk('mismo kiosko y ventana -> mismo codigo', cod, (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v));
chk('otra ventana -> otro codigo', false, cod === (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v + 1));
chk('otro kiosko -> otro codigo', false, cod === (0, asistencia_codigo_1.calcularCodigo)(HASH, 8, v));
chk('otro token -> otro codigo', false, cod === (0, asistencia_codigo_1.calcularCodigo)(OTRO, 7, v));
chk('acepta el codigo de ahora', true, (0, asistencia_codigo_1.codigoValido)(HASH, 7, cod));
chk('acepta el de la ventana anterior (scan lento)', true, (0, asistencia_codigo_1.codigoValido)(HASH, 7, (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v - 1)));
chk('RECHAZA el de hace 2 ventanas', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v - 2)));
chk('RECHAZA uno del futuro', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, (0, asistencia_codigo_1.calcularCodigo)(HASH, 7, v + 1)));
chk('RECHAZA el codigo de otro kiosko', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, (0, asistencia_codigo_1.calcularCodigo)(HASH, 8, v)));
chk('RECHAZA basura', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, 'aaaaaaaaaa'));
chk('RECHAZA largo distinto', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, 'abc'));
chk('RECHAZA vacio', false, (0, asistencia_codigo_1.codigoValido)(HASH, 7, ''));
// La ventana dura 15 s: el QR rota cuatro veces por minuto.
chk('ventana de 15 s', 15, asistencia_codigo_1.VENTANA_SEG);
var t0 = Date.UTC(2026, 8, 21, 10, 0, 0);
chk('al inicio quedan 15 s', 15, (0, asistencia_codigo_1.segundosRestantes)(t0));
chk('a los 14 s queda 1', 1, (0, asistencia_codigo_1.segundosRestantes)(t0 + 14000));
chk('a los 15 s arranca otra ventana', (0, asistencia_codigo_1.ventanaActual)(t0) + 1, (0, asistencia_codigo_1.ventanaActual)(t0 + 15000));
// El techo real de vida del codigo: ventana + tolerancia
chk('un codigo no vive mas de 30 s', 30, asistencia_codigo_1.VENTANA_SEG * 2);
console.log('\n--- hora de Lima ---');
// Lima es UTC-5 todo el ano (no tiene horario de verano)
chk('UTC 03:00 del 15 -> Lima 22:00 del 14', '2026-09-14 22:00:00', (0, asistencia_calendario_1.ahoraLima)(new Date('2026-09-15T03:00:00Z')));
chk('UTC 12:00 -> Lima 07:00', '2026-09-14 07:00:00', (0, asistencia_calendario_1.ahoraLima)(new Date('2026-09-14T12:00:00Z')));
chk('medianoche de Lima sale 00, no 24', '2026-09-14 00:00:00', (0, asistencia_calendario_1.ahoraLima)(new Date('2026-09-14T05:00:00Z')));
// El caso que motiva todo esto: una entrada de las 20:00 en Lima no debe
// quedar registrada al dia siguiente por culpa del UTC del servidor.
var nocheLima = (0, asistencia_calendario_1.ahoraLima)(new Date('2026-09-15T01:00:00Z')); // 20:00 del 14
chk('entrada de las 20:00 sigue siendo del 14', '2026-09-14', (0, asistencia_calendario_1.diaOperativo)('05:00:00', nocheLima));
console.log('\n--- fechaSql: lo que se guarda es la hora de Lima ---');
chk('conserva los digitos exactos', '2026-09-14T18:30:00.000Z', (0, asistencia_calendario_1.fechaSql)('2026-09-14 18:30:00').toISOString());
chk('ida y vuelta', '2026-09-14 18:30:00', (0, asistencia_calendario_1.fechaSql)('2026-09-14 18:30:00').toISOString().slice(0, 19).replace('T', ' '));
console.log('\n' + (fallos ? "".concat(fallos, " FALLO(S)") : 'todo ok'));
process.exit(fallos ? 1 : 0);
