// SaveBites V3 — Distance / haversine util

const EARTH_RADIUS_METERS = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points in meters.
 * Used for: discovery radius filter, "X.X km away" labels.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function metersToKm(m: number, digits = 1): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(digits)} km`;
}

/**
 * Bounding box ~ a square radius around a point. Fast pre-filter for SQL.
 * Approximation: 1 deg lat ≈ 111 km; 1 deg lng varies with latitude.
 */
export function boundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusMeters / 111_000;
  const dLng = radiusMeters / (111_000 * Math.cos(toRad(center.lat)));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}
