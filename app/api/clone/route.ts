import { NextRequest, NextResponse } from 'next/server'
import { signIn, getProfiles, getCollections, pushAddons, pushPlugins, pushCollections } from '@/lib/nuvio'
import type { NuvioAddon, NuvioPlugin } from '@/lib/nuvio'

interface TargetAccount {
  email: string
  password: string
  profileId: number
  cloneAddons: boolean
  clonePlugins: boolean
  cloneCollections: boolean
}

interface CloneResult {
  email: string
  profileId: number
  success: boolean
  error?: string
  addonCount?: number
  pluginCount?: number
  collectionCount?: number
}

async function mergeAndPushCollections(
  token: string,
  profileId: number,
  incoming: unknown[]
): Promise<void> {
  let existing: unknown[] = []
  try {
    existing = (await getCollections(token, profileId)) ?? []
  } catch {
    // If pull fails, fall back to full replace
    await pushCollections(token, profileId, incoming)
    return
  }

  const incomingIds = new Set(
    incoming.map((c) => (c as { id?: string }).id).filter(Boolean)
  )
  const kept = existing.filter(
    (c) => !incomingIds.has((c as { id?: string }).id ?? '')
  )
  await pushCollections(token, profileId, [...kept, ...incoming])
}

export async function POST(req: NextRequest) {
  try {
    const { targets, addons, plugins, collections }: {
      targets: TargetAccount[]
      addons: NuvioAddon[]
      plugins: NuvioPlugin[]
      collections: unknown[] | null
    } = await req.json()

    if (!targets?.length) {
      return NextResponse.json({ error: 'Targets are required' }, { status: 400 })
    }

    const strippedAddons = addons.map((a, i) => ({
      url: a.url, name: a.name, enabled: a.enabled, sort_order: i,
    }))

    const strippedPlugins = plugins.map((p, i) => ({
      url: p.url, name: p.name, enabled: p.enabled, sort_order: i, repo_type: p.repo_type,
    }))

    const results: CloneResult[] = await Promise.all(
      targets.map(async (target) => {
        try {
          const auth = await signIn(target.email, target.password)
          const profiles = await getProfiles(auth.access_token)
          const validIds = profiles.map((p) => p.profile_index)
          const pid = validIds.includes(target.profileId) ? target.profileId : validIds[0] ?? 1

          const ops: Promise<void>[] = []
          if (target.cloneAddons && strippedAddons.length > 0)
            ops.push(pushAddons(auth.access_token, pid, strippedAddons))
          if (target.clonePlugins && strippedPlugins.length > 0)
            ops.push(pushPlugins(auth.access_token, pid, strippedPlugins))
          if (target.cloneCollections && collections && collections.length > 0)
            ops.push(mergeAndPushCollections(auth.access_token, pid, collections))

          await Promise.all(ops)

          return {
            email: target.email, profileId: pid, success: true,
            addonCount: target.cloneAddons ? strippedAddons.length : 0,
            pluginCount: target.clonePlugins ? strippedPlugins.length : 0,
            collectionCount: target.cloneCollections ? (collections?.length ?? 0) : 0,
          }
        } catch (err: unknown) {
          return {
            email: target.email, profileId: target.profileId, success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
