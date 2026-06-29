/**
 * SaveBites V3 — Location Zustand Store
 * Manages user geolocation for discovery feed.
 */

import { create } from 'zustand';

interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  permissionsGranted: boolean | null;
  isRequested: boolean;
  error: string | null;
}

interface LocationActions {
  setLocation: (lat: number, lng: number, accuracy?: number) => void;
  setPermissions: (granted: boolean) => void;
  setRequested: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type LocationStore = LocationState & LocationActions;

export const useLocationStore = create<LocationStore>()((set) => ({
  lat: null,
  lng: null,
  accuracy: null,
  permissionsGranted: null,
  isRequested: false,
  error: null,

  setLocation: (lat, lng, accuracy) => {
    set({ lat, lng, accuracy: accuracy ?? null, error: null });
  },
  setPermissions: (granted) => {
    set({ permissionsGranted: granted });
  },
  setRequested: () => {
    set({ isRequested: true });
  },
  setError: (error) => {
    set({ error });
  },
  reset: () => {
    set({
      lat: null,
      lng: null,
      accuracy: null,
      permissionsGranted: null,
      isRequested: false,
      error: null,
    });
  },
}));

/** Hook: returns current coordinates or null */
export const useCoordinates = () => {
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);
  return { lat, lng, hasLocation: lat !== null && lng !== null };
};
