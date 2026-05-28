import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    ensureGitAPI,
    pickRepository,
    diffCommitToHead,
    describeDirtyState
} from './git';
import {
    configExists,
    getConfigPath,
    loadProfiles,
    pickProfile,
    SAMPLE_CONFIG,
    SFTPProfile
} from './profiles';
import { loadSftpIgnore, isIgnored } from './sftpignore';
import { showPreview, log } from './preview';
import { deploy, deploySingleFile, DeployResult } from './deploy';

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('gitSftpPublisher.pushFromCommit', () => runPushFromCommit()),
        vscode.commands.registerCommand('gitSftpPublisher.deployFile', (uri?: vscode.Uri) => runDeployFile(uri)),
        vscode.commands.registerCommand('gitSftpPublisher.createSampleConfig', () => runCreateSampleConfig())
    );
}

export function deactivate(): void { /* no-op */ }

async function runPushFromCommit(): Promise<void> {
    try {
        const api = await ensureGitAPI();
        const repo = await pickRepository(api);
        if (!repo) {
            vscode.window.showErrorMessage('No Git repository found in the open workspace.');
            return;
        }
        const repoRoot = repo.rootUri.fsPath;
        const cfg = vscode.workspace.getConfiguration('gitSftpPublisher');

        if (cfg.get<boolean>('warnOnDirtyWorkingTree', true)) {
            const dirty = describeDirtyState(repo);
            if (dirty.dirty) {
                const preview = dirty.files.slice(0, 15).join('\n')
                    + (dirty.files.length > 15 ? `\n...and ${dirty.files.length - 15} more` : '');
                const proceed = await vscode.window.showWarningMessage(
                    `Working tree has uncommitted changes (${dirty.summary}). These will NOT be deployed - only committed changes between the chosen baseline and HEAD will be sent. Continue?`,
                    { modal: true, detail: preview },
                    'Continue'
                );
                if (proceed !== 'Continue') return;
            }
        }

        const commitLimit = cfg.get<number>('recentCommitLimit', 30);
        const commits = await repo.log({ maxEntries: commitLimit });
        if (commits.length === 0) {
            vscode.window.showErrorMessage('No commits in this repository.');
            return;
        }

        const headHash = repo.state.HEAD?.commit;
        const commitItems = commits
            .filter(c => c.hash !== headHash)
            .map(c => ({
                label: c.message.split('\n')[0].slice(0, 80),
                description: c.hash.substring(0, 8),
                detail: `${c.authorName ?? 'unknown'} - ${c.authorDate?.toLocaleString() ?? ''}`,
                hash: c.hash
            }));
        if (commitItems.length === 0) {
            vscode.window.showInformationMessage('No commits available to use as baseline (HEAD is the only commit).');
            return;
        }

        const pickedCommit = await vscode.window.showQuickPick(commitItems, {
            placeHolder: 'Pick baseline commit - everything after it (up to HEAD) will be deployed',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (!pickedCommit) return;

        let profiles: SFTPProfile[];
        try {
            profiles = await loadProfiles(repoRoot);
        } catch (err: any) {
            const action = await vscode.window.showErrorMessage(err.message, 'Create Sample');
            if (action === 'Create Sample') await runCreateSampleConfig();
            return;
        }
        const profile = await pickProfile(profiles);
        if (!profile) return;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Computing diff ${pickedCommit.description}..HEAD`,
                cancellable: true
            },
            async (progress, token) => {
                let files = await diffCommitToHead(repo, pickedCommit.hash, profile.remotePath);
                const allPatterns = (profile.ignore ?? []).concat(loadSftpIgnore(repoRoot));
                const beforeFilter = files.length;
                files = files.filter(f => !isIgnored(f.relativePath, allPatterns));
                const ignoredCount = beforeFilter - files.length;
                if (ignoredCount > 0) log(`Filtered out ${ignoredCount} ignored file(s).`);

                if (files.length === 0) {
                    vscode.window.showInformationMessage('No files to deploy after applying ignore rules.');
                    return;
                }

                const { uploads, deletes } = showPreview(files, profile, `${pickedCommit.description}..HEAD`);

                const destructive = deletes > 0 && profile.deleteRemoteFiles === true;
                const useModal = destructive && cfg.get<boolean>('confirmDestructive', true);
                const detail = destructive
                    ? `${deletes} file(s) will be DELETED on the remote.`
                    : undefined;

                const action = await vscode.window.showWarningMessage(
                    `Deploy ${uploads} upload(s)${deletes ? ` + ${deletes} delete(s)` : ''} to "${profile.name}"?`,
                    { modal: useModal, detail },
                    'Deploy'
                );
                if (action !== 'Deploy') return;

                progress.report({ message: 'Uploading...' });
                const result = await deploy(files, profile, progress, token);
                reportResult(result, profile);
            }
        );
    } catch (err: any) {
        vscode.window.showErrorMessage(`Git SFTP: ${err?.message ?? err}`);
    }
}

async function runDeployFile(uri?: vscode.Uri): Promise<void> {
    try {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target) {
            vscode.window.showErrorMessage('No file selected.');
            return;
        }
        if (target.scheme !== 'file') {
            vscode.window.showErrorMessage('Selected item is not a regular file.');
            return;
        }

        const ws = vscode.workspace.getWorkspaceFolder(target);
        if (!ws) {
            vscode.window.showErrorMessage('File is not inside an open workspace folder.');
            return;
        }
        const repoRoot = ws.uri.fsPath;

        let profiles: SFTPProfile[];
        try {
            profiles = await loadProfiles(repoRoot);
        } catch (err: any) {
            const action = await vscode.window.showErrorMessage(err.message, 'Create Sample');
            if (action === 'Create Sample') await runCreateSampleConfig();
            return;
        }
        const profile = await pickProfile(profiles);
        if (!profile) return;

        const rel = path.relative(repoRoot, target.fsPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            vscode.window.showErrorMessage('File is outside the workspace root.');
            return;
        }
        const relPosix = rel.split(path.sep).join('/');

        const allPatterns = (profile.ignore ?? []).concat(loadSftpIgnore(repoRoot));
        if (isIgnored(relPosix, allPatterns)) {
            const proceed = await vscode.window.showWarningMessage(
                `${relPosix} matches an ignore pattern. Upload anyway?`,
                'Upload', 'Cancel'
            );
            if (proceed !== 'Upload') return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${path.basename(target.fsPath)} to ${profile.name}`,
                cancellable: true
            },
            async (progress, token) => {
                const result = await deploySingleFile(target.fsPath, repoRoot, profile, progress, token);
                reportResult(result, profile);
            }
        );
    } catch (err: any) {
        vscode.window.showErrorMessage(`Git SFTP: ${err?.message ?? err}`);
    }
}

