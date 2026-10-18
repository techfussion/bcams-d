/**
 * BCAMS Geolocation & Geofence Service
 * 
 * Secure desktop/web geolocation capture with strict permissions and error reporting.
 * Real coordinates capture, no fallbacks, Haversine distance validation against institutional policy.
 */
import type { GeoLocation, Policy, PolicyGeofenceValue } from '@/types';

export interface LocationCaptureResult {
  success: boolean;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  error?: {
    code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'UNKNOWN';
    message: string;
  };
}

export async function captureCurrentCoordinates(): Promise<LocationCaptureResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      error: {
        code: 'NOT_SUPPORTED',
        message: 'Geolocation API is unavailable in this environment.',
      },
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          success: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (error) => {
        let code: NonNullable<LocationCaptureResult['error']>['code'] = 'UNKNOWN';
        let message = error.message || 'Failed to capture geolocation.';

        switch (error.code) {
          case 1: // PERMISSION_DENIED
            code = 'PERMISSION_DENIED';
            message = 'Location access was denied. Please grant location permissions in your system settings.';
            break;
          case 2: // POSITION_UNAVAILABLE
            code = 'POSITION_UNAVAILABLE';
            message = 'Current location coordinates could not be determined by device hardware.';
            break;
          case 3: // TIMEOUT
            code = 'TIMEOUT';
            message = 'Location request timed out. Please check device connectivity and retry.';
            break;
        }

        resolve({
          success: false,
          error: { code, message },
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Calculates Haversine distance in metres between two geographic coordinates
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validates a coordinate against the active institutional geofence policy.
 */
export function validateGeofenceAgainstPolicy(
  currentLocation: GeoLocation,
  policies: Policy[]
): {
  status: 'inside' | 'outside' | 'unavailable';
  distanceMeters?: number;
  allowedRadiusMeters?: number;
} {
  const geofencePolicy = policies.find(
    p => (p.type === 'geofence_radius' || p.type === 'geofence_configuration') && p.isActive
  );

  if (!geofencePolicy) {
    return { status: 'unavailable' };
  }

  let centerLat: number | undefined;
  let centerLon: number | undefined;
  let allowedRadius = 200;

  if (typeof geofencePolicy.value === 'object' && geofencePolicy.value !== null) {
    const val = geofencePolicy.value as PolicyGeofenceValue;
    centerLat = val.latitude;
    centerLon = val.longitude;
    if (val.radiusMeters) allowedRadius = val.radiusMeters;
  } else if (typeof geofencePolicy.value === 'number') {
    allowedRadius = geofencePolicy.value;
  }

  if (centerLat === undefined || centerLon === undefined) {
    return { status: 'unavailable', allowedRadiusMeters: allowedRadius };
  }

  const distance = calculateHaversineDistanceMeters(
    currentLocation.latitude,
    currentLocation.longitude,
    centerLat,
    centerLon
  );

  return {
    status: distance <= allowedRadius ? 'inside' : 'outside',
    distanceMeters: Math.round(distance),
    allowedRadiusMeters: allowedRadius,
  };
}
