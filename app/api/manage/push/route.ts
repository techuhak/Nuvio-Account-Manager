import { NextRequest, NextResponse } from 'next/server'
import {
  pushAddons, pushPlugins, pushCollections, getCollections,
  pushWatchProgress, pushWatchHistory, pushLibrary,
} from '@/lib/nuvio'

export async function POST(req: NextRequest) {
  try {
    const { token, profileId, type, data } = await req.json()
    if (!token || !profileId || !type || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    switch (type) {
      case 'addons':
        await pushAddons(token, profileId, data)
        break

      case 'plugins':
        await pushPlugins(token, profileId, data)
        break

      case 'collections': {
        const incoming: unknown[] = Array.isArray(data) ? data : [data]
        let existing: unknown[] = []
        try { existing = (await getCollections(token, profileId)) ?? [] } catch { /* fall back */ }
        const incomingIds = new Set(incoming.map((c) => (c as { id?: string }).id).filter(Boolean))
        const kept = existing.filter((c) => !incomingIds.has((c as { id?: string }).id ?? ''))
        await pushCollections(token, profileId, [...kept, ...incoming])
        break
      }

      case 'watchProgress':
        await pushWatchProgress(token, profileId, data)
        break

      case 'watchHistory':
        await pushWatchHistory(token, profileId, data)
        break

      case 'library':
        await pushLibrary(token, profileId, data)
        break

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
