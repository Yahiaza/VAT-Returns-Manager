# Auto Update setup

The application checks releases from:

- Owner: `Yahiaza`
- Repository: `VAT-Returns-Updates`
- Repository visibility: Public

The source repository can remain private.

## Build outputs

Run:

```powershell
npm run build
```

This creates both:

- `VAT-Returns-Manager-<version>-Setup.exe` — recommended installation, supports auto update.
- `VAT-Returns-Manager-<version>-Portable.exe` — portable fallback, manual update.

The NSIS build also creates update metadata such as `latest.yml` and blockmap files.

## GitHub Actions publishing

The private source repository needs a GitHub Actions secret named:

`UPDATE_REPO_TOKEN`

Create a fine-grained GitHub token with **Contents: Read and write** permission only for `Yahiaza/VAT-Returns-Updates`, then add it to the private source repository under:

Settings → Secrets and variables → Actions → New repository secret

Do not put this token in the application source code.

## Release flow

1. Change the version in `package.json`, for example `0.3.1`.
2. Commit and push the source changes.
3. Create/push the matching tag:

```powershell
git tag -a v0.3.1 -m "VAT Returns Manager 0.3.1"
git push origin v0.3.1
```

4. GitHub Actions builds the Windows files and publishes them to `VAT-Returns-Updates`.
5. Installed Setup versions detect the release automatically.

For the first updater test, install `0.3.0`, then publish `0.3.1`.
