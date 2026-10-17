import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client';
import { type LocateResponse } from '../protocol.ts';
import { type DroppedDirectory } from './directory.ts';
export declare function locateDroppedFile(file: File, workspaces: IWorkspaces, currentWorkspacePath: string | undefined): Promise<LocateResponse>;
export declare function locateDroppedDirectory(directory: DroppedDirectory, workspaces: IWorkspaces, currentWorkspacePath: string | undefined): Promise<LocateResponse>;
