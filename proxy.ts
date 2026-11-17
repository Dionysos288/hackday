import { NextResponse, type NextRequest } from 'next/server';

/* The old city address: /city.html?city=<id>&moment=vote becomes /city/<id>?moment=vote, every other parameter kept.
   Without a city it goes to Berlin, as the old page did. */
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone(), id = url.searchParams.get('city') || 'berlin';
  url.searchParams.delete('city');
  url.pathname = '/city/' + encodeURIComponent(id);
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: '/city.html' };
