import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { tokenStore } from './tokenStore';
import type { ApiResponse } from './types';

const DEFAULT_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export type DetailedApiResponse<T> = {
  status: number;
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  timeoutMs?: number;
};

const getBaseUrl = () => {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
};

const getExpoHostBaseUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    Constants.manifest?.debuggerHost ??
    null;

  if (!hostUri) {
    return null;
  }

  try {
    const normalizedHostUri = hostUri.includes('://') ? hostUri : `http://${hostUri}`;
    const url = new URL(normalizedHostUri);
    return url.hostname ? `http://${url.hostname}:8080` : null;
  } catch {
    const host = hostUri.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    return host ? `http://${host}:8080` : null;
  }
};

const getBaseUrlCandidates = () => {
  const shouldUseDefaultBaseUrl = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const configuredBaseUrl = getBaseUrl();
  const defaultBaseUrl = shouldUseDefaultBaseUrl ? DEFAULT_API_BASE_URL : null;
  const expoHostBaseUrl = getExpoHostBaseUrl();
  const configuredBaseUrlIsLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBaseUrl);
  const nativeCandidates = configuredBaseUrlIsLoopback
    ? [expoHostBaseUrl, configuredBaseUrl, defaultBaseUrl]
    : [configuredBaseUrl, expoHostBaseUrl, defaultBaseUrl];
  const candidates = (Platform.OS === 'web'
    ? [configuredBaseUrl, defaultBaseUrl, expoHostBaseUrl]
    : nativeCandidates)
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
};

const requestWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const toQueryString = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      return;
    }

    query.append(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const parseDetailedResponse = async <T>(response: Response): Promise<DetailedApiResponse<T>> => {
  const text = await response.text();
  let parsed: ApiResponse<T> | T | string | null = null;

  if (text) {
    try {
      parsed = JSON.parse(text) as ApiResponse<T> | T;
    } catch {
      parsed = text;
    }
  }

  if (parsed && typeof parsed === 'object' && 'success' in parsed) {
    const apiResponse = parsed as ApiResponse<T>;

    return {
      status: response.status,
      success: Boolean(apiResponse.success),
      data: apiResponse.data ?? null,
      error: apiResponse.error
        ? {
            code: apiResponse.error.code ?? 'API_ERROR',
            message: apiResponse.error.message ?? '요청을 처리하지 못했습니다.',
          }
        : null,
    };
  }

  if (!response.ok) {
    return {
      status: response.status,
      success: false,
      data: null,
      error: typeof parsed === 'string' && parsed.trim()
        ? {
            code: 'HTTP_ERROR',
            message: parsed.trim(),
          }
        : {
            code: 'HTTP_ERROR',
            message: '요청을 처리하지 못했습니다.',
          },
    };
  }

  return {
    status: response.status,
    success: true,
    data: parsed as T,
    error: null,
  };
};

export const apiClient = {
  query: toQueryString,

  async requestDetailed<T>(path: string, options: RequestOptions = {}) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    let body: BodyInit | undefined;

    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    if (options.auth !== false) {
      const accessToken = await tokenStore.getAccessToken();

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    const baseUrlCandidates = getBaseUrlCandidates();
    let lastNetworkError: unknown = null;

    for (const baseUrl of baseUrlCandidates) {
      try {
        const response = await requestWithTimeout(`${baseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers,
          body,
        }, options.timeoutMs ?? 5000);

        return parseDetailedResponse<T>(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          lastNetworkError = error;
          break;
        }

        lastNetworkError = error;
      }
    }

    if (lastNetworkError instanceof Error && lastNetworkError.name === 'AbortError') {
      throw new Error('백엔드 연결이 너무 오래 걸리고 있어요. 같은 와이파이와 API 주소를 확인해주세요.');
    }

    if (lastNetworkError instanceof Error) {
      throw new Error('백엔드에 연결할 수 없습니다. API 주소와 같은 와이파이 연결을 확인해주세요.');
    }

    throw new Error('백엔드에 연결할 수 없습니다. API 주소와 같은 와이파이 연결을 확인해주세요.');
  },

  async request<T>(path: string, options: RequestOptions = {}) {
    const detailed = await apiClient.requestDetailed<T>(path, options);

    if (!detailed.success) {
      throw new ApiClientError(
        detailed.status,
        detailed.error?.code ?? 'API_ERROR',
        detailed.error?.message ?? '요청을 처리하지 못했습니다.'
      );
    }

    return detailed.data as T;
  },
};
