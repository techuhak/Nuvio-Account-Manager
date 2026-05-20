'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'
import CollectionsPreview from './CollectionsPreview'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogSource {
  addonId: string
  type: string
  catalogId: string
}

interface NativeSource {
  provider: 'addon' | 'tmdb' | 'trakt'
  addonId?: string
  catalogId?: string
  type?: string
  tmdbId?: number
  tmdbSourceType?: string
  mediaType?: string
  title?: string
  sortBy?: string
  filters?: Record<string, unknown>
  listId?: string
  listType?: string
  username?: string
}

interface CollectionFolder {
  id: string
  title: string
  catalogSources?: CatalogSource[]
  sources?: NativeSource[]
  coverImageUrl?: string
  tileShape?: 'LANDSCAPE' | 'SQUARE' | 'POSTER'
  focusGifEnabled?: boolean
  hideTitle?: boolean
}

interface Collection {
  id: string
  title: string
  folders?: CollectionFolder[]
  pinToTop?: boolean
  viewMode?: 'FOLLOW_LAYOUT' | 'TABBED_GRID' | 'GRID'
  focusGlowEnabled?: boolean
  showAllTab?: boolean
}

interface ManifestCatalog {
  id: string
  type: string
  name?: string
}

interface AddonManifest {
  id: string
  name: string
  version?: string
  catalogs?: ManifestCatalog[]
}

interface InstalledAddon {
  url: string
  name: string | null
  manifest?: AddonManifest
  fetchError?: string
}

interface CatalogOption {
  addonId: string
  addonName: string
  type: string
  catalogId: string
  catalogName: string
  label: string
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
function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M2 7l4 4 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 4h9M5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M10 4l-.7 6.6a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9L3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 9V2M4 5l3-3 3 3M1 11v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCatalogOptions(addons: InstalledAddon[]): CatalogOption[] {
  const opts: CatalogOption[] = []
  for (const addon of addons) {
    if (!addon.manifest?.catalogs) continue
    for (const cat of addon.manifest.catalogs) {
      opts.push({
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
        type: cat.type,
        catalogId: cat.id,
        catalogName: cat.name ?? cat.id,
        label: `${addon.manifest.name} — ${cat.name ?? cat.id} (${cat.type})`,
      })
    }
  }
  return opts
}

function sourceKey(s: CatalogSource) {
  return `${s.addonId}::${s.type}::${s.catalogId}`
}

function isSourceMatched(source: CatalogSource, options: CatalogOption[]): boolean {
  return options.some(o => o.addonId === source.addonId && o.type === source.type && o.catalogId === source.catalogId)
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{
          width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
          background: checked ? '#14b8a6' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    </label>
  )
}

// ─── Segmented control ─────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{
      display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 7, padding: 3, gap: 2,
    }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: value === opt.value ? '#14b8a6' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Catalog source row ────────────────────────────────────────────────────────

