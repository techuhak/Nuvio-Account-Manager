import { NextResponse } from 'next/server'

const KUMA_BASE = 'https://status.dinsden.top'
const PAGE_URL = `${KUMA_BASE}/api/status-page/stremio-addons`
const HEARTBEAT_URL = `${KUMA_BASE}/api/status-page/heartbeat/stremio-addons`

export async function GET() {
  try {
    const [pageRes, heartbeatRes] = await Promise.all([
      fetch(PAGE_URL, { cache: 'no-store' }),
      fetch(HEARTBEAT_URL, { cache: 'no-store' }),
    ])

    if (!pageRes.ok) {
      throw new Error(`Status page returned ${pageRes.status}`)
    }

    const page = await pageRes.json()
    const heartbeat = heartbeatRes.ok ? await heartbeatRes.json() : null

    // Uptime Kuma's page endpoint has status=0 as a placeholder.
    // Derive real status from the most recent heartbeat entry per monitor.
    // heartbeat.heartbeatList is keyed by monitor ID (as string).
    // heartbeat.uptimeList is keyed like "monitorId_24" for 24h uptime.
    if (heartbeat?.heartbeatList && page?.publicGroupList) {
      for (const group of page.publicGroupList) {
        for (const monitor of group.monitorList) {
          const id = String(monitor.id)
          const beats = heartbeat.heartbeatList[id]
          if (beats && beats.length > 0) {
            // Most recent heartbeat is last in array
            const latest = beats[beats.length - 1]
            monitor.status = latest.status
            monitor.latestPing = latest.ping
            monitor.latestMsg = latest.msg
          }
          // Attach uptime
          const uptimeKey = `${id}_24`
          if (heartbeat.uptimeList?.[uptimeKey] !== undefined) {
            monitor.uptime24h = heartbeat.uptimeList[uptimeKey]
          }
        }
      }
    }

    return NextResponse.json({
      page,
      heartbeat,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch status'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
