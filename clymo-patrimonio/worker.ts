import application from 'vinext/server/fetch-handler';

type Environment = { ASSETS: { fetch(request: Request): Promise<Response> } };

// Workers running before assets must explicitly dispatch immutable client files.
// Unknown static paths return the asset binding's 404, never an application page.
export default {
  async fetch(request: Request, env: Environment, context: unknown) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/_next/static/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      return env.ASSETS.fetch(request);
    }
    return application.fetch(request, env, context);
  },
};
