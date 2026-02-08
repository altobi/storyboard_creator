/**
 * PrevisManager
 * Manages the previsualization timeline, frame sequencing, and playback logic
 */
class PrevisManager {
    constructor(app) {
        this.app = app;
        this.timeline = [];
        this.currentTime = 0.0; // Current playback position in seconds
        this.isPlaying = false;
        this.frameRate = 24; // Default frame rate (from project settings)
        this.totalDuration = 0.0; // Total timeline duration in seconds
        this.zoomLevel = 1.0; // Timeline zoom (1x = 1 second per 100px)
        this.playbackInterval = null;
        this.onTimeUpdate = null; // Callback for time updates
        this.onFrameChange = null; // Callback for frame changes
        this.snapEnabled = true; // Snapping enabled by default
        this.snapToFrames = true; // Snap to frame boundaries
        this.snapToClips = true; // Snap to clip edges
        this.isLooping = true; // Playback loop enabled by default
        this.timeDisplayMode = 'timecode'; // 'timecode' or 'frames'
        this.audioElements = new Map(); // Map of audio clip IDs to HTMLAudioElement
        this.audioVolume = 1.0; // Master audio volume (0.0 to 1.0)
    }

    /**
     * Initialize timeline from storyboard images
     */
    buildTimelineFromStoryboard() {
        
        // Preserve external files (audio/video clips added by user) WITH their positions and trackIds
        const externalFiles = this.timeline.filter(clip => clip.isExternalFile === true).map(clip => ({
            ...clip,
            // Preserve all properties including trackId, startTime, endTime
            trackId: clip.trackId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration
        }));
        
        // Preserve custom durations from existing storyboard clips before rebuilding
        // Map: imageId -> { duration, customDuration, startTime }
        const customDurations = new Map();
        this.timeline.forEach(clip => {
            if (!clip.isExternalFile && clip.imageId && (clip.customDuration || clip.duration !== 1.0)) {
                customDurations.set(clip.imageId, {
                    duration: clip.duration,
                    customDuration: clip.customDuration,
                    startTime: clip.startTime
                });
            }
        });
        
        this.timeline = [];
        
        // Get sorted images from storyboard
        const images = [...this.app.project.images];
        
        // Sort by Scene → Shot → Frame
        images.sort((a, b) => {
            // Scene comparison
            const sceneA = parseInt(a.sceneNumber) || 0;
            const sceneB = parseInt(b.sceneNumber) || 0;
            if (sceneA !== sceneB) return sceneA - sceneB;
            
            // Shot comparison
            const shotA = parseInt(a.shotNumber) || 0;
            const shotB = parseInt(b.shotNumber) || 0;
            if (shotA !== shotB) return shotA - shotB;
            
            // Frame comparison
            const frameA = parseInt(a.frameNumber) || 0;
            const frameB = parseInt(b.frameNumber) || 0;
            return frameA - frameB;
        });

        // Group images by shot to calculate durations
        const shotGroups = new Map();
        images.forEach(image => {
            const sceneNum = image.sceneNumber || '';
            const shotNum = image.shotNumber || '';
            const key = `${sceneNum}_${shotNum}`;
            
            if (!shotGroups.has(key)) {
                shotGroups.set(key, []);
            }
            shotGroups.get(key).push(image);
        });

        // Build timeline clips
        let currentStartTime = 0.0;
        
        shotGroups.forEach((shotImages, shotKey) => {
            const frameCount = shotImages.length;
            // Default to 1 second per frame
            const defaultFrameDuration = 1.0;
            
            // Calculate total duration from sum of frame durations
            // Use preserved custom durations if available, otherwise use default
            let totalFrameDuration = 0;
            shotImages.forEach(image => {
                const preservedDuration = customDurations.get(image.name);
                totalFrameDuration += preservedDuration ? preservedDuration.duration : defaultFrameDuration;
            });
            
            // Update shot duration in shot list to match sum of frame durations
            this.updateShotDurationFromFrames(shotImages[0], totalFrameDuration);

            // Create clip for each frame in the shot
            shotImages.forEach((image, index) => {
                // Check if we have a preserved custom duration for this image
                const preservedDuration = customDurations.get(image.name);
                const clipDuration = preservedDuration ? preservedDuration.duration : defaultFrameDuration;
                
                const clip = {
                    id: `clip_${image.name || `frame_${currentStartTime}`}`,
                    imageId: image.name,
                    imageUrl: image.url || image.compositeUrl || '',
                    startTime: currentStartTime,
                    duration: clipDuration,
                    endTime: currentStartTime + clipDuration,
                    sceneNumber: image.sceneNumber || '',
                    shotNumber: image.shotNumber || '',
                    frameNumber: image.frameNumber || '',
                    thumbnail: image.url || image.compositeUrl || '', // Use same URL for now
                    customDuration: preservedDuration ? preservedDuration.customDuration : false,
                    shotKey: shotKey,
                    trackId: 'video_1' // Default storyboard clips to video_1 track
                };
                
                this.timeline.push(clip);
                // Update currentStartTime based on actual clip end time
                currentStartTime = clip.endTime;
            });
        });

        this.totalDuration = currentStartTime;
        this.calculateDefaultDurations();
        
        // Restore external files (custom imported images/audio) after rebuilding storyboard clips
        // CRITICAL: Preserve their original positions and trackIds - do NOT reset them
        externalFiles.forEach(externalClip => {
            // Preserve the original clip with all its properties
            this.timeline.push(externalClip);
        });// Recalculate total duration including external files
        const allClips = [...this.timeline].sort((a, b) => a.startTime - b.startTime);
        if (allClips.length > 0) {
            const lastClip = allClips[allClips.length - 1];
            this.totalDuration = Math.max(this.totalDuration, lastClip.endTime || lastClip.startTime + lastClip.duration);
        }
        
        return this.timeline;
    }

    /**
     * Get shot duration from shot list or use default
     */
    getShotDuration(image) {
        if (!this.app.shotListManager) {
            return 5.0; // Default 5 seconds if no shot list
        }

        const shots = this.app.shotListManager.getAllShots();
        const shot = shots.find(s => 
            s.sceneNumber === image.sceneNumber && 
            s.shotNumber === image.shotNumber
        );

        if (shot && shot.durationFrames) {
            // Convert frames to seconds
            const frameRate = this.app.project.settings?.frameRate || 24;
            return shot.durationFrames / frameRate;
        }

        return 5.0; // Default 5 seconds per shot
    }

