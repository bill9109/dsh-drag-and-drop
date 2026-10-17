# dsh-drag-and-drop — Drag local files in and insert their real paths

[![Release v0.1.7](https://img.shields.io/badge/release-v0.1.7-5B4CF0?style=flat-square)](https://github.com/omdsh-dev/dsh-drag-and-drop/releases/tag/v0.1.7)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%5E20%20%7C%20%3E%3D22-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**Install:** `dsh plugin --profile web add github:omdsh-dev/dsh-drag-and-drop`

**A DeepSeek Harness Web UI plugin: drag local files or folders onto any part of the page and their original absolute filesystem paths are inserted into the current conversation input — without uploading, moving, or copying anything.**

[English](README.md) | [中文](README.zh.md)

## Why this exists

A browser never hands a web page the real filesystem path of a dropped file — it exposes only a local file URI when it feels like it, and often nothing at all, for security. DSH, though, operates on real files: its tools read, run, and patch actual paths on the machine. Drop a file into an ordinary web input and you get either an upload (a copy that silently breaks the file's relationship with its neighboring dependencies) or a hand-typed path that is easy to get wrong.

This plugin closes that gap on the machine running DSH. It converts the browser's local file URI into the native absolute path, and when the browser hides the path entirely it resolves the file back to its real location — through the current Workspace, registered Workspaces, the OS file index, and a bounded directory search — then writes that path into the current conversation input. The file never leaves its directory.

## Features

- Drag files onto any part of the Web UI to insert their original absolute paths
- Full-page dim + blur hint while dragging
- Supports files and folders; drag multiple items at once — one path per line
- Native paths on macOS, Linux, and Windows
- POSIX paths, Windows drive-letter paths, and UNC network paths
- No uploading, moving, or copying of files
- Locates files in the current Workspace and registered Workspaces first
- When the browser hides the original path, uses the local file index and bounded directory search
- Computes content fingerprints only when multiple candidates exist
- When several byte-identical copies cannot be told apart automatically, lets the user pick the path
- Failed lookups surface as a dismissible plugin toast (auto-dismisses after 8s; hovering pauses the timer)
- Writes the draft via DSH's input-state service instead of touching the input DOM

## Usage

Drag files or folders from Finder, a Linux file manager, or Windows Explorer onto any part of the DSH Web UI.

Release the mouse when the full-page drag hint appears; the plugin writes the resolved original absolute path into the current conversation input.

Dropping multiple items at once inserts one path per line.

## Install

The plugin is a DSH **bundle** (`package.json` declares `dsh.bundle` + `dsh.client`). Install it into the `web` profile with the standard `dsh plugin` mechanism — **no DSH source changes and no `config.yaml` needed**:

```sh
dsh plugin --profile web add github:omdsh-dev/dsh-drag-and-drop
# or from a local checkout:
dsh plugin --profile web add /path/to/dsh-drag-and-drop
```

The repository ships its build output (`lib/` is committed) — no build step needed after installing.

> The old README's `pnpm --filter @deepseek-ai/dsh add ...` + `config.yaml` flow is obsolete: under the official profile/bundle model `config.yaml` is no longer read.

After installing, **restart the Web UI** the way you normally start DSH, then refresh the browser page — the plugin appears in the browser boot manifest (`__DSH_BOOT__`) and its client bundle loads automatically.

### Upgrade

```sh
dsh plugin --profile web update github:omdsh-dev/dsh-drag-and-drop
```

For a local-path installation, run `add` again against the replacement checkout.

### Uninstall

```sh
dsh plugin --profile web remove dsh-drag-and-drop
```

The command removes the package from the profile and from `dsh.profile.bundles`. After uninstalling, restart the Web UI and hard-refresh the browser.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Dropping a file inserts nothing | Drag again and confirm the full-page hint appears. Verify the bundle is in the profile (`dsh --profile web --dump-config | grep drag-and-drop`) and that the Web UI was restarted + hard-refreshed after installing |
| Wrong path inserted when several copies share a name | Candidates are filtered by full file name and size, then content-sampled only among the survivors. If byte-identical copies remain, the plugin shows a chooser — pick the correct path there |
| Path resolution is slow on a large disk | Install the platform index (Linux: `plocate`; Windows: Everything CLI) and keep files inside a Workspace or a common directory. Every search is bounded: 3s per index command, at most 100 candidates, at most 20,000 directory entries per root |
| macOS/Linux: dropping a folder resolves nothing | Folders are matched by name against Workspaces and common directories; a folder outside every searchable root cannot be located when the browser hides the path — move it into a Workspace or install the OS index |
| Plugin does not load after install | Restart the Web UI and hard-refresh the browser — the client bundle only loads on a fresh page load with the plugin in `__DSH_BOOT__` |

## Path resolution

If the browser exposes a local file URI, the plugin converts it directly into the operating system's native path.

If the browser hides the original path for security reasons, the plugin locates the file in this order:

1. The current Workspace
2. Other registered Workspaces
3. Desktop, Documents, and Downloads
4. A depth-1..3 shallow scan within each search root: the root's direct child, the direct children of its direct subdirectories, and the direct children of those subdirectories — this resolves the vast majority of real drops (e.g. `~/Downloads/dump2 11/iotclaw.ndjson`) without walking the whole tree
5. The operating system's file index
6. A bounded, platform-specific directory search

System indexes used per platform:

- macOS: Spotlight
- Linux: `plocate` first, then `locate`
- Windows: Everything CLI first, then PowerShell

On Linux, when the system index returns no candidates, the plugin also searches the user home directory and mount points under `/mnt` and `/media`.

On Windows, when the system index returns no candidates, the plugin also searches the user directory and available fixed disks.

To keep searches bounded:

- a single external index command times out after 3 seconds
- at most 100 candidate paths are kept
- the depth-3 shallow scan expands at most 4,096 direct subdirectories per root
- each recursive search root visits at most 20,000 directory entries
- unreadable directories and files are ignored

## Candidate confirmation

Candidates are first filtered by:

- the full file name
- the file size

Modification time is used only for ranking candidates, never as identity.

<<<<<<< HEAD
If only one candidate remains, the plugin uses that path directly without reading the file's content.
=======
每一层搜索都先做浅层快速定位：先检查搜索根的直接子项，再检查直接子目录与孙目录内的直接子项（共三层以内的文件，绝大多数拖拽都在这一范围内），随后才查询该范围内的操作系统索引，最后才递归目录。当前 Workspace、其他 Workspace 和常用目录的优先级保持不变。
>>>>>>> 4bab506 (feat: resolve dropped-file paths up to three levels deep)

If multiple candidates remain, the plugin compares sampled fingerprints from the beginning, middle, and end of the files. Only when sampled fingerprints of large files still collide does it compute a full SHA-256.

If several paths correspond to byte-identical files, the plugin shows the list of paths and lets the user choose which one to insert.

Folders are first searched by name only. A unique candidate is returned directly without traversing the browser directory; multiple same-name candidates are compared by sorted relative path, project type, and file size. For directories that are structurally identical, content samples of up to 24 deterministically chosen files are computed; if still identical, the user picks the path. Directory traversal processes at most 10,000 entries and 32 levels deep, and never follows symlinks or Windows junctions.

Each search level first checks the direct children of the search root, then queries the OS index within that scope, and only then recurses into directories. The priority of the current Workspace, other Workspaces, and common directories is preserved.

## Privacy & file access

The plugin never:

- uploads files
- copies files
- moves files
- modifies files
- deletes files

In most cases the plugin only reads file metadata.

Only when multiple candidates share the same name and size does it read a small amount of content to compute sampled fingerprints, and only when large files cannot be told apart by sampling does it read the full content to compute SHA-256.

All resolution and fingerprinting happens locally on the machine running DSH.

## Platform notes

### macOS

Finder drag-and-drop and the Spotlight index are supported. Verified in Chrome on macOS.

### Linux

File managers that provide `text/uri-list` are supported. When the browser hides the path, the plugin searches Workspaces, common directories, `plocate`, `locate`, and bounded mount directories.

Installing `plocate` is recommended for faster global path resolution.

### Windows

Drive-letter paths and UNC network paths are supported. When the browser hides the path, the plugin prefers the Everything CLI; without Everything it uses PowerShell to search the user directory and fixed disks.

Installing Everything and its command-line tools significantly speeds up path resolution on large disks.

## Development and verification

The build script needs a DSH checkout. By default it locates one through the `dsh` command; you can also point it explicitly:

```sh
DSH_CHECKOUT=/path/to/dsh pnpm run build
```

Run tests:

```sh
pnpm test
```

Type-check:

```sh
pnpm run check
```

Build:

```sh
pnpm run build
```

Repository layout:

- `src/` — host (node) half: path resolution, directory walk, fingerprinting, platform search, and the file-locate HTTP route
- `src/client/` — browser half: drag handling, drop items, path locator, candidate chooser, toast UI
- `tests/` — vitest suites for the host and client logic
- `lib/` — committed build output (host + client bundles)

## Community and About

- Use [GitHub Issues](https://github.com/omdsh-dev/dsh-drag-and-drop/issues) for reproducible bugs, focused feature requests, and usage questions.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes; report vulnerabilities privately via [SECURITY.md](SECURITY.md).
- Follow releases and compatibility notes in [CHANGELOG.md](CHANGELOG.md).

## License

BSD-3-Clause