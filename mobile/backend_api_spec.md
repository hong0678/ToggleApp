# Toggle Backend API Spec

이 문서는 `Toggle_backend`의 컨트롤러를 기준으로, 모바일 앱에서 사용할 수 있는 백엔드 API와 현재 연결 상태를 정리한다.

## Auth

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | 일반/점주 회원가입 | `user_signup.tsx`, `owner_signup.tsx` |
| POST | `/api/v1/auth/login` | 로그인 | `user_login.tsx`, `owner_login.tsx` |
| POST | `/api/v1/auth/refresh` | 토큰 갱신 | `authApi.refresh` |
| POST | `/api/v1/auth/logout` | 로그아웃 | `authApi.logout` |
| GET | `/api/v1/auth/me` | 내 정보/역할/즐겨찾기/지도 프로필 | `main_home.tsx`, `saved_places.tsx`, `my_map.tsx` |

## Favorites

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/favorites/stores` | 저장한 장소 목록 조회 | `saved_places.tsx`, `main_home.tsx` |
| POST | `/api/v1/favorites/stores/{storeId}` | 장소 찜 추가 | `map_around.tsx` |
| DELETE | `/api/v1/favorites/stores/{storeId}` | 장소 찜 삭제 | `map_around.tsx` |
| POST | `/api/v1/favorites/stores/publics/{publicInstitutionId}` | 공공기관 찜 추가 | `map_around.tsx`, `my_map.tsx` |
| DELETE | `/api/v1/favorites/stores/publics/{publicInstitutionId}` | 공공기관 찜 삭제 | `map_around.tsx`, `my_map.tsx` |

## Mobile Search

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/mobile-search/places/keyword` | 키워드 장소 검색 | `map_around.tsx`, `list_all.tsx` |
| GET | `/api/v1/mobile-search/places/category` | 카테고리 장소 검색 | `map_around.tsx`, `list_all.tsx` |
| GET | `/api/v1/mobile-search/places/nearby` | 현재 위치 주변 카테고리 검색 | `map_around.tsx`, `list_all.tsx` |
| POST | `/api/v1/mobile-search/places/lookup` | 카카오 검색 결과를 내부 장소 정보와 매칭 | `map_around.tsx`, `list_all.tsx` |
| GET | `/api/v1/mobile-search/stores/nearby` | 주변 매장 조회 | `list_all.tsx` |

## Stores

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| POST | `/api/v1/stores/resolve` | 외부 장소를 내부 매장으로 해석/생성 | `storesApi.resolve` |
| POST | `/api/v1/stores/lookup` | 매장 ID/키워드 조회 | `storesApi.lookup` |
| GET | `/api/v1/stores` | 매장 ID 목록 조회 | `storesApi.listByIds` |
| GET | `/api/v1/stores/nearby` | 주변 매장 조회 | `storesApi.nearby` |
| DELETE | `/api/v1/stores/{storeId}` | 매장 삭제 | `storesApi` |

## My Map

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/my-map` | 내 지도 요약 | `my_map.tsx`, `main_home.tsx` |
| PUT | `/api/v1/my-map/profile` | 내 지도 프로필 수정 | `myMapApi.updateProfile` |
| POST | `/api/v1/my-map/stores/{storeId}` | 내 지도에 매장 추가 | `my_map.tsx`, 저장 모달 |
| DELETE | `/api/v1/my-map/stores/{storeId}` | 내 지도에서 매장 제거 | `my_map.tsx` |
| POST | `/api/v1/my-map/publics/{publicInstitutionId}` | 내 지도에 공공기관 추가 | `my_map.tsx` |
| DELETE | `/api/v1/my-map/publics/{publicInstitutionId}` | 내 지도에서 공공기관 제거 | `my_map.tsx` |
| GET | `/api/v1/public-maps/search` | 공개 지도 검색 | `search_nickname.tsx` |
| GET | `/api/v1/public-maps/{publicMapUuid}` | 공개 지도 상세 | `search_nickname.tsx` |

## Public Institutions

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| POST | `/api/v1/public-institutions/lookup` | 공공기관 외부 결과 매칭 | `publicInstitutionsApi.lookup` |
| GET | `/api/v1/public-institutions?ids=...` | 공공기관 ID 목록 조회 | `publicInstitutionsApi.getByIds` |

## Store Menus

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/stores/{storeId}/menus` | 공개 메뉴 조회 | `storeMenusApi.getStoreMenus` |
| GET | `/api/v1/owner/stores/{storeId}/menus` | 내 매장 메뉴 조회 | `owner menu` 화면 |
| PUT | `/api/v1/owner/stores/{storeId}/menus` | 내 매장 메뉴 수정 | `owner menu` 화면 |

