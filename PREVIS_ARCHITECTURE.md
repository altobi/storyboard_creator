# Previs Workspace Architecture Plan

## Overview
The Previs workspace will function as a video editing interface similar to DaVinci Resolve, allowing users to create previsualization videos from storyboard frames. The interface will feature a video preview area and a linear timeline for frame sequencing and playback.

## Core Components

### 1. **PrevisManager** (`managers/PrevisManager.js`)
Core logic manager for the previs system.

**Responsibilities:**
- Build frame sequence from storyboard images (sorted by Scene → Shot → Frame)
- Calculate default frame durations: `shotDuration / numberOfFramesInShot`
- Manage timeline clips (each clip represents a storyboard frame)
- Handle playback state (play, pause, stop, current time)
- Track frame timing and transitions
- Persist timeline data to project

**Data Structure:**
```javascript
{
  timeline: [
    {
      id: 'clip_001',
      imageId: '0010.jpeg',
      imageUrl: 'data:image/...',
      startTime: 0.0,        // seconds
      duration: 2.5,         // seconds (default: shotDuration / frameCount)
      endTime: 2.5,
      sceneNumber: '001',
      shotNumber: '001',
      frameNumber: '0010',
      thumbnail: 'data:image/...', // Small preview
      customDuration: false  // true if user manually edited
    },
    // ... more clips
  ],
  currentTime: 0.0,          // Current playback position (seconds)
  isPlaying: false,
  frameRate: 24,              // From project settings
  totalDuration: 0.0,         // Total timeline duration
  zoomLevel: 1.0              // Timeline zoom (1x = 1 second per 100px)
}
```

**Key Methods:**
- `buildTimelineFromStoryboard()` - Create timeline from sorted images
- `calculateDefaultDurations()` - Set default frame durations based on shot length
- `getFrameAtTime(time)` - Get frame image to display at given time
- `updateClipDuration(clipId, newDuration)` - Update clip duration
- `moveClip(clipId, newStartTime)` - Move clip on timeline
- `deleteClip(clipId)` - Remove clip from timeline
- `getTimelineData()` - Export timeline for saving
- `loadTimelineData(data)` - Restore timeline from saved data

### 2. **PrevisController** (`ui/PrevisController.js`)
UI controller for the previs workspace.

**Responsibilities:**
- Initialize and render previs workspace UI
- Handle playback controls (play, pause, stop, seek)
- Manage timeline rendering and interaction
- Handle video preview canvas
- Coordinate between PrevisManager and UI

**Key Methods:**
- `init()` - Initialize workspace
- `render()` - Render the previs interface
- `renderVideoPreview()` - Render current frame in preview
- `renderTimeline()` - Render timeline with clips
- `handlePlayback()` - Handle play/pause/stop
- `handleSeek(time)` - Seek to specific time
- `handleTimelineInteraction()` - Handle drag, resize, click on timeline

### 3. **Timeline Component** (`features/previz/Timeline.js`)
Canvas-based timeline component for visual editing.

**Responsibilities:**
- Render timeline tracks with clips
- Handle drag-and-drop for moving clips
- Handle clip resizing (drag edges to change duration)
- Display timecode ruler
- Handle zoom controls
- Visual feedback for hover, selection, dragging

**Features:**
- Horizontal scrolling timeline
- Vertical tracks (can support multiple tracks later)
- Clip thumbnails on timeline
- Timecode display (HH:MM:SS:FF format)
- Playhead indicator
- Snap-to-grid (optional)
- Zoom controls (zoom in/out, fit to screen)

**Interaction:**
- Click clip: Select clip, show in preview
- Drag clip: Move clip on timeline
- Drag clip edge: Resize clip duration
- Double-click clip: Open frame settings
- Click timeline: Seek to that time
- Scroll: Horizontal scroll timeline
- Mouse wheel: Zoom timeline

### 4. **Video Preview Component** (`features/previz/VideoPreview.js`)
Canvas/div for displaying current frame during playback.

**Responsibilities:**
- Display current frame image
- Handle frame transitions (fade, cut, etc.)
- Maintain aspect ratio
- Show playback controls overlay
- Display current timecode

