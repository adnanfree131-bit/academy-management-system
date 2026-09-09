// Cloudflare Pages Edge Function: Reverse proxy all /api/* calls (GET, POST, PUT, DELETE, PATCH, OPTIONS)
// to the production backend server, supporting streaming request body and CORS.

interface PagesContext {
  request: Request;
  env: Record<string, any>;
  next: () => Promise<Response>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const targetHost = 'https://apex-academy-backend-f0lg.onrender.com';
  const targetUrl = `${targetHost}${url.pathname}${url.search}`;

  // Preflight OPTIONS handling
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    });
  }

  // Clone headers and rewrite Host
  const reqHeaders = new Headers(context.request.headers);
  reqHeaders.set('Host', 'apex-academy-backend-f0lg.onrender.com');

  const init: RequestInit = {
    method: context.request.method,
    headers: reqHeaders,
    redirect: 'follow',
  };

  // Attach body for non-GET/HEAD methods
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
    // @ts-ignore
    init.duplex = 'half';
  }

  try {
    const backendResponse = await fetch(targetUrl, init);

    const resHeaders = new Headers(backendResponse.headers);
    resHeaders.set('Access-Control-Allow-Origin', url.origin);
    resHeaders.set('Access-Control-Allow-Credentials', 'true');
    resHeaders.set('Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    resHeaders.set('Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id');

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'BACKEND_GATEWAY_ERROR',
          message: 'Backend server is waking up or temporarily unreachable. Please retry in a moment.',
          detail: err.message,
        },
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
