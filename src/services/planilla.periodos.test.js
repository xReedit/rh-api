"use strict";
// Self-check de los periodos de planilla.
//
//   npx ts-node src/services/planilla.periodos.test.ts
//
// Un error de un dia aca no se ve en pantalla: se ve cuando alguien cobra un
// dia de mas o de menos. Los casos que se prueban son los que rompen las
// cuentas de calendario: febrero, meses de 31, semanas que cruzan de mes y de
// ano, y el dia de inicio de semana que no es lunes.
exports.__esModule = true;
var planilla_periodos_1 = require("./planilla.periodos");
var fallos = 0;
function chk(etiqueta, esperado, real) {
    var ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) {
        fallos++;
    }
    console.log("".concat(ok ? 'OK  ' : 'FALLA', "  ").concat(etiqueta.padEnd(56), " esperado=").concat(JSON.stringify(esperado), "  real=").concat(JSON.stringify(real)));
}
var rango = function (p) { return "".concat(p.desde, "..").concat(p.hasta); };
console.log('--- mensual ---');
chk('un dia cualquiera de marzo', '2026-03-01..2026-03-31', rango((0, planilla_periodos_1.periodoDe)('2026-03-17', 'MENSUAL')));
chk('la clave es el primer dia', '2026-03-01', (0, planilla_periodos_1.periodoDe)('2026-03-17', 'MENSUAL').clave);
chk('febrero de ano comun', '2026-02-01..2026-02-28', rango((0, planilla_periodos_1.periodoDe)('2026-02-10', 'MENSUAL')));
chk('febrero bisiesto', '2028-02-01..2028-02-29', rango((0, planilla_periodos_1.periodoDe)('2028-02-10', 'MENSUAL')));
chk('etiqueta legible', 'marzo 2026', (0, planilla_periodos_1.periodoDe)('2026-03-17', 'MENSUAL').etiqueta);
console.log('\n--- quincenal ---');
chk('el 10 cae en la primera', '2026-03-01..2026-03-15', rango((0, planilla_periodos_1.periodoDe)('2026-03-10', 'QUINCENAL')));
chk('el 15 tambien', '2026-03-01..2026-03-15', rango((0, planilla_periodos_1.periodoDe)('2026-03-15', 'QUINCENAL')));
chk('el 16 arranca la segunda', '2026-03-16..2026-03-31', rango((0, planilla_periodos_1.periodoDe)('2026-03-16', 'QUINCENAL')));
// El 31 es el caso que se pierde si se corta la quincena "el 30"
chk('el 31 esta dentro', '2026-03-16..2026-03-31', rango((0, planilla_periodos_1.periodoDe)('2026-03-31', 'QUINCENAL')));
chk('en febrero la segunda termina el 28', '2026-02-16..2026-02-28', rango((0, planilla_periodos_1.periodoDe)('2026-02-20', 'QUINCENAL')));
chk('y en bisiesto el 29', '2028-02-16..2028-02-29', rango((0, planilla_periodos_1.periodoDe)('2028-02-20', 'QUINCENAL')));
chk('etiqueta de la primera', '1ra quincena de marzo 2026', (0, planilla_periodos_1.periodoDe)('2026-03-10', 'QUINCENAL').etiqueta);
chk('etiqueta de la segunda', '2da quincena de marzo 2026', (0, planilla_periodos_1.periodoDe)('2026-03-20', 'QUINCENAL').etiqueta);
// Ningun dia del mes queda fuera de alguna quincena
var cubiertos = 0;
for (var d = 1; d <= 31; d++) {
    var f = "2026-03-".concat(String(d).padStart(2, '0'));
    var p = (0, planilla_periodos_1.periodoDe)(f, 'QUINCENAL');
    if (f >= p.desde && f <= p.hasta) {
        cubiertos++;
    }
}
chk('los 31 dias caen en una quincena', 31, cubiertos);
console.log('\n--- semanal ---');
// 2026-03-09 es lunes
chk('lunes: arranca ese mismo dia', '2026-03-09..2026-03-15', rango((0, planilla_periodos_1.periodoDe)('2026-03-09', 'SEMANAL')));
chk('miercoles: vuelve al lunes', '2026-03-09..2026-03-15', rango((0, planilla_periodos_1.periodoDe)('2026-03-11', 'SEMANAL')));
chk('domingo: cierra esa semana', '2026-03-09..2026-03-15', rango((0, planilla_periodos_1.periodoDe)('2026-03-15', 'SEMANAL')));
chk('el lunes siguiente ya es otra', '2026-03-16..2026-03-22', rango((0, planilla_periodos_1.periodoDe)('2026-03-16', 'SEMANAL')));
// El local que paga los viernes: la semana va de viernes a jueves
chk('semana que empieza el viernes', '2026-03-13..2026-03-19', rango((0, planilla_periodos_1.periodoDe)('2026-03-16', 'SEMANAL', 5)));
chk('...el propio viernes', '2026-03-13..2026-03-19', rango((0, planilla_periodos_1.periodoDe)('2026-03-13', 'SEMANAL', 5)));
chk('...y el jueves la cierra', '2026-03-13..2026-03-19', rango((0, planilla_periodos_1.periodoDe)('2026-03-19', 'SEMANAL', 5)));
chk('el viernes siguiente abre otra', '2026-03-20..2026-03-26', rango((0, planilla_periodos_1.periodoDe)('2026-03-20', 'SEMANAL', 5)));
// Una semana puede cruzar de mes y de ano: es donde se rompen las cuentas
chk('semana a caballo entre meses', '2026-03-30..2026-04-05', rango((0, planilla_periodos_1.periodoDe)('2026-04-01', 'SEMANAL')));
chk('semana a caballo entre anos', '2025-12-29..2026-01-04', rango((0, planilla_periodos_1.periodoDe)('2026-01-01', 'SEMANAL')));
chk('etiqueta cuando cruza de mes', '30 de marzo al 5 de abril', (0, planilla_periodos_1.periodoDe)('2026-04-01', 'SEMANAL').etiqueta);
chk('etiqueta dentro del mes', '9 al 15 de marzo', (0, planilla_periodos_1.periodoDe)('2026-03-11', 'SEMANAL').etiqueta);
// Toda semana dura exactamente 7 dias, arranque el dia que arranque
var malas = 0;
for (var inicio = 1; inicio <= 7; inicio++) {
    for (var d = 1; d <= 28; d++) {
        var p = (0, planilla_periodos_1.periodoDe)("2026-03-".concat(String(d).padStart(2, '0')), 'SEMANAL', inicio);
        var dias = (Date.parse(p.hasta) - Date.parse(p.desde)) / 86400000 + 1;
        if (dias !== 7) {
            malas++;
        }
    }
}
chk('toda semana dura 7 dias', 0, malas);
console.log('\n--- diario ---');
chk('un dia es su propio periodo', '2026-03-17..2026-03-17', rango((0, planilla_periodos_1.periodoDe)('2026-03-17', 'DIARIO')));
chk('...con etiqueta legible', '17 de marzo 2026', (0, planilla_periodos_1.periodoDe)('2026-03-17', 'DIARIO').etiqueta);
console.log('\n--- la clave tiene que ser el primer dia ---');
chk('clave valida', '2026-03-01..2026-03-31', rango((0, planilla_periodos_1.periodoPorClave)('2026-03-01', 'MENSUAL')));
// Mandar el 17 como clave es un error de quien llama: devolver el periodo que
// lo contiene taparia el error y la boleta saldria de otro rango.
chk('una fecha que no abre periodo se rechaza', null, (0, planilla_periodos_1.periodoPorClave)('2026-03-17', 'MENSUAL'));
chk('...tambien en semanal', null, (0, planilla_periodos_1.periodoPorClave)('2026-03-11', 'SEMANAL'));
chk('...y la buena pasa', '2026-03-09', (0, planilla_periodos_1.periodoPorClave)('2026-03-09', 'SEMANAL').clave);
chk('basura se rechaza', null, (0, planilla_periodos_1.periodoPorClave)('marzo', 'MENSUAL'));
console.log('\n--- listados ---');
var doceMeses = (0, planilla_periodos_1.ultimosPeriodos)('2026-03-17', 'MENSUAL');
chk('trae doce', 12, doceMeses.length);
chk('el primero es el actual', '2026-03-01', doceMeses[0].clave);
chk('el ultimo es un ano atras', '2025-04-01', doceMeses[11].clave);
chk('van del mas nuevo al mas viejo', true, doceMeses[0].clave > doceMeses[1].clave);
var semanas = (0, planilla_periodos_1.ultimosPeriodos)('2026-01-05', 'SEMANAL', 1, 3);
chk('las semanas retroceden bien de ano', ['2026-01-05', '2025-12-29', '2025-12-22'], semanas.map(function (p) { return p.clave; }));
var delMes = (0, planilla_periodos_1.periodosEntre)('2026-03-01', '2026-03-31', 'SEMANAL');
chk('marzo toca 6 semanas', 6, delMes.length);
chk('...la primera empieza en febrero', '2026-02-23', delMes[delMes.length - 1].desde);
chk('...y la ultima termina en abril', '2026-04-05', delMes[0].hasta);
chk('un dia solo da un periodo mensual', 1, (0, planilla_periodos_1.periodosEntre)('2026-03-10', '2026-03-10', 'MENSUAL').length);
chk('el ano entero en diario no explota', true, (0, planilla_periodos_1.periodosEntre)('2026-01-01', '2026-12-31', 'DIARIO').length > 300);
console.log('\n--- entradas invalidas ---');
chk('frecuencia desconocida cae en mensual', 'MENSUAL', (0, planilla_periodos_1.normalizarFrecuencia)('SEMESTRAL'));
chk('vacia tambien', 'MENSUAL', (0, planilla_periodos_1.normalizarFrecuencia)(''));
chk('minuscula se acepta', 'SEMANAL', (0, planilla_periodos_1.normalizarFrecuencia)('semanal'));
chk('dia de semana fuera de rango cae en lunes', 1, (0, planilla_periodos_1.normalizarInicioSemana)(9));
chk('...y el 0 tambien', 1, (0, planilla_periodos_1.normalizarInicioSemana)(0));
chk('el domingo es valido', 7, (0, planilla_periodos_1.normalizarInicioSemana)(7));
console.log('\n' + (fallos ? "".concat(fallos, " FALLO(S)") : 'todo ok'));
process.exit(fallos ? 1 : 0);
