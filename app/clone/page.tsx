'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Addon {
  id?: string; profile_id: number; url: string
  name: string | null; enabled: boolean; sort_order: number
}
interface Plugin {
  id?: string; profile_id: number; url: string
  name: string | null; enabled: boolean; sort_order: number; repo_type: string | null
}
interface Profile {
  id: string; profile_index: number; name: string; avatar_color_hex: string
}
interface SourceAccount {
  email: string; token: string; user: { id: string; email: string }
  profiles: Profile[]; addons: Addon[]; plugins: Plugin[]
  collections: unknown[] | null
  selectedProfileId: number
}
interface TargetAccount {
  id: string; email: string; password: string; profileId: number
  cloneAddons: boolean; clonePlugins: boolean; cloneCollections: boolean
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string
  addonCount?: number; pluginCount?: number; collectionCount?: number
}

type TabId = 'addons' | 'plugins' | 'collections'

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin-slow" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
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
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Reusable components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s',
        flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}>
      <div style={{
        position: 'absolute', top: 3, left: checked ? 19 : 3,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
          outline: 'none', transition: 'border-color 0.15s', width: '100%',
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: done ? 'var(--success)' : active ? 'var(--accent)' : '#1a1a24',
      border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: done || active ? '#fff' : 'var(--text-muted)',
      flexShrink: 0, transition: 'all 0.2s',
    }}>
      {done ? <CheckIcon /> : n}
    </div>
  )
}

function ItemPill({ name, subtitle, accent, tag, dimmed }: {
  name: string; subtitle: string; accent: string; tag?: string; dimmed?: boolean
}) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', opacity: dimmed ? 0.45 : 1,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#fff',
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
      </div>
      {tag && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: '#1a1a24', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
          {tag}
        </span>
      )}
    </div>
  )
}

