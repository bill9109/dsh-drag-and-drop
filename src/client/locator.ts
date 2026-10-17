import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { FILE_DROP_ROUTE, type LocateRequest, type LocateResponse } from '../protocol.ts'
import { readDirectoryContentSamples, readDirectoryStructure, type DroppedDirectory } from './directory.ts'
import { droppedFileMeta, fullFingerprint, sampleFingerprint } from './fingerprint.ts'

async function request(body: LocateRequest): Promise<LocateResponse> {
  const response = await fetch(FILE_DROP_ROUTE, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const value = await response.json() as LocateResponse
  return response.ok ? value : { status: 'error', message: value.status === 'error' ? value.message : `HTTP ${response.status}` }
}

function workspaceContext(workspaces: IWorkspaces, currentWorkspacePath: string | undefined) {
  return {
    workspacePaths: workspaces.list.getSnapshot().items.map(item => item.path),
    ...(currentWorkspacePath === undefined ? {} : { currentWorkspacePath }),
  }
}

export async function locateDroppedFile(file: File, workspaces: IWorkspaces, currentWorkspacePath: string | undefined): Promise<LocateResponse> {
  const meta = droppedFileMeta(file)
  let result = await request({ phase: 'metadata', file: meta, ...workspaceContext(workspaces, currentWorkspacePath) })
  if (result.status !== 'sample-required') return result
  result = await request({ phase: 'sample', file: meta, candidates: result.candidates, digest: await sampleFingerprint(file) })
  if (result.status !== 'full-required') return result
  return request({ phase: 'full', file: meta, candidates: result.candidates, digest: await fullFingerprint(file) })
}

export async function locateDroppedDirectory(directory: DroppedDirectory, workspaces: IWorkspaces, currentWorkspacePath: string | undefined): Promise<LocateResponse> {
  const initial = { kind: 'directory' as const, name: directory.name }
  let result = await request({ phase: 'metadata', file: initial, ...workspaceContext(workspaces, currentWorkspacePath) })
  if (result.status !== 'directory-structure-required') return result

  const meta = { ...initial, structure: await readDirectoryStructure(directory.entry) }
  result = await request({ phase: 'directory-structure', file: meta, candidates: result.candidates })
  if (result.status !== 'directory-content-required') return result
  return request({
    phase: 'directory-content', file: meta, candidates: result.candidates,
    directorySamples: await readDirectoryContentSamples(directory.entry, result.paths),
  })
}
