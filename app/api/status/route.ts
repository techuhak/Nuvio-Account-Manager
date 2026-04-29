import { NextResponse } from 'next/server'

const GATUS_BASE = 'https://status.stremio-status.com'
const API_URL = `${GATUS_BASE}/api/v1/endpoints/statuses`

export async function GET() {
  try {
    const res = await fetch(API_URL, { cache: 'no-store' })
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
