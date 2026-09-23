// Self-check de la verificacion por GPS.
//
//   npx ts-node src/services/asistencia.gps.test.ts
//
// Un error aca no se ve: la marca entra igual y recien se nota cuando alguien
// reclama que no lo dejo marcar estando adentro, o que marco desde su casa.

import { distanciaMetros, verificarUbicacion, PRECISION_MAX_M } from './asistencia.gps';

let fallos = 0;
function chk(etiqueta: string, esperado: any, real: any) {
    const ok = JSON.stringify(esperado) === JSON.stringify(real);
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(54)} esperado=${JSON.stringify(esperado)}  real=${JSON.stringify(real)}`);
}
const cerca = (etiqueta: string, esperado: number, real: number, tol: number) => {
    const ok = Math.abs(esperado - real) <= tol;
    if (!ok) { fallos++; }
    console.log(`${ok ? 'OK  ' : 'FALLA'}  ${etiqueta.padEnd(54)} ~${esperado} (±${tol})  real=${real}`);
};

// Moyobamba, que es donde estan varias de las sedes
const LOCAL = { lat: -6.0331, lng: -76.9747, radio_m: 150 };

console.log('--- distancia ---');
chk('mismo punto = 0 m', 0, distanciaMetros(LOCAL.lat, LOCAL.lng, LOCAL.lat, LOCAL.lng));

// 0.001 grados de latitud son ~111 m en cualquier parte del planeta
cerca('0.001 de latitud ~ 111 m', 111, distanciaMetros(-6.0331, -76.9747, -6.0341, -76.9747), 2);
// En longitud depende del coseno de la latitud: a -6 grados es casi lo mismo
cerca('0.001 de longitud a 6 grados sur ~ 110 m', 110, distanciaMetros(-6.0331, -76.9747, -6.0331, -76.9757), 3);
cerca('1 km', 1000, distanciaMetros(-6.0331, -76.9747, -6.0421, -76.9747), 15);

// Referencia conocida: Lima (Plaza de Armas) a Moyobamba, ~660 km en linea recta
cerca('Lima -> Moyobamba ~ 660 km', 660000, distanciaMetros(-12.0464, -77.0428, -6.0331, -76.9747), 20000);

// Simetrica: ir y volver da lo mismo
chk('la distancia es simetrica',
    distanciaMetros(-6.0331, -76.9747, -6.0421, -76.9847),
    distanciaMetros(-6.0421, -76.9847, -6.0331, -76.9747));

console.log('\n--- veredicto: adentro ---');
chk('parado justo en el punto', true, verificarUbicacion(LOCAL, { lat: -6.0331, lng: -76.9747, precision: 10 }).ok);
chk('a ~55 m con 10 m de error', true, verificarUbicacion(LOCAL, { lat: -6.03360, lng: -76.9747, precision: 10 }).ok);

// El margen: radio + precision. Adentro con GPS degradado por el techo.
const lejos = verificarUbicacion(LOCAL, { lat: -6.0349, lng: -76.9747, precision: 100 });
chk('a ~200 m pero con 100 m de error -> pasa', true, lejos.ok);
chk('...y reporta la distancia', true, lejos.distancia_m! > 180 && lejos.distancia_m! < 220);

console.log('\n--- veredicto: afuera ---');
const casa = verificarUbicacion(LOCAL, { lat: -6.0500, lng: -76.9900, precision: 10 });
chk('desde 2 km -> rechaza', false, casa.ok);
chk('el mensaje dice la distancia en km', true, /km del local/.test(casa.error));

const vereda = verificarUbicacion(LOCAL, { lat: -6.0360, lng: -76.9747, precision: 5 });
chk('a ~320 m con buen GPS -> rechaza', false, vereda.ok);
chk('el mensaje dice la distancia en m', true, / m del local/.test(vereda.error));

console.log('\n--- lecturas que no sirven ---');
chk('sin ubicacion -> rechaza', false, verificarUbicacion(LOCAL, null).ok);
chk('y pide activar el GPS', true, /Activa el GPS/.test(verificarUbicacion(LOCAL, null).error));
chk('coordenadas fuera de rango', false, verificarUbicacion(LOCAL, { lat: 200, lng: 0, precision: 5 }).ok);
chk('0,0 (el "isla nula") no vale', false, verificarUbicacion(LOCAL, { lat: 0, lng: 0, precision: 5 }).ok);
chk('NaN no vale', false, verificarUbicacion(LOCAL, { lat: NaN, lng: -76.97, precision: 5 }).ok);

// Este es el caso peligroso: sin tope, un error enorme autoriza cualquier cosa
const basura = verificarUbicacion(LOCAL, { lat: -6.0331, lng: -76.9747, precision: PRECISION_MAX_M + 1 });
chk('precision absurda -> rechaza aunque este encima', false, basura.ok);
chk('...y explica que salga al exterior', true, /exterior/.test(basura.error));

chk('precision nula se trata como 0', true, verificarUbicacion(LOCAL, { lat: -6.0331, lng: -76.9747, precision: null }).ok);
chk('precision negativa se ignora', true, verificarUbicacion(LOCAL, { lat: -6.0331, lng: -76.9747, precision: -5 }).ok);

console.log('\n--- el radio manda ---');
const chico = { lat: -6.0331, lng: -76.9747, radio_m: 30 };
chk('radio 30 m: a 55 m con GPS fino -> rechaza', false,
    verificarUbicacion(chico, { lat: -6.03360, lng: -76.9747, precision: 5 }).ok);
// El mismo punto que arriba se rechazaba con radio 150: esta a ~2.5 km
const LEJOS = { lat: -6.0500, lng: -76.9900, precision: 10 };
cerca('el punto "casa" esta a ~2.5 km', 2500, distanciaMetros(LOCAL.lat, LOCAL.lng, LEJOS.lat, LEJOS.lng), 100);

chk('radio 2000: a 2.5 km sigue rechazando', false,
    verificarUbicacion({ lat: -6.0331, lng: -76.9747, radio_m: 2000 }, LEJOS).ok);
chk('radio al maximo (2 km) no tapa cualquier distancia', false,
    verificarUbicacion({ lat: -6.0331, lng: -76.9747, radio_m: 2000 }, { ...LEJOS, precision: 400 }).ok);
chk('a 2.5 km con radio suficiente -> pasa', true,
    verificarUbicacion({ lat: -6.0331, lng: -76.9747, radio_m: 3000 }, LEJOS).ok);

console.log('\n' + (fallos ? `${fallos} FALLO(S)` : 'todo ok'));
process.exit(fallos ? 1 : 0);
