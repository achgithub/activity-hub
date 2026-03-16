# Activity Hub UI Styles

**Single source of truth for all Activity Hub and mini-app styling.**

---

## Overview

The Activity Hub CSS system consists of:

1. **activity-hub.css** - Compiled, production CSS (180+ classes)
2. **activity-hub-src.css** - Tailwind source (uses @apply directives)
3. **tailwind.config.js** - Tailwind configuration

---

## Architecture

### Current Approach (Default)
```
activity-hub.css (compiled)
    ↓
Imported in frontend/src/index.tsx
    ↓
All mini-apps use .ah-* classes
    ↓
Zero dependencies on Tailwind at runtime
```

**Advantage:** No build step required. CSS is pre-compiled and ready to use.

### Future Enhancement (If Needed)
```
activity-hub-src.css (with Tailwind @apply)
    ↓
npm run build:css (compiles via Tailwind)
    ↓
Updates activity-hub.css
    ↓
New utilities available to all apps
```

**Advantage:** Can add Tailwind utilities in the future without rewriting CSS.

---

## The Two Files

### activity-hub.css (PRODUCTION - Use This)
```
📦 Size: 33 KB (1,538 lines)
📦 Status: Compiled and optimized
📦 Usage: Import in frontend/src/index.tsx
📦 Deployment: Served to all mini-apps
```

This is what gets used. It's pre-compiled pure CSS with no dependencies.

### activity-hub-src.css (SOURCE - Maintain This)
```
📦 Size: ~3 KB (raw with Tailwind directives)
📦 Status: Human-readable source
📦 Usage: Edit this to add new classes
📦 Build: Run `npm run build:css` to compile
```

When you need to add new Tailwind utilities, edit this file.

---

## Building Updated CSS

### If You Need to Add New Classes

1. **Edit the source file**
   ```bash
   vim packages/ui/src/styles/activity-hub-src.css
   ```

2. **Add Tailwind utilities or @apply rules**
   ```css
   .ah-new-class {
     @apply inline-flex items-center gap-2 px-3 py-2;
     border-radius: 6px;
   }
   ```

3. **Compile to production CSS**
   ```bash
   cd packages/ui
   npm run build:css
   ```

4. **Verify the output**
   ```bash
   # activity-hub.css should be updated
   ls -lh src/styles/activity-hub.css
   ```

5. **Commit both files**
   ```bash
   git add packages/ui/src/styles/activity-hub.css
   git add packages/ui/src/styles/activity-hub-src.css
   git commit -m "Add new .ah-* classes for [feature]"
   ```

### Watch Mode (For Development)
```bash
cd packages/ui
npm run watch:css
```

Automatically recompiles CSS whenever you edit activity-hub-src.css.

---

## Tailwind Configuration

**File:** `tailwind.config.js`

Includes custom theme extensions:

### Brand Colors
```
brand-500:   #2196F3  (primary)
brand-600:   #1E88E5  (hover)
brand-700:   #1976D2  (active/dark)
brand-50-900: Full palette for lighter/darker variants
```

### Custom Fonts
System font stack (no downloads):
- -apple-system
- BlinkMacSystemFont
- Segoe UI
- Roboto
- Helvetica Neue

### Custom Shadows
Softer, warmer shadows than Tailwind default.

### Custom Border Radius
- `sm`: 4px
- `md`: 8px (DEFAULT)
- `lg`: 12px (cards)
- `xl`: 16px (large cards)

---

## When to Use Tailwind vs Pure CSS

### Use Tailwind (@apply)
```css
/* Good for complex layouts */
.ah-complex-grid {
  @apply grid gap-4 grid-cols-3 md:grid-cols-2 sm:grid-cols-1;
}

/* Good for repeated patterns */
.ah-form-field {
  @apply flex flex-col gap-2 mb-4;
}
```

### Use Pure CSS
```css
/* For custom properties not in Tailwind */
.ah-custom-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* For specific browser features */
.ah-sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
}
```

---

## Maintenance

### Regular Tasks
- ✅ Edit `activity-hub-src.css` when adding classes
- ✅ Run `npm run build:css` to compile
- ✅ Commit both `.css` files to git
- ✅ Mini-apps automatically get updates

### Deprecation
- If removing a class, mark as deprecated first
- Update documentation
- Give 2 weeks notice to mini-app developers
- Then remove from source

### Testing After Compilation
```bash
# Check file size hasn't exploded
ls -lh src/styles/activity-hub.css

# Verify no syntax errors
npm run build:css --verbose

# Check git diff
git diff src/styles/activity-hub.css | head -50
```

---

## Troubleshooting

### Tailwind not found
```bash
cd packages/ui
npm install
```

### CSS not updating
```bash
# Verify source file is valid
npm run build:css

# Check for errors in activity-hub-src.css
# Look for missing @apply, invalid Tailwind directives
```

### CSS file too large
```bash
# Minify might have failed
npm run build:css

# Check output file:
wc -l src/styles/activity-hub.css
ls -lh src/styles/activity-hub.css
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Build CSS once | `npm run build:css` |
| Watch for changes | `npm run watch:css` |
| Build TypeScript | `npm run build` |
| Watch TypeScript | `npm run dev` |
| Both (CSS + TS) | `npm run build:css && npm run build` |

---

## Files Included in Package

When published to npm, the package includes:

```
@activity-hub/ui
├── src/styles/
│   ├── activity-hub.css         (compiled - used by apps)
│   └── activity-hub-src.css     (source - for maintenance)
├── tailwind.config.js           (if app wants to extend)
├── dist/                        (compiled TypeScript)
└── package.json
```

Apps can import:
```typescript
// Use compiled CSS (recommended)
import '@activity-hub/ui/styles/activity-hub.css';

// Access Tailwind config if extending
import tailwindConfig from '@activity-hub/ui/tailwind.config.js';
```

---

## Future Enhancements

### Phase 2+
If you want to add more Tailwind utilities:

1. Edit `activity-hub-src.css`
2. Run `npm run build:css`
3. Commit both files
4. Update CSS_GUIDE.md with new classes
5. Mini-apps get update automatically

### Zero Breaking Changes
- New classes only added, never removed
- Existing classes always work
- Tailwind version can be updated as needed
- CSS always backward compatible

---

## Support

### Questions About CSS Classes
→ See `CSS_GUIDE.md`

### Questions About Build Process
→ See this file (STYLES_README.md)

### Need to Add New Classes
1. Edit `activity-hub-src.css`
2. Run `npm run build:css`
3. Test in activity-hub frontend
4. Commit and deploy

---

## Summary

✅ **activity-hub.css** is production-ready, no build required
✅ **activity-hub-src.css** is available for future enhancements
✅ **tailwind.config.js** defines brand colors and custom extensions
✅ **npm run build:css** updates CSS whenever needed
✅ Zero breaking changes guaranteed

Ready to maintain Activity Hub styles! 🎨
