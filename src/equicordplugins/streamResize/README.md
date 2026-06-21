# StreamResize

Extend the min/max resize limits of Discord's Picture-in-Picture (PIP) stream window.

When a stream is not in focus (you scrolled away or opened another channel), Discord
shows it as a floating, draggable PIP window that can only be resized within a fixed
range. This plugin makes that range configurable via two sliders, while keeping the
window at 16:9.

## Settings

- **Minimum PIP size (% of screen)** — lower bound, as a percentage of the Discord
  window. Default `20`.
- **Maximum PIP size (% of screen)** — upper bound. Default `90`.

Both are live: moving a slider affects the next drag, no reload needed. If min > max
they are swapped automatically.

## How it works

- `bounds.ts` — a pure helper. `computeBounds(screenW, screenH, minPct, maxPct)`
  returns `{ min, max }` sizes. It keeps 16:9 and uses a "fit" rule (the smaller axis
  wins) so the PIP never overflows the window on either axis.
- `index.tsx` — the plugin. Two `OptionType.SLIDER` settings plus a `getBounds()`
  method that feeds the current window size and slider values into `computeBounds`.
- The patch targets Discord's resizable PIP container (the module that uniquely
  contains `Draggable`). It rewrites two width clamps to use `$self.getBounds()`:
  the live drag constraint and the on-release clamp. Height is derived from width at
  16:9 by Discord itself, so only width needs patching.

## Tests

The pure helper has unit tests (Node's built-in test runner, run via `tsx`):

```sh
npx tsx --test src/equicordplugins/streamResize/bounds.test.ts
```

## Maintenance

The patch matches obfuscated Discord code and may break after a Discord update. If the
PIP stops resizing and the console shows `failed to apply patch StreamResize`,
re-discover the module (search webpack for `Draggable`) and re-derive the two regex
matches in `index.tsx`.
