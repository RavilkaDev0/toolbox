# TBX-016 — Password Generator

## State

Implement on the shared `feat/tbx-005-tool-suite` branch as local Conventional Commits. Keep the catalog entry `draft` until final suite verification; allow the development preview only with `TOOLBOX_UI_FIXTURES=1` outside production. Behavioral tests are written now and run only after TBX-018 under the workflow override.

## Acceptance criteria

- Generate 8–128 character passwords from selected uppercase, lowercase, digit and symbol pools; every selected class must appear at least once.
- Optionally remove ambiguous `O`, `0`, `I`, `l` and `1`; report the actual pool size and configured output search-space estimate for the active options.
- Use only browser `crypto.getRandomValues`; use rejection sampling both to remove modulo bias and to sample uniformly among strings satisfying required classes. Never use `Math.random` or insecure fallback.
- Support Generate, Regenerate, Show/Hide, Copy and Reset using keyboard-accessible controls with explicit `type="button"`.
- Keep passwords in client memory only. Do not put them in routes, storage, cookies, analytics, requests or logs. Copy only after the explicit user action; tell users reset cannot clear the OS clipboard.
- Reject impossible options and unavailable cryptographic randomness. Provide no passphrase mode without a reviewed cryptographic wordlist and algorithm.
- Keep the password tool draft and metadata/canonical route available through the existing published-only catalog and local draft preview mechanism.

## Test coverage to queue for the final suite phase

- Core: Web Crypto source, no `Math.random`, lengths, allowed pool, required classes, ambiguous characters, invalid settings/bounds and entropy calculation.
- Contract: bounds, impossible options and strict keys.
- Playwright Chromium/WebKit: actual generation, keyboard option and reset interactions, copy content, mobile viewport, no requests or storage writes, and no console/hydration errors.

## Bounds and security notes

Length is capped at 128 to keep the output and search-space calculation bounded; minimum is 8 for a useful password generator. Candidate code points are ASCII from explicit pools, so output length is the count of generated characters. Rejection sampling gives every allowed character equal probability, then rejects whole candidates missing a selected class; accepted strings are therefore uniform over the configured valid set. Rejected draws never fall back to weaker randomness.

Clipboard APIs may be unavailable or denied. In that case report a generic copy error and leave the generated result available locally. Reset clears this page’s state, not an OS clipboard that the user explicitly populated.