## Store Reviews

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/stores/{storeId}/reviews` | 리뷰 목록 | `storeReviewsApi.list` |
| GET | `/api/v1/stores/{storeId}/reviews/mine` | 내 리뷰 목록 | `storeReviewsApi.mine` |
| POST | `/api/v1/stores/{storeId}/reviews` | 리뷰 작성 | `storeReviewsApi.create` |
| PATCH | `/api/v1/reviews/{reviewId}` | 리뷰 수정 | `storeReviewsApi.update` |
| DELETE | `/api/v1/reviews/{reviewId}` | 리뷰 삭제 | `storeReviewsApi.remove` |

## Files

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| POST | `/api/v1/files/business` | 사업자 등록증 업로드 | `filesApi.uploadBusiness` |
| POST | `/api/v1/files/menu` | 메뉴 사진 업로드 | `filesApi.uploadMenu` |
| POST | `/api/v1/files/review` | 리뷰 사진 업로드 | `filesApi.uploadReview` |
| POST | `/api/v1/files/store` | 매장 사진 업로드 | `filesApi.uploadStore` |
| GET | `/api/v1/files/view?key=...` | 업로드 파일 조회 URL | `filesApi.viewUrl` |

## Owner

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| POST | `/api/v1/owner/store-applications` | 매장 등록 신청 | `owner_store_register.tsx` |
| POST | `/api/v1/owner/store-registration-requests` | 매장 등록 신청 alias | `owner_store_register.tsx` |
| PATCH | `/api/v1/owner/store-applications/{applicationId}` | 매장 등록 신청 수정 | `owner_store_register.tsx` |
| PATCH | `/api/v1/owner/store-registration-requests/{applicationId}` | 매장 등록 신청 수정 alias | `owner_store_register.tsx` |
| GET | `/api/v1/owner/store-applications` | 신청 현황 목록 | `owner_register_status.tsx` |
| GET | `/api/v1/owner/store-registration-requests` | 신청 현황 목록 alias | `owner_register_status.tsx` |
| GET | `/api/v1/owner/stores` | 점주 연결 매장 목록 | `owner_status_manage.tsx`, `owner_hours_manage.tsx`, `owner_menu_manage.tsx`, `owner_photos_manage.tsx`, `owner_close_request.tsx` |
| POST | `/api/v1/owner/stores/{storeId}/status` | 실시간 상태 변경 | `owner_status_manage.tsx` |
| PUT | `/api/v1/owner/stores/{storeId}/profile` | 운영시간/안내/이미지 수정 | `owner_hours_manage.tsx`, `owner_photos_manage.tsx` |
| POST | `/api/v1/owner/stores/{storeId}/closure-requests` | 운영 종료 요청 생성 | `owner_close_request.tsx` |
| GET | `/api/v1/owner/stores/{storeId}/closure-requests/latest` | 최근 종료 요청 조회 | `owner_close_request.tsx` |
| DELETE | `/api/v1/owner/stores/{storeId}/link` | 점주-매장 연결 해제 | owner 관리 흐름 후보 |

## Admin

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/v1/admin/owner-store-applications` | 점주 신청 목록 | admin 화면 후보 |
| GET | `/api/v1/admin/store-registration-requests` | 점주 신청 목록 alias | admin 화면 후보 |
| GET | `/api/v1/admin/owner-store-applications/{applicationId}` | 신청 상세 | admin 화면 후보 |
| GET | `/api/v1/admin/store-registration-requests/{applicationId}` | 신청 상세 alias | admin 화면 후보 |
| POST | `/api/v1/admin/owner-store-applications/{applicationId}/business-verifications/execute` | 사업자 검증 실행 | admin 화면 후보 |
| POST | `/api/v1/admin/store-registration-requests/{applicationId}/business-verifications/execute` | 사업자 검증 실행 alias | admin 화면 후보 |
| POST | `/api/v1/admin/owner-store-applications/{applicationId}/business-verifications/manual` | 사업자 검증 수동 처리 | admin 화면 후보 |
| POST | `/api/v1/admin/store-registration-requests/{applicationId}/business-verifications/manual` | 사업자 검증 수동 처리 alias | admin 화면 후보 |
| POST | `/api/v1/admin/owner-store-applications/{applicationId}/map-verifications/execute` | 지도 검증 실행 | admin 화면 후보 |
| POST | `/api/v1/admin/store-registration-requests/{applicationId}/map-verifications/execute` | 지도 검증 실행 alias | admin 화면 후보 |
| POST | `/api/v1/admin/owner-store-applications/{applicationId}/approve` | 신청 승인 | admin 화면 후보 |
| POST | `/api/v1/admin/store-registration-requests/{applicationId}/approve` | 신청 승인 alias | admin 화면 후보 |
| POST | `/api/v1/admin/owner-store-applications/{applicationId}/reject` | 신청 반려 | admin 화면 후보 |
| POST | `/api/v1/admin/store-registration-requests/{applicationId}/reject` | 신청 반려 alias | admin 화면 후보 |
| GET | `/api/v1/admin/stores` | 관리자용 매장 목록 | admin 화면 후보 |
| GET | `/api/v1/admin/owner-stores` | 관리자용 점주 매장 목록 | admin 화면 후보 |
| GET | `/api/v1/admin/store-closure-requests` | 운영 종료 요청 목록 | admin 화면 후보 |
| POST | `/api/v1/admin/store-closure-requests/{requestId}/approve` | 종료 요청 승인 | admin 화면 후보 |
| POST | `/api/v1/admin/store-closure-requests/{requestId}/reject` | 종료 요청 반려 | admin 화면 후보 |

## Health / Users

| Method | Path | 용도 | 모바일 연결 |
|---|---|---|---|
| GET | `/api/health` | 서버 헬스 체크 | 개발 확인용 |
| PUT | `/api/v1/users/me/map-profile` | 내 지도 프로필 갱신 | user profile flow |

## 현재 모바일 연결 요약

- 로그인 전 홈: `landing.tsx`
- 로그인 후 홈: `main_home.tsx`
- 지도: `map_around.tsx`
- 리스트: `list_all.tsx`
- 저장한 장소: `saved_places.tsx`
- 내 지도: `my_map.tsx`
- 마이지도 검색: `search_nickname.tsx`
- 일반/점주 회원가입: `user_signup.tsx`, `owner_signup.tsx`
- 로그인: `user_login.tsx`, `owner_login.tsx`

## 메모

- `owner_daily_log.tsx`는 현재 백엔드에 대응되는 별도 API를 찾지 못했다.
- 관리자 화면은 아직 모바일 라우트로 노출되지 않았지만, 서비스 레이어는 준비되어 있다.


----------------------------
# Toggle Backend API Specification

_Based on the current backend source in `apps/backend/src/main/java/com/toggle`._

This document reflects the API surface exposed by the Spring Boot backend as of
`2026-05-06`. It is derived from controller mappings, DTO definitions, and the
current security configuration.

## 1. Common Conventions

### 1.1 Base Path

- All versioned APIs use the `/api/v1` prefix unless otherwise noted.
- Health check uses `/api/health`.

### 1.2 Response Envelope

