# Activity Hub CSS Guide

## Overview

`activity-hub.css` is the single source of truth for all Activity Hub styling. It provides:
- **Consistent look & feel** across Activity Hub portal and all mini-apps
- **Atomic, reusable classes** prefixed with `.ah-`
- **Responsive design** patterns for all screen sizes
- **Animations** for game interactions and transitions
- **Color palette** based on brand guidelines

## Color Palette

| Use | Color | Hex |
|-----|-------|-----|
| Brand Primary | Blue | `#2196F3` |
| Dark Hover | Dark Blue | `#1976D2` |
| Text Dark | Stone 900 | `#1C1917` |
| Text Light | Stone 600 | `#78716C` |
| Background | Light Stone | `#FAFAFA` |
| Borders | Stone 200 | `#F0F0F0` |
| Success | Green | `#16A34A` |
| Error | Red | `#DC2626` |
| Warning | Amber | `#FBBF24` |
| Info | Blue | `#2196F3` |

## CSS Class Categories

### Layout & Containers

```html
<!-- Flex utilities -->
<div class="ah-flex">...</div>
<div class="ah-flex-center">...</div>
<div class="ah-flex-center-justify">...</div>
<div class="ah-flex-between">...</div>
<div class="ah-flex-col">...</div>
<div class="ah-flex-col-center">...</div>

<!-- Containers -->
<div class="ah-container">...</div>           <!-- max-width: 64rem -->
<div class="ah-container--wide">...</div>     <!-- max-width: 80rem -->
<div class="ah-container--narrow">...</div>   <!-- max-width: 28rem -->

<!-- Cards -->
<div class="ah-card">...</div>
```

### Buttons

```html
<!-- Primary button (blue) -->
<button class="ah-btn-primary">Click me</button>

<!-- Outline button (blue border) -->
<button class="ah-btn-outline">Cancel</button>

<!-- Danger button (red) -->
<button class="ah-btn-danger">Delete</button>

<!-- Back button (neutral) -->
<button class="ah-btn-back">← Back</button>

<!-- Small variants -->
<button class="ah-btn-primary ah-btn-sm">Small</button>
<button class="ah-btn-danger-sm">Delete</button>
```

### Form Elements

```html
<input class="ah-input" type="text" placeholder="Enter text...">
<select class="ah-select">
  <option>Choose option</option>
</select>

<!-- Fixed-width select (e.g., dropdown menus) -->
<select class="ah-select ah-select-fixed">...</select>
```

### Banners & Alerts

```html
<div class="ah-banner ah-banner--info">Info message</div>
<div class="ah-banner ah-banner--success">Success!</div>
<div class="ah-banner ah-banner--warning">Warning!</div>
<div class="ah-banner ah-banner--error">Error occurred</div>
```

### Tabs

```html
<div class="ah-tabs">
  <button class="ah-tab active">Active Tab</button>
  <button class="ah-tab">Other Tab</button>
</div>
```

### Typography

```html
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>

<p class="ah-section-title">Section Title</p>
<p class="ah-meta">Meta information</p>
<label class="ah-label">Form Label</label>
```

### Tables

#### Flex-based (flexible)
```html
<div class="ah-table">
  <div class="ah-table-header">
    <div>Column 1</div>
    <div>Column 2</div>
  </div>
  <div class="ah-table-row">
    <div>Data 1</div>
    <div>Data 2</div>
  </div>
</div>
```

#### HTML Tables (traditional)
```html
<table class="ah-html-table">
  <thead>
    <tr>
      <th>Column</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data</td>
    </tr>
  </tbody>
</table>
```

### Game Boards

```html
<!-- 3x3 tic-tac-toe board -->
<div class="ah-game-board ah-game-board--3x3">
  <div class="ah-game-cell">X</div>
  <div class="ah-game-cell active">O</div>
  <div class="ah-game-cell disabled">-</div>
</div>

<!-- 6x6 dots game board -->
<div class="ah-game-board ah-game-board--dots">
  <!-- dots -->
</div>

<!-- Other sizes -->
<div class="ah-game-board ah-game-board--4x4">...</div>
<div class="ah-game-board ah-game-board--5x5">...</div>
<div class="ah-game-board ah-game-board--6x6">...</div>
```

