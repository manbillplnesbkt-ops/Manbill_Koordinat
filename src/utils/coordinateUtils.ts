export interface ParsedCoordinate {
  lat: number | null;
  lng: number | null;
  isValid: boolean;
  errorReason?: string;
}

/**
 * Parses a raw Latitude or Longitude value (string or number).
 * Handles comma decimals (e.g. "-0,30512" -> -0.30512), spaces, and null values.
 */
export function parseSingleCoord(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }

  const str = String(val).trim();
  if (!str || str === "-" || str.toLowerCase() === "null" || str.toLowerCase() === "nan") {
    return null;
  }

  // Replace comma with dot if it looks like a decimal comma (e.g. -0,3055 or 100,3692)
  // Be careful if there are multiple dots or commas
  const normalized = str.replace(/,/g, ".").replace(/\s+/g, "");
  const num = Number(normalized);

  if (!Number.isFinite(num)) {
    return null;
  }
  return num;
}

/**
 * Validates and normalizes a pair of Latitude and Longitude values.
 * Latitude must be in [-90, 90], Longitude in [-180, 180].
 * Also treats (0, 0) as invalid/empty unless explicitly valid, as 0,0 is in the Atlantic Ocean.
 */
export function parseAndValidateCoordinates(
  rawLat: unknown,
  rawLng: unknown
): ParsedCoordinate {
  const strLat = rawLat !== null && rawLat !== undefined ? String(rawLat).trim() : "";
  const strLng = rawLng !== null && rawLng !== undefined ? String(rawLng).trim() : "";

  if (!strLat && !strLng) {
    return {
      lat: null,
      lng: null,
      isValid: false,
      errorReason: "Koordinat kosong"
    };
  }

  const lat = parseSingleCoord(rawLat);
  const lng = parseSingleCoord(rawLng);

  if (lat === null) {
    return {
      lat: null,
      lng,
      isValid: false,
      errorReason: "Latitude tidak valid"
    };
  }

  if (lng === null) {
    return {
      lat,
      lng: null,
      isValid: false,
      errorReason: "Longitude tidak valid"
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      lat,
      lng,
      isValid: false,
      errorReason: `Latitude di luar rentang -90 s/d 90 (${lat})`
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      lat,
      lng,
      isValid: false,
      errorReason: `Longitude di luar rentang -180 s/d 180 (${lng})`
    };
  }

  if (lat === 0 && lng === 0) {
    return {
      lat: null,
      lng: null,
      isValid: false,
      errorReason: "Koordinat 0,0 tidak valid"
    };
  }

  return {
    lat,
    lng,
    isValid: true
  };
}

/**
 * Formats coordinate to fixed 6 decimal places cleanly.
 */
export function formatCoordinate(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return "-";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Builds external Google Maps URL for a given latitude and longitude.
 */
export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Calculates the distance in meters between two coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance in meters into a clean string (e.g. "12.4 m" or "1,245 m").
 */
export function formatDistanceMeters(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return "-";
  if (meters < 10) {
    return `${meters.toFixed(1)} m`;
  }
  return `${Math.round(meters).toLocaleString("id-ID")} m`;
}
