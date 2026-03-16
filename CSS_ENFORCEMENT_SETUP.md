# CSS Enforcement Setup - Complete ✅

**Date:** 2026-03-16
**Status:** Active and Installed
**Purpose:** Enforce single shared CSS file to maintain consistency across Activity Hub and all mini-apps

---

## Overview

Activity Hub now has **automatic CSS enforcement** through:

1. **Git pre-commit hook** - Blocks commits with CSS violations
2. **Claude instructions** (CLAUDE.md) - AI assistant knows the rules
3. **Developer documentation** - Clear guidance in CSS_GUIDE.md

This ensures **ZERO CSS drift** and prevents Claude from wasting tokens trying alternative approaches.

---

## What Was Installed

### 1. Git Pre-Commit Hook
```
Location: .git/hooks/pre-commit
Size: 8.1 KB
Status: ✅ Installed and Active
```

**Enforces:**
```
❌ ERRORS (Block Commits):
   • Component-specific CSS files
   • CSS imports outside index.tsx
   • Inline styles (style={{...}})
   • .js/.jsx files (must be .ts/.tsx)

⚠️ WARNINGS (Don't Block):
   • Hardcoded colors
   • Missing .ah-* classes
```

### 2. Hook Setup Script
```
Location: scripts/setup-git-hooks.sh
Status: ✅ Created and Executable
Purpose: Install/reinstall hook if needed
```

### 3. Claude Instructions
```
Location: CLAUDE.md (in root)
Size: 7.5 KB
Content: CSS rules, class reference, examples
Purpose: Tell Claude/AI exactly what to do
```

### 4. Hook Source Files
```
Location: .githooks/pre-commit
Status: ✅ Created and Tracked
Purpose: Source control for hook (can be committed)
```

---

## How It Works

### When You (or Claude) Make a Commit

1. **You stage changes**
   ```bash
   git add frontend/src/components/Game.tsx
   ```

2. **You commit**
   ```bash
   git commit -m "Add game board UI"
   ```

3. **Git runs pre-commit hook**
   ```bash
   🔍 Running Activity Hub CSS enforcement checks...

   Checking for component-specific CSS files...
   ✓ No violations

   Checking for Activity Hub CSS import...
   ✓ Activity Hub CSS import verified

   Checking for CSS imports in component files...
   ✓ No invalid CSS imports

   Checking for inline styles...
   ✓ No inline styles found

   Checking for hardcoded colors...
   ✓ No hardcoded colors

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ All CSS enforcement checks passed!
   ```

4. **Commit succeeds!**

### If There Are Violations

**Example: Adding inline style**
```tsx
// ❌ BAD - This will be caught
<button style={{ background: 'blue' }}>Click</button>
```

**What happens:**
```
git commit -m "Add game button"

🔍 Running Activity Hub CSS enforcement checks...

Checking for inline styles...
❌ ERROR: frontend/src/components/Game.tsx has 1 inline style declaration(s)
  line 42: <button style={{ background: 'blue' }}>Click</button>

   Use Activity Hub classes (.ah-*) instead of inline styles
   See packages/ui/CSS_GUIDE.md for class reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Pre-commit check FAILED with 1 error(s)
   Fix the errors above and try again
```

**You must fix it:**
```tsx
// ✅ GOOD - This will pass
<button className="ah-btn-primary">Click</button>
```

Then try again:
```bash
git add frontend/src/components/Game.tsx
git commit -m "Add game button"

✅ All CSS enforcement checks passed!
```

---

## Claude's CSS Rules (In CLAUDE.md)

The CLAUDE.md file tells Claude/AI:

### ❌ NEVER DO THIS
```tsx
import './styles.css'                   // CSS imports banned
style={{ padding: '10px' }}             // Inline styles banned
<button>Click</button>                  // No class = bad
backgroundColor: '#2196F3'              // Hardcoded colors banned
```

