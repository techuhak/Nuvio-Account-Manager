const SUPABASE_URL = process.env.NUVIO_SUPABASE_URL ?? 'https://api.nuvio.tv'
// Officially documented Nuvio publishable key for third-party integrations
// (https://nuvio.tv/docs). Overridable via env for future rotations.
// If this key is ever rejected, the legacy Supabase anon JWT still works as an
// alternate (also public / RLS-protected) — set it via NUVIO_SUPABASE_ANON_KEY:
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNTIxMzQ2LCJleHAiOjE5MzkyMDEzNDZ9.tmQaj682pwzehpqlgCDMnySOqiUvpgRbrE43T4VJpDI
const PUBLISHABLE_KEY =
  process.env.NUVIO_SUPABASE_ANON_KEY ??
  'sb_publishable_1Clq8rlTVACkdcZuqr6_AD__xUUC_EN'

export interface NuvioAddon {
  id?: string; user_id?: string; profile_id: number
  url: string; name: string | null; enabled: boolean; sort_order: number
  created_at?: string; updated_at?: string
}
export interface NuvioPlugin {
  id?: string; user_id?: string; profile_id: number
  url: string; name: string | null; enabled: boolean; sort_order: number
  repo_type: string | null; created_at?: string; updated_at?: string
}
export interface NuvioProfile {
  id: string; user_id: string; profile_index: number; name: string
  avatar_color_hex: string; uses_primary_addons: boolean; uses_primary_plugins: boolean
  avatar_id: string | null; avatar_url: string | null
  pin_enabled: boolean; pin_locked_until: string | null
  created_at: string; updated_at: string
}
export interface AuthResult {
  access_token: string; refresh_token: string; user: { id: string; email: string }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  return apiFetch('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })
}

export async function getProfiles(token: string): Promise<NuvioProfile[]> {
  return apiFetch('/rest/v1/rpc/sync_pull_profiles', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({}),
  })
}

export async function getAddons(token: string, profileId: number): Promise<NuvioAddon[]> {
  return apiFetch(`/rest/v1/addons?select=*&profile_id=eq.${profileId}&order=sort_order`,
    { headers: { Authorization: `Bearer ${token}` } })
}

export async function getPlugins(token: string, profileId: number): Promise<NuvioPlugin[]> {
  return apiFetch(`/rest/v1/plugins?select=*&profile_id=eq.${profileId}&order=sort_order`,
    { headers: { Authorization: `Bearer ${token}` } })
}

export async function getCollections(token: string, profileId: number): Promise<unknown[] | null> {
  const rows = await apiFetch('/rest/v1/rpc/sync_pull_collections', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId }),
  })
  const raw = rows?.[0]?.collections_json ?? null
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return Array.isArray(raw) ? raw : null
}

export async function getWatchProgress(token: string, profileId: number): Promise<unknown[]> {
  const rows = await apiFetch('/rest/v1/rpc/sync_pull_watch_progress', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId }),
  })
  return rows ?? []
}

export async function getWatchHistory(token: string, profileId: number): Promise<unknown[]> {
  const rows = await apiFetch('/rest/v1/rpc/sync_pull_watched_items', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_page: 1, p_page_size: 100000 }),
  })
  return rows ?? []
}

export async function getLibrary(token: string, profileId: number): Promise<unknown[]> {
  const rows = await apiFetch('/rest/v1/rpc/sync_pull_library', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_limit: 500, p_offset: 0 }),
  })
  return rows ?? []
}

export async function pushAddons(token: string, profileId: number,
  addons: Pick<NuvioAddon, 'url' | 'name' | 'enabled' | 'sort_order'>[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_addons', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_addons: addons }),
  })
}

export async function pushPlugins(token: string, profileId: number,
  plugins: Pick<NuvioPlugin, 'url' | 'name' | 'enabled' | 'sort_order' | 'repo_type'>[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_plugins', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_plugins: plugins }),
  })
}

export async function pushCollections(token: string, profileId: number, collections: unknown[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_collections', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_collections_json: collections }),
  })
}

export async function pushWatchProgress(token: string, profileId: number, entries: unknown[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_watch_progress', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_entries: entries }),
  })
}

export async function pushWatchHistory(token: string, profileId: number, items: unknown[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_watched_items', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_items: items }),
  })
}

export async function pushLibrary(token: string, profileId: number, items: unknown[]): Promise<void> {
  await apiFetch('/rest/v1/rpc/sync_push_library', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profile_id: profileId, p_items: items }),
  })
}

export async function updateProfile(
  token: string,
  profileId: number,
  name: string
): Promise<void> {
  // Nuvio no longer allows direct writes to the profiles table. Profile changes
  // now go through the sync_push_profiles RPC, which expects the full set of
  // profiles plus the client's max-profile cap.
  const profiles = await getProfiles(token)
  if (!profiles.some((p) => p.profile_index === profileId)) {
    throw new Error(`Profile ${profileId} not found`)
  }
  const p_profiles = profiles.map((p) => ({
    profile_index: p.profile_index,
    name: p.profile_index === profileId ? name : p.name,
    avatar_color_hex: p.avatar_color_hex,
    uses_primary_addons: p.uses_primary_addons,
    uses_primary_plugins: p.uses_primary_plugins,
    avatar_id: p.avatar_id,
    avatar_url: p.avatar_url,
  }))
  await apiFetch('/rest/v1/rpc/sync_push_profiles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_profiles, p_client_max_profiles: 6 }),
  })
}
