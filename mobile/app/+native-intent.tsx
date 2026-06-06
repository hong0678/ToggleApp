export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'mobile://app.home');
    const normalizedPath = url.pathname.replace(/^\/--/, '');

    if (url.hostname === 'views') {
      return `/views${normalizedPath}${url.search}${url.hash}`;
    }

    if (normalizedPath.startsWith('/views/')) {
      return `${normalizedPath}${url.search}${url.hash}`;
    }

    return path;
  } catch {
    return '/';
  }
}