**Features:**
- Large preview area (center-top of workspace)
- Frame counter display
- Timecode display (HH:MM:SS:FF)
- Playback controls (play, pause, stop, frame-by-frame)
- Fullscreen mode (optional)

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Play] [Pause] [Stop] [Frame-] [Frame+]  [00:00:00:00] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│              VIDEO PREVIEW AREA                          │
│         (Current frame displayed here)                   │
│                                                           │
├─────────────────────────────────────────────────────────┤
│  Timeline Controls: [Zoom -] [Zoom +] [Fit] [Snap]     │
├─────────────────────────────────────────────────────────┤
│  00:00  │──[Clip1]──[Clip2]──[Clip3]──│ 00:30          │
│  00:05  │        [Clip4]──[Clip5]──│                    │
│         │                          │                    │
│         └──────────────────────────┘                    │
│  ← → Timeline scrollable area                            │
│  | Playhead (current position)                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Basic Structure
1. Create `PrevisManager` class
2. Create `PrevisController` class
3. Build basic HTML structure in `index.html`
4. Implement frame sequence building from storyboard
5. Calculate default durations

### Phase 2: Video Preview
1. Create `VideoPreview` component
2. Implement frame display
3. Add playback controls
4. Implement play/pause/stop
5. Add timecode display

### Phase 3: Timeline Rendering
1. Create `Timeline` component
2. Render timeline tracks
3. Render clips as rectangles with thumbnails
4. Add timecode ruler
5. Implement horizontal scrolling

### Phase 4: Timeline Interaction
1. Implement clip selection
2. Implement drag to move clips
3. Implement drag edges to resize clips
4. Implement timeline scrubbing (click to seek)
5. Add playhead indicator

### Phase 5: Playback Engine
1. Implement frame-by-frame playback
2. Implement smooth transitions between frames
3. Add frame rate control
4. Implement seek functionality
5. Add frame-by-frame navigation

### Phase 6: Advanced Features
1. Timeline zoom controls
2. Snap-to-grid
3. Multiple tracks support
4. Transitions between clips (fade, etc.)
5. Export to video file (future)

## Technical Details

### Frame Duration Calculation
```javascript
// For each shot in shot list:
const shotDuration = shot.durationFrames / frameRate; // Convert frames to seconds
const framesInShot = shot.frameCount; // Number of storyboard frames
const defaultFrameDuration = shotDuration / framesInShot;

// Apply to each frame in that shot
frames.forEach(frame => {
  frame.duration = defaultFrameDuration;
});
```

### Timeline Rendering
- Use HTML5 Canvas for timeline rendering (better performance)
- Or use DOM elements with CSS transforms (easier interaction)
- Each clip is a div with:
  - Background: Frame thumbnail
  - Width: `duration * pixelsPerSecond * zoomLevel`
  - Position: `startTime * pixelsPerSecond * zoomLevel`
  - Border: Selected state indicator

### Playback Engine
```javascript
// Animation loop
function playbackLoop() {
  if (isPlaying) {
    currentTime += (1 / frameRate); // Advance by one frame
    
    // Get frame at current time
    const currentClip = getClipAtTime(currentTime);
    if (currentClip) {
      displayFrame(currentClip.imageUrl);
    }
    
    // Update playhead position
    updatePlayhead(currentTime);
    
    // Check if reached end
    if (currentTime >= totalDuration) {
      stop();
    }
  }
  
  requestAnimationFrame(playbackLoop);
}
```

### Data Persistence
Save timeline data to project:
```javascript
project.previz = {
  timeline: [...], // Array of clip objects
  settings: {
    zoomLevel: 1.0,
    snapToGrid: false,
    gridSize: 1.0 // seconds
  }
}
```

## File Structure

```
managers/
  PrevisManager.js          # Core logic

ui/
  PrevisController.js       # UI controller

features/
  previz/
    Timeline.js             # Timeline component
    VideoPreview.js        # Video preview component
    PlaybackEngine.js      # Playback logic (optional separate file)

index.html                 # Add previz workspace HTML
```

## Integration Points

1. **Storyboard Images**: Read from `app.project.images` (sorted by Scene → Shot → Frame)
2. **Shot List**: Use `app.shotListManager` to get shot durations
3. **Frame Rate**: Use `app.project.settings.frameRate` (default 24 FPS)
4. **Image URLs**: Use `image.url` or `image.compositeUrl` if edited
5. **Storage**: Save/load via `StorageService` and `FileManager`

## Future Enhancements

1. **Audio Track**: Add audio support
2. **Transitions**: Fade, dissolve, wipe between frames
3. **Effects**: Color correction, filters
4. **Export**: Export to MP4/WebM video file
5. **Multiple Tracks**: Support multiple video tracks
6. **Keyframes**: Animation support
7. **Titles/Text**: Add text overlays
8. **Camera Movement**: Simulate camera moves (pan, zoom, etc.)

## Notes

- Default frame duration ensures all frames in a shot are evenly distributed
- Timeline should be responsive and handle many frames efficiently
- Use requestAnimationFrame for smooth playback
- Cache frame images for performance
- Consider using Web Workers for heavy timeline calculations
