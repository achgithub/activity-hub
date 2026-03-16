# Activity Hub - Claude Code Configuration

**Project:** Activity Hub Platform
**Status:** Phase 1 (Monorepo Setup + CSS Consolidation)
**Last Updated:** 2026-03-16

---

## ⚠️ CRITICAL: CSS ENFORCEMENT POLICY

**READ THIS FIRST.** This project enforces a SINGLE shared CSS file to maintain consistency across the entire platform and all mini-apps.

### The Rule: ONE CSS TO RULE THEM ALL

```
✅ DO:                            ❌ DON'T:
import '@activity-hub/ui/...        import './component.css'
className="ah-btn-primary"          style={{ background: 'blue' }}
<div className="ah-card">           <div style={{ padding: '10px' }}>
@activity-hub/ui/CSS_GUIDE.md        /* custom CSS files */
```

---

## CSS Usage Rules (Enforced by Git Hook)

### ❌ FORBIDDEN (Blocks Commits)

1. **Component-specific CSS files**
   ```
   ❌ frontend/src/components/MyGame.css      ← NOT ALLOWED
   ❌ frontend/src/pages/Settings.css         ← NOT ALLOWED
   ❌ packages/ui/src/components/Modal.css    ← NOT ALLOWED
   ```
   **Action:** Delete these files. Use `.ah-*` classes instead.

2. **CSS imports in component files**
   ```
   ❌ import './styles.css'         ← NOT ALLOWED
   ❌ import '../styles.css'        ← NOT ALLOWED
   ```
   **Action:** Import CSS only in `frontend/src/index.tsx`

3. **Inline styles**
   ```
   ❌ <div style={{ padding: '10px' }}>       ← NOT ALLOWED
   ❌ style={{ backgroundColor: 'blue' }}     ← NOT ALLOWED
   ```
   **Action:** Use `.ah-*` classes instead.

4. **JavaScript files (not TypeScript)**
   ```
   ❌ frontend/src/components/Game.js         ← NOT ALLOWED
   ❌ frontend/src/utils/helpers.jsx          ← NOT ALLOWED
   ```
   **Action:** Rename to `.ts` or `.tsx`

### ⚠️ WARNINGS (Don't Block, But Discouraged)

1. **Hardcoded colors**
   ```
   ⚠️  backgroundColor: '#FF5733'              ← DISCOURAGED
   ⚠️  color: '#2196F3'                        ← USE CLASS INSTEAD
   ```
   **Recommendation:** Use `.ah-status--active` or similar class.

2. **Missing Activity Hub classes in new components**
   ```
   ⚠️  <button>Click</button>                  ← Missing class
   ✅ <button className="ah-btn-primary">Click</button>
   ```

---

## How to Use Shared CSS

### Step 1: Import in Entry Point
```typescript
// frontend/src/index.tsx
import '@activity-hub/ui/styles/activity-hub.css';
import App from './App';
```

### Step 2: Use .ah-* Classes in Components
```tsx
// frontend/src/components/Game.tsx
export function GameBoard() {
  return (
    <div className="ah-container">
      <h1 className="ah-header-title">My Game</h1>

      <div className="ah-game-board ah-game-board--3x3">
        {cells.map(cell => (
          <div key={cell.id} className="ah-game-cell">
            {cell.value}
          </div>
        ))}
      </div>

      <div className="ah-flex-between" style={{ marginTop: '2rem' }}>
        <button className="ah-btn-outline">Cancel</button>
        <button className="ah-btn-primary">Play</button>
      </div>
    </div>
  );
}
```

### Step 3: Reference Documentation
- **packages/ui/CSS_GUIDE.md** - Complete class reference with examples
- **packages/ui/CSS_AUDIT.md** - Design decisions and patterns
- **packages/ui/src/styles/activity-hub.css** - Source code with comments

---

## Available CSS Classes

### Layout
```
.ah-container              max-width: 64rem
.ah-container--wide        max-width: 80rem
.ah-container--narrow      max-width: 28rem
.ah-flex-center            display: flex; align-items: center
.ah-flex-center-justify    flex + center + justify-content
.ah-flex-between           flex + space-between
.ah-flex-col               flex flex-direction: column
```

