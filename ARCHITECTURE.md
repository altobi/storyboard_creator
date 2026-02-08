# Storyboard Creator - Architecture Proposal

## Current State Analysis

**Current Structure:**
- `app.js` (3,151 lines) - Monolithic class handling everything
- `fileManager.js` - File operations (already separated ✅)
- `drawing.js` - Drawing system (already separated ✅)
- `index.html` - UI structure
- `styles.css` - Styling

**Issues:**
- Single responsibility principle violated
- Difficult to test individual components
- Hard to add new features without touching core code
- Tight coupling between UI and business logic
- No clear separation of concerns

## Proposed Modular Architecture

### Directory Structure
```
storyboard_creator/
├── index.html
├── styles.css
├── app.js                    # Main application entry point (orchestrator)
├── config/
│   └── constants.js         # Page sizes, defaults, configuration
├── core/
│   ├── EventBus.js          # Event-driven communication
│   ├── StateManager.js      # Centralized state management
│   └── ProjectModel.js     # Project data structure and validation
├── managers/
│   ├── FileManager.js       # ✅ Already exists
│   ├── ImageManager.js      # Image loading, caching, metadata
│   ├── ProjectManager.js    # Project save/load operations
│   ├── UIManager.js         # UI interactions and rendering
│   ├── SettingsManager.js   # Settings management
│   └── PDFManager.js        # PDF export logic
├── services/
│   ├── LayoutService.js     # Layout calculations
│   ├── RenderService.js     # Storyboard rendering
│   ├── StorageService.js    # localStorage/IndexedDB operations
│   └── ValidationService.js # Data validation
├── ui/
│   ├── ToolbarController.js # Toolbar interactions
│   ├── PanelController.js    # Side panel management
│   ├── ModalController.js   # Modal dialogs
│   ├── ImageSettingsModal.js # Image settings UI
│   └── components/          # Reusable UI components
│       ├── Toast.js
│       ├── Dialog.js
│       └── CustomInput.js
├── utils/
│   ├── dom.js               # DOM utilities
│   ├── math.js              # Math utilities (layout calculations)
│   ├── color.js             # Color conversion utilities
│   └── validation.js       # Validation helpers
├── features/
│   ├── drawing/
│   │   └── DrawingSystem.js # ✅ Already exists
│   ├── coverpage/
│   │   └── CoverPageManager.js
│   ├── watermark/
│   │   └── WatermarkManager.js
│   └── [future-features]/   # Easy to add new features
└── types/
    └── ProjectTypes.js      # Type definitions (JSDoc)

```

## Architecture Principles

### 1. **Separation of Concerns**
- **Models**: Data structures and business logic
- **Managers**: High-level operations and coordination
- **Services**: Reusable business logic
- **UI Controllers**: User interface interactions
- **Utils**: Pure utility functions

### 2. **Event-Driven Communication**
- Use EventBus for loose coupling
- Components communicate via events, not direct calls
- Example: `EventBus.emit('images-loaded', images)`
- Example: `EventBus.on('project-changed', handler)`

### 3. **Dependency Injection**
- Managers receive dependencies via constructor
- Makes testing easier
- Reduces tight coupling

### 4. **Single Responsibility**
- Each class/module has one clear purpose
- Easy to understand and maintain
- Easy to test

## Module Breakdown

### Core Modules

#### `core/EventBus.js`
```javascript
class EventBus {
    on(event, callback) { }
    off(event, callback) { }
    emit(event, data) { }
}
```
- Central event system for inter-module communication

#### `core/StateManager.js`
```javascript
class StateManager {
    getState() { }
    setState(updates) { }
    subscribe(callback) { }
}
```
- Manages application state
- Notifies subscribers of changes

#### `core/ProjectModel.js`
```javascript
class ProjectModel {
    constructor() { }
    validate(data) { }
    migrate(data) { }
    getDefaultProject() { }
}
```
- Project data structure
- Validation and migration

### Manager Modules

#### `managers/ImageManager.js`
- Image loading from folders
- Image metadata management
- Image caching
- Image manipulation (scale, crop, etc.)

#### `managers/UIManager.js`
- DOM manipulation
- Storyboard rendering
- UI updates
- Event delegation

#### `managers/SettingsManager.js`
- Settings persistence
- Settings validation
- Default settings management

#### `managers/PDFManager.js`
- PDF generation
- Page layout for PDF
- Export logic

### Service Modules

#### `services/LayoutService.js`
- Calculate optimal layouts
- Page size calculations
- Grid calculations

#### `services/RenderService.js`
- Storyboard page rendering
- Frame rendering
- Text rendering

#### `services/StorageService.js`
- localStorage operations
- IndexedDB operations
- Auto-save functionality

## Migration Strategy

### Phase 1: Extract Utilities (Low Risk)
1. Extract pure utility functions
2. Create `utils/` directory
3. Move math, color, validation utilities

### Phase 2: Extract Services (Medium Risk)
1. Extract layout calculations → `LayoutService`
2. Extract rendering logic → `RenderService`
3. Extract storage logic → `StorageService`

### Phase 3: Extract Managers (Higher Risk)
1. Extract image handling → `ImageManager`
2. Extract UI logic → `UIManager`
3. Extract settings → `SettingsManager`
4. Extract PDF logic → `PDFManager`

### Phase 4: Implement Event System (Medium Risk)
1. Create `EventBus`
2. Refactor communication to use events
3. Decouple modules

### Phase 5: State Management (Higher Risk)
1. Create `StateManager`
2. Centralize state
3. Update all modules to use state manager

## Benefits

1. **Scalability**: Easy to add new features
2. **Maintainability**: Clear structure, easy to find code
3. **Testability**: Each module can be tested independently
4. **Collaboration**: Multiple developers can work on different modules
5. **Performance**: Can lazy-load modules if needed
6. **Reusability**: Services and utilities can be reused

## Example: Adding a New Feature

**Before (Monolithic):**
- Modify `app.js` (3,151 lines)
- Risk breaking existing functionality
- Hard to test

**After (Modular):**
1. Create `features/timeline/TimelineManager.js`
2. Create `features/timeline/TimelineUI.js`
3. Register with EventBus
4. Add to main app initialization
5. Test independently

## Next Steps

1. Review and approve this architecture
2. Start with Phase 1 (utilities) - lowest risk
3. Gradually migrate to new structure
4. Maintain backward compatibility during migration
5. Update documentation as we go


