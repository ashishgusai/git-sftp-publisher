import { strict as assert } from 'node:assert';
import { isIgnored } from '../sftpignore';

describe('sftpignore.isIgnored', () => {
    it('hard-excludes .git contents even with empty patterns', () => {
        assert.equal(isIgnored('.git/HEAD', []), true);
        assert.equal(isIgnored('.git/refs/heads/main', []), true);
        assert.equal(isIgnored('src/foo/.git/objects/abc', []), true);
    });

    it('hard-excludes credentials files even with empty patterns', () => {
        assert.equal(isIgnored('.vscode/sftp.json', []), true);
        assert.equal(isIgnored('.vscode/sftp.json.bak', []), true);
        assert.equal(isIgnored('.sftpignore', []), true);
    });

    it('respects user-supplied glob patterns', () => {
        assert.equal(isIgnored('node_modules/foo.js', ['**/node_modules/**']), true);
        assert.equal(isIgnored('packages/a/node_modules/foo.js', ['**/node_modules/**']), true);
        assert.equal(isIgnored('src/foo.js', ['**/node_modules/**']), false);
    });

    it('matches dotfiles when patterns include them', () => {
        assert.equal(isIgnored('src/.DS_Store', ['**/.DS_Store']), true);
        assert.equal(isIgnored('.env', ['.env']), true);
    });

    it('does not match unrelated files', () => {
        assert.equal(isIgnored('src/index.ts', []), false);
        assert.equal(isIgnored('src/index.ts', ['**/*.md']), false);
    });

    it('treats backslashes as posix slashes for matching', () => {
        // simulate a Windows-shaped path that slipped through normalisation
        assert.equal(isIgnored('src\\foo.ts', []), false);
        assert.equal(isIgnored('src\\foo.ts', ['**/*.ts']), true);
    });
});
