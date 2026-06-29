/**
 * SaveBites V3 — useLocation Hook
 * React hook that requests geolocation and manages state.
 */

import { useEffect, useCallback, useState } from 'react';
import { useLocationStore } from '@/lib/stores/location';

export function useLocation() {
  const {
    lat,
    lng,
    permissionsGranted,
    isRequested,
    error,
    setLocation,
    setPermissions,
    setRequested,
    setError,
  } = useLocationStore();

  const [loading, setLoading] = useState(isRequested && !lat);

  const requestLocation = useCallback(() => {
    setRequested();
    setLoading(true);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
        setPermissions(true);
        setLoading(false);
      },
      (err) => {
        let message = 'Unable to determine your location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access.';
            setPermissions(false);
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        setError(message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [setLocation, setPermissions, setError, setRequested]);

  // Auto-request on mount if not already requested
  useEffect(() => {
    if (!isRequested) {
      requestLocation();
    }
  }, [isRequested, requestLocation]);

  return {
    lat,
    lng,
    loading,
    error,
    hasLocation: lat !== null && lng !== null,
    requestLocation,
  };
}
