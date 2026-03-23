# Look and Feel Audit - Mini-Apps
**Date:** 2026-03-23
**Auditor:** Claude
**Scope:** Bulls and Cows, Tic Tac Toe, Dice

---

## Audit Scope

**What Should Be OUTSIDE the Game Board:**
1. App Header (title, back button)
2. Player Info / Scores
3. Game Status Messages (turn, winner, etc.)
4. Action Buttons (Leave Game, New Game, Submit, etc.)
5. Toast Notifications (temporary feedback)
6. Game Settings / Options
7. Error Messages / Banners

**What IS the Game Board (excluded from audit):**
- The actual game play area (3x3 grid, dice display, code pegs)
- Board-specific interactions

---

## Critical Violations

### 1. Custom CSS Files (ALL APPS) ❌

**Policy:** Apps must NOT create component-specific CSS files.

| App | Violation File | Impact |
|-----|---------------|--------|
| **Dice** | `src/styles/dice-board.css` | Contains dice-specific styling |
| **Bulls and Cows** | `src/styles/bulls-and-cows-board.css` | Contains game-specific styling |
| **Tic Tac Toe** | `src/styles/tictactoe-board.css` | Contains game-specific styling |

**Why This Matters:**
- Each app has different button styles, spacing, colors
- No consistency across platform
- CSS enforcement hook is bypassed (these apps predate the hook)

---

### 2. Inline Styles (Tic Tac Toe) ❌

**Policy:** No inline styles allowed (use `.ah-*` classes).

**Tic Tac Toe violations:**
```tsx
// Line 60: Connection error
<div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>

// Line 61: Loading message
<div className={...} style={{ fontSize: '18px', padding: '20px' }}>

// Lines 139-156: Player scores header
<div style={{ marginBottom: '1.5rem' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
    <div className={...} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 600, padding: '8px 14px' }}>
      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{mySymbol}</span>
      <span style={{ fontSize: '14px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myName}</span>
      ...
    </div>
  </div>
</div>

// Line 168: Actions container
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '1.5rem' }}>

// Line 170: Status indicator
<div className={...} style={{ fontSize: '18px', fontWeight: 500, padding: '10px 20px' }}>
```

**Count:** 15+ inline style violations in TicTacToeGame.tsx

**Bulls and Cows:** ✅ No inline styles
**Dice:** ✅ No inline styles (one acceptable use in error handler)

---

## Inconsistencies by Element

### 1. App Header ✅ CONSISTENT

| App | Implementation | SDK Component | Issues |
|-----|---------------|---------------|--------|
| **Bulls and Cows** | `<AppHeader title="Bulls and Cows" icon="🐂" />` | ✅ Yes | None |
| **Tic Tac Toe** | `<AppHeader title="Tic-Tac-Toe" icon="⭕" />` | ✅ Yes | None |
| **Dice** | `<AppHeader title="Rrroll the Dice" icon="🎲" />` | ✅ Yes | None |

**Status:** ✅ All three use SDK AppHeader consistently

---

### 2. Player Info / Scores ❌ INCONSISTENT

#### Bulls and Cows
```tsx
{/* Game Info Bar */}
<div className="bc-game-info-bar">
  <div className="bc-game-info-content">
    <div className="ah-badge">
      {mode === 'colors' ? 'Colors' : 'Numbers'}
    </div>
    <div className="ah-badge">
      {guesses.length} / {maxGuesses} Guesses
    </div>
  </div>
</div>
```
- Uses custom `.bc-game-info-bar` class (in custom CSS)
- Uses SDK `.ah-badge` for info display
- No player names/scores (solo game)

#### Tic Tac Toe
```tsx
<div style={{ marginBottom: '1.5rem' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
    <div className={`ah-badge ${isMyTurn ? 'ah-badge--primary' : ''}`} style={{ ... lots of inline styles ... }}>
      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{mySymbol}</span>
      <span style={{ fontSize: '14px', ... }}>{myName}</span>
      <span style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '20px' }}>{myScore}</span>
    </div>
    <div style={{ fontSize: '14px', color: '#999', ... }}>
      <div>vs</div>
      <div style={{ fontSize: '11px', color: '#adb5bd' }}>R{game.currentRound} • First to {game.firstTo}</div>
    </div>
    <div className={`ah-badge ${!isMyTurn ? 'ah-badge--primary' : ''}`} style={{ ... }}>
      <span style={{ ... }}>{opponentScore}</span>
      <span style={{ ... }}>{opponentName}</span>
      <span style={{ ... }}>{opponentSymbol}</span>
    </div>
  </div>
</div>
```
- Heavy use of inline styles
- Uses SDK `.ah-badge` but overrides with inline styles
- Complex custom layout

