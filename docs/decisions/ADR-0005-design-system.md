# ADR-0005 — Server-rendered catalog and composed UI fixtures

- Status: Accepted for TBX-003
- Date: 2026-10-11

## Context

The design foundation must support a future large catalog without making the current 15 drafts look released. Pages should carry minimal client JavaScript and future converters need independently testable workspace regions.

## Decision

Choose Neutral Utility (neutral surfaces, indigo, local Geist) after comparing warm editorial and monochrome precision. Centralize tokens in the existing UI CSS. Adapt the necessary shadcn source compositions without adding a UI runtime.

Use a native GET form with a minimal client pending indicator and Server Components for search/category filtering; validate URL inputs in contracts and filter published metadata with a pure core function. Keep metadata and tool-specific routing in web, reusable primitives in ui.

Build a small composed workspace, exercised through an opt-in development route. The production environment denies that route even when its fixture flag is enabled. Fixture states/downloads are explicitly labeled examples; no catalog metadata or engine is changed.

## Consequences

Search requires a navigation rather than instant client filtering, but works without JS, supports deep links/back behavior and avoids synchronization code. Query-driven catalog rendering is dynamic while home/categories remain prerendered. No production conversion is offered. Future engines must supply real validation, progress, cancellation, resource cleanup, results and binary-file tests before publication.

Sources, exact tokens, component ownership and acceptance evidence are documented in [the design system](../06-DESIGN-SYSTEM.md).
