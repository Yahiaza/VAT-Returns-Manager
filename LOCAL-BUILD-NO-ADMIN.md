# Local build without Windows symlink/admin requirement

Use this only for local builds on machines where electron-builder's winCodeSign cache fails with:
`A required privilege is not held by the client`.

Commands:

- Both Setup + Portable: `npm run build:local`
- Setup only: `npm run build:local:setup`
- Portable only: `npm run build:local:portable`

This disables electron-builder's Windows executable sign/edit stage only for these local commands, avoiding the winCodeSign package that requires symlink privileges on some Windows configurations.

The normal `npm run build` and `npm run release` commands are unchanged. GitHub Actions can keep using the normal release command so published releases retain the standard executable resource-editing path.
