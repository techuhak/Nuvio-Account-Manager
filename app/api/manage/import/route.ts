import { NextRequest, NextResponse } from 'next/server'
import {
  pushAddons, pushPlugins, pushCollections, getCollections,
  pushWatchProgress, pushWatchHistory, pushLibrary
} from '@/lib/nuvio'
import type { NuvioAddon, NuvioPlugin } from '@/lib/nuvio'

interface ImportOptions {
  token: string
  profileId: number
  data: {
    addons?: NuvioAddon[]
    plugins?: NuvioPlugin[]
    collections?: unknown[]
    watchProgress?: unknown[]
    watchHistory?: unknown[]
    library?: unknown[]
  }
  include: {
    addons: boolean
    plugins: boolean
    collections: boolean
    watchProgress: boolean
    watchHistory: boolean
    library: boolean
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, profileId, data, include }: ImportOptions = await req.json()
    if (!token || !profileId || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ops: Promise<void>[] = []
    const pushed: string[] = []

    if (include.addons && data.addons?.length) {
      const stripped = data.addons.map((a, i) => ({
        url: a.url, name: a.name, enabled: a.enabled, sort_order: i,
      }))
      ops.push(pushAddons(token, profileId, stripped))
      pushed.push(`${data.addons.length} addons`)
    }

    if (include.plugins && data.plugins?.length) {
      const stripped = data.plugins.map((p, i) => ({
        url: p.url, name: p.name, enabled: p.enabled, sort_order: i, repo_type: p.repo_type,
      }))
      ops.push(pushPlugins(token, profileId, stripped))
      pushed.push(`${data.plugins.length} plugins`)
    }

    if (include.collections && data.collections?.length) {
      const incoming = data.collections
      const mergeAndPush = async () => {
        let existing: unknown[] = []
        try { existing = (await getCollections(token, profileId)) ?? [] } catch { /* fall back to replace */ }
        const incomingIds = new Set(incoming.map((c) => (c as { id?: string }).id).filter(Boolean))
        const kept = existing.filter((c) => !incomingIds.has((c as { id?: string }).id ?? ''))
        await pushCollections(token, profileId, [...kept, ...incoming])
      }
      ops.push(mergeAndPush())
      pushed.push(`${data.collections.length} collections`)
    }

    if (include.watchProgress && data.watchProgress?.length) {
      ops.push(pushWatchProgress(token, profileId, data.watchProgress))
      pushed.push(`${data.watchProgress.length} watch progress entries`)
    }

    if (include.watchHistory && data.watchHistory?.length) {
      ops.push(pushWatchHistory(token, profileId, data.watchHistory))
      pushed.push(`${data.watchHistory.length} watch history items`)
    }

    if (include.library && data.library?.length) {
      ops.push(pushLibrary(token, profileId, data.library))
      pushed.push(`${data.library.length} library items`)
    }

    await Promise.all(ops)

    return NextResponse.json({ success: true, pushed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
