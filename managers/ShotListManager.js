/**
 * Shot List Manager
 * Handles shot list data, operations, and synchronization with storyboard
 */

class ShotListManager {
    constructor(app) {
        this.app = app;
        this.shots = []; // Array of shot objects
        this.defaultEmptyFrameImage = null; // Default image for empty frames
    }

    /**
     * Initialize shot list from storyboard images
     */
    initializeFromStoryboard() {
        // Group images by scene and shot
        const shotMap = new Map();
        
        this.app.project.images.forEach(image => {
            const sceneNum = image.sceneNumber || '';
            const shotNum = image.shotNumber || '';
            const key = `${sceneNum}_${shotNum}`;
            
            if (!shotMap.has(key)) {
                shotMap.set(key, {
                    sceneNumber: sceneNum,
                    shotNumber: shotNum,
                    images: [],
                    frameCount: 0,
                    firstImage: image
                });
            }
            
            const shot = shotMap.get(key);
            shot.images.push(image);
            shot.frameCount = shot.images.length;
        });
        
        // Convert to shot list entries
        this.shots = Array.from(shotMap.values()).map(shot => {
            // Calculate duration from frame count (1 second per frame by default)
            const frameRate = this.getFrameRate();
            const defaultFrameDurationSeconds = 1.0; // 1 second per frame
            const totalDurationSeconds = shot.frameCount * defaultFrameDurationSeconds;
            const totalDurationFrames = Math.round(totalDurationSeconds * frameRate);
            
            return this.createShotEntry({
                sceneNumber: shot.sceneNumber,
                shotNumber: shot.shotNumber,
                storyboardImage: shot.firstImage,
                frameCount: shot.frameCount,
                durationFrames: totalDurationFrames,
                durationSeconds: totalDurationSeconds
            });
        });
        
        // Merge with existing shot list entries (preserve manual additions)
        this.mergeWithExistingShots();
        
        // Sort shots by scene, then shot number
        this.sortShots();
    }

    /**
     * Create a shot list entry
     */
    createShotEntry(data = {}) {
        const shot = {
            id: data.id || this.generateShotId(),
            sceneNumber: data.sceneNumber || '',
            shotNumber: data.shotNumber || '',
            description: data.description || '',
            durationFrames: data.durationFrames || 0, // Duration in frames
            durationSeconds: data.durationSeconds || 0, // Duration in seconds (calculated)
            cameraAngle: data.cameraAngle || '',
            cameraMovement: data.cameraMovement || '',
            cameraLens: data.cameraLens || '',
            distance: data.distance || '', // MCU, CU, MS, WS, etc.
            location: data.location || '',
            characters: data.characters || '',
            props: data.props || '',
            equipment: data.equipment || '',
            setupTimeMinutes: data.setupTimeMinutes || 0, // Setup time in minutes
            setupTime: data.setupTime || '', // Legacy text field (for backward compatibility)
            predictedTakes: data.predictedTakes || '', // Predicted number of takes needed
            specialNotes: data.specialNotes || '',
            status: data.status || 'pending', // pending, approved, shot, cut
            frameCount: data.frameCount || 0,
            storyboardImage: data.storyboardImage || null, // Reference to image in storyboard
            isManual: data.isManual || false, // True if added manually (not from storyboard)
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            customFields: data.customFields || {} // Custom column data
        };
        
        return shot;
    }
    
    /**
     * Get project frame rate (default 24 FPS)
     */
    getFrameRate() {
        return this.app.project.settings?.frameRate || 24;
    }
    
    /**
     * Convert frames to seconds
     */
    framesToSeconds(frames) {
        const frameRate = this.getFrameRate();
        return frames / frameRate;
    }
    
    /**
     * Convert seconds to frames
     */
    secondsToFrames(seconds) {
        const frameRate = this.getFrameRate();
        return Math.round(seconds * frameRate);
    }
    
    /**
     * Update duration (frames or seconds) and calculate the other
     */
    updateDuration(shot, value, isFrames = true) {
        const oldDurationFrames = shot.durationFrames || 0;
        
        if (isFrames) {
            shot.durationFrames = parseInt(value) || 0;
            shot.durationSeconds = this.framesToSeconds(shot.durationFrames);
        } else {
            shot.durationSeconds = parseFloat(value) || 0;
            shot.durationFrames = this.secondsToFrames(shot.durationSeconds);
        }
        
        // If duration changed, proportionally scale frame durations in previz timeline
        if (shot.durationFrames !== oldDurationFrames) {
            const newDurationSeconds = shot.durationSeconds;// Use setTimeout to ensure the shot duration is fully updated before scaling
            setTimeout(() => {
                // Access previsManager through previsController
                if (this.app.previsController && this.app.previsController.previsManager) {this.app.previsController.previsManager.scaleFrameDurationsForShot(
                        shot.sceneNumber,
                        shot.shotNumber,
                        newDurationSeconds
                    );// Recalculate timeline positions after scaling (this will ripple subsequent clips)
                    // CRITICAL: Only recalculate video_1 track to preserve external files on other tracks
                    // scaleFrameDurationsForShot already recalculated video_1, but we need to ripple subsequent clips
                    // However, we should NOT recalculate all tracks as that will move external files
                    // The ripple effect should only affect storyboard clips on video_1 track
                    this.app.previsController.previsManager.recalculateTimelinePositions('video_1');// Mark project as changed and save
                    if (this.app.previsController) {
                        this.app.previsController.renderTimeline();
                        this.app.markChanged();
                        this.app.storageService.saveToStorage(false);
                    }
                } else {}
            }, 0);
        }
    }

