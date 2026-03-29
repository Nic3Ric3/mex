# Contributing to mex

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/theDakshJaitly/mex.git
cd mex
npm install
npm run build
```

## Development

```bash
npm run dev          # watch mode — rebuilds on changes
npm run test:watch   # run tests in watch mode
npm run typecheck    # type check without emitting
```

## Before submitting a PR

1. Run the full check suite:
   ```bash
   npm run typecheck && npm run test && npm run build
   ```
2. Keep changes focused — one fix or feature per PR.
3. Add tests for new checkers or bug fixes when possible.
4. Don't refactor surrounding code unless that's the point of the PR.

## Project structure

```
src/
  cli.ts              # CLI entry point (commander)
  config.ts           # Project/scaffold root detection
  drift/
    claims.ts         # Extract claims from markdown files
    checkers/         # Individual drift checkers
    scoring.ts        # Score computation
    index.ts          # Orchestrates drift check
  scanner/            # Codebase pre-scanner (used by mex init)
  sync/               # AI-targeted sync (brief builder + interactive loop)
  reporter.ts         # Terminal output formatting
test/                 # Vitest tests
```

## Reporting bugs

Open an issue using the bug report template. Include the output of `mex check --json` if relevant.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
