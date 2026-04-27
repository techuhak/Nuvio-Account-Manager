import { NextRequest, NextResponse } from 'next/server'
import {
  stremioLogin,
  stremioGetAddons,
  stremioGetLibrary,
  stremioAddonToNuvio,
  stremioLibraryToNuvioLibrary,
  stremioLibraryToNuvioWatchHistory,
  stremioLibraryToNuvioWatchProgress,
} from '@/lib/stremio'

export async function POST(req: NextRequest) {
  try {
    const { action, email, password, authKey } = await req.json()

    switch (action) {

      case 'login': {
        if (!email || !password) {
          return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
        }
        const auth = await stremioLogin(email, password)
        return NextResponse.json({ authKey: auth.authKey, user: auth.user })
      }

      case 'load': {
        if (!authKey) {
          return NextResponse.json({ error: 'authKey required' }, { status: 400 })
        }
        const [addons, library] = await Promise.all([
          stremioGetAddons(authKey),
          stremioGetLibrary(authKey),
        ])

        const nuvioAddons = addons
          .filter(a => a.transportUrl)
          .map(stremioAddonToNuvio)

        const nuvioLibrary = stremioLibraryToNuvioLibrary(library)
        const nuvioWatchHistory = stremioLibraryToNuvioWatchHistory(library)
        const nuvioWatchProgress = stremioLibraryToNuvioWatchProgress(library)

        return NextResponse.json({
          addons: nuvioAddons,
          rawAddons: addons,
          library: nuvioLibrary,
          watchHistory: nuvioWatchHistory,
          watchProgress: nuvioWatchProgress,
          stats: {
            totalAddons: addons.length,
            totalLibrary: library.length,
            watched: nuvioWatchHistory.length,
            inProgress: nuvioWatchProgress.length,
            removed: library.filter(i => i.removed).length,
          }
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
