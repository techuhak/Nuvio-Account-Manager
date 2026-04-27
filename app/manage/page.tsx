'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Addon {
  id?: string; url: string; name: string | null
  enabled: boolean; sort_order: number; profile_id: number
}
interface Plugin {
  id?: string; url: string; name: string | null
  enabled: boolean; sort_order: number; repo_type: string | null; profile_id: number
}
interface Collection {
  id: string; title: string; pinToTop?: boolean
  viewMode?: string; folders?: unknown[]
}
interface Profile {
  id: string; profile_index: number; name: string; avatar_color_hex: string
  uses_primary_addons: boolean; uses_primary_plugins: boolean
}

// Stored per saved account in localStorage
interface SavedAccount {
  id: string          // uuid
  email: string
  password: string    // stored locally for silent re-auth on token expiry
  token: string
  tokenExpiry: number // epoch ms
  profiles: Profile[]
}

// Runtime working data for the active account
interface WorkingData {
  addons: Addon[]
  plugins: Plugin[]
  collections: Collection[]
  selectedProfile: number
  profileLoading: boolean
  addonSaveState: SaveState
  pluginSaveState: SaveState
  collectionSaveState: SaveState
  dirty: Record<MainTab, boolean>
}

type MainTab = 'addons' | 'plugins' | 'collections' | 'backup'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const LS_KEY = 'nuvio_accounts'
const TOKEN_TTL = 55 * 60 * 1000 // 55 min (tokens last 60, refresh slightly early)