#### Dice
- No player info/scores (utility app)

**Issues:**
- Bulls and Cows: Custom CSS classes
- Tic Tac Toe: Extensive inline styles, no reusable pattern
- No consistent pattern for displaying player info

---

### 3. Game Status Messages ❌ INCONSISTENT

#### Bulls and Cows
```tsx
{/* Game Over Banner */}
{isGameOver && (
  <div className={`ah-banner ${status === 'won' ? 'ah-banner--success' : 'ah-banner--error'} ah-mb`}>
    {status === 'won' ? (
      <>🎉 You cracked the code: <strong>{secretCode}</strong></>
    ) : (
      <>😔 The code was: <strong>{secretCode}</strong></>
    )}
  </div>
)}
```
- Uses SDK `.ah-banner` ✅
- Positioned above game board
- Clear success/error variants

#### Tic Tac Toe
```tsx
{/* Status message */}
<div className={`ah-status-indicator ${isMyTurn ? 'ah-status--success' : ''} ...`}
     style={{ fontSize: '18px', fontWeight: 500, padding: '10px 20px' }}>
  {getStatusMessage()}
</div>
```
- Uses SDK `.ah-status-indicator` but overrides with inline styles
- Positioned below game board
- Different visual treatment

#### Dice
- No game status (utility app)

**Issues:**
- Different positioning (above vs below board)
- Different SDK classes (banner vs status-indicator)
- Inline style overrides in Tic Tac Toe

---

### 4. Action Buttons ⚠️ MOSTLY CONSISTENT

#### Bulls and Cows
```tsx
<div className="bc-actions ah-mt">
  <button className="ah-btn-primary" onClick={handleSubmit} disabled={submitting || ...}>
    {submitting ? 'Submitting...' : 'Submit Guess'}
  </button>
  <button className="ah-btn-outline" onClick={handleClear}>
    Clear
  </button>
</div>
```
- Uses SDK button classes ✅
- Custom `.bc-actions` wrapper class (in custom CSS)

#### Tic Tac Toe
```tsx
{!gameEnded && connected && ready && (
  <button className="ah-btn-outline" onClick={() => setShowForfeitConfirm(true)}>
    Leave Game
  </button>
)}

{gameEnded && (
  <button className="ah-btn-primary" onClick={() => { window.location.href = '/lobby'; }}>
    Back to Lobby
  </button>
)}
```
- Uses SDK button classes ✅
- No custom wrapper
- Buttons positioned below board

#### Dice
```tsx
<button className="ah-btn-primary dice-roll-button" onClick={rollDice} disabled={isRolling}>
  {isRolling ? 'Rolling...' : '🎲 Roll!'}
</button>
```
- Uses SDK `.ah-btn-primary` ✅
- Custom `.dice-roll-button` class (in custom CSS)

**Issues:**
- All use SDK button classes ✅
- But add custom wrapper/modifier classes from component CSS
- Different positioning patterns

---

### 5. Toast Notifications ❌ MISSING

**Policy:** Temporary feedback messages should use toast system.

**Current State:**
- **Bulls and Cows:** Uses `.ah-banner` for errors (not temporary, stays on screen)
- **Tic Tac Toe:** Uses `.ah-banner` for errors (not temporary)
- **Dice:** No notifications

**Missing:**
- No toast notification system in SDK
- No temporary pop-up feedback
- Error messages are persistent banners, not dismissible toasts

**User Feedback:** "notifications used to be temporary pop up"

---

### 6. Layout Containers ⚠️ INCONSISTENT

#### Bulls and Cows
```tsx
<div className="ah-container ah-container--narrow ah-mt">
  <div className="ah-card ah-mb">
    {/* Content */}
  </div>
</div>
```
- Uses SDK `.ah-container--narrow` ✅
- Uses SDK `.ah-card` ✅
- Consistent SDK spacing utilities (`.ah-mt`, `.ah-mb`)

#### Tic Tac Toe
```tsx
<GameCard>
  {/* Content with inline styles */}
</GameCard>
```
- Uses SDK `<GameCard>` component ✅
- But relies heavily on inline styles inside

#### Dice
```tsx
<GameCard size="narrow">
  {/* Content */}
</GameCard>
```
- Uses SDK `<GameCard>` component ✅
- Clean implementation

**Issues:**
- Bulls and Cows uses raw divs with classes
- Tic Tac Toe and Dice use GameCard component
- Inconsistent pattern

---

### 7. Modal Dialogs ✅ CONSISTENT (where used)

