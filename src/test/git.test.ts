import { strict as assert } from 'node:assert';
import { joinRemote, toPosix } from '../git';

describe('git.joinRemote', () => {
    it('joins root and relative path with a single slash', () => {
        assert.equal(joinRemote('/var/www', 'src/foo.js'), '/var/www/src/foo.js');
    });

    it('strips trailing slashes from the root', () => {
        assert.equal(joinRemote('/var/www/', 'src/foo.js'), '/var/www/src/foo.js');
        assert.equal(joinRemote('/var/www///', 'src/foo.js'), '/var/www/src/foo.js');
    });

    it('strips leading slashes from the relative path', () => {
        assert.equal(joinRemote('/var/www', '/src/foo.js'), '/var/www/src/foo.js');
        assert.equal(joinRemote('/var/www', '//src/foo.js'), '/var/www/src/foo.js');
    });

    it('handles nested relative paths', () => {
        assert.equal(joinRemote('/var/www', 'src/lib/util.ts'), '/var/www/src/lib/util.ts');
    });
});

describe('git.toPosix', () => {
    it('is a no-op for already-posix paths', () => {
        assert.equal(toPosix('src/foo/bar.ts'), 'src/foo/bar.ts');
    });

    // path.sep differs by OS; this test only verifies that on Windows the conversion happens.
    // On posix systems backslashes are valid filename characters, so they are kept as-is.
    if (process.platform === 'win32') {
        it('converts backslashes to slashes on Windows', () => {
            assert.equal(toPosix('src\\foo\\bar.ts'), 'src/foo/bar.ts');
        });
    }
});
