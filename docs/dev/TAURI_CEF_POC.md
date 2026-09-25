# POC Tauri 3 + runtime CEF (Linux)

Branche : `poc/tauri3-cef`

POC pour tester le runtime **CEF (Chromium Embedded Framework)** de Tauri 3
comme alternative à WebKitGTK : meilleures perfs de rendu, moins de RAM, et
contournement des bugs WebKitGTK.

## Structure

- `tauri-cef-linux/` : crate desktop CEF (binaire `pnltracker-desktop-cef`)
- `src/cef_focus.rs` : workarounds X11 (clavier + molette)
- `src/lib.rs` : setup Tauri, plugins, démarrage watchdogs
- `tauri.conf.json` : conf dev (`devUrl` → `localhost:3003`)
- `tauri.prod.conf.json` : conf prod (`frontendDist` → `.output/public`, postgres embarqué)

### Code partagé avec src-tauri

Les deux crates (Tauri 2 et Tauri 3) incluent les mêmes sources via
`#[path]` vers `tauri-shared/` à la racine — un seul fichier physique,
compilé par chaque crate contre sa propre version de `tauri` :

- `tauri-shared/desktop.rs` / `desktop_windows.rs` / `desktop_common.rs` :
  cycle de vie postgres embarqué, app_log, helpers fs/process
- `tauri-shared/app_common.rs` : commands (`close_splashscreen`, `quit_app`,
  `set_app_language`), `AppLanguage`, handlers `on_window_event`
  (dialogue de confirmation de fermeture) et `app.run`

Spécifique à chaque crate : `main.rs`, `run()` (runtime, plugins, workarounds),
`cef_focus.rs`. Si une évolution Tauri v3 rend un fichier partagé
incompatible entre v2 et v3, revenir à des copies séparées.

## Dépendances

Tout l'écosystème Tauri vient de **git**, pas de crates.io (`[patch.crates-io]`
dans `tauri-cef-linux/Cargo.toml`) :

- `tauri`, `tauri-build`, `tauri-runtime-cef` → `github.com/tauri-apps/tauri`,
  **rev `72025a3a7`** (pin, pas branche flottante)
- plugins (shell, dialog, fs, log, single-instance, opener) →
  `github.com/tauri-apps/plugins-workspace`, branche `v3`