Most endpoints return `ApiResponse<T>`:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Failure responses use the same envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값이 올바르지 않습니다."
  }
}
```

`ApiResponse` fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | boolean | `true` on success, `false` on failure |
| `data` | object / null | Response payload |
| `error` | object / null | `ErrorResponse` when `success=false` |

`ErrorResponse` fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | string | Error code such as `VALIDATION_ERROR` |
| `message` | string | Human-readable message |

### 1.3 Auth and Authorization

Security is stateless and JWT-based.

- Public endpoints do not require `Authorization`.
- Authenticated endpoints expect `Authorization: Bearer <accessToken>`.
- Admin routes are restricted with `ROLE_ADMIN`.
- File upload routes have role checks for owner/user access in `SecurityConfig`.

### 1.4 Error Handling

Current global exception mapping:

| Condition | HTTP status | Error code |
| --- | --- | --- |
| Domain exception (`ApiException`) | custom | service-defined |
| Validation failure | 400 | `VALIDATION_ERROR` |
| Missing multipart part | 400 | `VALIDATION_ERROR` |
| File too large | 400 | `FILE_TOO_LARGE` |
| Unexpected exception | 500 | `INTERNAL_SERVER_ERROR` |

## 2. Endpoint Summary

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Health check |
| `POST` | `/api/v1/auth/signup` | public | Sign up |
| `POST` | `/api/v1/auth/login` | public | Log in |
| `POST` | `/api/v1/auth/refresh` | public | Refresh access token |
| `POST` | `/api/v1/auth/logout` | public | Logout / invalidate refresh token |
| `GET` | `/api/v1/auth/me` | authenticated | Current user profile |
| `POST` | `/api/v1/stores/resolve` | public | Resolve a registered store from external data |
| `POST` | `/api/v1/stores/lookup` | public | Batch lookup stores |
| `GET` | `/api/v1/stores` | public | Get stores by IDs |
| `GET` | `/api/v1/stores/nearby` | public | Nearby verified stores |
| `DELETE` | `/api/v1/stores/{storeId}` | admin | Soft-delete a store |
| `GET` | `/api/v1/public-institutions` | public | Get public institutions by IDs |
| `POST` | `/api/v1/public-institutions/lookup` | public | Lookup public institutions |
| `GET` | `/api/v1/mobile-search/places/keyword` | authenticated | Kakao keyword search |
| `GET` | `/api/v1/mobile-search/places/category` | authenticated | Kakao category search |
| `GET` | `/api/v1/mobile-search/places/nearby` | authenticated | Kakao nearby search |
| `POST` | `/api/v1/mobile-search/places/lookup` | authenticated | Resolve mobile search results |
| `GET` | `/api/v1/mobile-search/stores/nearby` | authenticated | Nearby stores for mobile |
| `GET` | `/api/v1/favorites/stores` | authenticated | Favorite store list |
| `POST` | `/api/v1/favorites/stores/{storeId}` | authenticated | Favorite a store |
| `DELETE` | `/api/v1/favorites/stores/{storeId}` | authenticated | Unfavorite a store |
| `POST` | `/api/v1/favorites/stores/publics/{publicInstitutionId}` | authenticated | Favorite a public institution |
| `DELETE` | `/api/v1/favorites/stores/publics/{publicInstitutionId}` | authenticated | Unfavorite a public institution |
| `GET` | `/api/v1/stores/{storeId}/reviews` | public | Paginated store reviews |
| `GET` | `/api/v1/stores/{storeId}/reviews/mine` | authenticated | My reviews for a store |
| `POST` | `/api/v1/stores/{storeId}/reviews` | authenticated | Create a review |
| `PATCH` | `/api/v1/reviews/{reviewId}` | authenticated | Update a review |
| `DELETE` | `/api/v1/reviews/{reviewId}` | authenticated | Delete a review |
| `GET` | `/api/v1/my-map` | authenticated | My map snapshot |
| `PUT` | `/api/v1/my-map/profile` | authenticated | Update my map profile |
| `POST` | `/api/v1/my-map/stores/{storeId}` | authenticated | Add store to my map |
| `DELETE` | `/api/v1/my-map/stores/{storeId}` | authenticated | Remove store from my map |
| `POST` | `/api/v1/my-map/publics/{publicInstitutionId}` | authenticated | Add public institution to my map |
| `DELETE` | `/api/v1/my-map/publics/{publicInstitutionId}` | authenticated | Remove public institution from my map |
| `GET` | `/api/v1/public-maps/search` | authenticated | Search public maps |
| `GET` | `/api/v1/public-maps/{publicMapUuid}` | public | Read a public map |
| `GET` | `/api/v1/stores/{storeId}/menus` | public | Read store menus |
| `GET` | `/api/v1/owner/stores/{storeId}/menus` | authenticated | Read owner store menus |
| `PUT` | `/api/v1/owner/stores/{storeId}/menus` | authenticated | Replace owner store menus |
| `POST` | `/api/v1/files/business` | owner | Upload business file |
| `POST` | `/api/v1/files/menu` | owner | Upload menu file |
| `POST` | `/api/v1/files/review` | user or owner | Upload review file |
| `POST` | `/api/v1/files/store` | owner | Upload store file |
| `GET` | `/api/v1/files/view` | public | Redirect to presigned URL |
| `POST` | `/api/v1/owner/store-applications` | authenticated | Create owner application |
| `POST` | `/api/v1/owner/store-registration-requests` | authenticated | Alias for create owner application |
| `PATCH` | `/api/v1/owner/store-applications/{applicationId}` | authenticated | Update owner application |
| `PATCH` | `/api/v1/owner/store-registration-requests/{applicationId}` | authenticated | Alias for update owner application |
| `GET` | `/api/v1/owner/store-applications` | authenticated | List my owner applications |
| `GET` | `/api/v1/owner/store-registration-requests` | authenticated | Alias for list my owner applications |
| `GET` | `/api/v1/owner/stores` | authenticated | List my linked stores |
| `POST` | `/api/v1/owner/stores/{storeId}/status` | authenticated | Update my store live status |
| `PUT` | `/api/v1/owner/stores/{storeId}/profile` | authenticated | Update my store profile |
| `DELETE` | `/api/v1/owner/stores/{storeId}/link` | authenticated | Unlink owner from store |
| `POST` | `/api/v1/owner/stores/{storeId}/closure-requests` | authenticated | Create store closure request |
| `GET` | `/api/v1/owner/stores/{storeId}/closure-requests/latest` | authenticated | Latest closure request |
| `GET` | `/api/v1/admin/stores` | admin | Admin store list |
| `GET` | `/api/v1/admin/owner-stores` | admin | Admin owner-linked store list |
| `GET` | `/api/v1/admin/store-closure-requests` | admin | Closure request list |
| `POST` | `/api/v1/admin/store-closure-requests/{requestId}/approve` | admin | Approve closure request |
| `POST` | `/api/v1/admin/store-closure-requests/{requestId}/reject` | admin | Reject closure request |
| `GET` | `/api/v1/admin/owner-store-applications` | admin | Admin owner application list |
| `GET` | `/api/v1/admin/store-registration-requests` | admin | Alias for admin owner application list |
| `GET` | `/api/v1/admin/owner-store-applications/{applicationId}` | admin | Admin application detail |
| `GET` | `/api/v1/admin/store-registration-requests/{applicationId}` | admin | Alias for admin application detail |
| `POST` | `/api/v1/admin/owner-store-applications/{applicationId}/business-verifications/execute` | admin | Execute business verification |
| `POST` | `/api/v1/admin/store-registration-requests/{applicationId}/business-verifications/execute` | admin | Alias for execute business verification |
| `POST` | `/api/v1/admin/owner-store-applications/{applicationId}/business-verifications/manual` | admin | Manual business verification |
| `POST` | `/api/v1/admin/store-registration-requests/{applicationId}/business-verifications/manual` | admin | Alias for manual business verification |
| `POST` | `/api/v1/admin/owner-store-applications/{applicationId}/map-verifications/execute` | admin | Execute map verification |
| `POST` | `/api/v1/admin/store-registration-requests/{applicationId}/map-verifications/execute` | admin | Alias for execute map verification |
| `POST` | `/api/v1/admin/owner-store-applications/{applicationId}/approve` | admin | Approve application |
| `POST` | `/api/v1/admin/store-registration-requests/{applicationId}/approve` | admin | Alias for approve application |
| `POST` | `/api/v1/admin/owner-store-applications/{applicationId}/reject` | admin | Reject application |
| `POST` | `/api/v1/admin/store-registration-requests/{applicationId}/reject` | admin | Alias for reject application |

## 3. Authentication APIs

### 3.1 `POST /api/v1/auth/signup`

Creates a new user account.

Request body: `SignupRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | yes | Trimmed, email format |
| `password` | string | yes | 8-100 chars |
| `nickname` | string | no | Trimmed |
| `ownerDisplayName` | string | no | Trimmed |
| `role` | `USER` / `OWNER` / `ADMIN` | no | `UserRole` enum |