### Modals

```html
<div class="ah-modal-overlay">
  <div class="ah-modal">
    <div class="ah-modal-header">
      <h3 class="ah-modal-title">Modal Title</h3>
      <button class="ah-modal-close">&times;</button>
    </div>
    <div class="ah-modal-body">
      Modal content here
    </div>
    <div class="ah-modal-footer">
      <button class="ah-btn-outline">Cancel</button>
      <button class="ah-btn-primary">Confirm</button>
    </div>
  </div>
</div>

<!-- Large modal -->
<div class="ah-modal ah-modal--large">...</div>

<!-- Small modal -->
<div class="ah-modal ah-modal--small">...</div>
```

### Status Indicators

```html
<!-- Status badges -->
<span class="ah-status ah-status--active">🟢 Active</span>
<span class="ah-status ah-status--waiting">🟡 Waiting</span>
<span class="ah-status ah-status--disabled">⚫ Disabled</span>
<span class="ah-status ah-status--eliminated">🔴 Eliminated</span>
<span class="ah-status ah-status--complete">✅ Complete</span>
<span class="ah-status ah-status--in-progress">🔵 In Progress</span>

<!-- Status dots -->
<span class="ah-status-dot ah-status-dot--online"></span>
<span class="ah-status-dot ah-status-dot--offline"></span>
<span class="ah-status-dot ah-status-dot--away"></span>
<span class="ah-status-dot ah-status-dot--busy"></span>

<!-- Player indicators -->
<div class="ah-player ah-player--current">👤 You</div>
<div class="ah-player ah-player--opponent">👤 Opponent</div>
<div class="ah-player ah-player--winner">🏆 Winner</div>
<div class="ah-player ah-player--loser">⚠️ Loser</div>
```

### Badges & Pills

```html
<span class="ah-badge ah-badge--success">✓ Done</span>
<span class="ah-badge ah-badge--error">✗ Failed</span>
<span class="ah-badge ah-badge--warning">! Warning</span>
<span class="ah-badge ah-badge--info">ℹ Info</span>
<span class="ah-badge ah-badge--neutral">○ Neutral</span>
```

### Loading States

```html
<div class="ah-loading-container">
  <div class="ah-spinner"></div>
  <p class="ah-loading-text">Loading...</p>
</div>

<!-- Spinner sizes -->
<div class="ah-spinner"></div>
<div class="ah-spinner ah-spinner--large"></div>
<div class="ah-spinner ah-spinner--small"></div>

<!-- Skeleton loaders -->
<div class="ah-skeleton ah-skeleton--text"></div>
<div class="ah-skeleton ah-skeleton--title"></div>
<div class="ah-skeleton ah-skeleton--circle"></div>
```

### Animations

```html
<!-- Pulse animation (game events) -->
<div class="ah-pulse">Pulsing element</div>

<!-- Box complete animation (dots/boxes game) -->
<div class="ah-box-complete">Box</div>

<!-- Fade in animation -->
<div class="ah-fade-in">Fading in...</div>

<!-- Slide down animation -->
<div class="ah-slide-down">Sliding down...</div>
```

### Layout Patterns

#### Inline Form (input + button side-by-side)
```html
<form class="ah-inline-form">
  <input class="ah-input" type="text" placeholder="Search...">
  <button class="ah-btn-primary">Search</button>
</form>
```

#### List Pattern
```html
<div class="ah-list">
  <div class="ah-list-item">
    <span>Item 1</span>
    <button>Action</button>
  </div>
  <div class="ah-list-item">
    <span>Item 2</span>
    <button>Action</button>
  </div>
</div>
```