Pourquoi le pin : le HEAD de `v3` casse `tauri-plugin-dialog` (le commit
`20b45cc2c` a déplacé `run_on_main_thread` vers le trait `Manager`, aucun
plugin n'est resynchronisé). `72025a3a7` = alpha.2 + tests e2e + clippy,
dernier commit compatible.

État au moment du POC :

```
9d00f5916  ← HEAD v3 tauri
20b45cc2c  feat(core): Manager::run_on_main_thread — BREAKING
72025a3a7  ← notre pin (dernier compatible)
f2c77194d  ← HEAD v3 plugins-workspace (merge v2→v3, opener renommé)
```

Le fix attendu côté plugins : `plugins/dialog/src/desktop.rs` appelle
`handle.run_on_main_thread()` (6 call sites) sans importer `Manager` —
doit ajouter `use tauri::Manager` pour compiler contre HEAD. Vérifier ce
fichier sur la branche `v3` avant chaque bump.

**Mise à jour** : bumper les `rev` (tauri + plugins-workspace) dans
`Cargo.toml` → `cargo update -p tauri` → rebuild. Nos workarounds sont
dans notre crate, pas dans le runtime — rien à porter, le seul risque est
qu'une update casse `cef_focus.rs` (changement de hiérarchie de fenêtres)
ou le rende obsolète (fix focus/scroll intégré upstream → on le supprime,
bonne nouvelle).

## Bugs du runtime alpha contournés

### 1. Clavier inutilisable dans les inputs

**Cause** : GTK4 conserve le focus X11 sur sa fenêtre proxy interne (1×1).
`CefBrowserHost::SetFocus(1)` notifie CEF mais ne déplace pas le focus X vers
la fenêtre browser (enfant X11 la plus profonde). Bug upstream documenté
(CEF issue #3782, external message pump).

**Fix** (`cef_focus.rs`, `watch_loop`) : thread qui poll `_NET_ACTIVE_WINDOW`
(200 ms). Quand une fenêtre de notre process-group est active, `XSetInputFocus`
vers la feuille browser CEF (`deepest_large_child`). Le match se fait par
**pgid** et non pid — les fenêtres CEF appartiennent à des subprocess forkés,
`_NET_WM_PID` ne vaut pas le pid principal.

### 2. Molette (scroll) inopérante

**Cause** : la molette émet des valuators XI2 (smooth scroll), livrés à la
fenêtre la plus profonde qui les sélectionne. Dans notre arbre
(`toplevel → CefX11Host → CEF browser`), personne ne les sélectionne — le
host n'a que `Exposure|StructureNotify`, CEF ne sélectionne apparemment que
les boutons. L'émulation Button4/5 suit le même chemin jusqu'à root. Les
clics passent eux en ButtonPress core directement à la fenêtre CEF.

**Fix** (`cef_focus.rs`, `scroll_loop`) : thread qui écoute
`XI_RawButtonPress` sur root. Un button 4–7 avec flag `XIPointerEmulated` =
tick de molette perdu. Si le pointeur est au-dessus de la fenêtre CEF
(`pointer_over_our_cef` : frame XFWM → toplevel → host → leaf), on ré-injecte
un vrai Button4/5 via `XTestFakeButtonEvent` → livré en core à la fenêtre
CEF → scroll. Anti-boucle : nos injections ne sont pas émulées.

Attention : `largest_child` sélectionne l'enfant à l'aire **maximale** —
les bordures XFWM 3×900 passent un simple filtre `area > 4`.

### 3. Liens externes (`target="_blank"`)

**Cause** : `shell.open` n'existe plus dans le plugin shell v3 (reste
execute/spawn/kill). Et le chemin popup CEF natif est cassé en prod.

**Fix** : `tauri-plugin-opener` (open_url, activité `open_js_links_on_click`
par défaut) + `composables/useExternalLinks.ts` qui invoque
`plugin:opener|open_url`. Monté dans les layouts `default`, `auth`, `legal`.
Permission `opener:default` dans `capabilities/default.json`.

### 4. Double titlebar

`decorations: true` (natif, déplaçable) + `DesktopTitlebar.vue` masqué quand
`win.isDecorated()` retourne true — agnostique du runtime : sous Tauri 2
(decorations:false) la titlebar custom reste affichée.

### 5. RAM dev (~10 GB → ~190 MB)

En dev, on sert le **build Nitro prod** (`.output`) via un wrapper node qui
charge le `.env`, au lieu du dev server nuxt. Wrapper : `/tmp/start-nitro.mjs`
(ou équivalent) avec `NITRO_PORT=3003` pour matcher `devUrl`.

## Lancer en dev

```bash
# DB docker dev (port 5432, même que nuxt dev)
docker start pnltracker-postgres-dev

# Frontend prod sur :3003
pnpm build
NITRO_PORT=3003 node .output/server/index.mjs   # avec .env chargé

# App CEF
cd tauri-cef-linux && ./target/debug/pnltracker-desktop-cef
```

ou via les scripts package.json : `pnpm tauri-cef:dev` (spawne nuxt dev +
binaire — RAM dev complète), `pnpm tauri-cef:build` / `:build:exe` (prod,
`--ignore-version-mismatches` requis car les packages npm restent en v2).

`PKG_CONFIG_PATH` requis pour tout build cargo :
`/home/patrice/gtk4-dev-local/root/usr/lib/x86_64-linux-gnu/pkgconfig`
(GTK4 dev extrait localement, pas installé système).

Sur un build host sans GTK4 (ou trop vieux, ex. Ubuntu 22.04 = gtk4 4.6
insuffisant, APIs 4.10-4.12 requises) : créer un arbre `pkgconfig` local
avec `.pc` au prefix local + `.so` récentes, relaxer les contraintes de
version `Requires` des `.pc`, et le `--allow-shlib-undefined` de
`build.rs` couvre le cas où les `.so` visent une glibc plus récente que
celle du host (deps internes résolues à l'exécution sur la cible).

## Prod

`pnpm tauri-cef:build:exe` → `target/release/pnltracker-desktop-cef`.
Postgres embarqué (`postgresql_embedded`, port éphémère `127.0.0.1:xxxxx`,
data dir `~/.local/share/app.pnltracker.desktop/postgres/data` — même dir
que la version Tauri 2, ne pas lancer les deux en même temps).
`runtime/` (node + app syncée) recopié à côté du binaire par le prepare.

Bundles générés :

- `bundle/deb/PnlTracker_0.1.3_amd64.deb` (~227 MB, dépend des libs système)
- `bundle/appimage/PnlTracker_0.1.3_amd64.AppImage` (~424 MB, `quick-sharun`
  embarque toutes les libs → portable)

Gotchas AppImage (à reporter dans le workflow CI) :

- `patchelf` requis (binaire statique dans `~/.local/bin` possible)
- `STRACE_MODE=0` **obligatoire** : sinon quick-sharun lance l'app pour
  tracer ses `dlopen` et elle ne se termine jamais (postgres + fenêtre) →
  hang infini du bundler
- `ANYLINUX_LIB=0` **requis** : le `quick-sharun.sh` pin par Tauri télécharge
  `useful-tools/lib/*.c` qui ont été déplacés upstream vers
  `Anylinux-sharun` (404 → 5 retries → échec)
- `xvfb-run` absent = warning inoffensif avec `STRACE_MODE=0`
- Sur un build host dont la glibc est plus vieille que celle des `.so`
  liées : `quick-sharun` échoue sur `ldd | grep "not found"` qui matche
  les erreurs `version 'GLIBC_*' not found`. Le script est re-téléchargé
  à chaque build (pas patchable en cache) → shim `ldd` dans le PATH qui
  filtre ces lignes + `LD_LIBRARY_PATH` vers les libs pour que la
  résolution réussisse
- `productName`/`identifier` identiques à la version Tauri 2 : mêmes données
  (data dir partagé) mais impossible de lancer les deux en même temps —
  à revoir si on publie les artifacts sur GitHub

## Release GitHub

`scripts/release-cef.sh <tag>` : build complet (`pnpm tauri-cef:build`, env
vars AppImage incluses), copie les bundles dans `release-cef/` renommés
`PnlTracker-CEF_<version>_amd64.{deb,AppImage}` (évite le conflit de noms
avec les artifacts WebKitGTK), crée la release si absente puis upload via
`gh --clobber`. `--no-upload` pour ne faire que le build + renommage.
Prérequis : `gh` authentifié, `patchelf` dans le PATH.

## Limites connues

- `browser_info` timeouts au premier affichage (renderer handshake flaky,
  bug alpha — relancer si bloqué sur le splash)
- Hydration mismatch bénin lié à `hasNativeDecorations` en SSR
- Les deux workarounds X11 sont au niveau **app** — candidats propres pour
  un patch upstream dans `tauri-runtime-cef`
- Plugins npm en v2 (API compatible, d'où `--ignore-version-mismatches`)
