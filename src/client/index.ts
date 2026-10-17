import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { choosePath } from './chooser.ts'
import { droppedItems } from './drop-items.ts'
import { locateDroppedDirectory, locateDroppedFile } from './locator.ts'
import { pathsFromDrop } from './paths.ts'
import { suppressImageFormatToast } from './suppress-toast.ts'
import { createFileDropToast, type FileDropToast } from './toast.ts'

export { pathsFromDrop, pathsFromUriList } from './paths.ts'

export const inject = ['sessions', 'workspaces', 'conversation', 'uiSession']

const OVERLAY_ID = 'dsh-file-drop-overlay'

interface DropOverlay {
  setActive(active: boolean): void
  dispose(): void
}

function createFileIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '64')
  svg.setAttribute('height', '64')
  svg.style.color = 'var(--dsw-alias-state-business-primary, #3964fe)'
  svg.innerHTML = [
    '<path d="M18 7h19.2c1.8 0 3.5.7 4.8 2l9 9c1.3 1.3 2 3 2 4.8V49a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V15a8 8 0 0 1 8-8Z" fill="currentColor"/>',
    '<path d="M37 7.1V18a5 5 0 0 0 5 5h10.9c-.1-1.9-.8-3.6-2.1-4.9l-8.9-9A7.1 7.1 0 0 0 37 7.1Z" fill="rgb(255 255 255 / 38%)"/>',
    '<path d="M21 32h22M21 40h22M21 48h14" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" opacity=".92"/>',
  ].join('')
  return svg
}

function createOverlay(): DropOverlay {
  const root = document.createElement('div')
  root.id = OVERLAY_ID
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', display: 'grid', placeItems: 'center',
    padding: '24px', pointerEvents: 'none', opacity: '0', visibility: 'hidden',
    transition: 'opacity 140ms ease, visibility 140ms ease', background: 'rgb(15 23 42 / 44%)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  })
  const panel = document.createElement('div')
  Object.assign(panel.style, {
    display: 'grid', justifyItems: 'center', gap: '14px', minWidth: '260px', padding: '28px 36px',
    color: '#ffffff',
    font: '600 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '0',
  })
  panel.append(createFileIcon())
  const label = document.createElement('span')
  label.textContent = '松开鼠标以插入文件路径'
  panel.append(label)
  root.append(panel)
  document.body.append(root)
  return {
    setActive(active) {
      root.style.opacity = active ? '1' : '0'
      root.style.visibility = active ? 'visible' : 'hidden'
    },
    dispose() { root.remove() },
  }
}

function hasFilePayload(event: DragEvent): boolean {
  const types = event.dataTransfer?.types ?? []
  return types.includes('Files') || types.includes('text/uri-list')
}

type SessionInput = ReturnType<IConversation['input']['for']>

type SessionId = Parameters<ClientContext['sessions']['scope']>[0]

/**
 * The Session the Conversation area is showing, as projected by the Session UI
 * adapter. `sessions.list` stopped carrying a `current` field in DSH 0.2.1;
 * `uiSession.adapter.current` is the adapter the renderer itself consumes, and
 * its key is the Session id (absent while no Session is selected).
 */
function currentSessionId(ctx: ClientContext): SessionId | undefined {
  return ctx.uiSession.adapter.current.getSnapshot().key as SessionId | undefined
}

function currentInput(ctx: ClientContext): SessionInput | undefined {
  const sessionId = currentSessionId(ctx)
  if (sessionId === undefined) return undefined
  const scope = ctx.sessions.scope(sessionId)
  const conversation = ctx.get('conversation')
  return scope === undefined || conversation === undefined ? undefined : conversation.input.for(scope)
}

function currentWorkspacePath(ctx: ClientContext): string | undefined {
  const sessionId = currentSessionId(ctx)
  return sessionId === undefined ? undefined : ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
}

function appendPaths(input: SessionInput, paths: readonly string[]): void {
  const draft = input.state.getSnapshot().draft
  const text = paths.join('\n')
  input.setDraft(draft === '' ? text : `${draft}\n${text}`)
}

async function resolveDrop(ctx: ClientContext, dataTransfer: DataTransfer, toast: FileDropToast): Promise<void> {
  const input = currentInput(ctx)
  if (input === undefined) return
  const direct = pathsFromDrop(dataTransfer)
  if (direct.length > 0) {
    appendPaths(input, direct)
    return
  }

  const { directories, files } = droppedItems(dataTransfer)
  const entries = [
    ...directories.map(directory => ({ name: directory.name, locate: () => locateDroppedDirectory(directory, ctx.workspaces, currentWorkspacePath(ctx)) })),
    ...files.map(file => ({ name: file.name, locate: () => locateDroppedFile(file, ctx.workspaces, currentWorkspacePath(ctx)) })),
  ]
  const found: string[] = []
  const failures: string[] = []
  for (const entry of entries) {
    try {
      const result = await entry.locate()
      if (result.status === 'found') found.push(result.path)
      else if (result.status === 'choose') {
        const selected = await choosePath(entry.name, result.candidates)
        if (selected === undefined) failures.push(entry.name)
        else found.push(selected)
      } else if (result.status === 'error') {
        failures.push(`${entry.name}（${result.message}）`)
      } else {
        failures.push(entry.name)
      }
    } catch (error) {
      failures.push(`${entry.name}（${error instanceof Error ? error.message : String(error)}）`)
    }
  }
  if (found.length > 0) appendPaths(input, found)
  if (failures.length > 0) toast.showError(`未能定位原始路径：${failures.join('、')}`)
}

export function apply(ctx: ClientContext): void {
  let dragDepth = 0
  const overlay = createOverlay()
  const toast = createFileDropToast()
  const suppressToast = suppressImageFormatToast()
  const onDragEnter = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return
    dragDepth += 1
    overlay.setActive(true)
  }
  const onDragOver = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return
    event.preventDefault()
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
    overlay.setActive(true)
  }
  const onDragLeave = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) overlay.setActive(false)
  }
  const onDrop = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return
    event.preventDefault()
    dragDepth = 0
    overlay.setActive(false)
    if (event.dataTransfer !== null) void resolveDrop(ctx, event.dataTransfer, toast)
  }
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  ctx.effect(() => () => {
    window.removeEventListener('dragenter', onDragEnter)
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('dragleave', onDragLeave)
    window.removeEventListener('drop', onDrop)
    overlay.dispose()
    toast.dispose()
    suppressToast.dispose()
  }, 'file-drop: global drag listeners')
}
