# MarkdownTables

Renders GitHub-style markdown tables in Discord messages.

Detected tables are shown as formatted tables, with a Raw toggle available when you need to copy or inspect the original markdown.

![simple](assets/simple.png)
![inline markdown](assets/inlinemarkdown.png)
![alignment](assets/alignment.png)
![long cell](assets/longcell.gif)

## Features

- Supports pipe tables with or without outer pipes.
- Supports left, center, and right alignment markers.
- Supports escaped pipes inside cells.
- Handles multiple tables in one message.
- Keeps surrounding message text in place.
- Ignores fenced code blocks and malformed tables.
- Shows edge fades when wide tables can scroll horizontally.

## Development

For local testing, copy this folder to:

```text
src/userplugins/markdownTables
```

For Equicord submission, copy the plugin to:

```text
src/equicordplugins/markdownTables
```

Useful checks:

```sh
pnpm exec tsx src/equicordplugins/markdownTables/parser.test.ts
pnpm build
pnpm test
```
