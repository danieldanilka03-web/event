import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sessionCookie } from '@/server/auth/jwt';

export async function POST() {
  (await cookies()).delete(sessionCookie.name);
  return NextResponse.json({ ok: true, data: null });
}
