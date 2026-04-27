import { NextRequest, NextResponse } from 'next/server'
import { updateProfile } from '@/lib/nuvio'

export async function POST(req: NextRequest) {
  try {
    const { token, profileId, name } = await req.json()
    if (!token || !profileId || !name?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    await updateProfile(token, profileId, name.trim())
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
