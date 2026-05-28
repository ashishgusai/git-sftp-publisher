import * as vscode from 'vscode';
import { ChangedFile } from './git';
import { SFTPProfile } from './profiles';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
    if (!channel) {
        channel = vscode.window.createOutputChannel('Git SFTP Publisher');
    }
    return channel;
}

export interface PreviewCounts {
    uploads: number;
    deletes: number;
}

export function showPreview(
    files: ChangedFile[],
    profile: SFTPProfile,
    baseRef: string
): PreviewCounts {
    const ch = getChannel();
    ch.clear();
    ch.appendLine('=== Git SFTP Deployment Preview ===');
    ch.appendLine(`Profile:   ${profile.name}`);
    ch.appendLine(`Remote:    ${profile.username}@${profile.host}:${profile.port}${profile.remotePath}`);
    ch.appendLine(`Baseline:  ${baseRef}`);
    ch.appendLine(
        `deleteRemoteFiles: ${profile.deleteRemoteFiles
            ? 'true (will remove deleted/renamed-old files)'
            : 'false (deletes will be skipped)'}`
    );
    ch.appendLine('');

    let uploads = 0;
    let deletes = 0;

    for (const f of files) {
        switch (f.op) {
            case 'add':
                ch.appendLine(`  [ADD]      ${f.remotePath}`);
                uploads++;
                break;
            case 'modify':
                ch.appendLine(`  [UPDATE]   ${f.remotePath}`);
                uploads++;
                break;
            case 'rename':
                ch.appendLine(`  [RENAME]   ${f.originalRemotePath}  ->  ${f.remotePath}`);
                uploads++;
                if (profile.deleteRemoteFiles && f.originalRemotePath !== f.remotePath) {
                    deletes++;
                }
                break;
            case 'delete':
                if (profile.deleteRemoteFiles) {
                    ch.appendLine(`  [DELETE]   ${f.remotePath}`);
                    deletes++;
                } else {
                    ch.appendLine(`  [skip-del] ${f.remotePath}`);
                }
                break;
        }
    }

    ch.appendLine('');
    ch.appendLine(`Summary: ${uploads} upload(s), ${deletes} delete(s)`);
    ch.show(true);
    return { uploads, deletes };
}

export function log(line: string): void {
    getChannel().appendLine(line);
}
