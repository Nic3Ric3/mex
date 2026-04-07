# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-04-07

### Changed
- **Simplified install flow** — `npx promexeus setup` now offers to install globally at the end, so `mex check` and `mex sync` just work
- Users who skip global install get clear `npx promexeus` commands as the fallback
- Removed dev-dependency + package.json scripts instructions — one canonical flow, not three
- README install section rewritten: setup → global install prompt → done
- Fixed wrong package name (`mex-cli`) in post-setup instructions
- `mex commands` output cleaned up: removed shell scripts section, shows `npx promexeus` fallback

## [0.2.0] - 2026-04-05

### Added
- **`mex setup` command** — npx-first install replaces git clone + bash script. One command: `npx promexeus setup`
- Bundled scaffold templates in npm package (`templates/` directory)
- Interactive tool config selection (Claude Code, Cursor, Windsurf, GitHub Copilot)
- Project state detection: fresh, existing, or partial scaffold
- Codebase pre-scanner integration during setup
- `--dry-run` flag for setup command
- Published to npm as `promexeus`

### Fixed
- False positive `DEPENDENCY_MISSING` warnings for versioned dependencies with semver prefixes (`^`, `~`, `>=`)

### Changed
- Package renamed from `mex` to `promexeus` for npm availability
- Sync now sends all drift issues to Claude in a single session instead of one session per file — reduces token usage and eliminates repeated session restarts
- README updated: npx is now the primary install method, git clone is the alternative

## [0.1.0] - 2026-03-21

### Added
- Initial release
- 8 drift checkers: path, edges, index-sync, staleness, command, dependency, cross-file, script-coverage
- `mex check` with `--quiet`, `--json`, `--fix` flags
- `mex sync` with interactive and prompt modes, dry-run support
- `mex init` codebase pre-scanner
- `mex watch` post-commit hook
- `setup.sh` for first-time scaffold population
- `sync.sh` interactive menu
- Multi-tool support (Claude Code, Cursor, Windsurf, GitHub Copilot)
