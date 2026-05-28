import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface SFTPProfile {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    remotePath: string;
    deleteRemoteFiles: boolean;
    ignore: string[];
}

const CONFIG_RELATIVE_PATH = path.join('.vscode', 'sftp.json');

export function getConfigPath(repoRoot: string): string {
    return path.join(repoRoot, CONFIG_RELATIVE_PATH);
}

export function configExists(repoRoot: string): boolean {
    return fs.existsSync(getConfigPath(repoRoot));
}

export async function loadProfiles(repoRoot: string): Promise<SFTPProfile[]> {
    const configPath = getConfigPath(repoRoot);
    if (!fs.existsSync(configPath)) {
        throw new Error(
            `Missing config: ${path.relative(repoRoot, configPath)}. Run "Git SFTP: Create Sample sftp.json" to scaffold one.`
        );
    }

    let raw: string;
    try {
        raw = fs.readFileSync(configPath, 'utf-8');
    } catch (err: any) {
        throw new Error(`Unable to read sftp.json: ${err.message}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err: any) {
        throw new Error(`sftp.json is not valid JSON: ${err.message}`);
    }

    const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    if (list.length === 0) {
        throw new Error('sftp.json contains no profiles.');
    }
    return list.map((entry, idx) => validateProfile(entry, idx));
}

function validateProfile(input: unknown, idx: number): SFTPProfile {
    if (typeof input !== 'object' || input === null) {
        throw new Error(`Profile #${idx + 1} in sftp.json is not an object.`);
    }
    const p = input as Record<string, unknown>;
    const required: Array<'host' | 'username' | 'remotePath'> = ['host', 'username', 'remotePath'];
    for (const key of required) {
        const value = p[key];
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error(`Profile #${idx + 1} is missing required string field "${key}".`);
        }
    }
    if (p.password === undefined && p.privateKeyPath === undefined) {
        throw new Error(
            `Profile "${typeof p.name === 'string' ? p.name : `#${idx + 1}`}" needs either "password" or "privateKeyPath".`
        );
    }

    return {
        name: typeof p.name === 'string' && p.name.length ? p.name : `Profile ${idx + 1}`,
        host: p.host as string,
        port: typeof p.port === 'number' ? p.port : 22,
        username: p.username as string,
        password: typeof p.password === 'string' ? p.password : undefined,
        privateKeyPath: typeof p.privateKeyPath === 'string' ? p.privateKeyPath : undefined,
        passphrase: typeof p.passphrase === 'string' ? p.passphrase : undefined,
        remotePath: p.remotePath as string,
        deleteRemoteFiles: p.deleteRemoteFiles === true,
        ignore: Array.isArray(p.ignore)
            ? p.ignore.filter((x): x is string => typeof x === 'string')
            : []
    };
}

export async function pickProfile(profiles: SFTPProfile[]): Promise<SFTPProfile | undefined> {
    if (profiles.length === 1) {
        return profiles[0];
    }
    const items = profiles.map(p => ({
        label: p.name,
        description: `${p.username}@${p.host}:${p.port}`,
        detail: p.remotePath + (p.deleteRemoteFiles ? '   [deletes remote files]' : ''),
        profile: p
    }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select target SFTP profile',
        matchOnDescription: true,
        matchOnDetail: true
    });
    return picked?.profile;
}

export const SAMPLE_CONFIG = JSON.stringify(
    [
        {
            name: 'Staging',
            host: 'staging.example.com',
            port: 22,
            username: 'deployer',
            password: 'REPLACE-ME-OR-USE-PRIVATEKEYPATH',
            remotePath: '/var/www/staging',
            deleteRemoteFiles: false,
            ignore: ['**/.git/**', '**/node_modules/**', '**/.DS_Store']
        },
        {
            name: 'Production',
            host: 'prod.example.com',
            port: 22,
            username: 'deployer',
            privateKeyPath: '~/.ssh/id_rsa',
            remotePath: '/var/www/production',
            deleteRemoteFiles: false,
            ignore: ['**/.git/**', '**/node_modules/**', '**/.DS_Store']
        }
    ],
    null,
    2
);
