# Priority 2: Custom CSS Files Audit
**Date:** 2026-03-23
**Scope:** Determine what to KEEP vs REMOVE from custom CSS files

---

## Summary

| File | Total Lines | KEEP (Board) | REMOVE (UI) | % Board |
|------|-------------|--------------|-------------|---------|
| **dice-board.css** | 142 | 95 lines | 47 lines | 67% |
| **bulls-and-cows-board.css** | 516 | 390 lines | 126 lines | 76% |
| **tictactoe-board.css** | 85 | 85 lines | 0 lines | 100% ✅ |

**Tic Tac Toe is perfect** - 100% board-specific, no UI elements.

---

## 1. dice-board.css (142 lines)

### ✅ KEEP (Board-specific - 95 lines)

**Dice Display (Lines 26-37, 40-47)**
```css
.dice-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  min-height: 150px;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.dice-container--1,
.dice-container--2,
/* ... --3 through --6 */
```
**Why Keep:** The white board background and responsive grid layout is part of the dice board design.

**Individual Dice (Lines 87-119)**
```css
.dice {
  width: 120px;
  height: 120px;
  background: white;
  border: 2px solid #f0f0f0;
  border-radius: 8px;
  /* ... */
}

.dice img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 8px;
}

.dice.rolling {
  animation: shake-rotate 0.2s infinite;
  filter: blur(1px);
}

.dice-fallback {
  font-size: 80px;
  line-height: 1;
}
```
**Why Keep:** The actual dice appearance, images, and rolling animation.

**Animations (Lines 57-84)**
```css
@keyframes shake-rotate { /* ... */ }
@keyframes settle { /* ... */ }
```
**Why Keep:** Rolling and settling animations are part of the dice board behavior.

**Responsive (Lines 122-141)**
```css
@media (max-width: 768px) {
  .dice {
    width: 100px;
    height: 100px;
  }
  /* ... */
}
```
**Why Keep:** Dice board responsiveness.

---

### ❌ REMOVE (UI elements - 47 lines)

**Container Layout (Lines 4-10)**
```css
.dice-roller-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}
```
**Replace with:** `.ah-container` or `.ah-flex-col-center`

**Controls Spacing (Lines 13-16)**
```css
.dice-controls {
  gap: 1rem;
  margin-bottom: 2rem;
}
```
**Replace with:** `.ah-flex-center` with `.ah-mb` utility

**Dice Count Display (Lines 18-23)**
```css
.dice-count {
  font-size: 1.125rem;
  font-weight: 500;
  min-width: 120px;
  text-align: center;
}
```
**Replace with:** SDK typography classes or `.ah-badge`

**Button Styling (Lines 50-55)**
```css
.dice-roll-button {
  margin-bottom: 2rem;
  min-width: 200px;
  padding: 1rem 3rem;
  font-size: 1.2rem;
}
```
**Replace with:** `.ah-btn-primary` already handles this, just add `.ah-mb` for margin

---

## 2. bulls-and-cows-board.css (516 lines)

### ✅ KEEP (Board-specific - 390 lines)

**Color Definitions (Lines 65-91)**
```css
.bc-color-red { background-color: #dc3545 !important; }
.bc-color-blue { background-color: #0d6efd !important; }
.bc-color-green { background-color: #198754 !important; }
.bc-color-yellow { background-color: #ffc107 !important; }
.bc-color-orange { background-color: #fd7e14 !important; }
.bc-color-purple { background-color: #6f42c1 !important; }
```
**Why Keep:** These ARE the game - the colored pegs.

**Game Pegs (Lines 115-165)**
```css
.bc-peg {
  width: 60px;
  height: 60px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  background-color: #fff;
  color: #212529;
}

.bc-peg.selected { /* ... */ }
.bc-peg-hidden { /* ... */ }
.bc-peg-compact { /* ... */ }
```
**Why Keep:** The actual game pieces.

**Selection Interface (Lines 197-226)**
```css
.bc-color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.bc-color-btn { /* ... */ }
.bc-number-grid { /* ... */ }
.bc-number-btn { /* ... */ }
```
**Why Keep:** Color/number selection is part of the game board interface.

**History Pegs (Lines 229-250)**
```css
.bc-history-pegs {
  display: flex;
  gap: 0.25rem;
}

.bc-history-peg {
  width: 32px;
  height: 32px;
  /* ... */
}
```
**Why Keep:** Small pegs showing guess history are part of the board display.

**Feedback Badges (Lines 253-273, 448-463)**
```css
.bc-bulls-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  background-color: #d4edda;
  color: #155724;
  font-weight: bold;
}

.bc-cows-badge { /* ... */ }
```
**Why Keep:** Bulls/Cows feedback is integral to the game display.