#### Tic Tac Toe
```tsx
<div className="ah-modal-overlay" onClick={...}>
  <div className="ah-modal ah-modal--small" onClick={...}>
    <div className="ah-modal-header">
      <h3 className="ah-modal-title">Leave Game?</h3>
    </div>
    <div className="ah-modal-body">
      <p>If you leave, your opponent wins.</p>
    </div>
    <div className="ah-modal-footer">
      <button className="ah-btn-outline" onClick={...}>Stay</button>
      <button className="ah-btn-danger" onClick={...}>Leave</button>
    </div>
  </div>
</div>
```
- Uses SDK modal classes ✅
- Proper structure
- Only app with modal

**Bulls and Cows:** No modals
**Dice:** No modals

---

## Summary of Issues

### Critical Issues

1. **All three apps have custom CSS files** - Direct violation of CSS policy
2. **Tic Tac Toe has 15+ inline style violations** - Direct violation
3. **No toast notification system** - Missing required pattern

### Consistency Issues

4. **Player info display** - Completely different patterns
5. **Status message positioning** - Above board vs below board
6. **Status message styling** - Different SDK classes, inline overrides
7. **Layout patterns** - Mix of raw divs and SDK components

### Visual Inconsistencies (from PDF)

8. **Button colors vary** - Bulls uses cyan, others use blue
9. **Spacing differs** - Different padding, margins, gaps
10. **Typography inconsistent** - Different font sizes, weights

---

## Root Causes

### 1. Apps Predate CSS Enforcement
- All three apps were created before git hook existed
- Custom CSS files were allowed at that time
- No retroactive cleanup performed

### 2. No Toast System in SDK
- SDK doesn't provide toast/notification component
- Apps improvise with banners (persistent, not temporary)

### 3. Incomplete SDK Component Library
- GameCard exists, but not universally used
- No standardized player info component
- No standardized status message component

### 4. No Enforcement for Non-Board Elements
- Git hook checks for CSS files but doesn't enforce SDK components
- Developers free to use inline styles (hook only warns)
- No automated check for consistent patterns

---

## Recommendations

### Phase 1: Critical Fixes (Immediate)

1. **Remove all custom CSS files**
   - Move board-specific styles to Activity Hub CSS as `.ah-game-board-*` utilities
   - Delete `dice-board.css`, `bulls-and-cows-board.css`, `tictactoe-board.css`

2. **Remove all inline styles from Tic Tac Toe**
   - Replace with SDK classes
   - Create new SDK classes if needed

3. **Add Toast Notification System to SDK**
   - `useToast()` hook
   - `<Toast>` component
   - Auto-dismiss after 3-5 seconds

### Phase 2: Consistency (Next)

4. **Standardize Player Info Pattern**
   - Document pattern in MINIAPP_GUIDE.md
   - Provide reusable classes: `.ah-player-info`, `.ah-player-score`

5. **Standardize Status Messages**
   - Position: Always below the board
   - Use: Always `.ah-status-indicator` with variants
   - No inline style overrides

6. **Standardize Action Button Layout**
   - Position: Always below status
   - Use: SDK flex utilities (`.ah-flex-center`)
   - No custom wrapper classes

### Phase 3: Enforcement (Future)

7. **Enhance Git Hook**
   - Check for SDK component usage (AppHeader, GameCard mandatory)
   - Block inline styles (error, not warning)
   - Suggest SDK classes for common patterns

8. **Update MINIAPP_GUIDE.md**
   - Add mandatory patterns section
   - Show correct player info example
   - Show correct status message example
   - Show correct button layout example

9. **Create Refactoring Checklist**
   - Template for cleaning up existing apps
   - Automated tests for consistency

---

## Action Plan

### DO NOT UPDATE YET - AUDIT ONLY

**Next Steps:**
1. User reviews this audit
2. User approves approach
3. Prioritize fixes (Phase 1, then Phase 2)
4. Refactor one app at a time
5. Test thoroughly
6. Update remaining apps

---

## Appendix: File Locations

### Bulls and Cows
- Main component: `activity-hub-bullsandcows/frontend/src/components/GameBoard.tsx`
- Custom CSS: `activity-hub-bullsandcows/frontend/src/styles/bulls-and-cows-board.css` ❌

### Tic Tac Toe
- Main component: `activity-hub-tictactoe/frontend/src/components/TicTacToeGame.tsx`
- Custom CSS: `activity-hub-tictactoe/frontend/src/styles/tictactoe-board.css` ❌

### Dice
- Main component: `activity-hub-dice/frontend/src/components/DiceRoller.tsx`
- Custom CSS: `activity-hub-dice/frontend/src/styles/dice-board.css` ❌

---

**End of Audit**
