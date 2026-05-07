import type { AuthTokenResponse, MeResponse, SignupResponse } from './types';

export const MOCK_USER_CREDENTIALS = {
  email: 'mock.user@toggle.app',
  password: 'Toggle1234!',
};

const mockUser = {
  id: 10001,
  email: MOCK_USER_CREDENTIALS.email,
  nickname: '토글유저',
  displayName: '토글유저',
  role: 'USER' as const,
  status: 'ACTIVE',
};

export const createMockAuthResponse = (): AuthTokenResponse => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: mockUser,
});

export const createMockMeResponse = (): MeResponse => ({
  ...mockUser,
  favorites: {
    stores: [],
    publics: [],
  },
  mapProfile: {
    publicMapUuid: 'mock-public-map-10001',
    isPublic: true,
    title: '토글유저의 마이지도',
    description: '개발용 목데이터 계정입니다.',
    profileImageUrl: null,
  },
});

export const createMockSignupResponse = (): SignupResponse => ({
  userId: mockUser.id,
  email: mockUser.email,
  nickname: mockUser.nickname,
  displayName: mockUser.displayName,
  role: mockUser.role,
  status: mockUser.status,
  createdAt: new Date('2026-05-06T00:00:00.000Z').toISOString(),
});

export const isMockCredential = (email: string, password: string) => {
  return email.trim().toLowerCase() === MOCK_USER_CREDENTIALS.email && password === MOCK_USER_CREDENTIALS.password;
};