async function runCreateSampleConfig(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('Open a workspace first.');
        return;
    }
    const folder = folders.length === 1
        ? folders[0]
        : await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Pick workspace folder for sftp.json' });
    if (!folder) return;

    const configPath = getConfigPath(folder.uri.fsPath);
    if (configExists(folder.uri.fsPath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `${path.relative(folder.uri.fsPath, configPath)} already exists. Overwrite?`,
            { modal: true },
            'Overwrite'
        );
        if (overwrite !== 'Overwrite') return;
    }

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, SAMPLE_CONFIG, 'utf-8');

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);

    const action = await vscode.window.showWarningMessage(
        'sftp.json may contain credentials. Add ".vscode/sftp.json" to .gitignore so it is not committed?',
        'Add to .gitignore', 'Skip'
    );
    if (action !== 'Add to .gitignore') return;

    const gitignorePath = path.join(folder.uri.fsPath, '.gitignore');
    const entry = '.vscode/sftp.json';
    try {
        if (fs.existsSync(gitignorePath)) {
            const existing = fs.readFileSync(gitignorePath, 'utf-8');
            const alreadyIgnored = existing.split(/\r?\n/).some(line => line.trim() === entry);
            if (!alreadyIgnored) {
                const sep = existing.endsWith('\n') ? '' : '\n';
                fs.appendFileSync(gitignorePath, `${sep}${entry}\n`);
            }
        } else {
            fs.writeFileSync(gitignorePath, `${entry}\n`);
        }
        vscode.window.showInformationMessage('Added .vscode/sftp.json to .gitignore.');
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to update .gitignore: ${err.message}`);
    }
}

function reportResult(result: DeployResult, profile: SFTPProfile): void {
    const okCount = result.succeeded.length;
    const failCount = result.failed.length;
    const skipCount = result.skipped.length;

    const summary = [
        `${okCount} sent`,
        skipCount ? `${skipCount} skipped` : null,
        failCount ? `${failCount} failed` : null
    ].filter(Boolean).join(', ');

    if (failCount === 0 && !result.cancelled) {
        vscode.window.showInformationMessage(`${profile.name}: ${summary}.`);
    } else if (result.cancelled) {
        vscode.window.showWarningMessage(`${profile.name}: deploy cancelled. ${summary}.`);
    } else {
        vscode.window.showErrorMessage(
            `${profile.name}: ${summary}. See "Git SFTP Publisher" output for details.`,
            'Show Output'
        ).then(action => {
            if (action === 'Show Output') {
                log('');
                log('--- Failures ---');
                for (const f of result.failed) log(`  ${f.file.relativePath}: ${f.error}`);
            }
        });
    }
}
