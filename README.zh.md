# dsh-drag-and-drop — 拖入本地文件，插入真实路径

[![Release v0.1.7](https://img.shields.io/badge/release-v0.1.7-5B4CF0?style=flat-square)](https://github.com/omdsh-dev/dsh-drag-and-drop/releases/tag/v0.1.7)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%5E20%20%7C%20%3E%3D22-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**安装：** `dsh plugin --profile web add github:omdsh-dev/dsh-drag-and-drop`

**DeepSeek Harness Web UI 插件：把本地文件或文件夹拖入页面任意位置，其原始绝对文件系统路径就会插入当前会话输入框——不上传、不移动、不复制任何东西。**

[English](README.md) | 中文

## 为什么需要它

出于安全原因，浏览器从不把拖入文件的真实文件系统路径交给网页——最多给一个本地文件 URI，很多时候什么都不给。而 DSH 操作的是真实文件：它的工具要读取、运行、修改本机上的实际路径。把文件拖进普通网页输入框，要么变成上传（一份副本，悄悄切断文件与相邻依赖文件的关系），要么只能手敲路径，很容易出错。

这个插件在运行 DSH 的本机上补上这个缺口。它把浏览器的本地文件 URI 转成操作系统的原生绝对路径；当浏览器完全隐藏路径时，它通过当前 Workspace、已注册 Workspace、操作系统文件索引和受控目录搜索，把文件定位回真实位置，再写进当前会话输入框。文件始终不离开它所在的目录。

## 实现能力

- 将文件拖入 Web UI 任意位置即可插入原始绝对路径
- 拖拽过程中显示全页面压暗和模糊提示
- 支持文件和文件夹，也支持一次拖入多个项目，每个路径占一行
- 支持 macOS、Linux 和 Windows 原生路径
- 支持 POSIX 路径、Windows 盘符路径和 UNC 网络路径
- 不上传、不移动、不复制文件
- 优先在当前 Workspace 和已注册 Workspace 中定位文件
- 浏览器隐藏原始路径时，使用本地文件索引和受控目录搜索
- 仅在存在多个候选文件时计算内容指纹
- 多个完全相同的文件副本无法自动区分时，由用户选择路径
- 定位失败使用插件 toast 提示，可手动关闭，8 秒后自动消失，悬停时暂停计时
- 通过 DSH 的输入状态服务写入草稿，不直接修改输入框 DOM

## 使用

把文件或文件夹从 Finder、Linux 文件管理器或 Windows 文件资源管理器拖入 DSH Web UI 的任意位置。

出现全页面拖拽提示后松开鼠标，插件会将定位到的原始绝对路径写入当前会话输入框。

一次拖入多个项目时，每个路径占一行。

## 安装

本插件是 DSH **bundle**（`package.json` 声明 `dsh.bundle` + `dsh.client`），通过标准的 `dsh plugin` 机制安装到 `web` profile，**无需修改 DSH 源码、无需 `config.yaml`**：

```sh
dsh plugin --profile web add github:omdsh-dev/dsh-drag-and-drop
# 或本地 checkout：
dsh plugin --profile web add /path/to/dsh-drag-and-drop
```

仓库包含构建产物（`lib/` 已提交），安装后无需另外构建。

> 旧版 README 的 `pnpm --filter @deepseek-ai/dsh add ...` + `config.yaml` 方式已过时：官方 profile/bundle 模型下不再读取 `config.yaml`。

安装后**重启 Web UI**（按你当前启动 DSH Web UI 的方式）并刷新浏览器页面，插件会出现在浏览器引导图（`__DSH_BOOT__`）中，其 client bundle 自动加载。

### 升级

```sh
dsh plugin --profile web update github:omdsh-dev/dsh-drag-and-drop
```

本地路径安装则对替换后的 checkout 重新执行 `add`。

### 卸载

```sh
dsh plugin --profile web remove dsh-drag-and-drop
```

命令会把包从 profile 和 `dsh.profile.bundles` 中移除。卸载后重启 Web UI 并硬刷新浏览器。

## 故障排查

| 症状 | 解决 |
| --- | --- |
| 拖入文件没有任何反应 | 重新拖一次并确认全页面提示出现。用 `dsh --profile web --dump-config | grep drag-and-drop` 确认 bundle 在 profile 里，并确认安装后已重启 Web UI + 硬刷新 |
| 多个同名副本时插入了错误路径 | 候选先按完整文件名和大小过滤，只在幸存者之间采样内容；仍有完全相同副本时插件会弹出选择列表——在那里选正确的路径 |
| 大磁盘上路径定位很慢 | 安装平台索引（Linux：`plocate`；Windows：Everything CLI），并让文件位于 Workspace 或常用目录内。每次搜索都有边界：索引命令 3 秒超时、最多保留 100 个候选、每个递归根最多访问 20,000 个目录项 |
| macOS/Linux：拖入文件夹定位失败 | 文件夹按名称匹配 Workspace 和常用目录；浏览器隐藏路径时，位于所有可搜索根之外的文件夹无法定位——把它移进 Workspace，或安装操作系统索引 |
| 安装后插件没有加载 | 重启 Web UI 并硬刷新浏览器——client bundle 只在插件进入 `__DSH_BOOT__` 后的全新页面加载时生效 |

## 路径定位

如果浏览器提供本地文件 URI，插件会直接转换为当前操作系统的原生路径。

如果浏览器出于安全原因隐藏原始路径，插件按以下顺序定位文件：

1. 当前 Workspace
2. 其他已注册 Workspace
3. Desktop、Documents 和 Downloads
4. 各搜索根内三层以内的浅层快速定位：根的直接子项、直接子目录的直接子项、以及这些子目录的直接子项——绝大多数真实拖拽（如 `~/Downloads/dump2 11/iotclaw.ndjson`）无需遍历整棵目录树即可命中
5. 操作系统文件索引
6. 有边界限制的平台目录搜索

不同平台使用的系统索引：

- macOS：Spotlight
- Linux：优先使用 `plocate`，其次使用 `locate`
- Windows：优先使用 Everything CLI，其次使用 PowerShell

Linux 在系统索引没有返回候选时，还会搜索用户主目录以及 `/mnt`、`/media` 下的挂载目录。

Windows 在系统索引没有返回候选时，还会搜索用户目录和可用的固定磁盘。

为了避免无边界搜索：

- 单次外部索引命令的超时时间为 3 秒
- 最多保留 100 个候选路径
- 三层浅层快速定位在每个搜索根最多展开 4,096 个直接子目录
- 每个递归搜索根最多访问 20,000 个目录项
- 无法读取的目录和文件会被忽略

## 候选确认

候选文件首先通过以下信息筛选：

- 完整文件名
- 文件大小

修改时间只用于候选排序，不作为文件身份依据。

如果只剩一个候选，插件会直接使用该路径，不读取文件内容。

如果存在多个候选，插件会比较文件开头、中间和结尾的采样指纹。大文件的采样指纹仍然冲突时，才会计算完整 SHA-256。

如果多个路径对应完全相同的文件内容，插件会显示路径列表，由用户选择需要插入的路径。

文件夹首次只按名称搜索。唯一候选会直接返回，不遍历浏览器目录；多个同名候选才比较排序后的相对路径、项目类型和文件大小。结构相同的多个目录会进一步对最多 24 个确定性选择的文件计算内容采样；仍然相同则由用户选择路径。目录遍历最多处理 10,000 个项目和 32 层，不跟随符号链接或 Windows junction。

每一层搜索都先检查搜索根的直接子项，再查询该范围内的操作系统索引，最后才递归目录。当前 Workspace、其他 Workspace 和常用目录的优先级保持不变。

## 隐私和文件访问

插件不会：

- 上传文件
- 复制文件
- 移动文件
- 修改文件
- 删除文件

多数情况下，插件只读取文件元数据。

只有存在多个同名、同大小候选文件时，才会读取少量文件内容计算采样指纹。仅在大文件采样仍然无法区分时，才会读取完整内容计算 SHA-256。

所有定位和指纹计算都在运行 DSH 的本机完成。

## 平台说明

### macOS

支持 Finder 拖拽和 Spotlight 索引。已在 macOS Chrome 环境验证。

### Linux

支持提供 `text/uri-list` 的文件管理器。浏览器隐藏路径时，插件使用 Workspace、常用目录、`plocate`、`locate` 和受控挂载目录搜索。

建议安装 `plocate`，以获得更快的全局路径定位。

### Windows

支持盘符路径和 UNC 网络路径。浏览器隐藏路径时，插件优先使用 Everything CLI；未安装 Everything 时，使用 PowerShell 搜索用户目录和固定磁盘。

安装 Everything 及其命令行工具可以显著提高大磁盘上的定位速度。

## 开发与验证

构建脚本需要可用的 DSH checkout。默认会从 `dsh` 命令定位，也可以显式指定：

```sh
DSH_CHECKOUT=/path/to/dsh pnpm run build
```

运行测试：

```sh
pnpm test
```

执行类型检查：

```sh
pnpm run check
```

构建：

```sh
pnpm run build
```

仓库结构：

- `src/` — host（node）半边：路径定位、目录遍历、指纹计算、平台搜索、文件定位 HTTP 路由
- `src/client/` — 浏览器半边：拖拽处理、拖入项、路径定位器、候选选择器、toast UI
- `tests/` — host 与 client 逻辑的 vitest 套件
- `lib/` — 已提交的构建产物（host + client bundle）

## 社区与关于

- 可复现的 bug、聚焦的功能请求和使用问题，走 [GitHub Issues](https://github.com/omdsh-dev/dsh-drag-and-drop/issues)。
- 提变更前先读 [CONTRIBUTING.md](CONTRIBUTING.md)；安全问题通过 [SECURITY.md](SECURITY.md) 私有上报。
- 版本与兼容性说明见 [CHANGELOG.md](CHANGELOG.md)。

## License

BSD-3-Clause