Response body: `SignupResponse`

| Field | Type |
| --- | --- |
| `userId` | long |
| `email` | string |
| `nickname` | string |
| `displayName` | string |
| `role` | string |
| `status` | string |
| `createdAt` | datetime |

### 3.2 `POST /api/v1/auth/login`

Request body: `LoginRequest`

| Field | Type | Required |
| --- | --- | --- |
| `email` | string | yes |
| `password` | string | yes |

Response body: `AuthTokenResponse`

| Field | Type |
| --- | --- |
| `accessToken` | string |
| `refreshToken` | string |
| `tokenType` | string |
| `expiresIn` | long |
| `user` | `AuthUserResponse` |

`AuthUserResponse`:

| Field | Type |
| --- | --- |
| `id` | long |
| `email` | string |
| `nickname` | string |
| `displayName` | string |
| `role` | string |
| `status` | string |

### 3.3 `POST /api/v1/auth/refresh`

Request body: `RefreshTokenRequest`

| Field | Type | Required |
| --- | --- | --- |
| `refreshToken` | string | yes |

Response body: `AuthTokenResponse`

### 3.4 `POST /api/v1/auth/logout`

Request body: `RefreshTokenRequest`

Response body: `LogoutResponse`

| Field | Type |
| --- | --- |
| `loggedOut` | boolean |

### 3.5 `GET /api/v1/auth/me`

Response body: `MeResponse`

| Field | Type |
| --- | --- |
| `id` | long |
| `email` | string |
| `nickname` | string |
| `displayName` | string |
| `role` | string |
| `status` | string |
| `favorites.stores` | `long[]` |
| `favorites.publics` | `long[]` |
| `mapProfile.publicMapUuid` | string |
| `mapProfile.isPublic` | boolean |
| `mapProfile.title` | string |
| `mapProfile.description` | string |
| `mapProfile.profileImageUrl` | string |

## 4. Store APIs

### 4.1 `POST /api/v1/stores/resolve`

Resolves or links a registered store from external place data.

Request body: `ResolveStoreRequest`

| Field | Type | Required |
| --- | --- | --- |
| `externalSource` | string | yes |
| `externalPlaceId` | string | yes |
| `name` | string | yes |
| `address` | string | yes |
| `phone` | string | no |
| `latitude` | decimal | yes |
| `longitude` | decimal | yes |

Response body: `ResolveStoreResponse`

| Field | Type |
| --- | --- |
| `storeId` | long |
| `externalSource` | string |
| `externalPlaceId` | string |
| `resolved` | boolean |

### 4.2 `POST /api/v1/stores/lookup`

