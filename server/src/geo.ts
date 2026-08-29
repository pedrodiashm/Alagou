/**
 * Módulo de utilitários geoespaciais e geodésicos para o Sistema Distribuído Alagou.
 * Implementa a fórmula de Haversine para cálculo de distâncias relativas entre nós móveis e eventos.
 */

const EARTH_RADIUS_METERS = 6371000; // Raio médio da Terra em metros

/**
 * Calcula a distância em metros entre duas coordenadas geográficas (Latitude/Longitude)
 * usando a fórmula de Haversine.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Formata a distância em metros para uma representação amigável ao usuário
 * Ex: 450 -> "450m", 1200 -> "1.2 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Verifica se um ponto geográfico está dentro de um determinado raio de busca (em metros)
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) <= radiusMeters;
}
