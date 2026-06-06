import { Redirect, useLocalSearchParams, usePathname } from 'expo-router';

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') {
      searchParams.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export default function NotFoundRoute() {
  const pathname = usePathname();
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;

  if (pathname?.startsWith('/--/')) {
    const normalizedPath = pathname.replace(/^\/--/, '');
    return <Redirect href={`${normalizedPath}${buildQueryString(params)}` as never} />;
  }

  return <Redirect href="/" />;
}