Request body: `StoreLookupRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `externalSource` | string | yes | External provider identifier |
| `externalPlaceIds` | string[] | yes | Non-empty list |

Response body: `StoreLookupResponse`

| Field | Type |
| --- | --- |
| `stores` | `StoreLookupItemResponse[]` |

`StoreLookupItemResponse` fields:

| Field | Type |
| --- | --- |
| `storeId` | long |
| `externalSource` | string |
| `externalPlaceId` | string |
| `name` | string |
| `categoryName` | string |
| `address` | string |
| `roadAddress` | string |
| `jibunAddress` | string |
| `phone` | string |
| `latitude` | double |
| `longitude` | double |
| `businessStatus` | string |
| `liveBusinessStatus` | string |
| `liveStatusSource` | string |
| `verified` | boolean |
| `verifiedAt` | string |
| `ownerNotice` | string |
| `openTime` | string |
| `closeTime` | string |
| `breakStart` | string |
| `breakEnd` | string |
| `rating` | double |
| `reviewAverageRating` | double |
| `reviewCount` | long |
| `favoriteCount` | long |
| `imageUrls` | string[] |
| `operationalState` | string |
| `closureRequestStatus` | string |
| `menuEligible` | boolean |
| `menuEditable` | boolean |
| `menuEligibilityReason` | string |

### 4.3 `GET /api/v1/stores`

Query params:

| Field | Type | Notes |
| --- | --- | --- |
| `ids` | long[] | List of store IDs |

Response body: `StoreLookupResponse`

### 4.4 `GET /api/v1/stores/nearby`

Query params:

| Field | Type | Default |
| --- | --- | --- |
| `latitude` | double | required |
| `longitude` | double | required |
| `radiusMeters` | int | `2000` |
| `limit` | int | `30` |

Response body: `StoreLookupResponse`

### 4.5 `DELETE /api/v1/stores/{storeId}`

Soft-deletes a store.

Query params:

| Field | Type | Notes |
| --- | --- | --- |
| `reason` | string | optional |

Response body: `ApiResponse<Void>`

## 5. Public Institution APIs

### 5.1 `POST /api/v1/public-institutions/lookup`

Request body: `PublicInstitutionLookupRequest`

| Field | Type | Required |
| --- | --- | --- |
| `externalSource` | string | yes |
| `items` | array | yes |

Nested item fields:

| Field | Type | Required |
| --- | --- | --- |
| `externalPlaceId` | string | yes |
| `name` | string | no |
| `address` | string | no |
| `latitude` | double | no |
| `longitude` | double | no |

Response body: `PublicInstitutionLookupResponse`

| Field | Type |
| --- | --- |
| `institutions` | `PublicInstitutionLookupItemResponse[]` |

`PublicInstitutionLookupItemResponse`:

| Field | Type |
| --- | --- |
| `id` | long |
| `externalSource` | string |
| `externalPlaceId` | string |
| `name` | string |
| `address` | string |
| `latitude` | double |
| `longitude` | double |
| `congestionLevel` | string |
| `waitTime` | integer |
| `operatingHours` | string |
| `statusUpdatedAt` | string |

### 5.2 `GET /api/v1/public-institutions`

Query params:

| Field | Type |
| --- | --- |
| `ids` | long[] |

Response body: `PublicInstitutionLookupResponse`

## 6. Mobile Search APIs

These endpoints proxy Kakao place search / lookup behavior.

### 6.1 `GET /api/v1/mobile-search/places/keyword`

Query params: `KakaoKeywordSearchRequest`

| Field | Type | Required |
| --- | --- | --- |
| `query` | string | yes |
| `categoryGroupCode` | string | no |
| `latitude` | double | no |
| `longitude` | double | no |
| `radiusMeters` | int | no |
| `page` | int | no |
| `size` | int | no |
| `sort` | string | no |

Response body: `KakaoPlaceSearchResponse`

`KakaoPlaceSearchResponse` contains:

| Field | Type |
| --- | --- |
| `meta` | object |
| `documents` | array |

### 6.2 `GET /api/v1/mobile-search/places/category`

Query params: `KakaoCategorySearchRequest`

| Field | Type | Required |
| --- | --- | --- |
| `categoryGroupCode` | string | yes |
| `latitude` | double | yes |
| `longitude` | double | yes |
| `radiusMeters` | int | yes |
| `page` | int | no |
| `size` | int | no |
| `sort` | string | no |

Response body: `KakaoPlaceSearchResponse`

### 6.3 `GET /api/v1/mobile-search/places/nearby`

Query params: `KakaoNearbySearchRequest`

Same field set and validation as category search.

### 6.4 `POST /api/v1/mobile-search/places/lookup`

Request body: `KakaoLookupRequest`

| Field | Type |
| --- | --- |
| `items` | array of lookup items |

Lookup item fields:

| Field | Type |
| --- | --- |
| `externalPlaceId` | string |
| `name` | string |
| `address` | string |
| `latitude` | double |
| `longitude` | double |
| `categoryName` | string |

Response body: `KakaoLookupResponse`

| Field | Type |
| --- | --- |
| `stores` | `StoreLookupItemResponse[]` |
| `institutions` | `PublicInstitutionLookupItemResponse[]` |

### 6.5 `GET /api/v1/mobile-search/stores/nearby`

Query params:

| Field | Type | Default |
| --- | --- | --- |
| `latitude` | double | required |
| `longitude` | double | required |
| `radiusMeters` | int | `2000` |
| `limit` | int | `30` |

Response body: `StoreLookupResponse`

## 7. Favorite APIs

### 7.1 `GET /api/v1/favorites/stores`

Response body: `FavoriteStoreListResponse`

| Field | Type |
| --- | --- |
| `content` | `FavoriteStoreListItemResponse[]` |
| `page` | int |
| `size` | int |
| `totalElements` | long |
| `totalPages` | int |

`FavoriteStoreListItemResponse` fields:

| Field | Type |
| --- | --- |
| `storeId` | long |
| `externalPlaceId` | string |
| `name` | string |
| `categoryName` | string |
| `address` | string |
| `roadAddress` | string |
| `jibunAddress` | string |
| `phone` | string |
| `businessStatus` | string |
| `liveBusinessStatus` | string |
| `liveStatusSource` | string |
| `latitude` | double |
| `longitude` | double |
| `ownerNotice` | string |
| `openTime` | string |
| `closeTime` | string |
| `breakStart` | string |
| `breakEnd` | string |
| `rating` | double |
| `verified` | boolean |
| `favoriteCount` | long |
| `imageUrls` | string[] |
| `favoritedAt` | datetime |

### 7.2 `POST /api/v1/favorites/stores/{storeId}`

Response body: `FavoriteStoreResponse`

| Field | Type |
| --- | --- |
| `favoriteId` | long |
| `storeId` | long |
| `favorited` | boolean |
| `createdAt` | datetime |

### 7.3 `DELETE /api/v1/favorites/stores/{storeId}`

Response body: `FavoriteStoreResponse`

### 7.4 `POST /api/v1/favorites/stores/publics/{publicInstitutionId}`

Response body: `FavoriteStoreResponse`

### 7.5 `DELETE /api/v1/favorites/stores/publics/{publicInstitutionId}`

Response body: `FavoriteStoreResponse`

## 8. Review APIs

### 8.1 `GET /api/v1/stores/{storeId}/reviews`

Query params:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int | `0` | zero-based |
| `size` | int | `20` | page size |
| `sort` | string | `latest` | allowed: `latest`, `rating_desc`, `rating_asc` |

Response body: `StoreReviewPageResponse`

| Field | Type |
| --- | --- |
| `content` | `StoreReviewItemResponse[]` |
| `page` | int |
| `size` | int |
| `totalElements` | long |
| `totalPages` | int |
| `summary` | `StoreReviewSummaryResponse` |

`StoreReviewItemResponse`:

| Field | Type |
| --- | --- |
| `reviewId` | long |
| `storeId` | long |
| `userId` | long |
| `displayName` | string |
| `rating` | int |
| `content` | string |
| `imageUrls` | string[] |
| `createdAt` | datetime |
| `updatedAt` | datetime |

`StoreReviewSummaryResponse`:

| Field | Type |
| --- | --- |
| `averageRating` | decimal |
| `reviewCount` | long |

### 8.2 `GET /api/v1/stores/{storeId}/reviews/mine`

Same paging and sort behavior as the public review list.

Response body: `StoreReviewMineResponse`

Same envelope as `StoreReviewPageResponse`, including `summary`.

### 8.3 `POST /api/v1/stores/{storeId}/reviews`

Request body: `StoreReviewCreateRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `rating` | int | yes | 1-5 |
| `content` | string | yes | trimmed, non-blank |
| `imageUrls` | string[] | no | max 5 items |

