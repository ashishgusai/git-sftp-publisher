# Changelog

All notable changes to this extension are documented here.

## 0.1.0 - 2026-05-28

### Added
- Push changes from a chosen Git commit through to `HEAD` over SFTP.
- Multi-profile config in `.vscode/sftp.json` (single object or array).
- Password and private-key authentication, with `~` expansion and optional passphrase.
- Dry-run preview in the `Git SFTP Publisher` output channel.
- Modal confirmation for destructive deploys (`deleteRemoteFiles: true`).
- Working-tree dirty warning before computing the diff.
- `.sftpignore` support, per-profile `ignore` array, and hard-excludes for `.git/` and `sftp.json`.
- Single-file deploy from the Explorer context menu, editor tab context menu, and command palette.
- Sample-config generator that offers to append `.vscode/sftp.json` to `.gitignore`.
