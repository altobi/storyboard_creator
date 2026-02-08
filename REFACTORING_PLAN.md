# Refactoring Plan: Breaking Down app.js

## Current Situation
- `app.js`: **5,073 lines** - Too large, hard to maintain
- Scripts loaded via `<script src="">` tags (not ES6 modules)
- Some managers exist but app.js still contains too much logic

## Performance Impact
**Large files don't directly impact runtime performance**, but they do:
1. **Development experience**: Hard to navigate, find code, understand structure
2. **Initial load time**: Browser must parse entire file even if not all code is used
3. **Caching**: Changes to one part invalidate entire file cache
4. **Code splitting**: Can't lazy-load features
5. **Maintainability**: Hard to add features without touching core code

## Refactoring Strategy

### Phase 1: Extract UI Controllers (Low Risk)
**Target**: ~500-800 lines
- Modal dialogs → `ui/ModalController.js`
- Image settings → `ui/ImageSettingsController.js`
- Custom dialogs (alert/confirm/prompt) → `ui/DialogController.js`
- Toast notifications → `ui/ToastController.js`

### Phase 2: Extract Services (Medium Risk)
**Target**: ~800-1200 lines
- Rendering logic → `services/RenderService.js`
- Storage/persistence → `services/StorageService.js`
- Layout calculations → Already in `services/LayoutService.js` ✅

### Phase 3: Extract Utilities (Low Risk)
**Target**: ~300-500 lines
- Zoom functionality → `utils/zoom.js`
- Color utilities → `utils/color.js`
- Font utilities → `utils/font.js`

### Phase 4: Extract Feature Controllers (Medium Risk)
**Target**: ~400-600 lines
- Cover page → `features/coverpage/CoverPageController.js`
- Watermark → `features/watermark/WatermarkController.js`
- Drawing setup → `features/drawing/DrawingController.js`

### Phase 5: Convert to ES6 Modules (Medium Risk)
- Update HTML to use `<script type="module">`
- Add proper imports/exports
- Ensure backward compatibility

## Module Breakdown

### 1. `ui/ModalController.js` (~200 lines)
```javascript
class ModalController {
    setupModal()
    setupCustomDialog()
    showToast(message, type, duration)
    customAlert(message)
    customConfirm(message)
    customChoice(title, message, options)
    customPrompt(message, defaultValue)
}
```

### 2. `ui/ImageSettingsController.js` (~150 lines)
```javascript
class ImageSettingsController {
    openImageSettings(image)
    saveImageSettings()
    removeImage()
    loadSingleImageFile(file)
}
```

### 3. `services/RenderService.js` (~800 lines)
```javascript
class RenderService {
    renderStoryboard()
    createPage(images, ...)
    createCoverPage(...)
    createFrame(image, ...)
    updateImageScale()
    updateFrameScale()
}
```

### 4. `services/StorageService.js` (~300 lines)
```javascript
class StorageService {
    saveToStorage(isTempSave)
    loadFromStorage()
    restoreProject(data, isTempSave)
    loadProjectToUI()
    resetUI()
}
```

### 5. `utils/zoom.js` (~100 lines)
```javascript
export function zoom(factor)
export function zoomFit()
export function applyZoom()
```

### 6. `utils/color.js` (~50 lines)
```javascript
export function hexToRgb(hex)
export function rgbToHex(r, g, b)
```

### 7. `utils/font.js` (~100 lines)
```javascript
export function getFontWeights(fontFamily)
export function updateFontWeightOptions(...)
```

## Expected Results

### Before:
- `app.js`: 5,073 lines
- Hard to navigate
- All code loaded at once

### After:
- `app.js`: ~1,500-2,000 lines (orchestration only)
- `ui/ModalController.js`: ~200 lines
- `ui/ImageSettingsController.js`: ~150 lines
- `services/RenderService.js`: ~800 lines
- `services/StorageService.js`: ~300 lines
- `utils/zoom.js`: ~100 lines
- `utils/color.js`: ~50 lines
- `utils/font.js`: ~100 lines
- **Total**: Same code, better organized

## Benefits
1. **Easier navigation**: Find code quickly
2. **Better caching**: Changes to one module don't invalidate others
3. **Code splitting**: Can lazy-load features
4. **Team collaboration**: Multiple developers can work on different modules
5. **Testing**: Each module can be tested independently
6. **Maintainability**: Clear structure, easy to understand

## Migration Approach
1. Create new module files
2. Move code to modules
3. Update app.js to use modules
4. Test thoroughly
5. Keep backup until verified

## Next Steps
1. Start with Phase 1 (UI Controllers) - lowest risk
2. Test after each phase
3. Continue with Phase 2-5
4. Update documentation