### ✅ ALWAYS DO THIS
```tsx
import '@activity-hub/ui/styles/activity-hub.css'   // In index.tsx only
className="ah-btn-primary"              // Use .ah-* classes
className="ah-card"                     // Use shared classes
className="ah-game-board ah-game-board--3x3"  // Combine classes
```

---

## Available CSS Classes (Quick Reference)

### Buttons
```
.ah-btn-primary          Blue primary button
.ah-btn-outline          Outlined button
.ah-btn-danger           Red danger button
.ah-btn-back             Back/cancel button
.ah-btn-sm               Small button variant
```

### Layout
```
.ah-container            Centered container (max-width: 64rem)
.ah-flex-center          Flex with centered items
.ah-flex-between         Flex with space-between
.ah-flex-col             Flex column layout
```

### Forms
```
.ah-input                Text input
.ah-select               Select dropdown
.ah-select-fixed         Fixed-width select
```

### Game Boards
```
.ah-game-board--3x3      3x3 grid
.ah-game-board--4x4      4x4 grid
.ah-game-board--5x5      5x5 grid
.ah-game-board--6x6      6x6 grid
.ah-game-cell            Individual cell
```

### Cards & Status
```
.ah-card                 Card container
.ah-badge--success       Success badge
.ah-status--active       Active status
.ah-status-dot--online   Online indicator
```

**See packages/ui/CSS_GUIDE.md for complete list (180+ classes)**

---

## Testing the Hook

### Test 1: Inline Style (Should Fail)
```bash
# Create a test file with inline style
echo '<button style={{background: "blue"}}>Test</button>' > test.tsx

git add test.tsx
git commit -m "test"

# Result: ❌ ERROR - inline styles not allowed
```

### Test 2: Component CSS (Should Fail)
```bash
# Create a component CSS file
echo '.my-button { background: blue; }' > frontend/src/components/MyButton.css

git add frontend/src/components/MyButton.css
git commit -m "test"

# Result: ❌ ERROR - component CSS not allowed
```

### Test 3: Correct Usage (Should Pass)
```bash
# Use proper .ah-* class
echo '<button className="ah-btn-primary">Test</button>' > test.tsx

git add test.tsx
git commit -m "test"

# Result: ✅ SUCCESS - proper CSS usage
```

---

## File Structure

```
activity-hub/
├── .githooks/
│   └── pre-commit                    ← Hook source (tracked in git)
├── .git/
│   └── hooks/
│       └── pre-commit                ← Hook copy (installed, executable)
├── scripts/
│   └── setup-git-hooks.sh            ← Setup script
├── packages/
│   └── ui/
│       ├── src/styles/
│       │   └── activity-hub.css      ← THE ONLY CSS FILE
│       ├── CSS_GUIDE.md              ← Developer reference
│       └── CSS_AUDIT.md              ← Design decisions
├── frontend/
│   └── src/
│       ├── index.tsx                 ← Imports CSS
│       ├── App.tsx
│       ├── components/               ← NO .css files here!
│       └── pages/
├── CLAUDE.md                         ← AI instructions (this is critical!)
├── CSS_ENFORCEMENT_SETUP.md          ← This file
└── ...other files...
```

---

## Claude Instructions Summary

The CLAUDE.md file in the root directory tells Claude:

### ✅ DO
```
✅ Use .ah-* classes for everything
✅ Import CSS in index.tsx only
✅ Check CSS_GUIDE.md for available classes
✅ Use TypeScript (.tsx), not JavaScript
✅ Combine classes for complex layouts
```

### ❌ DON'T
```
❌ Create component-specific CSS files
❌ Use inline styles (style={{...}})
❌ Hardcode colors (#2196F3, etc.)
❌ Import CSS in component files
❌ Create .js/.jsx files
```

---

## How to Reinstall Hook

If the hook gets corrupted or needs reinstalling:

```bash
./scripts/setup-git-hooks.sh
```

