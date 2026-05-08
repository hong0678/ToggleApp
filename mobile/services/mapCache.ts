export type NearbyPlaceCacheItem = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
};

let nearbyPlacesCache: NearbyPlaceCacheItem[] = [];

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
};
