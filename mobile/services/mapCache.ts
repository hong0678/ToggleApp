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
};

let nearbyPlacesCache: NearbyPlaceCacheItem[] = [];
let nearbySearchContext: NearbySearchContext = {
  query: null,
  categoryLabel: null,
  categoryCode: null,
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
      query: context.query ?? nearbySearchContext.query,
      categoryLabel: context.categoryLabel ?? nearbySearchContext.categoryLabel,
      categoryCode: context.categoryCode ?? nearbySearchContext.categoryCode,
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
    };
  },
};
