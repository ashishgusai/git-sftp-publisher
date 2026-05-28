import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import SftpClient = require('ssh2-sftp-client');
import { ChangedFile } from './git';
import { SFTPProfile } from './profiles';
import { log } from './preview';

interface ConnectOptions {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: Buffer;
    passphrase?: string;
    readyTimeout: number;
}

function expandHome(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
    return p;
}

function buildConnectOptions(profile: SFTPProfile): ConnectOptions {
    const opts: ConnectOptions = {
        host: profile.host,
        port: profile.port,
        username: profile.username,
        readyTimeout: 20000
    };
    if (profile.privateKeyPath) {
        const keyPath = expandHome(profile.privateKeyPath);
        if (!fs.existsSync(keyPath)) {
            throw new Error(`Private key not found: ${keyPath}`);
        }
        opts.privateKey = fs.readFileSync(keyPath);
        if (profile.passphrase) opts.passphrase = profile.passphrase;
    } else if (profile.password) {
        opts.password = profile.password;
    } else {
        throw new Error('Profile must specify either password or privateKeyPath.');
    }
    return opts;
}

export interface DeployResult {
    succeeded: ChangedFile[];
    failed: { file: ChangedFile; error: string }[];
    skipped: ChangedFile[];
    cancelled: boolean;
}

export async function deploy(
    files: ChangedFile[],
    profile: SFTPProfile,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<DeployResult> {
    const client = new SftpClient();
    const result: DeployResult = { succeeded: [], failed: [], skipped: [], cancelled: false };

    let connected = false;
    try {
        progress.report({ message: `Connecting to ${profile.host}...` });
        await client.connect(buildConnectOptions(profile));
        connected = true;
        log(`Connected to ${profile.username}@${profile.host}:${profile.port}`);

        const ensuredDirs = new Set<string>();
        const total = files.length;
        let done = 0;
        const step = total > 0 ? 100 / total : 0;

        for (const f of files) {
            if (token.isCancellationRequested) {
                result.cancelled = true;
                log('Deployment cancelled.');
                break;
            }
            progress.report({ message: `(${done + 1}/${total}) ${f.relativePath}`, increment: step });

            try {
                if (f.op === 'delete') {
                    if (profile.deleteRemoteFiles) {
                        await safeDelete(client, f.remotePath);
                        log(`  deleted: ${f.remotePath}`);
                        result.succeeded.push(f);
                    } else {
                        log(`  skipped (deleteRemoteFiles=false): ${f.remotePath}`);
                        result.skipped.push(f);
                    }
                } else if (f.op === 'rename') {
                    if (!fs.existsSync(f.localPath)) {
                        throw new Error(`Local file missing: ${f.localPath}`);
                    }
                    await ensureDir(client, path.posix.dirname(f.remotePath), ensuredDirs);
                    await client.fastPut(f.localPath, f.remotePath);
                    log(`  uploaded (renamed): ${f.remotePath}`);
                    if (profile.deleteRemoteFiles && f.originalRemotePath !== f.remotePath) {
                        await safeDelete(client, f.originalRemotePath);
                        log(`  removed old path:   ${f.originalRemotePath}`);
                    }
                    result.succeeded.push(f);
                } else {
                    if (!fs.existsSync(f.localPath)) {
                        throw new Error(`Local file missing: ${f.localPath}`);
                    }
                    await ensureDir(client, path.posix.dirname(f.remotePath), ensuredDirs);
                    await client.fastPut(f.localPath, f.remotePath);
                    log(`  uploaded: ${f.remotePath}`);
                    result.succeeded.push(f);
                }
            } catch (err: any) {
                const msg = err?.message ?? String(err);
                log(`  FAILED:   ${f.relativePath} - ${msg}`);
                result.failed.push({ file: f, error: msg });
            }
            done++;
        }
    } finally {
        if (connected) {
            try { await client.end(); } catch { /* ignore */ }
        }
    }
    return result;
}

async function ensureDir(client: SftpClient, remoteDir: string, cache: Set<string>): Promise<void> {
    if (!remoteDir || remoteDir === '/' || remoteDir === '.' || cache.has(remoteDir)) return;
    try {
        await client.mkdir(remoteDir, true);
    } catch (err: any) {
        // mkdir may error if a parent exists already on some servers; verify via stat.
        try {
            const st = await client.stat(remoteDir);
            if (!st.isDirectory) {
                throw new Error(`Remote path exists but is not a directory: ${remoteDir}`);
            }
        } catch {
            throw err;
        }
    }
    cache.add(remoteDir);
}

async function safeDelete(client: SftpClient, remotePath: string): Promise<void> {
    try {
        await client.delete(remotePath);
    } catch (err: any) {
        if (err?.code === 2 || /no such file/i.test(err?.message ?? '')) {
            return;
        }
        throw err;
    }
}

export async function deploySingleFile(
    localAbsPath: string,
    repoRoot: string,
    profile: SFTPProfile,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<DeployResult> {
    const rel = path.relative(repoRoot, localAbsPath).split(path.sep).join('/');
    const remoteRoot = profile.remotePath.replace(/\/+$/, '');
    const remotePath = `${remoteRoot}/${rel.replace(/^\/+/, '')}`;
    const file: ChangedFile = {
        op: 'modify',
        relativePath: rel,
        localPath: localAbsPath,
        originalRelativePath: rel,
        remotePath,
        originalRemotePath: remotePath
    };
    return deploy([file], profile, progress, token);
}
