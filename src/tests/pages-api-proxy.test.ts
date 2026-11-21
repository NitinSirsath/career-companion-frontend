// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/api/[[path]].ts';

const API_ORIGIN = 'https://career-companion-api-i0lc.onrender.com';

function backendAnswers(answer: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the /api pass-on on Cloudflare Pages', () => {
  it('passes a request to the backend with its path, query, cookie and body', async () => {
    const fetchMock = backendAnswers(new Response('{"ok":true}', { status: 201 }));
    const request = new Request('https://app.northlist.site/api/mails/sync?full=1', {
      method: 'POST',
      headers: {
        cookie: 'cc_session=abc',
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.1',
      },
      body: '{"a":1}',
    });

    const answer = await onRequest({ request, env: { API_ORIGIN } });

    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe(`${API_ORIGIN}/api/mails/sync?full=1`);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('manual');
    const headers = new Headers(init?.headers);
    expect(headers.get('cookie')).toBe('cc_session=abc');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.has('cf-connecting-ip')).toBe(false);
    expect(headers.has('x-forwarded-for')).toBe(false);
    expect(headers.has('host')).toBe(false);
    expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('{"a":1}');
    expect(answer.status).toBe(201);
    expect(await answer.text()).toBe('{"ok":true}');
  });

  it('sends no body with a GET', async () => {
    const fetchMock = backendAnswers(new Response('{}'));
    await onRequest({
      request: new Request('https://app.northlist.site/api/auth/me'),
      env: { API_ORIGIN },
    });
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it('returns redirects and every sign-in cookie as they are', async () => {
    const headers = new Headers({ location: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' });
    headers.append('set-cookie', 'cc_session=new; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', 'cc_oauth_state=s; Path=/api/auth; HttpOnly; Secure');
    backendAnswers(new Response(null, { status: 302, headers }));

    const answer = await onRequest({
      request: new Request('https://app.northlist.site/api/auth/connect'),
      env: { API_ORIGIN },
    });

    expect(answer.status).toBe(302);
    expect(answer.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(answer.headers.getSetCookie()).toEqual([
      'cc_session=new; Path=/; HttpOnly; Secure; SameSite=Lax',
      'cc_oauth_state=s; Path=/api/auth; HttpOnly; Secure',
    ]);
  });

  it('answers 404 where no backend is set (the product site)', async () => {
    const fetchMock = backendAnswers(new Response('{}'));
    const answer = await onRequest({
      request: new Request('https://northlist.site/api/auth/me'),
      env: {},
    });
    expect(answer.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
