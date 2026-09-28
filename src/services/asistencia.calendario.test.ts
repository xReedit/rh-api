// Self-check del calendario de asistencia. Sin framework: se corre a mano.
//
//   npx ts-node src/services/asistencia.calendario.test.ts
//
// Si algo aqui falla, las tardanzas y las horas de la planilla salen mal.

import { diaOperativo, tardanzaMin, horasTurno, diaSemana, horaEsperada, validarHorario,
         tramosDe, horasJornada, indexarMarcas } from './asistencia.calendario';

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

// Guardar normaliza a LISTA de tramos, venga como venga. Por eso lo esperado
// ya no es `h` tal cual: es `h` con cada dia envuelto en una lista.
const hNorm = { lun: [{ e: '08:00', s: '17:00' }], vie: [{ e: '18:00', s: '02:00' }] };
chk('valida y normaliza a lista', hNorm, validarHorario(h));
chk('acepta el horario como string', hNorm, validarHorario(JSON.stringify(h)));
chk('objeto vacio -> null (sin horario)', null, validarHorario({}));
chk('null -> null', null, validarHorario(null));
chkTira('rechaza hora 25:00', () => validarHorario({ lun: { e: '25:00', s: '17:00' } }));
chkTira('rechaza dia "lunes"', () => validarHorario({ lunes: { e: '08:00', s: '17:00' } }));
chkTira('rechaza entrada = salida', () => validarHorario({ lun: { e: '08:00', s: '08:00' } }));
chkTira('rechaza tramo sin salida', () => validarHorario({ lun: { e: '08:00' } }));
chkTira('rechaza un array', () => validarHorario([1, 2, 3]));


// ---------------------------------------------------------------------------
// Turno partido
//
// Es el turno normal de un restaurante: mediodia y noche, con el trabajador en
// su casa en el medio. Antes no se podia escribir y habia que cargarlo
// corrido, lo que contaba como trabajadas las horas del hueco.
// ---------------------------------------------------------------------------

const partido = { lun: [{ e: '11:00', s: '15:00' }, { e: '18:00', s: '23:00' }] };

chk('turno partido: dos tramos el lunes', 2, tramosDe(partido, '2026-09-14').length);
chk('turno partido: 9 h, no 12', 9, horasJornada(partido, '2026-09-14'));
chk('turno corrido: 9 h', 9, horasJornada(h, '2026-09-14'));
chk('cruza medianoche: 18:00-02:00 son 8 h', 8, horasJornada(h, '2026-09-18'));
chk('dia sin tramos: 0 h', 0, horasJornada(partido, '2026-09-15'));

// La forma vieja tiene que seguir leyendose: hay horarios guardados asi.
chk('lee la forma vieja como lista', [{ e: '08:00', s: '17:00' }], tramosDe(h, '2026-09-14'));

// Contra que entrada se mide la tardanza
chk('sin la hora marcada -> la primera entrada', '11:00', horaEsperada(partido, '2026-09-14'));
chk('marca 11:05 -> se mide contra 11:00', '11:00',
    horaEsperada(partido, '2026-09-14', '2026-09-14 11:05:00'));
chk('marca 18:04 -> se mide contra 18:00, no contra 11:00', '18:00',
    horaEsperada(partido, '2026-09-14', '2026-09-14 18:04:00'));
chk('marca 17:30 (temprano al 2do) -> 18:00', '18:00',
    horaEsperada(partido, '2026-09-14', '2026-09-14 17:30:00'));

// El caso que motivo todo: sin elegir tramo, entrar a las 18:00 daba 7 h tarde.
chk('tardanza del 2do tramo con el tramo correcto', 4,
    tardanzaMin(horaEsperada(partido, '2026-09-14', '2026-09-14 18:04:00'), '2026-09-14 18:04:00', 0));
chk('...y con la primera entrada habrian sido 424 min', 424,
    tardanzaMin('11:00', '2026-09-14 18:04:00', 0));

// Validacion
chk('valida un turno partido', partido, validarHorario(partido));
chkTira('rechaza tramos que se pisan',
    () => validarHorario({ lun: [{ e: '11:00', s: '16:00' }, { e: '15:00', s: '23:00' }] }));
chkTira('rechaza mas de 4 tramos', () => validarHorario({
    lun: [{ e: '06:00', s: '07:00' }, { e: '08:00', s: '09:00' },
          { e: '10:00', s: '11:00' }, { e: '12:00', s: '13:00' }, { e: '14:00', s: '15:00' }]
}));
chkTira('solo el ultimo tramo puede cruzar la medianoche',
    () => validarHorario({ lun: [{ e: '22:00', s: '02:00' }, { e: '10:00', s: '12:00' }] }));


// ---------------------------------------------------------------------------
// Armado del dia a partir de las marcas
//
// Antes esto era `idx[m.tipo] = m`, que se queda con la ULTIMA de cada tipo.
// Con turno partido eso perdia la entrada del mediodia y su tardanza.
// ---------------------------------------------------------------------------

const m = (tipo: string, hora: string, tard = 0) =>
    ({ idcolaborador: 1, tipo, marcada_at: `2026-09-14 ${hora}:00`, tardanza_min: tard });

const dia = indexarMarcas(
    [m('ENTRADA', '11:05', 5), m('SALIDA', '15:00'), m('ENTRADA', '18:04', 4), m('SALIDA', '23:10')],
    () => '2026-09-14'
).get('1|2026-09-14')!;

chk('la ENTRADA del dia es la PRIMERA', '2026-09-14 11:05:00', dia.ENTRADA.marcada_at);
chk('la SALIDA del dia es la ULTIMA', '2026-09-14 23:10:00', dia.SALIDA.marcada_at);
chk('guarda las dos entradas', 2, dia.entradas.length);
chk('la tardanza del dia es la suma', 9, dia.tardanza_min);

// Turno corrido: tiene que dar exactamente lo de siempre.
const corrido = indexarMarcas([m('ENTRADA', '08:10', 0), m('SALIDA', '17:00')], () => '2026-09-14')
    .get('1|2026-09-14')!;
chk('turno corrido: una entrada', '2026-09-14 08:10:00', corrido.ENTRADA.marcada_at);
chk('turno corrido: sin tardanza', 0, corrido.tardanza_min);

// Solo salidas (se olvido de marcar la entrada): no debe romper.
const soloSalida = indexarMarcas([m('SALIDA', '17:00')], () => '2026-09-14').get('1|2026-09-14')!;
chk('sin entrada -> ENTRADA null', null, soloSalida.ENTRADA);
chk('sin entrada -> tardanza 0', 0, soloSalida.tardanza_min);

console.log('\n' + (fallos ? `${fallos} FALLO(S)` : 'todo ok'));
process.exit(fallos ? 1 : 0);
