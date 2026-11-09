# Contributing

Thanks for helping improve Dynamic Properties.

## Reporting issues

Please include:

- Obsidian version and platform.
- The plugin version from `manifest.json`.
- The tag rule and property names involved.
- Steps to reproduce, expected behavior, and actual behavior.
- Relevant console errors, if any.

Open issues at <https://github.com/acloudofdream/obsidian-dynamic-properties/issues>.

## Development

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm run build
```

`npm run dev` starts esbuild in watch mode and writes `main.js`.

## Pull requests

- Keep changes focused and explain the user-facing behavior they affect.
- Run `npm run build` before opening a pull request.
- Do not commit `node_modules/`, `data.json`, `.obsidian/`, or personal vault paths.
- Add tests when practical; otherwise describe the manual verification steps.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
