import { strict as assert } from 'node:assert';
import { parseProfilesFromString } from '../profiles';

describe('profiles.parseProfilesFromString', () => {
    const goodProfile = {
        name: 'Staging',
        host: 'example.com',
        username: 'u',
        password: 'p',
        remotePath: '/var/www'
    };

    it('parses an array of profiles', () => {
        const raw = JSON.stringify([goodProfile, { ...goodProfile, name: 'Prod' }]);
        const profiles = parseProfilesFromString(raw);
        assert.equal(profiles.length, 2);
        assert.equal(profiles[0].name, 'Staging');
        assert.equal(profiles[1].name, 'Prod');
    });

    it('auto-wraps a single object into an array', () => {
        const profiles = parseProfilesFromString(JSON.stringify(goodProfile));
        assert.equal(profiles.length, 1);
        assert.equal(profiles[0].host, 'example.com');
    });

    it('defaults port to 22', () => {
        const profiles = parseProfilesFromString(JSON.stringify(goodProfile));
        assert.equal(profiles[0].port, 22);
    });

    it('defaults deleteRemoteFiles to false', () => {
        const profiles = parseProfilesFromString(JSON.stringify(goodProfile));
        assert.equal(profiles[0].deleteRemoteFiles, false);
    });

    it('accepts privateKeyPath instead of password', () => {
        const raw = JSON.stringify({ ...goodProfile, password: undefined, privateKeyPath: '~/.ssh/id_rsa' });
        const profiles = parseProfilesFromString(raw);
        assert.equal(profiles[0].privateKeyPath, '~/.ssh/id_rsa');
        assert.equal(profiles[0].password, undefined);
    });

    it('throws on invalid JSON', () => {
        assert.throws(() => parseProfilesFromString('not json'), /not valid JSON/);
    });

    it('throws when neither password nor privateKeyPath is given', () => {
        const raw = JSON.stringify({ ...goodProfile, password: undefined });
        assert.throws(() => parseProfilesFromString(raw), /password.*privateKeyPath/);
    });

    it('throws when required fields are missing', () => {
        const raw = JSON.stringify({ host: 'example.com' });
        assert.throws(() => parseProfilesFromString(raw), /username/);
    });

    it('throws on empty array', () => {
        assert.throws(() => parseProfilesFromString('[]'), /no profiles/);
    });

    it('filters non-string entries out of ignore array', () => {
        const raw = JSON.stringify({ ...goodProfile, ignore: ['**/.git/**', 42, null, 'foo'] });
        const profiles = parseProfilesFromString(raw);
        assert.deepEqual(profiles[0].ignore, ['**/.git/**', 'foo']);
    });
});
