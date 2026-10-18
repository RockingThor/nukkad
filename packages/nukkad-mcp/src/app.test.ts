import { describe, it, expect } from 'vitest';
import { handler } from './app.js';

const urlEvent = (method: string, rawPath: string) => ({
  version: '2.0', rawPath, headers: { host: 'example.test' },
  requestContext: { http: { method, path: rawPath, sourceIp: '127.0.0.1' }, domainName: 'example.test' },
});

describe('demo reset', () => {
  it('runs for the scheduled direct invoke event', async () => {
    expect(await handler({ nukkad: 'reset' })).toEqual({ ok: true, reset: true });
  });

  it('is not reachable over the Function URL', async () => {
    const r: any = await handler(urlEvent('POST', '/api/reset'));
    expect(r.statusCode).toBe(404);
    const r2: any = await handler({ ...urlEvent('POST', '/health'), nukkad: 'reset' });
    expect(r2.reset).toBeUndefined();
  });
});

describe('reset day', () => {
  it('rolls over at 3 AM IST', async () => {
    const { resetDay } = await import('./app.js');
    expect(resetDay(Date.parse('2026-10-18T21:29:00Z'))).toBe('2026-10-18'); // 2:59 AM IST on the 19th
    expect(resetDay(Date.parse('2026-10-18T21:30:00Z'))).toBe('2026-10-19'); // 3:00 AM IST on the 19th
  });
});
