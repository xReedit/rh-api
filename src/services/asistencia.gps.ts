// Verificacion de ubicacion al marcar asistencia.
//
// Responde una sola pregunta: el celular que esta marcando, esta cerca del
// local? Es la defensa contra el caso que el QR rotativo no cubre del todo:
// un companero fotografia el codigo y se lo manda al que todavia viene en
// camino. El codigo dura poco, pero si llega a tiempo la marca entra igual.
// Con GPS, ademas hay que estar ahi.

/** Radio de la Tierra en metros (media, suficiente para distancias de barrio). */
const R = 6371000;

const rad = (g: number) => (g * Math.PI) / 180;

/**
 * Distancia en metros entre dos puntos (haversine).
 *
 * Para los cientos de metros que importan aca, haversine sobra: el error por
 * suponer la Tierra esferica es de centimetros. Formulas mas exactas
 * (Vincenty) solo agregan casos borde que fallan cerca de las antipodas.
 */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Lectura que manda el celular. */
export interface Ubicacion {
    lat: number;
    lng: number;
    precision: number | null;   // metros de error que reporta el navegador
}

export interface Local {
    lat: number;
    lng: number;
    radio_m: number;
}

/** Una lectura con mas de esto de error no dice nada util y no se acepta. */
export const PRECISION_MAX_M = 1000;

export interface Veredicto {
    ok: boolean;
    distancia_m: number | null;
    error: string;
}

/**
 * Decide si esa lectura vale como "esta en el local".
 *
 * Al radio se le suma la precision que informa el navegador. Suena permisivo y
 * es a proposito: dentro de un local con techo el GPS se degrada a wifi y da
 * errores de 50-100 m. Sin ese margen, el sistema rechazaria a gente que SI
 * esta adentro, que es peor que dejar pasar a alguien parado en la vereda de
 * enfrente. El tope de PRECISION_MAX_M evita que una lectura inutil (varios
 * kilometros de error) autorice cualquier cosa.
 */
export function verificarUbicacion(local: Local, u: Ubicacion | null): Veredicto {
    if (!u || !isFinite(u.lat) || !isFinite(u.lng)) {
        return { ok: false, distancia_m: null, error: 'Necesitamos tu ubicacion para marcar. Activa el GPS y permite el acceso.' };
    }
    if (u.lat < -90 || u.lat > 90 || u.lng < -180 || u.lng > 180 || (u.lat === 0 && u.lng === 0)) {
        return { ok: false, distancia_m: null, error: 'La ubicacion que envio tu celular no es valida.' };
    }

    const precision = (u.precision !== null && isFinite(u.precision) && u.precision > 0) ? u.precision : 0;
    if (precision > PRECISION_MAX_M) {
        return { ok: false, distancia_m: null, error: 'Tu celular no logra ubicarte con precision. Sal un momento al exterior y vuelve a intentar.' };
    }

    const d = distanciaMetros(local.lat, local.lng, u.lat, u.lng);
    const margen = local.radio_m + precision;

    if (d > margen) {
        return {
            ok: false,
            distancia_m: d,
            error: `Estas a ${d < 1000 ? d + ' m' : (d / 1000).toFixed(1) + ' km'} del local. Solo se puede marcar desde el local.`
        };
    }
    return { ok: true, distancia_m: d, error: '' };
}
