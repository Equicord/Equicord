### Nuncord

- [Git Windows](https://github.com/git-for-windows/git/releases) `https://github.com/git-for-windows/git`
- [NodeJS LTS](https://github.com/nodejs/node/releases) `https://github.com/nodejs/node`

```powershell
# Setup
npm install -g pnpm

# Clone
git clone https://github.com/Nuncord/Nuncord
cd Nuncord

# Install
pnpm install --frozen-lockfile

# Build
pnpm build

# Inject
pnpm inject

# Extension
pnpm buildWeb
```

> :exclamation: **Extension** will be built to the `dist` directory

<div align="center">
  <img src="./browser/icon.png" width="256" alt="Nuncord">
</div>
