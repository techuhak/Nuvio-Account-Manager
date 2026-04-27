import { NextRequest, NextResponse } from 'next/server'
import { signIn, getProfiles, getAddons, getPlugins, getCollections } from '@/lib/nuvio'

export async function POST(req: NextRequest) {
  try {
    const { email, password, profileId } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    const auth = await signIn(email, password)
    const profiles = await getProfiles(auth.access_token)
    const pid = profileId ?? 1
    const [addons, plugins, collections] = await Promise.all([
      getAddons(auth.access_token, pid),
      getPlugins(auth.access_token, pid),
      getCollections(auth.access_token, pid),
    ])
    return NextResponse.json({
      access_token: auth.access_token,
      user: auth.user,
      profiles,
      addons,
      plugins,
      collections,
      selectedProfileId: pid,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}
