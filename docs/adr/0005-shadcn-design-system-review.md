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

### 2. React 19 Ref Pattern Not Adopted

**Severity:** Medium
**Best Practice:** The project uses React 19, where `forwardRef` is deprecated. In the modern shadcn/UI pattern for React 19:
- Refs are passed as regular props (no `forwardRef` wrapper needed)
- Components use `React.ComponentProps<"element">` for typing
- Every primitive gets a `data-slot="component-name"` attribute for CSS targeting

**Current State:** Components use neither the old `forwardRef` pattern nor the new React 19 `ref`-as-prop + `data-slot` pattern. Refs cannot be attached to these components at all.

**Affected Files:**
- `frontend/src/components/ui/input.tsx` — no ref support, no `data-slot`
- `frontend/src/components/ui/label.tsx` — no ref support, no `data-slot`
- `frontend/src/components/ui/card.tsx` — 5 sub-components, no ref support, no `data-slot`
- `frontend/src/components/ui/table.tsx` — 6 sub-components, no ref support, no `data-slot`
- `frontend/src/components/ui/separator.tsx` — no ref support, no `data-slot`
- `frontend/src/components/ui/skeleton.tsx` — no ref support, no `data-slot`

**Note:** Button correctly uses `Slot` for `asChild`, and Radix wrappers handle refs internally.

---

### 3. Missing `displayName` on All Components

**Severity:** Low
**Best Practice:** With React 19 + named function exports, `displayName` is less critical (React DevTools infers names from named exports). However, components that are assigned to variables or wrapped should still set it.

**Affected:** All 14 UI component files (30+ exported functions total). Most use named function exports which partially mitigates this.

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

### 9. Individual Radix Packages Instead of Unified `radix-ui`

**Severity:** Low
**Best Practice:** As of June 2025, shadcn/UI migrated to a unified `radix-ui` package, replacing all individual `@radix-ui/react-*` imports with named imports from `radix-ui`.

**Current State:** The project uses 6 individual packages:
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-slot`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

**Impact:** More dependencies to manage. Migration is straightforward but low priority.

---

### 10. No `tailwindcss-animate` / `tw-animate-css` Package

**Severity:** Low
**Best Practice:** shadcn/UI components use animation utilities (animate-in, fade-in, slide-in, etc.) provided by `tailwindcss-animate` (v3) or `tw-animate-css` (v4).

**Current State:** Animation classes are used in components (AlertDialog, Sheet, Select, Tooltip) but no animation package is in `package.json`. This may work if Tailwind v4 includes these natively or if they're defined in `globals.css` — needs verification.

---

## What's Done Well

### Excellent Patterns
1. **`cn()` utility** — Standard `clsx` + `twMerge` pattern, used consistently everywhere
2. **CVA variant system** — Button, Badge, Alert all use class-variance-authority correctly
3. **Radix UI composition** — Portal + Overlay + Content pattern applied correctly in AlertDialog, Sheet, Select, Tooltip
4. **Dark mode** — Full `.dark` class-based theming with proper OKLCH variable overrides; no manual `dark:` overrides — fully token-driven
5. **Design token usage** — Consistent use of `bg-card`, `text-muted-foreground`, `border-input` etc. across all pages; no raw Tailwind colors (`bg-blue-500`)
6. **Responsive design** — Excellent mobile-first approach (Card view on mobile, Table on desktop in Runs page; Sheet drawer for mobile nav)
7. **Loading states** — Proper Skeleton usage across all pages
8. **Accessibility fundamentals** — `aria-label` on buttons, `aria-live="polite"` on flash messages, `role="alert"` on alerts, proper `htmlFor`/`id` associations
9. **Theme provider** — Clean React Context implementation with system preference detection and localStorage persistence
10. **Security** — Password inputs, autocomplete="off" on sensitive fields, no rehype-raw in markdown
11. **Three-tier component organization** — `ui/` primitives, custom composites (`stat-card`, `status-badge`), and page-level usage — matches recommended architecture
12. **OKLCH color system** — Already using the modern color space that shadcn migrated to in Tailwind v4

### Rating Summary

| Aspect | Grade | Notes |
|--------|-------|-------|
| Component correctness | A | ~95% correct usage |
| Dark mode | A+ | Fully consistent, token-driven |
| Accessibility | B+ | Good foundation, minor gaps |
| Design system adherence | B | Some raw HTML bypasses components |
| Responsive design | A | Excellent mobile-first approach |
| Code organization | A | Clean three-tier separation |
| Styling consistency | A- | Consistent tokens, minor template string issues |
| Type safety | B+ | Good but inconsistent type exports |
| React 19 modernization | C+ | Not using new ref/data-slot patterns |

## Recommended Actions (Priority Order)

1. **Replace raw HTML with design system components** (the 7 instances in item #4)
2. **Adopt React 19 component pattern** — replace missing ref support with `ref`-as-prop + `data-slot` attributes
3. **Add `components.json`** for shadcn CLI support
4. **Install missing components**: Accordion, Progress from shadcn
5. **Migrate to unified `radix-ui` package** (when convenient)
6. **Standardize type exports** across all CVA components
7. **Verify animation utilities** — ensure `tw-animate-css` or equivalent is installed
8. **Fix accessibility gaps** (aria-valuemin, focus-visible on raw buttons)