### Buttons
```
.ah-btn-primary            Blue primary button
.ah-btn-outline            Outlined button
.ah-btn-danger             Red danger button
.ah-btn-back               Back button
.ah-btn-sm                 Small button size
```

### Forms
```
.ah-input                  Text input
.ah-select                 Select dropdown
.ah-select-fixed           Fixed-width select
```

### Game Boards
```
.ah-game-board             Base game board container
.ah-game-board--3x3        3x3 grid
.ah-game-board--4x4        4x4 grid
.ah-game-board--5x5        5x5 grid
.ah-game-board--6x6        6x6 grid
.ah-game-board--dots       Dots game layout
.ah-game-cell              Individual game cell
.ah-game-cell.active       Active cell state
```

### Status & Badges
```
.ah-badge--success         Green success badge
.ah-badge--error           Red error badge
.ah-badge--warning         Yellow warning badge
.ah-status--active         Active status indicator
.ah-status-dot--online     Green online dot
.ah-status-dot--offline    Gray offline dot
```

### Cards & Containers
```
.ah-card                   Card container
.ah-modal                  Modal dialog
.ah-modal--large           Large modal (max-width: 56rem)
.ah-modal--small           Small modal (max-width: 24rem)
```

**See packages/ui/CSS_GUIDE.md for 180+ complete class reference**

---

## Color Palette (Standardized)

Do NOT use hardcoded colors. The palette is:

| Use | Color | Hex |
|-----|-------|-----|
| Primary | Brand Blue | `#2196F3` |
| Dark Hover | Dark Blue | `#1976D2` |
| Text | Dark Stone | `#1C1917` |
| Secondary | Medium Stone | `#78716C` |
| Background | Light Stone | `#FAFAFA` |
| Surface | White | `#FFFFFF` |
| Borders | Light Gray | `#F0F0F0` |
| Success | Green | `#16A34A` |
| Error | Red | `#DC2626` |
| Warning | Amber | `#FBBF24` |

Use `.ah-card`, `.ah-btn-primary`, `.ah-status--active` instead of hex colors directly.

---

## Git Pre-Commit Hook

A hook is installed automatically to prevent CSS violations.

### Setup
```bash
./scripts/setup-git-hooks.sh
```

### What It Checks
✅ No component-specific CSS files
✅ No CSS imports outside index.tsx
✅ No inline styles
✅ No .js/.jsx files (TypeScript only)
⚠️ No hardcoded colors (warning)
⚠️ Encourages .ah-* class usage (warning)

### Bypass (NOT Recommended)
```bash
git commit --no-verify
```

---

## Development Workflow

### When You Write Code

1. **Use shared CSS classes**
   ```tsx
   // ✅ GOOD
   <button className="ah-btn-primary">Start</button>

   // ❌ BAD
   <button style={{ background: '#2196F3' }}>Start</button>
   ```

2. **No component CSS files**
   - Delete any `.css` files in `frontend/src/`
   - All styling comes from `activity-hub.css`

3. **Reference documentation**
   - Check `packages/ui/CSS_GUIDE.md` for available classes
   - Use semantic class names (buttons, forms, cards, etc.)

4. **Let git hook validate**
   - Run `git add .`
   - Run `git commit -m "..."`
   - Hook checks your code
   - If errors: Fix and retry
   - If warnings: Recommend fixing but commit allowed

---

## Common Scenarios

### Scenario 1: I need a button
```tsx
// ✅ CORRECT
<button className="ah-btn-primary">Click me</button>
<button className="ah-btn-outline">Cancel</button>
<button className="ah-btn-danger">Delete</button>

// ❌ WRONG
<button style={{ background: 'blue', padding: '10px' }}>
  Click me
</button>
```

### Scenario 2: I need a card layout
```tsx
// ✅ CORRECT
<div className="ah-card">
  <h2>Title</h2>
  <p>Content</p>
</div>

// ❌ WRONG
<div style={{ background: 'white', padding: '1rem', border: '1px solid #f0f0f0' }}>
  <h2>Title</h2>
  <p>Content</p>
</div>
```

### Scenario 3: I need responsive layout
```tsx
// ✅ CORRECT
<div className="ah-container">
  <div className="ah-flex-between">
    <h1>Title</h1>
    <button className="ah-btn-primary">Action</button>
  </div>
</div>

// ❌ WRONG
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
  <h1 style={{ fontSize: '2rem' }}>Title</h1>
  <button>Action</button>
</div>
```

