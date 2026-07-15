# 🌌 Vault Galaxy

Fly through your Obsidian vault as a 3D galaxy. Every note is a star, every
wikilink a thread of light — and you can dive *inside* a note to find its text
floating as glowing letters on a rippling midnight ocean.

Built with **Vite + three.js**. Everything in the environment is generated in
code; the only "asset" is the (code-generated, swappable) avatar.

## Quick start

```bash
cd graph-explorer
npm install

# Point the scanner at your vault (defaults to /Path/to/vault,
# falls back to the bundled sample-vault/ if that doesn't exist):
VAULT_PATH="/path/to/your/vault" npm run dev
```

Open the printed URL, click the canvas to capture the mouse, and fly.

For a static production build: `VAULT_PATH=... npm run build` → deploy `dist/`
anywhere. To re-scan the vault without rebuilding the site: `npm run vault`.

## How it works

A browser can't read your vault, so a **preprocessing step**
(`tools/build-vault.mjs`) scans it ahead of time:

```
your vault (.md files)
        │  npm run vault
        ▼
public/data/graph.json      ← the whole graph: nodes + links (loaded up front)
public/data/notes/<id>.md   ← each note's text (fetched on demand)
```

- **Wikilinks** (`[[Note]]`, `[[Note|alias]]`, `[[Note#heading]]`) are resolved
  by basename or path, case-insensitively, like Obsidian.
- Links to names that **don't exist as files** get a **synthesized hub node** —
  your recurring reference names become cluster centers, just like in
  Obsidian's graph.
- **Image/attachment embeds** (`![[img.png]]`) become attachment nodes,
  hidden by default.
- Links inside code blocks and frontmatter are ignored.

## Controls

| Input | Action |
| --- | --- |
| Click canvas | capture mouse (pointer lock) |
| Mouse | turn heading (yaw) + tilt view (pitch) — no roll |
| `W` / `S` | thrust forward/back along your level heading |
| `A` / `D` | strafe |
| `R` / `F` | rise / descend |
| `Space` (hold) | **hyperdrive** — tunnel vision + speed lines |
| `E` | dive into the targeted/open note · dive back out |
| `Esc` | leave a note interior |
| `Z` | zen mode (hide all UI) |
| Click a node (crosshair) | open its note panel |

Flying close to a node fades in its title; getting really close opens the
note panel by itself.

### UI panel

- **Theme** — Deep Space / Nebula (data-driven; see below)
- **Avatar / Interior avatar** — swap the code-generated avatars
- **Synthesized hubs / Attachments** — instant show/hide, no rebuild;
  the layout gently re-settles
- **Speed** — base flight speed (hyperdrive multiplies it)
- **Spread** — link length / how spread out the galaxy is

## The graph

The layout is force-directed like Obsidian's graph view: springs along links,
Barnes-Hut n-body repulsion between nodes, and a weak pull toward the center
so busy hubs settle in the middle. Node size reflects its number of visible
connections; node color comes from its folder. The simulation cools and
**freezes once settled** (no jitter) and re-heats when you change a filter or
the spread slider.

## Inside a note

Press `E` on a note to dive in. Its text becomes glowing white letters
floating on a rippling, reflective ocean that stretches to the horizon and
dissolves into a night sky. Lightning wanders through the letter field,
scattering nearby letters outward and upward; they settle back and re-form in
its wake. Overhead, the same text hangs as northern-lights curtains — waving
sheets of aurora-colored glyphs (stylistic, not readable). `E` or `Esc`
returns you to *exactly* where you were in the galaxy, momentum included.

## Extending

- **Themes** are pure data in `src/themes.js` — colors, fog, lights, folder
  palette, bloom, hyperdrive tint. Add an object, get a theme.
- **Avatars** are factories in `src/avatars.js` returning a `THREE.Object3D`
  (forward = −Z). Register one in `FLIGHT_AVATARS` / `INTERIOR_AVATARS` and it
  appears in the UI dropdowns.

## Code map

```
tools/build-vault.mjs        vault scanner → graph.json + notes/*.md
src/main.js                  bootstrap, render loop, galaxy⇄interior switching
src/graph/forceSim.js        3D force layout (Barnes-Hut octree, settle/reheat)
src/graph/graphScene.js      instanced nodes, links, fading labels, picking
src/controls/flightController.js  third-person flight + hyperdrive ramp
src/avatars.js               pluggable code-generated avatars
src/fx/starfield.js          procedural twinkling stars
src/fx/hyperdrive.js         tunnel + speed-lines post-process shader
src/interior/interior.js     ocean, letter field, lightning, auroras
src/interior/glyphAtlas.js   canvas glyph atlas for the letter field
src/themes.js                data-driven themes
src/ui.js · src/styles.css   overlay UI, note panel, zen mode
sample-vault/                bundled demo vault (fallback)
```