function freshWorkingData(): WorkingData {
  return {
    addons: [], plugins: [], collections: [],
    selectedProfile: 1, profileLoading: false,
    addonSaveState: 'idle', pluginSaveState: 'idle', collectionSaveState: 'idle',
    dirty: { addons: false, plugins: false, collections: false, backup: false },
  }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveAccounts(accounts: SavedAccount[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(accounts)) } catch {}
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
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M11 4l-.8 7.2A1 1 0 0 1 9.2 12H4.8a1 1 0 0 1-1-.8L3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
function ChevronDownSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Reusable components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
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

function IconBtn({ onClick, disabled, danger, title, children, style: extraStyle }: {
  onClick: () => void; disabled?: boolean; danger?: boolean; title?: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
        padding: '5px 7px', cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? 'var(--error)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center',
        opacity: disabled ? 0.3 : 1, transition: 'border-color 0.15s, color 0.15s',
        ...extraStyle,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = danger ? 'var(--error)' : 'var(--accent)'; e.currentTarget.style.color = danger ? 'var(--error)' : 'var(--accent)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = danger ? 'var(--error)' : (extraStyle?.color as string) ?? 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

function SaveBar({ state, onSave }: { state: SaveState; onSave: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#111118', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 16,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {state === 'saved' ? (
          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckIcon /> Changes saved
          </span>
        ) : state === 'error' ? (
          <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <XIcon /> Save failed — try again
          </span>
        ) : 'Unsaved changes'}
      </span>
      <button onClick={onSave} disabled={state === 'saving' || state === 'saved'}
        style={{
          background: state === 'saved' ? 'transparent' : 'var(--accent)',
          border: state === 'saved' ? '1px solid var(--border)' : '1px solid transparent',
          borderRadius: 7, padding: '7px 16px',
          color: state === 'saved' ? 'var(--text-muted)' : '#fff',
          fontSize: 13, fontWeight: 700, cursor: state === 'saving' || state === 'saved' ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
          opacity: state === 'saving' ? 0.7 : 1,
        }}>
        {state === 'saving' ? <><Spinner /> Saving…</> : state === 'saved' ? 'Saved' : 'Save changes'}
      </button>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 2l2 2-7 7H2V9l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ItemRow({ item, index, total, onToggle, onMoveUp, onMoveDown, onDelete, onEdit, onReinstall }: {
  item: Addon | Plugin; index: number; total: number
  onToggle: () => void; onMoveUp: () => void; onMoveDown: () => void
  onDelete: () => void; onEdit: (name: string, url: string) => void
  onReinstall?: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(item.name || '')
  const [editUrl, setEditUrl] = useState(item.url)
  const [reinstalling, setReinstalling] = useState(false)
  const [reinstallResult, setReinstallResult] = useState<'success' | 'error' | null>(null)
  const name = item.name || 'Unnamed'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const isPlugin = 'repo_type' in item

  // Derive configure URL — replace /manifest.json with /configure
  const configureUrl = !isPlugin && item.url
    ? item.url.replace(/\/manifest\.json(\?.*)?$/, '/configure')
    : null

  function handleSave() {
    onEdit(editName.trim(), editUrl.trim())
    setEditing(false)
  }

  function handleCancel() {
    setEditName(item.name || '')
    setEditUrl(item.url)
    setEditing(false)
  }

  async function handleReinstall() {
    if (!onReinstall) return
    setReinstalling(true); setReinstallResult(null)
    try {
      await onReinstall()
      setReinstallResult('success')
      setTimeout(() => setReinstallResult(null), 3000)
    } catch {
      setReinstallResult('error')
      setTimeout(() => setReinstallResult(null), 3000)
    } finally { setReinstalling(false) }
  }

  return (
    <div style={{
      background: 'var(--bg)', border: `1px solid ${editing ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 8, overflow: 'hidden',
      opacity: item.enabled ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
          background: isPlugin ? `hsl(${(item.url.length * 11 + 120) % 360}, 35%, 28%)` : `hsl(${item.url.length * 7 % 360}, 40%, 30%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</div>
        </div>
        {isPlugin && (item as Plugin).repo_type && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: '#1a1a24', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
            {(item as Plugin).repo_type}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Toggle checked={item.enabled} onChange={onToggle} />
          <IconBtn onClick={onMoveUp} disabled={index === 0} title="Move up"><ChevronUp /></IconBtn>
          <IconBtn onClick={onMoveDown} disabled={index === total - 1} title="Move down"><ChevronDown /></IconBtn>
          {configureUrl && (
            <a href={configureUrl} target="_blank" rel="noopener noreferrer" title="Configure addon"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.4 2.4l1.1 1.1M9.5 9.5l1.1 1.1M9.5 3.5l1.1-1.1M2.4 10.6l1.1-1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </a>
          )}
          {onReinstall && (
            <IconBtn
              onClick={handleReinstall}
              disabled={reinstalling}
              title={reinstallResult === 'success' ? 'Reinstalled!' : reinstallResult === 'error' ? 'Failed' : 'Reinstall addon'}
              style={{ color: reinstallResult === 'success' ? '#22c55e' : reinstallResult === 'error' ? 'var(--error)' : undefined }}
            >
              {reinstalling ? (
                <svg className="animate-spin-slow" width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25"/>
                  <path d="M11.5 6.5a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ) : reinstallResult === 'success' ? (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M10.5 2.5A5 5 0 1 0 12 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10.5 2.5V5.5H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </IconBtn>
          )}
          <IconBtn onClick={() => { setEditName(item.name || ''); setEditUrl(item.url); setEditing(e => !e) }} title="Edit">
            <PencilIcon />
          </IconBtn>
          <IconBtn onClick={onDelete} danger title="Remove"><TrashIcon /></IconBtn>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '12px 12px',
          background: 'rgba(108,99,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Addon name"
              autoFocus
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7,
                padding: '8px 10px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Manifest URL</label>
            <input
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              placeholder="https://..."
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7,
                padding: '8px 10px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={!editUrl.trim()}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 7,
                padding: '7px 16px', color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: editUrl.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                opacity: editUrl.trim() ? 1 : 0.5,
              }}>
              Save
            </button>
            <button onClick={handleCancel}
              style={{
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
                padding: '7px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CollectionRow({ col, onDelete }: { col: Collection; onDelete: () => void }) {
  const folders = col.folders ?? []
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{col.title || 'Untitled'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
          {col.viewMode ? ` · ${col.viewMode}` : ''}
          {col.pinToTop ? ' · pinned' : ''}
        </div>
      </div>
      <IconBtn onClick={onDelete} danger title="Remove collection"><TrashIcon /></IconBtn>
    </div>
  )
}

function AddItemForm({ label, placeholder, onAdd, isMobile }: {
  label: string; placeholder: string; onAdd: (url: string, name: string) => void; isMobile?: boolean
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  function handleAdd() {
    if (!url.trim()) return
    onAdd(url.trim(), name.trim())
    setUrl(''); setName('')
  }
  return (
    <div style={{ background: '#111118', border: '1px dashed var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 10 }}>
        <Input label="URL" value={url} onChange={setUrl} placeholder={placeholder} />
        <Input label="Name (optional)" value={name} onChange={setName} placeholder="My Addon" />
      </div>
      <button onClick={handleAdd} disabled={!url.trim()}
        style={{
          background: url.trim() ? 'var(--accent)' : 'transparent',
          border: `1px solid ${url.trim() ? 'transparent' : 'var(--border)'}`,
          borderRadius: 7, padding: '9px 16px', color: url.trim() ? '#fff' : 'var(--text-muted)',
          fontSize: 13, fontWeight: 700, cursor: url.trim() ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
        }}>
        <PlusIcon /> Add {label.toLowerCase().replace('add ', '')}
      </button>
    </div>
  )
}

// ─── Account dropdown ─────────────────────────────────────────────────────────

function AccountDropdown({ accounts, activeId, onSwitch, onRemove }: {
  accounts: SavedAccount[]
  activeId: string
  onSwitch: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = accounts.find(a => a.id === activeId)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: '#111118', border: '1px solid var(--border)', borderRadius: 8,
          padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s',
          minWidth: 220,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: 'var(--success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {active?.email[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active?.email}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} saved
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <ChevronDownSmall />
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#111118', border: '1px solid var(--border)', borderRadius: 10,
          overflow: 'hidden', minWidth: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', cursor: 'pointer',
              background: acc.id === activeId ? 'rgba(108,99,255,0.08)' : 'transparent',
              borderLeft: `3px solid ${acc.id === activeId ? 'var(--accent)' : 'transparent'}`,
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => { if (acc.id !== activeId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (acc.id !== activeId) e.currentTarget.style.background = 'transparent' }}
            >
              <div onClick={() => { onSwitch(acc.id); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: acc.id === activeId ? 'var(--accent)' : 'var(--surface-2,#1a1a24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {acc.email[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: acc.id === activeId ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.email}
                  </div>
                  {acc.id === activeId && (
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>Active</div>
                  )}
                </div>
              </div>
              {acc.id !== activeId && (
                <button onClick={e => { e.stopPropagation(); onRemove(acc.id) }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  title="Remove account">
                  <XIcon size={12} />
                </button>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Accounts are saved locally in your browser
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add account modal ────────────────────────────────────────────────────────

function AddAccountModal({ onAdd, onClose }: {
  onAdd: (email: string, password: string) => Promise<void>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      await onAdd(email, password)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#111118', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: '100%', maxWidth: 420,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Add account</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <XIcon />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Email" value={email} onChange={setEmail} placeholder="account@email.com" type="email" disabled={loading} />
          <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" disabled={loading} />
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <XIcon /> {error}
            </div>
          )}
          <button onClick={handleSubmit} disabled={!email || !password || loading}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px',
              color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              cursor: !email || !password || loading ? 'not-allowed' : 'pointer',
              opacity: !email || !password ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading ? <><Spinner /> Signing in…</> : 'Add account'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            Your credentials are stored locally in this browser only and used to silently refresh your session when needed.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Backup tab ───────────────────────────────────────────────────────────────

interface ImportToggles {
  addons: boolean; plugins: boolean; collections: boolean
  watchProgress: boolean; watchHistory: boolean; library: boolean
}

function BackupTab({ account, profileId, isMobile }: {
  account: SavedAccount; profileId: number; isMobile: boolean
}) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<string[]>([])
  const [toggles, setToggles] = useState<ImportToggles>({
    addons: true, plugins: true, collections: true,
    watchProgress: false, watchHistory: false, library: false,
  })

  async function handleExport() {
    setExporting(true); setExportError('')
    try {
      const res = await fetch('/api/manage/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: account.token, profileId, email: account.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `nuvio-backup-${account.email.split('@')[0]}-profile${profileId}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportData(null)
    setImportError('')
    setImportDone([])
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!parsed._meta) throw new Error('Not a valid Nuvio backup file')
        setImportData(parsed)
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Invalid file')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!importData) return
    setImporting(true); setImportError(''); setImportDone([])
    try {
      const res = await fetch('/api/manage/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: account.token, profileId,
          data: importData, include: toggles,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setImportDone(result.pushed)
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const toggleItems: { key: keyof ImportToggles; label: string; count?: number; destructive?: boolean }[] = [
    { key: 'addons', label: 'Addons', count: (importData?.addons as unknown[])?.length, destructive: true },
    { key: 'plugins', label: 'Plugins', count: (importData?.plugins as unknown[])?.length, destructive: true },
    { key: 'collections', label: 'Collections', count: (importData?.collections as unknown[])?.length, destructive: true },
    { key: 'watchProgress', label: 'Watch Progress', count: (importData?.watchProgress as unknown[])?.length },
    { key: 'watchHistory', label: 'Watch History', count: (importData?.watchHistory as unknown[])?.length },
    { key: 'library', label: 'Library', count: (importData?.library as unknown[])?.length },
  ]

  const meta = importData?._meta as Record<string, string> | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Export section */}
      <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Export backup</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Downloads a complete JSON backup of profile {profileId} — addons, plugins, collections, watch progress, watch history, and library.
          </div>
        </div>
        {exportError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XIcon /> {exportError}
          </div>
        )}
        <button onClick={handleExport} disabled={exporting}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: 'inherit', cursor: exporting ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8, opacity: exporting ? 0.7 : 1,
          }}>
          {exporting ? <><Spinner /> Exporting…</> : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3M1 10v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download backup JSON
            </>
          )}
        </button>
      </div>

      {/* Import section */}
      <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Import backup</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Restore from a previously exported backup file. Choose exactly what to import — addons, plugins, and collections are full replace; watch progress and history merge without deleting existing entries.
          </div>
        </div>

        {/* File picker */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 8,
          padding: '12px 16px', cursor: 'pointer', marginBottom: 14,
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3M1 11v1a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 13, color: importFile ? 'var(--text)' : 'var(--text-muted)', fontWeight: importFile ? 600 : 400 }}>
            {importFile ? importFile.name : 'Choose backup JSON file…'}
          </span>
          <input type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>

        {importError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--error)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XIcon /> {importError}
          </div>
        )}

        {/* File info + toggles */}
        {importData && !importError && (
          <>
            {/* Backup metadata */}
            <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Backup info</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '4px 16px' }}>
                {meta?.exportedAt && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: <span style={{ color: 'var(--text)' }}>{new Date(meta.exportedAt).toLocaleString()}</span></div>}
                {meta?.exportedBy && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account: <span style={{ color: 'var(--text)' }}>{meta.exportedBy}</span></div>}
                {meta?.profileId && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Profile: <span style={{ color: 'var(--text)' }}>{meta.profileId}</span></div>}
              </div>
            </div>

            {/* Toggle what to import */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                What to import
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {toggleItems.map(({ key, label, count, destructive }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <Toggle checked={toggles[key]} onChange={v => setToggles(prev => ({ ...prev, [key]: v }))} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{label}</span>
                    {count !== undefined && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {destructive && toggles[key] && (
                      <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 6px', borderRadius: 4 }}>
                        overwrites
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Success */}
            {importDone.length > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--success)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckIcon /> Imported: {importDone.join(', ')}
              </div>
            )}

            <button onClick={handleImport} disabled={importing || !Object.values(toggles).some(Boolean)}
              style={{
                background: 'var(--success)', border: 'none', borderRadius: 8,
                padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700,
                fontFamily: 'inherit',
                cursor: importing || !Object.values(toggles).some(Boolean) ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                opacity: !Object.values(toggles).some(Boolean) ? 0.5 : importing ? 0.7 : 1,
              }}>
              {importing ? <><Spinner /> Importing…</> : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 10V2M4 7l3 3 3-3M1 10v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 7 7)"/>
                    <path d="M2 7l4 4 4-4M7 11V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Restore from backup
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Privacy note */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
        Backup files are downloaded to your device and never sent to any server other than the Nuvio API during restore.
      </div>
    </div>
  )
}

// ─── Profile button with inline rename ────────────────────────────────────────

function ProfileButton({ profile, isActive, loading, onSwitch, onRename }: {
  profile: Profile
  isActive: boolean
  loading: boolean
  onSwitch: () => void
  onRename: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!editName.trim() || editName.trim() === profile.name) { setEditing(false); return }
    setSaving(true); setError('')
    try {
      await onRename(editName.trim())
      setEditing(false)
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setEditName(profile.name) } }}
          style={{
            background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 7,
            padding: '7px 12px', color: 'var(--text)', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, outline: 'none', width: 140,
          }}
        />
        <button onClick={handleSave} disabled={saving}
          style={{ background: 'var(--success)', border: 'none', borderRadius: 6, padding: '7px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          {saving ? <Spinner /> : <CheckIcon />}
        </button>
        <button onClick={() => { setEditing(false); setEditName(profile.name) }}
          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}>
          <XIcon />
        </button>
        {error && <span style={{ fontSize: 11, color: 'var(--error)' }}>{error}</span>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={onSwitch} disabled={loading}
        style={{
          background: isActive ? 'var(--success)' : 'var(--bg)',
          border: `1px solid ${isActive ? 'var(--success)' : 'var(--border)'}`,
          borderRadius: 8, padding: '8px 16px',
          color: isActive ? '#fff' : 'var(--text-muted)',
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: profile.avatar_color_hex || '#22c55e', flexShrink: 0 }} />
        {profile.name}
        {loading && <Spinner />}
      </button>
      <button onClick={() => { setEditName(profile.name); setEditing(true) }}
        title="Rename profile"
        style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 7px', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
        <PencilIcon />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Manage() {
  const router = useRouter()
  const isMobile = useIsMobile()

  // Multi-account state
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)

  // Working data for active account
  const [working, setWorking] = useState<WorkingData>(freshWorkingData())

  // Active tab
  const [activeTab, setActiveTab] = useState<MainTab>('addons')

  // Load saved accounts from localStorage on mount
  useEffect(() => {
    const saved = loadAccounts()
    setAccounts(saved)
    if (saved.length > 0) {
      setActiveAccountId(saved[0].id)
      loadAccountData(saved[0], 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Token management ───────────────────────────────────────────────────────

  async function getValidToken(account: SavedAccount): Promise<string> {
    if (Date.now() < account.tokenExpiry) return account.token
    // Re-authenticate silently
    const res = await fetch('/api/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Re-auth failed')
    const updated = { ...account, token: data.access_token, tokenExpiry: Date.now() + TOKEN_TTL }
    setAccounts(prev => {
      const next = prev.map(a => a.id === account.id ? updated : a)
      saveAccounts(next)
      return next
    })
    return data.access_token
  }

  // ── Load account data ──────────────────────────────────────────────────────

  async function loadAccountData(account: SavedAccount, profileId: number) {
    setSwitchingAccount(true)
    setWorking(freshWorkingData())
    try {
      const token = await getValidToken(account)
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password, profileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWorking({
        addons: data.addons || [],
        plugins: data.plugins || [],
        collections: data.collections || [],
        selectedProfile: profileId,
        profileLoading: false,
        addonSaveState: 'idle', pluginSaveState: 'idle', collectionSaveState: 'idle',
        dirty: { addons: false, plugins: false, collections: false, backup: false },
      })
      // Update token in case it was refreshed
      setAccounts(prev => {
        const next = prev.map(a => a.id === account.id ? { ...a, token, profiles: data.profiles } : a)
        saveAccounts(next)
        return next
      })
    } catch (e) { console.error(e) }
    finally { setSwitchingAccount(false) }
  }

  // ── Account switching ──────────────────────────────────────────────────────

  async function handleSwitchAccount(id: string) {
    const account = accounts.find(a => a.id === id)
    if (!account || id === activeAccountId) return
    setActiveAccountId(id)
    setActiveTab('addons')
    await loadAccountData(account, 1)
  }

  // ── Add account ────────────────────────────────────────────────────────────

  async function handleAddAccount(email: string, password: string) {
    const res = await fetch('/api/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')

    const newAccount: SavedAccount = {
      id: crypto.randomUUID(),
      email, password,
      token: data.access_token,
      tokenExpiry: Date.now() + TOKEN_TTL,
      profiles: data.profiles || [],
    }
    const next = [...accounts, newAccount]
    setAccounts(next)
    saveAccounts(next)
    setActiveAccountId(newAccount.id)
    setActiveTab('addons')
    setWorking({
      addons: data.addons || [],
      plugins: data.plugins || [],
      collections: data.collections || [],
      selectedProfile: data.selectedProfileId || 1,
      profileLoading: false,
      addonSaveState: 'idle', pluginSaveState: 'idle', collectionSaveState: 'idle',
      dirty: { addons: false, plugins: false, collections: false, backup: false },
    })
  }

  // ── Remove account ─────────────────────────────────────────────────────────

  function handleRemoveAccount(id: string) {
    const next = accounts.filter(a => a.id !== id)
    setAccounts(next)
    saveAccounts(next)
    if (id === activeAccountId) {
      if (next.length > 0) {
        setActiveAccountId(next[0].id)
        loadAccountData(next[0], 1)
      } else {
        setActiveAccountId(null)
        setWorking(freshWorkingData())
      }
    }
  }

  // ── Profile switch ─────────────────────────────────────────────────────────

  async function handleProfileSwitch(profileId: number) {
    const account = accounts.find(a => a.id === activeAccountId)
    if (!account) return
    setWorking(prev => ({ ...prev, profileLoading: true, dirty: { addons: false, plugins: false, collections: false, backup: false } }))
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password, profileId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWorking({
        addons: data.addons || [],
        plugins: data.plugins || [],
        collections: data.collections || [],
        selectedProfile: profileId,
        profileLoading: false,
        addonSaveState: 'idle', pluginSaveState: 'idle', collectionSaveState: 'idle',
        dirty: { addons: false, plugins: false, collections: false, backup: false },
      })
    } catch (e) { console.error(e); setWorking(prev => ({ ...prev, profileLoading: false })) }
  }

  // ── Working data helpers ───────────────────────────────────────────────────

  const markDirty = useCallback((tab: MainTab) => {
    setWorking(prev => ({
      ...prev,
      dirty: { ...prev.dirty, [tab]: true },
      addonSaveState: tab === 'addons' ? 'idle' : prev.addonSaveState,
      pluginSaveState: tab === 'plugins' ? 'idle' : prev.pluginSaveState,
      collectionSaveState: tab === 'collections' ? 'idle' : prev.collectionSaveState,
    }))
  }, [])

  function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next
  }

  // Addons
  function toggleAddon(i: number) { setWorking(p => ({ ...p, addons: p.addons.map((a, j) => j === i ? { ...a, enabled: !a.enabled } : a) })); markDirty('addons') }
  function moveAddonUp(i: number) { setWorking(p => ({ ...p, addons: moveItem(p.addons, i, i - 1) })); markDirty('addons') }
  function moveAddonDown(i: number) { setWorking(p => ({ ...p, addons: moveItem(p.addons, i, i + 1) })); markDirty('addons') }
  function deleteAddon(i: number) { setWorking(p => ({ ...p, addons: p.addons.filter((_, j) => j !== i) })); markDirty('addons') }
  function addAddon(url: string, name: string) {
    setWorking(p => ({ ...p, addons: [...p.addons, { url, name: name || null, enabled: true, sort_order: p.addons.length, profile_id: p.selectedProfile }] }))
    markDirty('addons')
  }

  async function reinstallAddon(i: number) {
    const addon = working.addons[i]
    if (!addon?.url) throw new Error('No URL')
    // Re-fetch the manifest to get the latest version
    const res = await fetch(`/api/manifest?url=${encodeURIComponent(addon.url)}`)
    if (!res.ok) throw new Error('Failed to fetch manifest')
    const manifest = await res.json()
    if (manifest.error) throw new Error(manifest.error)
    // Update the addon name from the fresh manifest and mark dirty
    const freshName = manifest.name || addon.name
    setWorking(p => ({ ...p, addons: p.addons.map((a, j) => j === i ? { ...a, name: freshName } : a) }))
    markDirty('addons')
  }

  // Plugins
  function togglePlugin(i: number) { setWorking(p => ({ ...p, plugins: p.plugins.map((a, j) => j === i ? { ...a, enabled: !a.enabled } : a) })); markDirty('plugins') }
  function movePluginUp(i: number) { setWorking(p => ({ ...p, plugins: moveItem(p.plugins, i, i - 1) })); markDirty('plugins') }
  function movePluginDown(i: number) { setWorking(p => ({ ...p, plugins: moveItem(p.plugins, i, i + 1) })); markDirty('plugins') }
  function deletePlugin(i: number) { setWorking(p => ({ ...p, plugins: p.plugins.filter((_, j) => j !== i) })); markDirty('plugins') }
  function addPlugin(url: string, name: string) {
    setWorking(p => ({ ...p, plugins: [...p.plugins, { url, name: name || null, enabled: true, sort_order: p.plugins.length, repo_type: null, profile_id: p.selectedProfile }] }))
    markDirty('plugins')
  }

  // Collections
  function deleteCollection(i: number) { setWorking(p => ({ ...p, collections: p.collections.filter((_, j) => j !== i) })); markDirty('collections') }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function saveData(type: MainTab) {
    const account = accounts.find(a => a.id === activeAccountId)
    if (!account) return
    const setSave = (s: SaveState) => setWorking(p => ({
      ...p,
      addonSaveState: type === 'addons' ? s : p.addonSaveState,
      pluginSaveState: type === 'plugins' ? s : p.pluginSaveState,
      collectionSaveState: type === 'collections' ? s : p.collectionSaveState,
    }))
    setSave('saving')
    try {
      const token = await getValidToken(account)
      const dataMap: Partial<Record<MainTab, unknown>> = {
        addons: working.addons.map((a, i) => ({ url: a.url, name: a.name, enabled: a.enabled, sort_order: i })),
        plugins: working.plugins.map((p, i) => ({ url: p.url, name: p.name, enabled: p.enabled, sort_order: i, repo_type: p.repo_type })),
        collections: working.collections,
      }
      if (!dataMap[type]) return
      await fetch('/api/manage/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profileId: working.selectedProfile, type: type === 'collections' ? 'collections_replace' : type, data: dataMap[type] }),
      })
      setSave('saved')
      setWorking(p => ({ ...p, dirty: { ...p.dirty, [type]: false } }))
    } catch { setSave('error') }
  }

  const activeAccount = accounts.find(a => a.id === activeAccountId)
  const activeProfiles = activeAccount?.profiles ?? []

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', padding: '0 16px' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at top, rgba(34,197,94,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 60 }}>

        {/* Back nav */}
        <div style={{ paddingTop: 24 }}>
          <button onClick={() => router.push('/')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', padding: '6px 0', transition: 'color 0.15s',
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

        {/* Header */}
        <div style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 14,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)' }}>
              Account Management
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
            Manage your <span style={{ color: 'var(--success)' }}>Nuvio accounts</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            Add multiple accounts and switch between them instantly. Addons, plugins, and collections per profile.
          </p>
        </div>

        {/* No accounts yet — first login */}
        {accounts.length === 0 ? (
          <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Sign in to get started</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Add your first Nuvio account. You can add more accounts after signing in.
            </p>
            <button onClick={() => setShowAddModal(true)}
              style={{
                background: 'var(--success)', border: 'none', borderRadius: 8,
                padding: '11px 20px', color: '#fff', fontSize: 14, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
              <PlusIcon /> Add account
            </button>
          </div>
        ) : (
          <div className="animate-fade-up">

            {/* Account switcher bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10, marginBottom: 20,
            }}>
              <AccountDropdown
                accounts={accounts}
                activeId={activeAccountId!}
                onSwitch={handleSwitchAccount}
                onRemove={handleRemoveAccount}
              />
              <button onClick={() => setShowAddModal(true)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 7, transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <PlusIcon /> Add account
              </button>
            </div>

            {/* Loading overlay when switching accounts */}
            {switchingAccount ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: 'var(--text-muted)' }}>
                <Spinner /> Loading account data…
              </div>
            ) : (
              <>
                {/* Profile switcher */}
                {activeProfiles.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Profile
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {activeProfiles.map(p => (
                        <ProfileButton
                          key={p.profile_index}
                          profile={p}
                          isActive={working.selectedProfile === p.profile_index}
                          loading={working.profileLoading && working.selectedProfile === p.profile_index}
                          onSwitch={() => handleProfileSwitch(p.profile_index)}
                          onRename={async (newName) => {
                            const account = accounts.find(a => a.id === activeAccountId)
                            if (!account) return
                            const token = await getValidToken(account)
                            const res = await fetch('/api/manage/profile', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ token, profileId: p.profile_index, name: newName }),
                            })
                            if (!res.ok) throw new Error('Failed to rename')
                            // Update local account profiles
                            setAccounts(prev => {
                              const next = prev.map(a => a.id === activeAccountId
                                ? { ...a, profiles: a.profiles.map(pr => pr.profile_index === p.profile_index ? { ...pr, name: newName } : pr) }
                                : a)
                              saveAccounts(next)
                              return next
                            })
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Main tab bar */}
                <div style={{
                  display: 'flex', gap: 4, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 20,
                }}>
                  {([
                    { id: 'addons' as const, label: `Addons (${working.addons.length})` },
                    { id: 'plugins' as const, label: `Plugins (${working.plugins.length})` },
                    { id: 'collections' as const, label: `Collections (${working.collections.length})` },
                    { id: 'backup' as const, label: 'Backup' },
                  ]).map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                        background: activeTab === t.id ? '#1a1a24' : 'transparent',
                        color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                        position: 'relative',
                      }}>
                      {t.label}
                      {working.dirty[t.id] && (
                        <span style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* ── Addons tab ── */}
                {activeTab === 'addons' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {working.dirty.addons && <SaveBar state={working.addonSaveState} onSave={() => saveData('addons')} />}
                    {working.addons.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {working.addons.map((a, i) => (
                          <ItemRow key={`${a.url}-${i}`} item={a} index={i} total={working.addons.length}
                            onToggle={() => toggleAddon(i)} onMoveUp={() => moveAddonUp(i)}
                            onMoveDown={() => moveAddonDown(i)} onDelete={() => deleteAddon(i)}
                            onEdit={(name, url) => { setWorking(p => ({ ...p, addons: p.addons.map((x, j) => j === i ? { ...x, name: name || null, url } : x) })); markDirty('addons') }}
                            onReinstall={() => reinstallAddon(i)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                        No addons on this profile yet
                      </div>
                    )}
                    <AddItemForm label="Add addon" placeholder="https://v3-cinemeta.strem.io/manifest.json" onAdd={addAddon} isMobile={isMobile} />
                    <a href="https://stremio-addons.net/addons" target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.35)',
                        color: 'var(--accent)', textDecoration: 'none', transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.2)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(108,99,255,0.35)' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 2H2.5A1.5 1.5 0 0 0 1 3.5v10A1.5 1.5 0 0 0 2.5 15h11A1.5 1.5 0 0 0 15 13.5V10M10 1h5m0 0v5m0-5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Browse Addon Catalog on stremio-addons.net
                    </a>
                  </div>
                )}

                {/* ── Plugins tab ── */}
                {activeTab === 'plugins' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {working.dirty.plugins && <SaveBar state={working.pluginSaveState} onSave={() => saveData('plugins')} />}
                    {working.plugins.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {working.plugins.map((p, i) => (
                          <ItemRow key={`${p.url}-${i}`} item={p} index={i} total={working.plugins.length}
                            onToggle={() => togglePlugin(i)} onMoveUp={() => movePluginUp(i)}
                            onMoveDown={() => movePluginDown(i)} onDelete={() => deletePlugin(i)}
                            onEdit={(name, url) => { setWorking(p2 => ({ ...p2, plugins: p2.plugins.map((x, j) => j === i ? { ...x, name: name || null, url } : x) })); markDirty('plugins') }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                        No plugins on this profile yet
                      </div>
                    )}
                    <AddItemForm label="Add plugin" placeholder="https://example.com/manifest.json" onAdd={addPlugin} isMobile={isMobile} />
                    <a href="https://stremio-addons.net/addons" target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.35)',
                        color: 'var(--accent)', textDecoration: 'none', transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.2)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(108,99,255,0.35)' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 2H2.5A1.5 1.5 0 0 0 1 3.5v10A1.5 1.5 0 0 0 2.5 15h11A1.5 1.5 0 0 0 15 13.5V10M10 1h5m0 0v5m0-5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Browse Addon Catalog on stremio-addons.net
                    </a>
                  </div>
                )}

                {/* ── Collections tab ── */}
                {activeTab === 'collections' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {working.dirty.collections && <SaveBar state={working.collectionSaveState} onSave={() => saveData('collections')} />}
                    {working.collections.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {working.collections.map((c, i) => (
                          <CollectionRow key={c.id || i} col={c} onDelete={() => deleteCollection(i)} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, background: '#111118', border: '1px solid var(--border)', borderRadius: 10 }}>
                        No collections on this profile
                      </div>
                    )}
                    <div style={{ background: '#111118', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      💡 Collections are created and configured within the Nuvio app. You can delete them here to remove them from the cloud.
                    </div>
                  </div>
                )}

                {/* ── Backup tab ── */}
                {activeTab === 'backup' && (
                  <BackupTab
                    account={activeAccount!}
                    profileId={working.selectedProfile}
                    isMobile={isMobile}
                  />
                )}
              </>
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
            {' '}· Account credentials are stored locally in your browser only
          </p>
        </div>
      </div>

      {/* Add account modal */}
      {showAddModal && (
        <AddAccountModal
          onAdd={handleAddAccount}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
