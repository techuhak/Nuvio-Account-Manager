import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    // Normalise — ensure the path ends with /manifest.json, preserving any query string
    const trimmed = url.trim()
    const qIdx = trimmed.indexOf('?')
    const pathPart = (qIdx === -1 ? trimmed : trimmed.slice(0, qIdx)).replace(/\/$/, '')
    const queryPart = qIdx === -1 ? '' : trimmed.slice(qIdx)
    const manifestUrl = (pathPart.endsWith('/manifest.json') ? pathPart : pathPart + '/manifest.json') + queryPart

    const res = await fetch(manifestUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Addon returned ${res.status}` }, { status: 502 })
    }

    const manifest = await res.json()
    return NextResponse.json({ manifest, manifestUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch manifest'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
