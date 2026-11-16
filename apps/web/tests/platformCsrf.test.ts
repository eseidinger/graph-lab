import { expect, it } from 'vitest';
import { platformCsrfToken } from '../src/platformCsrf';

it('reads the platform CSRF cookie without matching similarly named cookies', () => {
  expect(platformCsrfToken('other=1; __Host-platform-csrf-extra=wrong; __Host-platform-csrf=right%2Ftoken'))
    .toBe('right/token');
  expect(platformCsrfToken('other=1')).toBeUndefined();
});