    /**
     * Update shot duration in shot list from sum of frame durations
     */
    updateShotDurationFromFrames(image, totalDurationSeconds) {
        if (!this.app.shotListManager) return;

        const shots = this.app.shotListManager.getAllShots();
        const shot = shots.find(s => 
            s.sceneNumber === image.sceneNumber && 
            s.shotNumber === image.shotNumber
        );

        if (shot) {
            const frameRate = this.app.project.settings?.frameRate || 24;
            const totalFrames = Math.round(totalDurationSeconds * frameRate);
            shot.durationFrames = totalFrames;
            shot.durationSeconds = totalDurationSeconds;
            
            // Update shot list display if controller exists
            if (this.app.shotListController) {
                this.app.shotListController.renderShotList();
            }
        }
    }

    /**
     * Proportionally scale frame durations when shot duration changes
     */
    scaleFrameDurationsForShot(sceneNumber, shotNumber, newShotDurationSeconds) {// Find all clips in this shot
        const shotClips = this.timeline.filter(clip => 
            clip.sceneNumber === sceneNumber && 
            clip.shotNumber === shotNumber &&
            !clip.isExternalFile // Only storyboard clips
        );if (shotClips.length === 0) {
            console.warn(`No clips found for shot ${sceneNumber}/${shotNumber}`);
            return;
        }

        // Sort clips by start time to maintain order
        shotClips.sort((a, b) => a.startTime - b.startTime);

        // Calculate current total duration
        const currentTotalDuration = shotClips.reduce((sum, clip) => sum + clip.duration, 0);
        
        if (currentTotalDuration === 0 || newShotDurationSeconds === 0) {
            // If no duration, set all frames to equal duration
            const frameDuration = newShotDurationSeconds > 0 ? newShotDurationSeconds / shotClips.length : 1.0;
            let currentStartTime = shotClips[0].startTime;
            shotClips.forEach(clip => {
                clip.duration = frameDuration;
                clip.startTime = currentStartTime;
                clip.endTime = currentStartTime + clip.duration;
                currentStartTime = clip.endTime;
            });
        } else {
            // Calculate scale factor
            const scaleFactor = newShotDurationSeconds / currentTotalDuration;
            
            // Scale each frame duration proportionally
            // Mark all clips as having custom duration to prevent recalculateTimelinePositions from resetting them
            let currentStartTime = shotClips[0].startTime;
            shotClips.forEach(clip => {
                const oldDuration = clip.duration;
                clip.duration = clip.duration * scaleFactor;
                clip.customDuration = true; // Mark as custom to preserve scaled duration
                clip.startTime = currentStartTime;
                clip.endTime = currentStartTime + clip.duration;
                currentStartTime = clip.endTime;
            });}

        // CRITICAL: Ensure all storyboard clips have trackId before recalculation
        // This prevents them from being excluded from track-specific recalculation
        shotClips.forEach(clip => {
            if (!clip.trackId && !clip.isExternalFile) {
                clip.trackId = 'video_1';
            }
        });// Recalculate timeline positions (this updates start times for subsequent shots)
        // CRITICAL: Only recalculate video_1 track to preserve external files on other tracks
        // Note: This will preserve custom durations, so our scaled durations won't be reset
        this.recalculateTimelinePositions('video_1');// Trigger timeline re-render if controller exists
        if (this.app.previsController) {
            this.app.previsController.renderTimeline();
        }
    }

    /**
     * Calculate default frame durations based on shot lengths
     */
    calculateDefaultDurations() {
        // Group clips by shot
        const shotGroups = new Map();
        this.timeline.forEach(clip => {
            if (!shotGroups.has(clip.shotKey)) {
                shotGroups.set(clip.shotKey, []);
            }
            shotGroups.get(clip.shotKey).push(clip);
        });

        // Recalculate durations for each shot
        let currentStartTime = 0.0;
        
        shotGroups.forEach((clips, shotKey) => {
            if (clips.length === 0) return;

            // Get shot duration from shot list
            const firstClip = clips[0];
            const shotDuration = this.getShotDuration({
                sceneNumber: firstClip.sceneNumber,
                shotNumber: firstClip.shotNumber
            });
            
            // Only recalculate if not custom duration
            // Note: After scaling, all clips in a shot should maintain their relative durations
            // So we only recalculate if ALL clips don't have custom durations
            const customDurations = clips.filter(c => c.customDuration);
            if (customDurations.length === 0) {
                // All clips use default duration - distribute shot duration evenly
                const defaultFrameDuration = shotDuration / clips.length;
                
                clips.forEach((clip, index) => {
                    clip.duration = defaultFrameDuration;
                    clip.startTime = currentStartTime;
                    clip.endTime = currentStartTime + defaultFrameDuration;
                    currentStartTime = clip.endTime;
                });
            } else {
                // Some clips have custom durations, preserve them and distribute remaining duration
                const customTotalDuration = customDurations.reduce((sum, c) => sum + c.duration, 0);
                const remainingDuration = shotDuration - customTotalDuration;
                const remainingFrames = clips.length - customDurations.length;
                
                clips.forEach(clip => {
                    if (!clip.customDuration) {
                        clip.duration = remainingFrames > 0 ? remainingDuration / remainingFrames : 1.0;
                    }
                    clip.startTime = currentStartTime;
                    clip.endTime = currentStartTime + clip.duration;
                    currentStartTime = clip.endTime;
                });
            }
        });

        this.totalDuration = currentStartTime;
    }