Response body: `StoreReviewItemResponse`

### 8.4 `PATCH /api/v1/reviews/{reviewId}`

Request body: `StoreReviewUpdateRequest`

Same shape as create request.

### 8.5 `DELETE /api/v1/reviews/{reviewId}`

Response body: `ApiResponse<Void>`

## 9. My Map and Public Map APIs

### 9.1 `GET /api/v1/my-map`

Response body: `MyMapResponse`

| Field | Type |
| --- | --- |
| `mapProfile` | `MeResponse.MapProfile` |
| `stores` | long[] |
| `publics` | long[] |

### 9.2 `PUT /api/v1/my-map/profile`

Also available as `PUT /api/v1/users/me/map-profile`.

Request body: `UpdateMyMapProfileRequest`

| Field | Type | Required |
| --- | --- | --- |
| `isPublic` | boolean | no |
| `title` | string | no |
| `description` | string | no |
| `profileImageUrl` | string | no |

Response body: `MeResponse.MapProfile`

### 9.3 `POST /api/v1/my-map/stores/{storeId}`

Response body: `MyMapPlaceResponse`

| Field | Type |
| --- | --- |
| `type` | string |
| `placeId` | long |
| `inMyMap` | boolean |
| `updatedAt` | datetime |

### 9.4 `DELETE /api/v1/my-map/stores/{storeId}`

Response body: `MyMapPlaceResponse`

### 9.5 `POST /api/v1/my-map/publics/{publicInstitutionId}`

Response body: `MyMapPlaceResponse`

### 9.6 `DELETE /api/v1/my-map/publics/{publicInstitutionId}`

Response body: `MyMapPlaceResponse`

### 9.7 `GET /api/v1/public-maps/search`

Query params:

| Field | Type |
| --- | --- |
| `nickname` | string |

Response body: `PublicMapSearchResponse`

| Field | Type |
| --- | --- |
| `content` | `PublicMapSearchItemResponse[]` |

`PublicMapSearchItemResponse`:

| Field | Type |
| --- | --- |
| `publicMapUuid` | string |
| `nickname` | string |
| `title` | string |
| `description` | string |
| `savedPlaceCount` | long |
| `profileImageUrl` | string |

### 9.8 `GET /api/v1/public-maps/{publicMapUuid}`

Response body: `UserPublicMapResponse`

| Field | Type |
| --- | --- |
| `publicMapUuid` | string |
| `nickname` | string |
| `title` | string |
| `description` | string |
| `profileImageUrl` | string |
| `stores` | long[] |
| `publics` | long[] |

## 10. Store Menu APIs

### 10.1 `GET /api/v1/stores/{storeId}/menus`

Response body: `StoreMenuResponse`

| Field | Type |
| --- | --- |
| `storeId` | long |
| `storeName` | string |
| `categoryName` | string |
| `enabled` | boolean |
| `editable` | boolean |
| `items` | `StoreMenuItemResponse[]` |
| `operationalState` | string |
| `closureRequestStatus` | string |
| `menuEligible` | boolean |
| `menuEditable` | boolean |
| `menuEligibilityReason` | string |

`StoreMenuItemResponse`:

| Field | Type |
| --- | --- |
| `menuId` | long |
| `name` | string |
| `price` | int |
| `representative` | boolean |
| `description` | string |
| `imageUrl` | string |
| `displayOrder` | int |
| `available` | boolean |

### 10.2 `GET /api/v1/owner/stores/{storeId}/menus`

Same response as public menu list, but scoped to the authenticated owner.

### 10.3 `PUT /api/v1/owner/stores/{storeId}/menus`

Request body: `StoreMenuUpsertRequest`

| Field | Type | Required |
| --- | --- | --- |
| `menus` | array of `StoreMenuUpsertItemRequest` | yes |

`StoreMenuUpsertItemRequest`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | max 120 |
| `price` | integer | yes | >= 0 |
| `representative` | boolean | no | optional |
| `description` | string | no | max 1000 |
| `imageUrl` | string | no | max 100000 |
| `displayOrder` | integer | no | optional |
| `available` | boolean | no | optional |

Response body: `StoreMenuResponse`

## 11. File Upload APIs

### 11.1 `POST /api/v1/files/business`

Multipart form-data:

| Part | Type | Required |
| --- | --- | --- |
| `file` | file | yes |

Response body: `FileUploadResponse`

| Field | Type |
| --- | --- |
| `url` | string |
| `key` | string |

### 11.2 `POST /api/v1/files/menu`

Multipart form-data with `file`.

### 11.3 `POST /api/v1/files/review`

Multipart form-data with `file`.

### 11.4 `POST /api/v1/files/store`

Multipart form-data with `file`.

### 11.5 `GET /api/v1/files/view`

Query params:

| Field | Type |
| --- | --- |
| `key` | string |

Returns `302 FOUND` redirect to a presigned GET URL.

## 12. Owner APIs

### 12.1 `POST /api/v1/owner/store-applications`

Alias: `POST /api/v1/owner/store-registration-requests`

Multipart form-data:

| Part | Type | Required |
| --- | --- | --- |
| `request` | JSON (`OwnerApplicationRequest`) | yes |
| `businessLicenseFile` | file | yes |

