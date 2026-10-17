#!/usr/bin/env node
/**
 * Build lib/ (Node half + Web client bundle) with a DSH checkout's toolchain.
 *
 * Two DSH toolchain facts shape this script:
 *
 * 1. The shared `clientBundle` preset (packages/client/tsdown.client.ts) reads
 *    the built package's manifest from the checkout's own `packages/<group>/`
 *    `<dir>` package.json glob, so an out-of-tree profile plugin must be visible there
 *    for the build. We stage a package.json symlink into
 *    `packages/client/<name>/` and drop it again in `finally`.
 * 2. Workspace packages are not hoisted to the checkout's root node_modules, so
 *    tsc cannot resolve `@deepseek-ai/*` types from the plugin directory alone.
 *    We mirror the checkout's node_modules into a PRIVATE directory of symlinks
 *    and add every workspace `@deepseek-ai/*` package (plus the vendored
 *    rescoped cordis) there — nothing is written into the DSH installation
 *    itself.
 *
 * Dependency resolution therefore needs no npm install and always matches the
 * running harness. Build-only links are removed in `finally` so packaging
 * never picks them up.
 *
 * Usage:  DSH_CHECKOUT=/path/to/dsh node scripts/build.mjs
 *         (or just `npm run build` when `dsh` is on PATH)
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packageName = manifest.name
const workspaceDirName = packageName.slice(packageName.lastIndexOf('/') + 1)

function resolveCheckout() {
  if (process.env.DSH_CHECKOUT !== undefined && process.env.DSH_CHECKOUT !== '') {
    return resolve(process.env.DSH_CHECKOUT)
  }
  const which = spawnSync('command', ['-v', 'dsh'], { shell: true, encoding: 'utf8' })
  const launcher = which.stdout.trim()
  if (launcher === '') throw new Error('Cannot find DSH; set DSH_CHECKOUT=/path/to/dsh')
  let directory = dirname(realpathSync(launcher))
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(directory, 'packages', 'client', 'tsdown.client.ts'))) return directory
    directory = dirname(directory)
  }
  throw new Error(`No DSH checkout found above ${launcher}; set DSH_CHECKOUT`)
}

/** Every `packages/<group>/<dir>` package, keyed by its declared name. */
function workspacePackages(checkout) {
  const found = new Map()
  const packages = join(checkout, 'packages')
  for (const group of readdirSync(packages, { withFileTypes: true })) {
    if (!group.isDirectory()) continue
    const groupDirectory = join(packages, group.name)
    for (const entry of readdirSync(groupDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const packageFile = join(groupDirectory, entry.name, 'package.json')
      if (!existsSync(packageFile)) continue
      try {
        const name = JSON.parse(readFileSync(packageFile, 'utf8')).name
        if (typeof name === 'string') found.set(name, join(groupDirectory, entry.name))
      } catch {
        // Ignore directories without valid package metadata.
      }
    }
  }
  return found
}

/** Mirror one directory level as symlinks, skipping `@deepseek-ai`. */
function mirror(sourceDirectory, targetDirectory) {
  mkdirSync(targetDirectory, { recursive: true })
  if (!existsSync(sourceDirectory)) return
  for (const entry of readdirSync(sourceDirectory)) {
    if (entry === '@deepseek-ai') continue
    symlinkSync(join(sourceDirectory, entry), join(targetDirectory, entry))
  }
}

const checkout = resolveCheckout()
if (!existsSync(join(checkout, 'packages', 'client', 'tsdown.client.ts'))) {
  throw new Error(`${checkout} is not a DSH checkout (packages/client/tsdown.client.ts missing)`)
}
console.log(`build: using dsh checkout ${checkout}`)

const checkoutModules = join(checkout, 'node_modules')
const nodeModules = join(root, 'node_modules')
rmSync(nodeModules, { recursive: true, force: true })
// A real directory of symlinks: resolution works without writing into the
// checkout's own node_modules (a symlink to it would redirect every mkdir and
// symlink below into the installation).
mirror(checkoutModules, nodeModules)

// The shared preset locates this package's manifest in the checkout's own
// workspace glob, so stage a package.json symlink there for the build.
const stagedDirectory = join(checkout, 'packages', 'client', workspaceDirName)
let staged = false

try {
  const scope = join(nodeModules, '@deepseek-ai')
  mkdirSync(scope, { recursive: true })
  // Preserve the checkout's own @deepseek-ai rows (out-of-tree plugins et al).
  mirror(join(checkoutModules, '@deepseek-ai'), scope)
  // The framework peer is rescoped into @deepseek-ai (cordis -> @deepseek-ai/cordis):
  // link the vendored source under the scoped name so tsc/tsdown resolve it.
  const cordisTarget = join(scope, 'cordis')
  if (!existsSync(cordisTarget)) symlinkSync(join(checkout, 'vendor', 'cordis'), cordisTarget, 'dir')
  // rc-era client types spread across many workspace packages, so link them all
  // rather than a hand-kept list that drifts with every DSH release.
  for (const [name, directory] of workspacePackages(checkout)) {
    if (!name.startsWith('@deepseek-ai/')) continue
    const target = join(scope, name.slice(name.lastIndexOf('/') + 1))
    if (existsSync(target)) continue
    symlinkSync(directory, target, 'dir')
  }

  if (!existsSync(stagedDirectory)) {
    mkdirSync(stagedDirectory, { recursive: true })
    symlinkSync(join(root, 'package.json'), join(stagedDirectory, 'package.json'), 'file')
    staged = true
    console.log(`build: staged ${packageName} manifest at ${stagedDirectory}`)
  }

  const bin = join(checkoutModules, '.bin')
  const run = (name, args) => {
    const result = spawnSync(join(bin, name), args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, DSH_CHECKOUT: checkout },
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  // tsc first: tsdown's Node-half entry is lib/types/index.js, a tsc output.
  run('tsc', ['-p', 'tsconfig.json'])
  run('tsdown', ['-c', 'tsdown.config.mjs'])
} finally {
  rmSync(nodeModules, { recursive: true, force: true })
  if (staged && existsSync(stagedDirectory)) rmSync(stagedDirectory, { recursive: true, force: true })
}
console.log('build: done — lib/ ready (lib/index.js + lib/client.js + lib/types)')
