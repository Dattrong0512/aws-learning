// Saved content remains readable for compatibility; publishing happens through Git.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/content") {
      if (!["GET", "HEAD"].includes(request.method)) {
        return new Response("Read-only website", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }
      const data = await env.SR.get("content-v1", "json");
      return new Response(request.method === "HEAD" ? null : JSON.stringify(data || { sections: {} }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (/^\/Exam(?:\/|$)/i.test(pathname)) {
      return new Response("This page has been removed.", { status: 410 });
    }
    if (/^\/all(?:\.html)?\/?$/.test(pathname)) {
      return new Response(null, { status: 308, headers: { Location: "/" } });
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  },
};
