import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = '/api-docs';
  return NextResponse.redirect(url);
}