function CollectionsPreview({ collections }: { collections: unknown[] | null }) {
  if (!collections || collections.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        No collections found on this profile
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
      {collections.map((col, i) => {
        const c = col as Record<string, unknown>
        const title = String(c.title ?? 'Untitled')
        const folders = Array.isArray(c.folders) ? c.folders : []
        const pinned = c.pinToTop === true
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {folders.length} folder{folders.length !== 1 ? 's' : ''}
                {typeof c.viewMode === 'string' ? ` · ${c.viewMode}` : ''}
              </div>
            </div>
            {pinned && (
              <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(108,99,255,0.12)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                pinned
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Toggle definitions ───────────────────────────────────────────────────────

const TOGGLE_ITEMS: { field: keyof TargetAccount; label: string; sourceKey: 'hasAddons' | 'hasPlugins' | 'hasCollections' }[] = [
  { field: 'cloneAddons',      label: 'Addons',      sourceKey: 'hasAddons' },
  { field: 'clonePlugins',     label: 'Plugins',     sourceKey: 'hasPlugins' },
  { field: 'cloneCollections', label: 'Collections', sourceKey: 'hasCollections' },
]

function TargetRow({ target, index, onUpdate, onRemove, sourceProfiles, availability, isMobile }: {
  target: TargetAccount; index: number
  onUpdate: (id: string, field: string, value: string | number | boolean) => void
  onRemove: (id: string) => void
  sourceProfiles: Profile[]
  availability: Record<string, boolean>
  isMobile: boolean
}) {
  const statusColor = {
    idle: 'var(--border)', loading: 'var(--accent)',
    success: 'var(--success)', error: 'var(--error)',
  }[target.status]
  const locked = target.status === 'loading' || target.status === 'success'

  const successParts: string[] = []
  if (target.addonCount) successParts.push(`${target.addonCount} addon${target.addonCount !== 1 ? 's' : ''}`)
  if (target.pluginCount) successParts.push(`${target.pluginCount} plugin${target.pluginCount !== 1 ? 's' : ''}`)
  if (target.collectionCount) successParts.push(`${target.collectionCount} collection${target.collectionCount !== 1 ? 's' : ''}`)

  const visibleToggles = TOGGLE_ITEMS.filter(t => availability[t.sourceKey])

  return (
    <div className="animate-slide-in" style={{
      background: '#111118', border: `1px solid ${statusColor}`,
      borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Target {index + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {target.status === 'loading' && <Spinner />}
          {target.status === 'success' && (
            <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckIcon /> {successParts.join(' · ')} synced
            </span>
          )}
          {target.status === 'error' && (
            <span style={{ fontSize: 12, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <XIcon /> {target.error}
            </span>
          )}
          <button onClick={() => onRemove(target.id)} disabled={locked}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', opacity: locked ? 0.3 : 1 }}>
            <XIcon size={12} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
        <Input label="Email" value={target.email} onChange={v => onUpdate(target.id, 'email', v)}
          placeholder="target@email.com" type="email" disabled={locked} />
        <Input label="Password" value={target.password} onChange={v => onUpdate(target.id, 'password', v)}
          placeholder="••••••••" type="password" disabled={locked} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Destination Profile
          </label>
          <select value={target.profileId} onChange={e => onUpdate(target.id, 'profileId', Number(e.target.value))}
            disabled={locked}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit',
              fontSize: 13, width: '100%', outline: 'none', opacity: locked ? 0.5 : 1,
            }}>
            {[1, 2, 3, 4, 5].map(i => {
              const label = sourceProfiles.find(p => p.profile_index === i)?.name
              return <option key={i} value={i}>Profile {i}{label ? ` — ${label}` : ''}</option>
            })}
          </select>
        </div>

        {visibleToggles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            {visibleToggles.map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: locked ? 'not-allowed' : 'pointer' }}>
                <Toggle checked={target[field] as boolean} onChange={v => onUpdate(target.id, field, v)} disabled={locked} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TabBar({ tabs, active, onChange }: {
  tabs: { id: TabId; label: string }[]
  active: TabId
  onChange: (t: TabId) => void
}) {
  if (tabs.length <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, marginBottom: 10 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: active === t.id ? '#1a1a24' : 'transparent',
            color: active === t.id ? 'var(--text)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [sourceEmail, setSourceEmail] = useState('')
  const [sourcePassword, setSourcePassword] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [source, setSource] = useState<SourceAccount | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('addons')

  const [targets, setTargets] = useState<TargetAccount[]>([{
    id: crypto.randomUUID(), email: '', password: '', profileId: 1,
    cloneAddons: true, clonePlugins: true, cloneCollections: true,
    status: 'idle',
  }])

  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')
  const [cloneDone, setCloneDone] = useState(false)

  const step = !source ? 1 : cloneDone ? 3 : 2

  async function handleSourceLogin() {
    setSourceLoading(true)
    setSourceError('')
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sourceEmail, password: sourcePassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setSource(data)
      if (data.addons?.length > 0) setActiveTab('addons')
      else if (data.plugins?.length > 0) setActiveTab('plugins')
      else if (data.collections?.length > 0) setActiveTab('collections')
    } catch (e: unknown) {
      setSourceError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setSourceLoading(false)
    }
  }

  async function handleProfileChange(profileId: number) {
    if (!source) return
    setSourceLoading(true)
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sourceEmail, password: sourcePassword, profileId }),
      })
      const data = await res.json()
      if (res.ok) setSource(data)
    } finally {
      setSourceLoading(false)
    }
  }

  const addTarget = useCallback(() => {
    setTargets(prev => [...prev, {
      id: crypto.randomUUID(), email: '', password: '', profileId: 1,
      cloneAddons: true, clonePlugins: true, cloneCollections: true,
      status: 'idle',
    }])
  }, [])

  const removeTarget = useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateTarget = useCallback((id: string, field: string, value: string | number | boolean) => {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }, [])

  async function handleClone() {
    if (!source) return
    setCloning(true)
    setCloneError('')
    setTargets(prev => prev.map(t => ({ ...t, status: 'loading' as const, error: undefined })))
    try {
      const res = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addons: source.addons,
          plugins: source.plugins,
          collections: source.collections,
          targets: targets.map(t => ({
            email: t.email, password: t.password, profileId: t.profileId,
            cloneAddons: t.cloneAddons, clonePlugins: t.clonePlugins,
            cloneCollections: t.cloneCollections,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const results = data.results as Array<{
        email: string; success: boolean; error?: string
        addonCount?: number; pluginCount?: number; collectionCount?: number
      }>

      setTargets(prev => prev.map((t, i) => {
        const r = results[i]
        return r ? {
          ...t, status: r.success ? 'success' : 'error', error: r.error,
          addonCount: r.addonCount, pluginCount: r.pluginCount,
          collectionCount: r.collectionCount,
        } : t
      }))
      setCloneDone(results.every(r => r.success))
    } catch (e: unknown) {
      setCloneError(e instanceof Error ? e.message : 'Clone failed')
      setTargets(prev => prev.map(t => ({ ...t, status: 'idle' as const })))
    } finally {
      setCloning(false)
    }
  }

  function handleReset() {
    setSource(null); setSourceEmail(''); setSourcePassword('')
    setSourceError(''); setCloneDone(false); setCloneError('')
    setTargets([{
      id: crypto.randomUUID(), email: '', password: '', profileId: 1,
      cloneAddons: true, clonePlugins: true, cloneCollections: true,
      status: 'idle',
    }])
  }

  const hasAddons      = (source?.addons?.length ?? 0) > 0
  const hasPlugins     = (source?.plugins?.length ?? 0) > 0
  const hasCollections = (source?.collections?.length ?? 0) > 0
  const availability   = { hasAddons, hasPlugins, hasCollections }
  const hasAnything    = hasAddons || hasPlugins || hasCollections

  const canClone = !cloning && targets.length > 0 &&
    targets.every(t => t.email && t.password) &&
    targets.some(t => t.status === 'idle') &&
    targets.some(t =>
      (t.cloneAddons && hasAddons) ||
      (t.clonePlugins && hasPlugins) ||
      (t.cloneCollections && hasCollections)
    )

  const sourceTabs: { id: TabId; label: string }[] = [
    hasAddons      && { id: 'addons'      as const, label: `Addons (${source?.addons.length ?? 0})` },
    hasPlugins     && { id: 'plugins'     as const, label: `Plugins (${source?.plugins.length ?? 0})` },
    hasCollections && { id: 'collections' as const, label: `Collections (${source?.collections?.length ?? 0})` },
  ].filter(Boolean) as { id: TabId; label: string }[]

  const sourceSummaryParts: string[] = []
  if (hasAddons)      sourceSummaryParts.push(`${source?.addons.length} addon${source?.addons.length !== 1 ? 's' : ''}`)
  if (hasPlugins)     sourceSummaryParts.push(`${source?.plugins.length} plugin${source?.plugins.length !== 1 ? 's' : ''}`)
  if (hasCollections) sourceSummaryParts.push(`${source?.collections?.length} collection${source?.collections?.length !== 1 ? 's' : ''}`)

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', padding: '0 16px' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at top, rgba(108,99,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 60 }}>

        {/* Back nav */}
        <div style={{ paddingTop: 24 }}>
          <button onClick={() => router.push('/')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', padding: '6px 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 7H3M6 3L2 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </button>
        </div>
        <div style={{ paddingTop: 56, paddingBottom: 48, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Nuvio Account Cloner
            </span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>
            Mirror Nuvio profiles<br />
            <span style={{ color: 'var(--accent)' }}>across accounts</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Copy addons, plugins, and collections from one Nuvio account to any number of targets — pick exactly what to migrate.
          </p>
        </div>

        {/* Step bar */}
        <div style={{
          display: 'flex', alignItems: 'center', marginBottom: 32,
          background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px',
        }}>
          {[{ n: 1, label: 'Source account' }, { n: 2, label: 'Target accounts' }, { n: 3, label: 'Done' }].map(({ n, label }, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StepBadge n={n} active={step === n} done={step > n} />
                <span style={{ fontSize: 13, fontWeight: step === n ? 700 : 500, color: step === n ? 'var(--text)' : 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 16px' }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Source ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            background: '#111118',
            border: `1px solid ${source ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 12, padding: 24, transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Source Account</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>The account to copy from</p>
              </div>
              {source && (
                <button onClick={handleReset} style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
                  padding: '6px 12px', color: 'var(--text-muted)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}>Reset</button>
              )}
            </div>

            {!source ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <Input label="Email" value={sourceEmail} onChange={setSourceEmail}
                    placeholder="you@example.com" type="email" disabled={sourceLoading} />
                  <Input label="Password" value={sourcePassword} onChange={setSourcePassword}
                    placeholder="••••••••" type="password" disabled={sourceLoading} />
                </div>
                {sourceError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XIcon /> {sourceError}
                  </div>
                )}
                <button onClick={handleSourceLogin} disabled={!sourceEmail || !sourcePassword || sourceLoading}
                  style={{
                    width: '100%', padding: '11px', background: 'var(--accent)', border: 'none',
                    borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700,
                    fontFamily: 'inherit', cursor: !sourceEmail || !sourcePassword || sourceLoading ? 'not-allowed' : 'pointer',
                    opacity: !sourceEmail || !sourcePassword ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {sourceLoading ? <><Spinner /> Signing in…</> : 'Sign in & fetch profile data'}
                </button>
              </div>
            ) : (
              <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Account badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {source.user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{source.user.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {sourceSummaryParts.join(' · ')} · {source.profiles.length} profile{source.profiles.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', color: 'var(--success)' }}><CheckIcon /></div>
                </div>

                {/* Profile selector */}
                {source.profiles.length > 1 && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      Source Profile
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {source.profiles.map(p => (
                        <button key={p.profile_index} onClick={() => handleProfileChange(p.profile_index)} disabled={sourceLoading}
                          style={{
                            background: source.selectedProfileId === p.profile_index ? 'var(--accent)' : 'var(--bg)',
                            border: `1px solid ${source.selectedProfileId === p.profile_index ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 7, padding: '7px 14px',
                            color: source.selectedProfileId === p.profile_index ? '#fff' : 'var(--text-muted)',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7,
                          }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.avatar_color_hex || '#6c63ff', flexShrink: 0 }} />
                          {p.name}
                          {sourceLoading && source.selectedProfileId === p.profile_index && <Spinner />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs + content */}
                {hasAnything ? (
                  <div>
                    <TabBar tabs={sourceTabs} active={activeTab} onChange={setActiveTab} />

                    {activeTab === 'addons' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                        {source.addons.map((a, i) => (
                          <ItemPill key={i} name={a.name || 'Unnamed'} subtitle={a.url}
                            accent={`hsl(${a.url.length * 7 % 360}, 40%, 30%)`} dimmed={!a.enabled} />
                        ))}
                      </div>
                    )}

                    {activeTab === 'plugins' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                        {source.plugins.map((p, i) => (
                          <ItemPill key={i} name={p.name || 'Unnamed'} subtitle={p.url}
                            accent={`hsl(${(p.url.length * 11 + 120) % 360}, 35%, 28%)`}
                            tag={p.repo_type ?? undefined} dimmed={!p.enabled} />
                        ))}
                      </div>
                    )}

                    {activeTab === 'collections' && <CollectionsPreview collections={source.collections} />}
                  </div>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    No data found on this profile
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Targets ── */}
        {source && (
          <div className="animate-fade-up" style={{ marginBottom: 24 }}>
            <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Target Accounts</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Use the toggles on each account to choose what gets migrated. All operations are{' '}
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>full replace</span>{' '}
                  — existing data on the target profile will be overwritten.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {targets.map((t, i) => (
                  <TargetRow key={t.id} target={t} index={i}
                    onUpdate={updateTarget} onRemove={removeTarget}
                    sourceProfiles={source.profiles}
                    availability={availability}
                    isMobile={isMobile}
                  />
                ))}
              </div>

              <button onClick={addTarget}
                style={{
                  width: '100%', padding: 10, borderRadius: 8, background: 'transparent',
                  border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                <PlusIcon /> Add target account
              </button>
            </div>
          </div>
        )}

        {/* ── Clone button ── */}
        {source && hasAnything && (
          <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cloneError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <XIcon /> {cloneError}
              </div>
            )}
            {cloneDone ? (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>All accounts synced!</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Data pushed to {targets.length} account{targets.length !== 1 ? 's' : ''}.
                </div>
                <button onClick={handleReset} style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '9px 20px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Start over</button>
              </div>
            ) : (
              <button onClick={handleClone} disabled={!canClone}
                style={{
                  width: '100%', padding: 14,
                  background: canClone ? 'var(--accent)' : '#111118',
                  border: `1px solid ${canClone ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 10, color: canClone ? '#fff' : 'var(--text-muted)',
                  fontSize: 15, fontWeight: 700, cursor: canClone ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  transition: 'all 0.15s',
                  boxShadow: canClone ? '0 0 24px rgba(108,99,255,0.25)' : 'none',
                }}>
                {cloning ? <><Spinner /> Migrating…</> : <>Push to {targets.length} account{targets.length !== 1 ? 's' : ''}</>}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          <p>Uses the official{' '}
            <a href="https://nuvioapp.space/docs?doc=cloud-api" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Nuvio Cloud API
            </a>
            {' '}· Credentials are never stored
          </p>
        </div>
      </div>
    </div>
  )
}
