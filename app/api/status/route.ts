import { NextResponse } from 'next/server'

const GATUS_BASE = 'https://status.stremio-status.com'
const API_URL = `${GATUS_BASE}/api/v1/endpoints/statuses`

export async function GET() {
  try {
    const res = await fetch(API_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://status.stremio-status.com/',
        'Origin': 'https://status.stremio-status.com',
      },
    })
    if (!res.ok) throw new Error(`Status API returned ${res.status}`)
    const data = await res.json()

    // Gatus returns an array of endpoint status objects
    // Each has: name, group, key, results (array of recent checks)
    // results[0] is the most recent check
    // results[0].success = true/false, results[0].duration = response time in ms
    return NextResponse.json({
      endpoints: data,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch status'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
