import { requireNativeModule } from 'expo';

type EVSpotlightShape = {
  indexVehicle: (id: string, name: string, status: string, vin: string) => Promise<boolean>;
  indexReport: (id: string, title: string, subtitle: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  setWidgetSnapshot: (json: string) => Promise<boolean> | boolean;
};

let mod: EVSpotlightShape | null = null;
try {
  mod = requireNativeModule<EVSpotlightShape>('EVSpotlight');
} catch {
  mod = null;
}

/** Null when the native module is absent (e.g. Expo Go). */
export function spotlightModule() {
  return mod;
}
