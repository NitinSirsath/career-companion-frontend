/**
 * `/api/*` on Cloudflare Pages (owner, 21 Nov 2026): the app's static files moved from Render to
 * Cloudflare Pages, and Pages cannot pass requests on to another server by itself. This passes each
 * `/api` request to the NorthList backend on Render and returns its answer as it is, like Render's
 * old rewrite: the browser keeps one address, so the sign-in cookie and the Google and Gmail
 * callbacks work unchanged. Redirects come back to the browser, not followed here.
 *
 * The backend address is the Pages project's `API_ORIGIN` setting. Only the app's project has it;
 * without it (the product site's project) there is no `/api` and the answer is 404.
 */
type Context = { request: Request; env: { API_ORIGIN?: string } };

/** Headers that describe this hop, not the visitor's request; Cloudflare and Render set their own. */
const HOP_HEADER = /^(host|cf-|x-forwarded-|x-real-ip$)/i;

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (!env.API_ORIGIN) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.API_ORIGIN);
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!HOP_HEADER.test(name)) headers.append(name, value);
  });
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const answer = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });
  return new Response(answer.body, answer);
}