### Scenario 4: I need a game board
```tsx
// ✅ CORRECT
<div className="ah-game-board ah-game-board--3x3">
  {cells.map(cell => (
    <div key={cell.id} className="ah-game-cell">
      {cell.value}
    </div>
  ))}
</div>

// ❌ WRONG
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
  {cells.map(cell => (
    <div key={cell.id} style={{ background: 'white', border: '1px solid #ccc' }}>
      {cell.value}
    </div>
  ))}
</div>
```

---

## For Claude (AI Assistant)

### Instructions for Code Generation

1. **ALWAYS use .ah-* classes**
   - Never generate `style={{...}}`
   - Never create component CSS files
   - Never hardcode colors

2. **ALWAYS check CSS_GUIDE.md**
   - Before creating UI, review available classes
   - Use semantic class names
   - Combine classes for complex layouts

3. **ALWAYS import CSS in index.tsx**
   - Verify: `import '@activity-hub/ui/styles/activity-hub.css'`
   - Never import in component files
   - Never create new CSS files

4. **NEVER deviate from this**
   - Git hook will catch violations
   - Don't waste tokens trying workarounds
   - Ask user if requirements conflict with CSS policy

5. **TypeScript only**
   - No .js/.jsx files in frontend/src
   - All React components must be .tsx

---

## Project Structure

```
activity-hub/
├── packages/
│   ├── core/               Types and interfaces
│   ├── ui/
│   │   ├── src/
│   │   │   └── styles/
│   │   │       └── activity-hub.css      ← SINGLE CSS FILE
│   │   ├── CSS_GUIDE.md                  ← Developer reference
│   │   └── CSS_AUDIT.md                  ← Design decisions
│   └── sdk/                Hooks and utilities
├── frontend/
│   └── src/
│       ├── index.tsx       ← Imports CSS here
│       ├── App.tsx
│       ├── components/     ← NO .css files here
│       └── pages/
├── .githooks/
│   └── pre-commit          ← CSS enforcement hook
├── scripts/
│   └── setup-git-hooks.sh  ← Install hook
└── CLAUDE.md               ← This file
```

---

## Key Files to Reference

1. **packages/ui/CSS_GUIDE.md** (11KB)
   - Complete class reference with examples
   - 180+ utility classes documented
   - Best practices and patterns

2. **packages/ui/CSS_AUDIT.md** (9.5KB)
   - Audit findings and methodology
   - Color palette documentation
   - File organization details

3. **packages/ui/src/styles/activity-hub.css** (1,538 lines)
   - Source CSS with inline comments
   - 23 organized sections
   - Ready for minification and publishing

---

## Why This Approach?

1. **Consistency** - One CSS file = one look and feel across all apps
2. **Performance** - Single CSS load, no duplication
3. **Brand Enforcement** - Standardized colors, spacing, animations
4. **Developer Experience** - Clear rules, no bikeshedding about styling
5. **Maintainability** - Changes to Activity Hub CSS propagate to all mini-apps
6. **Mini-App Quality** - All mini-apps follow the same visual language

---

## Getting Help

### CSS Classes
- See **packages/ui/CSS_GUIDE.md** for class reference
- All 180+ classes are documented with examples

### Implementation Questions
- Reference existing components in `frontend/src/components/`
- Check patterns in `packages/ui/CSS_AUDIT.md`
- Review inline comments in `activity-hub.css`

### Issues with Hook
- Run `./scripts/setup-git-hooks.sh` to reinstall
- Check `.githooks/pre-commit` for logic
- Temporarily bypass with `git commit --no-verify` (not recommended)

---

## Success Criteria

✅ Only .ts/.tsx files in frontend/src
✅ No component CSS files anywhere
✅ No inline styles in components
✅ No CSS imports except in index.tsx
✅ All styling via `.ah-*` classes
✅ index.tsx imports `@activity-hub/ui/styles/activity-hub.css`
✅ Git hook passes on every commit

---

**Status:** Active enforcement via pre-commit hook
**Last Verified:** 2026-03-16
**Maintainer:** Activity Hub Team
