export type NearbyPlaceCacheItem = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
};

export type NearbySearchContext = {
  query: string | null;
  categoryLabel: string | null;
  categoryCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

let nearbyPlacesCache: NearbyPlaceCacheItem[] = [];
let nearbySearchContext: NearbySearchContext = {
  query: null,
  categoryLabel: null,
  categoryCode: null,
  latitude: null,
  longitude: null,
};

export const mapCache = {
  setNearbyPlaces(places: NearbyPlaceCacheItem[]) {
    nearbyPlacesCache = Array.isArray(places) ? places : [];
  },

  getNearbyPlaces() {
    return nearbyPlacesCache;
  },

  clearNearbyPlaces() {
    nearbyPlacesCache = [];
  },

  setNearbySearchContext(context: Partial<NearbySearchContext>) {
    nearbySearchContext = {
      query: 'query' in context ? context.query ?? null : nearbySearchContext.query,
      categoryLabel: 'categoryLabel' in context ? context.categoryLabel ?? null : nearbySearchContext.categoryLabel,
      categoryCode: 'categoryCode' in context ? context.categoryCode ?? null : nearbySearchContext.categoryCode,
      latitude: 'latitude' in context ? context.latitude ?? null : nearbySearchContext.latitude,
      longitude: 'longitude' in context ? context.longitude ?? null : nearbySearchContext.longitude,
    };
  },

  getNearbySearchContext() {
    return nearbySearchContext;
  },

  clearNearbySearchContext() {
    nearbySearchContext = {
      query: null,
      categoryLabel: null,
      categoryCode: null,
      latitude: null,
      longitude: null,
    };
  },
};