    /**
     * Generate unique shot ID
     */
    generateShotId() {
        return `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add a new shot (manually added, not from storyboard)
     */
    addManualShot(sceneNumber, shotNumber) {
        const shot = this.createShotEntry({
            sceneNumber: sceneNumber,
            shotNumber: shotNumber,
            isManual: true
        });
        
        this.shots.push(shot);
        this.sortShots();
        
        // Create corresponding storyboard entry with default empty frame
        this.createStoryboardEntryForShot(shot);
        
        this.app.markChanged();
        return shot;
    }

    /**
     * Create a storyboard entry for a manually added shot
     */
    async createStoryboardEntryForShot(shot) {
        // Check if storyboard entry already exists
        const existingImage = this.app.project.images.find(img => 
            img.sceneNumber === shot.sceneNumber && 
            img.shotNumber === shot.shotNumber
        );
        
        if (existingImage) {
            // Link the shot to existing image
            shot.storyboardImage = existingImage;
            return existingImage;
        }
        
        // Create default empty frame image
        const emptyFrameImage = await this.getDefaultEmptyFrameImage();
        
        const imageData = {
            name: `empty_${shot.sceneNumber}_${shot.shotNumber}_${Date.now()}.png`,
            originalName: `empty_${shot.sceneNumber}_${shot.shotNumber}_${Date.now()}.png`,
            filePath: `scene${shot.sceneNumber}/shot${shot.shotNumber}/empty_frame.png`,
            url: emptyFrameImage,
            sceneNumber: shot.sceneNumber,
            shotNumber: shot.shotNumber,
            frameNumber: '0001',
            isPlaceholder: true // Mark as placeholder
        };
        
        this.app.project.images.push(imageData);
        shot.storyboardImage = imageData;
        shot.frameCount = 1;
        
        // Re-render storyboard
        if (this.app.renderService) {
            setTimeout(() => {
                this.app.renderService.renderStoryboard();
            }, 100);
        }
        
        return imageData;
    }

    /**
     * Get or create default empty frame image
     */
    async getDefaultEmptyFrameImage() {
        if (this.defaultEmptyFrameImage) {
            return this.defaultEmptyFrameImage;
        }
        
        // Create a simple placeholder image (16:9 aspect ratio, gray background)
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Fill with gray background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Add text "Empty Frame"
        ctx.fillStyle = '#888';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Empty Frame', canvas.width / 2, canvas.height / 2);
        
        // Convert to data URL
        this.defaultEmptyFrameImage = canvas.toDataURL('image/png');
        return this.defaultEmptyFrameImage;
    }

    /**
     * Update a shot entry
     */
    updateShot(shotId, updates) {
        const shot = this.shots.find(s => s.id === shotId);
        if (!shot) return false;
        
        Object.assign(shot, updates);
        shot.updatedAt = Date.now();
        
        this.sortShots();
        this.app.markChanged();
        return true;
    }

    /**
     * Delete a shot
     */
    deleteShot(shotId) {
        const index = this.shots.findIndex(s => s.id === shotId);
        if (index === -1) return false;
        
        const shot = this.shots[index];
        
        // If it's a manual shot with placeholder image, remove the image too
        if (shot.isManual && shot.storyboardImage && shot.storyboardImage.isPlaceholder) {
            const imageIndex = this.app.project.images.findIndex(img => img === shot.storyboardImage);
            if (imageIndex !== -1) {
                this.app.project.images.splice(imageIndex, 1);
            }
        }
        
        this.shots.splice(index, 1);
        this.app.markChanged();
        
        // Re-render storyboard if needed
        if (shot.isManual && shot.storyboardImage && shot.storyboardImage.isPlaceholder) {
            if (this.app.renderService) {
                setTimeout(() => {
                    this.app.renderService.renderStoryboard();
                }, 100);
            }
        }
        
        return true;
    }

    /**
     * Get shot by ID
     */
    getShot(shotId) {
        return this.shots.find(s => s.id === shotId);
    }

    /**
     * Get all shots
     */
    getAllShots() {
        return this.shots;
    }

    /**
     * Get shots by scene
     */
    getShotsByScene(sceneNumber) {
        return this.shots.filter(s => s.sceneNumber === sceneNumber);
    }

    /**
     * Sort shots by scene number, then shot number
     */
    sortShots() {
        this.shots.sort((a, b) => {
            // Compare scene numbers
            const sceneA = parseInt(a.sceneNumber) || 0;
            const sceneB = parseInt(b.sceneNumber) || 0;
            if (sceneA !== sceneB) {
                return sceneA - sceneB;
            }
            
            // Compare shot numbers
            const shotA = parseInt(a.shotNumber) || 0;
            const shotB = parseInt(b.shotNumber) || 0;
            return shotA - shotB;
        });
    }

    /**
     * Merge with existing shots from project data
     */
    mergeWithExistingShots() {
        if (!this.app.project.shotList) {
            return;
        }
        
        // Merge existing shots (preserve manual additions and custom data)
        this.app.project.shotList.forEach(existingShot => {
            const existing = this.shots.find(s => 
                s.sceneNumber === existingShot.sceneNumber && 
                s.shotNumber === existingShot.shotNumber
            );
            
            if (existing) {
                // Update with saved data but keep storyboard image reference
                Object.assign(existing, existingShot, {
                    storyboardImage: existing.storyboardImage,
                    id: existing.id
                });
            } else {
                // Add shot that was manually added before
                this.shots.push(existingShot);
            }
        });
    }

    /**
     * Sync with storyboard (update frame counts, add new shots from storyboard)
     */
    syncWithStoryboard() {
        // Group images by scene and shot
        const shotMap = new Map();
        
        this.app.project.images.forEach(image => {
            const sceneNum = image.sceneNumber || '';
            const shotNum = image.shotNumber || '';
            const key = `${sceneNum}_${shotNum}`;
            
            if (!shotMap.has(key)) {
                shotMap.set(key, {
                    sceneNumber: sceneNum,
                    shotNumber: shotNum,
                    images: [],
                    frameCount: 0,
                    firstImage: image
                });
            }
            
            const shot = shotMap.get(key);
            shot.images.push(image);
            shot.frameCount = shot.images.length;
        });
        
        // Update existing shots or create new ones
        shotMap.forEach((shotData, key) => {
            const existingShot = this.shots.find(s => 
                s.sceneNumber === shotData.sceneNumber && 
                s.shotNumber === shotData.shotNumber
            );
            
            if (existingShot) {
                // Update frame count and image reference
                existingShot.frameCount = shotData.frameCount;
                if (!existingShot.storyboardImage || existingShot.storyboardImage.isPlaceholder) {
                    existingShot.storyboardImage = shotData.firstImage;
                }
            } else {
                // Create new shot from storyboard
                const newShot = this.createShotEntry({
                    sceneNumber: shotData.sceneNumber,
                    shotNumber: shotData.shotNumber,
                    storyboardImage: shotData.firstImage,
                    frameCount: shotData.frameCount
                });
                this.shots.push(newShot);
            }
        });
        
        // Remove shots that no longer exist in storyboard (unless manual)
        this.shots = this.shots.filter(shot => {
            if (shot.isManual) return true; // Keep manual shots
            const key = `${shot.sceneNumber}_${shot.shotNumber}`;
            return shotMap.has(key);
        });
        
        this.sortShots();
    }

    /**
     * Export shot list data for saving
     */
    exportForSave() {
        return this.shots.map(shot => {
            const shotCopy = { ...shot };
            // Don't save storyboardImage reference (it's a circular reference)
            delete shotCopy.storyboardImage;
            return shotCopy;
        });
    }

    /**
     * Load shot list from saved data
     */
    loadFromSave(shotListData) {
        if (!shotListData || !Array.isArray(shotListData)) {
            return;
        }
        
        this.shots = shotListData.map(shotData => {
            // Handle backward compatibility: convert old 'duration' string to durationFrames
            if (shotData.duration && !shotData.durationFrames) {
                // Try to parse duration string (could be "120 frames" or "5.0s" or just a number)
                const durationStr = String(shotData.duration).toLowerCase();
                if (durationStr.includes('frame')) {
                    const frames = parseInt(durationStr) || 0;
                    shotData.durationFrames = frames;
                } else if (durationStr.includes('s') || durationStr.includes('sec')) {
                    const seconds = parseFloat(durationStr) || 0;
                    shotData.durationFrames = this.secondsToFrames(seconds);
                } else {
                    // Assume it's frames if it's just a number
                    shotData.durationFrames = parseInt(durationStr) || 0;
                }
            }
            
            const shot = this.createShotEntry(shotData);
            
            // Calculate durationSeconds if we have durationFrames
            if (shot.durationFrames > 0 && !shot.durationSeconds) {
                shot.durationSeconds = this.framesToSeconds(shot.durationFrames);
            }
            
            // Try to find corresponding storyboard image
            if (shot.sceneNumber && shot.shotNumber) {
                const image = this.app.project.images.find(img => 
                    img.sceneNumber === shot.sceneNumber && 
                    img.shotNumber === shot.shotNumber
                );
                if (image) {
                    shot.storyboardImage = image;
                }
            }
            
            return shot;
        });
        
        this.sortShots();
    }
}
