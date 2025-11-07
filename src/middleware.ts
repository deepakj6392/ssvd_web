import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Since we're using localStorage for JWT, we can't check it in middleware
  // The auth check will be handled on the client side
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register'],
};