    /**
     * Get frame/clip at a specific time
     * Prioritizes video/image clips over audio clips for preview display
     */
    getClipAtTime(time) {
        // Find all video/image clips at this time
        const videoClips = this.timeline.filter(clip => {
            const isVideoOrImage = !clip.isExternalFile || (clip.fileType === 'video' || clip.fileType === 'image');
            return isVideoOrImage && time >= clip.startTime && time < clip.endTime;
        });
        
        // If we found video/image clips, prioritize by track (highest track number first)
        if (videoClips.length > 0) {
            // Get track numbers for each clip (need to access previsController for track assignments)
            if (this.app.previsController) {
                // Sort by track number (highest first)
                videoClips.sort((a, b) => {
                    const trackIdA = a.trackId || this.app.previsController.clipTrackAssignments.get(a.id);
                    const trackIdB = b.trackId || this.app.previsController.clipTrackAssignments.get(b.id);
                    
                    // Find track objects to get track numbers
                    const trackA = this.app.previsController.videoTracks.find(t => t.id === trackIdA);
                    const trackB = this.app.previsController.videoTracks.find(t => t.id === trackIdB);
                    
                    // Get track numbers - prefer track object, fallback to parsing trackId
                    let trackNumA = 1; // Default to 1 (Video 1)
                    let trackNumB = 1;
                    
                    if (trackA) {
                        trackNumA = trackA.trackNumber || 1;
                    } else if (trackIdA) {
                        const match = trackIdA.match(/video_(\d+)/);
                        if (match) trackNumA = parseInt(match[1]);
                    }
                    
                    if (trackB) {
                        trackNumB = trackB.trackNumber || 1;
                    } else if (trackIdB) {
                        const match = trackIdB.match(/video_(\d+)/);
                        if (match) trackNumB = parseInt(match[1]);
                    }
                    
                    // Higher track number first (descending order)
                    return trackNumB - trackNumA;
                });
            }
            return videoClips[0]; // Return clip from highest track
        }
        
        // Otherwise, return any clip at this time (audio or other)
        return this.timeline.find(clip => 
            time >= clip.startTime && time < clip.endTime
        );
    }

    /**
     * Get current frame image URL
     */
    getCurrentFrameUrl() {
        const clip = this.getClipAtTime(this.currentTime);
        return clip ? clip.imageUrl : null;
    }

    /**
     * Update clip duration
     */
    updateClipDuration(clipId, newDuration) {const clip = this.timeline.find(c => c.id === clipId);
        if (!clip) {return false;
        }clip.duration = Math.max(0.1, newDuration); // Minimum 0.1 seconds
        clip.endTime = clip.startTime + clip.duration;
        clip.customDuration = true;
        
        // CRITICAL: Ensure storyboard clips have a trackId (default to video_1)
        // This prevents recalculateTimelinePositions from recalculating all tracks
        if (!clip.trackId && !clip.isExternalFile) {
            clip.trackId = 'video_1';
        }// Recalculate positions of subsequent clips on the SAME TRACK ONLY
        // This prevents external clips on other tracks from being movedthis.recalculateTimelinePositions(clip.trackId);return true;
    }

