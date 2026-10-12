export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === 'www.freexpensetracker.com') {
    url.hostname = 'freexpensetracker.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  // Permanently redirect /en and /en/* to matching path without /en
  if (url.pathname === '/en' || url.pathname === '/en/') {
    url.pathname = '/';
    return Response.redirect(url.toString(), 301);
  }

  if (url.pathname.startsWith('/en/')) {
    let pathWithoutEn = url.pathname.slice(3);
    if (!pathWithoutEn.startsWith('/')) {
      pathWithoutEn = '/' + pathWithoutEn;
    }
    if (!pathWithoutEn.endsWith('/') && !pathWithoutEn.includes('.')) {
      pathWithoutEn += '/';
    }
    url.pathname = pathWithoutEn;
    return Response.redirect(url.toString(), 301);
  }

  if (url.pathname === '/404' || url.pathname === '/404/' || url.pathname === '/404.html') {
    const res = await context.next();
    return new Response(res.body, {
      status: 404,
      statusText: 'Not Found',
      headers: res.headers,
    });
  }

  return context.next();
}
