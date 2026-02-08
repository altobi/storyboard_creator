/**
 * PrevisController
 * UI controller for the previsualization workspace
 */
class PrevisController {
    constructor(app) {
        this.app = app;
        this.previsManager = null;
        this.isInitialized = false;
        this.videoTracks = []; // Array of video tracks
        this.audioTracks = []; // Array of audio tracks
        this.trackHeight = 80; // Height of each track in pixels
        this.clipTrackAssignments = new Map(); // Map of clipId -> trackId for preserving track assignments
        this.rippleEditEnabled = false; // Ripple edit mode
        this.history = []; // Undo/redo history
        this.historyIndex = -1; // Current history index
        this.maxHistorySize = 50; // Maximum history size
        this.selectedClip = null; // Currently selected clip
        this.selectedTrack = null; // Currently selected track (for deletion)
    }

    /**
     * Initialize the previs workspace
     */
    init() {
        if (this.isInitialized) return;

        // Initialize PrevisManager
        if (typeof PrevisManager !== 'undefined') {
            this.previsManager = new PrevisManager(this.app);
            
            // Set up callbacks
            this.previsManager.onTimeUpdate = (time) => {
                this.updateTimecode(time);
            };
            
            this.previsManager.onFrameChange = (clip) => {
                this.updateVideoPreview(clip);
            };
        }

        this.setupEventListeners();
        this.isInitialized = true;
    }