#### Auto-fill Grid
```html
<!-- Default (300px min per column) -->
<div class="ah-grid-auto">
  <div class="ah-card">Card 1</div>
  <div class="ah-card">Card 2</div>
</div>

<!-- Narrow (200px min per column) -->
<div class="ah-grid-auto ah-grid-auto--narrow">...</div>

<!-- Wide (400px min per column) -->
<div class="ah-grid-auto ah-grid-auto--wide">...</div>
```

#### Detail View Header
```html
<div class="ah-detail-header">
  <div>
    <h2>Item Title</h2>
    <p class="ah-meta">Created 2 hours ago</p>
  </div>
  <button class="ah-btn-primary">Action</button>
</div>
```

### Game-Specific Patterns

#### Player Grid (selection)
```html
<div class="ah-player-grid">
  <div class="ah-player-grid-item">
    <span>👤</span>
    <span>Player Name</span>
  </div>
</div>
```

#### Filter Box
```html
<div class="ah-filter-box">
  <input class="ah-input" type="text" placeholder="Filter...">
</div>
```

### Role Chips (toggle buttons)

```html
<div class="ah-role-chips">
  <button class="ah-role-chip active">Admin</button>
  <button class="ah-role-chip inactive">Moderator</button>
  <button class="ah-role-chip inactive">User</button>
</div>
```

### Collapsible Sections

```html
<div class="ah-section">
  <div class="ah-section-header" onclick="toggleSection()">
    <h3 class="ah-section-title">Section Title</h3>
    <span class="ah-section-toggle">⋯</span>
  </div>
  <div class="ah-section-content">
    Section content here
  </div>
</div>

<!-- Collapsed state -->
<div class="ah-section-content collapsed">...</div>
```

## Best Practices

### 1. **Always Use Classes, Not Inline Styles**
```html
<!-- ✅ DO -->
<button class="ah-btn-primary">Click</button>

<!-- ❌ DON'T -->
<button style="background: #2196F3; color: white;">Click</button>
```

### 2. **Use Semantic HTML**
```html
<!-- ✅ DO -->
<button class="ah-btn-primary">Submit</button>
<input class="ah-input" type="text">

<!-- ❌ DON'T -->
<div class="ah-btn-primary">Submit</div>
<div class="ah-input"></div>
```

### 3. **Combine Utility Classes**
```html
<!-- ✅ DO - Combining utilities -->
<div class="ah-flex ah-flex-center ah-flex-between">
  <h2>Title</h2>
  <button class="ah-btn-primary ah-btn-sm">Action</button>
</div>

<!-- ❌ DON'T - Creating new classes -->
<div style="display: flex; align-items: center; justify-content: space-between;">
</div>
```

### 4. **Respect Responsive Design**
All classes work on mobile-first basis. The CSS includes responsive media queries for tablets and desktops.

### 5. **Color Consistency**
Use only the defined color palette. Don't introduce new colors.

## Accessibility

- All buttons and interactive elements have proper focus styles
- Color is never the only indicator of status (use icons + text)
- Adequate contrast ratios for text (WCAG AA compliant)
- Proper semantic HTML for screen readers

## Mini-App Integration

To use these styles in your mini-app:

```typescript
// In your main entry point or App.tsx
import '@activity-hub/ui/styles/activity-hub.css';

// Now all .ah-* classes are available
export function MyApp() {
  return (
    <div class="ah-container">
      <h1>My Game</h1>
      <button class="ah-btn-primary">Start</button>
    </div>
  );
}
```

## Customization

**Don't override Activity Hub CSS.** If you need custom styling:

1. Use classes for all Activity Hub components
2. Create your own scoped CSS for app-specific UI
3. Don't use `!important` to override `.ah-` classes

```css
/* Your app's custom CSS */
.my-game-board {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 12px;
}
```

## File Size

- `activity-hub.css` is **~35KB** minified (before gzip)
- All classes are essential and used across the platform
- No unused CSS pollution

## Support

For CSS issues or feature requests, contact the Activity Hub team.
