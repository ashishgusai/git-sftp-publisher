import * as path from 'path';
import * as vscode from 'vscode';
import type { API as GitAPI, Change, GitExtension, Repository } from './types/git';

// Status constants from the VS Code Git extension (numeric).
export const GitStatus = {
    INDEX_MODIFIED: 0,
    INDEX_ADDED: 1,
    INDEX_DELETED: 2,
    INDEX_RENAMED: 3,
    INDEX_COPIED: 4
} as const;

export type FileOp = 'add' | 'modify' | 'delete' | 'rename';

export interface ChangedFile {
    op: FileOp;
    /** Repo-relative POSIX path used for both local and remote. */
    relativePath: string;
    /** Local filesystem absolute path. */
    localPath: string;
    /** Repo-relative POSIX path of original file (for renames). */
    originalRelativePath: string;
    /** Remote POSIX path after joining with profile.remotePath. */
    remotePath: string;
    /** Remote POSIX path of original file (for renames). */
    originalRemotePath: string;
}

export async function ensureGitAPI(): Promise<GitAPI> {
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!ext) {
        throw new Error('Built-in Git extension (vscode.git) is not installed or has been disabled.');
    }
    if (!ext.isActive) {
        await ext.activate();
    }
    return ext.exports.getAPI(1);
}

export async function pickRepository(api: GitAPI, hintUri?: vscode.Uri): Promise<Repository | undefined> {
    if (hintUri) {
        const repo = api.getRepository(hintUri);
        if (repo) return repo;
    }
    if (api.repositories.length === 0) return undefined;
    if (api.repositories.length === 1) return api.repositories[0];

    const items = api.repositories.map(r => ({
        label: path.basename(r.rootUri.fsPath),
        description: r.rootUri.fsPath,
        repo: r
    }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Multiple Git repositories found - pick one'
    });
    return picked?.repo;
}

function toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function joinRemote(remoteRoot: string, relPosix: string): string {
    const root = remoteRoot.replace(/\/+$/, '');
    const rel = relPosix.replace(/^\/+/, '');
    return `${root}/${rel}`;
}

function buildChangedFile(repoRoot: string, remoteRoot: string, change: Change): ChangedFile {
    const status = change.status;
    const targetUri = change.renameUri ?? change.uri;
    const targetRel = toPosix(path.relative(repoRoot, targetUri.fsPath));
    const originalRel = toPosix(path.relative(repoRoot, change.originalUri.fsPath));

    let op: FileOp;
    if (status === GitStatus.INDEX_ADDED) op = 'add';
    else if (status === GitStatus.INDEX_DELETED) op = 'delete';
    else if (status === GitStatus.INDEX_RENAMED) op = 'rename';
    else if (status === GitStatus.INDEX_COPIED) op = 'add';
    else op = 'modify';

    return {
        op,
        relativePath: targetRel,
        localPath: targetUri.fsPath,
        originalRelativePath: originalRel,
        remotePath: joinRemote(remoteRoot, targetRel),
        originalRemotePath: joinRemote(remoteRoot, originalRel)
    };
}

export async function diffCommitToHead(
    repo: Repository,
    fromCommit: string,
    remoteRoot: string
): Promise<ChangedFile[]> {
    const changes = await repo.diffBetween(fromCommit, 'HEAD');
    const repoRoot = repo.rootUri.fsPath;
    return changes.map(c => buildChangedFile(repoRoot, remoteRoot, c));
}

export interface DirtyState {
    dirty: boolean;
    summary: string;
    files: string[];
}

export function describeDirtyState(repo: Repository): DirtyState {
    const wt = repo.state.workingTreeChanges.length;
    const idx = repo.state.indexChanges.length;
    const total = wt + idx;
    const files = [
        ...repo.state.indexChanges.map(c => `staged:   ${path.basename(c.uri.fsPath)}`),
        ...repo.state.workingTreeChanges.map(c => `unstaged: ${path.basename(c.uri.fsPath)}`)
    ];
    return {
        dirty: total > 0,
        summary: total === 0 ? 'clean' : `${idx} staged, ${wt} unstaged`,
        files
    };
}
