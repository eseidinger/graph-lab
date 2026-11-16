export function platformCsrfToken(cookies: string): string | undefined {
  const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith('__Host-platform-csrf='));
  return cookie ? decodeURIComponent(cookie.slice('__Host-platform-csrf='.length)) : undefined;
}
