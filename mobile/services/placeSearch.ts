import { mobileSearchApi } from './api';
import type { KakaoPlaceDocument } from './api/types';
import { CATEGORY_OPTIONS, type CategoryOption } from './placeCategories';

export type PlaceSearchCoords = {
  latitude: number;
  longitude: number;
};

export type NormalizedPlaceSearchItem = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  phone?: string;
  latitude: number;
  longitude: number;
  raw: KakaoPlaceDocument;
};

export const DEFAULT_SEARCH_COORDS: PlaceSearchCoords = {
  latitude: 37.380482,
  longitude: 126.929841,
};

export const DEFAULT_SEARCH_RADIUS_METERS = 2000;

export const getCategoryOptionByLabel = (categoryLabel: string) => {
  const normalizedLabel = categoryLabel.trim();
  return CATEGORY_OPTIONS.find((option) => option.label === normalizedLabel) ?? CATEGORY_OPTIONS[0];
};

export const normalizeKakaoPlaceDocument = (
  place: KakaoPlaceDocument,
  fallbackCategory: string
): NormalizedPlaceSearchItem => ({
  id: place.id,
  name: place.place_name,
  category: place.category_group_name || place.category_name || fallbackCategory,
  address: place.road_address_name || place.address_name || '',
  distance: place.distance || '',
  phone: place.phone || '',
  latitude: Number(place.y),
  longitude: Number(place.x),
  raw: place,
});

const dedupePlaces = (places: NormalizedPlaceSearchItem[]) => {
  const seen = new Set<string>();

  return places.filter((place) => {
    const key = place.id || `${place.name}-${place.latitude}-${place.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSearchDocuments = (documents: KakaoPlaceDocument[], fallbackLabel: string) => {
  return dedupePlaces(
    documents
      .map((place) => normalizeKakaoPlaceDocument(place, fallbackLabel))
      .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
  )
    .sort((a, b) => Number(a.distance || 9007199254740991) - Number(b.distance || 9007199254740991))
    .slice(0, 15);
};

export const searchPlacesByCategoryOption = async (
  category: CategoryOption,
  coords: PlaceSearchCoords,
  radiusMeters = DEFAULT_SEARCH_RADIUS_METERS
) => {
  const responses = category.code
    ? [await mobileSearchApi.category({
        categoryGroupCode: category.code,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters,
        size: 15,
        sort: 'distance',
      })]
    : category.label === '전체'
      ? await Promise.all(
          CATEGORY_OPTIONS
            .filter((option): option is CategoryOption & { code: string } => Boolean(option.code))
            .map((option) => mobileSearchApi.category({
              categoryGroupCode: option.code,
              latitude: coords.latitude,
              longitude: coords.longitude,
              radiusMeters,
              size: 15,
              sort: 'distance',
            }))
        )
      : [await mobileSearchApi.keyword({
          query: category.label,
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters,
          size: 15,
          sort: 'distance',
        })];

  const documents = responses.flatMap((response) => response.documents ?? []);
  const places = normalizeSearchDocuments(documents, category.label);

  return { documents, places };
};

export const searchPlacesByKeywordQuery = async (
  query: string,
  coords: PlaceSearchCoords,
  radiusMeters = DEFAULT_SEARCH_RADIUS_METERS
) => {
  const response = await mobileSearchApi.keyword({
    query,
    latitude: coords.latitude,
    longitude: coords.longitude,
    radiusMeters,
    size: 15,
    sort: 'distance',
  });

  const documents = response.documents ?? [];
  const places = normalizeSearchDocuments(documents, query);

  return { documents, places };
};
