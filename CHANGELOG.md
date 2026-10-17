# Changelog

All notable user-facing changes to dsh-drag-and-drop are documented in this file. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic version tags.

## [0.1.7] - 2026-10-17

### Fixed

- DSH 0.2.1: the current Session is read from `uiSession.adapter.current` instead of the removed `sessions.list.current` field, so dropping a file while a Session is open resolves the right conversation input and workspace again.
- DSH 0.2.1: the Web client now injects `@deepseek-ai/dsh-client-ui-session`; the retired `@deepseek-ai/dsh-client-runtime` package is no longer referenced by the bundle manifest or the type edges.

### Changed

- Build: the shared `clientBundle` preset is called with the package directory (its 0.2.1 contract) instead of the package name, and `scripts/build.mjs` mirrors the checkout's non-hoisted workspace packages into a private `node_modules` of symlinks instead of linking a hand-kept package list.

## [0.1.6] - 2026-08-21

### Fixed

- Windows: es.exe is invoked with `-w` (match whole words) instead of the nonexistent `-whole-filename` switch, which made the Everything CLI print its help text and forced every drop onto the slow PowerShell fallback (issue #4).
- Windows: es.exe and PowerShell results are decoded using the console's active code page (GBK on Chinese Windows) rather than assuming UTF-8, so non-ASCII file names such as `新建 文本文档 (3).txt` no longer arrive as mojibake and fail the exact basename match (issue #4).
- Windows: only the CLI binary `es.exe` is probed; the GUI binary `Everything.exe` is no longer launched with command-line options, which could pop up a "command line options" window and never return results (issue #4).
- Tests: the Windows platform-search tests now feed real GBK bytes and assert the `-w` switch instead of mocking es.exe output while asserting the invalid `-whole-filename` switch (issue #4).

## [0.1.5] - 2026-08-14

### Added

- Depth-1..3 shallow scan within each search root, run before the OS index and the bounded recursive walk: the root's direct child, the direct children of its direct subdirectories, and the direct children of those subdirectories (up to 4,096 expanded subdirectories per root). This resolves drops like a file two levels deep inside a 500k-entry Downloads tree — previously the direct-child-only probe missed it, the recursive walk exhausted its 20,000-entry budget, and the drop failed with the "未能定位原始路径" toast.

## [0.1.4] - 2026-08-14

### Changed

- Migrated the repository to the `omdsh-dev` GitHub organization: the package scope is now `@omdsh-dev/dsh-drag-and-drop`, and the repository, homepage, issues, badges, and install commands all point at `github.com/omdsh-dev/dsh-drag-and-drop`. The built `lib/` was updated with the new registration name.

## [0.1.3] - 2026-08-14

### Changed

- Repositioned the README around the project's role as a DeepSeek Harness Web UI bundle plugin, in the shared bilingual convention: `README.md` (English) is now the main file, `README.zh.md` carries the Chinese side, and `README.i18n.yaml` records their git blob hashes with a `scripts/verify-i18n.mjs` consistency check.
- Added versioned static badges, a one-line install command, and sections for Why this exists, Usage, Upgrade/Uninstall lifecycle, Troubleshooting, and Development and verification; the previous `README.md` (zh) + `README.en.md` layout is renamed into that convention.
- Expanded `package.json` metadata: English description, `keywords`, `engines`, the `./cordis.patch.yml` export, and README files in `files`.
- Added `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, and `CODE_OF_CONDUCT.md`.

## [0.1.2] - 2026-08-14

### Changed

- Renamed the package scope `@dsh-external` → `@bill9109` (repositories live under `github.com/bill9109`); the built `lib/` was rebuilt with the new registration name.
