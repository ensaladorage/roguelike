# Playwright Playtest Instructions

This project can be playtested reliably with Playwright, but there are a few setup details that matter. The goal of this guide is to make the next Playwright playtest work on the first try.

## What worked

1. Install dependencies in the repo root with:

```powershell
npm.cmd install
```

2. Confirm the Playwright packages resolve from the workspace:

```powershell
node -e "console.log(require.resolve('@playwright/test')); console.log(require.resolve('playwright'))"
```

3. Serve the game from a local HTTP server, then run Playwright against that URL.

4. Use `chrome` as the browser channel when launching Playwright in this environment.

5. Use screenshots as the main source of truth for the 3D scene. DOM checks alone are not enough for this game.

## Important setup notes

- The repo uses ES modules and the game loads `three` from the jsDelivr CDN in `index.html`.
- Playwright can fail with `net::ERR_NETWORK_ACCESS_DENIED` if the browser is run inside the sandbox and cannot reach the CDN.
- When that happens, rerun the Playwright job outside the sandbox with approval so the browser can load `https://cdn.jsdelivr.net`.
- On this machine, `npm` should be called as `npm.cmd` from PowerShell because `npm.ps1` can be blocked by execution policy.
- If `npm install` has not been run yet, Playwright will not be available from the workspace.

## Recommended playtest flow

1. Start or reuse a local server on `http://localhost:5500/`.
2. Launch Playwright with Chromium or Chrome.
3. Wait for the `canvas` element to appear.
4. Wait for the level load log before taking the first screenshot.
5. Capture at least these states:
   - initial load
   - after a ground click
   - after a click near a doorway or connector
   - paused state
   - mobile viewport state
6. Review screenshots for:
   - black or blank 3D frames
   - HUD overlap
   - clipped text
   - clickable areas that feel misleading
   - mobile layout collisions

## Example Playwright pattern

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});

const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
await page.goto('http://127.0.0.1:5500/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 25000 });
await page.waitForFunction(
  () => document.querySelector('#log')?.innerText.includes('loaded.'),
  null,
  { timeout: 30000 }
);
await page.screenshot({ path: 'playtest-shots/example.png' });

await browser.close();
```

## What to check in this game

- The HUD should remain readable on desktop and mobile.
- The pause overlay should appear and freeze the scene cleanly.
- Ground clicks should visibly move the player.
- Door or connector clicks should not feel ambiguous.
- The quick-use consumable buttons should match the inventory state.
- Mobile should hide the footer hints and keep the quick-use bar usable.

## Common failure modes

- `canvas` never appears:
  - usually the CDN import for `three` was blocked or the server was not reachable.
- Playwright resolves but the browser stays black:
  - often a WebGL/headless rendering issue or the scene has not finished loading yet.
- `npm.ps1` fails in PowerShell:
  - use `npm.cmd` instead.
- The first scene screenshot is blank:
  - wait longer for the level load log and take a second screenshot after input or after a longer delay.

## Files generated during playtests

Playwright screenshots were saved in:

- `playtest-shots/`

That folder is safe to reuse for future runs.