    /**
     * Move clip to new start time
     */
    moveClip(clipId, newStartTime) {
        const clip = this.timeline.find(c => c.id === clipId);
        if (!clip) return false;


        // Ensure new start time is valid
        newStartTime = Math.max(0, newStartTime);
        
        // Determine clip type
        const clipType = clip.fileType || (clip.isExternalFile ? 'unknown' : 'video');
        
        // For audio clips, only check edge-to-edge snapping on the same track
        // For video clips, check overlaps normally
        let overlappingClip = null;
        
        if (clipType === 'audio') {
            // Audio clips: replace overlapping clips on the same track
            // Find all overlapping audio clips on the same track
            const overlappingClips = this.timeline.filter(c => {
                if (c.id === clipId) return false; // Skip self
                if (c.fileType !== 'audio') return false; // Only check audio clips
                
                // Must be on the same track
                if (!clip.trackId || !c.trackId || clip.trackId !== c.trackId) return false;
                
                // Check for actual overlap (not just edge snapping)
                const clipLeftEdge = newStartTime;
                const clipRightEdge = newStartTime + clip.duration;
                const otherLeftEdge = c.startTime;
                const otherRightEdge = c.endTime;
                
                // Check if there's an overlap (clips intersect)
                return clipLeftEdge < otherRightEdge && clipRightEdge > otherLeftEdge;
            });
            
            // Trim/split overlapping clips instead of deleting them
            if (overlappingClips.length > 0) {
                const draggedClipStart = newStartTime;
                const draggedClipEnd = newStartTime + clip.duration;
                const clipsToDelete = [];
                const clipsToAdd = [];
                
                overlappingClips.forEach(overlappingClip => {
                    const existingStart = overlappingClip.startTime;
                    const existingEnd = overlappingClip.endTime;
                    const existingDuration = overlappingClip.duration;
                    const existingAudioStartOffset = overlappingClip.audioStartOffset || 0;
                    const existingAudioEndOffset = overlappingClip.audioEndOffset || (overlappingClip.originalAudioDuration || existingDuration);
                    const originalAudioDuration = overlappingClip.originalAudioDuration || existingDuration;
                    
                    // Calculate overlap region
                    const overlapStart = Math.max(draggedClipStart, existingStart);
                    const overlapEnd = Math.min(draggedClipEnd, existingEnd);
                    const overlapDuration = overlapEnd - overlapStart;
                    
                    // Determine overlap scenario
                    const fullyCovers = draggedClipStart <= existingStart && draggedClipEnd >= existingEnd;
                    const overlapsFromLeft = draggedClipStart < existingStart && draggedClipEnd > existingStart && draggedClipEnd < existingEnd;
                    const overlapsFromRight = draggedClipStart > existingStart && draggedClipStart < existingEnd && draggedClipEnd > existingEnd;
                    const overlapsInMiddle = draggedClipStart > existingStart && draggedClipEnd < existingEnd;
                    
                    if (fullyCovers) {
                        // Dragged clip fully covers existing clip - delete it
                        clipsToDelete.push(overlappingClip.id);
                    } else if (overlapsFromLeft) {
                        // Trim the beginning of existing clip
                        // The overlap is from existingStart to draggedClipEnd
                        // So we remove the portion from existingStart to draggedClipEnd
                        const trimAmount = overlapDuration; // Use actual overlap duration
                        const newStartTime = draggedClipEnd; // Clip now starts where dragged clip ends
                        const newDuration = existingDuration - trimAmount;
                        if (newDuration < 0.1) {
                            // Too small, delete it
                            clipsToDelete.push(overlappingClip.id);
                        } else {
                            // Update existing clip
                            overlappingClip.startTime = newStartTime;
                            overlappingClip.duration = newDuration;
                            overlappingClip.endTime = newStartTime + newDuration;
                            
                            // Update audio offsets: trim from the beginning
                            // The trimmed portion corresponds to the overlap in the original audio
                            const audioTrimRatio = trimAmount / existingDuration;
                            const audioTrimAmount = (existingAudioEndOffset - existingAudioStartOffset) * audioTrimRatio;
                            overlappingClip.audioStartOffset = existingAudioStartOffset + audioTrimAmount;
                            overlappingClip.audioEndOffset = existingAudioEndOffset;
                            
                            // Invalidate audio element so it gets recreated with new offsets
                            if (this.audioElements.has(overlappingClip.id)) {
                                const audio = this.audioElements.get(overlappingClip.id);
                                audio.pause();
                                audio.src = '';
                                this.audioElements.delete(overlappingClip.id);
                            }
                        }
                    } else if (overlapsFromRight) {
                        // Trim the end of existing clip
                        // The overlap is from draggedClipStart to existingEnd
                        // The new end time should be draggedClipStart (where the dragged clip begins)
                        const trimAmount = overlapDuration; // Use actual overlap duration
                        const newEndTime = draggedClipStart; // Clip ends where dragged clip starts
                        const newDuration = newEndTime - existingStart; // Duration from start to new end
                        if (newDuration < 0.1) {
                            // Too small, delete it
                            clipsToDelete.push(overlappingClip.id);
                        } else {
                            // Update existing clip (startTime stays the same)
                            overlappingClip.duration = newDuration;
                            overlappingClip.endTime = newEndTime; // Set to dragged clip start, not calculated
                            
                            // Update audio offsets: trim from the end
                            // The trimmed portion corresponds to the overlap in the original audio
                            const audioTrimRatio = trimAmount / existingDuration;
                            const audioTrimAmount = (existingAudioEndOffset - existingAudioStartOffset) * audioTrimRatio;
                            overlappingClip.audioStartOffset = existingAudioStartOffset;
                            overlappingClip.audioEndOffset = existingAudioEndOffset - audioTrimAmount;
                            
                            // Invalidate audio element so it gets recreated with new offsets
                            if (this.audioElements.has(overlappingClip.id)) {
                                const audio = this.audioElements.get(overlappingClip.id);
                                audio.pause();
                                audio.src = '';
                                this.audioElements.delete(overlappingClip.id);
                            }
                        }
                    } else if (overlapsInMiddle) {
                        // Split existing clip into two: before and after the dragged clip
                        const beforeDuration = draggedClipStart - existingStart;
                        const afterDuration = existingEnd - draggedClipEnd;
                        
                        // Update existing clip to be the "before" portion
                        if (beforeDuration < 0.1) {
                            // Before portion too small, delete existing clip
                            clipsToDelete.push(overlappingClip.id);
                        } else {
                            overlappingClip.duration = beforeDuration;
                            overlappingClip.endTime = draggedClipStart;
                            
                            // Update audio offsets for "before" portion
                            const beforeRatio = beforeDuration / existingDuration;
                            const beforeAudioDuration = (existingAudioEndOffset - existingAudioStartOffset) * beforeRatio;
                            overlappingClip.audioStartOffset = existingAudioStartOffset;
                            overlappingClip.audioEndOffset = existingAudioStartOffset + beforeAudioDuration;
                            
                            // Invalidate audio element so it gets recreated with new offsets
                            if (this.audioElements.has(overlappingClip.id)) {
                                const audio = this.audioElements.get(overlappingClip.id);
                                audio.pause();
                                audio.src = '';
                                this.audioElements.delete(overlappingClip.id);
                            }
                        }
                        
                        // Create new clip for "after" portion
                        if (afterDuration >= 0.1) {
                            const afterAudioRatio = afterDuration / existingDuration;
                            const afterAudioDuration = (existingAudioEndOffset - existingAudioStartOffset) * afterAudioRatio;
                            const afterAudioStartOffset = existingAudioEndOffset - afterAudioDuration;
                            
                            const newClip = {
                                ...overlappingClip,
                                id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                startTime: draggedClipEnd,
                                duration: afterDuration,
                                endTime: draggedClipEnd + afterDuration,
                                audioStartOffset: afterAudioStartOffset,
                                audioEndOffset: existingAudioEndOffset,
                                originalAudioDuration: originalAudioDuration
                            };
                            clipsToAdd.push(newClip);
                        }
                    }
                });
                
                // Delete clips that are too small or fully covered
                clipsToDelete.forEach(clipId => {
                    const index = this.timeline.findIndex(c => c.id === clipId);
                    if (index !== -1) {
                        const clipToDelete = this.timeline[index];
                        this.timeline.splice(index, 1);
                        
                        // Clean up audio element
                        if (this.audioElements.has(clipId)) {
                            const audio = this.audioElements.get(clipId);
                            audio.pause();
                            audio.src = '';
                            this.audioElements.delete(clipId);
                        }
                        
                        // Remove from clip track assignments
                        if (this.app.previsController && this.app.previsController.clipTrackAssignments) {
                            this.app.previsController.clipTrackAssignments.delete(clipId);
                        }
                    }
                });
                
                // Add new clips created from splits
                clipsToAdd.forEach(newClip => {
                    this.timeline.push(newClip);
                    if (this.app.previsController && this.app.previsController.clipTrackAssignments) {
                        this.app.previsController.clipTrackAssignments.set(newClip.id, newClip.trackId);
                    }
                });
                
                // Update total duration
                const maxEndTime = Math.max(...this.timeline.map(c => c.endTime || 0));
                // Use actual max end time with small fixed buffer (1 second or 5%, whichever is smaller)
                const buffer = Math.min(1.0, maxEndTime * 0.05);
                this.totalDuration = maxEndTime + buffer;
                // Return a flag indicating clips were modified (so UI can re-render)
                clip._overlappingClipsModified = true;
            }
        } else {
            // Video clips: check overlaps normally (same type, same track)
            // CRITICAL: For external files (especially audio), only check overlaps with clips on the SAME TRACK
            // This allows clips on different tracks to overlap at the same time position
            overlappingClip = this.timeline.find(c => {
            if (c.id === clipId) return false; // Skip self
            
            // Determine other clip's type
            const otherClipType = c.fileType || (c.isExternalFile ? 'unknown' : 'video');
            
            // Only check overlaps with clips of the same type
            if (clipType !== otherClipType) return false;
            
            // CRITICAL: For external files, only check overlaps on the same track
            // This allows audio clips on different tracks to overlap
            if (clip.isExternalFile && c.isExternalFile) {
                const clipTrackId = clip.trackId;
                const otherTrackId = c.trackId;
                
                // If both have trackIds, they must match
                if (clipTrackId && otherTrackId) {
                    if (clipTrackId !== otherTrackId) {
                        return false; // Different tracks - allow overlap
                    }
                } else if (clipTrackId || otherTrackId) {
                    // One has trackId, other doesn't - don't check overlap
                    return false;
                }
                // If neither has trackId, check overlap (legacy behavior)
            } else if (!clip.isExternalFile && !c.isExternalFile) {
                // For storyboard clips, check trackId if available
                const clipTrackId = clip.trackId || 'video_1';
                const otherTrackId = c.trackId || 'video_1';
                if (clipTrackId !== otherTrackId) {
                    return false; // Different tracks - allow overlap
                }
            }
            
            // Check for actual overlap
            return newStartTime < c.endTime && newStartTime + clip.duration > c.startTime;
            });
            
            if (overlappingClip) {
                // Snap to end of previous clip or start of next clip
                if (newStartTime < overlappingClip.startTime) {
                    newStartTime = overlappingClip.startTime - clip.duration;
                } else {
                    newStartTime = overlappingClip.endTime;
                }
            }
        }

        clip.startTime = newStartTime;
        clip.endTime = newStartTime + clip.duration;
        

        // DON'T recalculate timeline positions for external files - it will move them!
        // Only recalculate for storyboard clips to maintain sequential order
        if (!clip.isExternalFile) {
            // CRITICAL: Ensure storyboard clips have a trackId before recalculation
            if (!clip.trackId) {
                clip.trackId = 'video_1';
            }
            // Only recalculate the specific track to preserve external files on other tracks
            this.recalculateTimelinePositions(clip.trackId);
        } else {
            // For external files, just update total duration if needed
            const maxEndTime = Math.max(...this.timeline.map(c => c.endTime || 0));
            this.totalDuration = maxEndTime * 1.05;
        }
        
        return true;
    }

