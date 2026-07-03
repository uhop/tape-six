export default async function greeting(_api, options) {
  const message = (options && options.message) || 'hello';
  return {
    prefix: '/--greeting',
    fetch: () => new Response(message)
  };
}
