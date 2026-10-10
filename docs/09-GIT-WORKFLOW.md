# 09 — Git Workflow & Repository Settings

## Branch roles and names

- `main`: production history. Integration happens through release PRs from `dev`; merging is separate from deployment and requires an explicit decision.
- `dev`: the primary integration branch and the recommended default branch after Foundation is integrated.
- Work branches start from current `dev`: `feat/<task>-<description>`, `fix/<task>-<description>`, `refactor/<description>`, `chore/<description>` or `docs/<description>`. Use lowercase words separated by hyphens, for example `feat/tbx-003-catalog-shell`.
- Commits use Conventional Commits. Keep each PR focused and name its task and behavior change.
- Normal flow: work branch → `dev` → `main`. Ordinary feature PRs must not target `main`.

## Feature development

Start with a clean working tree; commit or stash existing work before switching branches.

```sh
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/tbx-003-catalog-shell
```

If `dev` is not local yet, use `git switch --track origin/dev`. Read the engineering contract and affected docs, implement only the selected task, then run the quality gates. Push the work branch and open one Draft PR targeting `dev`. If the target advances, merge `origin/dev` into the work branch and rerun affected checks; do not rewrite published history or force-push.

## PR review

- State scope, module ownership, dependency decisions, verification results and remaining risks. Document architectural deviations in an ADR.
- Inspect the diff, privacy, accessibility, failure paths and resource bounds. Resolve review conversations and keep failing tests visible.
- Require a successful `Quality / validate` run on the current PR revision and intended base. The workflow job/check name is `validate`; select the GitHub Actions source when configuring protection.
- A solo developer performs and records self-review. External review is welcome, but zero approving reviews are required by the proposed protection policy; the author cannot provide their own GitHub approving review.
- Move Draft to Ready only when scope and mandatory checks are satisfied. Merge is a separate human decision; agents do not merge automatically.
- Use a merge commit for the existing Foundation PR to preserve its commits. Future short work PRs may use squash with a Conventional Commit message, or a merge commit when individual history matters.

## Release PR: dev → main

Open a release PR with head `dev` and base `main`. Describe included tasks, release risks, rollback plan and quality evidence. Run the same checks on the release PR and review its diff against production. Use **Create a merge commit** to retain integration ancestry; do not squash or rebase this long-lived branch. Do not delete `dev` after release.

After the release merge, synchronize `main` back into `dev` through a PR (head `main`, base `dev`, merge commit). This retains the release merge in integration history and keeps future release comparisons clean. Merge approval does not authorize a production deployment.

## Emergency production hotfix

Only a critical production incident permits `fix/<incident>-<description>` to start from current `main` and target `main` directly. Record the incident and why the normal integration path is unsuitable. Keep the patch narrow, run the mandatory gates and review rollback before the explicit merge decision. No automatic protection bypass or production action is authorized.

Immediately open a synchronization PR from `main` to `dev` and merge with a merge commit after checks. If conflict resolution is necessary, use a temporary `fix/<incident>-sync` branch from `dev`, merge `origin/main` into it, resolve and test, then PR it to `dev`. Do not leave the production fix absent from integration history.

## Rollback principles

Preserve history with `git revert` in a reviewed fix branch. For a merge commit, select and verify the correct mainline parent before reverting; explain how a later reintroduction will work. Run the same gates for the rollback. A production emergency rollback follows the hotfix path and is synchronized into `dev`; other corrections go through `dev` and a release PR. Never reset or force-push shared branches. Artifact rollback or deployment is a separately authorized operational action, outside this task.

## TBX-001.1 alignment and audit

PR #1 was initially opened from `codex/tbx-001-foundation` to `main`. During alignment, `dev` was created at the unchanged initial `main` commit `99f5cdbf4ebdbaead953ca52ce36ae3bbc94700c`, and the existing PR was retargeted to `dev`. The existing head branch name is a one-time legacy exception retained to preserve the PR and published history; future work uses the prefixes above. No duplicate PR, merge, force-push or deployment is part of alignment.

Repository settings observed on 2026-10-11 (local time):

| Setting | Observed value |
| --- | --- |
| Default branch | `main` |
| Repository rulesets / effective branch rules | None for `main` or `dev` |
| Classic branch protection | None for `main` or `dev` |
| Required status checks | None enforced |
| Allowed merge methods | Merge commit, squash and rebase |
| Auto-merge / automatic head deletion | Both disabled |

These global settings were inspected but not changed. Until protection is enabled, the workflow policy relies on contributor discipline; target branch filters do not enforce allowed source branches.

## Proposed settings for one developer — approval required

After Foundation merges into `dev`, change the default branch to `dev`. Protect both `dev` and `main` using one active branch ruleset:

- Require a PR before merging, with **0 required approvals**. Do not require code-owner approval or approval of the latest push by another person.
- Require the GitHub Actions `validate` status check and an up-to-date base, and require conversation resolution.
- Block force pushes and branch deletion. Keep linear-history requirements off so release and synchronization merge commits remain possible.
- Avoid required deployments, merge queues and mandatory signed commits until the corresponding workflows exist. Normal work follows PR checks; any explicitly configured emergency admin bypass must be recorded and reviewed.
- Allow merge commits and squash. Recommend disabling rebase merging to simplify published history. Keep automatic deletion and auto-merge disabled so long-lived branches and explicit merge decisions are retained.

Apply only after explicit owner agreement. GitHub UI steps:

1. Repository **Settings → General → Default branch**: change `main` to `dev` after Foundation integration.
2. **Settings → Rules → Rulesets → New ruleset → New branch ruleset**: name it `integration-and-production`, set enforcement to **Active**, and include branches by name `dev` and `main`.
3. Enable **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (approvals **0**, code-owner/last-push approval off), **Require conversation resolution**, and **Require status checks to pass**. Add `validate` from **GitHub Actions** and enable **Require branches to be up to date before merging**. Leave linear history, deployments and merge queue off. Review any bypass entries explicitly before saving.
4. **Settings → General → Pull Requests**: enable merge commits and squash, disable rebase merging, leave auto-merge and automatic head deletion off. On release PRs, select **Create a merge commit**.
5. Check both branch rule summaries and a new PR's merge box to verify that `validate` is required without waiting for another person's approval. Avoid overlapping classic protection and rulesets unless their combined requirements are intentional.

Reference documentation: [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [merge methods](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github), [workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) and [Playwright browser projects](https://playwright.dev/docs/test-projects).