`OwnerApplicationRequest`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `storeName` | string | yes | 2-80 chars |
| `businessNumber` | string | yes | trimmed |
| `representativeName` | string | yes | 2-60 chars |
| `businessOpenDate` | date | yes | ISO date |
| `businessAddress` | string | yes | trimmed |
| `businessPhone` | string | yes | phone-like pattern |

Response body: `OwnerApplicationResponse`

| Field | Type |
| --- | --- |
| `applicationId` | long |
| `ownerUserId` | long |
| `storeName` | string |
| `requestStatus` | string |
| `businessVerificationStatus` | string |
| `mapVerificationStatus` | string |
| `submittedAt` | datetime |

### 12.2 `PATCH /api/v1/owner/store-applications/{applicationId}`

Alias: `PATCH /api/v1/owner/store-registration-requests/{applicationId}`

Multipart form-data:

| Part | Type | Required |
| --- | --- | --- |
| `request` | JSON (`OwnerApplicationUpdateRequest`) | yes |
| `businessLicenseFile` | file | no |

`OwnerApplicationUpdateRequest` uses the same field set as create.

Response body: `OwnerApplicationResponse`

### 12.3 `GET /api/v1/owner/store-applications`

Alias: `GET /api/v1/owner/store-registration-requests`

Response body: `OwnerApplicationSummaryResponse[]`

`OwnerApplicationSummaryResponse` fields:

| Field | Type |
| --- | --- |
| `applicationId` | long |
| `ownerUserId` | long |
| `ownerEmail` | string |
| `ownerNickname` | string |
| `storeName` | string |
| `businessNumber` | string |
| `representativeName` | string |
| `businessOpenDate` | date |
| `businessAddressRaw` | string |
| `businessPhone` | string |
| `businessLicenseObjectKey` | string |
| `businessLicenseDeletedAt` | datetime |
| `businessLicenseDeleteReason` | string |
| `requestStatus` | string |
| `businessVerificationStatus` | string |
| `mapVerificationStatus` | string |
| `verifiedStoreId` | long |
| `verifiedStoreName` | string |
| `rejectReason` | string |
| `submittedAt` | datetime |
| `reviewedAt` | datetime |

### 12.4 `GET /api/v1/owner/stores`

Response body: `OwnerLinkedStoreResponse[]`

| Field | Type |
| --- | --- |
| `linkId` | long |
| `ownerUserId` | long |
| `ownerNickname` | string |
| `ownerEmail` | string |
| `storeId` | long |
| `storeName` | string |
| `storeAddress` | string |
| `categoryName` | string |
| `liveBusinessStatus` | string |
| `ownerNotice` | string |
| `openTime` | string |
| `closeTime` | string |
| `breakStart` | string |
| `breakEnd` | string |
| `imageUrls` | string[] |
| `operationalState` | string |
| `closureRequestStatus` | string |
| `menuEligible` | boolean |
| `menuEditable` | boolean |
| `menuEligibilityReason` | string |

### 12.5 `POST /api/v1/owner/stores/{storeId}/status`

Request body: `OwnerStoreStatusUpdateRequest`

| Field | Type | Required |
| --- | --- | --- |
| `status` | string | yes |
| `comment` | string | no |

Response body: `OwnerStoreStatusResponse`

| Field | Type |
| --- | --- |
| `storeId` | long |
| `storeName` | string |
| `liveBusinessStatus` | string |
| `statusSource` | string |
| `comment` | string |

### 12.6 `PUT /api/v1/owner/stores/{storeId}/profile`

Request body: `OwnerStoreProfileUpdateRequest`

| Field | Type | Required |
| --- | --- | --- |
| `ownerNotice` | string | no |
| `openTime` | string | no |
| `closeTime` | string | no |
| `breakStart` | string | no |
| `breakEnd` | string | no |
| `imageUrls` | string[] | no |

Response body: `OwnerLinkedStoreResponse`

### 12.7 `DELETE /api/v1/owner/stores/{storeId}/link`

Response body: `ApiResponse<Void>`

### 12.8 `POST /api/v1/owner/stores/{storeId}/closure-requests`

Request body: `StoreClosureRequestCreateRequest`

| Field | Type |
| --- | --- |
| `reason` | string |

Response body: `StoreClosureRequestResponse`

| Field | Type |
| --- | --- |
| `requestId` | long |
| `storeId` | long |
| `storeName` | string |
| `ownerUserId` | long |
| `ownerNickname` | string |
| `ownerEmail` | string |
| `requestReason` | string |
| `requestStatus` | string |
| `reviewedByUserId` | long |
| `reviewedByNickname` | string |
| `reviewReason` | string |
| `requestedAt` | datetime |
| `reviewedAt` | datetime |
| `operationalState` | string |
| `menuEligible` | boolean |
| `menuEditable` | boolean |
| `menuEligibilityReason` | string |

### 12.9 `GET /api/v1/owner/stores/{storeId}/closure-requests/latest`

Response body: `StoreClosureRequestResponse`

## 13. Admin APIs

### 13.1 `GET /api/v1/admin/stores`

Response body: `StoreLookupResponse`

### 13.2 `GET /api/v1/admin/owner-stores`

Response body: `OwnerLinkedStoreResponse[]`

### 13.3 `GET /api/v1/admin/store-closure-requests`

Query params:

| Field | Type | Default |
| --- | --- | --- |
| `status` | `StoreClosureRequestStatus` | `PENDING` |

Response body: `StoreClosureRequestResponse[]`

### 13.4 `POST /api/v1/admin/store-closure-requests/{requestId}/approve`

Response body: `StoreClosureRequestResponse`

### 13.5 `POST /api/v1/admin/store-closure-requests/{requestId}/reject`

Request body: `StoreClosureRequestRejectRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | trimmed, max 1000 chars |

Response body: `StoreClosureRequestResponse`

### 13.6 `GET /api/v1/admin/owner-store-applications`

Alias: `GET /api/v1/admin/store-registration-requests`

Response body: `OwnerApplicationSummaryResponse[]`

### 13.7 `GET /api/v1/admin/owner-store-applications/{applicationId}`

Alias: `GET /api/v1/admin/store-registration-requests/{applicationId}`

Response body: `OwnerApplicationDetailResponse`

`OwnerApplicationDetailResponse` fields:

| Field | Type |
| --- | --- |
| `application` | `OwnerApplicationSummaryResponse` |
| `businessLicensePresignedUrl` | string |
| `businessVerificationHistories` | `BusinessVerificationHistoryResponse[]` |
| `mapVerificationHistories` | `MapVerificationHistoryResponse[]` |

### 13.8 `POST /api/v1/admin/owner-store-applications/{applicationId}/business-verifications/execute`

Alias: `POST /api/v1/admin/store-registration-requests/{applicationId}/business-verifications/execute`

Response body: `OwnerApplicationSummaryResponse`

### 13.9 `POST /api/v1/admin/owner-store-applications/{applicationId}/business-verifications/manual`

Alias: `POST /api/v1/admin/store-registration-requests/{applicationId}/business-verifications/manual`

Request body: `ManualBusinessVerificationRequest`

| Field | Type | Required |
| --- | --- | --- |
| `verified` | boolean | yes |
| `reason` | string | yes |

Response body: `OwnerApplicationSummaryResponse`

### 13.10 `POST /api/v1/admin/owner-store-applications/{applicationId}/map-verifications/execute`

Alias: `POST /api/v1/admin/store-registration-requests/{applicationId}/map-verifications/execute`

Request body: `ExecuteMapVerificationRequest`

| Field | Type |
| --- | --- |
| `forceRefresh` | boolean |

Response body: `OwnerApplicationSummaryResponse`

### 13.11 `POST /api/v1/admin/owner-store-applications/{applicationId}/approve`

Alias: `POST /api/v1/admin/store-registration-requests/{applicationId}/approve`

Request body: `OwnerApplicationApproveRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `adminConfirmed` | boolean | yes | must be `true` |

Response body: `OwnerApplicationReviewResponse`

| Field | Type |
| --- | --- |
| `applicationId` | long |
| `ownerUserId` | long |
| `requestStatus` | string |
| `businessVerificationStatus` | string |
| `mapVerificationStatus` | string |
| `verifiedStoreId` | long |
| `linkedStoreId` | long |
| `reviewedAt` | datetime |
| `rejectReason` | string |

### 13.12 `POST /api/v1/admin/owner-store-applications/{applicationId}/reject`

Alias: `POST /api/v1/admin/store-registration-requests/{applicationId}/reject`

Request body: `OwnerApplicationReviewRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | max 500 chars |

Response body: `OwnerApplicationReviewResponse`

## 14. Shared DTOs

### 14.1 `MeResponse.MapProfile`

| Field | Type |
| --- | --- |
| `publicMapUuid` | string |
| `isPublic` | boolean |
| `title` | string |
| `description` | string |
| `profileImageUrl` | string |

### 14.2 `FavoriteStoreResponse`

| Field | Type |
| --- | --- |
| `favoriteId` | long |
| `storeId` | long |
| `favorited` | boolean |
| `createdAt` | datetime |

### 14.3 `BusinessVerificationHistoryResponse`

| Field | Type |
| --- | --- |
| `verificationType` | string |
| `status` | string |
| `failureCode` | string |
| `failureMessage` | string |
| `verifiedAt` | datetime |

### 14.4 `MapVerificationHistoryResponse`

| Field | Type |
| --- | --- |
| `queryText` | string |
| `status` | string |
| `candidateCount` | integer |
| `selectedPlaceName` | string |
| `selectedRoadAddress` | string |
| `selectedJibunAddress` | string |
| `selectedExternalPlaceId` | string |
| `failureCode` | string |
| `failureMessage` | string |
| `verifiedAt` | datetime |

### 14.5 `NationalTaxVerificationResult`

| Field | Type |
| --- | --- |
| `valid` | boolean |
| `requestPayloadJson` | string |
| `responsePayloadJson` | string |
| `matchedBusinessNumber` | string |
| `matchedRepresentativeName` | string |
| `matchedOpenDate` | string |
| `matchedAddress` | string |
| `failureCode` | string |
| `failureMessage` | string |

## 15. Enum References

These enums are surfaced directly or indirectly as string fields in DTOs.

| Enum | Values |
| --- | --- |
| `UserRole` | `USER`, `OWNER`, `ADMIN` |
| `UserStatus` | `PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, `INACTIVE`, `BLOCKED` |
| `BusinessStatus` | `OPEN`, `BREAK_TIME`, `CLOSED`, `TEMP_CLOSED`, `EARLY_CLOSED` |
| `StoreOperationalState` | `ACTIVE`, `CLOSURE_REQUESTED`, `INACTIVE` |
| `StoreClosureRequestStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `BusinessVerificationStatus` | `NOT_STARTED`, `AUTO_VERIFICATION_PENDING`, `AUTO_VERIFIED`, `AUTO_VERIFICATION_UNAVAILABLE`, `AUTO_VERIFICATION_FAILED`, `MANUAL_VERIFICATION_REQUIRED`, `MANUAL_VERIFIED`, `MANUAL_VERIFICATION_FAILED` |
| `MapVerificationStatus` | `NOT_STARTED`, `SEARCH_PENDING`, `VERIFIED`, `FAILED` |
| `OwnerApplicationReviewStatus` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` |
| `OwnerApplicationMappingStatus` | `PENDING`, `MATCHED`, `MATCH_FAILED`, `REVIEW_REQUIRED` |
| `OwnerStoreMatchStatus` | `PENDING_REVIEW`, `AUTO_MATCHED`, `MANUALLY_CONFIRMED`, `REJECTED` |
| `LiveStatusSource` | `OWNER_POS`, `SYSTEM`, `ADMIN` |
| `CongestionLevel` | `RELAXED`, `NORMAL`, `BUSY`, `VERY_BUSY`, `UNKNOWN` |
| `BusinessVerificationType` | `AUTO_NTS`, `MANUAL_ADMIN` |
| `MapVerificationQueryType` | `NAME_AND_ADDRESS`, `ADDRESS_ONLY` |

## 16. Notes

- `GET /api/v1/stores/{storeId}/reviews` validates `sort` in code and accepts only
  `latest`, `rating_desc`, and `rating_asc`.
- `GET /api/v1/files/view` does not return `ApiResponse`; it returns a 302 redirect.
- Several owner/admin endpoints have backward-compatible alias paths. Both forms are
  supported by the controller mappings today.
- Some authorization and business rules are enforced in the service layer, not only in
  `SecurityConfig`. This document intentionally reflects the current code surface, not a
  separate contract target.

