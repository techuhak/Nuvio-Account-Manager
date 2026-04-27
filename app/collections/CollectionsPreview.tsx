'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionFolder {
  id: string
  title: string
  coverImageUrl?: string
  tileShape?: 'LANDSCAPE' | 'SQUARE' | 'POSTER'
  hideTitle?: boolean
}

interface Collection {
  id: string
  title: string
  folders?: CollectionFolder[]
  pinToTop?: boolean
}

interface Props {
  collections: Collection[]
  onChange: (updated: Collection[]) => void
}

// ─── Tile sizing ──────────────────────────────────────────────────────────────

const TILE_SIZES = {
  LANDSCAPE: { w: 160, h: 90 },
  SQUARE:    { w: 110, h: 110 },
  POSTER:    { w: 80,  h: 120 },
}

function getTileSize(shape?: string) {
  return TILE_SIZES[(shape as keyof typeof TILE_SIZES) ?? 'LANDSCAPE'] ?? TILE_SIZES.LANDSCAPE
}

// ─── Phone layout ─────────────────────────────────────────────────────────────
// Scaled-down version for mobile — same horizontal row concept, smaller tiles

const PHONE_TILE_SIZES = {
  LANDSCAPE: { w: 80, h: 45 },
  SQUARE:    { w: 55, h: 55 },
  POSTER:    { w: 40, h: 60 },
}

function getPhoneTileSize(shape?: string) {
  return PHONE_TILE_SIZES[(shape as keyof typeof PHONE_TILE_SIZES) ?? 'LANDSCAPE'] ?? PHONE_TILE_SIZES.LANDSCAPE
}

// ─── Folder tile ──────────────────────────────────────────────────────────────

function FolderTile({
  folder, w, h, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  folder: CollectionFolder; w: number; h: number
  isDragging: boolean; isDragOver: boolean
  onDragStart: () => void; onDragOver: () => void
  onDrop: () => void; onDragEnd: () => void
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver() }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop() }}
      onDragEnd={onDragEnd}
      data-folder-id={folder.id}
      style={{
        width: w, flexShrink: 0,
        cursor: 'grab',
        opacity: isDragging ? 0.3 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Tile image */}
      <div style={{
        width: w, height: h, borderRadius: 8, overflow: 'hidden',
        background: folder.coverImageUrl ? '#000' : 'rgba(255,255,255,0.08)',
        border: isDragOver
          ? '2px solid rgba(20,184,166,0.9)'
          : '1px solid rgba(255,255,255,0.1)',
        transition: 'border-color 0.1s',
        position: 'relative',
      }}>
        {folder.coverImageUrl ? (
          <img
            src={folder.coverImageUrl}
            alt={folder.title}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(w * 0.14), fontWeight: 800,
            color: 'rgba(255,255,255,0.18)', letterSpacing: '-0.02em',
          }}>
            {folder.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        {/* Drag-over highlight overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(20,184,166,0.15)',
            borderRadius: 7,
          }} />
        )}
      </div>
      {/* Folder label */}
      {!folder.hideTitle && (
        <div style={{
          marginTop: 5, fontSize: Math.max(9, Math.round(w * 0.08)),
          fontWeight: 600, color: 'rgba(255,255,255,0.7)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: w,
        }}>
          {folder.title}
        </div>
      )}
    </div>
  )
}

// ─── Collection row ───────────────────────────────────────────────────────────

