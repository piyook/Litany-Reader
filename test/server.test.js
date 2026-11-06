import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { server } = require('../server.js');

let base;
const get = (p, init) => fetch(base + p, init);

beforeAll(async () => {
  // Port 0: any free port, so the tests never clash with a running reader.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('the API', () => {
  it.each(['/api/index.json', '/api/litanies'])('lists the litanies at %s', async (p) => {
    const res = await get(p);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const items = await res.json();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['author', 'id', 'title']);
  });

  it('gives one litany at both its paths', async () => {
    const [first] = await (await get('/api/index.json')).json();
    const id = encodeURIComponent(first.id);
    const a = await (await get(`/api/litany/${id}.json`)).json();
    const b = await (await get(`/api/litanies/${id}`)).json();
    expect(a.title).toBe(first.title);
    expect(a.lines.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it.each([
    '/api/litany/no-such-litany.txt.json',
    '/api/litanies/no-such-litany.txt',
    '/api/litany/..%2Fpackage.json.json',
    '/api/litanies/..%2F..%2Fserver.js',
  ])('answers 404 for %s', async (p) => {
    const res = await get(p);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('the static files', () => {
  it.each([
    ['/', 'text/html; charset=utf-8'],
    ['/index.html', 'text/html; charset=utf-8'],
    ['/app.js', 'text/javascript; charset=utf-8'],
    ['/style.css', 'text/css; charset=utf-8'],
    ['/icon-192.png', 'image/png'],
    ['/manifest.webmanifest', 'application/manifest+json'],
  ])('serves %s as %s', async (p, type) => {
    const res = await get(p);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(type);
  });

  it('answers 404 for a file that is not there', async () => {
    const res = await get('/no-such-file.html');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  it('refuses a path that climbs out of public/', async () => {
    const res = await get('/..%2Fserver.js');
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
  });
});

describe('other requests', () => {
  it('refuses to shut down without the token', async () => {
    const res = await get('/__shutdown', { method: 'POST', headers: { 'X-Litany-Token': 'wrong' } });
    expect(res.status).toBe(403);
  });

  it('answers 500, not a crash, for a path it can not decode', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get('/%E0%A4%A');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Server error' });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
});
