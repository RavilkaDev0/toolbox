# GitHub governance — TBX-002

The development, release, hotfix and rollback process remains defined in [09 — Git Workflow](../09-GIT-WORKFLOW.md). This document records the enforced configuration after Foundation integration. Repository settings are remote state and can drift; inspect them before changing them.

## Verified baseline

On 2026-10-11 PR #1 was merged into `dev` with merge commit `075fe3be17a8cdc0cf6a7b072933c3457a6086a9`. Its subsequent [Quality push run](https://github.com/RavilkaDev0/toolbox/actions/runs/38090796756) passed before settings were applied. `main` remained `99f5cdbf4ebdbaead953ca52ce36ae3bbc94700c`.

- `dev` is the default and integration branch. Work branches start here and PRs target it.
- `main` is production history. Release PRs use `dev` → `main` and a merge commit. Merging does not authorize deployment.
- Branch names: `feat/*`, `fix/*`, `refactor/*`, `chore/*`, `docs/*`, lowercase with hyphens. The old `codex/tbx-001-foundation` branch is a historical exception.
- After release/hotfix, synchronize `main` back into `dev` with a checked PR and merge commit. Roll back through reviewed reverts, preserving shared history.

## Enforced repository settings

One active branch ruleset, `integration-and-production` (ID `24856873`), targets `refs/heads/dev` and `refs/heads/main`. There are no bypass actors and no overlapping classic branch protections. Both branches' effective rule APIs and `protected: true` metadata were verified.

| Setting | Applied value |
| --- | --- |
| Pull request required | Both branches |
| Required approving reviews | 0; no code-owner, last-push or extra unattributed-change approval |
| Review conversations | Must be resolved |
| Required check | `validate`, GitHub Actions integration ID `15368` |
| Branch must be up to date | Yes |
| Force pushes / branch deletion | Blocked |
| Ruleset bypass | None, including administrators |
| Merge methods | Merge commit and squash enabled; rebase disabled |
| Auto-merge / automatic head deletion | Disabled |
| Required deployments / production deployment | None configured by this task |

A solo developer records self-review and verification evidence in the PR. No other person's approving review is mandatory. Failed or pending `validate`, unresolved conversations and an outdated branch still block merging. Agents do not merge automatically. Keep `dev` current by merging its new commits into published work branches; do not force-push. Release and synchronization PRs must use merge commits even though squash is available for short work PRs.

The ruleset enforces PRs/checks but does not constrain PR source names or require `dev` as the head of every production PR. Contributors must follow the documented release/hotfix policy. Critical incidents do not grant an implicit protection bypass.

## Read-only audit commands

Use the official authenticated GitHub CLI. On Windows, a terminal opened before its winget installation may need the absolute `gh.exe` path or a new terminal. Set the repository default with `gh repo set-default RavilkaDev0/toolbox`. Authentication uses the official browser/device flow; never paste tokens into chat or documentation. `gh` uses SSH after login; the existing working Git remote may retain HTTPS.

```sh
gh --version
gh auth status
gh repo set-default --view
gh api repos/RavilkaDev0/toolbox --jq '{default_branch,allow_merge_commit,allow_squash_merge,allow_rebase_merge,allow_auto_merge,delete_branch_on_merge,permissions}'
gh api repos/RavilkaDev0/toolbox/rulesets
gh api repos/RavilkaDev0/toolbox/rulesets/24856873
gh api repos/RavilkaDev0/toolbox/rules/branches/dev
gh api repos/RavilkaDev0/toolbox/rules/branches/main
gh api repos/RavilkaDev0/toolbox/branches/dev
gh api repos/RavilkaDev0/toolbox/branches/main
gh pr checks <PR-number> --repo RavilkaDev0/toolbox
git ls-remote origin refs/heads/main refs/heads/dev
```

Inspect authentication locally and redact any token fields from reports. The branch protection endpoints may return 404 because protection is provided by rulesets; the effective rules endpoints above establish enforcement. Do not print or commit credential/configuration contents. Audit settings on the current repository, never unrelated server projects.

Further policy changes, bypass permissions, mandatory approvals, deployments and merge automation require explicit owner agreement. TBX-002 authorized the settings in the table only. Re-audit after changes rather than treating this historical record as proof of current enforcement.
