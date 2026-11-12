# Automated dependency updates

Voka uses Renovate to propose updates for the React/Capacitor application.

## Configuration and branches

- Renovate's repository-wide `renovate.json` lives on the default `main` branch.
- `baseBranchPatterns: ["react"]` directs dependency PRs to `react`, not the legacy static site on `main`.
- Renovate checks updates on Mondays (Europe/Berlin), opens at most five concurrent PRs and at most two PRs per hour.
- The Dependency Dashboard tracks proposed or pending updates.

## Automation policy

- Stable npm package patch/minor updates (current major version >= 1) may be merged automatically.
- Major updates, pre-1.0 packages, and React, Capacitor, Supabase JS and PWA plugin updates need review.
- Related Capacitor and React packages are grouped.
- Renovate must only merge after the existing `React application checks` workflow succeeds on the PR. This workflow runs TypeScript/Vite build, Vitest, and Playwright/Cucumber scenarios.
- Never bypass failed checks to get an update merged. Native iOS/Android release checks are not included in this browser CI.

## One-time GitHub setup

1. Install and enable [Renovate](https://github.com/apps/renovate) for `mhuhn/voka`. Merely adding `renovate.json` does **not** activate the GitHub App.
2. In repository settings, enable **Allow auto-merge** if available, and protect the `react` branch with a rule or ruleset requiring the `verify` job from **React application checks** to pass before merge. Do not require a human review for PRs intended for auto-merge. The `react` branch did not have a required-check protection rule when this configuration was added.
3. Verify Renovate's first PR and ensure the required checks run and that a failing test prevents merge.

The connected GitHub integration used to create this configuration does not provide repository administration actions, so enabling the GitHub App, auto-merge, and branch protection must be done in GitHub's UI.

## Reproducible dependency installs

The React branch currently has **no committed `package-lock.json`**. This means transitive npm versions may vary between installs even when `package.json` remains unchanged. Follow up by generating and committing a lockfile with Node 22 / npm 10, then replace `npm install --no-audit` with `npm ci --no-audit` in CI and Pages deployment. Renovate can subsequently maintain the lockfile.

This setup does not automatically update the legacy static PWA on `main` or test Capacitor native device builds.
