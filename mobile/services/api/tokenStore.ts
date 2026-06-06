import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { AuthTokenResponse } from './types';

export type StoredAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const TOKEN_STORAGE_KEY = 'toggle_auth_tokens';
const TOKEN_FILE_NAME = 'auth-tokens.json';

let tokens: StoredAuthTokens | null = null;
let isHydrated = false;
let hydratePromise: Promise<void> | null = null;

const getTokenFileUri = () => {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${TOKEN_FILE_NAME}`;
};

const parseTokens = (value: string | null): StoredAuthTokens | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredAuthTokens>;
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const readPersistedTokens = async (): Promise<StoredAuthTokens | null> => {
  try {
    if (Platform.OS === 'web') {
      return parseTokens(globalThis.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? null);
    }

    const fileUri = getTokenFileUri();
    if (!fileUri) return null;

    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return null;

    const contents = await FileSystem.readAsStringAsync(fileUri);
    return parseTokens(contents);
  } catch {
    return null;
  }
};

const persistTokens = async (nextTokens: StoredAuthTokens) => {
  try {
    const serialized = JSON.stringify(nextTokens);

    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, serialized);
      return;
    }

    const fileUri = getTokenFileUri();
    if (!fileUri) return;

    await FileSystem.writeAsStringAsync(fileUri, serialized);
  } catch {
    // Ignore persistence failures so auth still works for the current session.
  }
};

const clearPersistedTokens = async () => {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
      return;
    }

    const fileUri = getTokenFileUri();
    if (!fileUri) return;

    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {
    // Ignore storage cleanup failures.
  }
};

const ensureHydrated = async () => {
  if (isHydrated) return;

  if (!hydratePromise) {
    hydratePromise = (async () => {
      tokens = await readPersistedTokens();
      isHydrated = true;
    })().finally(() => {
      hydratePromise = null;
    });
  }

  await hydratePromise;
};

export const tokenStore = {
  async getTokens() {
    await ensureHydrated();
    return tokens;
  },

  async getAccessToken() {
    await ensureHydrated();
    return tokens?.accessToken ?? null;
  },

  async setTokens(nextTokens: StoredAuthTokens) {
    await ensureHydrated();
    tokens = nextTokens;
    await persistTokens(nextTokens);
  },

  async setAuthResponse(auth: AuthTokenResponse) {
    await ensureHydrated();
    tokens = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    };
    await persistTokens(tokens);
  },

  async clear() {
    await ensureHydrated();
    tokens = null;
    await clearPersistedTokens();
  },
};
