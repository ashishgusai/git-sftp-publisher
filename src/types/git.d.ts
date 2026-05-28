// Slim subset of the VS Code Git extension API.
// Reference: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts

import { Uri, Event } from 'vscode';

export interface GitExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: Event<boolean>;
    getAPI(version: 1): API;
}

export interface API {
    readonly state: 'uninitialized' | 'initialized';
    readonly onDidChangeState: Event<'uninitialized' | 'initialized'>;
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
    getRepository(uri: Uri): Repository | null;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly state: RepositoryState;
    log(options?: LogOptions): Promise<Commit[]>;
    diffBetween(ref1: string, ref2: string): Promise<Change[]>;
}

export interface LogOptions {
    readonly maxEntries?: number;
    readonly path?: string;
}

export interface Commit {
    readonly hash: string;
    readonly message: string;
    readonly parents: string[];
    readonly authorDate?: Date;
    readonly authorName?: string;
    readonly authorEmail?: string;
    readonly commitDate?: Date;
}

export interface Change {
    readonly uri: Uri;
    readonly originalUri: Uri;
    readonly renameUri: Uri | undefined;
    /** Numeric status. See GitStatus constants in src/git.ts. */
    readonly status: number;
}

export interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly workingTreeChanges: Change[];
    readonly indexChanges: Change[];
    readonly mergeChanges: Change[];
}

export interface Branch {
    readonly name?: string;
    readonly commit?: string;
}
