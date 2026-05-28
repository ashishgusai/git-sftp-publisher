# Git SFTP Publisher

A VS Code extension inspired by [`Natizyskunk.sftp`](https://marketplace.visualstudio.com/items?itemName=Natizyskunk.sftp), with a headline feature it doesn't have: **deploy only the files that changed between a chosen Git commit and `HEAD`**.

Stop uploading your entire workspace. Pick a baseline commit, preview the diff, and ship exactly what changed.

## Features

- **Push from commit to HEAD** - pick any recent commit, the extension uploads only the files added / modified / renamed / deleted between that commit and `HEAD`.
- **Multi-profile config** (staging, production, etc.) in `.vscode/sftp.json`.
- **Dry-run preview** in the `Git SFTP Publisher` output channel before any byte hits the wire.
- **Modal confirmation** with an extra warning when a deploy would delete files on the remote.
- **Working-tree dirty warning** so you don't accidentally forget to commit before deploying.
- **`.sftpignore`** + per-profile `ignore` patterns + always-on hard-excludes (`.git/`, `.vscode/sftp.json`).
- **Single-file deploy** via Explorer right-click, editor tab right-click, or command palette.
- **Cancellable progress** + per-file success/failure reporting.

## Quick start

1. Install the extension (`.vsix` or via the Marketplace once published).
2. Run **Git SFTP: Create Sample sftp.json** from the command palette. The extension drops a sample profile array in `.vscode/sftp.json` and offers to add it to `.gitignore` (recommended, since it can contain credentials).
3. Edit `.vscode/sftp.json` with your real host, username, remote path, and either `password` or `privateKeyPath`.
4. Run **Git SFTP: Deploy Changes from Commit...** Pick a baseline commit, pick a profile, review the preview, confirm.

## Configuration: `.vscode/sftp.json`

Either a single object or an array of profiles. Example:

```json
[
  {
    "name": "Staging",
    "host": "staging.example.com",
    "port": 22,
    "username": "deployer",
    "password": "your-password",
    "remotePath": "/var/www/staging",
    "deleteRemoteFiles": false,
    "ignore": ["**/.git/**", "**/node_modules/**", "**/.DS_Store"]
  },
  {
    "name": "Production",
    "host": "prod.example.com",
    "port": 22,
    "username": "deployer",
    "privateKeyPath": "~/.ssh/id_rsa",
    "passphrase": "",
    "remotePath": "/var/www/production",
    "deleteRemoteFiles": false,
    "ignore": ["**/.git/**", "**/node_modules/**"]
  }
]
```

Field reference:

| Field               | Required        | Description                                                                |
|---------------------|-----------------|----------------------------------------------------------------------------|
| `name`              | recommended     | Display label in the profile picker. Defaults to `Profile N`.              |
| `host`              | yes             | SFTP server hostname / IP.                                                 |
| `port`              | no              | Defaults to `22`.                                                          |
| `username`          | yes             | SSH user.                                                                  |
| `password`          | yes\*           | Plaintext password. Either this or `privateKeyPath` must be set.           |
| `privateKeyPath`    | yes\*           | Path to private key. `~` is expanded.                                      |
| `passphrase`        | no              | Key passphrase if applicable.                                              |
| `remotePath`        | yes             | Absolute remote root that local file paths are joined against.             |
| `deleteRemoteFiles` | no, default `false` | If `true`, files deleted in the diff are also removed on the remote.   |
| `ignore`            | no              | Array of glob patterns (minimatch syntax) excluded from this profile.      |

Hard-excluded patterns that cannot be overridden: `.git/**`, `.vscode/sftp.json`, `.sftpignore`.

### `.sftpignore`

A repo-root `.sftpignore` file is read on every deploy. Each non-empty, non-`#`-comment line is a minimatch pattern that joins the profile's `ignore` array.

## Diff semantics

The diff is **strict**: it is exactly what `git diff <selected-commit>..HEAD` reports.

- Files added between the commit and HEAD -> uploaded.
- Files modified -> uploaded (overwriting remote).
- Files renamed -> new path uploaded; the old remote path is only removed if `deleteRemoteFiles: true`.
- Files deleted -> removed on the remote only if `deleteRemoteFiles: true`, otherwise listed as `[skip-del]` in the preview.

**Uncommitted / staged changes are never deployed.** The extension warns you up front if the working tree is dirty so you can commit (or stash) first. Disable the warning in settings via `gitSftpPublisher.warnOnDirtyWorkingTree`.

## Commands

| Command                                  | Where                                                              |
|------------------------------------------|--------------------------------------------------------------------|
| `Git SFTP: Deploy Changes from Commit...`| Command palette, Source Control title menu                         |
| `Git SFTP: Deploy File to SFTP Profile`  | Explorer context (file), editor tab context, command palette       |
| `Git SFTP: Create Sample sftp.json`      | Command palette                                                    |

## Settings

| Setting                                       | Default | Description                                                                                       |
|-----------------------------------------------|---------|---------------------------------------------------------------------------------------------------|
| `gitSftpPublisher.recentCommitLimit`          | `30`    | How many commits the baseline picker shows.                                                       |
| `gitSftpPublisher.warnOnDirtyWorkingTree`     | `true`  | Warn before a deploy when the working tree has uncommitted/staged changes.                        |
| `gitSftpPublisher.confirmDestructive`         | `true`  | Show a modal confirmation when a deploy will delete files on the remote.                          |

## Build from source

```bash
npm install
npm run compile        # one-shot
npm run watch          # rebuild on save
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Package as `.vsix`

```bash
npm install -g @vscode/vsce
vsce package
```

Install the resulting `git-sftp-publisher-X.Y.Z.vsix` via VS Code: Extensions view -> ... menu -> *Install from VSIX...*

## License

MIT.
