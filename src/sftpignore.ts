import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

const SFTPIGNORE_FILENAME = '.sftpignore';

// Patterns that are NEVER uploaded regardless of profile/sftpignore config.
const HARD_EXCLUDES = [
    '.git',
    '.git/**',
    '**/.git/**',
    '.vscode/sftp.json',
    '.vscode/sftp.json.bak',
    '.sftpignore'
];

export function loadSftpIgnore(repoRoot: string): string[] {
    const ignorePath = path.join(repoRoot, SFTPIGNORE_FILENAME);
    if (!fs.existsSync(ignorePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(ignorePath, 'utf-8');
        return raw
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
    } catch {
        return [];
    }
}

export function isIgnored(relativePosixPath: string, patterns: string[]): boolean {
    const normalized = relativePosixPath.split(path.sep).join('/');
    const all = HARD_EXCLUDES.concat(patterns);
    return all.some(pattern => minimatch(normalized, pattern, { dot: true }));
}
