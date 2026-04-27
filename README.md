# Nuvio Account Manager

A free, open source browser-based tool for managing your Nuvio accounts. Clone profiles across accounts, manage addons and plugins, build and edit collections, migrate from Stremio, and monitor service health — all without opening the app.

🔗 **[Try it live →](https://nuvio-account-cloner.vercel.app)**

> No installation required. Just open the link and sign in with your Nuvio account.

☕ **[Support on Ko-fi →](https://ko-fi.com/techuhak)** — free to use, tips appreciated!

---

## Features

### Account Cloning
Clone your addons, plugins, and collections from one Nuvio account to any number of others in one click.

1. Sign in with your source account
2. Select the source profile and preview what will be copied
3. Add target accounts and pick a destination profile for each
4. Use per-target toggles to control what gets copied (addons, plugins, collections)
5. Hit Push and watch live success or error status per account

Collections are merged with existing ones on the target rather than overwriting them.

### Account Management
A full browser-based dashboard for managing multiple Nuvio accounts without opening the app.

- **Multiple accounts** — save as many accounts as you want and switch between them from a dropdown with no signing out required
- **Profile switcher** — switch between profiles within each account, with actual profile names displayed
- **Profile renaming** — rename any profile directly from the dashboard using the pencil icon
- **Addons** — add by manifest URL, remove, reorder, enable or disable, and edit the name or URL of any existing addon
- **Plugins** — same full set of controls as addons
- **Collections** — view and remove collections per profile
- **Browse catalog** — direct link to stremio-addons.net
- Changes are staged locally and only pushed when you click Save changes

### Collections Builder
A visual editor for building and managing Nuvio collections powered by your actual installed addons.

- Sign in to load your existing collections and installed addons
- All installed addon manifests are fetched automatically to build a complete catalog source list
- Edit collection and folder names inline
- Remap any catalog source to one from your installed addons using a dropdown, with green or amber indicators showing match status
- Reorder collections using up and down buttons
- Reorder folders within a collection using up and down buttons
- Configure all display settings: view mode (Follow Layout, Tabbed Grid, Grid), tile shape per folder (Landscape, Square, Poster), cover image URL, pin to top, show All tab, focus glow, hide title, and focus GIF
- Import a template JSON to add new collections and remap sources to your own addons
- Push individual collections or all at once. Pushes are always merged with existing collections on the account, never a full replace

### Migrate from Stremio
Move your entire Stremio setup into Nuvio in one go.

- Sign into both accounts on the same page
- Your Stremio addons are listed individually with checkboxes so you can pick exactly which ones to bring over. Official addons are flagged so you can skip them easily
- Library, watch history, and continue watching progress all transfer with correct field mapping
- Watch history and progress are merged with existing Nuvio data. Library is a full replace
- Nothing in your Stremio account is ever changed

### Backup and Restore
Export and restore full profile backups from the Backup tab in Account Management.

- Export downloads a timestamped JSON file covering addons, plugins, collections, watch progress, watch history, and library
- Import lets you choose exactly which data types to restore with per-toggle control
- Addons, plugins, and collections are full replace on import. Watch progress and history are merged

### Service Status
The landing page shows a live status panel for popular Stremio addons and services, with a Real-Debrid status check link. Auto-refreshes every 60 seconds.

### Helpful Links
A curated directory of Nuvio and Stremio ecosystem links including app downloads, addon catalog, debrid services, status pages, and community resources.

---

## Is it safe to use?

Yes. Here is exactly what happens with your credentials:

**Account Cloning and Stremio Migration** — Credentials are sent directly to the respective APIs over HTTPS to get a temporary access token. They are never written to a database, log file, or any server storage.

**Account Management** — To support switching between multiple accounts without re-entering passwords, your credentials are stored in your browser's localStorage on your own device. They never leave your machine except to authenticate with the Nuvio API. You can clear them at any time by removing accounts from the dropdown or clearing your browser's site data.

This tool has no ads, no tracking, and no account creation required. It is fully open source — you can read every line of code in this repository.

---

## Things to know

**Cloning overwrites addons and plugins.** When you push addons or plugins to a target account they fully replace whatever was already there on that profile. Collections are merged by ID so existing ones are preserved.

**Collections Builder always merges.** Pushing a collection replaces only that collection by ID and leaves all others on the account untouched.

**Settings don't sync.** Nuvio stores profile settings locally on each device using MMKV, not in the cloud, so there is nothing to copy.

**Tokens expire after about 60 minutes.** The account management dashboard silently re-authenticates in the background when a token expires using the locally stored credentials.

**Library import is a full replace.** When importing from Stremio or restoring a backup, the library section fully replaces existing library data. Watch history and progress are always merged.

---

## Screenshots

*(Coming soon — feel free to open a pull request with screenshots!)*

---

## Self-hosting

If you prefer to run your own copy rather than use the public instance, it deploys to Vercel in about 60 seconds.

### Deploy to Vercel
1. Fork this repository
2. Go to [vercel.com/new](https://vercel.com/new) and import your fork
3. Leave all settings at defaults and click Deploy
4. No environment variables needed

### Run locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## For developers

### Tech stack
- **Next.js 15** (App Router)
- **TypeScript**
- **Nuvio Cloud API** (Supabase-backed)
- **Stremio API** (api.strem.io)

### Project structure
```
app/
├── page.tsx                      ← Landing page with service status
├── clone/page.tsx                ← Account cloning tool
├── manage/page.tsx               ← Multi-account management dashboard
├── collections/page.tsx          ← Collections builder and editor
├── migrate/page.tsx              ← Stremio to Nuvio migration
├── links/page.tsx                ← Helpful links directory
└── api/
    ├── source/route.ts           ← Fetch Nuvio account data
    ├── clone/route.ts            ← Push to target accounts (merge collections)
    ├── manifest/route.ts         ← Proxy for fetching addon manifests
    ├── stremio/route.ts          ← Proxy for Stremio API calls
    ├── status/route.ts           ← Proxy for Uptime Kuma status API
    └── manage/
        ├── push/route.ts         ← Save management changes
        ├── export/route.ts       ← Full profile export
        ├── import/route.ts       ← Selective profile import
        └── profile/route.ts      ← Profile name update
lib/
├── nuvio.ts                      ← Nuvio API client
├── stremio.ts                    ← Stremio API client and schema mappers
└── useIsMobile.ts                ← Mobile breakpoint hook
```

### Nuvio API endpoints used
| Endpoint | Purpose |
|---|---|
| `POST /auth/v1/token?grant_type=password` | Sign in |
| `POST /rest/v1/rpc/sync_pull_profiles` | List profiles |
| `PATCH /rest/v1/profiles?profile_index=eq.{n}` | Update profile name |
| `GET /rest/v1/addons?profile_id=eq.{n}` | Read addons |
| `GET /rest/v1/plugins?profile_id=eq.{n}` | Read plugins |
| `POST /rest/v1/rpc/sync_pull_collections` | Read collections |
| `POST /rest/v1/rpc/sync_pull_watch_progress` | Read watch progress |
| `POST /rest/v1/rpc/sync_pull_watched_items` | Read watch history |
| `POST /rest/v1/rpc/sync_pull_library` | Read library |
| `POST /rest/v1/rpc/sync_push_addons` | Write addons (full replace) |
| `POST /rest/v1/rpc/sync_push_plugins` | Write plugins (full replace) |
| `POST /rest/v1/rpc/sync_push_collections` | Write collections (full replace) |
| `POST /rest/v1/rpc/sync_push_watch_progress` | Write watch progress (merge) |
| `POST /rest/v1/rpc/sync_push_watched_items` | Write watch history (merge) |
| `POST /rest/v1/rpc/sync_push_library` | Write library (full replace) |

### Stremio API endpoints used
| Endpoint | Purpose |
|---|---|
| `POST /api/login` | Sign in, returns authKey |
| `POST /api/addonCollectionGet` | Read installed addons |
| `POST /api/datastoreGet` | Read library and watch data |

### Contributing
Pull requests are welcome. If you find a bug or want to suggest a feature, open an issue.

---

*This project is not affiliated with or endorsed by Nuvio or Stremio. It uses their publicly accessible APIs.*
