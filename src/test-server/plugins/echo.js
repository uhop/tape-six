export async function echo() {
  return {
    name: 'echo',
    prefix: '/--echo',
    async fetch(request) {
      const url = new URL(request.url),
        method = request.method.toUpperCase(),
        hasBody = method != 'GET' && method != 'HEAD';
      return Response.json({
        method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(request.headers),
        body: hasBody ? await request.text() : null
      });
    }
  };
}

export default echo;