    /**
     * Setup event listeners for previs workspace
     */
    setupEventListeners() {
        // Playback controls
        const playBtn = document.getElementById('previzPlayBtn');
        const pauseBtn = document.getElementById('previzPauseBtn');
        const stopBtn = document.getElementById('previzStopBtn');
        const stepBackBtn = document.getElementById('previzStepBackBtn');
        const stepForwardBtn = document.getElementById('previzStepForwardBtn');

        if (playBtn) {
            playBtn.addEventListener('click', () => this.play());
        }
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pause());
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stop());
        }
        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => this.stepBackward());
        }
        if (stepForwardBtn) {
            stepForwardBtn.addEventListener('click', () => this.stepForward());
        }

        // Timeline zoom controls
        const zoomInBtn = document.getElementById('previzZoomInBtn');
        const zoomOutBtn = document.getElementById('previzZoomOutBtn');
        const zoomFitBtn = document.getElementById('previzZoomFitBtn');
        const snapToggleBtn = document.getElementById('previzSnapToggle');
        const loopBtn = document.getElementById('previzLoopBtn');
        const undoBtn = document.getElementById('previzUndoBtn');
        const redoBtn = document.getElementById('previzRedoBtn');
        const addVideoTrackBtn = document.getElementById('previzAddVideoTrackBtn');
        const addAudioTrackBtn = document.getElementById('previzAddAudioTrackBtn');
        const resizeHandle = document.getElementById('previzResizeHandle');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        if (zoomFitBtn) {
            zoomFitBtn.addEventListener('click', () => this.zoomFit());
        }
        if (snapToggleBtn) {
            snapToggleBtn.addEventListener('click', () => this.toggleSnap());
        }
        if (loopBtn) {
            loopBtn.addEventListener('click', () => this.toggleLoop());
        }
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        if (addVideoTrackBtn) {
            addVideoTrackBtn.addEventListener('click', () => this.addVideoTrack());
        }
        if (addAudioTrackBtn) {
            addAudioTrackBtn.addEventListener('click', () => this.addAudioTrack());
        }
        if (resizeHandle) {
            this.setupResizeHandle(resizeHandle);
        }
        
        // File panel toggle
        const toggleFilePanelBtn = document.getElementById('previzToggleFilePanel');
        if (toggleFilePanelBtn) {
            toggleFilePanelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFilePanel();
            });
        }
        
        // Show file panel button (when panel is hidden)
        const showFilePanelBtn = document.getElementById('previzShowFilePanelBtn');
        if (showFilePanelBtn) {
            showFilePanelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFilePanel();
            });
        }
        
        // Import audio button
        const importAudioBtn = document.getElementById('previzImportAudioBtn');
        if (importAudioBtn) {
            importAudioBtn.addEventListener('click', () => this.importAudioFile());
        }
        
        // Import video/image button
        const importImageBtn = document.getElementById('previzImportImageBtn');
        if (importImageBtn) {
            importImageBtn.addEventListener('click', () => this.importImageFile());
        }
        
        // Project file settings button
        const projectFileSettingsBtn = document.getElementById('previzProjectFileSettingsBtn');
        if (projectFileSettingsBtn) {
            projectFileSettingsBtn.addEventListener('click', () => this.showProjectFileSettingsModal());
        }
        
        // Time display toggle
        const toggleTimeDisplayBtn = document.getElementById('previzToggleTimeDisplay');
        if (toggleTimeDisplayBtn) {
            toggleTimeDisplayBtn.addEventListener('click', () => this.toggleTimeDisplay());
        }
        
        // Audio volume control
        const audioVolumeSlider = document.getElementById('previzAudioVolume');
        const volumeDisplay = document.getElementById('previzVolumeDisplay');
        if (audioVolumeSlider) {
            audioVolumeSlider.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value) / 100;
                if (this.previsManager) {
                    this.previsManager.setAudioVolume(volume);
                }
                if (volumeDisplay) {
                    volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                }
            });
        }
        
        // Initialize default audio track
        this.audioTracks.push({ id: 'audio_1', name: 'Audio 1', clips: [] });
        
        // Set snapping and loop to enabled by default
        if (this.previsManager) {
            this.previsManager.setSnapEnabled(true);
            this.previsManager.setLooping(true);
            // Update button states
            const snapBtn = document.getElementById('previzSnapToggle');
            const loopBtn = document.getElementById('previzLoopBtn');
            if (snapBtn) {
                snapBtn.classList.add('active');
                snapBtn.style.background = '#007acc';
            }
            if (loopBtn) {
                loopBtn.classList.add('active');
                loopBtn.style.background = '#007acc';
            }
            
            // Initialize undo/redo buttons
            this.updateUndoRedoButtons();
            
            // Save initial state to history after a short delay (to ensure timeline is built)
            setTimeout(() => {
                this.saveToHistory();
            }, 100);
        }
    }

    /**
     * Render the previs workspace
     */
    render() {if (!this.previsManager) {
            this.init();
        }

        // Safety check: if previsManager still doesn't exist, return early
        if (!this.previsManager || !this.previsManager.timeline) {
            console.warn('PrevisManager not initialized, cannot render');
            return;
        }

        // CRITICAL: Only build timeline from storyboard if:
        // 1. Timeline is completely empty (no saved data)
        // 2. AND we haven't just loaded timeline data from a saved project
        // This prevents overwriting saved timeline data when loading a project
        // Check if timeline data was explicitly loaded (prevents rebuild after load)
        const timelineDataWasLoaded = this.previsManager.timelineDataLoaded === true;
        
        // Check if we have external files or custom durations as indicators of saved data
        const hasExternalFiles = this.previsManager.timeline.some(c => c.isExternalFile === true);
        const hasCustomDurations = this.previsManager.timeline.some(c => c.customDuration === true);
        const hasMultipleTracks = (this.videoTracks?.length || 0) > 1 || (this.audioTracks?.length || 0) > 1;
        const hasTrackAssignments = this.clipTrackAssignments && this.clipTrackAssignments.size > 0;
        const hasClipsWithTrackIds = this.previsManager.timeline.some(c => c.trackId && c.trackId !== 'video_1');
        
        // More comprehensive check: if timeline has clips AND any indicator of saved data, don't rebuild
        const hasSavedTimelineData = timelineDataWasLoaded || 
            (this.previsManager.timeline.length > 0 && 
             (hasExternalFiles || hasCustomDurations || hasMultipleTracks || hasTrackAssignments || hasClipsWithTrackIds ||
              this.previsManager.timeline.some(c => c.startTime !== undefined && c.startTime !== null)));if (!hasSavedTimelineData && 
            (this.previsManager.timeline.length === 0 || 
             this.previsManager.timeline.filter(c => !c.isExternalFile).length === 0)) {
            // Build timeline from storyboard only if we don't have saved timeline data
            console.log('[PREVIZ] Building timeline from storyboard (no saved timeline data)');this.previsManager.buildTimelineFromStoryboard();
        } else {
            // We have saved timeline data, don't rebuild from storyboard
            console.log('[PREVIZ] Using saved timeline data, not rebuilding from storyboard', {
                timelineDataWasLoaded,
                hasExternalFiles,
                hasCustomDurations,
                hasMultipleTracks,
                hasTrackAssignments,
                hasClipsWithTrackIds,
                timelineLength: this.previsManager.timeline.length
            });
        }
        
        // Render video preview
        this.renderVideoPreview();
        
        // Preserve scroll position before rendering timeline
        const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
        const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
        
        // Render timeline
        this.renderTimeline();
        
        // Restore scroll position after rendering
        if (tracksScrollContainer && savedScrollTop > 0) {
            tracksScrollContainer.scrollTop = savedScrollTop;
        }
        
        // Render file list
        this.renderFileList();
        
        // Update controls
        this.updateControls();
    }

    /**
     * Render video preview area
     */
    renderVideoPreview() {
        const previewContainer = document.getElementById('previzVideoPreview');
        if (!previewContainer) return;

        // Clear existing content
        previewContainer.innerHTML = '';

        const clip = this.previsManager.getClipAtTime(this.previsManager.currentTime);
        // Use imageUrl if available, otherwise fall back to fileUrl for imported images
        const imageUrl = clip ? (clip.imageUrl || (clip.fileType === 'image' ? clip.fileUrl : null)) : null;

        if (imageUrl) {
            // Create image element
            const imgEl = document.createElement('img');
            imgEl.src = imageUrl;
            imgEl.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; display: block;';
            imgEl.alt = 'Current frame';
            
            // Add frame info overlay
            const infoOverlay = document.createElement('div');
            infoOverlay.style.cssText = `
                position: absolute;
                bottom: 12px;
                left: 12px;
                background: rgba(0, 0, 0, 0.8);
                color: #ccc;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                pointer-events: none;
            `;
            
            if (clip) {
                infoOverlay.innerHTML = `
                    <div><strong>Scene:</strong> ${clip.sceneNumber || '-'}</div>
                    <div><strong>Shot:</strong> ${clip.shotNumber || '-'}</div>
                    <div><strong>Frame:</strong> ${clip.frameNumber || '-'}</div>
                    <div><strong>Duration:</strong> ${clip.duration.toFixed(2)}s</div>
                `;
            }
            
            previewContainer.appendChild(imgEl);
            previewContainer.appendChild(infoOverlay);
        } else {
            // Show placeholder
            const placeholderEl = document.createElement('div');
            placeholderEl.className = 'previz-placeholder';
            placeholderEl.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #888; font-size: 14px;';
            placeholderEl.textContent = 'No frames in timeline';
            previewContainer.appendChild(placeholderEl);
        }
    }

    /**
     * Update video preview with current frame
     */
    updateVideoPreview(clip) {
        const previewContainer = document.getElementById('previzVideoPreview');
        if (!previewContainer) return;

        // Use imageUrl if available, otherwise fall back to fileUrl for imported images
        const imageUrl = clip ? (clip.imageUrl || (clip.fileType === 'image' ? clip.fileUrl : null)) : null;
        if (clip && imageUrl) {
            const img = previewContainer.querySelector('img');
            if (img) {
                img.src = imageUrl;
            } else {
                this.renderVideoPreview();
            }
            
            // Update info overlay
            const infoOverlay = previewContainer.querySelector('div[style*="position: absolute"]');
            if (infoOverlay && clip) {
                infoOverlay.innerHTML = `
                    <div><strong>Scene:</strong> ${clip.sceneNumber || '-'}</div>
                    <div><strong>Shot:</strong> ${clip.shotNumber || '-'}</div>
                    <div><strong>Frame:</strong> ${clip.frameNumber || '-'}</div>
                    <div><strong>Duration:</strong> ${clip.duration.toFixed(2)}s</div>
                `;
            }
        } else {
            // Show placeholder
            previewContainer.innerHTML = '';
            const placeholderEl = document.createElement('div');
            placeholderEl.className = 'previz-placeholder';
            placeholderEl.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #888; font-size: 14px;';
            placeholderEl.textContent = 'No frame at current time';
            previewContainer.appendChild(placeholderEl);
        }
    }


    /**
     * Helper function to preserve and restore scroll position
     */
    preserveScrollPosition(callback) {
        const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
        const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
        
        callback();
        
        // Restore scroll position after a brief delay to ensure DOM is updated
        if (tracksScrollContainer && savedScrollTop > 0) {
            setTimeout(() => {
                tracksScrollContainer.scrollTop = savedScrollTop;
            }, 0);
        }
    }

    /**
     * Render timeline
     */
    renderTimeline() {
        const timelineContainer = document.getElementById('previzTimeline');
        if (!timelineContainer || !this.previsManager) return;

        // Preserve scroll positions before clearing (both vertical and horizontal)
        const oldTracksScrollContainer = document.getElementById('previzTracksScrollContainer');
        const oldBottomScrollbar = document.getElementById('previzBottomScrollbar');
        const oldRulerContainer = document.getElementById('previzRulerContainer');
        const savedScrollTop = oldTracksScrollContainer ? oldTracksScrollContainer.scrollTop : 0;
        const savedScrollLeft = oldBottomScrollbar ? oldBottomScrollbar.scrollLeft : (oldRulerContainer ? oldRulerContainer.scrollLeft : 0);

        // Clear existing timeline
        timelineContainer.innerHTML = '';

        const timeline = this.previsManager.timeline;
        if (timeline.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'padding: 40px; text-align: center; color: #888;';
            emptyMsg.textContent = 'No frames in timeline. Add images to your storyboard first.';
            timelineContainer.appendChild(emptyMsg);
            return;
        }

        // Create timeline wrapper with scroll
        const timelineWrapper = document.createElement('div');
        timelineWrapper.className = 'previz-timeline-wrapper';
        timelineWrapper.style.cssText = 'position: relative; background: #1e1e1e; overflow: hidden; display: flex; flex-direction: column; flex: 1; min-height: 0;';
        timelineWrapper.id = 'previzTimelineWrapper';

        // Create scrollable container for tracks (vertical scroll)
        const tracksScrollContainer = document.createElement('div');
        tracksScrollContainer.className = 'previz-tracks-scroll-container';
        tracksScrollContainer.style.cssText = 'flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0;';
        tracksScrollContainer.id = 'previzTracksScrollContainer';

        // Create timecode ruler (shared across all tracks) - NO horizontal scroll here, scrollbar will be at bottom
        const rulerContainer = document.createElement('div');
        rulerContainer.style.cssText = 'position: relative; background: #1e1e1e; border-bottom: 1px solid #444; overflow-x: hidden; overflow-y: hidden; flex-shrink: 0; display: flex;';
        rulerContainer.id = 'previzRulerContainer';
        
        // Add label spacer to match track labels (80px width)
        const rulerLabelSpacer = document.createElement('div');
        rulerLabelSpacer.style.cssText = 'width: 80px; background: #1e1e1e; border-right: 1px solid #444; flex-shrink: 0;';
        rulerContainer.appendChild(rulerLabelSpacer);
        
        const ruler = this.createTimecodeRuler();
        ruler.style.cssText = 'height: 40px; position: relative; flex: 1;';
        rulerContainer.appendChild(ruler);
        timelineWrapper.appendChild(rulerContainer);

        // Create video tracks container
        const videoTracksContainer = document.createElement('div');
        videoTracksContainer.className = 'previz-video-tracks';
        videoTracksContainer.style.cssText = 'display: flex; flex-direction: column;';

        // Ensure Video Track 1 exists (for storyboard clips)
        const videoTrack1 = this.videoTracks.find(t => t.id === 'video_1' || t.trackNumber === 1);
        if (!videoTrack1) {
            // Create Video Track 1 if it doesn't exist
            this.videoTracks.push({ id: 'video_1', name: 'Video 1', clips: [], trackNumber: 1 });
        }
        
        // If no video tracks exist (shouldn't happen now, but safety check), create default one
        if (this.videoTracks.length === 0) {
            // Filter timeline to only include storyboard clips (not external files, especially not audio)
            const storyboardClipsOnly = timeline.filter(clip => !clip.isExternalFile);
            const defaultTrack = this.createVideoTrack({ id: 'video_1', name: 'Video 1', clips: [], trackNumber: 1 }, storyboardClipsOnly);
            videoTracksContainer.appendChild(defaultTrack);
            this.videoTracks.push({ id: 'video_1', name: 'Video 1', clips: [], trackNumber: 1 });
        } else {
            // Render video tracks - Video 1 (lowest number) should be at bottom, highest at top
            // Sort by trackNumber descending (highest first, so it appears on top)
            const sortedTracks = [...this.videoTracks].sort((a, b) => (b.trackNumber || 0) - (a.trackNumber || 0));
            // The track with number 1 (lowest) gets the storyboard timeline clips
            // Separate storyboard clips from external file clips
            // IMPORTANT: Only include video/image clips, explicitly exclude audio
            const storyboardClips = timeline.filter(clip => !clip.isExternalFile);
            
            const externalVideoClips = timeline.filter(clip => {
                const isExternal = clip.isExternalFile;
                const isVideoOrImage = (clip.fileType === 'video' || clip.fileType === 'image');
                const isNotAudio = clip.fileType !== 'audio';
                return isExternal && isVideoOrImage && isNotAudio;
            });
            
            sortedTracks.forEach((track) => {
                const isLowestTrack = (track.trackNumber || 1) === 1;
                
                // Get clips assigned to this track (by trackId) or default to Video 1 for storyboard clips
                const clipsForTrack = timeline.filter(clip => {
                    const isVideoOrImage = !clip.isExternalFile || (clip.fileType === 'video' || clip.fileType === 'image');
                    if (!isVideoOrImage) return false;
                    
                    // Check both clip.trackId and the assignments map
                    const clipTrackId = clip.trackId || this.clipTrackAssignments.get(clip.id);
                    
                    // If clip has a trackId, use it; otherwise assign storyboard clips to Video 1
                    if (clipTrackId) {
                        return clipTrackId === track.id;
                    } else {
                        // Default: storyboard clips go to Video 1, external clips go to Video 1
                        return isLowestTrack;
                    }
                });
                
                const trackEl = this.createVideoTrack(track, clipsForTrack);
                videoTracksContainer.appendChild(trackEl);
            });
        }

        tracksScrollContainer.appendChild(videoTracksContainer);

        // Create audio tracks container
        const audioTracksContainer = document.createElement('div');
        audioTracksContainer.className = 'previz-audio-tracks';
        audioTracksContainer.style.cssText = 'display: flex; flex-direction: column; border-top: 2px solid #555;';

        // Separate audio clips from timeline
        const audioClips = timeline.filter(clip => clip.isExternalFile && clip.fileType === 'audio');
        
        // Render audio tracks
        this.audioTracks.forEach((track, index) => {
            const trackEl = this.createAudioTrack(track, index);
            audioTracksContainer.appendChild(trackEl);
            
            // Get audio clips assigned to this track (by trackId) or default to Audio 1
            const clipsForTrack = audioClips.filter(clip => {
                // Check both clip.trackId and the assignments map
                const clipTrackId = clip.trackId || this.clipTrackAssignments.get(clip.id);
                
                if (clipTrackId) {
                    return clipTrackId === track.id;
                } else {
                    // Default: all audio clips go to first audio track
                    return index === 0;
                }
            });
            
            if (clipsForTrack.length > 0) {
                const clipsContainer = trackEl.querySelector('.previz-audio-clips-container');
                if (clipsContainer) {
                    clipsForTrack.forEach(clip => {
                        // Double-check that this IS an audio clip
                        if (clip.fileType !== 'audio') {
                            console.error(`ERROR: Non-audio clip found in audioClips!`, clip);
                            return; // Skip this clip
                        }
                        const clipEl = this.createAudioClipElement(clip);
                        clipsContainer.appendChild(clipEl);
                    });
                    // Setup interactions for this track
                    this.setupTimelineInteractions(trackEl, clipsContainer);
                }
            }
        });

        tracksScrollContainer.appendChild(audioTracksContainer);
        
        timelineWrapper.appendChild(tracksScrollContainer);
        
        // Create horizontal scrollbar at the bottom (below all tracks)
        const bottomScrollbar = document.createElement('div');
        bottomScrollbar.className = 'previz-bottom-scrollbar';
        bottomScrollbar.id = 'previzBottomScrollbar';
        bottomScrollbar.style.cssText = 'height: 17px; overflow-x: auto; overflow-y: hidden; background: #1e1e1e; border-top: 1px solid #444; flex-shrink: 0;';
        
        // Create a spacer to match track labels width
        const scrollbarSpacer = document.createElement('div');
        scrollbarSpacer.style.cssText = 'width: 80px; background: #1e1e1e; border-right: 1px solid #444; flex-shrink: 0; float: left; height: 17px;';
        bottomScrollbar.appendChild(scrollbarSpacer);
        
        // Create scrollable content area
        const scrollbarContent = document.createElement('div');
        scrollbarContent.id = 'previzScrollbarContent';
        scrollbarContent.style.cssText = 'height: 1px; min-width: 100%;';
        bottomScrollbar.appendChild(scrollbarContent);
        
        timelineWrapper.appendChild(bottomScrollbar);

        timelineContainer.appendChild(timelineWrapper);
        
        // Restore scroll positions after DOM is updated (both vertical and horizontal)
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
            const restoredContainer = document.getElementById('previzTracksScrollContainer');
            const restoredBottomScrollbar = document.getElementById('previzBottomScrollbar');
            const restoredRulerContainer = document.getElementById('previzRulerContainer');
            
            if (restoredContainer && savedScrollTop >= 0) {
                restoredContainer.scrollTop = savedScrollTop;
            }
            if (restoredBottomScrollbar && savedScrollLeft >= 0) {
                restoredBottomScrollbar.scrollLeft = savedScrollLeft;
            }
            if (restoredRulerContainer && savedScrollLeft >= 0) {
                restoredRulerContainer.scrollLeft = savedScrollLeft;
            }
        });
        
        // Setup timeline interactions for all video tracks
        const videoTracks = timelineWrapper.querySelectorAll('.previz-timeline-track');
        videoTracks.forEach(track => {
            const clipsContainer = track.querySelector('.previz-clips-container');
            if (clipsContainer) {
                this.setupTimelineInteractions(track, clipsContainer);
            }
        });
        
        // Setup timeline interactions for all audio tracks
        const audioTracks = timelineWrapper.querySelectorAll('.previz-audio-track');
        audioTracks.forEach(track => {
            const clipsContainer = track.querySelector('.previz-audio-clips-container');
            if (clipsContainer) {
                this.setupTimelineInteractions(track, clipsContainer);
            }
        });
        
        // Setup synchronized scrolling across all tracks (after tracks are created)
        setTimeout(() => {
            this.setupScrollSync();
            // Update scrollbar width after setup
            if (this.updateScrollbarWidth) {
                this.updateScrollbarWidth();
            }
        }, 0);
        
        // Update playhead position
        this.updatePlayhead();
    }

    /**
     * Create a video track
     */
    createVideoTrack(track, clips) {
        const trackContainer = document.createElement('div');
        trackContainer.className = 'previz-track-container';
        trackContainer.style.cssText = 'display: flex; border-bottom: 1px solid #333;';

        // Track label with delete button and selection
        const trackLabel = document.createElement('div');
        trackLabel.className = 'previz-track-label';
        trackLabel.style.cssText = 'width: 80px; background: #1e1e1e; border-right: 1px solid #444; padding: 8px; color: #ccc; font-size: 11px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; cursor: pointer;';
        
        const trackName = document.createElement('span');
        trackName.textContent = track.name || 'Video 1';
        trackLabel.appendChild(trackName);
        
        // Add delete button for video tracks (only if not the first track)
        const isFirstVideoTrack = (track.trackNumber || 1) === 1 || track.id === 'video_1';
        if (!isFirstVideoTrack && this.videoTracks.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.style.cssText = 'background: transparent; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;';
            deleteBtn.title = 'Delete video track';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeVideoTrack(track.id);
            });
            trackLabel.appendChild(deleteBtn);
        }
        
        // Add click handler for track selection
        trackLabel.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                // Deselect other tracks
                document.querySelectorAll('.previz-track-label').forEach(l => {
                    l.style.background = '#1e1e1e';
                });
                // Select this track
                trackLabel.style.background = '#2d2d30';
                this.selectedTrack = { type: 'video', id: track.id, track: track };
            }
        });
        
        trackContainer.appendChild(trackLabel);

        // Timeline track (no horizontal scroll - synced with ruler)
        const trackEl = document.createElement('div');
        trackEl.className = 'previz-timeline-track';
        trackEl.style.cssText = `position: relative; height: ${this.trackHeight}px; background: #252526; overflow-x: hidden; overflow-y: hidden; flex: 1;`;
        trackEl.id = track.id === 'video_1' ? 'previzTimelineTrack' : `track_${track.id}`;

        // Create clips container (positioned absolutely, moved via transform)
        const clipsContainer = document.createElement('div');
        clipsContainer.className = 'previz-clips-container';
        clipsContainer.style.cssText = 'position: absolute; top: 0; left: 0; height: 100%; width: 100%; z-index: 1;';
        
        // Calculate total width needed based ONLY on video/image clips (not audio)
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const videoClips = this.previsManager.timeline.filter(clip => 
            !clip.isExternalFile || (clip.fileType === 'video' || clip.fileType === 'image')
        );
        const maxVideoEndTime = videoClips.length > 0 
            ? Math.max(...videoClips.map(c => c.endTime || 0))
            : this.previsManager.totalDuration;
        const totalWidth = maxVideoEndTime * pixelsPerSecond;
        clipsContainer.style.width = `${Math.max(totalWidth, 1000)}px`;

        // Create clips
        let clipsAdded = 0;
        let clipsSkipped = 0;
        clips.forEach(clip => {
            // Double-check: never add audio clips to video tracks
            if (clip.fileType === 'audio') {
                console.error(`ERROR: Attempted to add audio clip to video track!`, clip);
                clipsSkipped++;
                return; // Skip audio clips
            }
            // Also skip external files that aren't video/image
            if (clip.isExternalFile && clip.fileType !== 'video' && clip.fileType !== 'image') {
                console.error(`ERROR: Attempted to add non-video/image external file to video track!`, clip);
                clipsSkipped++;
                return; // Skip non-video/image external files
            }
            const clipEl = this.createClipElement(clip);
            clipsContainer.appendChild(clipEl);
            clipsAdded++;
        });

        // Add playhead to all video tracks
        const playhead = document.createElement('div');
        playhead.className = 'previz-playhead';
        playhead.id = track.id === 'video_1' ? 'previzPlayhead' : `previzPlayhead_${track.id}`;
        playhead.style.cssText = 'position: absolute; top: 0; bottom: 0; width: 2px; background: #007acc; pointer-events: none; z-index: 10; box-shadow: 0 0 4px rgba(0, 122, 204, 0.8);';
        clipsContainer.appendChild(playhead);

        trackEl.appendChild(clipsContainer);
        trackContainer.appendChild(trackEl);
        
        // Add drop handlers for video/image files
        this.setupTrackDropHandlers(trackEl, clipsContainer, 'video');

        return trackContainer;
    }

    /**
     * Create an audio track
     */
    createAudioTrack(track, index) {
        const trackContainer = document.createElement('div');
        trackContainer.className = 'previz-track-container';
        trackContainer.style.cssText = 'display: flex; border-bottom: 1px solid #333;';

        // Track label with delete button
        const trackLabel = document.createElement('div');
        trackLabel.className = 'previz-track-label';
        trackLabel.style.cssText = 'width: 80px; background: #1e1e1e; border-right: 1px solid #444; padding: 8px; color: #888; font-size: 11px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;';
        
        const trackName = document.createElement('span');
        trackName.textContent = track.name || `Audio ${index + 1}`;
        trackLabel.appendChild(trackName);
        
        // Add delete button for audio tracks (only if not the first track and more than one exists)
        const isFirstAudioTrack = index === 0;
        if (!isFirstAudioTrack && this.audioTracks.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.style.cssText = 'background: transparent; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;';
            deleteBtn.title = 'Delete audio track';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeAudioTrack(track.id);
            });
            trackLabel.appendChild(deleteBtn);
        }
        
        // Add click handler for track selection
        trackLabel.style.cursor = 'pointer';
        trackLabel.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                // Deselect other tracks
                document.querySelectorAll('.previz-track-label').forEach(l => {
                    l.style.background = '#1e1e1e';
                });
                // Select this track
                trackLabel.style.background = '#2d2d30';
                this.selectedTrack = { type: 'audio', id: track.id, track: track };
            }
        });
        
        trackContainer.appendChild(trackLabel);

        // Audio track area (no horizontal scroll - synced with ruler)
        const trackEl = document.createElement('div');
        trackEl.className = 'previz-audio-track';
        trackEl.style.cssText = `position: relative; height: ${this.trackHeight}px; background: #1a1a1a; overflow-x: hidden; overflow-y: hidden; flex: 1;`;
        trackEl.id = `audio_track_${track.id}`;

        // Create clips container (positioned absolutely, moved via transform)
        const clipsContainer = document.createElement('div');
        clipsContainer.className = 'previz-audio-clips-container';
        clipsContainer.style.cssText = 'position: absolute; top: 0; left: 0; height: 100%; width: 100%; z-index: 1;';
        
        // Calculate total width needed based ONLY on audio clips (not video)
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const audioClips = this.previsManager.timeline.filter(clip => 
            clip.isExternalFile && clip.fileType === 'audio'
        );
        const maxAudioEndTime = audioClips.length > 0 
            ? Math.max(...audioClips.map(c => c.endTime || 0))
            : this.previsManager.totalDuration;
        const totalWidth = maxAudioEndTime * pixelsPerSecond;
        clipsContainer.style.width = `${Math.max(totalWidth, 1000)}px`;

        // Add placeholder text
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #555; font-size: 11px; pointer-events: none;';
        placeholder.textContent = 'Drop audio files here';
        clipsContainer.appendChild(placeholder);

        // Add playhead to all audio tracks
        const playhead = document.createElement('div');
        playhead.className = 'previz-playhead';
        playhead.id = index === 0 ? 'previzAudioPlayhead' : `previzAudioPlayhead_${track.id}`;
        playhead.style.cssText = 'position: absolute; top: 0; bottom: 0; width: 2px; background: #007acc; pointer-events: none; z-index: 10; box-shadow: 0 0 4px rgba(0, 122, 204, 0.8);';
        clipsContainer.appendChild(playhead);

        trackEl.appendChild(clipsContainer);
        trackContainer.appendChild(trackEl);
        
        // Add drop handlers for audio files
        this.setupTrackDropHandlers(trackEl, clipsContainer, 'audio');

        return trackContainer;
    }

    /**
     * Setup drop handlers for tracks
     */
    setupTrackDropHandlers(trackEl, clipsContainer, trackType) {
        trackEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            trackEl.style.background = trackType === 'video' ? '#2a2a52' : '#2a522a';
        });
        
        trackEl.addEventListener('dragleave', () => {
            trackEl.style.background = trackType === 'video' ? '#252526' : '#1a1a1a';
        });
        
        trackEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling to parent elements
            trackEl.style.background = trackType === 'video' ? '#252526' : '#1a1a1a';
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                const file = data.file;
                const fileType = data.fileType;
                
                // Validate file type matches track type
                if (trackType === 'video' && fileType !== 'image' && fileType !== 'video') {
                    console.warn(`Rejected: video track but fileType is ${fileType}`);
                    alert('Only image and video files can be dropped on video tracks');
                    return;
                }
                if (trackType === 'audio' && fileType !== 'audio') {
                    console.warn(`Rejected: audio track but fileType is ${fileType}`);
                    alert('Only audio files can be dropped on audio tracks');
                    return;
                }
                
                // Find which track this is by finding the track container and matching track ID
                let targetTrackId = null;
                if (trackType === 'video') {
                    const trackContainer = trackEl.closest('.previz-track-container');
                    if (trackContainer) {
                        const trackLabel = trackContainer.querySelector('.previz-track-label');
                        if (trackLabel) {
                            // Extract track number from label (e.g., "Video 1" -> "video_1")
                            const labelText = trackLabel.textContent.trim();
                            const match = labelText.match(/Video\s+(\d+)/i);
                            if (match) {
                                const trackNumber = parseInt(match[1]);
                                targetTrackId = `video_${trackNumber}`;
                            }
                        }
                        // Fallback: try to match by track element ID
                        if (!targetTrackId) {
                            const trackIdFromEl = trackEl.id;
                            const matchingTrack = this.videoTracks.find(t => 
                                (trackIdFromEl === 'previzTimelineTrack' && t.id === 'video_1') || 
                                (trackIdFromEl === `track_${t.id}`)
                            );
                            if (matchingTrack) {
                                targetTrackId = matchingTrack.id;
                            }
                        }
                    }
                    
                    // If dropping custom image on Video 1, move it to Video Track 2 (create if needed)
                    if (targetTrackId === 'video_1' && fileType === 'image') {
                        // Check if Video Track 2 already exists
                        const videoTrack2 = this.videoTracks.find(t => t.id === 'video_2' || t.trackNumber === 2);
                        if (!videoTrack2) {
                            // Create Video Track 2 automatically
                            const newTrack = {
                                id: 'video_2',
                                name: 'Video 2',
                                clips: [],
                                trackNumber: 2
                            };
                            this.videoTracks.unshift(newTrack); // Add to beginning (top of list)
                            targetTrackId = 'video_2';
                        } else {
                            // Video Track 2 exists, use it
                            targetTrackId = videoTrack2.id;
                        }
                    }
                    // If dropping on any track above Video 1, just use that track (no special handling needed)
                } else if (trackType === 'audio') {
                    const trackContainer = trackEl.closest('.previz-track-container');
                    if (trackContainer) {
                        const allAudioTracks = Array.from(document.querySelectorAll('.previz-audio-track'));
                        const trackIndex = allAudioTracks.indexOf(trackEl);
                        if (trackIndex >= 0 && this.audioTracks[trackIndex]) {
                            targetTrackId = this.audioTracks[trackIndex].id;
                        }
                    }
                }
                
                // Calculate drop position
                const rect = trackEl.getBoundingClientRect();
                const rulerContainer = document.getElementById('previzRulerContainer');
                const scrollLeft = rulerContainer ? rulerContainer.scrollLeft : 0;
                const x = e.clientX - rect.left + scrollLeft;
                const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                const dropTime = Math.max(0, x / pixelsPerSecond);
                
                // Add file to timeline at drop position with target track ID
                this.addFileToTimeline(file, trackType, dropTime, targetTrackId).catch(err => {
                    console.error('Error adding file to timeline:', err);
                });
            } catch (err) {
                console.error('Error handling drop:', err);
            }
        });
    }

    /**
     * Add file to timeline at specified time
     * @param {object} file - The file to add
     * @param {string} trackType - 'video' or 'audio'
     * @param {number} startTime - Start time in seconds
     * @param {string} targetTrackId - Optional: specific track ID to add to (for video tracks above Video 1)
     */
    async addFileToTimeline(file, trackType, startTime, targetTrackId = null) {
        if (!this.previsManager) return;
        
        
        // Don't rebuild timeline from storyboard - just add the new clip
        // This preserves existing clips
        
        // Get actual file type from file extension, not trackType
        const actualFileType = this.getFileType(file.name || file.originalName || '');
        console.log(`[addFileToTimeline DEBUG] Detected file type: ${actualFileType} from filename: ${file.name || file.originalName || ''}`);
        
        // Ensure file type matches track type
        if (trackType === 'audio' && actualFileType !== 'audio') {
            console.warn(`[addFileToTimeline DEBUG] File type mismatch: audio track but file is not audio (detected: ${actualFileType})`);
            return;
        }
        if (trackType === 'video' && actualFileType !== 'image' && actualFileType !== 'video') {
            console.warn(`[addFileToTimeline DEBUG] File type mismatch: video track but file is not image/video (detected: ${actualFileType})`);
            return;
        }
        
        const frameRate = this.app.project.settings?.frameRate || 24;
        let duration = 2.0; // Default 2 seconds
        
        // For audio files, get the actual duration from the audio file
        if (actualFileType === 'audio') {
            if (file.duration && file.duration > 0) {
                duration = file.duration;
            } else {
                // Try to get duration by loading the audio file
                try {
                    duration = await this.getAudioDuration(file);
                } catch (error) {
                    console.warn(`Could not get audio duration, using default:`, error);
                    duration = 5.0; // Default 5 seconds for audio
                }
            }
        }
        
        // For video tracks: if targetTrackId is provided and it's above Video 1, ensure the track exists
        if (trackType === 'video' && targetTrackId && targetTrackId !== 'video_1') {
            const trackExists = this.videoTracks.some(t => t.id === targetTrackId);
            if (!trackExists) {
                // Extract track number from targetTrackId (e.g., "video_2" -> 2)
                const match = targetTrackId.match(/video_(\d+)/);
                if (match) {
                    const trackNumber = parseInt(match[1]);
                    // Only create if it's the next sequential track (don't create gaps)
                    const maxTrackNumber = this.videoTracks.length > 0 
                        ? Math.max(...this.videoTracks.map(t => t.trackNumber || 1))
                        : 1;
                    // Only create if trackNumber is maxTrackNumber + 1 (next sequential)
                    if (trackNumber === maxTrackNumber + 1) {
                        // Create the track
                        const newTrack = {
                            id: targetTrackId,
                            name: `Video ${trackNumber}`,
                            clips: [],
                            trackNumber: trackNumber
                        };
                        // Insert at the beginning (top of list, since tracks are sorted descending)
                        this.videoTracks.unshift(newTrack);
                    } else {
                        // Track number doesn't match next sequential, use existing highest track + 1
                        const actualTrackNumber = maxTrackNumber + 1;
                        const actualTrackId = `video_${actualTrackNumber}`;
                        const newTrack = {
                            id: actualTrackId,
                            name: `Video ${actualTrackNumber}`,
                            clips: [],
                            trackNumber: actualTrackNumber
                        };
                        this.videoTracks.unshift(newTrack);
                        targetTrackId = actualTrackId; // Update to use the created track
                    }
                }
            }
        }
        
        // Create clip object
        const clipId = `clip_${actualFileType}_${file.name || file.id || Date.now()}_${startTime}`;
        const fileUrl = file.url || file.dataUrl || '';
        const clip = {
            id: clipId,
            fileId: file.name || file.id,
            fileUrl: fileUrl,
            fileType: actualFileType, // Use actual file type, not trackType
            fileName: file.name || file.originalName || 'Unknown',
            startTime: startTime,
            duration: duration,
            endTime: startTime + duration,
            sceneNumber: '',
            shotNumber: '',
            frameNumber: '',
            thumbnail: fileUrl,
            imageUrl: actualFileType === 'image' ? fileUrl : undefined, // Set imageUrl for imported images so preview works
            customDuration: true, // User-added clips have custom duration
            isExternalFile: true, // Mark as external file (not from storyboard)
            trackId: targetTrackId || (trackType === 'video' ? 'video_1' : (this.audioTracks[0]?.id)), // Assign to target track
            // Audio trim offsets (for audio clips only)
            audioStartOffset: actualFileType === 'audio' ? 0 : undefined, // Start offset in the original audio file (seconds)
            audioEndOffset: actualFileType === 'audio' ? duration : undefined, // End offset in the original audio file (seconds)
            originalAudioDuration: actualFileType === 'audio' ? duration : undefined // Store original audio duration for reference
        };
        
        // Save track assignment
        if (clip.trackId) {
            this.clipTrackAssignments.set(clip.id, clip.trackId);
        }
        
        // Save to history before adding
        this.saveToHistory();
        
        // Add to timeline (don't rebuild - preserve existing clips)
        this.previsManager.timeline.push(clip);// DON'T recalculate timeline positions here - it will move external clips!
        // Only update total duration if needed
        const maxEndTime = Math.max(...this.previsManager.timeline.map(c => c.endTime || 0));
        // Use actual max end time with small fixed buffer (1 second or 5%, whichever is smaller)
        const buffer = Math.min(1.0, maxEndTime * 0.05);
        this.previsManager.totalDuration = maxEndTime + buffer;
        // Re-render timeline
        this.renderTimeline();
        
        // Mark project as changed
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }

    /**
     * Create timecode ruler
     */
    createTimecodeRuler() {
        const ruler = document.createElement('div');
        ruler.className = 'previz-timeline-ruler';
        ruler.style.cssText = 'position: relative; height: 40px; background: #1e1e1e; cursor: pointer;';
        ruler.id = 'previzRuler';

        const rulerContent = document.createElement('div');
        rulerContent.className = 'previz-ruler-content';
        rulerContent.style.cssText = 'position: relative; height: 100%; min-width: 100%;';

        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const totalDuration = this.previsManager.totalDuration;
        const totalWidth = totalDuration * pixelsPerSecond;
        rulerContent.style.width = `${Math.max(totalWidth, 1000)}px`;

        // Draw timecode marks with more granular intervals and more labels
        const interval = this.getRulerInterval();
        const subInterval = interval / 10; // 10 sub-marks between main marks for finer granularity
        
        for (let time = 0; time <= totalDuration; time += subInterval) {
            const isMainMark = Math.abs(time % interval) < 0.01; // Check if it's a main mark
            const isSecondaryMark = Math.abs(time % (interval / 2)) < 0.01 && !isMainMark; // Half-interval marks
            const mark = document.createElement('div');
            const left = time * pixelsPerSecond;
            
            if (isMainMark) {
                // Main mark with label
                mark.style.cssText = `position: absolute; left: ${left}px; top: 0; bottom: 0; width: 1px; background: #666;`;
                
                const label = document.createElement('div');
                label.style.cssText = 'position: absolute; left: 4px; top: 4px; color: #888; font-size: 10px; font-family: monospace; white-space: nowrap; pointer-events: none;';
                
                if (this.previsManager.timeDisplayMode === 'frames') {
                    const frames = Math.round(time * this.previsManager.frameRate);
                    label.textContent = `${frames}`;
                } else {
                    label.textContent = this.previsManager.formatTimecode(time);
                }
                mark.appendChild(label);
            } else if (isSecondaryMark) {
                // Secondary mark (medium size, with optional label if space allows)
                mark.style.cssText = `position: absolute; left: ${left}px; top: 25%; bottom: 0; width: 1px; background: #555;`;
                
                // Add label for secondary marks if zoomed in enough
                if (this.previsManager.zoomLevel >= 2) {
                    const label = document.createElement('div');
                    label.style.cssText = 'position: absolute; left: 2px; top: 2px; color: #666; font-size: 9px; font-family: monospace; white-space: nowrap; pointer-events: none;';
                    
                    if (this.previsManager.timeDisplayMode === 'frames') {
                        const frames = Math.round(time * this.previsManager.frameRate);
                        label.textContent = `${frames}`;
                    } else {
                        label.textContent = this.previsManager.formatTimecode(time);
                    }
                    mark.appendChild(label);
                }
            } else {
                // Sub mark (smallest)
                mark.style.cssText = `position: absolute; left: ${left}px; top: 50%; bottom: 0; width: 1px; background: #444;`;
            }
            
            rulerContent.appendChild(mark);
        }

        // Add playhead line to ruler
        const playhead = document.createElement('div');
        playhead.className = 'previz-ruler-playhead';
        playhead.id = 'previzRulerPlayhead';
        playhead.style.cssText = 'position: absolute; top: 0; bottom: 0; width: 2px; background: #007acc; pointer-events: auto; cursor: ew-resize; z-index: 20; box-shadow: 0 0 4px rgba(0, 122, 204, 0.8);';
        rulerContent.appendChild(playhead);

        // Make entire ruler content draggable - clicking anywhere snaps and grabs playhead
        let isDraggingPlayhead = false;
        
        // Make ruler content itself draggable
        rulerContent.style.cursor = 'ew-resize';
        rulerContent.addEventListener('mousedown', (e) => {
            // Don't interfere with playhead if clicking directly on it
            if (e.target === playhead || playhead.contains(e.target)) {
                return;
            }
            
            e.stopPropagation();
            e.preventDefault();
            isDraggingPlayhead = true;
            
            // Immediately seek to clicked position
            const rulerContainer = document.getElementById('previzRulerContainer');
            const bottomScrollbar = document.getElementById('previzBottomScrollbar');
            const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
            
            const rulerContentRect = rulerContent.getBoundingClientRect();
            const x = e.clientX - rulerContentRect.left + scrollLeft;
            const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
            let time = Math.max(0, Math.min(x / pixelsPerSecond, this.previsManager.totalDuration));
            
            // Apply snapping if enabled
            if (this.previsManager.snapEnabled) {
                time = this.previsManager.snapTime(time);
            }
            
            this.previsManager.seek(time);
            this.updateVideoPreview(this.previsManager.getClipAtTime(this.previsManager.currentTime));
            this.updatePlayhead();
        });

        // Also make playhead draggable
        playhead.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDraggingPlayhead = true;
        });

        // Use requestAnimationFrame for smooth playhead dragging
        let playheadAnimationFrame = null;

        const playheadMouseMove = (e) => {
            if (!isDraggingPlayhead) return;
            
            // Cancel any pending animation frame
            if (playheadAnimationFrame) {
                cancelAnimationFrame(playheadAnimationFrame);
            }
            
            // Schedule update for next frame
            playheadAnimationFrame = requestAnimationFrame(() => {
                const rulerContainer = document.getElementById('previzRulerContainer');
                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                const scrollTarget = bottomScrollbar || rulerContainer;
                let scrollLeft = scrollTarget ? scrollTarget.scrollLeft : 0;
                
                // Calculate position relative to ruler content (accounting for label spacer)
                // Use rulerContent instead of ruler for accurate positioning
                const rulerContentRect = rulerContent.getBoundingClientRect();
                const x = e.clientX - rulerContentRect.left + scrollLeft;
                const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                let time = Math.max(0, Math.min(x / pixelsPerSecond, this.previsManager.totalDuration));
                
                // Apply snapping if enabled
                if (this.previsManager.snapEnabled) {
                    time = this.previsManager.snapTime(time);
                }
                
                // Auto-scroll if playhead is dragged outside visible area
                if (scrollTarget) {
                    const playheadX = time * pixelsPerSecond;
                    const containerRect = scrollTarget.getBoundingClientRect();
                    const visibleLeft = scrollLeft;
                    const visibleRight = scrollLeft + containerRect.width;
                    const scrollPadding = 100; // Pixels to keep playhead from edge
                    
                    if (playheadX < visibleLeft + scrollPadding) {
                        // Scroll left
                        scrollTarget.scrollLeft = Math.max(0, playheadX - scrollPadding);
                    } else if (playheadX > visibleRight - scrollPadding) {
                        // Scroll right
                        scrollTarget.scrollLeft = playheadX - containerRect.width + scrollPadding;
                    }
                    
                    // Update scrollLeft after potential auto-scroll
                    scrollLeft = scrollTarget.scrollLeft;
                }
                
                this.previsManager.seek(time);
                this.updateVideoPreview(this.previsManager.getClipAtTime(this.previsManager.currentTime));
                this.updatePlayhead();
            });
        };

        const playheadMouseUp = () => {
            isDraggingPlayhead = false;
        };

        document.addEventListener('mousemove', playheadMouseMove);
        document.addEventListener('mouseup', playheadMouseUp);

        ruler.appendChild(rulerContent);
        return ruler;
    }

    /**
     * Setup synchronized horizontal scrolling across all tracks
     * Only the ruler container scrolls horizontally, tracks sync to it
     */
    setupScrollSync() {
        const rulerContainer = document.getElementById('previzRulerContainer');
        const tracks = document.querySelectorAll('.previz-timeline-track, .previz-audio-track');
        const clipsContainers = document.querySelectorAll('.previz-clips-container, .previz-audio-clips-container');
        
        if (!rulerContainer) return;
        
        let isScrolling = false;

        const syncScroll = (scrollLeft) => {
            if (isScrolling) return;
            isScrolling = true;

            // Sync all clip containers (they move, not the tracks)
            clipsContainers.forEach(container => {
                container.style.transform = `translateX(-${scrollLeft}px)`;
            });

            setTimeout(() => {
                isScrolling = false;
            }, 10);
        };

        // Sync bottom scrollbar scroll to tracks and ruler
        const bottomScrollbar = document.getElementById('previzBottomScrollbar');
        if (bottomScrollbar) {
            bottomScrollbar.addEventListener('scroll', () => {
                syncScroll(bottomScrollbar.scrollLeft);
            });
        }
        
        // Also sync ruler if it somehow gets scrolled (though it shouldn't have scrollbar)
        rulerContainer.addEventListener('scroll', () => {
            syncScroll(rulerContainer.scrollLeft);
        });
        
        // Enable scrollwheel on timeline wrapper - scroll horizontally by default
        const timelineWrapper = document.getElementById('previzTimelineWrapper');
        if (timelineWrapper) {
            timelineWrapper.addEventListener('wheel', (e) => {
                // Always scroll horizontally on timeline (unless shift is held for vertical)
                if (!e.shiftKey) {
                    e.preventDefault();
                    const scrollTarget = bottomScrollbar || rulerContainer;
                    if (scrollTarget) {
                        // Use deltaY for vertical wheel scrolling, deltaX for horizontal trackpad scrolling
                        scrollTarget.scrollLeft += e.deltaX || e.deltaY;
                    }
                }
                // If shift is held, allow vertical scrolling (default behavior)
            });
        }
        
        // Update scrollbar content width to match timeline width
        const updateScrollbarWidth = () => {
            const scrollbarContent = document.getElementById('previzScrollbarContent');
            const rulerContent = document.querySelector('.previz-ruler-content');
            if (scrollbarContent) {
                // Match the ruler content width exactly
                if (rulerContent) {
                    const rulerWidth = rulerContent.offsetWidth || rulerContent.getBoundingClientRect().width;
                    scrollbarContent.style.width = `${rulerWidth}px`;
                } else {
                    // Fallback: calculate from duration
                    const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                    const maxEndTime = this.previsManager.totalDuration;
                    const totalWidth = maxEndTime * pixelsPerSecond;
                    // Add small buffer to ensure we can scroll to the end
                    scrollbarContent.style.width = `${Math.max(totalWidth + 20, 1000)}px`;
                }
            }
        };
        
        // Update scrollbar width initially (with a small delay to ensure ruler is rendered)
        setTimeout(() => {
            updateScrollbarWidth();
        }, 10);
        
        // Update scrollbar width when timeline is re-rendered (which happens on zoom)
        // This will be called from renderTimeline
        this.updateScrollbarWidth = updateScrollbarWidth;
    }

    /**
     * Get appropriate interval for ruler marks based on zoom level
     */
    getRulerInterval() {
        const zoom = this.previsManager.zoomLevel;
        const totalDuration = this.previsManager.totalDuration;
        
        // Adjust interval based on zoom and total duration
        // For longer timelines, use larger intervals
        if (totalDuration > 300) { // > 5 minutes
            if (zoom >= 10) return 5; // 5 second marks
            if (zoom >= 5) return 10; // 10 second marks
            if (zoom >= 2) return 30; // 30 second marks
            if (zoom >= 1) return 60; // 1 minute marks
            return 120; // 2 minute marks
        } else if (totalDuration > 60) { // > 1 minute
            if (zoom >= 10) return 1; // 1 second marks
            if (zoom >= 5) return 5; // 5 second marks
            if (zoom >= 2) return 10; // 10 second marks
            if (zoom >= 1) return 30; // 30 second marks
            return 60; // 1 minute marks
        } else { // <= 1 minute
            if (zoom >= 10) return 0.5; // 0.5 second marks
            if (zoom >= 5) return 1; // 1 second marks
            if (zoom >= 2) return 5; // 5 second marks
            if (zoom >= 1) return 10; // 10 second marks
            return 30; // 30 second marks
        }
    }

    /**
     * Setup timeline interactions (scrubbing, drag, resize)
     */
    setupTimelineInteractions(track, clipsContainer) {
        let isDragging = false;
        let dragType = null; // 'scrub', 'move', 'resize-left', 'resize-right'
        let dragClip = null;
        let dragStartX = 0;
        let dragStartTime = 0;
        let dragStartDuration = 0;
        let lastPreviewTime = 0; // Store the last preview time (with snapping applied)
        let dragTrack = null; // Store the track element where dragging started
        let dragTrackInitialRect = null; // Store the track's initial bounding rect at drag start

        // Store last click position for delete empty space
        let lastClickPosition = { x: 0, time: 0 };
        
        // Rectangle selection (drag to select) or single click to seek
        let selectionStartX = 0;
        let selectionStartY = 0;
        let selectionRect = null;
        
        track.addEventListener('mousedown', (e) => {
            // Don't select if clicking on clips or resize handles
            if (e.target.classList.contains('previz-clip') || 
                e.target.closest('.previz-clip') ||
                e.target.classList.contains('previz-audio-clip') ||
                e.target.closest('.previz-audio-clip') ||
                e.target.classList.contains('previz-resize-handle') ||
                e.target.closest('.previz-resize-handle')) {
                return; // Let clip handlers deal with it
            }

            // Store click position for delete empty space
            const rect = track.getBoundingClientRect();
            const rulerContainer = document.getElementById('previzRulerContainer');
            const scrollLeft = rulerContainer ? rulerContainer.scrollLeft : 0;
            const clickX = e.clientX - rect.left + scrollLeft;
            const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
            lastClickPosition.x = clickX;
            lastClickPosition.time = clickX / pixelsPerSecond;

            // Store selection start position
            selectionStartX = e.clientX;
            selectionStartY = e.clientY;
            
            // Clear previous selection
            clipsContainer.querySelectorAll('.previz-clip.selected, .previz-audio-clip.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Remove any existing selection rectangle
            if (selectionRect) {
                selectionRect.remove();
                selectionRect = null;
            }

            isDragging = true;
            dragType = 'select'; // Changed from 'scrub' to 'select'
        });
        
        // Handle keyboard events for deleting clips and empty space
        // Use document-level listener to catch keydown even when track doesn't have focus
        const keydownHandler = (e) => {
            // Only handle if we're in the previz workspace and key is Delete/Backspace
            if (this.app.activeWorkspace !== 'previz') return;
            
            // Check if we're clicking on a track or clip container
            const target = e.target;
            const isInTimeline = target.closest('.previz-timeline-container') || 
                                 target.closest('.previz-timeline-track') ||
                                 target.closest('.previz-audio-track') ||
                                 target.closest('.previz-clips-container');
            
            if (!isInTimeline) return;
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                
                // First check if a track is selected
                if (this.selectedTrack) {
                    if (this.selectedTrack.type === 'audio') {
                        this.removeAudioTrack(this.selectedTrack.id);
                    } else if (this.selectedTrack.type === 'video') {
                        this.removeVideoTrack(this.selectedTrack.id);
                    }
                    return;
                }
                
                // Check if any clips are selected (search in all track containers)
                const allClipsContainers = document.querySelectorAll('.previz-clips-container, .previz-audio-clips-container');
                let selectedClipEls = [];
                allClipsContainers.forEach(container => {
                    const selected = container.querySelectorAll('.previz-clip.selected, .previz-audio-clip.selected');
                    selectedClipEls.push(...Array.from(selected));
                });
                
                if (selectedClipEls.length > 0) {
                    // Delete all selected clips
                    selectedClipEls.forEach(selectedClipEl => {
                        const clipId = selectedClipEl.dataset.clipId;
                        const clip = this.previsManager.timeline.find(c => c.id === clipId);
                        if (clip) {
                            this.deleteClipFromTimeline(clip);
                        }
                    });
                } else {
                    // Use stored click position for deleting empty space
                    const fakeEvent = { clientX: lastClickPosition.x };
                    this.handleDeleteEmptySpace(fakeEvent, track, clipsContainer, lastClickPosition.time);
                }
            }
        };
        
        // Add document-level listener (only once per track setup)
        document.addEventListener('keydown', keydownHandler);
        
        // Make track focusable for keyboard events
        track.setAttribute('tabindex', '0');
        
        // Single click on empty space to seek (only if no drag occurred)
        track.addEventListener('click', (e) => {
            if (!e.target.classList.contains('previz-clip') && 
                !e.target.closest('.previz-clip') &&
                !e.target.classList.contains('previz-audio-clip') &&
                !e.target.closest('.previz-audio-clip') &&
                !e.target.classList.contains('previz-resize-handle') &&
                !e.target.closest('.previz-resize-handle')) {
                track.focus();
                
                // Only seek if this was a click (not a drag)
                if (dragType === 'select' && Math.abs(e.clientX - selectionStartX) < 5 && Math.abs(e.clientY - selectionStartY) < 5) {
                    // Single click - seek to position
                    const rect = track.getBoundingClientRect();
                    const rulerContainer = document.getElementById('previzRulerContainer');
                    const scrollLeft = rulerContainer ? rulerContainer.scrollLeft : 0;
                    const clickX = e.clientX - rect.left + scrollLeft;
                    const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                    const seekTime = clickX / pixelsPerSecond;
                    this.previsManager.seek(seekTime);
                    this.updateControls();
                }
            }
        });

        // Track mouse movement to distinguish clicks from drags
        let mouseDownX = 0;
        let mouseDownY = 0;
        let hasMoved = false;
        let dragMouseOffsetX = 0; // Mouse offset within the clip when dragging starts
        const DRAG_THRESHOLD = 5; // pixels - minimum movement to consider it a drag

        // Clip interactions
        clipsContainer.addEventListener('mousedown', (e) => {
            const clipEl = e.target.closest('.previz-clip, .previz-audio-clip');
            if (!clipEl) return;

            const clipId = clipEl.dataset.clipId;
            const clip = this.previsManager.timeline.find(c => c.id === clipId);
            if (!clip) return;

            // Store initial mouse position
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            hasMoved = false;

            // Check if clicking on resize handle
            if (e.target.classList.contains('previz-resize-handle-left')) {
                isDragging = true;
                dragType = 'resize-left';
                dragClip = clip;
                dragStartX = e.clientX;
                dragStartTime = clip.startTime;
                dragStartDuration = clip.duration;
                e.stopPropagation();
                return;
            }

            if (e.target.classList.contains('previz-resize-handle-right')) {
                isDragging = true;
                dragType = 'resize-right';
                dragClip = clip;
                dragStartX = e.clientX;
                dragStartTime = clip.startTime;
                dragStartDuration = clip.duration;
                e.stopPropagation();
                return;
            }

            // Prepare for potential drag, but don't set isDragging yet
            dragType = 'move';
            dragClip = clip;
            dragStartX = e.clientX;
            dragStartTime = clip.startTime;
            dragTrack = track; // Store the track element where dragging started
            dragTrackInitialRect = track.getBoundingClientRect(); // Store the track's initial bounding rect
            
            // Calculate mouse offset within the clip (so it doesn't jump to left edge)
            // Store as screen coordinate offset (independent of track position)
            const clipRect = clipEl.getBoundingClientRect();
            dragMouseOffsetX = e.clientX - clipRect.left; // Offset in screen pixels from clip's left edge
            
            e.stopPropagation();
        });
        
        // Double-click on clip to open settings
        clipsContainer.addEventListener('dblclick', (e) => {
            const clipEl = e.target.closest('.previz-clip, .previz-audio-clip');
            if (!clipEl) return;
            
            // Don't open settings if clicking on resize handles
            if (e.target.classList.contains('previz-resize-handle-left') ||
                e.target.classList.contains('previz-resize-handle-right')) {
                return;
            }
            
            const clipId = clipEl.dataset.clipId;
            const clip = this.previsManager.timeline.find(c => c.id === clipId);
            if (!clip) return;
            
            e.stopPropagation();
            this.showClipSettingsModal(clip);
        });
        
        // Click on clip to select (without dragging)
        clipsContainer.addEventListener('click', (e) => {
            // Only select if not dragging and not clicking on resize handles
            if (isDragging) return;
            const clipEl = e.target.closest('.previz-clip, .previz-audio-clip');
            if (clipEl && !e.target.classList.contains('previz-resize-handle-left') && 
                !e.target.classList.contains('previz-resize-handle-right')) {
                const clipId = clipEl.dataset.clipId;
                const clip = this.previsManager.timeline.find(c => c.id === clipId);
                if (clip) {
                    this.selectClip(clipEl, clip);
                }
            }
        });

        // Throttle scrub updates for performance
        let scrubAnimationFrame = null;
        let lastScrubTime = 0;
        const scrubThrottle = 16; // ~60fps
        
        // Mouse move handler
        document.addEventListener('mousemove', (e) => {
            // Check if mouse has moved enough to be considered a drag
            if (dragClip && !hasMoved && (dragType === 'move' || dragType === 'resize-left' || dragType === 'resize-right')) {
                const deltaX = Math.abs(e.clientX - mouseDownX);
                const deltaY = Math.abs(e.clientY - mouseDownY);
                if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                    hasMoved = true;
                    if (dragType === 'move') {
                        isDragging = true; // Only set isDragging after movement threshold
                    }
                }
            }

            if (!isDragging && dragType !== 'select') return;

            const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
            const deltaX = e.clientX - dragStartX;
            const deltaTime = deltaX / pixelsPerSecond;

            if (dragType === 'select') {
                // Rectangle selection
                const rect = track.getBoundingClientRect();
                const left = Math.min(selectionStartX, e.clientX) - rect.left;
                const top = Math.min(selectionStartY, e.clientY) - rect.top;
                const width = Math.abs(e.clientX - selectionStartX);
                const height = Math.abs(e.clientY - selectionStartY);
                
                // Create or update selection rectangle
                if (!selectionRect) {
                    selectionRect = document.createElement('div');
                    selectionRect.className = 'previz-selection-rect';
                    selectionRect.style.cssText = `
                        position: absolute;
                        border: 2px dashed #4a9eff;
                        background: rgba(74, 158, 255, 0.1);
                        pointer-events: none;
                        z-index: 1000;
                    `;
                    track.style.position = 'relative';
                    track.appendChild(selectionRect);
                }
                
                selectionRect.style.left = left + 'px';
                selectionRect.style.top = top + 'px';
                selectionRect.style.width = width + 'px';
                selectionRect.style.height = height + 'px';
                
                // Select clips that intersect with the selection rectangle
                const selectionRectBounds = {
                    left: selectionStartX,
                    top: selectionStartY,
                    right: e.clientX,
                    bottom: e.clientY
                };
                
                clipsContainer.querySelectorAll('.previz-clip, .previz-audio-clip').forEach(clipEl => {
                    const clipRect = clipEl.getBoundingClientRect();
                    const intersects = !(
                        clipRect.right < Math.min(selectionRectBounds.left, selectionRectBounds.right) ||
                        clipRect.left > Math.max(selectionRectBounds.left, selectionRectBounds.right) ||
                        clipRect.bottom < Math.min(selectionRectBounds.top, selectionRectBounds.bottom) ||
                        clipRect.top > Math.max(selectionRectBounds.top, selectionRectBounds.bottom)
                    );
                    
                    if (intersects) {
                        clipEl.classList.add('selected');} else {
                        clipEl.classList.remove('selected');
                    }
                });} else if (dragType === 'move' && dragClip && dragTrack) {
                // Find which track the mouse is currently over
                let currentTrack = dragTrack; // Default to original track
                const allTracks = document.querySelectorAll(dragClip.fileType === 'audio' ? '.previz-audio-track' : '.previz-timeline-track');
                
                // Find the track that contains the mouse position
                for (const trackEl of allTracks) {
                    const rect = trackEl.getBoundingClientRect();
                    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        currentTrack = trackEl;
                        break;
                    }
                }
                
                // Show visual preview of new position (don't actually move yet)
                // Calculate position based on mouse position relative to the current track
                // Account for mouse offset within the clip
                const trackRect = currentTrack.getBoundingClientRect();
                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                const rulerContainer = document.getElementById('previzRulerContainer');
                const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                
                // Calculate new position accounting for mouse offset within clip
                const x = e.clientX - trackRect.left + scrollLeft - dragMouseOffsetX;
                let newStartTime = Math.max(0, x / pixelsPerSecond);
                
                // Apply snapping if enabled (pass the clip being moved so it only snaps to same-type clips)
                // Audio clips can snap when snap tool is enabled, but only when very close
                if (this.previsManager.snapEnabled) {
                    newStartTime = this.previsManager.snapTime(newStartTime, dragClip);
                }
                
                lastPreviewTime = newStartTime; // Store the snapped position
                // Show preview on the current track
                this.showClipDragPreview(dragClip, newStartTime, currentTrack);
            } else if (dragType === 'resize-left' && dragClip) {
                // Auto-scroll when dragging near edges
                this.handleAutoScroll(e);
                
                // Find the track element for this clip
                const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                if (!clipEl) return;
                const trackContainer = clipEl.closest('.previz-audio-track, .previz-timeline-track');
                if (!trackContainer) return;
                
                // Calculate mouse position relative to track, accounting for scroll
                const trackRect = trackContainer.getBoundingClientRect();
                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                const rulerContainer = document.getElementById('previzRulerContainer');
                const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                
                // Calculate new start time based on mouse delta from drag start
                // dragStartX is where the mouse was when drag started (at left edge of clip)
                // This approach is independent of track position and scroll, works even when far from viewport
                const mouseDeltaX = e.clientX - dragStartX; // Delta in screen pixels
                const timeDelta = mouseDeltaX / pixelsPerSecond; // Convert to time
                let newStartTime = dragStartTime + timeDelta;
                newStartTime = Math.max(0, newStartTime);
                
                
                // Calculate new duration (clip end time stays the same, start moves)
                const clipEndTime = dragStartTime + dragStartDuration;
                let newDuration = clipEndTime - newStartTime;
                
                // Enforce minimum duration to prevent clips from becoming too small
                if (newDuration < 0.1) {
                    newDuration = 0.1;
                    newStartTime = clipEndTime - 0.1;
                }
                
                
                // For audio clips, don't use snapTime (only edge-to-edge snapping in moveClip)
                // For video clips, apply snapping if enabled
                if (this.previsManager.snapEnabled && dragClip.fileType !== 'audio') {
                    newStartTime = this.previsManager.snapTime(newStartTime, dragClip);
                    newDuration = clipEndTime - newStartTime;
                }
                
                if (newDuration > 0.1 && newStartTime >= 0) {
                    // Update visual position during drag (don't re-render entire timeline)
                    const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                    if (clipEl) {
                        clipEl.style.left = `${newStartTime * pixelsPerSecond}px`;
                        clipEl.style.width = `${newDuration * pixelsPerSecond}px`;
                    }
                }
            } else if (dragType === 'resize-right' && dragClip) {
                // Auto-scroll when dragging near edges
                this.handleAutoScroll(e);
                
                // Find the track element for this clip
                const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                if (!clipEl) return;
                const trackContainer = clipEl.closest('.previz-audio-track, .previz-timeline-track');
                if (!trackContainer) return;
                
                // Calculate mouse position relative to track, accounting for scroll
                const trackRect = trackContainer.getBoundingClientRect();
                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                const rulerContainer = document.getElementById('previzRulerContainer');
                const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                
                // Calculate new end time based on mouse delta from drag start
                // dragStartX is where the mouse was when drag started (at right edge of clip)
                // This approach is independent of track position and scroll, works even when far from viewport
                const mouseDeltaX = e.clientX - dragStartX; // Delta in screen pixels
                const timeDelta = mouseDeltaX / pixelsPerSecond; // Convert to time
                let newEndTime = (dragStartTime + dragStartDuration) + timeDelta;
                newEndTime = Math.max(dragStartTime + 0.1, newEndTime); // Minimum 0.1s duration
                
                // Calculate new duration (clip start time stays the same, end moves)
                let newDuration = newEndTime - dragStartTime;
                
                // Enforce minimum duration to prevent clips from becoming too small
                if (newDuration < 0.1) {
                    newDuration = 0.1;
                    newEndTime = dragStartTime + 0.1;
                }
                
                
                // For audio clips, don't use snapTime (only edge-to-edge snapping in moveClip)
                // For video clips, apply snapping if enabled
                if (this.previsManager.snapEnabled && dragClip.fileType !== 'audio') {
                    const snappedEndTime = this.previsManager.snapTime(newEndTime, dragClip);
                    newDuration = snappedEndTime - dragStartTime;
                }
                
                if (newDuration > 0.1) {
                    // Update visual position during drag (don't re-render entire timeline)
                    const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                    if (clipEl) {
                        clipEl.style.width = `${newDuration * pixelsPerSecond}px`;
                    }
                }
            }
        });

        // Mouse up handler
        const mouseUpHandler = (e) => {
            // Handle selection rectangle cleanup
            if (dragType === 'select') {
                // Remove selection rectangle
                if (selectionRect) {
                    selectionRect.remove();
                    selectionRect = null;
                }
                
                // If it was a click (no movement), seek instead
                if (Math.abs(e.clientX - selectionStartX) < 5 && Math.abs(e.clientY - selectionStartY) < 5) {
                    // Single click - already handled in click handler
                } else {
                    // Selection complete - clips are already selected
                    // Mark project as changed if selection changed
                    const selectedClips = clipsContainer.querySelectorAll('.previz-clip.selected, .previz-audio-clip.selected');
                    if (selectedClips.length > 0) {
                        this.app.markChanged();
                    }
                }
                
                // Reset drag state
                isDragging = false;
                dragType = null;
                return;
            }
            
            // If it was a click (no movement), select the clip instead of moving it
            if (dragClip && dragType === 'move' && !hasMoved) {
                const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                if (clipEl) {
                    this.selectClip(clipEl, dragClip);
                }
                // Reset drag state
                isDragging = false;
                dragType = null;
                dragClip = null;
                dragTrack = null;
                dragTrackInitialRect = null;
                hasMoved = false;
                dragMouseOffsetX = 0;
                return;
            }

            if (isDragging && dragType === 'move' && dragClip && dragTrack) {
                // Calculate final position from mouse position
                const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                
                // Try to find which track the mouse is currently over (in case user dragged to a different track)
                let targetTrack = dragTrack; // Default to original track
                const allTracks = document.querySelectorAll(dragClip.fileType === 'audio' ? '.previz-audio-track' : '.previz-timeline-track');
                
                // Find the track that contains the mouse position
                for (const trackEl of allTracks) {
                    const rect = trackEl.getBoundingClientRect();
                    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        targetTrack = trackEl;
                        break;
                    }
                }
                
                // CRITICAL: Use the stored initial track rect for X position calculation
                // This avoids issues with getBoundingClientRect() returning invalid values during drag
                // The track's position relative to viewport shouldn't change during drag (only scroll changes)
                // We account for scroll changes separately
                const trackRect = dragTrackInitialRect || dragTrack.getBoundingClientRect();
                
                
                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                const rulerContainer = document.getElementById('previzRulerContainer');
                const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                
                // Calculate where the mouse is within the clip (in screen coordinates)
                const mouseInClipScreenX = e.clientX - dragMouseOffsetX;
                
                // Convert to track-relative coordinates
                const clipLeftEdgeOnTrack = mouseInClipScreenX - trackRect.left + scrollLeft;
                
                // Convert to time
                let newStartTime = Math.max(0, clipLeftEdgeOnTrack / pixelsPerSecond);
                
                
                // Find the track ID from the track element FIRST (before snapping)
                // This ensures the clip has the correct trackId when snapTime is called
                let newTrackId = null;
                if (dragClip.fileType === 'audio') {
                    // Find which audio track this is by matching the track element ID
                    const trackId = targetTrack.id;
                    // Audio tracks have IDs like 'audio_track_audio_1', 'audio_track_audio_2', etc.
                    // Extract the track ID from the element ID
                    if (trackId && trackId.startsWith('audio_track_')) {
                        const extractedId = trackId.replace('audio_track_', '');
                        // Find matching track in audioTracks array
                        const matchingTrack = this.audioTracks.find(t => t.id === extractedId);
                        if (matchingTrack) {
                            newTrackId = matchingTrack.id;
                        }
                    }
                    // Fallback: find by index if ID matching fails
                    if (!newTrackId) {
                        const allAudioTracks = Array.from(document.querySelectorAll('.previz-audio-track'));
                        const trackIndex = allAudioTracks.indexOf(targetTrack);
                        if (trackIndex >= 0 && this.audioTracks[trackIndex]) {
                            newTrackId = this.audioTracks[trackIndex].id;
                        }
                    }
                } else {
                    // Find which video track this is by matching the track ID
                    const trackContainer = targetTrack.closest('.previz-track-container');
                    if (trackContainer) {
                        const trackEl = trackContainer.querySelector('.previz-timeline-track');
                        if (trackEl) {
                            const trackId = trackEl.id;
                            // Match track ID to video track
                            const matchingTrack = this.videoTracks.find(t => 
                                (trackId === 'previzTimelineTrack' && t.id === 'video_1') || 
                                (trackId === `track_${t.id}`)
                            );
                            if (matchingTrack) {
                                newTrackId = matchingTrack.id;
                            }
                        }
                    }
                }
                
                // Update clip's trackId temporarily for snapping (if it changed tracks)
                // This ensures snapTime uses the correct trackId
                const originalTrackId = dragClip.trackId;
                if (newTrackId && newTrackId !== dragClip.trackId) {
                    dragClip.trackId = newTrackId;
                }
                
                // For audio clips, only apply edge-to-edge snapping on the same track (handled in moveClip)
                // Don't use snapTime for audio clips as it snaps to frames and other clips
                // Video clips still use snapTime normally
                const timeBeforeSnap = newStartTime;
                if (this.previsManager.snapEnabled && dragClip.fileType !== 'audio') {
                    newStartTime = this.previsManager.snapTime(newStartTime, dragClip);
                }
                
                // Restore original trackId if we temporarily changed it (we'll set it properly later)
                if (newTrackId && newTrackId !== originalTrackId) {
                    dragClip.trackId = originalTrackId;
                }
                
                const deltaTime = newStartTime - dragStartTime;
                
                // Check if clip moved to a different track
                // Check both clip.trackId and the assignments map
                const savedTrackId = this.clipTrackAssignments.get(dragClip.id);
                const currentTrackId = dragClip.trackId || savedTrackId || (dragClip.fileType === 'audio' ? (this.audioTracks[0]?.id) : (this.videoTracks.find(t => t.trackNumber === 1)?.id));
                const movedToDifferentTrack = newTrackId && newTrackId !== currentTrackId;
                
                // Only move if clip actually moved in time or to a different track
                if (Math.abs(deltaTime) > 0.1 || movedToDifferentTrack) {
                    // For audio clips, don't show the move modal (they can move freely)
                    if (dragClip.fileType === 'audio') {
                        
                        // Save to history before moving
                        this.saveToHistory();
                        // Move the audio clip directly (this may delete overlapping clips)
                        const moveResult = this.previsManager.moveClip(dragClip.id, newStartTime);
                        
                        // Check if overlapping clips were modified (trimmed/split) (for logging)
                        const movedClip = this.previsManager.timeline.find(c => c.id === dragClip.id);
                        if (movedClip && movedClip._overlappingClipsModified) {
                            delete movedClip._overlappingClipsModified; // Clean up flag
                        }
                        
                        
                        // Always update track assignment (even if same track, to ensure it's saved)
                        if (newTrackId) {
                            dragClip.trackId = newTrackId;
                            this.clipTrackAssignments.set(dragClip.id, newTrackId);
                        }
                        // Only render timeline once on mouseup, not during drag
                        this.renderTimeline();
                        // Mark project as changed
                        this.app.markChanged();
                        this.app.storageService.saveToStorage(false);
                    } else {
                        // For video clips: only show modal for storyboard clips (not external files)
                        // External files (custom images) can move freely without modal
                        if (dragClip.isExternalFile) {
                            // External file - move directly without modal
                            this.saveToHistory();
                            this.previsManager.moveClip(dragClip.id, newStartTime);
                            // Update track assignment if moved to different track
                            if (newTrackId) {
                                dragClip.trackId = newTrackId;
                                this.clipTrackAssignments.set(dragClip.id, newTrackId);
                            }
                            this.renderTimeline();
                            // Mark project as changed
                            this.app.markChanged();
                            this.app.storageService.saveToStorage(false);
                        } else {
                            // Storyboard clip - show modal to update scene/shot/frame numbers
                            // Store track assignment to preserve it through the modal
                            const trackIdToAssign = newTrackId || (dragClip.trackId || this.clipTrackAssignments.get(dragClip.id));
                            if (trackIdToAssign) {
                                this.clipTrackAssignments.set(dragClip.id, trackIdToAssign);
                            }
                            this.showMoveClipModal(dragClip, newStartTime, trackIdToAssign);
                        }
                    }
                } else {
                    // Reset if barely moved
                    this.renderTimeline();
                }
            }
            
            if (isDragging) {
                // Commit resize changes on mouseup
                if ((dragType === 'resize-left' || dragType === 'resize-right') && dragClip) {
                    // Calculate final position based on mouse position, accounting for scroll
                    // Find the track element for this clip
                    const clipEl = document.querySelector(`[data-clip-id="${dragClip.id}"]`);
                    if (clipEl) {
                        // Find the track container
                        const trackContainer = clipEl.closest('.previz-audio-track, .previz-timeline-track');
                        if (trackContainer) {
                            const trackRect = trackContainer.getBoundingClientRect();
                            const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                            const rulerContainer = document.getElementById('previzRulerContainer');
                            const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                            const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                            
                            // Use mouse delta from drag start (independent of track/scroll position)
                            const mouseDeltaX = e.clientX - dragStartX; // Delta in screen pixels
                            const timeDelta = mouseDeltaX / pixelsPerSecond; // Convert to time
                            let newStartTime, newDuration;
                            
                            if (dragType === 'resize-left') {
                                // Left edge: add delta to start time
                                newStartTime = dragStartTime + timeDelta;
                                newStartTime = Math.max(0, newStartTime);
                                const clipEndTime = dragStartTime + dragStartDuration;
                                newDuration = clipEndTime - newStartTime;
                                
                                // Enforce minimum duration
                                if (newDuration < 0.1) {
                                    newDuration = 0.1;
                                    newStartTime = clipEndTime - 0.1;
                                }
                            } else {
                                // Right edge: add delta to end time
                                newStartTime = dragStartTime;
                                const newEndTime = (dragStartTime + dragStartDuration) + timeDelta;
                                newDuration = Math.max(0.1, newEndTime - dragStartTime);
                            }
                            
                            
                            if (newDuration >= 0.1 && newStartTime >= 0) {
                                const durationChange = newDuration - dragStartDuration;
                                const startTimeChange = newStartTime - dragStartTime;
                                
                                
                                // Ripple edit: move all clips after this one forward/backward (only for video clips)
                                if (this.rippleEditEnabled && dragClip.fileType !== 'audio') {
                                    if (dragType === 'resize-left') {
                                        this.rippleEditClips(dragClip, startTimeChange, 'left');
                                    } else {
                                        this.rippleEditClips(dragClip, durationChange, 'right');
                                    }
                                }
                                
                                // Save to history before making changes
                                this.saveToHistory();
                                
                                // For audio clips, update audio trim offsets when resizing
                                // audioStartOffset = time in original audio file where this clip segment starts
                                // audioEndOffset = time in original audio file where this clip segment ends
                                if (dragClip.fileType === 'audio') {
                                    const currentClip = this.previsManager.timeline.find(c => c.id === dragClip.id);
                                    if (currentClip) {
                                        // Initialize audio offsets if not present (first time, no trimming)
                                        if (currentClip.audioStartOffset === undefined) {
                                            currentClip.audioStartOffset = 0;
                                        }
                                        if (currentClip.audioEndOffset === undefined) {
                                            // Get original audio duration if available, otherwise use current duration
                                            currentClip.audioEndOffset = currentClip.originalAudioDuration || currentClip.duration;
                                        }
                                        
                                        // Store original audio duration if not set (use the larger of current duration or audioEndOffset)
                                        if (!currentClip.originalAudioDuration) {
                                            currentClip.originalAudioDuration = Math.max(currentClip.audioEndOffset || currentClip.duration, currentClip.duration);
                                        }
                                        
                                        // Ensure audioEndOffset is at least as large as originalAudioDuration initially
                                        if (currentClip.audioEndOffset > currentClip.originalAudioDuration) {
                                            currentClip.audioEndOffset = currentClip.originalAudioDuration;
                                        }
                                        
                                        // The key insight: audioEndOffset should always equal audioStartOffset + clip.duration
                                        // This represents the trimmed segment in the original audio file
                                        // When we resize, we update audioStartOffset (for left) or clip.duration changes (for right)
                                        // Then we recalculate audioEndOffset = audioStartOffset + newDuration
                                        
                                        if (dragType === 'resize-left') {
                                            // Resizing from left: moving start forward trims beginning of audio
                                            // startTimeChange is positive when moving start forward (trimming more)
                                            // This means we skip more of the beginning, so audioStartOffset increases
                                            const oldStartOffset = currentClip.audioStartOffset || 0;
                                            currentClip.audioStartOffset = oldStartOffset + startTimeChange;
                                            currentClip.audioStartOffset = Math.max(0, currentClip.audioStartOffset);
                                            
                                            // Recalculate audioEndOffset based on new duration
                                            // audioEndOffset = audioStartOffset + newDuration (the trimmed segment)
                                            currentClip.audioEndOffset = currentClip.audioStartOffset + newDuration;
                                            
                                            // Don't allow it to go beyond original audio duration
                                            if (currentClip.originalAudioDuration) {
                                                currentClip.audioEndOffset = Math.min(currentClip.originalAudioDuration, currentClip.audioEndOffset);
                                                // If we hit the limit, adjust audioStartOffset back
                                                if (currentClip.audioEndOffset - currentClip.audioStartOffset < 0.1) {
                                                    currentClip.audioStartOffset = Math.max(0, currentClip.audioEndOffset - 0.1);
                                                }
                                            }
                                        } else {
                                            // Resizing from right: making clip shorter trims end of audio
                                            // The clip duration is changing, so audioEndOffset should be recalculated
                                            // audioEndOffset = audioStartOffset + newDuration (the trimmed segment)
                                            const audioStartOffset = currentClip.audioStartOffset || 0;
                                            currentClip.audioEndOffset = audioStartOffset + newDuration;
                                            
                                            // Don't allow it to go beyond original audio duration
                                            if (currentClip.originalAudioDuration) {
                                                currentClip.audioEndOffset = Math.min(currentClip.originalAudioDuration, currentClip.audioEndOffset);
                                                // If we hit the limit, the newDuration might need adjustment, but that's handled by the duration validation above
                                            }
                                        }
                                        
                                    }
                                }
                                
                                this.previsManager.updateClipDuration(dragClip.id, newDuration);
                                if (dragType === 'resize-left') {
                                    this.previsManager.moveClip(dragClip.id, newStartTime);
                                }
                                
                                // Preserve scroll positions (both vertical and horizontal)
                                const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
                                const bottomScrollbar = document.getElementById('previzBottomScrollbar');
                                const rulerContainer = document.getElementById('previzRulerContainer');
                                const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
                                const savedScrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
                                
                                this.renderTimeline();
                                
                                // Restore scroll positions (use requestAnimationFrame to ensure renderTimeline completed)
                                requestAnimationFrame(() => {
                                    const restoredTracksContainer = document.getElementById('previzTracksScrollContainer');
                                    const restoredBottomScrollbar = document.getElementById('previzBottomScrollbar');
                                    const restoredRulerContainer = document.getElementById('previzRulerContainer');
                                    
                                    if (restoredTracksContainer && savedScrollTop >= 0) {
                                        restoredTracksContainer.scrollTop = savedScrollTop;
                                    }
                                    if (restoredBottomScrollbar && savedScrollLeft >= 0) {
                                        restoredBottomScrollbar.scrollLeft = savedScrollLeft;
                                    }
                                    if (restoredRulerContainer && savedScrollLeft >= 0) {
                                        restoredRulerContainer.scrollLeft = savedScrollLeft;
                                    }
                                });
                                
                                // Regenerate waveform for audio clips after resize
                                // Use requestAnimationFrame to ensure renderTimeline() has completed
                                if (dragClip && dragClip.fileType === 'audio') {
                                    const clipIdToUpdate = dragClip.id; // Store clip ID before dragClip might be cleared
                                    // Use double requestAnimationFrame to ensure renderTimeline and scroll restoration completed
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            const updatedClip = this.previsManager.timeline.find(c => c.id === clipIdToUpdate);
                                            if (updatedClip) {
                                                // Find clip element - search in all tracks
                                                const clipEl = document.querySelector(`[data-clip-id="${updatedClip.id}"]`);
                                                if (clipEl) {
                                                    const canvas = clipEl.querySelector('canvas');
                                                    if (canvas && updatedClip.fileUrl && updatedClip.duration > 0) {
                                                        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
                                                        const clipWidth = Math.max(updatedClip.duration * pixelsPerSecond, 20);
                                                        this.generateWaveform(updatedClip.fileUrl, canvas, clipWidth, updatedClip.audioStartOffset, updatedClip.audioEndOffset).catch(err => {
                                                            console.warn('Failed to regenerate waveform after resize:', err);
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    });
                                }
                                
                                // Sync with shot list (only for storyboard clips)
                                if (!dragClip.isExternalFile) {
                                    this.syncDurationToShotList(dragClip);
                                }
                                
                                // Mark project as changed
                                this.app.markChanged();
                                this.app.storageService.saveToStorage(false);
                            } else {
                                // Invalid resize, restore original position
                                this.renderTimeline();
                            }
                        } else {
                            // Couldn't find track container, restore original position
                            this.renderTimeline();
                        }
                    }
                }
                
                isDragging = false;
                dragType = null;
                dragClip = null;
                dragTrack = null; // Clear track reference
                dragTrackInitialRect = null;
                hasMoved = false;
                dragMouseOffsetX = 0;
                this.hideClipDragPreview();
            }
        };
        
        // Add mouseup listener to document (only once per track setup)
        document.addEventListener('mouseup', mouseUpHandler);
    }

    /**
     * Handle timeline scrubbing
     */
    handleTimelineScrub(e, track, clipsContainer) {
        const rect = track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        // Get scroll position from bottom scrollbar (preferred) or ruler container
        const bottomScrollbar = document.getElementById('previzBottomScrollbar');
        const rulerContainer = document.getElementById('previzRulerContainer');
        const scrollLeft = bottomScrollbar ? bottomScrollbar.scrollLeft : (rulerContainer ? rulerContainer.scrollLeft : 0);
        
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        let time = (x + scrollLeft) / pixelsPerSecond;
        
        
        // Apply snapping if enabled
        if (this.previsManager.snapEnabled) {
            time = this.previsManager.snapTime(time);
        }
        
        const clampedTime = Math.max(0, Math.min(time, this.previsManager.totalDuration));
        this.previsManager.seek(clampedTime);
        this.updateVideoPreview(this.previsManager.getClipAtTime(this.previsManager.currentTime));
        this.updatePlayhead();
    }

    /**
     * Create clip element for timeline
     */
    createClipElement(clip) {
        const clipEl = document.createElement('div');
        clipEl.className = 'previz-clip';
        clipEl.dataset.clipId = clip.id;
        clipEl.dataset.fileType = clip.fileType || 'unknown'; // Store file type for debugging
        
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const left = clip.startTime * pixelsPerSecond;
        const width = Math.max(clip.duration * pixelsPerSecond, 20); // Minimum 20px width

        clipEl.style.cssText = `
            position: absolute;
            left: ${left}px;
            width: ${width}px;
            height: 100%;
            background: #252526;
            border: 1px solid #555;
            border-radius: 2px;
            cursor: move;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        `;

        // Add thumbnail or content based on clip type
        if (clip.isExternalFile && clip.fileType === 'audio') {
            // Audio clip - show waveform or icon
            const audioIcon = document.createElement('div');
            audioIcon.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1a3a1a; color: #4CAF50; font-size: 10px;';
            audioIcon.innerHTML = '<i data-lucide="music" style="width: 20px; height: 20px;"></i>';
            clipEl.appendChild(audioIcon);
            
            // Add file name label
            const label = document.createElement('div');
            label.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; color: #ccc; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(0,0,0,0.5); padding: 2px 4px; border-radius: 2px;';
            label.textContent = clip.fileName || 'Audio';
            clipEl.appendChild(label);
        } else if (clip.isExternalFile && (clip.fileType === 'video' || clip.fileType === 'image')) {
            // External video/image clip
            if (clip.fileType === 'image') {
                const thumbnail = document.createElement('img');
                thumbnail.src = clip.fileUrl || clip.thumbnail || '';
                thumbnail.style.cssText = 'width: 100%; height: 100%; object-fit: cover; opacity: 0.7; pointer-events: none;';
                thumbnail.alt = clip.fileName || 'Image';
                clipEl.appendChild(thumbnail);
            } else {
                // Video - show video icon or first frame
                const videoIcon = document.createElement('div');
                videoIcon.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #3a1a1a; color: #FF5722; font-size: 10px;';
                videoIcon.innerHTML = '<i data-lucide="video" style="width: 20px; height: 20px;"></i>';
                clipEl.appendChild(videoIcon);
            }
            
            // Add file name label
            const label = document.createElement('div');
            label.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; color: #ccc; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(0,0,0,0.5); padding: 2px 4px; border-radius: 2px;';
            label.textContent = clip.fileName || 'File';
            clipEl.appendChild(label);
        } else {
            // Storyboard image clip
            const thumbnail = document.createElement('img');
            thumbnail.src = clip.thumbnail || clip.imageUrl;
            thumbnail.style.cssText = 'width: 100%; height: 100%; object-fit: cover; opacity: 0.7; pointer-events: none;';
            thumbnail.alt = `Scene ${clip.sceneNumber} Shot ${clip.shotNumber} Frame ${clip.frameNumber}`;
            clipEl.appendChild(thumbnail);
            
            // Add clip label for storyboard clips only
            const label = document.createElement('div');
            label.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.8); color: #ccc; font-size: 10px; padding: 2px 4px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; pointer-events: none;';
            label.textContent = `${clip.sceneNumber}/${clip.shotNumber}/${clip.frameNumber}`;
            clipEl.appendChild(label);
        }

        // Add duration label
        if (width > 60) {
            const durationLabel = document.createElement('div');
            durationLabel.style.cssText = 'position: absolute; top: 2px; right: 4px; color: #888; font-size: 9px; font-family: monospace; pointer-events: none;';
            durationLabel.textContent = `${clip.duration.toFixed(1)}s`;
            clipEl.appendChild(durationLabel);
        }

        // Add resize handles (always add, but make them wider for small clips)
        const handleWidth = width < 40 ? Math.max(8, width / 5) : 4; // Wider handles for small clips
        // Left resize handle
        const resizeLeft = document.createElement('div');
        resizeLeft.className = 'previz-resize-handle previz-resize-handle-left';
        resizeLeft.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: ${handleWidth}px;
            background: rgba(0, 122, 204, 0.5);
            cursor: ew-resize;
            z-index: 5;
        `;
        clipEl.appendChild(resizeLeft);

        // Right resize handle
        const resizeRight = document.createElement('div');
        resizeRight.className = 'previz-resize-handle previz-resize-handle-right';
        resizeRight.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: ${handleWidth}px;
            background: rgba(0, 122, 204, 0.5);
            cursor: ew-resize;
            z-index: 5;
        `;
        clipEl.appendChild(resizeRight);

        // Hover effect
        clipEl.addEventListener('mouseenter', () => {
            clipEl.style.borderColor = '#007acc';
            clipEl.style.boxShadow = '0 0 8px rgba(0, 122, 204, 0.5)';
        });

        clipEl.addEventListener('mouseleave', () => {
            clipEl.style.borderColor = '#555';
            clipEl.style.boxShadow = 'none';
        });

        // Click handler (only if not dragging)
        let clickTime = 0;
        clipEl.addEventListener('mousedown', (e) => {
            clickTime = Date.now();
        });

        clipEl.addEventListener('click', (e) => {
            // Only seek if it was a quick click (not a drag)
            if (Date.now() - clickTime < 200) {
                this.seekToClip(clip);
            }
        });

        return clipEl;
    }

    /**
     * Create audio clip element
     */
    createAudioClipElement(clip) {
        const clipEl = document.createElement('div');
        clipEl.className = 'previz-audio-clip';
        clipEl.dataset.clipId = clip.id;
        
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const left = clip.startTime * pixelsPerSecond;
        const width = Math.max(clip.duration * pixelsPerSecond, 20);
        
        clipEl.style.cssText = `
            position: absolute;
            left: ${left}px;
            width: ${width}px;
            height: 100%;
            background: #1a3a1a;
            border: 1px solid #4CAF50;
            border-radius: 2px;
            cursor: move;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        `;
        
        // Create canvas for waveform
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
        clipEl.appendChild(canvas);
        
        // Generate waveform asynchronously
        if (clip.fileUrl) {
            const audioStartOffset = clip.audioStartOffset !== undefined ? clip.audioStartOffset : 0;
            const audioEndOffset = clip.audioEndOffset !== undefined ? clip.audioEndOffset : null;
            this.generateWaveform(clip.fileUrl, canvas, width, audioStartOffset, audioEndOffset).catch(err => {
                console.warn('Failed to generate waveform:', err);
                // Fallback to icon if waveform generation fails
                const audioIcon = document.createElement('div');
                audioIcon.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #4CAF50; z-index: 2;';
                audioIcon.innerHTML = '<i data-lucide="music" style="width: 16px; height: 16px;"></i>';
                clipEl.appendChild(audioIcon);
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        } else {
            // Fallback to icon if no file URL
            const audioIcon = document.createElement('div');
            audioIcon.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #4CAF50; z-index: 2;';
            audioIcon.innerHTML = '<i data-lucide="music" style="width: 16px; height: 16px;"></i>';
            clipEl.appendChild(audioIcon);
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
        
        // File name label
        const label = document.createElement('div');
        label.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; color: #ccc; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(0,0,0,0.5); padding: 2px 4px; border-radius: 2px; z-index: 3;';
        label.textContent = clip.fileName || 'Audio';
        clipEl.appendChild(label);
        
        // Add resize handles if wide enough
        if (width > 40) {
            // Left resize handle
            const resizeLeft = document.createElement('div');
            resizeLeft.className = 'previz-resize-handle previz-resize-handle-left';
            resizeLeft.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                background: rgba(76, 175, 80, 0.5);
                cursor: ew-resize;
                z-index: 5;
            `;
            clipEl.appendChild(resizeLeft);
            
            // Right resize handle
            const resizeRight = document.createElement('div');
            resizeRight.className = 'previz-resize-handle previz-resize-handle-right';
            resizeRight.style.cssText = `
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                background: rgba(76, 175, 80, 0.5);
                cursor: ew-resize;
                z-index: 5;
            `;
            clipEl.appendChild(resizeRight);
        }
        
        // Hover effect
        clipEl.addEventListener('mouseenter', () => {
            clipEl.style.borderColor = '#4CAF50';
            clipEl.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
        });
        
        clipEl.addEventListener('mouseleave', () => {
            clipEl.style.borderColor = '#4CAF50';
            clipEl.style.boxShadow = 'none';
        });
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        return clipEl;
    }

    /**
     * Handle auto-scroll when dragging near timeline edges
     */
    handleAutoScroll(e) {
        const timelineWrapper = document.getElementById('previzTimelineWrapper');
        const bottomScrollbar = document.getElementById('previzBottomScrollbar');
        if (!timelineWrapper || !bottomScrollbar) return;
        
        const wrapperRect = timelineWrapper.getBoundingClientRect();
        const scrollThreshold = 50; // pixels from edge to trigger scroll
        const scrollSpeed = 10; // pixels to scroll per frame
        
        // Check if mouse is near left edge
        if (e.clientX < wrapperRect.left + scrollThreshold) {
            const currentScroll = bottomScrollbar.scrollLeft;
            const newScroll = Math.max(0, currentScroll - scrollSpeed);
            bottomScrollbar.scrollLeft = newScroll;
            
            // Also update ruler container if it exists
            const rulerContainer = document.getElementById('previzRulerContainer');
            if (rulerContainer) {
                rulerContainer.scrollLeft = newScroll;
            }
        }
        // Check if mouse is near right edge
        else if (e.clientX > wrapperRect.right - scrollThreshold) {
            const currentScroll = bottomScrollbar.scrollLeft;
            const maxScroll = bottomScrollbar.scrollWidth - bottomScrollbar.clientWidth;
            const newScroll = Math.min(maxScroll, currentScroll + scrollSpeed);
            bottomScrollbar.scrollLeft = newScroll;
            
            // Also update ruler container if it exists
            const rulerContainer = document.getElementById('previzRulerContainer');
            if (rulerContainer) {
                rulerContainer.scrollLeft = newScroll;
            }
        }
    }

    /**
     * Seek to specific clip
     */
    seekToClip(clip) {
        if (!this.previsManager) return;
        this.previsManager.seek(clip.startTime);
        this.updatePlayhead();
    }

    /**
     * Update playhead position
     */
    updatePlayhead() {
        if (!this.previsManager) return;

        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const left = this.previsManager.currentTime * pixelsPerSecond;

        // Update playhead in all video tracks
        const videoPlayheads = document.querySelectorAll('.previz-playhead[id^="previzPlayhead"]');
        videoPlayheads.forEach(playhead => {
            playhead.style.left = `${left}px`;
        });

        // Update playhead in ruler
        const rulerPlayhead = document.getElementById('previzRulerPlayhead');
        if (rulerPlayhead) {
            rulerPlayhead.style.left = `${left}px`;
        }

        // Update playhead in all audio tracks
        const audioPlayheads = document.querySelectorAll('.previz-playhead[id^="previzAudioPlayhead"]');
        audioPlayheads.forEach(playhead => {
            playhead.style.left = `${left}px`;
        });

        // Auto-scroll to keep playhead visible during playback
        const rulerContainer = document.getElementById('previzRulerContainer');
        if (rulerContainer && this.previsManager.isPlaying) {
            const containerRect = rulerContainer.getBoundingClientRect();
            const scrollLeft = rulerContainer.scrollLeft;
            const visibleLeft = left;
            const visibleRight = visibleLeft + containerRect.width;

            // Scroll if playhead is near edges
            if (visibleLeft < scrollLeft + 100) {
                rulerContainer.scrollLeft = Math.max(0, visibleLeft - 100);
            } else if (visibleLeft > scrollLeft + containerRect.width - 100) {
                rulerContainer.scrollLeft = visibleLeft - containerRect.width + 100;
            }
        }
    }

    /**
     * Update timecode display
     */
    updateTimecode(time) {
        const timecodeEl = document.getElementById('previzTimecode');
        if (timecodeEl && this.previsManager) {
            timecodeEl.textContent = this.previsManager.formatTimecode(time);
        }
        this.updatePlayhead();
    }

    /**
     * Update playback controls
     */
    updateControls() {
        const playBtn = document.getElementById('previzPlayBtn');
        const pauseBtn = document.getElementById('previzPauseBtn');
        
        if (this.previsManager && this.previsManager.isPlaying) {
            if (playBtn) playBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-flex';
        } else {
            if (playBtn) playBtn.style.display = 'inline-flex';
            if (pauseBtn) pauseBtn.style.display = 'none';
        }
    }

    /**
     * Playback control methods
     */
    play() {
        if (!this.previsManager) return;
        this.previsManager.play();
        this.updateControls();
    }

    pause() {
        if (!this.previsManager) return;
        this.previsManager.pause();
        this.updateControls();
    }

    stop() {
        if (!this.previsManager) return;
        this.previsManager.stop();
        this.updateControls();
        // Show frame at current time, not at time 0
        this.updateVideoPreview(this.previsManager.getClipAtTime(this.previsManager.currentTime));
        this.updatePlayhead();
    }

    stepForward() {
        if (!this.previsManager) return;
        this.previsManager.stepForward();
    }

    stepBackward() {
        if (!this.previsManager) return;
        this.previsManager.stepBackward();
    }

    /**
     * Show visual preview of clip being dragged
     */
    showClipDragPreview(clip, newStartTime, targetTrack = null) {
        // Remove existing preview
        this.hideClipDragPreview();
        
        // Find the correct clips container based on clip type and target track
        let clipsContainer = null;
        if (targetTrack) {
            // Use the target track's clips container
            clipsContainer = targetTrack.querySelector(clip.fileType === 'audio' ? '.previz-audio-clips-container' : '.previz-clips-container');
        }
        
        // Fallback to finding any container of the correct type
        if (!clipsContainer) {
            if (clip.fileType === 'audio') {
                clipsContainer = document.querySelector('.previz-audio-clips-container');
            } else {
                clipsContainer = document.querySelector('.previz-clips-container');
            }
        }
        
        if (!clipsContainer) {
            console.warn(`Could not find clips container for clip type: ${clip.fileType}`);
            return;
        }

        const preview = document.createElement('div');
        preview.className = 'previz-clip-drag-preview';
        preview.dataset.previewFor = clip.id;
        preview.dataset.previewType = clip.fileType; // Store clip type for hiding
        
        const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
        const left = newStartTime * pixelsPerSecond;
        const width = clip.duration * pixelsPerSecond;

        preview.style.cssText = `
            position: absolute;
            left: ${left}px;
            width: ${width}px;
            height: 100%;
            background: rgba(0, 122, 204, 0.3);
            border: 2px dashed #007acc;
            border-radius: 2px;
            pointer-events: none;
            z-index: 20;
        `;

        clipsContainer.appendChild(preview);
    }

    /**
     * Hide clip drag preview
     */
    hideClipDragPreview() {
        const preview = document.querySelector('.previz-clip-drag-preview');
        if (preview) preview.remove();
    }

    /**
     * Show modal to confirm clip move with scene/shot/frame number suggestions
     */
    async showMoveClipModal(clip, newStartTime, newTrackId = null) {
        // Find where this clip would be positioned
        const timeline = this.previsManager.timeline;
        const sortedTimeline = [...timeline].sort((a, b) => a.startTime - b.startTime);
        
        // Find the clip that would be before the new position
        let insertIndex = 0;
        for (let i = 0; i < sortedTimeline.length; i++) {
            if (sortedTimeline[i].id === clip.id) continue;
            if (sortedTimeline[i].startTime < newStartTime) {
                insertIndex = i + 1;
            } else {
                break;
            }
        }

        // Get the clip before and after to suggest scene/shot/frame numbers
        const beforeClip = insertIndex > 0 ? sortedTimeline[insertIndex - 1] : null;
        const afterClip = insertIndex < sortedTimeline.length ? sortedTimeline[insertIndex] : null;

        // Suggest new numbers
        let suggestedScene = clip.sceneNumber;
        let suggestedShot = clip.shotNumber;
        let suggestedFrame = clip.frameNumber;

        if (beforeClip) {
            // Try to place after the before clip
            const beforeScene = parseInt(beforeClip.sceneNumber) || 0;
            const beforeShot = parseInt(beforeClip.shotNumber) || 0;
            const beforeFrame = parseInt(beforeClip.frameNumber) || 0;

            // If same scene/shot, increment frame
            if (beforeClip.sceneNumber === clip.sceneNumber && 
                beforeClip.shotNumber === clip.shotNumber) {
                suggestedFrame = String(beforeFrame + 1).padStart(4, '0');
            } else {
                // Keep current or use before clip's numbers
                suggestedScene = beforeClip.sceneNumber;
                suggestedShot = beforeClip.shotNumber;
                suggestedFrame = String(beforeFrame + 1).padStart(4, '0');
            }
        } else if (afterClip) {
            // Place before after clip
            suggestedScene = afterClip.sceneNumber;
            suggestedShot = afterClip.shotNumber;
            const afterFrame = parseInt(afterClip.frameNumber) || 0;
            suggestedFrame = String(Math.max(1, afterFrame - 1)).padStart(4, '0');
        }

        // Create a custom modal for this
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Move Clip to New Position</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="color: #ccc; margin-bottom: 16px;">The clip will be moved to a new position. Please update the Scene/Shot/Frame numbers to match the new position:</p>
                    <div class="setting-group">
                        <label>Scene Number:</label>
                        <input type="text" id="moveClipScene" value="${suggestedScene}" placeholder="Scene number">
                    </div>
                    <div class="setting-group">
                        <label>Shot Number:</label>
                        <input type="text" id="moveClipShot" value="${suggestedShot}" placeholder="Shot number">
                    </div>
                    <div class="setting-group">
                        <label>Frame Number:</label>
                        <input type="text" id="moveClipFrame" value="${suggestedFrame}" placeholder="Frame number">
                    </div>
                </div>
                <div class="modal-actions" style="padding: 16px 20px; border-top: 1px solid #444; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="moveClipCancel" class="btn btn-secondary">Cancel</button>
                    <button id="moveClipConfirm" class="btn btn-primary">Confirm Move</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup event listeners
        return new Promise((resolve) => {
            const closeModal = () => {
                modal.remove();
            };

            modal.querySelector('.modal-close').addEventListener('click', () => {
                closeModal();
                resolve(null);
            });

            modal.querySelector('#moveClipCancel').addEventListener('click', () => {
                closeModal();
                resolve(null);
            });

            modal.querySelector('#moveClipConfirm').addEventListener('click', () => {
                const newScene = document.getElementById('moveClipScene').value.trim();
                const newShot = document.getElementById('moveClipShot').value.trim();
                const newFrame = document.getElementById('moveClipFrame').value.trim();
                closeModal();
                resolve({ scene: newScene, shot: newShot, frame: newFrame });
            });

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                    resolve(null);
                }
            });
        }).then((result) => {
            if (result && result.scene && result.shot && result.frame) {
                // Update the image's scene/shot/frame numbers
                const image = this.app.project.images.find(img => img.name === clip.imageId);
                if (image) {
                    image.sceneNumber = result.scene;
                    image.shotNumber = result.shot;
                    image.frameNumber = result.frame;

                    // Update track assignment if moving to a different track
                    if (newTrackId) {
                        this.clipTrackAssignments.set(clip.id, newTrackId);
                    }

                    // Rebuild timeline with new order
                    this.previsManager.buildTimelineFromStoryboard();
                    
                    // Restore track assignments after rebuild (clips are recreated, so match by imageId)
                    this.previsManager.timeline.forEach(newClip => {
                        if (newClip.imageId === clip.imageId || newClip.id === clip.id) {
                            const savedTrackId = this.clipTrackAssignments.get(clip.id) || newTrackId;
                            if (savedTrackId) {
                                newClip.trackId = savedTrackId;
                            }
                        }
                    });
                    this.renderTimeline();
                    this.renderVideoPreview();

                    // Mark project as changed
                    this.app.markChanged();
                    this.app.storageService.saveToStorage(false);
                }
            } else {
                // Reset timeline to original position
                this.renderTimeline();
            }
        });
    }

    /**
     * Show clip settings modal
     */
    showClipSettingsModal(clip) {
        if (!this.previsManager || !clip) return;
        
        const frameRate = this.app.project.settings?.frameRate || 24;
        const durationInFrames = Math.round(clip.duration * frameRate);
        const durationInSeconds = clip.duration.toFixed(3);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Clip Settings</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="setting-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; color: #ccc; font-weight: 600;">Scene/Shot/Frame:</label>
                        <div style="color: #888; font-size: 14px;">${clip.sceneNumber || 'N/A'} / ${clip.shotNumber || 'N/A'} / ${clip.frameNumber || 'N/A'}</div>
                    </div>
                    <div class="setting-group" style="margin-bottom: 16px;">
                        <label for="clipDurationFrames" style="display: block; margin-bottom: 6px; color: #ccc; font-weight: 600;">Duration (Frames):</label>
                        <input type="number" id="clipDurationFrames" value="${durationInFrames}" min="1" step="1" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                        <small style="color: #999; font-size: 11px; display: block; margin-top: 4px;">Frame rate: ${frameRate} fps</small>
                    </div>
                    <div class="setting-group" style="margin-bottom: 16px;">
                        <label for="clipDurationSeconds" style="display: block; margin-bottom: 6px; color: #ccc; font-weight: 600;">Duration (Seconds):</label>
                        <input type="number" id="clipDurationSeconds" value="${durationInSeconds}" min="0.001" step="0.001" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                    </div>
                    <div class="setting-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; color: #ccc; font-weight: 600;">Start Time:</label>
                        <div style="color: #888; font-size: 14px;">${this.previsManager.formatTimecode(clip.startTime)}</div>
                    </div>
                    <div class="setting-group">
                        <label style="display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer;">
                            <input type="checkbox" id="clipRippleEdit" ${this.rippleEditEnabled ? 'checked' : ''}>
                            <span>Apply ripple edit when changing duration</span>
                        </label>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 16px 20px; border-top: 1px solid #444; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="clipSettingsCancel" class="btn btn-secondary">Cancel</button>
                    <button id="clipSettingsSave" class="btn btn-primary">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Sync frames and seconds inputs
        const framesInput = modal.querySelector('#clipDurationFrames');
        const secondsInput = modal.querySelector('#clipDurationSeconds');
        
        framesInput.addEventListener('input', () => {
            const frames = parseFloat(framesInput.value) || 0;
            const seconds = frames / frameRate;
            secondsInput.value = seconds.toFixed(3);
        });
        
        secondsInput.addEventListener('input', () => {
            const seconds = parseFloat(secondsInput.value) || 0;
            const frames = Math.round(seconds * frameRate);
            framesInput.value = frames;
        });
        
        // Setup event listeners
        return new Promise((resolve) => {
            const closeModal = () => {
                modal.remove();
                resolve(null);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#clipSettingsCancel').addEventListener('click', closeModal);
            
            modal.querySelector('#clipSettingsSave').addEventListener('click', () => {
                const newDurationFrames = parseInt(framesInput.value) || durationInFrames;
                const newDuration = newDurationFrames / frameRate;
                const rippleEdit = modal.querySelector('#clipRippleEdit').checked;
                
                if (newDuration !== clip.duration) {
                    const durationChange = newDuration - clip.duration;
                    const oldRippleState = this.rippleEditEnabled;
                    
                    // Temporarily set ripple state if checkbox is checked
                    if (rippleEdit) {
                        this.rippleEditEnabled = true;
                    }this.previsManager.updateClipDuration(clip.id, newDuration);
                    
                    // Apply ripple if enabled
                    if (rippleEdit) {
                        this.rippleEditClips(clip, durationChange, 'right');
                    }
                    
                    // Restore ripple state
                    this.rippleEditEnabled = oldRippleState;
                    
                    // For storyboard clips, just recalculate positions on the SAME TRACK ONLY
                    // This prevents external files on other tracks from being moved
                    // We don't need to rebuild the entire timeline from storyboard when just changing duration
                    if (!clip.isExternalFile) {// Recalculate positions on the same track only (preserves external files on other tracks)
                        const trackId = clip.trackId || 'video_1'; // Default to video_1 if no trackId
                        this.previsManager.recalculateTimelinePositions(trackId);
                        
                        // Sync with shot list
                        this.syncDurationToShotList(clip);
                    } else {
                        // For external files, just recalculate positions on the SAME TRACK ONLYthis.previsManager.recalculateTimelinePositions(clip.trackId);
                    }
                    
                    this.renderTimeline();
                    
                    // Mark project as changed
                    this.app.markChanged();
                    this.app.storageService.saveToStorage(false);
                }
                
                closeModal();
            });
        });
    }

    /**
     * Sync clip duration changes to shot list
     */
    syncDurationToShotList(clip) {
        if (!this.app.shotListManager || !clip) return;
        
        // Only sync for storyboard clips (not external files)
        if (clip.isExternalFile) return;

        // Find the shot in shot list
        const shots = this.app.shotListManager.getAllShots();
        const shot = shots.find(s => 
            s.sceneNumber === clip.sceneNumber && 
            s.shotNumber === clip.shotNumber
        );

        if (shot) {
            // Calculate total duration for all frames in this shot (only storyboard clips, not external files)
            const shotClips = this.previsManager.timeline.filter(c => 
                !c.isExternalFile && // Only count storyboard clips
                c.sceneNumber === clip.sceneNumber && 
                c.shotNumber === clip.shotNumber
            );

            const totalDuration = shotClips.reduce((sum, c) => sum + c.duration, 0);
            const frameRate = this.app.project.settings?.frameRate || 24;
            const totalFrames = Math.round(totalDuration * frameRate);

            // Update shot duration using updateDuration to trigger proportional scaling
            // This ensures bidirectional sync: timeline changes → shot list → proportional frame scaling
            this.app.shotListManager.updateDuration(shot, totalFrames, true);
            
            // Update shot list display
            if (this.app.shotListController) {
                this.app.shotListController.renderShotList();
            }

            // Mark project as changed
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        }
    }

    /**
     * Toggle snapping
     */
    toggleSnap() {
        if (!this.previsManager) return;
        this.previsManager.setSnapEnabled(!this.previsManager.snapEnabled);
        
        const snapBtn = document.getElementById('previzSnapToggle');
        if (snapBtn) {
            if (this.previsManager.snapEnabled) {
                snapBtn.classList.add('active');
                snapBtn.style.background = '#007acc';
            } else {
                snapBtn.classList.remove('active');
                snapBtn.style.background = '';
            }
        }
    }

    /**
     * Select a clip
     */
    selectClip(clipEl, clip) {
        // Deselect all clips
        document.querySelectorAll('.previz-clip.selected, .previz-audio-clip.selected').forEach(el => {
            el.classList.remove('selected');
            el.style.borderColor = '';
            el.style.boxShadow = '';
        });
        
        // Select this clip
        if (clipEl) {
            clipEl.classList.add('selected');
            clipEl.style.borderColor = '#007acc';
            clipEl.style.boxShadow = '0 0 8px rgba(0, 122, 204, 0.8)';
            this.selectedClip = clip;
        }
    }
    
    /**
     * Delete clip from timeline
     */
    deleteClipFromTimeline(clip) {
        if (!this.previsManager || !clip) return;
        
        // CRITICAL: Prevent deletion of storyboard clips from timeline
        // Users should delete them from the storyboard workspace instead
        if (!clip.isExternalFile) {
            this.app.customAlert('Storyboard frames cannot be deleted from the timeline. Please go to the Storyboard workspace and delete the frame there.');
            return;
        }
        
        // Save to history before deleting
        this.saveToHistory();
        
        // Get the trackId before deleting (for track-specific recalculation)
        const trackId = clip.trackId;
        
        // Remove clip from timeline
        const index = this.previsManager.timeline.findIndex(c => c.id === clip.id);
        if (index !== -1) {
            this.previsManager.timeline.splice(index, 1);
            
            // CRITICAL: Only recalculate the specific track to preserve external files on other tracks
            // If trackId is not set, default to the clip's track or 'video_1' for video clips
            const targetTrackId = trackId || (clip.fileType === 'audio' ? 'audio_1' : 'video_1');
            this.previsManager.recalculateTimelinePositions(targetTrackId);
            
            // Deselect
            this.selectedClip = null;
            
            // Preserve scroll position before re-rendering
            const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
            const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
            
            // Re-render timeline
            this.renderTimeline();
            
            // Restore scroll position after rendering
            if (tracksScrollContainer && savedScrollTop > 0) {
                tracksScrollContainer.scrollTop = savedScrollTop;
            }
            
            // Mark project as changed
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        }
    }
    
    /**
     * Save current state to history
     */
    saveToHistory() {
        if (!this.previsManager) return;
        
        const state = {
            timeline: JSON.parse(JSON.stringify(this.previsManager.timeline)),
            currentTime: this.previsManager.currentTime,
            totalDuration: this.previsManager.totalDuration
        };
        
        // Remove any states after current index (when undoing and then making new changes)
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        // Update undo/redo button states
        this.updateUndoRedoButtons();
    }
    
    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex <= 0 || !this.previsManager) return;
        
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        
        this.previsManager.timeline = JSON.parse(JSON.stringify(state.timeline));
        this.previsManager.currentTime = state.currentTime;
        this.previsManager.totalDuration = state.totalDuration;
        
        this.renderTimeline();
        this.updateUndoRedoButtons();
        
        // Mark project as changed
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }
    
    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1 || !this.previsManager) return;
        
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        
        this.previsManager.timeline = JSON.parse(JSON.stringify(state.timeline));
        this.previsManager.currentTime = state.currentTime;
        this.previsManager.totalDuration = state.totalDuration;
        
        this.renderTimeline();
        this.updateUndoRedoButtons();
        
        // Mark project as changed
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }
    
    /**
     * Update undo/redo button states
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('previzUndoBtn');
        const redoBtn = document.getElementById('previzRedoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
            undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
            redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
        }
    }
    
    /**
     * Toggle ripple edit
     */

    /**
     * Ripple edit clips after/before the edited clip
     */
    rippleEditClips(editedClip, timeChange, side) {
        if (!this.previsManager) return;
        
        const timeline = [...this.previsManager.timeline].sort((a, b) => a.startTime - b.startTime);
        const editedClipIndex = timeline.findIndex(c => c.id === editedClip.id);
        
        if (side === 'right') {
            // Ripple forward: move all clips after this one
            const clipsAfter = timeline.slice(editedClipIndex + 1);
            clipsAfter.forEach(clip => {
                const newStartTime = clip.startTime + timeChange;
                this.previsManager.moveClip(clip.id, Math.max(0, newStartTime));
            });
        } else if (side === 'left') {
            // When resizing left, the start time moved forward, so move clips after forward too
            const clipsAfter = timeline.slice(editedClipIndex + 1);
            clipsAfter.forEach(clip => {
                const newStartTime = clip.startTime + timeChange;
                this.previsManager.moveClip(clip.id, Math.max(0, newStartTime));
            });
        }
    }

    /**
     * Handle delete empty space between clips
     */
    handleDeleteEmptySpace(e, track, clipsContainer, clickTimeOverride = null) {
        if (!this.previsManager) return;
        
        let clickTime = clickTimeOverride;
        
        // If no override, calculate from event
        if (clickTime === null) {
            const rect = track.getBoundingClientRect();
            const rulerContainer = document.getElementById('previzRulerContainer');
            const scrollLeft = rulerContainer ? rulerContainer.scrollLeft : 0;
            
            // Try to get click position from event, or use a default
            let clickX = 0;
            if (e && e.clientX) {
                clickX = e.clientX - rect.left + scrollLeft;
            } else {
                // If no clientX, use the center of the track
                clickX = rect.width / 2 + scrollLeft;
            }
            
            const pixelsPerSecond = 100 * this.previsManager.zoomLevel;
            clickTime = clickX / pixelsPerSecond;
        }
        
        // Find the two clips that this empty space is between
        const timeline = [...this.previsManager.timeline].sort((a, b) => a.startTime - b.startTime);
        
        let beforeClip = null;
        let afterClip = null;
        
        for (let i = 0; i < timeline.length; i++) {
            const clip = timeline[i];
            if (clip.endTime <= clickTime) {
                beforeClip = clip;
            } else if (clip.startTime > clickTime) {
                afterClip = clip;
                break;
            }
        }
        
        // If we found both clips with space between them
        if (beforeClip && afterClip && beforeClip.endTime < afterClip.startTime) {
            const emptySpace = afterClip.startTime - beforeClip.endTime;
            
            // Save to history before making changes
            this.saveToHistory();
            
            // Move all clips after the beforeClip forward by the empty space amount
            const clipsToMove = timeline.filter(c => c.startTime >= afterClip.startTime);
            clipsToMove.forEach(clip => {
                const newStartTime = clip.startTime - emptySpace;
                this.previsManager.moveClip(clip.id, Math.max(0, newStartTime));
            });
            
            // Rebuild timeline and render
            this.previsManager.buildTimelineFromStoryboard();
            this.renderTimeline();
            
            // Mark project as changed
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        }
    }


    /**
     * Toggle loop
     */
    toggleLoop() {
        if (!this.previsManager) return;
        this.previsManager.setLooping(!this.previsManager.isLooping);
        
        const loopBtn = document.getElementById('previzLoopBtn');
        if (loopBtn) {
            if (this.previsManager.isLooping) {
                loopBtn.classList.add('active');
                loopBtn.style.background = '#007acc';
            } else {
                loopBtn.classList.remove('active');
                loopBtn.style.background = '';
            }
        }
    }

    /**
     * Add video track (adds above existing tracks)
     */
    addVideoTrack() {
        const trackId = `video_${Date.now()}`;
        // Find the highest track number
        const maxTrackNumber = this.videoTracks.length > 0 
            ? Math.max(...this.videoTracks.map(t => t.trackNumber || 1))
            : 0;
        // New track gets the next highest number
        const trackNumber = maxTrackNumber + 1;
        const track = {
            id: trackId,
            name: `Video ${trackNumber}`,
            clips: [],
            trackNumber: trackNumber
        };
        // Add at the beginning (will appear above)
        this.videoTracks.unshift(track);
        this.renderTimeline();
    }

    /**
     * Add audio track
     */
    addAudioTrack() {
        const trackId = `audio_${Date.now()}`;
        const track = {
            id: trackId,
            name: `Audio ${this.audioTracks.length + 1}`,
            clips: []
        };
        this.audioTracks.push(track);
        this.renderTimeline();
    }
    
    /**
     * Remove audio track
     */
    removeAudioTrack(trackId) {
        if (!trackId) return;
        
        // Find the track
        const track = this.audioTracks.find(t => t.id === trackId);
        if (!track) return;
        
        // Prevent removing the first audio track
        const isFirstAudioTrack = this.audioTracks.indexOf(track) === 0;
        if (isFirstAudioTrack) {
            this.app.customAlert('Cannot remove the first audio track.');
            return;
        }
        
        // Prevent removing the last audio track (at least one must exist)
        if (this.audioTracks.length <= 1) {
            this.app.customAlert('Cannot remove the last audio track. At least one audio track must exist.');
            return;
        }
        
        // Check if track has clips
        const clipsOnTrack = this.previsManager.timeline.filter(clip => 
            clip.isExternalFile && clip.fileType === 'audio' && clip.trackId === trackId
        );
        
        if (clipsOnTrack.length > 0) {
            const confirmed = confirm(`This audio track contains ${clipsOnTrack.length} clip(s). Removing the track will also remove these clips. Continue?`);
            if (!confirmed) return;
            
            // Remove clips from timeline
            clipsOnTrack.forEach(clip => {
                const index = this.previsManager.timeline.findIndex(c => c.id === clip.id);
                if (index !== -1) {
                    this.previsManager.timeline.splice(index, 1);
                }
            });
        }
        
        // Remove track
        this.audioTracks = this.audioTracks.filter(t => t.id !== trackId);
        
        // Clear selection
        this.selectedTrack = null;
        
        // Preserve scroll position
        const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
        const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
        
        this.renderTimeline();
        
        // Restore scroll position
        if (tracksScrollContainer && savedScrollTop > 0) {
            tracksScrollContainer.scrollTop = savedScrollTop;
        }
        
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }
    
    /**
     * Remove video track
     */
    removeVideoTrack(trackId) {
        if (!trackId) return;
        
        // Find the track
        const track = this.videoTracks.find(t => t.id === trackId);
        if (!track) return;
        
        // Prevent removing the first video track
        const isFirstVideoTrack = (track.trackNumber || 1) === 1 || track.id === 'video_1';
        if (isFirstVideoTrack) {
            this.app.customAlert('Cannot remove the first video track.');
            return;
        }
        
        // Prevent removing the last video track (at least one must exist)
        if (this.videoTracks.length <= 1) {
            this.app.customAlert('Cannot remove the last video track. At least one video track must exist.');
            return;
        }
        
        // Check if track has clips
        const clipsOnTrack = this.previsManager.timeline.filter(clip => {
            const clipTrackId = clip.trackId || this.clipTrackAssignments.get(clip.id);
            return clipTrackId === trackId;
        });
        
        if (clipsOnTrack.length > 0) {
            const confirmed = confirm(`This video track contains ${clipsOnTrack.length} clip(s). Removing the track will also remove these clips. Continue?`);
            if (!confirmed) return;
            
            // Remove clips from timeline
            clipsOnTrack.forEach(clip => {
                const index = this.previsManager.timeline.findIndex(c => c.id === clip.id);
                if (index !== -1) {
                    this.previsManager.timeline.splice(index, 1);
                }
            });
        }
        
        // Remove track
        this.videoTracks = this.videoTracks.filter(t => t.id !== trackId);
        
        // Clear selection
        this.selectedTrack = null;
        
        // Preserve scroll position
        const tracksScrollContainer = document.getElementById('previzTracksScrollContainer');
        const savedScrollTop = tracksScrollContainer ? tracksScrollContainer.scrollTop : 0;
        
        this.renderTimeline();
        
        // Restore scroll position
        if (tracksScrollContainer && savedScrollTop > 0) {
            tracksScrollContainer.scrollTop = savedScrollTop;
        }
        
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }

    /**
     * Setup resize handle for adjusting video preview vs timeline sizes
     */
    setupResizeHandle(handle) {
        let isResizing = false;
        let startY = 0;
        let startPreviewHeight = 0;
        let startTimelineHeight = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            
            const preview = document.getElementById('previzVideoPreview');
            const timeline = document.getElementById('previzTimeline');
            
            if (preview && timeline) {
                startPreviewHeight = preview.offsetHeight;
                startTimelineHeight = timeline.offsetHeight;
            }
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            const preview = document.getElementById('previzVideoPreview');
            const timeline = document.getElementById('previzTimeline');
            
            if (preview && timeline) {
                const newPreviewHeight = Math.max(200, startPreviewHeight + deltaY);
                const newTimelineHeight = Math.max(150, startTimelineHeight - deltaY);
                
                preview.style.flex = `0 0 ${newPreviewHeight}px`;
                timeline.style.flex = `0 0 ${newTimelineHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    /**
     * Zoom controls
     */
    zoomIn() {
        if (!this.previsManager) return;
        this.previsManager.zoomLevel = Math.min(this.previsManager.zoomLevel * 1.5, 10);
        this.renderTimeline();
    }

    zoomOut() {
        if (!this.previsManager) return;
        this.previsManager.zoomLevel = Math.max(this.previsManager.zoomLevel / 1.5, 0.1);
        this.renderTimeline();
    }

    zoomFit() {
        if (!this.previsManager || !this.previsManager.timeline.length) return;
        
        const rulerContainer = document.getElementById('previzRulerContainer');
        if (!rulerContainer) return;

        const containerWidth = rulerContainer.offsetWidth;
        const totalDuration = this.previsManager.totalDuration;
        
        if (totalDuration > 0) {
            this.previsManager.zoomLevel = (containerWidth / totalDuration) / 100;
            this.renderTimeline();
        }
    }

    /**
     * Toggle file panel visibility
     */
    toggleFilePanel() {
        const filePanel = document.getElementById('previzFilePanel');
        const toggleBtn = document.getElementById('previzToggleFilePanel');
        if (!filePanel || !toggleBtn) {
            console.error('File panel or toggle button not found');
            return;
        }

        // Find icon - could be <i> or <svg> (after lucide renders)
        let icon = toggleBtn.querySelector('i[data-lucide]');
        if (!icon) {
            icon = toggleBtn.querySelector('svg');
        }
        if (!icon) {
            // If still not found, create one
            icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'chevron-left');
            icon.style.cssText = 'width: 12px; height: 12px;';
            toggleBtn.innerHTML = '';
            toggleBtn.appendChild(icon);
        }

        // Check if panel is currently visible - check both inline style and computed style
        const inlineDisplay = filePanel.style.display;
        const computedDisplay = window.getComputedStyle(filePanel).display;
        const isVisible = (inlineDisplay && inlineDisplay !== 'none') || (!inlineDisplay && computedDisplay !== 'none');

        const showPanelBtn = document.getElementById('previzShowFilePanelBtn');
        
        if (isVisible) {
            // Hide panel
            filePanel.style.display = 'none';
            // Update icon - remove existing SVG and create new icon element
            toggleBtn.innerHTML = '';
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', 'chevron-right');
            newIcon.style.cssText = 'width: 12px; height: 12px;';
            toggleBtn.appendChild(newIcon);
            toggleBtn.setAttribute('title', 'Show Panel');
            // Show the button on the left edge
            if (showPanelBtn) {
                showPanelBtn.style.display = 'block';
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } else {
            // Show panel
            filePanel.style.display = 'flex';
            // Update icon - remove existing SVG and create new icon element
            toggleBtn.innerHTML = '';
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', 'chevron-left');
            newIcon.style.cssText = 'width: 12px; height: 12px;';
            toggleBtn.appendChild(newIcon);
            toggleBtn.setAttribute('title', 'Hide Panel');
            // Hide the button on the left edge
            if (showPanelBtn) {
                showPanelBtn.style.display = 'none';
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    /**
     * Import audio file
     */
    async importAudioFile() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.multiple = true;
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    await this.addAudioFileToProject(file);
                }
            };
            
            input.click();
        } catch (error) {
            console.error('Error importing audio:', error);
            if (this.app.customAlert) {
                this.app.customAlert('Error importing audio file');
            }
        }
    }

    /**
     * Import video/image file
     */
    async importImageFile() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    await this.addImageFileToProject(file);
                }
            };
            
            input.click();
        } catch (error) {
            console.error('Error importing image:', error);
            if (this.app.customAlert) {
                this.app.customAlert('Error importing file');
            }
        }
    }

    /**
     * Add image file to project
     */
    async addImageFileToProject(file) {
        // Check file size (100MB limit)
        const maxSizeMB = 100;
        const fileSizeMB = file.size / (1024 * 1024);
        
        if (fileSizeMB > maxSizeMB) {
            if (this.app.customAlert) {
                this.app.customAlert(`File ${file.name} is too large (${fileSizeMB.toFixed(2)}MB). Maximum size is ${maxSizeMB}MB.`);
            }
            return;
        }
        
        // Always compress imported files before saving to project file
        const settings = this.app.project.settings || {};
        const compression = settings.imageCompression || {};
        
        let fileUrl = '';
        let compressed = false;
        
        if (this.getFileType(file.name) === 'image') {
            // Always compress images before saving to project file
            fileUrl = await this.compressFile(file, 'image', compression);
            compressed = true;
        } else {
            // Read as data URL (shouldn't happen for images, but keep as fallback)
            fileUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        // Store custom file info
        if (!this.app.project.customFiles) {
            this.app.project.customFiles = [];
        }
        
        const fileType = this.getFileType(file.name);
        const customFile = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            originalName: file.name,
            url: fileUrl,
            size: file.size,
            type: fileType, // Use fileType (image/audio) instead of MIME type
            fileType: fileType,
            isCustomFile: true,
            compressed: compressed,
            file: file // Keep file reference
        };
        
        this.app.project.customFiles.push(customFile);
        
        // Update file list display
        this.renderFileList();
        
        // Mark project as changed
        this.app.markChanged();
        this.app.storageService.saveToStorage(false);
    }

    /**
     * Add audio file to project
     */
    async addAudioFileToProject(file) {
        // Check file size (100MB limit)
        const maxSizeMB = 100;
        const fileSizeMB = file.size / (1024 * 1024);
        
        if (fileSizeMB > maxSizeMB) {
            if (this.app.customAlert) {
                this.app.customAlert(`File ${file.name} is too large (${fileSizeMB.toFixed(2)}MB). Maximum size is ${maxSizeMB}MB.`);
            }
            return;
        }
        
        // Create file entry immediately with "compressing" status
        if (!this.app.project.audioFiles) {
            this.app.project.audioFiles = [];
        }
        
        const audioFileId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const audioFile = {
            id: audioFileId,
            name: file.name,
            url: '', // Will be set after compression
            size: file.size,
            type: file.type,
            duration: 0, // Will be set after getting duration
            compressed: false,
            compressing: true, // Flag to show compression progress
            compressionProgress: 0, // Progress percentage
            file: file // Keep file reference for potential re-export
        };
        
        this.app.project.audioFiles.push(audioFile);
        
        // Show file immediately in UI with compression indicator
        this.renderFileList();
        
        // Get audio duration (quick operation)
        let audioDuration = 0;
        try {
            audioDuration = await this.getAudioDuration(file);
            audioFile.duration = audioDuration;
            this.renderFileList(); // Update with duration
        } catch (error) {
            console.warn(`Could not get audio duration:`, error);
        }
        
        // Compress in background with progress updates
        const settings = this.app.project.settings || {};
        const compression = settings.imageCompression || {};
        
        // Update progress: starting compression
        audioFile.compressionProgress = 10;
        this.renderFileList();
        this.updateCompressionProgress(audioFileId, 10);
        
        // Simulate progress updates during compression (since we can't get real progress from MediaRecorder)
        const progressInterval = setInterval(() => {
            if (audioFile.compressing && audioFile.compressionProgress < 90) {
                audioFile.compressionProgress = Math.min(90, audioFile.compressionProgress + 5);
                this.updateCompressionProgress(audioFileId, audioFile.compressionProgress);
            }
        }, 500); // Update every 500ms
        
        try {
            // Compress audio file
            const fileUrl = await this.compressFile(file, 'audio', compression);
            
            clearInterval(progressInterval);
            
            // Update progress: compression complete
            audioFile.compressionProgress = 100;
            audioFile.url = fileUrl;
            audioFile.compressed = true;
            audioFile.compressing = false;
            
            // Update file list display (removes progress indicator, shows buttons)
            this.renderFileList();
            
            // Mark project as changed
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Audio compression error:', error);
            
            // Fallback: use original file without compression
            try {
                audioFile.compressionProgress = 95;
                this.updateCompressionProgress(audioFileId, 95);
                
                const fileUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                
                audioFile.url = fileUrl;
                audioFile.compressed = false;
                audioFile.compressing = false;
                audioFile.compressionProgress = 100;
                
                this.renderFileList();
                this.app.markChanged();
                this.app.storageService.saveToStorage(false);
            } catch (fallbackError) {
                console.error('Failed to read original file:', fallbackError);
                // Remove file from list if both compression and fallback failed
                const index = this.app.project.audioFiles.findIndex(f => f.id === audioFileId);
                if (index !== -1) {
                    this.app.project.audioFiles.splice(index, 1);
                    this.renderFileList();
                }
            }
        }
    }

    /**
     * Compress file (image, video, or audio)
     */
    async compressFile(file, fileType, settings = {}) {
        if (fileType === 'image') {
            // Use existing image compression
            return await this.compressImageFile(file, settings);
        } else if (fileType === 'video') {
            // Compress video - reduce quality/bitrate
            return await this.compressVideoFile(file, settings);
        } else if (fileType === 'audio') {
            // Compress audio - reduce bitrate
            return await this.compressAudioFile(file, settings);
        }
        
        // Fallback: read as data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }


    /**
     * Compress audio file
     */
    async compressAudioFile(file, settings) {
        
        // Aggressive audio compression for preview quality
        // Since these are just previews, we can use much lower quality settings
        const maxSizeMB = settings.maxSizeMB || 1; // Target size after compression (reduced from 2MB)
        const targetBitrate = settings.targetBitrate || 32000; // 32 kbps - sufficient for preview (reduced from 64)
        const targetSampleRate = settings.targetSampleRate || 22050; // 22kHz - good for preview (reduced from 32kHz)
        
        const fileSizeMB = file.size / (1024 * 1024);
        const originalSizeMB = fileSizeMB;
        
        // Detect file format from type and extension
        const fileExtension = (file.name || '').split('.').pop()?.toLowerCase() || '';
        const fileTypeLower = (file.type || '').toLowerCase();
        
        // Lossless formats that should be compressed
        const losslessFormats = ['wav', 'wave', 'flac', 'aiff', 'aif', 'pcm'];
        const losslessMimeTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/flac', 'audio/x-flac', 'audio/aiff', 'audio/x-aiff'];
        
        // Already-compressed formats that should be kept as-is
        const compressedFormats = ['mp3', 'mpeg', 'aac', 'ogg', 'opus', 'webm', 'm4a', 'mp4'];
        const compressedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/opus', 'audio/x-m4a'];
        
        const isLossless = losslessFormats.includes(fileExtension) || losslessMimeTypes.some(mime => fileTypeLower.includes(mime.split('/')[1]));
        const isAlreadyCompressed = compressedFormats.includes(fileExtension) || compressedMimeTypes.some(mime => fileTypeLower.includes(mime.split('/')[1]));
        
        // If file is already compressed, use as-is (re-compressing would make it larger)
        if (isAlreadyCompressed) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        // Only compress lossless formats (WAV, FLAC, etc.)
        // If format is unknown, assume it might be lossless and try to compress
        if (!isLossless && !isAlreadyCompressed) {
            // Unknown format - check file size, if reasonable, use as-is
            if (fileSizeMB <= maxSizeMB * 2) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
        }
        
        // Compress lossless formats for preview quality
        
        try {
            // Decode audio using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Resample to target sample rate if needed
            let processedBuffer = audioBuffer;
            if (audioBuffer.sampleRate > targetSampleRate) {
                const ratio = targetSampleRate / audioBuffer.sampleRate;
                const length = Math.round(audioBuffer.length * ratio);
                const newBuffer = audioContext.createBuffer(
                    audioBuffer.numberOfChannels,
                    length,
                    targetSampleRate
                );
                
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                    const oldData = audioBuffer.getChannelData(channel);
                    const newData = newBuffer.getChannelData(channel);
                    for (let i = 0; i < length; i++) {
                        const index = i / ratio;
                        const indexFloor = Math.floor(index);
                        const indexCeil = Math.min(indexFloor + 1, oldData.length - 1);
                        const fraction = index - indexFloor;
                        newData[i] = oldData[indexFloor] * (1 - fraction) + oldData[indexCeil] * fraction;
                    }
                }
                processedBuffer = newBuffer;
            }
            
            // Always convert to mono for preview (reduces size by ~50%)
            let finalBuffer = processedBuffer;
            if (processedBuffer.numberOfChannels > 1) {
                const monoBuffer = audioContext.createBuffer(1, processedBuffer.length, processedBuffer.sampleRate);
                const monoData = monoBuffer.getChannelData(0);
                const leftData = processedBuffer.getChannelData(0);
                const rightData = processedBuffer.getChannelData(1);
                
                for (let i = 0; i < processedBuffer.length; i++) {
                    monoData[i] = (leftData[i] + rightData[i]) / 2; // Average channels
                }
                finalBuffer = monoBuffer;
                
            }
            
            // Try to use MediaRecorder with Opus codec for efficient compression
            // Note: MediaRecorder approach can be unreliable, so we have multiple fallbacks
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                try {
                    // Calculate timeout based on audio duration (duration * 2 + 10s buffer)
                    const duration = finalBuffer.duration;
                    const timeoutMs = Math.max(60000, (duration * 2000) + 10000); // At least 60s, or 2x duration + 10s
                    
                    
                    const result = await Promise.race([
                        this.encodeAudioWithMediaRecorder(finalBuffer, audioContext, targetBitrate, 'audio/webm;codecs=opus', originalSizeMB),
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`MediaRecorder timeout after ${timeoutMs}ms`)), timeoutMs))
                    ]);
                    return result;
                } catch (mediaRecorderError) {
                    console.warn('MediaRecorder encoding failed, falling back to WAV:', mediaRecorderError);
                    // Fall through to WAV fallback
                }
            } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                try {
                    // Calculate timeout based on audio duration
                    const duration = finalBuffer.duration;
                    const timeoutMs = Math.max(60000, (duration * 2000) + 10000);
                    
                    const result = await Promise.race([
                        this.encodeAudioWithMediaRecorder(finalBuffer, audioContext, targetBitrate, 'audio/ogg;codecs=opus', originalSizeMB),
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`MediaRecorder timeout after ${timeoutMs}ms`)), timeoutMs))
                    ]);
                    return result;
                } catch (mediaRecorderError) {
                    console.warn('MediaRecorder encoding failed, falling back to WAV:', mediaRecorderError);
                    // Fall through to WAV fallback
                }
            }
            
            // Fallback: If MediaRecorder failed, use original file if it's already compressed
            // This avoids creating a larger WAV file from an already-compressed source
            if (isAlreadyCompressed) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            
            // Last resort: Use WAV (uncompressed but compatible)
            // This is better than failing completely, but will be larger
            console.warn('Opus codec not supported or failed, using WAV format (larger file size)');
            const wav = this.audioBufferToWav(finalBuffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn('Audio compression failed, using original file:', error);
            // Fallback to original file
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    }
    
    /**
     * Encode audio using MediaRecorder API with Opus codec
     * This provides efficient compression for already-compressed audio files
     */
    async encodeAudioWithMediaRecorder(audioBuffer, audioContext, bitrate, mimeType = 'audio/webm;codecs=opus', originalSizeMB = 0) {
        // Store original size for comparison
        const originalSizeEstimate = audioBuffer.length * audioBuffer.numberOfChannels * 2; // Rough estimate: samples * channels * 2 bytes
        
        return new Promise(async (resolve, reject) => {
            
            try {
                // Create a MediaStream from the AudioBuffer
                const destination = audioContext.createMediaStreamDestination();
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(destination);
                
                // Create MediaRecorder with Opus codec
                let mediaRecorder;
                try {
                    mediaRecorder = new MediaRecorder(destination.stream, {
                        mimeType: mimeType,
                        audioBitsPerSecond: bitrate
                    });
                } catch (recorderError) {
                    throw recorderError;
                }
                
                const chunks = [];
                let recordingStarted = false;
                let timeoutId = null;
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
            mediaRecorder.onstop = () => {
                if (timeoutId) clearTimeout(timeoutId);
                
                if (chunks.length === 0) {
                    reject(new Error('MediaRecorder produced no data'));
                    return;
                }
                
                const blob = new Blob(chunks, { type: mimeType });
                
                // Convert to data URL
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve(e.target.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            };
                
                mediaRecorder.onerror = (event) => {
                    if (timeoutId) clearTimeout(timeoutId);
                    reject(new Error('MediaRecorder error: ' + (event.error || 'Unknown error')));
                };
                
                // Start playback first (source must be playing for MediaRecorder to capture)
                try {
                    source.start(0);
                } catch (playError) {
                    reject(playError);
                    return;
                }
                
                // Small delay to ensure source is playing before starting recorder
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Start recording
                try {
                    mediaRecorder.start();
                    recordingStarted = true;
                } catch (startError) {
                    source.stop();
                    reject(startError);
                    return;
                }
                
                // Stop recording when audio finishes
                const duration = audioBuffer.duration * 1000; // Convert to milliseconds
                timeoutId = setTimeout(() => {
                    try {
                        if (mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                        source.stop();
                    } catch (stopError) {
                        reject(stopError);
                    }
                }, duration + 500); // Add larger buffer for safety
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Convert AudioBuffer to WAV format
     */
    audioBufferToWav(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;
        
        // Write WAV header
        const writeString = (str) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(pos + i, str.charCodeAt(i));
            }
            pos += str.length;
        };
        
        writeString('RIFF');
        view.setUint32(pos, 36 + length * numberOfChannels * 2, true);
        pos += 4;
        writeString('WAVE');
        writeString('fmt ');
        view.setUint32(pos, 16, true);
        pos += 4;
        view.setUint16(pos, 1, true);
        pos += 2;
        view.setUint16(pos, numberOfChannels, true);
        pos += 2;
        view.setUint32(pos, sampleRate, true);
        pos += 4;
        view.setUint32(pos, sampleRate * numberOfChannels * 2, true);
        pos += 4;
        view.setUint16(pos, numberOfChannels * 2, true);
        pos += 2;
        view.setUint16(pos, 16, true);
        pos += 2;
        writeString('data');
        view.setUint32(pos, length * numberOfChannels * 2, true);
        pos += 4;
        
        // Convert float samples to 16-bit PCM
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                pos += 2;
            }
        }
        
        return arrayBuffer;
    }

    /**
     * Render file list in file panel
     */
    renderFileList() {
        const fileList = document.getElementById('previzFileList');
        if (!fileList) return;

        fileList.innerHTML = '';

        // Only show custom loaded files, not storyboard images
        // Custom files are those explicitly imported for previz (marked with isCustomFile flag)
        const customImages = (this.app.project.customFiles || []).filter(f => {
            const fileType = f.type || f.fileType || this.getFileType(f.name || f.originalName || '');
            return fileType === 'image';
        }) || [];
        const audioFiles = this.app.project.audioFiles || [];
        const allFiles = [
            ...customImages.map(img => ({ 
                ...img, 
                type: 'image', 
                fileType: img.fileType || this.getFileType(img.name || img.originalName || '') 
            })),
            ...audioFiles.map(audio => ({ 
                ...audio, 
                type: 'audio', 
                fileType: audio.fileType || this.getFileType(audio.name || '') 
            }))
        ];
        
        if (allFiles.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'color: #888; font-size: 12px; padding: 20px; text-align: center;';
            emptyMsg.textContent = 'No files imported';
            fileList.appendChild(emptyMsg);
            return;
        }

        // Group by type
        const imageFiles = allFiles.filter(f => f.type === 'image');
        const audioFilesList = allFiles.filter(f => f.type === 'audio');

        // Render images section
        if (imageFiles.length > 0) {
            const sectionHeader = document.createElement('div');
            sectionHeader.style.cssText = 'padding: 8px 4px 4px 4px; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase;';
            sectionHeader.textContent = 'Images';
            fileList.appendChild(sectionHeader);

            imageFiles.forEach(file => {
                const fileItem = this.createFileItem(file, 'image');
                fileList.appendChild(fileItem);
            });
        }

        // Render audio section
        if (audioFilesList.length > 0) {
            const sectionHeader = document.createElement('div');
            sectionHeader.style.cssText = 'padding: 8px 4px 4px 4px; margin-top: 12px; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase;';
            sectionHeader.textContent = 'Audio';
            fileList.appendChild(sectionHeader);

            audioFilesList.forEach(file => {
                const fileItem = this.createFileItem(file, 'audio');
                fileList.appendChild(fileItem);
            });
        }

        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Get file type from extension
     */
    getFileType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
        if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio';
        return 'unknown';
    }

    /**
     * Create a draggable file item
     */
    createFileItem(file, type) {
        const fileItem = document.createElement('div');
        // Only allow dragging if file is ready (not compressing and has URL)
        fileItem.draggable = !file.compressing && !!file.url;
        fileItem.dataset.fileType = type;
        fileItem.dataset.fileId = file.id || file.name || Date.now();
        const cursorStyle = file.compressing ? 'wait' : (file.url ? 'grab' : 'not-allowed');
        fileItem.style.cssText = `padding: 8px; margin-bottom: 4px; background: #252526; border: 1px solid #333; border-radius: 4px; cursor: ${cursorStyle}; display: flex; align-items: center; gap: 8px; transition: all 0.2s;`;
        
        fileItem.addEventListener('mouseenter', () => {
            fileItem.style.background = '#2a2a2a';
            fileItem.style.borderColor = '#444';
        });
        fileItem.addEventListener('mouseleave', () => {
            fileItem.style.background = '#252526';
            fileItem.style.borderColor = '#333';
        });
        
        // Get appropriate icon
        const fileType = this.getFileType(file.name || file.originalName || '');
        let iconName = 'file';
        if (fileType === 'image') iconName = 'image';
        else if (fileType === 'video') iconName = 'video';
        else if (fileType === 'audio') iconName = 'music';
        
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        icon.style.cssText = 'width: 16px; height: 16px; color: #007acc; flex-shrink: 0;';
        
        const name = document.createElement('div');
        name.style.cssText = 'flex: 1; color: #ccc; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        name.textContent = file.name || file.originalName || 'Unknown';
        name.title = file.name || file.originalName || 'Unknown';
        
        // Settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'btn btn-secondary';
        settingsBtn.style.cssText = 'padding: 2px 4px; font-size: 10px; opacity: 0; transition: opacity 0.2s;';
        settingsBtn.innerHTML = '<i data-lucide="settings" style="width: 12px; height: 12px;"></i>';
        settingsBtn.title = 'File Settings';
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-secondary';
        deleteBtn.style.cssText = 'padding: 2px 4px; font-size: 10px; opacity: 0; transition: opacity 0.2s; color: #ff4444;';
        deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>';
        deleteBtn.title = 'Delete File';
        
        fileItem.addEventListener('mouseenter', () => {
            settingsBtn.style.opacity = '1';
            deleteBtn.style.opacity = '1';
        });
        fileItem.addEventListener('mouseleave', () => {
            settingsBtn.style.opacity = '0';
            deleteBtn.style.opacity = '0';
        });
        
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showFileSettingsModal(file, type);
        });
        
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.deleteFile(file, type);
        });
        
        fileItem.appendChild(icon);
        fileItem.appendChild(name);
        
        // Add compression progress indicator if compressing
        if (file.compressing) {
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = 'position: relative; width: 20px; height: 20px; flex-shrink: 0; margin-left: auto;';
            
            // Circular progress indicator (pie chart style)
            const progressSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            progressSvg.setAttribute('width', '20');
            progressSvg.setAttribute('height', '20');
            progressSvg.setAttribute('viewBox', '0 0 20 20');
            progressSvg.style.cssText = 'transform: rotate(-90deg);';
            
            // Background circle
            const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bgCircle.setAttribute('cx', '10');
            bgCircle.setAttribute('cy', '10');
            bgCircle.setAttribute('r', '8');
            bgCircle.setAttribute('fill', 'none');
            bgCircle.setAttribute('stroke', '#333');
            bgCircle.setAttribute('stroke-width', '2');
            
            // Progress circle
            const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            progressCircle.setAttribute('cx', '10');
            progressCircle.setAttribute('cy', '10');
            progressCircle.setAttribute('r', '8');
            progressCircle.setAttribute('fill', 'none');
            progressCircle.setAttribute('stroke', '#007acc');
            progressCircle.setAttribute('stroke-width', '2');
            progressCircle.setAttribute('stroke-linecap', 'round');
            
            const progress = file.compressionProgress || 0;
            const circumference = 2 * Math.PI * 8;
            const offset = circumference - (progress / 100) * circumference;
            progressCircle.setAttribute('stroke-dasharray', circumference);
            progressCircle.setAttribute('stroke-dashoffset', offset);
            
            progressSvg.appendChild(bgCircle);
            progressSvg.appendChild(progressCircle);
            progressContainer.appendChild(progressSvg);
            
            // Progress percentage text (no rotation needed - SVG is already rotated)
            const progressText = document.createElement('div');
            progressText.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 8px; color: #007acc; font-weight: 600;';
            progressText.textContent = `${Math.round(progress)}%`;
            progressContainer.appendChild(progressText);
            
            fileItem.appendChild(progressContainer);
            
            // Store reference for updating progress
            fileItem.dataset.fileId = file.id;
            fileItem._progressCircle = progressCircle;
            fileItem._progressText = progressText;
        } else {
            // Only show buttons when not compressing
            fileItem.appendChild(settingsBtn);
            fileItem.appendChild(deleteBtn);
        }
        
        // Drag handlers (only allow dragging when not compressing)
        if (!file.compressing) {
            fileItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                const dragData = {
                    file: file,
                    type: type,
                    fileType: fileType
                };
                e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                fileItem.style.opacity = '0.5';
            });
            
            fileItem.addEventListener('dragend', () => {
                fileItem.style.opacity = '1';
            });
        } else {
            // Disable dragging while compressing
            fileItem.style.cursor = 'wait';
            fileItem.style.opacity = '0.7';
        }
        
        return fileItem;
    }
    
    /**
     * Update compression progress for a file item
     */
    updateCompressionProgress(fileId, progress) {
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem && fileItem._progressCircle && fileItem._progressText) {
            const circumference = 2 * Math.PI * 8;
            const offset = circumference - (progress / 100) * circumference;
            fileItem._progressCircle.setAttribute('stroke-dashoffset', offset);
            fileItem._progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    /**
     * Toggle time display mode (timecode vs frames)
     */
    toggleTimeDisplay() {
        if (!this.previsManager) return;
        
        this.previsManager.timeDisplayMode = this.previsManager.timeDisplayMode === 'timecode' ? 'frames' : 'timecode';
        
        const toggleBtn = document.getElementById('previzToggleTimeDisplay');
        if (toggleBtn) {
            const span = toggleBtn.querySelector('span');
            if (span) {
                span.textContent = this.previsManager.timeDisplayMode === 'frames' ? 'Frames' : 'Timecode';
            }
        }
        
        // Re-render timeline to update ruler
        this.renderTimeline();
    }

    /**
     * Show project file settings modal
     */
    showProjectFileSettingsModal() {
        const settings = this.app.project.settings || {};
        const compression = settings.imageCompression || {
            enabled: true,
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            quality: 0.75,
            format: 'webp'
        };
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Project File Settings</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="setting-group" style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer; margin-bottom: 8px;">
                            <input type="checkbox" id="projectFileSaveFiles" ${settings.saveFilesInProject !== false ? 'checked' : ''}>
                            <span style="font-weight: 600;">Save files in project file</span>
                        </label>
                        <small style="color: #999; font-size: 11px; display: block; margin-left: 24px;">When enabled, files are embedded in the project file. When disabled, only file paths are saved.</small>
                    </div>
                    
                    <div class="setting-group" style="margin-bottom: 20px; padding: 12px; background: #1e1e1e; border: 1px solid #444; border-radius: 4px;">
                        <h3 style="color: #ccc; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">Project File Storage</h3>
                        <div id="projectFileStorageInfo" style="color: #888; font-size: 12px; line-height: 1.6;">
                            <!-- File sizes will be calculated and displayed here -->
                        </div>
                    </div>
                    
                    <div id="projectFileCompressionSettings" style="${settings.saveFilesInProject !== false ? '' : 'display: none;'}">
                        <h3 style="color: #ccc; font-size: 14px; margin: 20px 0 12px 0; font-weight: 600;">File Compression (Images, Audio)</h3>
                        <small style="color: #999; font-size: 11px; display: block; margin-bottom: 12px;">Note: Audio compression is limited in browser. Large files (>100MB) will be rejected.</small>
                        
                        <div class="setting-group" style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer; margin-bottom: 8px;">
                                <input type="checkbox" id="projectFileCompressionEnabled" ${compression.enabled ? 'checked' : ''}>
                                <span>Enable compression</span>
                            </label>
                        </div>
                        
                        <div id="projectFileCompressionOptions" style="${compression.enabled ? '' : 'display: none;'}">
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Max file size (MB):</label>
                                <input type="number" id="projectFileMaxSizeMB" value="${compression.maxSizeMB || 1}" min="0.1" max="10" step="0.1" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Max dimension (pixels):</label>
                                <input type="number" id="projectFileMaxDimension" value="${compression.maxWidthOrHeight || 1920}" min="100" max="4096" step="100" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Quality (0-1):</label>
                                <input type="number" id="projectFileQuality" value="${compression.quality || 0.75}" min="0.1" max="1" step="0.05" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Format:</label>
                                <select id="projectFileFormat" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                                    <option value="webp" ${compression.format === 'webp' ? 'selected' : ''}>WebP</option>
                                    <option value="jpeg" ${compression.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                                    <option value="png" ${compression.format === 'png' ? 'selected' : ''}>PNG</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 16px 20px; border-top: 1px solid #444; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="projectFileSettingsCancel" class="btn btn-secondary">Cancel</button>
                    <button id="projectFileSettingsSave" class="btn btn-primary">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Toggle compression settings visibility
        const saveFilesCheckbox = modal.querySelector('#projectFileSaveFiles');
        const compressionSettings = modal.querySelector('#projectFileCompressionSettings');
        const compressionEnabledCheckbox = modal.querySelector('#projectFileCompressionEnabled');
        const compressionOptions = modal.querySelector('#projectFileCompressionOptions');
        
        saveFilesCheckbox.addEventListener('change', () => {
            compressionSettings.style.display = saveFilesCheckbox.checked ? 'block' : 'none';
        });
        
        compressionEnabledCheckbox.addEventListener('change', () => {
            compressionOptions.style.display = compressionEnabledCheckbox.checked ? 'block' : 'none';
        });
        
        // Setup event listeners
        return new Promise((resolve) => {
            const closeModal = () => {
                modal.remove();
                resolve(null);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#projectFileSettingsCancel').addEventListener('click', closeModal);
            
            modal.querySelector('#projectFileSettingsSave').addEventListener('click', () => {
                // Save settings
                this.app.project.settings.saveFilesInProject = saveFilesCheckbox.checked;
                this.app.project.settings.imageCompression = {
                    enabled: compressionEnabledCheckbox.checked,
                    maxSizeMB: parseFloat(modal.querySelector('#projectFileMaxSizeMB').value) || 1,
                    maxWidthOrHeight: parseInt(modal.querySelector('#projectFileMaxDimension').value) || 1920,
                    quality: parseFloat(modal.querySelector('#projectFileQuality').value) || 0.75,
                    format: modal.querySelector('#projectFileFormat').value || 'webp'
                };
                
                this.app.markChanged();
                this.app.storageService.saveToStorage(false);
                
                closeModal();
            });
        });
    }

    /**
     * Show file settings modal for individual file
     */
    showFileSettingsModal(file, type) {
        const settings = this.app.project.settings || {};
        const fileSettings = file.settings || {
            saveInProject: settings.saveFilesInProject !== false,
            compression: {
                enabled: true,
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                quality: 0.75,
                format: 'webp'
            }
        };
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>File Settings</h2>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="setting-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; color: #ccc; font-weight: 600;">File Name:</label>
                        <div style="color: #888; font-size: 14px; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px;">
                            ${file.name || file.originalName || 'Unknown'}
                        </div>
                    </div>
                    
                    <div class="setting-group" style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer; margin-bottom: 8px;">
                            <input type="checkbox" id="fileSaveInProject" ${fileSettings.saveInProject ? 'checked' : ''}>
                            <span style="font-weight: 600;">Save file in project</span>
                        </label>
                        <small style="color: #999; font-size: 11px; display: block; margin-left: 24px;">When enabled, the file is embedded in the project file. When disabled, only the file path is saved.</small>
                    </div>
                    
                    <div id="fileCompressionSettings" style="${fileSettings.saveInProject ? '' : 'display: none;'}">
                        <h3 style="color: #ccc; font-size: 14px; margin: 20px 0 12px 0; font-weight: 600;">File Compression</h3>
                        
                        <div class="setting-group" style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 8px; color: #ccc; cursor: pointer; margin-bottom: 8px;">
                                <input type="checkbox" id="fileCompressionEnabled" ${fileSettings.compression?.enabled !== false ? 'checked' : ''}>
                                <span>Enable compression</span>
                            </label>
                        </div>
                        
                        <div id="fileCompressionOptions" style="${fileSettings.compression?.enabled !== false ? '' : 'display: none;'}">
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Max file size (MB):</label>
                                <input type="number" id="fileMaxSizeMB" value="${fileSettings.compression?.maxSizeMB || 1}" min="0.1" max="10" step="0.1" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Max dimension (pixels):</label>
                                <input type="number" id="fileMaxDimension" value="${fileSettings.compression?.maxWidthOrHeight || 1920}" min="100" max="4096" step="100" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Quality (0-1):</label>
                                <input type="number" id="fileQuality" value="${fileSettings.compression?.quality || 0.75}" min="0.1" max="1" step="0.05" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                            </div>
                            
                            <div class="setting-group">
                                <label style="display: block; margin-bottom: 6px; color: #ccc;">Format:</label>
                                <select id="fileFormat" style="width: 100%; padding: 8px; background: #252526; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                                    <option value="webp" ${fileSettings.compression?.format === 'webp' ? 'selected' : ''}>WebP</option>
                                    <option value="jpeg" ${fileSettings.compression?.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                                    <option value="png" ${fileSettings.compression?.format === 'png' ? 'selected' : ''}>PNG</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #444;">
                        <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: 600;">File Management</label>
                        <div style="display: flex; gap: 8px;">
                            <button id="fileReplaceBtn" class="btn btn-secondary" style="flex: 1; padding: 8px;">
                                <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
                                <span style="margin-left: 6px;">Replace File</span>
                            </button>
                            <button id="fileFindBtn" class="btn btn-secondary" style="flex: 1; padding: 8px;">
                                <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                                <span style="margin-left: 6px;">Find File</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 16px 20px; border-top: 1px solid #444; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="fileSettingsCancel" class="btn btn-secondary">Cancel</button>
                    <button id="fileSettingsSave" class="btn btn-primary">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Toggle compression settings visibility
        const saveInProjectCheckbox = modal.querySelector('#fileSaveInProject');
        const compressionSettings = modal.querySelector('#fileCompressionSettings');
        const compressionEnabledCheckbox = modal.querySelector('#fileCompressionEnabled');
        const compressionOptions = modal.querySelector('#fileCompressionOptions');
        
        saveInProjectCheckbox.addEventListener('change', () => {
            compressionSettings.style.display = saveInProjectCheckbox.checked ? 'block' : 'none';
        });
        
        compressionEnabledCheckbox.addEventListener('change', () => {
            compressionOptions.style.display = compressionEnabledCheckbox.checked ? 'block' : 'none';
        });
        
        // Replace file button
        const replaceBtn = modal.querySelector('#fileReplaceBtn');
        replaceBtn.addEventListener('click', async () => {
            const input = document.createElement('input');
            input.type = 'file';
            if (type === 'audio') {
                input.accept = 'audio/*';
            } else if (type === 'image') {
                input.accept = 'image/*';
            } else if (type === 'video') {
                input.accept = 'video/*';
            }
            
            input.addEventListener('change', async (e) => {
                const newFile = e.target.files[0];
                if (newFile) {
                    await this.replaceFile(file, newFile, type);
                    modal.remove();
                    this.renderFileList();
                }
            });
            
            input.click();
        });
        
        // Find file button
        const findBtn = modal.querySelector('#fileFindBtn');
        findBtn.addEventListener('click', async () => {
            if (file.filePath) {
                alert('File finder not yet implemented. File path: ' + file.filePath);
            } else {
                alert('No file path available for this file.');
            }
        });
        
        // Setup event listeners
        return new Promise((resolve) => {
            const closeModal = () => {
                modal.remove();
                resolve(null);
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#fileSettingsCancel').addEventListener('click', closeModal);
            
            modal.querySelector('#fileSettingsSave').addEventListener('click', () => {
                // Save file settings
                if (!file.settings) {
                    file.settings = {};
                }
                
                file.settings.saveInProject = saveInProjectCheckbox.checked;
                file.settings.compression = {
                    enabled: compressionEnabledCheckbox.checked,
                    maxSizeMB: parseFloat(modal.querySelector('#fileMaxSizeMB').value) || 1,
                    maxWidthOrHeight: parseInt(modal.querySelector('#fileMaxDimension').value) || 1920,
                    quality: parseFloat(modal.querySelector('#fileQuality').value) || 0.75,
                    format: modal.querySelector('#fileFormat').value || 'webp'
                };
                
                // Update file in project
                if (type === 'audio') {
                    const index = this.app.project.audioFiles.findIndex(f => f.name === file.name || f.id === file.id);
                    if (index !== -1) {
                        this.app.project.audioFiles[index] = file;
                    }
                } else if (type === 'image') {
                    const index = this.app.project.images.findIndex(f => f.name === file.name || f.id === file.id);
                    if (index !== -1) {
                        this.app.project.images[index] = file;
                    }
                }
                
                this.app.markChanged();
                this.app.storageService.saveToStorage(false);
                
                closeModal();
            });
        });
    }

    /**
     * Replace a file with a new one
     */
    async replaceFile(oldFile, newFile, type) {
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                
                if (type === 'audio') {
                    const index = this.app.project.audioFiles.findIndex(f => f.name === oldFile.name || f.id === oldFile.id);
                    if (index !== -1) {
                        this.app.project.audioFiles[index] = {
                            ...this.app.project.audioFiles[index],
                            name: newFile.name,
                            originalName: newFile.name,
                            url: dataUrl,
                            dataUrl: dataUrl,
                            file: newFile,
                            size: newFile.size,
                            type: newFile.type
                        };
                    }
                } else if (type === 'image') {
                    const index = this.app.project.images.findIndex(f => f.name === oldFile.name || f.id === oldFile.id);
                    if (index !== -1) {
                        let finalUrl = dataUrl;
                        const settings = this.app.project.images[index].settings || this.app.project.settings?.imageCompression;
                        
                        if (settings?.enabled !== false) {
                            const compressed = await this.compressImageFile(newFile, settings);
                            if (compressed) {
                                finalUrl = compressed;
                            }
                        }
                        
                        this.app.project.images[index] = {
                            ...this.app.project.images[index],
                            name: newFile.name,
                            originalName: newFile.name,
                            url: finalUrl,
                            file: newFile,
                            size: newFile.size,
                            type: newFile.type
                        };
                    }
                }
                
                this.renderFileList();
                this.renderTimeline();
                
                this.app.markChanged();
                this.app.storageService.saveToStorage(false);
                
                resolve();
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(newFile);
        });
    }

    /**
     * Compress image file
     */
    async compressImageFile(file, settings) {
        if (this.app.imageManager && this.app.imageManager.compressImage) {
            return await this.app.imageManager.compressImage(file, settings);
        }
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Delete file from project
     */
    async deleteFile(file, type) {
        // Check if file is used in timeline
        const clipsUsingFile = this.previsManager?.timeline.filter(clip => {
            if (type === 'audio') {
                return clip.isExternalFile && clip.fileType === 'audio' && 
                       (clip.fileId === file.name || clip.fileId === file.id);
            } else {
                return clip.isExternalFile && (clip.fileType === 'image' || clip.fileType === 'video') &&
                       (clip.fileId === file.name || clip.fileId === file.id);
            }
        }) || [];
        
        let shouldDelete = true;
        
        if (clipsUsingFile.length > 0) {
            // Ask for confirmation
            const confirmMessage = `This file is used in ${clipsUsingFile.length} clip(s) in the timeline. Deleting it will also remove these clips. Are you sure you want to delete "${file.name || file.originalName || 'this file'}"?`;
            shouldDelete = confirm(confirmMessage);
            
            if (shouldDelete) {
                // Remove clips from timeline
                clipsUsingFile.forEach(clip => {
                    const index = this.previsManager.timeline.findIndex(c => c.id === clip.id);
                    if (index !== -1) {
                        this.previsManager.timeline.splice(index, 1);
                    }
                });
                
                // Re-render timeline
                this.renderTimeline();
            }
        }
        
        if (shouldDelete) {
            // Remove file from project
            if (type === 'audio') {
                const index = this.app.project.audioFiles.findIndex(f => 
                    f.name === file.name || f.id === file.id
                );
                if (index !== -1) {
                    this.app.project.audioFiles.splice(index, 1);
                }
            } else {
                const index = this.app.project.customFiles.findIndex(f => 
                    f.name === file.name || f.id === file.id
                );
                if (index !== -1) {
                    this.app.project.customFiles.splice(index, 1);
                }
            }
            
            // Re-render file list
            this.renderFileList();
            
            // Mark project as changed
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        }
    }
    
    /**
     * Get audio file duration
     */
    async getAudioDuration(file) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.preload = 'metadata';
            
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audio.src);
                reject(new Error('Could not load audio file'));
            };
            
            // Handle both File objects and data URLs
            if (file instanceof File) {
                audio.src = URL.createObjectURL(file);
            } else if (typeof file === 'string') {
                audio.src = file;
            } else if (file.url || file.dataUrl) {
                audio.src = file.url || file.dataUrl;
            } else {
                reject(new Error('Invalid file format'));
            }
        });
    }
    
    /**
     * Generate waveform visualization for audio clip
     * @param {string} audioUrl - URL of the audio file
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     * @param {number} clipWidth - Width of the clip in pixels
     * @param {number} audioStartOffset - Start offset in seconds (for trimmed audio)
     * @param {number} audioEndOffset - End offset in seconds (for trimmed audio)
     */
    async generateWaveform(audioUrl, canvas, clipWidth, audioStartOffset = 0, audioEndOffset = null) {
        if (!audioUrl) {
            throw new Error('No audio URL provided');
        }
        
        try {
            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Fetch and decode audio
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get audio data
            const channelData = audioBuffer.getChannelData(0); // Use first channel
            const sampleRate = audioBuffer.sampleRate;
            const duration = audioBuffer.duration;
            
            // Calculate trim points in samples
            let startSample = Math.floor(audioStartOffset * sampleRate);
            let endSample = audioEndOffset !== null ? Math.floor(audioEndOffset * sampleRate) : channelData.length;
            let trimmedLength = Math.max(0, endSample - startSample);
            
            // Validate trimmed length
            if (trimmedLength <= 0 || startSample < 0 || endSample > channelData.length || startSample >= endSample) {
                console.warn('Invalid audio trim parameters:', { audioStartOffset, audioEndOffset, startSample, endSample, trimmedLength, fullLength: channelData.length });
                // Fallback: use full audio
                startSample = 0;
                endSample = channelData.length;
                trimmedLength = channelData.length;
            }
            
            
            // Calculate how many points to use for the waveform
            // Use many more points for smoother, more detailed waveform
            const numPoints = Math.max(100, Math.min(2000, Math.floor(clipWidth / 2)));
            const samplesPerPoint = trimmedLength > 0 ? Math.floor(trimmedLength / numPoints) : 1;
            
            // Set canvas size
            const height = canvas.parentElement.clientHeight || 80;
            canvas.width = clipWidth;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw waveform as a smooth line
            const centerY = height / 2;
            const maxAmplitude = height * 0.45; // Use 45% of height for waveform
            
            ctx.strokeStyle = '#4CAF50';
            ctx.fillStyle = '#4CAF50';
            ctx.lineWidth = 1;
            
            // Draw waveform as filled area for better visibility
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            
            const pointWidth = clipWidth / numPoints;
            
            for (let i = 0; i < numPoints; i++) {
                const segmentStart = startSample + (i * samplesPerPoint);
                const segmentEnd = Math.min(segmentStart + samplesPerPoint, endSample);
                
                // Calculate RMS (root mean square) for this segment
                let sum = 0;
                let count = 0;
                for (let j = segmentStart; j < segmentEnd && j < channelData.length; j++) {
                    sum += channelData[j] * channelData[j];
                    count++;
                }
                const rms = count > 0 ? Math.sqrt(sum / count) : 0;
                
                // Convert to amplitude (0-1) and scale
                const amplitude = Math.min(1, rms * 3); // Amplify for visibility
                const waveHeight = amplitude * maxAmplitude;
                
                const x = i * pointWidth;
                const y = centerY - waveHeight;
                ctx.lineTo(x, y);
            }
            
            // Complete the waveform shape (mirror bottom half)
            for (let i = numPoints - 1; i >= 0; i--) {
                const segmentStart = startSample + (i * samplesPerPoint);
                const segmentEnd = Math.min(segmentStart + samplesPerPoint, endSample);
                
                let sum = 0;
                let count = 0;
                for (let j = segmentStart; j < segmentEnd && j < channelData.length; j++) {
                    sum += channelData[j] * channelData[j];
                    count++;
                }
                const rms = count > 0 ? Math.sqrt(sum / count) : 0;
                const amplitude = Math.min(1, rms * 3);
                const waveHeight = amplitude * maxAmplitude;
                
                const x = i * pointWidth;
                const y = centerY + waveHeight;
                ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Draw center line for reference
            ctx.strokeStyle = '#2a5a2a';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(canvas.width, centerY);
            ctx.stroke();
            
        } catch (error) {
            console.error('Error generating waveform:', error);
            throw error;
        }
    }
}
