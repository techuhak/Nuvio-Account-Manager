'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StremioData {
  addons: { url: string; name: string | null; enabled: boolean }[]
  rawAddons: { transportUrl: string; manifest: { id: string; name: string; description?: string; logo?: string }; flags?: { official?: boolean; protected?: boolean } }[]
  library: unknown[]
  watchHistory: unknown[]
  watchProgress: unknown[]
  stats: {
    totalAddons: number
    totalLibrary: number
    watched: number
    inProgress: number
    removed: number
  }
}

interface MigrateOptions {
  addons: boolean
  skipOfficial: boolean
  library: boolean
  watchHistory: boolean
  watchProgress: boolean
  includeRemoved: boolean
}

interface PushResult {
  type: string
  count: number
  success: boolean
  error?: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin-slow" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function ArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function StremioLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8l8 4-8 4V8z" fill="currentColor"/>
    </svg>
  )
}
function NuvioLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 17V8l5 6 5-6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: checked ? '#f97316' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginTop: 2,
        }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{description}</div>}
      </div>
    </label>
  )
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
          outline: 'none', opacity: disabled ? 0.5 : 1, width: '100%',
        }}
        onFocus={e => { e.target.style.borderColor = '#f97316' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      background: `${accent}08`, border: `1px solid ${accent}25`,
      borderRadius: 8, padding: '12px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MigratePage() {
  const router = useRouter()
  const isMobile = useIsMobile()

  // Stremio auth
  const [stremioEmail, setStremioEmail] = useState('')
  const [stremioPassword, setStremioPassword] = useState('')
  const [stremioAuthKey, setStremioAuthKey] = useState('')
  const [stremioLoading, setStremioLoading] = useState(false)
  const [stremioError, setStremioError] = useState('')
  const [stremioData, setStremioData] = useState<StremioData | null>(null)

  // Nuvio auth
  const [nuvioEmail, setNuvioEmail] = useState('')
  const [nuvioPassword, setNuvioPassword] = useState('')
  const [nuvioToken, setNuvioToken] = useState('')
  const [nuvioProfile, setNuvioProfile] = useState(1)
  const [nuvioProfiles, setNuvioProfiles] = useState<{ profile_index: number; name: string }[]>([])
  const [nuvioLoading, setNuvioLoading] = useState(false)
  const [nuvioError, setNuvioError] = useState('')
  const [nuvioReady, setNuvioReady] = useState(false)

  // Migration options
  const [options, setOptions] = useState<MigrateOptions>({
    addons: true,
    skipOfficial: true,
    library: true,
    watchHistory: true,
    watchProgress: true,
    includeRemoved: false,
  })

  // Per-addon selection (URL → selected)
  const [selectedAddonUrls, setSelectedAddonUrls] = useState<Set<string>>(new Set())
  const [showAddonList, setShowAddonList] = useState(false)

  // Migration state
  const [migrating, setMigrating] = useState(false)
  const [results, setResults] = useState<PushResult[]>([])
  const [migrationDone, setMigrationDone] = useState(false)

  // ── Step 1: Load Stremio ──────────────────────────────────────────────────

  async function handleStremioLogin() {
    setStremioLoading(true); setStremioError('')
    try {
      // Login
      const loginRes = await fetch('/api/stremio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: stremioEmail, password: stremioPassword }),
      })
      const loginData = await loginRes.json()
      if (!loginRes.ok) throw new Error(loginData.error || 'Login failed')

      setStremioAuthKey(loginData.authKey)

      // Load all data
      const loadRes = await fetch('/api/stremio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', authKey: loginData.authKey }),
      })
      const loadData = await loadRes.json()
      if (!loadRes.ok) throw new Error(loadData.error || 'Failed to load data')

      setStremioData(loadData)

      // Default: select all non-official addons
      const defaultSelected = new Set<string>(
        loadData.rawAddons
          .filter((a: { flags?: { official?: boolean }; transportUrl: string }) => !a.flags?.official)
          .map((a: { transportUrl: string }) => a.transportUrl)
      )
      setSelectedAddonUrls(defaultSelected)
    } catch (e: unknown) {
      setStremioError(e instanceof Error ? e.message : 'Failed to connect to Stremio')
    } finally {
      setStremioLoading(false)
    }
  }

  // ── Step 2: Connect Nuvio ─────────────────────────────────────────────────

  async function handleNuvioLogin() {
    setNuvioLoading(true); setNuvioError('')
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nuvioEmail, password: nuvioPassword, profileId: nuvioProfile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setNuvioToken(data.access_token)
      setNuvioProfiles(data.profiles ?? [])
      setNuvioReady(true)
    } catch (e: unknown) {
      setNuvioError(e instanceof Error ? e.message : 'Failed to connect to Nuvio')
    } finally {
      setNuvioLoading(false)
    }
  }

  // ── Step 3: Migrate ───────────────────────────────────────────────────────

  async function handleMigrate() {
    if (!stremioData || !nuvioToken) return
    setMigrating(true); setResults([]); setMigrationDone(false)

    const pushResults: PushResult[] = []

    // ── Addons ──
    if (options.addons) {
      try {
        const addons = stremioData.addons.filter(a => selectedAddonUrls.has(a.url))
        if (addons.length > 0) {
          // Get existing Nuvio addons and merge
          const sourceRes = await fetch('/api/source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: nuvioEmail, password: nuvioPassword, profileId: nuvioProfile }),
          })
          const sourceData = await sourceRes.json()
          const existing = sourceData.addons ?? []
          const existingUrls = new Set(existing.map((a: { url: string }) => a.url))
          const newAddons = addons.filter(a => !existingUrls.has(a.url))
          const merged = [...existing, ...newAddons].map((a, i) => ({
            url: a.url, name: a.name, enabled: a.enabled ?? true, sort_order: i,
          }))

          const res = await fetch('/api/manage/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: nuvioToken, profileId: nuvioProfile, type: 'addons', data: merged }),
          })
          if (!res.ok) throw new Error('Push failed')
          pushResults.push({ type: 'Addons', count: newAddons.length, success: true })
        } else {
          pushResults.push({ type: 'Addons', count: 0, success: true })
        }
      } catch (e: unknown) {
        pushResults.push({ type: 'Addons', count: 0, success: false, error: e instanceof Error ? e.message : 'Failed' })
      }
      setResults([...pushResults])
    }

    // ── Library ──
    if (options.library) {
      try {
        let library = stremioData.library as { removed?: boolean }[]
        if (!options.includeRemoved) library = library.filter(i => !i.removed)
        if (library.length > 0) {
          const res = await fetch('/api/manage/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: nuvioToken, profileId: nuvioProfile, type: 'library', data: library }),
          })
          if (!res.ok) throw new Error('Push failed')
        }
        pushResults.push({ type: 'Library', count: library.length, success: true })
      } catch (e: unknown) {
        pushResults.push({ type: 'Library', count: 0, success: false, error: e instanceof Error ? e.message : 'Failed' })
      }
      setResults([...pushResults])
    }

    // ── Watch History ──
    if (options.watchHistory && stremioData.watchHistory.length > 0) {
      try {
        const res = await fetch('/api/manage/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: nuvioToken, profileId: nuvioProfile, type: 'watchHistory', data: stremioData.watchHistory }),
        })
        if (!res.ok) throw new Error('Push failed')
        pushResults.push({ type: 'Watch History', count: stremioData.watchHistory.length, success: true })
      } catch (e: unknown) {
        pushResults.push({ type: 'Watch History', count: 0, success: false, error: e instanceof Error ? e.message : 'Failed' })
      }
      setResults([...pushResults])
    }

    // ── Watch Progress ──
    if (options.watchProgress && stremioData.watchProgress.length > 0) {
      try {
        const res = await fetch('/api/manage/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: nuvioToken, profileId: nuvioProfile, type: 'watchProgress', data: stremioData.watchProgress }),
        })
        if (!res.ok) throw new Error('Push failed')
        pushResults.push({ type: 'Continue Watching', count: stremioData.watchProgress.length, success: true })
      } catch (e: unknown) {
        pushResults.push({ type: 'Continue Watching', count: 0, success: false, error: e instanceof Error ? e.message : 'Failed' })
      }
      setResults([...pushResults])
    }

    setMigrationDone(true)
    setMigrating(false)
  }

  const readyToMigrate = !!stremioData && nuvioReady
  const accent = '#f97316' // orange — distinct from all other pages

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', padding: '0 16px' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at top, rgba(249,115,22,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 80 }}>

        {/* Back */}
        <div style={{ paddingTop: 24 }}>
          <button onClick={() => router.push('/')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', padding: '6px 0', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3M6 3L2 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </button>
        </div>

        {/* Header */}
        <div style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 14,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>
              Stremio → Nuvio Migration
            </span>
          </div>

          {/* Visual header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#111118', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 18px',
            }}>
              <div style={{ color: '#7c3aed' }}><StremioLogo /></div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Stremio</span>
            </div>
            <div style={{ color: accent }}><ArrowRight /></div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#111118', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 18px',
            }}>
              <div style={{ color: '#22c55e' }}><NuvioLogo /></div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Nuvio</span>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 540 }}>
            Migrate your addons, library, watch history, and continue watching from Stremio into your Nuvio account. Your Stremio account is read-only — nothing there will be changed.
          </p>
        </div>

        {/* ── Two-column login ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Stremio login */}
          <div style={{
            background: '#111118', border: `1px solid ${stremioData ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ color: '#7c3aed' }}><StremioLogo /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Stremio Account</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Read-only — your data won't change</div>
              </div>
              {stremioData && (
                <div style={{ marginLeft: 'auto', color: '#22c55e' }}><CheckIcon /></div>
              )}
            </div>

            {!stremioData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <LabeledInput label="Email" value={stremioEmail} onChange={setStremioEmail} type="email" placeholder="you@example.com" disabled={stremioLoading} />
                <LabeledInput label="Password" value={stremioPassword} onChange={setStremioPassword} type="password" placeholder="••••••••" disabled={stremioLoading} />
                {stremioError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XIcon /> {stremioError}
                  </div>
                )}
                <button onClick={handleStremioLogin} disabled={!stremioEmail || !stremioPassword || stremioLoading}
                  style={{
                    background: '#7c3aed', border: 'none', borderRadius: 8, padding: '10px',
                    color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    cursor: !stremioEmail || !stremioPassword || stremioLoading ? 'not-allowed' : 'pointer',
                    opacity: !stremioEmail || !stremioPassword ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {stremioLoading ? <><Spinner /> Loading…</> : 'Connect Stremio'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stremioEmail}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <StatCard label="Addons" value={stremioData.stats.totalAddons} accent="#7c3aed" />
                  <StatCard label="Library" value={stremioData.stats.totalLibrary} accent="#7c3aed" />
                  <StatCard label="Watched" value={stremioData.stats.watched} accent="#7c3aed" />
                  <StatCard label="In Progress" value={stremioData.stats.inProgress} accent="#7c3aed" />
                </div>
                <button onClick={() => { setStremioData(null); setStremioAuthKey(''); setStremioEmail(''); setStremioPassword('') }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '6px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Nuvio login */}
          <div style={{
            background: '#111118', border: `1px solid ${nuvioReady ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ color: '#22c55e' }}><NuvioLogo /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Nuvio Account</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Destination for your migrated data</div>
              </div>
              {nuvioReady && (
                <div style={{ marginLeft: 'auto', color: '#22c55e' }}><CheckIcon /></div>
              )}
            </div>

            {!nuvioReady ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <LabeledInput label="Email" value={nuvioEmail} onChange={setNuvioEmail} type="email" placeholder="you@example.com" disabled={nuvioLoading} />
                <LabeledInput label="Password" value={nuvioPassword} onChange={setNuvioPassword} type="password" placeholder="••••••••" disabled={nuvioLoading} />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Target Profile</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[1,2,3,4].map(i => (
                      <button key={i} onClick={() => setNuvioProfile(i)}
                        style={{
                          background: nuvioProfile === i ? '#22c55e' : 'var(--bg)',
                          border: `1px solid ${nuvioProfile === i ? '#22c55e' : 'var(--border)'}`,
                          borderRadius: 7, padding: '6px 14px',
                          color: nuvioProfile === i ? '#fff' : 'var(--text-muted)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>
                        Profile {i}
                      </button>
                    ))}
                  </div>
                </div>
                {nuvioError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XIcon /> {nuvioError}
                  </div>
                )}
                <button onClick={handleNuvioLogin} disabled={!nuvioEmail || !nuvioPassword || nuvioLoading}
                  style={{
                    background: '#22c55e', border: 'none', borderRadius: 8, padding: '10px',
                    color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    cursor: !nuvioEmail || !nuvioPassword || nuvioLoading ? 'not-allowed' : 'pointer',
                    opacity: !nuvioEmail || !nuvioPassword ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {nuvioLoading ? <><Spinner /> Connecting…</> : 'Connect Nuvio'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nuvioEmail}</div>
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#22c55e',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <CheckIcon /> Ready — migrating to {nuvioProfiles.find(p => p.profile_index === nuvioProfile)?.name ?? `Profile ${nuvioProfile}`}
                </div>
                <button onClick={() => { setNuvioReady(false); setNuvioToken(''); setNuvioEmail(''); setNuvioPassword(''); setNuvioProfiles([]) }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '6px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Migration options ── */}
        {readyToMigrate && !migrationDone && (
          <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Migration options</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Choose what to migrate. Addons are merged with existing ones — nothing already in Nuvio will be removed.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Addons section with full list ── */}
              <Toggle
                checked={options.addons}
                onChange={v => setOptions(o => ({ ...o, addons: v }))}
                label={`Addons (${selectedAddonUrls.size} of ${stremioData!.stats.totalAddons} selected)`}
                description="Choose which Stremio addons to migrate. They'll be appended to your existing Nuvio addon list."
              />

              {options.addons && (
                <div style={{ marginLeft: 48 }}>
                  {/* Select all / none / toggle list */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setSelectedAddonUrls(new Set(stremioData!.rawAddons.map(a => a.transportUrl)))}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                      Select all
                    </button>
                    <button onClick={() => setSelectedAddonUrls(new Set())}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                      Select none
                    </button>
                    <button onClick={() => setSelectedAddonUrls(new Set(stremioData!.rawAddons.filter(a => !a.flags?.official).map(a => a.transportUrl)))}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                      Skip official only
                    </button>
                    <button onClick={() => setShowAddonList(s => !s)}
                      style={{ background: 'transparent', border: `1px solid ${showAddonList ? accent : 'var(--border)'}`, borderRadius: 6, padding: '4px 10px', color: showAddonList ? accent : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {showAddonList ? 'Hide list' : 'Show list'}
                    </button>
                  </div>

                  {showAddonList && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                      {stremioData!.rawAddons.map((rawAddon, i) => {
                        const url = rawAddon.transportUrl
                        const selected = selectedAddonUrls.has(url)
                        const isOfficial = rawAddon.flags?.official
                        const name = rawAddon.manifest?.name ?? url
                        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

                        return (
                          <div key={url} onClick={() => {
                            const next = new Set(selectedAddonUrls)
                            if (selected) next.delete(url)
                            else next.add(url)
                            setSelectedAddonUrls(next)
                          }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                              background: selected ? 'rgba(249,115,22,0.06)' : 'var(--bg)',
                              border: `1px solid ${selected ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
                              transition: 'background 0.1s, border-color 0.1s',
                              opacity: selected ? 1 : 0.6,
                            }}>
                            {/* Checkbox */}
                            <div style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                              background: selected ? accent : 'transparent',
                              border: `2px solid ${selected ? accent : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}>
                              {selected && (
                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                  <path d="M1.5 4.5l2.5 2.5 4-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>

                            {/* Avatar */}
                            <div style={{
                              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                              background: `hsl(${url.length * 7 % 360}, 40%, 28%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: '#fff',
                            }}>{initials}</div>

                            {/* Name + URL */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {name}
                                {isOfficial && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.05em' }}>
                                    OFFICIAL
                                  </span>
                                )}
                              </div>
                              <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                {url}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              <Toggle
                checked={options.library}
                onChange={v => setOptions(o => ({ ...o, library: v }))}
                label={`Library (${stremioData!.stats.totalLibrary} items)`}
                description="Migrate your Stremio library — movies and shows you've saved or interacted with."
              />
              {options.library && stremioData!.stats.removed > 0 && (
                <div style={{ marginLeft: 48, padding: '10px 14px', background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 8 }}>
                  <Toggle
                    checked={options.includeRemoved}
                    onChange={v => setOptions(o => ({ ...o, includeRemoved: v }))}
                    label={`Include removed items (${stremioData!.stats.removed})`}
                    description="Items you removed from your Stremio library. Off by default."
                  />
                </div>
              )}
              <Toggle
                checked={options.watchHistory}
                onChange={v => setOptions(o => ({ ...o, watchHistory: v }))}
                label={`Watch history (${stremioData!.stats.watched} titles watched)`}
                description="Migrate titles you've fully watched so they show as watched in Nuvio."
              />
              <Toggle
                checked={options.watchProgress}
                onChange={v => setOptions(o => ({ ...o, watchProgress: v }))}
                label={`Continue watching (${stremioData!.stats.inProgress} in progress)`}
                description="Migrate titles you're partway through so you can continue from where you left off."
              />
            </div>

            {/* Migrate button */}
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                ⚠️ Library, watch history, and progress will be <strong>merged</strong> with existing Nuvio data. Addons will be appended. Nothing in Nuvio will be deleted.
              </div>
              <button onClick={handleMigrate} disabled={migrating}
                style={{
                  background: accent, border: 'none', borderRadius: 10,
                  padding: '14px 28px', color: '#fff', fontSize: 15, fontWeight: 800,
                  fontFamily: 'inherit', cursor: migrating ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, opacity: migrating ? 0.7 : 1,
                }}>
                {migrating ? <><Spinner /> Migrating…</> : 'Start migration'}
              </button>
            </div>
          </div>
        )}

        {/* ── Migration progress / results ── */}
        {results.length > 0 && (
          <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {migrationDone ? '✅ Migration complete' : '⏳ Migrating…'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8,
                  background: r.success ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${r.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <span style={{ color: r.success ? '#22c55e' : 'var(--error)', flexShrink: 0 }}>
                    {r.success ? <CheckIcon /> : <XIcon />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.type}</span>
                  <span style={{ fontSize: 12, color: r.success ? '#22c55e' : 'var(--error)', fontWeight: 700 }}>
                    {r.success ? `${r.count} item${r.count !== 1 ? 's' : ''}` : r.error ?? 'Failed'}
                  </span>
                </div>
              ))}
              {migrating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Spinner /> Working…
                </div>
              )}
            </div>

            {migrationDone && (
              <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setResults([]); setMigrationDone(false) }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Migrate again with different options
                </button>
                <button onClick={() => router.push('/manage')}
                  style={{
                    background: '#22c55e', border: 'none', borderRadius: 8,
                    padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  Open Account Management →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Not ready notice ── */}
        {!readyToMigrate && !stremioLoading && !nuvioLoading && (
          <div style={{
            background: '#111118', border: '1px dashed var(--border)', borderRadius: 10,
            padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          }}>
            Connect both your Stremio and Nuvio accounts above to start the migration.
          </div>
        )}

        {/* ── Privacy note ── */}
        <div style={{ marginTop: 32, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center' }}>
          Your Stremio credentials are sent directly to the Stremio API over HTTPS and never stored anywhere.
          Your Nuvio credentials follow the same policy. Nothing is logged or retained on our servers.
        </div>
      </div>
    </div>
  )
}
