# ShowAllBadges

Shows every profile badge instead of collapsing the extras behind a `+n` chip.

Discord's newer profile badge list only renders the first few badges and hides the rest behind a counter (for example `+3`). Clicking it opens a popout with the remaining badges. This plugin removes that cap so the whole row is rendered inline.

## ▸ Why not Quick CSS

The hidden badges are never rendered into the DOM, so CSS cannot reveal them. The cut happens in the badge list component, which slices the list when an experiment flag is on. This plugin patches that check so the slice and the overflow count are skipped.

## ▸ How it works

In the badge list module, Discord computes:

```js
let M = v && !j,
    P = M ? Math.max(D.length - d.k9, 0) : 0;
```

When `M` is true the list is cut to `d.k9` badges and `P` becomes the `+n` count. The plugin patches `M` to `false`, so nothing is cut and `P` stays `0`. Discord then renders the normal full rows.

The patch matches on structure, not variable names, since Discord's minified names change between builds.

## ▸ Notes

- Your own profile still shows the edit pencil. That is controlled by a separate flag.
- The plugin does not touch the DOM, add CSS, or run any code after the patch is applied.
