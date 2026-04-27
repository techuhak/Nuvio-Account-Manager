'use client'

import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Link {
  label: string
  url: string
  description: string
  badge?: string
}

interface Category {
  title: string
  icon: React.ReactNode
  accent: string
  links: Link[]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function NuvioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 14V7l4 5 4-5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function AddonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
function DebridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L2 6v8l8 4 8-4V6L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 2v12M2 6l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}
function CommunityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-2.761 2.239-4 5-4M18 17c0-2.761-2.239-4-5-4M10 13c2.761 0 5 1.239 5 4H5c0-2.761 2.239-4 5-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function ToolsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M14.5 2a3.5 3.5 0 0 1 0 7l-9 9a1.5 1.5 0 0 1-2-2l9-9A3.5 3.5 0 0 1 14.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 14l1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M4 2H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7M6.5 1h3m0 0v3m0-3L4.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const categories: Category[] = [
  {
    title: 'Nuvio',
    icon: <NuvioIcon />,
    accent: '#22c55e',
    links: [
      { label: 'Nuvio Website', url: 'https://nuvioapp.space', description: 'Official Nuvio home page' },
      { label: 'Nuvio Account Dashboard', url: 'https://nuvioapp.space/account', description: 'Manage your account, profiles, and addons online' },
      { label: 'Nuvio Mobile (Android/iOS)', url: 'https://github.com/NuvioMedia/NuvioMobile/releases', description: 'Latest APK and iOS releases on GitHub' },
      { label: 'Nuvio TV (Android TV)', url: 'https://github.com/NuvioMedia/NuvioTV/releases', description: 'Latest Android TV releases on GitHub' },
      { label: 'Cloud API Docs', url: 'https://nuvioapp.space/docs?doc=cloud-api', description: 'Official Nuvio Cloud API documentation' },
      { label: 'Nuvio GitHub', url: 'https://github.com/NuvioMedia', description: 'Open source repositories for the Nuvio app' },
    ],
  },
  {
    title: 'Setup Guides',
    icon: <AddonIcon />,
    accent: '#6c63ff',
    links: [
      { label: 'Duck Guides', url: 'https://duckkota.gitlab.io/guides/', description: 'Setup Guides for Nuvio, AIOStreams, AIOMetadata and more. Media Collections.' },
            ],
  },
  {
    title: 'Addons & Plugins',
    icon: <AddonIcon />,
    accent: '#6c63ff',
    links: [
      { label: 'stremio-addons.net', url: 'https://stremio-addons.net/addons', description: 'Community-curated catalog of Stremio-compatible addons' },
      { label: 'Nuvio Plugin Library', url: 'https://nuvioplugin.com', description: 'Community-maintained Nuvio provider repositories' },
      ],
  },
  {
    title: 'Debrid Services',
    icon: <DebridIcon />,
    accent: '#f59e0b',
    links: [
      { label: 'Real-Debrid', url: 'https://real-debrid.com', description: 'Popular unrestricted downloader and stream host' },
      { label: 'AllDebrid', url: 'https://alldebrid.com', description: 'All-in-one debrid service with broad provider support' },
      { label: 'TorBox', url: 'https://torbox.app', description: 'Modern debrid service with a generous free tier' },
      { label: 'Premiumize', url: 'https://www.premiumize.me', description: 'Debrid + cloud storage in one service' },
      { label: 'DebridLink', url: 'https://debrid-link.com', description: 'French debrid service with wide link support' },
      ],
  },
  {
    title: 'Status & Monitoring',
    icon: <ToolsIcon />,
    accent: '#fb923c',
    links: [
      { label: 'Stremio Addon Status', url: 'https://status.dinsden.top/status/stremio-addons', description: 'Live uptime monitoring for popular Stremio addons and services' },
      ],
  },
  {
    title: 'Community',
    icon: <CommunityIcon />,
    accent: '#e879f9',
    links: [
      { label: 'r/nuvio', url: 'https://reddit.com/r/nuvio', description: 'Nuvio subreddit — news, help, and discussion' },
      { label: 'r/aiostreams', url: 'https://www.reddit.com/r/aiostreams/', description: 'AIOStreams subreddit — news, help, and discussion' },
      { label: 'r/cordcutters', url: 'https://reddit.com/r/cordcutters', description: 'General cord cutting community' },
    ],
  },
]

// ─── Link row ─────────────────────────────────────────────────────────────────

function LinkRow({ link, accent }: { link: Link; accent: string }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 8,
        background: 'var(--bg)', border: '1px solid var(--border)',
        textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.background = `${accent}08`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--bg)'
      }}
    >
      {/* Accent dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0, marginTop: 1 }} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{link.label}</span>
          {link.badge && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: accent,
              background: `${accent}15`, border: `1px solid ${accent}30`,
              padding: '1px 6px', borderRadius: 4,
            }}>{link.badge}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          {link.description}
        </div>
      </div>

      {/* External icon */}
      <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        <ExternalIcon />
      </div>
    </a>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ cat }: { cat: Category }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Category header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `${cat.accent}15`, border: `1px solid ${cat.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.accent,
        }}>
          {cat.icon}
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{cat.title}</h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cat.links.map((link, i) => (
          <LinkRow key={i} link={link} accent={cat.accent} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Links() {
  const router = useRouter()
  const isMobile = useIsMobile()

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', padding: '0 16px' }}>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse at top, rgba(232,121,249,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 60 }}>

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
        <div style={{ paddingTop: 28, paddingBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.2)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 14,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e879f9' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e879f9' }}>
              Helpful Links
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 8 }}>
            Everything Nuvio,<br />
            <span style={{ color: '#e879f9' }}>in one place</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 480 }}>
            A curated collection of links for the Nuvio and Stremio ecosystem — apps, addons, debrid services, status pages, and community resources.
          </p>
        </div>

        {/* Category list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {categories.map((cat, i) => (
            <CategorySection key={i} cat={cat} />
          ))}
        </div>

        
      </div>
    </div>
  )
}