function CollectionRow({
  collection, tileSize, isDraggingRow, isDragOverRow,
  onRowDragStart, onRowDragOver, onRowDrop,
  draggingFolderId, dragOverFolderId,
  onFolderDragStart, onFolderDragOver, onFolderDrop, onFolderDragEnd,
  titleSize, labelSize,
}: {
  collection: Collection
  tileSize: (shape?: string) => { w: number; h: number }
  isDraggingRow: boolean; isDragOverRow: boolean
  onRowDragStart: () => void; onRowDragOver: () => void; onRowDrop: () => void
  draggingFolderId: string | null; dragOverFolderId: string | null
  onFolderDragStart: (id: string) => void
  onFolderDragOver: (id: string) => void
  onFolderDrop: (id: string) => void
  onFolderDragEnd: () => void
  titleSize: number; labelSize: number
}) {
  const folders = collection.folders ?? []
  const maxH = Math.max(...folders.map(f => tileSize(f.tileShape).h), 60)
  const stripRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Auto-scroll the strip when a folder is dragged near either edge
  const handleStripDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const strip = stripRef.current
    if (!strip || !draggingFolderId) return

    const rect = strip.getBoundingClientRect()
    const ZONE = 60   // px from edge that triggers scroll
    const SPEED = 10  // px per frame

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    const x = e.clientX
    let velocity = 0
    if (x < rect.left + ZONE) velocity = -SPEED * (1 - (x - rect.left) / ZONE)
    else if (x > rect.right - ZONE) velocity = SPEED * (1 - (rect.right - x) / ZONE)

    if (velocity !== 0) {
      const scroll = () => {
        strip.scrollLeft += velocity
        rafRef.current = requestAnimationFrame(scroll)
      }
      rafRef.current = requestAnimationFrame(scroll)
    }
  }, [draggingFolderId])

  const stopScroll = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  // Clean up on unmount
  useEffect(() => () => { stopScroll() }, [stopScroll])

  return (
    <div
      onDragOver={e => { e.preventDefault(); onRowDragOver() }}
      onDrop={e => { e.preventDefault(); onRowDrop() }}
      style={{
        marginBottom: 4,
        opacity: isDraggingRow ? 0.3 : 1,
        transition: 'opacity 0.15s',
        background: isDragOverRow ? 'rgba(20,184,166,0.05)' : 'transparent',
        borderRadius: 8,
        padding: '2px 0',
      }}
    >
      {/* Row header with drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          draggable
          onDragStart={e => { e.stopPropagation(); onRowDragStart() }}
          style={{
            cursor: 'grab', color: 'rgba(255,255,255,0.25)', flexShrink: 0,
            display: 'flex', alignItems: 'center', padding: '2px 4px',
          }}
          title="Drag to reorder collection"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
            <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
            <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
          </svg>
        </div>
        <span style={{
          fontSize: titleSize, fontWeight: 700,
          color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em',
        }}>
          {collection.title}
        </span>
        {collection.pinToTop && (
          <span style={{
            fontSize: labelSize - 1, color: '#14b8a6',
            background: 'rgba(20,184,166,0.15)',
            padding: '1px 5px', borderRadius: 3, fontWeight: 700,
          }}>
            PINNED
          </span>
        )}
      </div>

      {/* Horizontal folder strip */}
      {folders.length === 0 ? (
        <div style={{
          height: 60, display: 'flex', alignItems: 'center',
          paddingLeft: 22,
          fontSize: labelSize, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic',
        }}>
          No folders
        </div>
      ) : (
        <div
          ref={stripRef}
          onDragOver={handleStripDragOver}
          onDragLeave={stopScroll}
          onDrop={stopScroll}
          style={{
            display: 'flex', gap: 10, paddingLeft: 22,
            overflowX: 'auto', paddingBottom: 8,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.15) transparent',
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
            cursor: 'default',
          }}
        >
          {folders.map(folder => {
            const { w, h } = tileSize(folder.tileShape)
            return (
              <FolderTile
                key={folder.id}
                folder={folder}
                w={w} h={h}
                isDragging={draggingFolderId === folder.id}
                isDragOver={dragOverFolderId === folder.id}
                onDragStart={() => onFolderDragStart(folder.id)}
                onDragOver={() => onFolderDragOver(folder.id)}
                onDrop={() => onFolderDrop(folder.id)}
                onDragEnd={() => { onFolderDragEnd(); stopScroll() }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Desktop mockup ───────────────────────────────────────────────────────────

function DesktopMockup({ collections, onChange }: Props) {
  const [draggingCollId, setDraggingCollId] = useState<string | null>(null)
  const [dragOverCollId, setDragOverCollId] = useState<string | null>(null)
  const [draggingFolder, setDraggingFolder] = useState<{ collectionId: string; folderId: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  function dropCollection(targetId: string) {
    if (!draggingCollId || draggingCollId === targetId) { reset(); return }
    const next = [...collections]
    const from = next.findIndex(c => c.id === draggingCollId)
    const to = next.findIndex(c => c.id === targetId)
    if (from === -1 || to === -1) { reset(); return }
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
    reset()
  }

  function dropFolder(targetFolderId: string, collectionId: string) {
    if (!draggingFolder || draggingFolder.collectionId !== collectionId) { resetFolders(); return }
    const { folderId: fromId } = draggingFolder
    if (fromId === targetFolderId) { resetFolders(); return }
    const next = collections.map(col => {
      if (col.id !== collectionId) return col
      const folders = [...(col.folders ?? [])]
      const from = folders.findIndex(f => f.id === fromId)
      const to = folders.findIndex(f => f.id === targetFolderId)
      if (from === -1 || to === -1) return col
      const [item] = folders.splice(from, 1)
      folders.splice(to, 0, item)
      return { ...col, folders }
    })
    onChange(next)
    resetFolders()
  }

  function reset() {
    setDraggingCollId(null); setDragOverCollId(null)
    setDraggingFolder(null); setDragOverFolderId(null)
    stopVerticalScroll()
  }
  function resetFolders() {
    setDraggingFolder(null); setDragOverFolderId(null)
  }

  // Vertical auto-scroll while dragging collections up/down
  const verticalRafRef = useRef<number | null>(null)

  function stopVerticalScroll() {
    if (verticalRafRef.current !== null) {
      cancelAnimationFrame(verticalRafRef.current)
      verticalRafRef.current = null
    }
  }

  function handleScreenDragOver(e: React.DragEvent) {
    e.preventDefault()
    // Only auto-scroll vertically when dragging a collection row
    if (!draggingCollId) return

    const ZONE = 80   // px from viewport edge
    const SPEED = 12  // px per frame
    const y = e.clientY
    const vh = window.innerHeight

    stopVerticalScroll()

    let velocity = 0
    if (y < ZONE) velocity = -SPEED * (1 - y / ZONE)
    else if (y > vh - ZONE) velocity = SPEED * (1 - (vh - y) / ZONE)

    if (velocity !== 0) {
      const scroll = () => {
        window.scrollBy(0, velocity)
        verticalRafRef.current = requestAnimationFrame(scroll)
      }
      verticalRafRef.current = requestAnimationFrame(scroll)
    }
  }

  useEffect(() => () => stopVerticalScroll(), [])

  return (
    <div style={{
      background: '#111', borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 0 0 2px #2a2a2a, 0 0 0 5px #111, 0 24px 60px rgba(0,0,0,0.5)',
    }}>
      {/* TV bezel top bar */}
      <div style={{
        background: '#1a1a1a', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid #222',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
          Nuvio — Collections Preview
        </div>
      </div>

      {/* App screen */}
      <div
        onDragEnd={reset}
        onDragOver={handleScreenDragOver}
        onDragLeave={stopVerticalScroll}
        style={{ background: '#0f0f18', padding: '20px 24px 28px', minHeight: 400 }}
      >
        {/* App header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Collections
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Drag folders left or right. Drag the ⠿ handle to reorder collections.
            </div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Collections */}
        {collections.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '48px 0' }}>
            No collections loaded yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {collections.map(col => (
              <CollectionRow
                key={col.id}
                collection={col}
                tileSize={getTileSize}
                titleSize={15}
                labelSize={10}
                isDraggingRow={draggingCollId === col.id}
                isDragOverRow={dragOverCollId === col.id && !draggingFolder}
                onRowDragStart={() => setDraggingCollId(col.id)}
                onRowDragOver={() => { if (draggingCollId && draggingCollId !== col.id && !draggingFolder) setDragOverCollId(col.id) }}
                onRowDrop={() => dropCollection(col.id)}
                draggingFolderId={draggingFolder?.collectionId === col.id ? draggingFolder.folderId : null}
                dragOverFolderId={draggingFolder?.collectionId === col.id ? dragOverFolderId : null}
                onFolderDragStart={fid => setDraggingFolder({ collectionId: col.id, folderId: fid })}
                onFolderDragOver={fid => { if (draggingFolder?.collectionId === col.id) setDragOverFolderId(fid) }}
                onFolderDrop={fid => dropFolder(fid, col.id)}
                onFolderDragEnd={resetFolders}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#1a1a1a', padding: '6px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 60, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
      </div>
    </div>
  )
}

// ─── Phone mockup ─────────────────────────────────────────────────────────────

function PhoneMockup({ collections, onChange }: Props) {
  const [draggingCollId, setDraggingCollId] = useState<string | null>(null)
  const [dragOverCollId, setDragOverCollId] = useState<string | null>(null)
  const [draggingFolder, setDraggingFolder] = useState<{ collectionId: string; folderId: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [isLandscape, setIsLandscape] = useState(false)

  // Detect orientation
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    setIsLandscape(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Touch drag state
  const touchRef = useRef<{
    type: 'col' | 'folder'
    id: string
    collId?: string
    startX: number
    startY: number
  } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingTouchRef = useRef(false)
  const [isDraggingTouch, setIsDraggingTouch] = useState(false)
  const vertRafRef = useRef<number | null>(null)
  // Keep mutable refs for current drag targets so handlers always see fresh values
  const draggingCollIdRef = useRef<string | null>(null)
  const draggingFolderRef = useRef<{ collectionId: string; folderId: string } | null>(null)

  function stopVertScroll() {
    if (vertRafRef.current !== null) { cancelAnimationFrame(vertRafRef.current); vertRafRef.current = null }
  }

  function reset() {
    isDraggingTouchRef.current = false
    draggingCollIdRef.current = null
    draggingFolderRef.current = null
    touchRef.current = null
    setDraggingCollId(null); setDragOverCollId(null)
    setDraggingFolder(null); setDragOverFolderId(null)
    setIsDraggingTouch(false); stopVertScroll()
  }
  function resetFolders() { setDraggingFolder(null); setDragOverFolderId(null) }

  function dropCollection(targetId: string) {
    const fromId = draggingCollIdRef.current
    if (!fromId || fromId === targetId) { reset(); return }
    const next = [...collections]
    const from = next.findIndex(c => c.id === fromId)
    const to = next.findIndex(c => c.id === targetId)
    if (from === -1 || to === -1) { reset(); return }
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next); reset()
  }

  function dropFolder(targetFolderId: string, collectionId: string) {
    const df = draggingFolderRef.current
    if (!df || df.collectionId !== collectionId) { reset(); return }
    if (df.folderId === targetFolderId) { reset(); return }
    const next = collections.map(col => {
      if (col.id !== collectionId) return col
      const folders = [...(col.folders ?? [])]
      const from = folders.findIndex(f => f.id === df.folderId)
      const to = folders.findIndex(f => f.id === targetFolderId)
      if (from === -1 || to === -1) return col
      const [item] = folders.splice(from, 1)
      folders.splice(to, 0, item)
      return { ...col, folders }
    })
    onChange(next); reset()
  }

  function onTouchStart(e: React.TouchEvent, type: 'col' | 'folder', id: string, collId?: string) {
    const touch = e.touches[0]
    touchRef.current = { type, id, collId, startX: touch.clientX, startY: touch.clientY }
    // No timer — drag activates on movement, not time
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchRef.current.startX
    const dy = touch.clientY - touchRef.current.startY
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Activate drag once finger moves past threshold
    if (!isDraggingTouchRef.current) {
      if (dist > 6) {
        const isFolder = touchRef.current.type === 'folder'
        const isHorizontal = Math.abs(dx) > Math.abs(dy)
        // For folders, only activate on horizontal swipe; for rows, any direction
        if (!isFolder || isHorizontal) {
          isDraggingTouchRef.current = true
          setIsDraggingTouch(true)
          const { type, id, collId } = touchRef.current
          if (type === 'col') {
            draggingCollIdRef.current = id
            setDraggingCollId(id)
          } else if (collId) {
            draggingFolderRef.current = { collectionId: collId, folderId: id }
            setDraggingFolder({ collectionId: collId, folderId: id })
          }
        } else {
          // Vertical move on folder — cancel, let normal scroll happen
          touchRef.current = null
          return
        }
      }
      return
    }

    e.preventDefault()

    // Vertical auto-scroll
    const ZONE = 80; const SPEED = 10
    const y = touch.clientY; const vh = window.innerHeight
    stopVertScroll()
    let vVel = 0
    if (y < ZONE) vVel = -SPEED * (1 - y / ZONE)
    else if (y > vh - ZONE) vVel = SPEED * (1 - (vh - y) / ZONE)
    if (vVel !== 0) {
      const scroll = () => { window.scrollBy(0, vVel); vertRafRef.current = requestAnimationFrame(scroll) }
      vertRafRef.current = requestAnimationFrame(scroll)
    }

    // Find what element is under the finger
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
    if (!el) return
    const collEl = el.closest('[data-coll-id]') as HTMLElement | null
    const folderEl = el.closest('[data-folder-id]') as HTMLElement | null

    if (touchRef.current.type === 'col' && collEl) {
      const overId = collEl.dataset.collId!
      if (overId !== touchRef.current.id) setDragOverCollId(overId)
    }
    if (touchRef.current.type === 'folder' && folderEl) {
      const overFid = folderEl.dataset.folderId!
      const overCid = folderEl.dataset.collId!
      if (overFid !== touchRef.current.id && overCid === touchRef.current.collId) setDragOverFolderId(overFid)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!isDraggingTouchRef.current || !touchRef.current) { touchRef.current = null; return }

    const touch = e.changedTouches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
    const collEl = el?.closest('[data-coll-id]') as HTMLElement | null
    const folderEl = el?.closest('[data-folder-id]') as HTMLElement | null

    if (touchRef.current.type === 'col' && collEl) {
      dropCollection(collEl.dataset.collId!)
    } else if (touchRef.current.type === 'folder' && folderEl) {
      dropFolder(folderEl.dataset.folderId!, folderEl.dataset.collId!)
    } else {
      reset()
    }
  }

  useEffect(() => {
    // Prevent browser scroll from intercepting touch drag
    // Must use non-passive listener which React can't set declaratively
    function preventScroll(e: TouchEvent) {
      if (isDraggingTouchRef.current) e.preventDefault()
    }
    // Suppress native image context menu on long press — React's onContextMenu
    // fires too late; we need to block it at the document level always
    function preventContextMenu(e: Event) {
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventScroll, { passive: false })
    document.addEventListener('contextmenu', preventContextMenu)
    return () => {
      document.removeEventListener('touchmove', preventScroll)
      document.removeEventListener('contextmenu', preventContextMenu)
      stopVertScroll()
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

  // Portrait — show rotate prompt
  if (!isLandscape) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="8" y="4" width="28" height="48" rx="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
            <path d="M44 22l8 8-8 8" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 28h32" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          Rotate to landscape
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260 }}>
          The collection preview works best in landscape mode. Turn your phone sideways to see your collections laid out like they appear in Nuvio.
        </div>
      </div>
    )
  }

  // Landscape — show phone mockup with touch drag
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 24px' }}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Phone bezel — landscape orientation, fixed size */}
      <div style={{
        background: '#1a1a1a',
        borderRadius: 28,
        padding: '10px 40px',  /* wider padding on sides for landscape bezels */
        boxShadow: '0 0 0 2px #2a2a2a, 0 0 0 5px #111, 0 16px 48px rgba(0,0,0,0.6)',
        position: 'relative',
        width: 580,
        flexShrink: 0,
      }}>
        {/* Top/bottom side pills in landscape = left/right buttons */}
        <div style={{ position: 'absolute', top: -4, left: 100, width: 28, height: 4, background: '#2a2a2a', borderRadius: '2px 2px 0 0' }} />
        <div style={{ position: 'absolute', top: -4, left: 140, width: 52, height: 4, background: '#2a2a2a', borderRadius: '2px 2px 0 0' }} />
        <div style={{ position: 'absolute', bottom: -4, left: 120, width: 40, height: 4, background: '#2a2a2a', borderRadius: '0 0 2px 2px' }} />

        <div style={{ background: '#0f0f18', borderRadius: 12, overflow: 'hidden' }}>
          {/* Status bar landscape */}
          <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            <span>9:41</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <svg width="12" height="9" viewBox="0 0 15 11" fill="rgba(255,255,255,0.8)">
                <rect x="0" y="4" width="3" height="7" rx="0.5"/><rect x="4" y="2.5" width="3" height="8.5" rx="0.5"/>
                <rect x="8" y="1" width="3" height="10" rx="0.5"/><rect x="12" y="0" width="3" height="11" rx="0.5"/>
              </svg>
              <svg width="20" height="10" viewBox="0 0 25 12" fill="none">
                <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
                <rect x="2" y="2" width="14" height="8" rx="2" fill="rgba(255,255,255,0.8)"/>
                <path d="M23 4v4a2 2 0 0 0 0-4z" fill="rgba(255,255,255,0.4)"/>
              </svg>
            </div>
          </div>

          {/* App header */}
          <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Collections</span>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Drag the ··· handle above each folder to reorder</div>
          </div>

          {/* Collections */}
          <div style={{ padding: '0 10px 12px', userSelect: 'none', touchAction: isDraggingTouch ? 'none' : 'auto' }}>
            {collections.map(col => (
              <div key={col.id} data-coll-id={col.id}
                style={{
                  marginBottom: 10, opacity: draggingCollId === col.id ? 0.3 : 1,
                  background: dragOverCollId === col.id && !draggingFolder ? 'rgba(20,184,166,0.06)' : 'transparent',
                  borderRadius: 8, transition: 'opacity 0.15s',
                }}
              >
                {/* Row header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, paddingLeft: 2 }}
                  onTouchStart={e => onTouchStart(e, 'col', col.id)}
                >
                  <div style={{ cursor: isDraggingTouch ? 'grabbing' : 'grab', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: '4px' }}>
                    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                      <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
                      <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                      <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{col.title}</span>
                </div>

                {/* Folder strip */}
                <div style={{ display: 'flex', gap: 6, paddingLeft: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, touchAction: isDraggingTouch ? 'none' : 'pan-x', alignItems: 'flex-start' }}>
                  {(col.folders ?? []).map(folder => {
                    const { w, h } = getPhoneTileSize(folder.tileShape)
                    return (
                      <div key={folder.id} data-folder-id={folder.id} data-coll-id={col.id}
                        style={{
                          flexShrink: 0, display: 'flex', flexDirection: 'column',
                          opacity: draggingFolder?.folderId === folder.id ? 0.3 : 1,
                          transition: 'opacity 0.15s',
                          userSelect: 'none',
                        }}
                      >
                        {/* Drag handle — touch and slide to reorder */}
                        <div
                          data-folder-id={folder.id}
                          data-coll-id={col.id}
                          onTouchStart={e => { e.stopPropagation(); onTouchStart(e, 'folder', folder.id, col.id) }}
                          style={{
                            width: w, height: 14,
                            background: 'rgba(20,184,166,0.2)',
                            border: '1px solid rgba(20,184,166,0.35)',
                            borderRadius: '5px 5px 0 0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'grab', touchAction: 'none', flexShrink: 0,
                          }}
                        >
                          <svg width="18" height="4" viewBox="0 0 18 4" fill="rgba(20,184,166,0.7)">
                            <circle cx="3" cy="2" r="1.2"/>
                            <circle cx="9" cy="2" r="1.2"/>
                            <circle cx="15" cy="2" r="1.2"/>
                          </svg>
                        </div>
                        {/* Tile image */}
                        <div style={{
                          width: w, height: h, borderRadius: '0 0 5px 5px', overflow: 'hidden',
                          background: folder.coverImageUrl
                            ? `url(${folder.coverImageUrl}) center/cover no-repeat`
                            : 'rgba(255,255,255,0.08)',
                          border: dragOverFolderId === folder.id && draggingFolder?.collectionId === col.id
                            ? '2px solid rgba(20,184,166,0.9)' : '1px solid rgba(255,255,255,0.08)',
                          position: 'relative', flexShrink: 0,
                        }}>
                          {!folder.coverImageUrl && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>
                              {folder.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        {!folder.hideTitle && (
                          <div style={{ marginTop: 3, fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.6)', maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {folder.title}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Home indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 6 }}>
            <div style={{ width: 60, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CollectionsPreview({ collections, onChange }: Props) {
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    setIsTouchDevice(navigator.maxTouchPoints > 0)
  }, [])

  return isTouchDevice
    ? <PhoneMockup collections={collections} onChange={onChange} />
    : <DesktopMockup collections={collections} onChange={onChange} />
}
