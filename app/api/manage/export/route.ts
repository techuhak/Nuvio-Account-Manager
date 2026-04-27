import { NextRequest, NextResponse } from 'next/server'
import {
  getProfiles, getAddons, getPlugins, getCollections,
  getWatchProgress, getWatchHistory, getLibrary
} from '@/lib/nuvio'

export async function POST(req: NextRequest) {
  try {
    const { token, profileId, email } = await req.json()
    if (!token || !profileId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const [profiles, addons, plugins, collections, watchProgress, watchHistory, library] =
      await Promise.all([
        getProfiles(token),
        getAddons(token, profileId),
        getPlugins(token, profileId),
        getCollections(token, profileId),
        getWatchProgress(token, profileId),
        getWatchHistory(token, profileId),
        getLibrary(token, profileId),
      ])

    const exportData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: email ?? 'unknown',
        profileId,
        version: '1.0',
        tool: 'Nuvio Account Manager',
      },
      profiles,
      addons,
      plugins,
      collections: collections ?? [],
      watchProgress,
      watchHistory,
      library,
    }

    return NextResponse.json(exportData)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