**Code Pegs (Lines 357-410)**
```css
.bc-code-peg { /* ... */ }
.bc-code-peg--selected { /* ... */ }
.bc-code-row { /* ... */ }
```
**Why Keep:** Secret code display is part of the board.

**Options Grid (Lines 412-445)**
```css
.bc-options-grid { /* ... */ }
.bc-option-btn { /* ... */ }
```
**Why Keep:** Selection buttons are part of the game interface.

**Reveal Button (Lines 168-191, 479-481)**
```css
.bc-eye-button {
  width: 48px;
  height: 48px;
  border: 2px solid #dee2e6;
  /* ... styled like a peg */
}
```
**Why Keep:** Reveal button is styled to match the pegs (part of board design).

---

### ❌ REMOVE (UI elements - 126 lines)

**Game Info Bar (Lines 7-28)**
```css
.bc-game-info-bar {
  width: 100%;
  background: white;
  border-bottom: 1px solid #e7e5e4;
  padding: 12px 16px;
}

.bc-game-info-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  /* ... */
}

.bc-game-info-content .ah-badge {
  font-size: 14px;
  font-weight: 500;
  padding: 6px 12px;
}
```
**Replace with:** `.ah-container` with `.ah-flex-center` and `.ah-badge` (don't override badge styles)

**Section Titles (Lines 31-39)**
```css
.bc-section-title {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```
**Replace with:** `<h3>` with SDK classes, or add `.ah-section-title` to Activity Hub CSS

**Waiting Indicator (Lines 42-46)**
```css
.bc-waiting-indicator {
  font-size: 14px;
  font-weight: 400;
  color: #78716c;
}
```
**Replace with:** `.ah-meta` class (secondary text)

**Game Over Banner (Lines 49-62)**
```css
.bc-game-over-banner {
  padding: 2rem;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 600;
  /* ... */
}

.bc-game-over-banner--win { /* ... */ }
```
**Replace with:** `.ah-banner .ah-banner--success` or `.ah-banner--error`

**History Item Layout (Lines 285-295)**
```css
.bc-history-item-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.bc-guess-number {
  font-weight: bold;
  min-width: 40px;
}
```
**Replace with:** `.ah-flex-center` with `.ah-badge` for guess number

**Action Buttons Layout (Lines 298-305)**
```css
.bc-actions {
  display: flex;
  gap: 0.5rem;
}

.bc-actions .ah-btn-primary {
  flex: 1;
}
```
**Replace with:** `.ah-flex-between` or `.ah-flex-center` (don't override button styles)

**Game Info Layout (Lines 308-313)**
```css
.bc-game-info {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
```
**Replace with:** `.ah-flex-between`

**Mode Selection (Lines 316-334)**
```css
.bc-mode-grid {
  display: grid;
  gap: 1rem;
}

.bc-mode-btn {
  padding: 1.5rem;
  font-size: 1.125rem;
}

.bc-mode-title { /* ... */ }
.bc-mode-desc { /* ... */ }
```
**Replace with:** `.ah-btn-outline` with proper layout classes

**History Scroll Container (Lines 337-340)**
```css
.bc-history-scroll {
  max-height: 400px;
  overflow-y: auto;
}
```
**Replace with:** Add `.ah-scrollable` utility to Activity Hub CSS, or inline this specific scrolling behavior

**Legend/Status Text (Lines 343-352)**
```css
.bc-legend {
  font-size: 0.875rem;
  margin-top: 1rem;
}

.bc-status {
  margin-bottom: 1rem;
  font-size: 0.875rem;
}
```
**Replace with:** `.ah-meta` class

**Guess Row Layout (Lines 466-476)**
```css
.bc-guess-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-bottom: 1px solid #e7e5e4;
}
```
**Replace with:** `.ah-list-item` class

**Opponent Progress Display (Lines 484-510)**
```css
.bc-opponent-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 32px;
}

.bc-opponent-compact { /* ... */ }
.bc-opponent-label { /* ... */ }
.bc-opponent-feedback { /* ... */ }
```
**Replace with:** `.ah-flex-center` with `.ah-meta` for labels

**Connection Status (Lines 276-282)**
```css
.bc-status-connected {
  color: #198754;
}

.bc-status-disconnected {
  color: #dc3545;
}
```
**Replace with:** `.ah-status--success` and `.ah-status--error`

**Guess Display (Lines 94-104)**
```css
.bc-guess-display {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.bc-guess-display-disabled {
  opacity: 0.4;
  pointer-events: none;
}
```
**Keep or Remove?** This is borderline - it's the layout for the pegs during guessing. I'd say **KEEP** since it's part of the board layout.

Actually, scratch that - on review, `.bc-guess-display` should probably **KEEP** since it's the peg grid layout which is part of the board structure. The disabled state is board state.

**Secret Code Compact (Lines 107-112)**
```css
.bc-secret-code-compact {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}
```
**Keep or Remove?** This is the layout for secret code pegs - part of the board. **KEEP**.

---

## 3. tictactoe-board.css (85 lines)

### ✅ KEEP (100% Board-specific - 85 lines)

**All of it!**

```css
.ttt-board {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #E7E5E4;
  padding: 8px;
  border-radius: 12px;
  /* ... */
}

.ttt-row { /* ... */ }
.ttt-cell { /* ... */ }
.ttt-cell-x { /* ... */ }
.ttt-cell-o { /* ... */ }
.ttt-symbol { /* ... */ }
.ttt-symbol-preview { /* ... */ }

@media (max-width: 480px) { /* ... */ }
```

**Why Keep:** Every line is the game board - the 3x3 grid, cells, X/O symbols, colors, hover states, responsive sizing.

### ❌ REMOVE

**Nothing!** This file is perfect.

---

## Action Plan

### Step 1: Dice (Simplest)

**Remove from dice-board.css:**
- `.dice-roller-container` (lines 4-10)
- `.dice-controls` (lines 13-16)
- `.dice-count` (lines 18-23)
- `.dice-roll-button` (lines 50-55)

**Update DiceRoller.tsx to use:**
- `.ah-container` or `.ah-flex-col-center` for container
- `.ah-flex-center` with `.ah-mb` for controls
- `.ah-badge` for dice count display
- Remove `.dice-roll-button` class from button (just use `.ah-btn-primary .ah-mb`)

**Result:** dice-board.css goes from 142 lines → 95 lines (33% reduction)

---

### Step 2: Bulls and Cows (Most Complex)

**Remove from bulls-and-cows-board.css:**
- `.bc-game-info-bar`, `.bc-game-info-content` (lines 7-28)
- `.bc-section-title` (lines 31-39)
- `.bc-waiting-indicator` (lines 42-46)
- `.bc-game-over-banner` (lines 49-62)
- `.bc-history-item-content`, `.bc-guess-number` (lines 285-295)
- `.bc-actions` (lines 298-305)
- `.bc-game-info` (lines 308-313)
- `.bc-mode-grid`, `.bc-mode-btn`, `.bc-mode-title`, `.bc-mode-desc` (lines 316-334)
- `.bc-history-scroll` (lines 337-340)
- `.bc-legend`, `.bc-status` (lines 343-352)
- `.bc-guess-row` (lines 466-476)
- `.bc-opponent-progress`, `.bc-opponent-compact`, etc. (lines 484-510)
- `.bc-status-connected`, `.bc-status-disconnected` (lines 276-282)

**Update components to use:**
- `.ah-container`, `.ah-flex-between`, `.ah-flex-center`
- `.ah-badge` (don't override styles)
- `.ah-banner .ah-banner--success/error`
- `.ah-meta` for secondary text
- `.ah-list-item` for guess rows
- `.ah-status--success/error` for connection status
- Add `.ah-scrollable` to Activity Hub CSS if needed

**Result:** bulls-and-cows-board.css goes from 516 lines → 390 lines (24% reduction)

---

### Step 3: Tic Tac Toe (Already Perfect!)

**No changes needed.** ✅

---

## New SDK/Activity Hub CSS Classes Needed

Based on this audit, we should add to Activity Hub CSS:

1. **`.ah-scrollable`** - scrollable container with max-height
   ```css
   .ah-scrollable {
     max-height: 400px;
     overflow-y: auto;
   }
   ```

2. **`.ah-section-title`** - consistent section headings (if not already exists)
   ```css
   .ah-section-title {
     font-size: 1rem;
     font-weight: 600;
     margin-bottom: 0.75rem;
   }
   ```

3. Consider: **`.ah-flex-center-sm`** - flex center with smaller gap
   ```css
   .ah-flex-center-sm {
     display: flex;
     align-items: center;
     justify-content: center;
     gap: 0.5rem;
   }
   ```

---

## Summary

- **Dice:** 47 lines to remove (33%)
- **Bulls and Cows:** 126 lines to remove (24%)
- **Tic Tac Toe:** 0 lines to remove (perfect!)

**Total reduction:** 173 lines of UI styling moved to SDK classes
**Total kept:** 570 lines of board-specific styling

This will significantly improve consistency while preserving the unique game board designs.

---

**Status:** Audit complete - ready for implementation when approved.
