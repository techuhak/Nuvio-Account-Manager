# Nuvio API Migration Fix

Nuvio changed its backend and this app stopped working. Here's what broke, what
I changed, and what to watch out for.

## What broke

Nuvio moved its sync backend, so every request (including login) started
failing. Three things changed on their side:

1. **New API address** — `dpyhjjcoabcglfmgecug.supabase.co` → `api.nuvio.tv`
2. **New API key** — the old key was rotated out
3. **Profile renames** now go through an RPC (`sync_push_profiles`) instead of a
   direct table edit, and the profile limit went from **5 to 6**

## What I changed

| File | Change |
| --- | --- |
| `lib/nuvio.ts` | Point at `api.nuvio.tv`, use Nuvio's documented public key, and rewrite profile rename to use the `sync_push_profiles` RPC |
| `app/clone/page.tsx`, `app/collections/page.tsx`, `app/migrate/page.tsx` | Show the 6th profile in the profile pickers |

The URL and key can both be overridden with environment variables
(`NUVIO_SUPABASE_URL`, `NUVIO_SUPABASE_ANON_KEY`), so if Nuvio changes them
again you can fix it without touching code.

## Verified

Logged into a real Nuvio account and confirmed login, profile rename, backup
export, and clone all work against the live `api.nuvio.tv` API. Walked the full
UI (manage, clone, collections, migrate) with all 6 profiles.

## Things to watch out for

- **The built-in key is a fallback, not the source of truth.** If Nuvio rotates
  it, set `NUVIO_SUPABASE_ANON_KEY` in your deployment. (A known-good alternate
  key is noted at the top of `lib/nuvio.ts`.)
- **Profile rename is read-then-write.** It pulls all profiles, changes one, and
  saves them back. Fine for a single-user tool; two people editing at once could
  in theory overwrite each other.
- **The profile limit (6) is hard-coded.** If Nuvio ever allows more, the
  pickers and the `p_client_max_profiles: 6` value need bumping.
- **This is an unofficial integration.** It relies on Nuvio's API staying the
  same, so expect occasional breakage when they ship backend changes. The
  env-override design is the main defense against that.
