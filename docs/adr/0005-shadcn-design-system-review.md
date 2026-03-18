# ADR-0005: shadcn/UI Design System Review

**Date:** 2026-03-18
**Status:** Review

## Context

A comprehensive audit of the shadcn/UI design system implementation in the frontend, comparing against official best practices and identifying discrepancies.

## Inventory

- **14 shadcn/UI components** in `frontend/src/components/ui/`
- **7 custom composite components** using shadcn primitives
- **Tailwind CSS v4** with OKLCH color system
- **6 Radix UI primitives** as foundations
- **No `components.json`** — hand-curated setup (no shadcn CLI)

---

## Discrepancies Found

### 1. Missing `components.json` Configuration

**Severity:** Low
**Best Practice:** shadcn/UI projects should have a `components.json` at the project root to define aliases, styling preferences, and component paths. This enables the CLI for adding/updating components.

**Current State:** No `components.json` exists. Components were manually copied/adapted.

**Impact:** Cannot use `npx shadcn@latest add <component>` to update or add components. Manual maintenance required.

---

### 2. No `forwardRef` on HTML Wrapper Components

**Severity:** Medium
**Best Practice:** shadcn/UI components wrapping native HTML elements (Input, Label, Card, Table elements) should use `React.forwardRef` to allow parent components to attach refs.

**Affected Files:**
- `frontend/src/components/ui/input.tsx` — no ref forwarding
- `frontend/src/components/ui/label.tsx` — no ref forwarding
- `frontend/src/components/ui/card.tsx` — 5 sub-components without ref forwarding
- `frontend/src/components/ui/table.tsx` — 6 sub-components without ref forwarding
- `frontend/src/components/ui/separator.tsx` — no ref forwarding
- `frontend/src/components/ui/skeleton.tsx` — no ref forwarding

**Note:** Button correctly uses `Slot` for `asChild`, and Radix wrappers handle refs internally. The issue is only with direct HTML element wrappers.

---

### 3. Missing `displayName` on All Components

**Severity:** Low
**Best Practice:** Components should set `Component.displayName = "Component"` for React DevTools debugging.

**Affected:** All 14 UI component files (30+ exported functions total).

---

### 4. Raw HTML Elements Instead of Design System Components

**Severity:** High — Design System Consistency
**Best Practice:** All interactive and styled elements should use design system components to ensure consistent appearance, accessibility, and dark mode support.

**Discrepancies found:**

| Location | Issue | Recommendation |
|----------|-------|----------------|
| `pages/dashboard.tsx:120` | Raw `<a href="/settings">` | Use `<Link>` from React Router or `<Button variant="link" asChild>` |
| `pages/runs.tsx:33-35` | Raw `<details>/<summary>` | Use Accordion or Collapsible component from shadcn |
| `pages/summaries.tsx:280` | Raw `<button>` inside Sheet trigger | Use `<Button variant="ghost">` |
| `components/tweet-list-panel.tsx:59` | Raw `<div>` styled as card | Use `<Card>` component |
| `components/settings/cookies-card.tsx:77,97` | Raw `<code>` elements | Create a `Code` component or use consistent inline code styling |
| `components/settings/discord-card.tsx:88` | Raw `<code>` element | Same as above |
| `pages/setup.tsx:83` | Raw `<pre>` for code block | Create a `CodeBlock` component |

---

### 5. Accessibility Gaps

**Severity:** Medium

| Location | Issue | Fix |
|----------|-------|-----|
| `pages/setup.tsx:39` | Custom progress bar missing `aria-valuemin` | Add `aria-valuemin={0}` |
| `pages/summaries.tsx:280` | Raw `<button>` missing focus-visible styles | Replace with `<Button>` component |
| Several icon-only buttons | Missing or inconsistent `aria-label` | Audit all icon-only buttons |

---

### 6. Color System: OKLCH (Good) but Missing Documentation

**Severity:** Low
**Current State:** The project uses OKLCH color space in `globals.css`, which is modern and correct. However:
- The color preset annotation (`--color-scheme: radix-lyra, neutral`) is present but informal
- No documentation of the semantic color tokens (success, warning, destructive)
- Custom tokens like `--success`, `--warning` extend beyond default shadcn palette

**Best Practice:** Document custom color token extensions clearly.

---

### 7. Inconsistent Component Patterns

**Severity:** Medium

**Alert component** exports `alertVariants` but **Button component** exports `buttonVariants` — this naming is actually consistent. However:

- `Badge` exports both `badgeVariants` and the `BadgeVariant` type
- `Alert` exports `alertVariants` but no prop type
- `Button` exports `buttonVariants` but no prop type

**Recommendation:** Standardize: either export prop types from all CVA components or none.

---

### 8. Missing shadcn Components That Are Used Implicitly

**Severity:** Medium

Components that would improve consistency but are not installed:

| Missing Component | Where Needed |
|-------------------|--------------|
| **Accordion/Collapsible** | `pages/runs.tsx` — raw `<details>` used for expandable content |
| **Progress** | `pages/setup.tsx` — custom div-based progress bar |
| **Sonner/Toast** (partially) | Installed via `sonner` but not through shadcn wrapper |
| **Code/CodeBlock** | Settings pages, Setup page — raw `<code>/<pre>` elements |

---

## What's Done Well

### Excellent Patterns
1. **`cn()` utility** — Standard `clsx` + `twMerge` pattern, used consistently everywhere
2. **CVA variant system** — Button, Badge, Alert all use class-variance-authority correctly
3. **Radix UI composition** — Portal + Overlay + Content pattern applied correctly in AlertDialog, Sheet, Select, Tooltip
4. **Dark mode** — Full `.dark` class-based theming with proper OKLCH variable overrides
5. **Design token usage** — Consistent use of `bg-card`, `text-muted-foreground`, `border-input` etc. across all pages
6. **Responsive design** — Excellent mobile-first approach (Card view on mobile, Table on desktop in Runs page; Sheet drawer for mobile nav)
7. **Loading states** — Proper Skeleton usage across all pages
8. **Accessibility fundamentals** — `aria-label` on buttons, `aria-live="polite"` on flash messages, `role="alert"` on alerts, proper `htmlFor`/`id` associations
9. **Theme provider** — Clean React Context implementation with system preference detection and localStorage persistence
10. **Security** — Password inputs, autocomplete="off" on sensitive fields, no rehype-raw in markdown

### Rating Summary

| Aspect | Grade | Notes |
|--------|-------|-------|
| Component correctness | A | ~95% correct usage |
| Dark mode | A+ | Fully consistent |
| Accessibility | B+ | Good foundation, minor gaps |
| Design system adherence | B | Some raw HTML bypasses components |
| Responsive design | A | Excellent mobile-first approach |
| Code organization | A | Clean separation of concerns |
| Styling consistency | A- | Consistent tokens, minor template string issues |
| Type safety | B+ | Good but inconsistent type exports |

## Recommended Actions (Priority Order)

1. **Add `components.json`** for shadcn CLI support
2. **Replace raw HTML with design system components** (the 7 instances listed above)
3. **Add `forwardRef`** to HTML wrapper components (Input, Label, Card, Table, etc.)
4. **Install missing components**: Accordion, Progress from shadcn
5. **Standardize type exports** across all CVA components
6. **Add `displayName`** to all components (optional but helpful)
7. **Fix accessibility gaps** (aria-valuemin, focus-visible on raw buttons)
