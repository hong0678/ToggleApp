export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
};

export type UserRole = 'USER' | 'OWNER' | 'ADMIN';

export type AuthUserResponse = {
  id: number;
  email: string;
  nickname: string | null;
  displayName: string | null;
  role: UserRole;
  status: string;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserResponse;
};

export type SignupRequest = {
  email: string;
  password: string;
  nickname?: string;
  ownerDisplayName?: string;
  role?: UserRole;
};

export type SignupResponse = {
  userId: number;
  email: string;
  nickname: string | null;
  displayName: string | null;
  role: UserRole;
  status: string;
  createdAt: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type LogoutResponse = {
  loggedOut: boolean;
};

export type MapProfile = {
  publicMapUuid: string | null;
  isPublic: boolean;
  title: string | null;
  description: string | null;
  profileImageUrl: string | null;
};

export type MeResponse = AuthUserResponse & {
  favorites: {
    stores: number[];
    publics: number[];
  };
  mapProfile: MapProfile;
};

export type KakaoPlaceDocument = {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_code?: string;
  category_group_name?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x: string;
  y: string;
  place_url?: string;
  distance?: string;
};

export type KakaoPlaceSearchResponse = {
  meta: Record<string, unknown>;
  documents: KakaoPlaceDocument[];
};

export type ResolveStoreRequest = {
  externalPlaceId: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  categoryName?: string | null;
};

export type ResolveStoreResponse = {
  storeId: number;
  externalSource: string;
  externalPlaceId: string;
  name: string;
  categoryName: string | null;
  address: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  liveBusinessStatus: string | null;
  liveStatusSource: string | null;
  verified: boolean;
  verifiedAt: string | null;
  ownerNotice: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  rating: number | null;
  reviewAverageRating: number | null;
  reviewCount: number;
  favoriteCount: number;
  imageUrls: string[];
  operationalState: string | null;
  closureRequestStatus: string | null;
  menuEligible: boolean;
  menuEditable: boolean;
  menuEligibilityReason: string | null;
};

export type StoreLookupRequest = {
  ids?: number[];
  keyword?: string;
};

export type StoreLookupItemResponse = {
  storeId: number;
  externalSource: string;
  externalPlaceId: string;
  name: string;
  categoryName: string | null;
  address: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  liveBusinessStatus: string | null;
  liveStatusSource: string | null;
  verified: boolean;
  verifiedAt: string | null;
  ownerNotice: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  rating: number | null;
  reviewAverageRating: number | null;
  reviewCount: number;
  favoriteCount: number;
  imageUrls: string[];
  operationalState: string | null;
  closureRequestStatus: string | null;
  menuEligible: boolean;
  menuEditable: boolean;
  menuEligibilityReason: string | null;
};

export type StoreLookupResponse = {
  stores: StoreLookupItemResponse[];
};

export type PublicInstitutionLookupRequest = {
  ids?: number[];
  items?: {
    externalPlaceId: string;
    name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }[];
};

export type PublicInstitutionLookupResponse = {
  institutions: PublicInstitutionLookupItemResponse[];
};

export type PublicInstitutionLookupItemResponse = {
  id: number;
  externalSource: string;
  externalPlaceId: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  congestionLevel: string | null;
  waitTime: number | null;
  operatingHours: string | null;
  statusUpdatedAt: string | null;
};

export type KakaoLookupResponse = {
  stores: StoreLookupItemResponse[];
  institutions: PublicInstitutionLookupItemResponse[];
};

export type KakaoLookupRequest = {
  items: {
    externalPlaceId: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    categoryName?: string;
  }[];
};

export type FavoriteStoreResponse = {
  favoriteId: number | null;
  storeId: number;
  favorited: boolean;
  createdAt: string | null;
};

export type FavoriteStoreListItemResponse = {
  storeId: number;
  externalPlaceId: string;
  name: string;
  categoryName: string | null;
  address: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  phone: string | null;
  businessStatus: string | null;
  liveBusinessStatus: string | null;
  liveStatusSource: string | null;
  latitude: number | null;
  longitude: number | null;
  ownerNotice: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  rating: number | null;
  verified: boolean;
  favoriteCount: number;
  imageUrls: string[];
  favoritedAt: string;
};

export type FavoriteStoreListResponse = {
  content: FavoriteStoreListItemResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type MyMapPlaceResponse = {
  type: string;
  placeId: number;
  inMyMap: boolean;
  updatedAt: string;
};

export type PublicMapSearchItemResponse = {
  publicMapUuid: string;
  nickname: string;
  title: string | null;
  description: string | null;
  savedPlaceCount: number;
  profileImageUrl: string | null;
};

export type PublicMapSearchResponse = {
  content: PublicMapSearchItemResponse[];
};

export type UserPublicMapResponse = {
  publicMapUuid: string;
  nickname: string;
  title: string | null;
  description: string | null;
  profileImageUrl: string | null;
  stores: number[];
  publics: number[];
};
