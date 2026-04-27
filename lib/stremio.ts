// Stremio API client
// Base: https://api.strem.io

const STREMIO_API = 'https://api.strem.io'

export interface StremioAuth {
  authKey: string
  user: { email: string; _id: string }
}

export interface StremioAddon {
  transportUrl: string
  manifest: {
    id: string
    name: string
    version?: string
    description?: string
  }
  flags?: { official?: boolean; protected?: boolean }
}

export interface StremioLibraryItem {
  _id: string           // IMDB ID e.g. "tt1234567"
  name: string
  type: 'movie' | 'series' | 'channel' | 'tv'
  poster?: string
  posterShape?: string
  year?: number
  removed?: boolean
  temp?: boolean
  state: {
    lastWatched?: string   // ISO date
    timeOffset?: number    // seconds into video
    duration?: number      // total duration seconds
    video_id?: string      // for series: "tt1234567:1:1"
    season?: number
    episode?: number
    watched?: boolean
    timesWatched?: number
    overallTimeWatched?: number
  }
  _ctime?: string
  _mtime?: string
}

async function stremioPost(path: string, body: object) {
  const res = await fetch(`${STREMIO_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Stremio API ${res.status}`)
  const data = await res.json()
  if (data.err) throw new Error(data.err)
  return data.result
}

export async function stremioLogin(email: string, password: string): Promise<StremioAuth> {
  const result = await stremioPost('/api/login', { email, password, facebook: false })
  return { authKey: result.authKey, user: { email: result.email, _id: result._id } }
}

export async function stremioGetAddons(authKey: string): Promise<StremioAddon[]> {
  const result = await stremioPost('/api/addonCollectionGet', { authKey, update: true })
  return result?.addons ?? []
}

export async function stremioGetLibrary(authKey: string): Promise<StremioLibraryItem[]> {
  const result = await stremioPost('/api/datastoreGet', {
    authKey,
    collection: 'libraryItem',
    ids: [],
    all: true,
  })
  return result ?? []
}

// ─── Schema mappers ───────────────────────────────────────────────────────────

export function stremioAddonToNuvio(addon: StremioAddon) {
  // Skip official/protected Stremio addons that are already in Nuvio by default
  // (Cinemeta, OpenSubtitles etc.) — user can decide to include them
  return {
    url: addon.transportUrl,
    name: addon.manifest?.name ?? null,
    enabled: true,
  }
}

export function stremioLibraryToNuvioLibrary(items: StremioLibraryItem[]) {
  return items
    .filter(item => !item.temp)
    .map(item => ({
      content_id: item._id,
      content_type: item.type,
      name: item.name,
      poster: item.poster ?? null,
      poster_shape: 'POSTER',
      background: null,
      description: null,
      release_info: '',
      imdb_rating: null,
      genres: [],
      addon_base_url: null,
      added_at: item._ctime ? new Date(item._ctime).getTime() : Date.now(),
    }))
}

export function stremioLibraryToNuvioWatchHistory(items: StremioLibraryItem[]) {
  return items
    .filter(item => !item.temp && (item.state?.timesWatched ?? 0) > 0)
    .map(item => {
      // Parse video_id for series: "tt1234567:1:5" → season 1, episode 5
      const parts = (item.state?.video_id ?? '').split(':')
      const season = parts.length === 3 ? Number(parts[1]) || null : null
      const episode = parts.length === 3 ? Number(parts[2]) || null : null
      const watchedAt = item.state?.lastWatched
        ? new Date(item.state.lastWatched).getTime()
        : item._mtime ? new Date(item._mtime).getTime() : Date.now()

      return {
        content_id: item._id,
        content_type: item.type,
        title: item._id,
        season,
        episode,
        watched_at: watchedAt,
      }
    })
}

export function stremioLibraryToNuvioWatchProgress(items: StremioLibraryItem[]) {
  return items
    .filter(item => !item.temp && (item.state?.timeOffset ?? 0) > 0 && !(item.state?.watched))
    .map(item => {
      const videoId = item.state?.video_id ?? item._id
      const parts = videoId.split(':')
      const season = parts.length === 3 ? Number(parts[1]) || null : null
      const episode = parts.length === 3 ? Number(parts[2]) || null : null
      const lastWatched = item.state?.lastWatched
        ? new Date(item.state.lastWatched).getTime()
        : item._mtime ? new Date(item._mtime).getTime() : Date.now()

      // Stremio stores timeOffset in seconds, Nuvio expects milliseconds
      const position = (item.state?.timeOffset ?? 0) * 1000
      const duration = (item.state?.duration ?? 0) * 1000

      // progress_key format: "tt1234567" for movies, "tt1234567_s1e5" for series
      const progressKey = season !== null && episode !== null
        ? `${item._id}_s${season}e${episode}`
        : item._id

      return {
        content_id: item._id,
        content_type: item.type,
        video_id: videoId,
        season,
        episode,
        position,
        duration,
        last_watched: lastWatched,
        progress_key: progressKey,
      }
    })
}