    /**
     * Recalculate timeline positions after changes
     * This ensures clips are positioned sequentially without gaps or overlaps
     * @param {string} trackId - Optional: Only recalculate clips on this track. If not provided, recalculates all tracks.
     */
    recalculateTimelinePositions(trackId = null) {
        // If trackId is provided, only recalculate clips on that track
        // External clips on other tracks should be completely preserved
        if (trackId) {
            // CRITICAL: Ensure all storyboard clips have a trackId (default to video_1 if missing)
            // This prevents them from being excluded from recalculation
            this.timeline.forEach(clip => {
                if (!clip.isExternalFile && !clip.trackId) {
                    clip.trackId = 'video_1';
                }
            });
            
            // Separate clips on this track vs other tracks
            const clipsOnThisTrack = this.timeline.filter(c => c.trackId === trackId);
            const clipsOnOtherTracks = this.timeline.filter(c => c.trackId !== trackId);
            
            // Store positions of clips on other tracks BEFORE any changes
            const clipsOnOtherTracksBefore = clipsOnOtherTracks.map(c => ({id:c.id,startTime:c.startTime,endTime:c.endTime,trackId:c.trackId,isExternalFile:c.isExternalFile}));// Only recalculate storyboard clips on this track
            const storyboardClipsOnTrack = clipsOnThisTrack.filter(c => !c.isExternalFile);
            
            // Group storyboard clips by shot
            const shotGroups = new Map();
            storyboardClipsOnTrack.forEach(clip => {
                const key = `${clip.sceneNumber}_${clip.shotNumber}`;
                if (!shotGroups.has(key)) {
                    shotGroups.set(key, []);
                }
                shotGroups.get(key).push(clip);
            });
            
            // Sort shot groups by earliest start time
            const sortedShotGroups = Array.from(shotGroups.entries()).sort((a, b) => {
                const minA = Math.min(...a[1].map(c => c.startTime));
                const minB = Math.min(...b[1].map(c => c.startTime));
                return minA - minB;
            });
            
            // Recalculate start times sequentially for storyboard clips on this track
            let currentStartTime = 0.0;
            sortedShotGroups.forEach(([shotKey, clips]) => {
                clips.sort((a, b) => a.startTime - b.startTime);
                clips.forEach(clip => {
                    clip.startTime = currentStartTime;
                    clip.endTime = currentStartTime + clip.duration;
                    currentStartTime = clip.endTime;
                });
            });
            
            // External clips on this track should be preserved unless they overlap with storyboard clips
            const externalClipsOnTrack = clipsOnThisTrack.filter(c => c.isExternalFile);
            const lastStoryboardEndOnTrack = sortedShotGroups.length > 0 
                ? Math.max(...sortedShotGroups.flatMap(([_, clips]) => clips.map(c => c.endTime)))
                : 0.0;
            
            externalClipsOnTrack.forEach(clip => {
                // Only move if it overlaps with storyboard clips on the same track
                if (clip.startTime < lastStoryboardEndOnTrack) {
                    clip.startTime = lastStoryboardEndOnTrack;
                }
                clip.endTime = clip.startTime + clip.duration;
            });
            
            // CRITICAL: Clips on other tracks are completely untouched - verify this!
            const clipsOnOtherTracksAfter = clipsOnOtherTracks.map(c => ({id:c.id,startTime:c.startTime,endTime:c.endTime,trackId:c.trackId,isExternalFile:c.isExternalFile}));
            const clipsOnOtherTracksChanged = clipsOnOtherTracksBefore.filter((before, idx) => {
                const after = clipsOnOtherTracksAfter[idx];
                return after && (after.startTime !== before.startTime || after.endTime !== before.endTime);
            });if (clipsOnOtherTracksChanged.length > 0) {
                console.error('[ERROR] Clips on other tracks were modified during track-specific recalculation!', clipsOnOtherTracksChanged);
            }
            
            // Just update total duration
            const allClips = [...clipsOnThisTrack, ...clipsOnOtherTracks];
            if (allClips.length > 0) {
                const maxEndTime = Math.max(...allClips.map(clip => clip.endTime || 0));
                // Use actual max end time with small fixed buffer (1 second or 5%, whichever is smaller)
                const buffer = Math.min(1.0, maxEndTime * 0.05);
                this.totalDuration = maxEndTime + buffer;
            }return;
        }
        
        // Original behavior: recalculate all tracks (for backward compatibility)
        // Separate clips by type (storyboard vs external) and track
        const storyboardClips = this.timeline.filter(c => !c.isExternalFile);
        const externalClips = this.timeline.filter(c => c.isExternalFile);
        
        // Group storyboard clips by shot to maintain shot grouping
        const shotGroups = new Map();
        storyboardClips.forEach(clip => {
            const key = `${clip.sceneNumber}_${clip.shotNumber}`;
            if (!shotGroups.has(key)) {
                shotGroups.set(key, []);
            }
            shotGroups.get(key).push(clip);
        });
        
        // Sort shot groups by the earliest start time in each group
        const sortedShotGroups = Array.from(shotGroups.entries()).sort((a, b) => {
            const minA = Math.min(...a[1].map(c => c.startTime));
            const minB = Math.min(...b[1].map(c => c.startTime));
            return minA - minB;
        });
        
        // Recalculate start times sequentially for storyboard clips
        let currentStartTime = 0.0;
        sortedShotGroups.forEach(([shotKey, clips]) => {
            // Sort clips within shot by their original start time
            clips.sort((a, b) => a.startTime - b.startTime);
            
            // Update start times for all clips in this shot
            clips.forEach(clip => {
                clip.startTime = currentStartTime;
                clip.endTime = currentStartTime + clip.duration;
                currentStartTime = clip.endTime;
            });
        });
        
        // For external clips, preserve their original startTime positions
        // They should not be moved by recalculateTimelinePositions unless they overlap with storyboard clips
        externalClips.sort((a, b) => a.startTime - b.startTime);
        
        // Find the last storyboard clip end time
        const lastStoryboardEnd = sortedShotGroups.length > 0 
            ? Math.max(...sortedShotGroups.flatMap(([_, clips]) => clips.map(c => c.endTime)))
            : 0.0;
        
        // Store external clips start times before modification
        const externalClipsBefore = externalClips.map(c => ({id:c.id,startTime:c.startTime,trackId:c.trackId}));
        
        // Only move external clips if they overlap with storyboard clips
        externalClips.forEach(clip => {
            // If external clip overlaps with storyboard (starts before last storyboard ends), move it after
            if (clip.startTime < lastStoryboardEnd) {
                clip.startTime = lastStoryboardEnd;
            }
            // Otherwise, preserve the original startTime
            clip.endTime = clip.startTime + clip.duration;
        });
        
        // Sort all clips by start time
        this.timeline.sort((a, b) => a.startTime - b.startTime);

        // Recalculate total duration - find the maximum endTime across ALL clips
        // Add a small buffer (5%) to ensure we can see the end of clips
        if (this.timeline.length > 0) {
            const maxEndTime = Math.max(...this.timeline.map(clip => clip.endTime || 0));
            // Use actual max end time with small fixed buffer (1 second or 5%, whichever is smaller)
            const buffer = Math.min(1.0, maxEndTime * 0.05);
            this.totalDuration = maxEndTime + buffer;
        } else {
            this.totalDuration = 0.0;
        }}