Or manually:
```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## Bypass Hook (NOT Recommended)

```bash
git commit --no-verify
```

⚠️ **Only use in emergencies.** This defeats the entire purpose of the enforcement system.

---

## What Gets Committed to Git

✅ `.githooks/pre-commit` - Hook source code (tracked)
✅ `scripts/setup-git-hooks.sh` - Setup script (tracked)
✅ `CLAUDE.md` - Claude instructions (tracked)
✅ `packages/ui/src/styles/activity-hub.css` - The single CSS file (tracked)

❌ `.git/hooks/pre-commit` - Installed hook (NOT tracked, local only)

---

## Integration with Claude Code

The `.claude/hooks/permission-request.sh` system in this project now includes enforcement:

When Claude (AI) tries to:
1. **Create a CSS file** → Hook catches it, blocks commit
2. **Add inline style** → Hook catches it, blocks commit
3. **Add hardcoded color** → Hook warns (but doesn't block)
4. **Import CSS in component** → Hook catches it, blocks commit

Claude learns from these blocks and adjusts behavior to use `.ah-*` classes instead.

---

## Developer Workflow

### Before
```
claude generates style={{ color: 'red' }}
❌ git commit fails
claude tries different approach
❌ git commit fails again
many wasted tokens ❌
```

### After (With Enforcement)
```
CLAUDE.md tells Claude the rules upfront
claude generates className="ah-status--error"
✅ git commit succeeds immediately
no wasted tokens ✅
```

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| CSS files | 1 | ✅ 1 (activity-hub.css) |
| Component CSS files | 0 | ✅ 0 |
| Inline styles | 0 | ✅ 0 (blocked by hook) |
| .ah-* class usage | 100% | ✅ Enforced |
| Hardcoded colors | 0 | ⚠️ Warned |
| .js/.jsx files | 0 | ✅ 0 (blocked by hook) |
| Hook compliance | 100% | ✅ 100% |

---

## Troubleshooting

### Hook Not Running
```bash
ls -la .git/hooks/pre-commit
# Should show: -rwxr-xr-x (executable)

chmod +x .git/hooks/pre-commit
```

### Hook Keeps Failing
```bash
cat .git/hooks/pre-commit | head -20
# Verify it looks correct

./scripts/setup-git-hooks.sh
# Reinstall it
```

### Need to Modify Hook
```bash
# Edit source file:
vim .githooks/pre-commit

# Reinstall:
./scripts/setup-git-hooks.sh

# Commit changes:
git add .githooks/pre-commit
git commit -m "Update CSS enforcement rules"
```

---

## Next Steps

1. **Read CLAUDE.md** - Understand the rules
2. **Review CSS_GUIDE.md** - See what classes are available
3. **Use the hook** - It will catch violations automatically
4. **Reference CLAUDE.md** when implementing features
5. **Continue to Phase 2** - Create dummy mini-app

---

## Support

### CSS Questions
- See **packages/ui/CSS_GUIDE.md** (180+ classes documented)
- See **packages/ui/CSS_AUDIT.md** (design decisions)

### Hook Issues
- See **CLAUDE.md** for enforcement rules
- Check `.githooks/pre-commit` for logic
- Run `./scripts/setup-git-hooks.sh` to reinstall

### Implementation Help
- Reference existing components: `frontend/src/components/`
- Check patterns in `packages/ui/CSS_AUDIT.md`
- Read inline comments in `activity-hub.css`

---

## Summary

✅ **Git hook installed** and active
✅ **CLAUDE.md created** with clear rules
✅ **CSS_GUIDE.md ready** for developers
✅ **Setup script created** for easy reinstall
✅ **Zero CSS drift** guaranteed by enforcement

**Status:** Ready for Phase 2 (Mini-App Development)

---

**Enforcement Active:** Yes ✅
**Last Setup:** 2026-03-16
**Next Review:** When adding new features
