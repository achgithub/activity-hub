# Activity Hub - Claude Code Configuration

**Project:** Activity Hub Platform
**Status:** Phase 2 (Flattened + SDK Extraction)
**Last Updated:** 2026-03-26

---

## ⚠️ CRITICAL: CSS ENFORCEMENT POLICY

**READ THIS FIRST.** This project enforces a SINGLE shared CSS file to maintain consistency across the entire platform and all mini-apps.

### The Rule: ONE CSS TO RULE THEM ALL

```
✅ DO:                            ❌ DON'T:
import './styles/activity-hub.css'  import './component.css'
className="ah-btn-primary"          style={{ background: 'blue' }}
<div className="ah-card">           <div style={{ padding: '10px' }}>
frontend/docs/CSS_GUIDE.md          /* custom CSS files */
```

---

## CSS Usage Rules (Enforced by Git Hook)

### ❌ FORBIDDEN (Blocks Commits)

1. **Component-specific CSS files**
   ```
   ❌ frontend/src/components/MyGame.css      ← NOT ALLOWED
   ❌ frontend/src/pages/Settings.css         ← NOT ALLOWED
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
import './styles/activity-hub.css';
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
- **frontend/docs/CSS_GUIDE.md** - Complete class reference with examples
- **frontend/docs/CSS_AUDIT.md** - Design decisions and patterns
- **frontend/src/styles/activity-hub.css** - Source code with comments

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

**See frontend/docs/CSS_GUIDE.md for 180+ complete class reference**

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

2. **ALWAYS check frontend/docs/CSS_GUIDE.md**
   - Before creating UI, review available classes
   - Use semantic class names
   - Combine classes for complex layouts

3. **ALWAYS import CSS only in frontend/src/index.tsx**
   - Import: `import './styles/activity-hub.css'`
   - Never import CSS in component files
   - Never create new CSS files

4. **NEVER deviate from this**
   - Git hook will catch violations
   - Don't waste tokens trying workarounds
   - Ask user if requirements conflict with CSS policy

5. **TypeScript only**
   - No .js/.jsx files in frontend/src
   - All React components must be .tsx

---

## Role-Based Access Control (RBAC)

All mini-apps use Activity Hub SDK for authentication and role-based access.

### Key Concepts
- **Role Naming**: Format is `appid:rolename` (e.g., `lms-manager:setup`, `tictactoe:player`)
- **SDK Integration**: Use `useActivityHubContext()` hook to access user roles
- **Tab Hierarchy**: Left tabs = more privileges (setup > games > reports)
- **Default Roles**: All users get a default role (e.g., `lms-manager:reports`)

### Reference
- **DATABASE_SUMMARY.md** - Role definitions and database schema for all mini-apps
- **docs/AUTHENTICATION.md** - Auth patterns and SDK usage
- **sdk/README.md** - `useActivityHubContext()` hook documentation

---

## Project Structure

```
activity-hub/
├── frontend/                        Main React app
│   ├── src/
│   │   ├── index.tsx               ← Imports activity-hub.css
│   │   ├── App.tsx                 ← Main shell
│   │   ├── components/
│   │   │   ├── awareness/          ← Presence/awareness UI
│   │   │   └── settings/           ← Admin settings
│   │   ├── hooks/
│   │   │   ├── useApps.ts          ← App launcher logic
│   │   │   └── useAwareness.ts     ← Presence hook
│   │   ├── styles/
│   │   │   └── activity-hub.css    ← SINGLE shared CSS file
│   │   └── types/
│   ├── docs/
│   │   ├── CSS_GUIDE.md            ← 180+ class reference
│   │   └── CSS_AUDIT.md            ← Design decisions
│   └── package.json
├── sdk/                             Publishable npm package
│   ├── src/
│   │   ├── useActivityHubContext.ts ← Auth & roles hook
│   │   ├── useAwareness.ts
│   │   ├── types/
│   │   └── index.ts
│   ├── package.json                ← Published to npm
│   └── README.md
├── backend/                         Go API server
│   ├── main.go
│   └── roles_handlers.go            ← Role & group CRUD
├── database/                        PostgreSQL schema
│   └── init.sql
├── docs/
│   ├── ARCHITECTURE.md              ← System design patterns
│   ├── MINI_APP_INTEGRATION.md     ← How to build apps
│   ├── MINIAPP_GUIDE.md            ← Standards & tech stack
│   ├── AUTHENTICATION.md            ← Auth patterns
│   ├── TESTING_AND_DEPLOYMENT.md   ← Deployment procedures
│   └── APP_LAUNCHER.md             ← Unix socket launching
├── .githooks/
│   └── pre-commit                  ← CSS enforcement
├── scripts/
│   └── setup-git-hooks.sh
├── ROLE_SETUP_GUIDE.md             ← Role definitions
├── DATABASE_SUMMARY.md             ← Schema documentation
├── ARCHITECTURE.md                 ← Design reference
└── CLAUDE.md                        ← This file
```

---

## Key Files to Reference

### CSS & Styling
1. **frontend/docs/CSS_GUIDE.md** - 180+ class reference with examples
2. **frontend/docs/CSS_AUDIT.md** - Design decisions and color palette
3. **frontend/src/styles/activity-hub.css** - Source CSS with inline comments

### Architecture & Integration
4. **ARCHITECTURE.md** - System design patterns (SSO, SDK, awareness)
5. **ROLE_SETUP_GUIDE.md** - Role definitions for all 4 mini-apps
6. **DATABASE_SUMMARY.md** - PostgreSQL schema and deployment
7. **docs/MINI_APP_INTEGRATION.md** - How to build and deploy mini-apps

### Development
8. **docs/MINIAPP_GUIDE.md** - Technology stack and standards
9. **docs/AUTHENTICATION.md** - Auth patterns and token handling
10. **docs/TESTING_AND_DEPLOYMENT.md** - Build and test procedures

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

### CSS & Styling
- **frontend/docs/CSS_GUIDE.md** - 180+ class reference with examples
- **frontend/docs/CSS_AUDIT.md** - Design decisions and patterns
- Check existing components in `frontend/src/components/`

### Roles & Authentication
- **ROLE_SETUP_GUIDE.md** - Role definitions for all apps
- **docs/AUTHENTICATION.md** - Auth patterns and SDK usage
- **docs/MINI_APP_INTEGRATION.md** - How to integrate SDK in new apps

### Architecture & Deployment
- **ARCHITECTURE.md** - System design (SSO, awareness, SDK)
- **DATABASE_SUMMARY.md** - PostgreSQL schema
- **docs/TESTING_AND_DEPLOYMENT.md** - Build and test procedures

### Git Hook Issues
- Run `./scripts/setup-git-hooks.sh` to reinstall
- Check `.githooks/pre-commit` for logic
- Bypass with `git commit --no-verify` (not recommended)

---

## Success Criteria

✅ Only .ts/.tsx files in frontend/src
✅ No component CSS files anywhere
✅ No inline styles in components
✅ No CSS imports except in index.tsx
✅ All styling via `.ah-*` classes
✅ index.tsx imports `./styles/activity-hub.css`
✅ Git hook passes on every commit

---

**Status:** Active enforcement via pre-commit hook
**Last Verified:** 2026-03-26
**Maintainer:** Activity Hub Team
