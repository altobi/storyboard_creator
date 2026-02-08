# Migration Guide - Modular Architecture

## What Has Been Created

### ✅ Phase 1: Core Infrastructure (Completed)

1. **`config/constants.js`** - Centralized configuration
   - Page sizes
   - Default settings
   - Layout constants
   - Font lists

2. **`core/EventBus.js`** - Event-driven communication system
   - Publish-subscribe pattern
   - Loose coupling between modules
   - Singleton instance exported

3. **`core/StateManager.js`** - Centralized state management
   - Reactive state updates
   - Subscriptions to state changes
   - History tracking (for future undo/redo)

4. **`utils/math.js`** - Pure math utilities
   - `mmToPixels()` / `pixelsToMM()`
   - `calculateOptimalLayout()` - Extracted from app.js

5. **`utils/dom.js`** - DOM utilities
   - Safe element getters
   - Element creation helpers
   - `customAlert()` function

6. **`services/LayoutService.js`** - Layout calculation service
   - Wraps layout calculations
   - Provides clean API for layout operations

## Next Steps

### Phase 2: UI Components (Next)
- Create `ui/components/Toast.js` for notifications
- Create `ui/components/Modal.js` for dialogs
- Extract modal logic from app.js

### Phase 3: Extract Managers
- **ImageManager** - Image loading, caching, metadata
- **UIManager** - DOM manipulation, rendering
- **SettingsManager** - Settings persistence
- **PDFManager** - PDF export logic

### Phase 4: Refactor app.js
- Update app.js to use new modules
- Reduce from 3,151 lines to ~500-800 lines
- Make it an orchestrator that coordinates modules

## How to Use the New Modules

### Option 1: ES6 Modules (Recommended)
Update `index.html` to use modules:
```html
<script type="module" src="app.js"></script>
```

Then in your JS files:
```javascript
import { eventBus } from './core/EventBus.js';
import { PAGE_SIZES } from './config/constants.js';
import LayoutService from './services/LayoutService.js';
```

### Option 2: Non-Module Version (Current Setup)
If you want to keep current script loading, we can create non-module versions that attach to `window` object.

## Benefits Already Achieved

1. **Separation of Concerns** - Layout logic separated from UI logic
2. **Reusability** - Math utilities can be used anywhere
3. **Testability** - Pure functions are easy to test
4. **Maintainability** - Constants in one place
5. **Scalability** - Easy to add new features

## Example: Using the New Layout Service

**Before:**
```javascript
const layout = this.calculateOptimalLayout(imagesPerPage);
```

**After:**
```javascript
import LayoutService from './services/LayoutService.js';
const layoutService = new LayoutService();
const layout = layoutService.calculateLayout(imagesPerPage, this.project.settings);
```

## Example: Using Event Bus

**Before:**
```javascript
this.renderStoryboard(); // Direct call
```

**After:**
```javascript
import { eventBus } from './core/EventBus.js';

// Emit event
eventBus.emit('images-loaded', images);

// Listen to event
eventBus.on('images-loaded', (images) => {
    this.renderStoryboard();
});
```

## Migration Strategy

1. **Gradual Migration** - We can migrate piece by piece
2. **Backward Compatible** - Old code continues to work
3. **Test as We Go** - Each extraction is tested
4. **No Breaking Changes** - Features continue to work

## Current Status

- ✅ Core infrastructure created
- ✅ Utilities extracted
- ✅ Layout service created
- ⏳ Ready to start extracting managers
- ⏳ Ready to refactor app.js