function CatalogSourceRow({ source, options, onChange, onDelete }: {
  source: CatalogSource
  options: CatalogOption[]
  onChange: (updated: CatalogSource) => void
  onDelete: () => void
}) {
  const matched = isSourceMatched(source, options)
  const selectedKey = sourceKey(source)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
      background: matched ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)',
      border: `1px solid ${matched ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      <div style={{ flexShrink: 0, color: matched ? '#22c55e' : '#f59e0b', fontSize: 11 }}>
        {matched ? <CheckIcon /> : '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {options.length === 0 ? (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic',
          }}>
            No catalog sources available — sign in with an account that has addons installed
          </div>
        ) : (
        <select
          value={matched ? selectedKey : ''}
          onChange={e => {
            const opt = options.find(o => sourceKey({ addonId: o.addonId, type: o.type, catalogId: o.catalogId }) === e.target.value)
            if (opt) onChange({ addonId: opt.addonId, type: opt.type, catalogId: opt.catalogId })
          }}
          style={{
            width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 28px 5px 8px', color: 'var(--text)',
            fontFamily: 'inherit', fontSize: 11, outline: 'none', appearance: 'none', cursor: 'pointer',
          }}>
          {!matched && (
            <option value="" disabled>
              ⚠ {source.addonId} / {source.type} / {source.catalogId} — not found, pick replacement
            </option>
          )}
          {options.map(opt => {
            const k = sourceKey({ addonId: opt.addonId, type: opt.type, catalogId: opt.catalogId })
            return <option key={k} value={k}>{opt.label}</option>
          })}
        </select>
        )}
        {options.length > 0 && <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
          <ChevronDown />
        </div>}
      </div>
      <button onClick={onDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <XIcon size={11} />
      </button>
    </div>
  )
}

// ─── Folder editor ─────────────────────────────────────────────────────────────

function FolderEditor({ folder, options, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  folder: CollectionFolder
  options: CatalogOption[]
  onChange: (updated: CollectionFolder) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const sources = folder.catalogSources ?? []
  const nativeSourceCount = (folder.sources ?? []).filter(s => s.provider !== 'addon').length
  const matchedCount = sources.filter(s => isSourceMatched(s, options)).length + nativeSourceCount
  const totalCount = sources.length + nativeSourceCount

  function addSource() {
    if (options.length === 0) return
    const first = options[0]
    onChange({ ...folder, catalogSources: [...sources, { addonId: first.addonId, type: first.type, catalogId: first.catalogId }] })
  }

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Folder header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0, transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          <ChevronDown />
        </button>
        <input value={folder.title} onChange={e => onChange({ ...folder, title: e.target.value })}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }} />

        {/* Tile shape quick select */}
        <div style={{ flexShrink: 0 }}>
          <SegmentedControl
            value={folder.tileShape ?? 'LANDSCAPE'}
            options={[
              { value: 'LANDSCAPE', label: '⬛ Wide' },
              { value: 'SQUARE', label: '◼ Square' },
              { value: 'POSTER', label: '▬ Poster' },
            ]}
            onChange={v => onChange({ ...folder, tileShape: v as CollectionFolder['tileShape'] })}
          />
        </div>

        <span style={{ fontSize: 10, color: matchedCount === totalCount && totalCount > 0 ? '#22c55e' : 'var(--text-muted)', flexShrink: 0 }}>
          {matchedCount}/{totalCount}
        </span>

        {/* Move up/down */}
        <button onClick={onMoveUp} disabled={isFirst} title="Move up"
          style={{ background: 'transparent', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isFirst ? 0.3 : 1 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button onClick={onMoveDown} disabled={isLast} title="Move down"
          style={{ background: 'transparent', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isLast ? 0.3 : 1 }}>
          <ChevronDown />
        </button>

        {/* Settings toggle */}
        <button onClick={() => setShowSettings(s => !s)}
          title="Folder settings"
          style={{
            background: showSettings ? 'rgba(20,184,166,0.1)' : 'transparent',
            border: `1px solid ${showSettings ? '#14b8a6' : 'var(--border)'}`,
            borderRadius: 5, cursor: 'pointer', color: showSettings ? '#14b8a6' : 'var(--text-muted)',
            padding: '3px 6px', display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700,
          }}>
          ⚙
        </button>

        <button onClick={onDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <TrashIcon />
        </button>
      </div>

      {/* Folder settings panel */}
      {showSettings && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '12px 14px',
          background: 'rgba(20,184,166,0.03)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Cover Image URL</label>
            <input
              value={folder.coverImageUrl ?? ''}
              onChange={e => onChange({ ...folder, coverImageUrl: e.target.value || undefined })}
              placeholder="https://i.postimg.cc/..."
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 8px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#14b8a6' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
            <Toggle checked={folder.hideTitle ?? false} onChange={v => onChange({ ...folder, hideTitle: v })} label="Hide folder title" />
            <Toggle checked={folder.focusGifEnabled ?? false} onChange={v => onChange({ ...folder, focusGifEnabled: v })} label="Focus GIF enabled" />
          </div>
          {/* Cover preview */}
          {folder.coverImageUrl && (
            <div style={{ gridColumn: '1 / -1' }}>
              <img src={folder.coverImageUrl} alt="cover preview"
                style={{ height: 40, borderRadius: 5, border: '1px solid var(--border)', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sources.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
              No catalog sources yet
            </div>
          )}
          {sources.map((src, i) => (
            <CatalogSourceRow
              key={`${sourceKey(src)}-${i}`}
              source={src}
              options={options}
              onChange={updated => {
                const next = [...sources]; next[i] = updated
                onChange({ ...folder, catalogSources: next })
              }}
              onDelete={() => onChange({ ...folder, catalogSources: sources.filter((_, j) => j !== i) })}
            />
          ))}
          {(() => {
            const nativeSources = (folder.sources ?? []).filter(s => s.provider !== 'addon')
            if (nativeSources.length === 0) return null
            return (
              <div style={{ marginTop: sources.length > 0 ? 4 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>
                  Native Sources
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {nativeSources.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7,
                      background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: s.provider === 'tmdb' ? 'rgba(1,180,228,0.15)' : 'rgba(237,72,27,0.15)',
                        color: s.provider === 'tmdb' ? '#01b4e4' : '#ed481b',
                        border: `1px solid ${s.provider === 'tmdb' ? 'rgba(1,180,228,0.3)' : 'rgba(237,72,27,0.3)'}`,
                        borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                      }}>{s.provider.toUpperCase()}</span>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title ?? s.listId ?? '—'}
                      </span>
                      {(s.tmdbSourceType || s.mediaType) && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {[s.tmdbSourceType, s.mediaType].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 5 }}>
                  Managed in the Nuvio app — cannot be edited here.
                </div>
              </div>
            )
          })()}
          <button onClick={addSource} disabled={options.length === 0}
            style={{
              background: 'transparent', border: '1px dashed var(--border)', borderRadius: 6,
              padding: '5px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
              cursor: options.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <PlusIcon /> Add catalog source
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Collection card ───────────────────────────────────────────────────────────

function CollectionCard({ collection, options, onChange, onDelete, onPush, pushing, pushResult, onMoveUp, onMoveDown, isFirst, isLast }: {
  collection: Collection
  options: CatalogOption[]
  onChange: (updated: Collection) => void
  onDelete: () => void
  onPush: () => void
  pushing: boolean
  pushResult?: 'success' | 'error'
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const folders = collection.folders ?? []
  const totalSources = folders.reduce((a, f) => a + (f.catalogSources?.length ?? 0) + (f.sources?.filter(s => s.provider !== 'addon').length ?? 0), 0)
  const matchedSources = folders.reduce((a, f) => a + (f.catalogSources?.filter(s => isSourceMatched(s, options)).length ?? 0) + (f.sources?.filter(s => s.provider !== 'addon').length ?? 0), 0)
  const fullyMatched = totalSources > 0 && matchedSources === totalSources
  const pct = totalSources > 0 ? Math.round((matchedSources / totalSources) * 100) : 0
  const barColor = fullyMatched ? '#22c55e' : pct > 50 ? '#f59e0b' : '#ef4444'

  function addFolder() {
    onChange({ ...collection, folders: [...folders, { id: generateId(), title: 'New Folder', catalogSources: [], tileShape: 'LANDSCAPE', hideTitle: false, focusGifEnabled: false }] })
  }

  return (
    <div style={{
      background: '#111118', border: `1px solid ${fullyMatched ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0, transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          <ChevronDown size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={collection.title} onChange={e => onChange({ ...collection, title: e.target.value })}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, width: '100%', marginBottom: 5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: '#1a1a24', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: barColor, whiteSpace: 'nowrap' }}>
              {matchedSources}/{totalSources} sources
            </span>
          </div>
        </div>

        {/* Move up/down */}
        <button onClick={onMoveUp} disabled={isFirst} title="Move up"
          style={{ background: 'transparent', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isFirst ? 0.3 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button onClick={onMoveDown} disabled={isLast} title="Move down"
          style={{ background: 'transparent', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isLast ? 0.3 : 1 }}>
          <ChevronDown size={14} />
        </button>

        {/* Settings button */}
        <button onClick={() => setShowSettings(s => !s)}
          title="Collection settings"
          style={{
            background: showSettings ? 'rgba(20,184,166,0.1)' : 'transparent',
            border: `1px solid ${showSettings ? '#14b8a6' : 'var(--border)'}`,
            borderRadius: 6, cursor: 'pointer', color: showSettings ? '#14b8a6' : 'var(--text-muted)',
            padding: '4px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
          ⚙ Settings
        </button>

        <button onClick={onDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <TrashIcon />
        </button>
      </div>

      {/* Collection settings panel */}
      {showSettings && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '14px 16px',
          background: 'rgba(20,184,166,0.03)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* View mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>View Mode</label>
              <SegmentedControl
                value={collection.viewMode ?? 'FOLLOW_LAYOUT'}
                options={[
                  { value: 'FOLLOW_LAYOUT', label: 'Follow Layout' },
                  { value: 'TABBED_GRID', label: 'Tabbed Grid' },
                  { value: 'GRID', label: 'Grid' },
                ]}
                onChange={v => onChange({ ...collection, viewMode: v as Collection['viewMode'] })}
              />
            </div>
            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
              <Toggle checked={collection.pinToTop ?? false} onChange={v => onChange({ ...collection, pinToTop: v })} label="Pin to top" />
              <Toggle checked={collection.showAllTab ?? false} onChange={v => onChange({ ...collection, showAllTab: v })} label="Show 'All' tab" />
              <Toggle checked={collection.focusGlowEnabled ?? false} onChange={v => onChange({ ...collection, focusGlowEnabled: v })} label="Focus glow" />
            </div>
          </div>
        </div>
      )}

      {/* Folders */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {folders.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No folders yet</div>
          )}
          {folders.map((folder, i) => (
            <FolderEditor
              key={folder.id}
              folder={folder}
              options={options}
              isFirst={i === 0}
              isLast={i === folders.length - 1}
              onMoveUp={() => {
                const next = [...folders]
                const [item] = next.splice(i, 1)
                next.splice(i - 1, 0, item)
                onChange({ ...collection, folders: next })
              }}
              onMoveDown={() => {
                const next = [...folders]
                const [item] = next.splice(i, 1)
                next.splice(i + 1, 0, item)
                onChange({ ...collection, folders: next })
              }}
              onChange={updated => {
                const next = [...folders]; next[i] = updated
                onChange({ ...collection, folders: next })
              }}
              onDelete={() => onChange({ ...collection, folders: folders.filter((_, j) => j !== i) })}
            />
          ))}
          <button onClick={addFolder}
            style={{
              background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8,
              padding: '8px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <PlusIcon /> Add folder
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {folders.length} folder{folders.length !== 1 ? 's' : ''} · {totalSources} source{totalSources !== 1 ? 's' : ''}
          </span>
          {/* Settings summary badges */}
          {collection.viewMode && (
            <span style={{ fontSize: 10, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#14b8a6', padding: '1px 6px', borderRadius: 4 }}>
              {collection.viewMode.replace(/_/g, ' ')}
            </span>
          )}
          {collection.pinToTop && (
            <span style={{ fontSize: 10, background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4 }}>
              pinned
            </span>
          )}
          {collection.showAllTab && (
            <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', padding: '1px 6px', borderRadius: 4 }}>
              all tab
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pushResult === 'success' && <span style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}><CheckIcon /> Pushed</span>}
          {pushResult === 'error' && <span style={{ fontSize: 12, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}><XIcon /> Failed</span>}
          <button onClick={onPush} disabled={pushing || pushResult === 'success'}
            style={{
              background: fullyMatched ? '#22c55e' : '#14b8a6', border: 'none', borderRadius: 7,
              padding: '7px 14px', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              cursor: pushing || pushResult === 'success' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: pushing ? 0.7 : pushResult === 'success' ? 0.5 : 1,
            }}>
            {pushing ? <><Spinner /> Pushing…</> : 'Push to account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Labeled input ─────────────────────────────────────────────────────────────

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
          padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, outline: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={e => { e.target.style.borderColor = '#14b8a6' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionsBuilder() {
  const router = useRouter()
  const isMobile = useIsMobile()

  // Auth
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [selectedProfile, setSelectedProfile] = useState(1)
  const [profiles, setProfiles] = useState<{ profile_index: number; name: string }[]>([])
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [accountEmail, setAccountEmail] = useState('')

  // Data loading
  const [loadingData, setLoadingData] = useState(false)
  const [loadingManifests, setLoadingManifests] = useState(false)
  const [manifestProgress, setManifestProgress] = useState({ done: 0, total: 0 })

  // Addons + catalog options
  const [addons, setAddons] = useState<InstalledAddon[]>([])
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])

  // Collections
  const [collections, setCollections] = useState<Collection[]>([])
  const [dirty, setDirty] = useState(false)

  // Push state
  const [pushing, setPushing] = useState<string | null>(null)
  const [pushResults, setPushResults] = useState<Record<string, 'success' | 'error'>>({})

  // View mode
  const [previewMode, setPreviewMode] = useState(false)

  // ── Login ──────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoginLoading(true); setLoginError('')
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, profileId: selectedProfile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setToken(data.access_token)
      setAccountEmail(email)
      setProfiles(data.profiles ?? [])
      setCollections(data.collections ?? [])
      setDirty(false)
      await fetchManifests(data.addons ?? [])
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  async function fetchManifests(rawAddons: { url: string; name: string | null }[]) {
    setLoadingManifests(true)
    setManifestProgress({ done: 0, total: rawAddons.length })
    const updated: InstalledAddon[] = rawAddons.map(a => ({ url: a.url, name: a.name }))

    for (let i = 0; i < updated.length; i++) {
      // Attempt 1
      let success = false
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/manifest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: updated[i].url }),
          })
          const data = await res.json()
          if (res.ok) { updated[i] = { ...updated[i], manifest: data.manifest, fetchError: undefined }; success = true; break }
          else if (attempt === 1) updated[i] = { ...updated[i], fetchError: data.error }
        } catch {
          if (attempt === 1) updated[i] = { ...updated[i], fetchError: 'Failed to fetch' }
        }
        if (!success && attempt === 0) await new Promise(r => setTimeout(r, 800))
      }
      setManifestProgress({ done: i + 1, total: rawAddons.length })
      setAddons([...updated])
    }

    setCatalogOptions(buildCatalogOptions(updated))
    setAddons(updated)
    setLoadingManifests(false)
  }

  // ── Profile switch ─────────────────────────────────────────────────────────

  async function handleProfileSwitch(profileId: number) {
    if (!token) return
    setLoadingData(true); setSelectedProfile(profileId); setDirty(false); setPushResults({})
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, profileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCollections(data.collections ?? [])
    } catch (e) { console.error(e) }
    finally { setLoadingData(false) }
  }

  // ── Import JSON ────────────────────────────────────────────────────────────

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const arr: Collection[] = Array.isArray(parsed) ? parsed : [parsed]
        setCollections(prev => {
          const existingIds = new Set(prev.map(c => c.id))
          const newOnes = arr.filter(c => !existingIds.has(c.id))
          return [...prev, ...newOnes]
        })
        setDirty(true)
      } catch { alert('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Ultra MAX import ──────────────────────────────────────────────────────

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function addCollection() {
    setCollections(prev => [...prev, {
      id: generateId(), title: 'New Collection', folders: [],
      viewMode: 'FOLLOW_LAYOUT', pinToTop: false, showAllTab: false, focusGlowEnabled: false,
    }])
    setDirty(true)
  }

  function updateCollection(i: number, updated: Collection) {
    setCollections(prev => prev.map((c, j) => j === i ? updated : c))
    setDirty(true)
    setPushResults(prev => { const next = { ...prev }; delete next[updated.id]; return next })
  }

  function deleteCollection(i: number) {
    setCollections(prev => prev.filter((_, j) => j !== i))
    setDirty(true)
  }

  // ── Push ───────────────────────────────────────────────────────────────────

  async function pushCollection(col: Collection) {
    setPushing(col.id)
    try {
      const res = await fetch('/api/manage/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profileId: selectedProfile, type: 'collections', data: [col] }),
      })
      if (!res.ok) throw new Error()
      setPushResults(prev => ({ ...prev, [col.id]: 'success' }))
    } catch {
      setPushResults(prev => ({ ...prev, [col.id]: 'error' }))
    } finally { setPushing(null) }
  }

  async function pushAll() {
    setPushing('__all__')
    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 400
    const results: Record<string, 'success' | 'error'> = {}

    const serialize = (col: Collection): Collection => ({
      ...col,
      folders: (col.folders ?? []).map(f => ({ ...f, catalogSources: f.catalogSources, sources: f.sources })),
    })

    for (let i = 0; i < collections.length; i += BATCH_SIZE) {
      const batch = collections.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async col => {
        try {
          const res = await fetch('/api/manage/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, profileId: selectedProfile, type: 'collections', data: [serialize(col)] }),
          })
          results[col.id] = res.ok ? 'success' : 'error'
        } catch {
          results[col.id] = 'error'
        }
      }))
      if (i + BATCH_SIZE < collections.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    setPushResults(results)
    if (collections.every(c => results[c.id] === 'success')) setDirty(false)
    setPushing(null)
  }

  const profileName = (idx: number) => profiles.find(p => p.profile_index === idx)?.name ?? `Profile ${idx}`

  const isLoggedIn = !!token
  const totalSources = collections.reduce((a, c) => a + (c.folders ?? []).reduce((b, f) => b + (f.catalogSources?.length ?? 0) + (f.sources?.filter(s => s.provider !== 'addon').length ?? 0), 0), 0)
  const matchedSources = collections.reduce((a, c) => a + (c.folders ?? []).reduce((b, f) => b + (f.catalogSources?.filter(s => isSourceMatched(s, catalogOptions)).length ?? 0) + (f.sources?.filter(s => s.provider !== 'addon').length ?? 0), 0), 0)
  const overallPct = totalSources > 0 ? Math.round((matchedSources / totalSources) * 100) : 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', padding: '0 16px' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at top, rgba(20,184,166,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 80 }}>

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
            background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 14,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#14b8a6' }}>
              Collections Builder
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 8 }}>
            Build and edit your<br />
            <span style={{ color: '#14b8a6' }}>collections</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 520 }}>
            Sign in to load your existing collections and installed addons. Remap catalog sources to ones you have installed, configure display settings, and push back to your account.
          </p>
        </div>

        {/* ── Login ── */}
        {!isLoggedIn && (
          <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Sign in to get started</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Loads your installed addons and existing collections for this profile.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <LabeledInput label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" disabled={loginLoading} />
              <LabeledInput label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" disabled={loginLoading} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Profile</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setSelectedProfile(i)}
                    style={{
                      background: selectedProfile === i ? '#14b8a6' : 'var(--bg)',
                      border: `1px solid ${selectedProfile === i ? '#14b8a6' : 'var(--border)'}`,
                      borderRadius: 7, padding: '7px 16px',
                      color: selectedProfile === i ? '#fff' : 'var(--text-muted)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>Profile {i}</button>
                ))}
              </div>
            </div>
            {loginError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <XIcon /> {loginError}
              </div>
            )}
            <button onClick={handleLogin} disabled={!email || !password || loginLoading}
              style={{
                background: '#14b8a6', border: 'none', borderRadius: 8, padding: '11px 20px',
                color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: !email || !password || loginLoading ? 'not-allowed' : 'pointer',
                opacity: !email || !password ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
              {loginLoading ? <><Spinner /> Loading…</> : 'Load collections & addons'}
            </button>
          </div>
        )}

        {/* ── Manifest progress ── */}
        {loadingManifests && (
          <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Spinner />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Fetching addon manifests… ({manifestProgress.done}/{manifestProgress.total})
              </div>
              <div style={{ height: 4, background: '#1a1a24', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#14b8a6', borderRadius: 2,
                  width: `${manifestProgress.total > 0 ? Math.round((manifestProgress.done / manifestProgress.total) * 100) : 0}%`,
                  transition: 'width 0.2s',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Main dashboard ── */}
        {isLoggedIn && !loadingManifests && (
          <>
            {/* Landscape tip — touch devices only */}
            {typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.2)',
                borderRadius: 8, padding: '9px 14px', marginBottom: 12,
                fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M8 1v14M1 8h14" stroke="#14b8a6" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
                  <rect x="3" y="5" width="6" height="10" rx="1.5" stroke="#14b8a6" strokeWidth="1.3" transform="rotate(-90 3 5) translate(-2 -2)"/>
                </svg>
                <span>This page works best in <strong style={{ color: '#14b8a6' }}>landscape mode</strong>. Rotating your device gives you more room to see and edit your collections.</span>
              </div>
            )}

            {/* Account bar */}
            <div style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              background: '#111118', border: '1px solid rgba(20,184,166,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 20,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {accountEmail[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accountEmail}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {addons.filter(a => a.manifest).length} addons · {catalogOptions.length} catalog sources available
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', width: '100%' }}>
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => handleProfileSwitch(i)} disabled={loadingData}
                    style={{
                      background: selectedProfile === i ? '#14b8a6' : 'transparent',
                      border: `1px solid ${selectedProfile === i ? '#14b8a6' : 'var(--border)'}`,
                      borderRadius: 6, padding: '4px 10px',
                      color: selectedProfile === i ? '#fff' : 'var(--text-muted)',
                      fontSize: 11, fontWeight: 600, cursor: loadingData ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>{profileName(i)}</button>
                ))}
                <button onClick={() => { setToken(''); setEmail(''); setPassword(''); setAddons([]); setCatalogOptions([]); setCollections([]); setAccountEmail(''); setProfiles([]) }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
                  Sign out
                </button>
              </div>
            </div>

            {/* No catalog sources warning */}
            {catalogOptions.length === 0 && addons.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 10, padding: '14px 16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                    No catalog sources found
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Your installed addons don't appear to provide any catalogs. Catalog sources are what power collection folders — without them, folders will appear empty in Nuvio.
                    Make sure your addons are active and configured in the Nuvio app, then sign out and back in to reload.
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>{collections.length}</strong> collection{collections.length !== 1 ? 's' : ''}
                </span>
                {totalSources > 0 && (
                  <span style={{ fontSize: 13, color: overallPct === 100 ? '#22c55e' : 'var(--text-muted)' }}>
                    · <strong style={{ color: overallPct === 100 ? '#22c55e' : 'var(--text)' }}>{overallPct}%</strong> sources matched
                  </span>
                )}
                {dirty && (
                  <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '2px 8px', borderRadius: 10 }}>
                    unsaved changes
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Preview toggle */}
                {collections.length > 0 && (
                  <button onClick={() => setPreviewMode(m => !m)}
                    style={{
                      background: previewMode ? 'rgba(20,184,166,0.12)' : 'transparent',
                      border: `1px solid ${previewMode ? '#14b8a6' : 'var(--border)'}`,
                      borderRadius: 7, padding: '7px 12px',
                      color: previewMode ? '#14b8a6' : 'var(--text-muted)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                    }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1" y="2" width="4.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      <rect x="7.5" y="2" width="4.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      <rect x="7.5" y="7" width="4.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                    {previewMode ? 'Hide preview' : 'Preview layout'}
                  </button>
                )}
                {/* Ultra MAX — external link */}
                <a href="https://max-streams.gleeze.com" target="_blank" rel="noopener noreferrer"
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
                    padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700,
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 9L9 1M9 1H4M9 1v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Ultra MAX
                </a>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
                  padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <UploadIcon /> Import JSON
                  <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                </label>
                <button onClick={addCollection}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
                    padding: '7px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <PlusIcon /> New collection
                </button>
                {collections.length > 0 && (
                  <button onClick={pushAll} disabled={pushing === '__all__'}
                    style={{
                      background: '#14b8a6', border: 'none', borderRadius: 7,
                      padding: '7px 14px', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: pushing === '__all__' ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      opacity: pushing === '__all__' ? 0.7 : 1,
                    }}>
                    {pushing === '__all__' ? <><Spinner /> Pushing all…</> : `Push all to ${profileName(selectedProfile)}`}
                  </button>
                )}
              </div>
            </div>

            {/* Preview panel */}
            {previewMode && collections.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                  padding: '10px 14px', background: 'rgba(20,184,166,0.06)',
                  border: '1px solid rgba(20,184,166,0.2)', borderRadius: 10,
                }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="#14b8a6" strokeWidth="1.3"/>
                    <path d="M6.5 5.5v4M6.5 3.5v1" stroke="#14b8a6" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#14b8a6', fontWeight: 600 }}>
                    Drag collections or folders to reorder. Changes save to your editor automatically.
                  </span>
                </div>
                <CollectionsPreview
                  collections={collections}
                  onChange={updated => { setCollections(updated); setDirty(true) }}
                />
              </div>
            )}

            {/* Collections list */}
            {loadingData ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 10, color: 'var(--text-muted)' }}>
                <Spinner /> Loading profile data…
              </div>
            ) : collections.length === 0 ? (
              <div style={{ background: '#111118', border: '1px dashed var(--border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>No collections on this profile yet</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={addCollection}
                    style={{ background: '#14b8a6', border: 'none', borderRadius: 7, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PlusIcon /> Create one
                  </button>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <UploadIcon /> Import from JSON
                    <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {collections.map((col, i) => (
                  <CollectionCard
                    key={col.id}
                    collection={col}
                    options={catalogOptions}
                    isFirst={i === 0}
                    isLast={i === collections.length - 1}
                    onMoveUp={() => {
                      const next = [...collections]
                      const [item] = next.splice(i, 1)
                      next.splice(i - 1, 0, item)
                      setCollections(next); setDirty(true)
                    }}
                    onMoveDown={() => {
                      const next = [...collections]
                      const [item] = next.splice(i, 1)
                      next.splice(i + 1, 0, item)
                      setCollections(next); setDirty(true)
                    }}
                    onChange={updated => updateCollection(i, updated)}
                    onDelete={() => deleteCollection(i)}
                    onPush={() => pushCollection(col)}
                    pushing={pushing === col.id}
                    pushResult={pushResults[col.id]}
                  />
                ))}
              </div>
            )}

            {/* Addon manifest status */}
            {addons.length > 0 && (
              <details style={{ marginTop: 24 }}>
                <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                  Addon manifest status ({addons.filter(a => a.manifest).length}/{addons.length} loaded)
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {addons.map(addon => (
                    <div key={addon.url} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
                      background: 'var(--bg)', border: `1px solid ${addon.manifest ? 'rgba(20,184,166,0.2)' : 'var(--border)'}`,
                    }}>
                      <span style={{ color: addon.manifest ? '#14b8a6' : addon.fetchError ? 'var(--error)' : 'var(--text-muted)', flexShrink: 0 }}>
                        {addon.manifest ? <CheckIcon /> : addon.fetchError ? <XIcon /> : <Spinner />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {addon.manifest?.name ?? addon.name ?? 'Unknown'}
                        </div>
                        {addon.manifest && (
                          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {addon.manifest.id} · {addon.manifest.catalogs?.length ?? 0} catalogs
                          </div>
                        )}
                        {addon.fetchError && <div style={{ fontSize: 10, color: 'var(--error)' }}>{addon.fetchError}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