    /**
     * Delete clip from timeline
     */
    deleteClip(clipId) {
        const index = this.timeline.findIndex(c => c.id === clipId);
        if (index === -1) return false;

        // Get the clip's trackId before deleting (for track-specific recalculation)
        const clip = this.timeline[index];
        const trackId = clip.trackId || (!clip.isExternalFile ? 'video_1' : (clip.fileType === 'audio' ? 'audio_1' : 'video_1'));

        this.timeline.splice(index, 1);
        
        // CRITICAL: Only recalculate the specific track to preserve external files on other tracks
        this.recalculateTimelinePositions(trackId);
        
        return true;
    }

    /**
     * Playback controls
     */
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.startPlayback();
    }

    pause() {
        this.isPlaying = false;
        this.stopPlayback();
        // Immediately pause all audio
        this.updateAudioPlayback();
    }

    stop() {
        this.isPlaying = false;
        // Don't reset currentTime - just stop at current position
        this.stopPlayback();
        this.stopAllAudio();
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
        this.updateFrame();
    }

    stepForward() {
        const clip = this.getClipAtTime(this.currentTime);
        if (clip) {
            this.currentTime = Math.min(clip.endTime, this.totalDuration);
        } else {
            this.currentTime = Math.min(this.currentTime + (1 / this.frameRate), this.totalDuration);
        }
        this.updateFrame();
    }

    stepBackward() {
        const clip = this.getClipAtTime(this.currentTime);
        if (clip) {
            this.currentTime = Math.max(clip.startTime - (1 / this.frameRate), 0);
        } else {
            this.currentTime = Math.max(this.currentTime - (1 / this.frameRate), 0);
        }
        this.updateFrame();
    }

    /**
     * Start playback loop
     */
    startPlayback() {
        if (this.playbackInterval) return;

        const frameTime = 1 / this.frameRate; // Time per frame in seconds
        
        this.playbackInterval = setInterval(() => {
            if (!this.isPlaying) {
                this.stopPlayback();
                return;
            }

            this.currentTime += frameTime;
            
            if (this.currentTime >= this.totalDuration) {
                if (this.isLooping) {
                    // Loop: reset to start
                    this.currentTime = 0.0;
                    this.stopAllAudio(); // Stop all audio when looping
                } else {
                    this.stop();
                    return;
                }
            }

            this.updateFrame();
        }, frameTime * 1000); // Convert to milliseconds
    }

    /**
     * Snap time to nearest frame or clip edge
     * @param {number} time - The time to snap
     * @param {object} movingClip - Optional: The clip being moved (to filter snap targets by type)
     */
    snapTime(time, movingClip = null) {
        if (!this.snapEnabled) return time;

        const isAudioClip = movingClip && (movingClip.fileType === 'audio');

        let snappedTime = time;

        // Snap to frame boundaries first
        if (this.snapToFrames) {
            const frameTime = 1 / this.frameRate;
            const nearestFrame = Math.round(time / frameTime) * frameTime;
            
            // For audio clips being dragged, only snap to frames when very close (within 0.02s / 20ms)
            // This allows audio to move freely but snap when very close to frame boundaries
            const isAudioClip = movingClip && (movingClip.fileType === 'audio');
            if (isAudioClip) {
                const frameSnapThreshold = 0.02; // 20ms - only snap when very close
                const distToNearestFrame = Math.abs(time - nearestFrame);
                if (distToNearestFrame < frameSnapThreshold) {
                    snappedTime = nearestFrame;
                } else {
                    // Don't snap to frames if too far away
                    snappedTime = time;
                }
            } else {
                // For video clips or when not dragging, always snap to nearest frame
                snappedTime = nearestFrame;
            }
        }

        // Snap to clip edges
        if (this.snapToClips) {
            // Different thresholds for same-type vs cross-type snapping
            // For audio clips, use very tight thresholds (only snap when very close)
            const sameTypeThreshold = 0.1; // 100ms for same-type clips (audio to audio, video to video)
            const crossTypeThreshold = 0.02; // 20ms for cross-type clips (audio to video) - much smaller, only when very close
            const audioSameTypeThreshold = 0.02; // 20ms for audio to audio - very tight, only when very close
            let nearestEdge = null;
            let minDistance = Infinity;
            let nearestEdgeType = null;
            let nearestEdgeClipId = null;

            // Determine moving clip type
            let movingType = null;
            if (movingClip) {
                movingType = movingClip.fileType || (movingClip.isExternalFile ? 'unknown' : 'video');
            }

            this.timeline.forEach(clip => {
                // Skip the clip being moved
                if (movingClip && clip.id === movingClip.id) {
                    return;
                }
                
                // CRITICAL: Only snap to clips on the same track
                // This allows clips on different tracks to overlap at the same time position
                if (movingClip && movingClip.trackId && clip.trackId) {
                    if (movingClip.trackId !== clip.trackId) {
                        return; // Skip clips on different tracks
                    }
                } else if (movingClip && movingClip.trackId && !clip.trackId) {
                    // If moving clip has trackId but other clip doesn't, skip it
                    return;
                } else if (movingClip && !movingClip.trackId && clip.trackId) {
                    // If moving clip doesn't have trackId but other clip does, skip it
                    return;
                }
                
                // Determine clip types
                let clipType = null;
                let isCrossType = false;
                
                if (movingClip) {
                    clipType = clip.fileType || (clip.isExternalFile ? 'unknown' : 'video');
                    
                    // Check if this is cross-type snapping (audio to video or vice versa)
                    isCrossType = (movingType === 'audio' && clipType !== 'audio') || 
                                  (movingType !== 'audio' && clipType === 'audio');
                    
                    // CRITICAL: Audio clips should NEVER snap to video clips
                    // Skip video/image clips entirely when dragging an audio clip
                    if (movingType === 'audio' && clipType !== 'audio') {
                        return; // Skip this clip - don't check it for snapping
                    }
                }
                
                // Use appropriate threshold based on clip types
                // For audio clips snapping to audio clips, use very tight threshold
                let snapThreshold;
                if (movingType === 'audio' && clipType === 'audio') {
                    snapThreshold = audioSameTypeThreshold; // Very tight for audio-to-audio
                } else if (isCrossType) {
                    snapThreshold = crossTypeThreshold;
                } else {
                    snapThreshold = sameTypeThreshold;
                }

                // Check start edge
                const distToStart = Math.abs(snappedTime - clip.startTime);
                if (distToStart < snapThreshold && distToStart < minDistance) {
                    minDistance = distToStart;
                    nearestEdge = clip.startTime;
                    nearestEdgeType = 'start';
                    nearestEdgeClipId = clip.id;
                }

                // Check end edge
                const distToEnd = Math.abs(snappedTime - clip.endTime);
                if (distToEnd < snapThreshold && distToEnd < minDistance) {
                    minDistance = distToEnd;
                    nearestEdge = clip.endTime;
                    nearestEdgeType = 'end';
                    nearestEdgeClipId = clip.id;
                }
            });

            if (nearestEdge !== null) {
                snappedTime = nearestEdge;
            }
        }

        const finalTime = Math.max(0, Math.min(snappedTime, this.totalDuration));
        
        
        return finalTime;
    }

    /**
     * Toggle snapping
     */
    setSnapEnabled(enabled) {
        this.snapEnabled = enabled;
    }

    /**
     * Toggle loop
     */
    setLooping(looping) {
        this.isLooping = looping;
    }

    /**
     * Stop playback loop
     */
    stopPlayback() {
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }

    /**
     * Update current frame display
     */
    updateFrame() {
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        if (this.onFrameChange) {
            const clip = this.getClipAtTime(this.currentTime);
            this.onFrameChange(clip);
        }
        
        // Update audio playback
        this.updateAudioPlayback();
    }

    /**
     * Update audio playback based on current time
     */
    updateAudioPlayback() {
        // Get all audio clips that should be playing at current time
        const activeAudioClips = this.timeline.filter(clip => 
            clip.isExternalFile && 
            clip.fileType === 'audio' &&
            this.currentTime >= clip.startTime && 
            this.currentTime < clip.endTime
        );

        // Get all audio clip IDs that should be playing
        const activeIds = new Set(activeAudioClips.map(clip => clip.id));

        // Stop audio clips that are no longer active
        this.audioElements.forEach((audio, clipId) => {
            if (!activeIds.has(clipId)) {
                audio.pause();
                audio.currentTime = 0;
            }
        });

        // Play/update active audio clips
        activeAudioClips.forEach(clip => {
            let audio = this.audioElements.get(clip.id);
            
            if (!audio && clip.fileUrl) {
                // Create new audio element
                audio = new Audio(clip.fileUrl);
                audio.volume = this.audioVolume;
                audio.loop = false;
                this.audioElements.set(clip.id, audio);
            }

            if (audio) {
                // Calculate the position within the clip (timeline position)
                const clipPosition = this.currentTime - clip.startTime;
                
                // Account for audio trimming offsets
                // audioStartOffset = time in original audio file where this clip segment starts
                // clipPosition = position in the trimmed clip (0 to clip.duration)
                // audioPosition = position in the original audio file = audioStartOffset + clipPosition
                const audioStartOffset = clip.audioStartOffset || 0;
                const audioEndOffset = clip.audioEndOffset || (clip.originalAudioDuration || clip.duration);
                const audioPosition = audioStartOffset + clipPosition;
                
                // Only play if we're playing the timeline and within the trimmed audio range
                // clipPosition should be between 0 and clip.duration (the visible clip length)
                // audioPosition should be between audioStartOffset and audioEndOffset (the trimmed range in original audio)
                const isWithinClipRange = clipPosition >= 0 && clipPosition <= clip.duration;
                const isWithinAudioRange = audioPosition >= audioStartOffset && audioPosition <= audioEndOffset;
                const isWithinTrimmedRange = isWithinClipRange && isWithinAudioRange;
                
                
                if (this.isPlaying && isWithinTrimmedRange) {
                    if (audio.paused) {
                        // Clamp audio position to valid range
                        const clampedAudioPosition = Math.max(audioStartOffset, Math.min(audioEndOffset, audioPosition));
                        audio.currentTime = clampedAudioPosition;
                        audio.play().catch(err => {
                            console.warn('Error playing audio:', err);
                        });
                    } else {
                        // Sync audio position (with some tolerance to avoid constant seeking)
                        const clampedAudioPosition = Math.max(audioStartOffset, Math.min(audioEndOffset, audioPosition));
                        const diff = Math.abs(audio.currentTime - clampedAudioPosition);
                        if (diff > 0.1) {
                            audio.currentTime = clampedAudioPosition;
                        }
                    }
                } else {
                    // If paused or outside trimmed range, pause audio but keep position
                    if (!audio.paused) {
                        audio.pause();
                    }
                }
            }
        });
    }

    /**
     * Set audio volume (0.0 to 1.0)
     */
    setAudioVolume(volume) {
        this.audioVolume = Math.max(0, Math.min(1, volume));
        this.audioElements.forEach(audio => {
            audio.volume = this.audioVolume;
        });
    }

    /**
     * Stop all audio playback
     */
    stopAllAudio() {
        this.audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }

    /**
     * Get timeline data for saving
     */
    getTimelineData() {// Convert clipTrackAssignments Map to array for JSON serialization
        const clipTrackAssignmentsArray = [];
        if (this.app.previsController && this.app.previsController.clipTrackAssignments) {
            this.app.previsController.clipTrackAssignments.forEach((trackId, clipId) => {
                clipTrackAssignmentsArray.push({ clipId, trackId });
            });
        }
        
        // Count external files (custom added items)
        const externalFilesCount = this.timeline.filter(c => c.isExternalFile === true).length;
        const storyboardClipsCount = this.timeline.filter(c => !c.isExternalFile).length;
        
        // Get detailed clip info for debugging
        const clipDetails = this.timeline.map(c => ({
            id: c.id,
            isExternalFile: c.isExternalFile,
            duration: c.duration,
            customDuration: c.customDuration,
            startTime: c.startTime,
            trackId: c.trackId,
            fileType: c.fileType
        }));

        // CRITICAL: Return a deep copy of the timeline to ensure all data is saved
        // This prevents any reference issues that might cause data loss
        const timelineCopy = this.timeline.map(clip => {
            return {
                ...clip,
                // Ensure all properties are explicitly included
                id: clip.id,
                fileId: clip.fileId,
                fileUrl: clip.fileUrl,
                fileType: clip.fileType,
                fileName: clip.fileName,
                startTime: clip.startTime,
                duration: clip.duration,
                endTime: clip.endTime,
                isExternalFile: clip.isExternalFile,
                trackId: clip.trackId,
                imageUrl: clip.imageUrl,
                thumbnail: clip.thumbnail,
                customDuration: clip.customDuration
            };
        });
        
        const result = {
            timeline: timelineCopy, // Use deep copy
            currentTime: this.currentTime,
            frameRate: this.frameRate,
            totalDuration: this.totalDuration,
            zoomLevel: this.zoomLevel,
            clipTrackAssignments: clipTrackAssignmentsArray,
            videoTracks: this.app.previsController?.videoTracks || [], // Save track definitions
            audioTracks: this.app.previsController?.audioTracks || [] // Save track definitions
        };return result;
    }

    /**
     * Load timeline data from saved project
     */
    loadTimelineData(data) {
        if (!data || !data.timeline) {
            console.warn('[LOAD] No timeline data to load');
            return;
        }

        // CRITICAL: Restore timeline exactly as saved - don't modify it
        // But ensure storyboard clips have a trackId (default to video_1 if missing)
        this.timeline = data.timeline.map(clip => {
            const isExternal = clip.isExternalFile === true;
            // Ensure all properties are restored
            return {
                ...clip,
                id: clip.id,
                fileId: clip.fileId,
                fileUrl: clip.fileUrl,
                fileType: clip.fileType,
                fileName: clip.fileName,
                startTime: clip.startTime,
                duration: clip.duration,
                endTime: clip.endTime,
                isExternalFile: isExternal, // Ensure boolean
                trackId: clip.trackId || (!isExternal ? 'video_1' : clip.trackId), // Default storyboard clips to video_1
                imageUrl: clip.imageUrl,
                thumbnail: clip.thumbnail,
                customDuration: clip.customDuration
            };
        });
        
        this.currentTime = data.currentTime || 0.0;
        this.frameRate = data.frameRate || this.app.project.settings?.frameRate || 24;
        this.totalDuration = data.totalDuration || 0.0;
        this.zoomLevel = data.zoomLevel || 1.0;
        
        // Restore clipTrackAssignments Map from array
        if (data.clipTrackAssignments && this.app.previsController) {
            this.app.previsController.clipTrackAssignments.clear();
            data.clipTrackAssignments.forEach(({ clipId, trackId }) => {
                this.app.previsController.clipTrackAssignments.set(clipId, trackId);
            });
        }

        // Restore track definitions
        if (data.videoTracks && this.app.previsController) {
            this.app.previsController.videoTracks = data.videoTracks;
        }
        if (data.audioTracks && this.app.previsController) {
            this.app.previsController.audioTracks = data.audioTracks;
        }

        // Mark that we've loaded timeline data to prevent rebuild
        this.timelineDataLoaded = true;
    }

    /**
     * Format timecode (HH:MM:SS:FF)
     */
    formatTimecode(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * this.frameRate);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    }

    /**
     * Set frame rate
     */
    setFrameRate(frameRate) {
        this.frameRate = frameRate;
        // Recalculate durations if needed
        this.calculateDefaultDurations();
    }
}
