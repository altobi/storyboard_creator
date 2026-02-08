/**
 * StorageService - Handles localStorage and IndexedDB operations
 * Extracted from app.js for better code organization
 */
class StorageService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Save project to storage (localStorage or IndexedDB)
     */
    async saveToStorage(isTemp = false) {
        const key = isTemp ? 'storyboard_tempSave' : 'storyboard_currentProject';
        
        // Always save currentProject if we have a project path (even if no images yet)
        // This ensures the project persists after reload
        if (!isTemp && (!this.app.currentProjectPath || this.app.currentProjectPath === '')) {
            // Only skip if we have no project path AND no images
            // If we have images but no path, still save (might be a new project being worked on)
            if (!this.app.project || !this.app.project.images || this.app.project.images.length === 0) {
                return; // No project to save
            }
        }
        
        try {
            // Create project copy - ALWAYS include URLs for cross-browser compatibility and persistence
            // Without URLs, images won't work after page reload or in Safari
            const projectCopy = {
                images: this.app.project.images.map(img => {
                    const imageData = {
                        name: img.name,
                        filePath: img.filePath || img.name,
                        sceneNumber: img.sceneNumber || '',
                        shotNumber: img.shotNumber || '',
                        frameNumber: img.frameNumber || ''
                    };
                    
                    // ALWAYS include URL - required for persistence and cross-browser compatibility
                    if (img.url) {
                        imageData.url = img.url;
                    }
                    
                    // CRITICAL: Include originalUrl if it exists (for restoring original image after rasterization)
                    // Check if property has a value (not undefined or null)
                    // If property was deleted, it will be undefined, so it won't be saved
                    if (img.originalUrl !== undefined && img.originalUrl !== null) {
                        imageData.originalUrl = img.originalUrl;
                    }
                    
                    // CRITICAL: Include editLayers if they exist (for image editing feature)
                    // Check if property has a value (not undefined or null)
                    // Empty arrays are valid (means image was edited but layers cleared)
                    // If property was deleted, it will be undefined, so it won't be saved
                    if (img.editLayers !== undefined && img.editLayers !== null) {
                        imageData.editLayers = img.editLayers;
                    }
                    
                    return imageData;
                }),
                settings: this.app.project.settings,
                frameTexts: this.app.project.frameTexts,
                pageTexts: this.app.project.pageTexts,
                imageScenes: this.app.project.imageScenes,
                drawings: this.app.project.drawings, // Keep drawings but they're also base64 - might need compression
                activePanel: this.app.project.activePanel,
                shotList: this.app.shotListManager ? this.app.shotListManager.exportForSave() : [],
                audioFiles: this.app.project.audioFiles || [],
                customFiles: this.app.project.customFiles || [],
                previz: this.app.previsController && this.app.previsController.previsManager ? 
                    this.app.previsController.previsManager.getTimelineData() : null // Timeline data
            };
            
            const data = {
                project: projectCopy,
                timestamp: Date.now(),
                currentProjectPath: this.app.currentProjectPath,
                imageFolderPath: this.app.imageFolderPath,
                removedImages: Array.from(this.app.removedImages)
            };
            
            const dataStr = JSON.stringify(data);
            const dataSizeMB = dataStr.length / 1024 / 1024;
            
            // Check size - localStorage has ~5-10MB limit
            // For large projects, use IndexedDB instead
            if (dataStr.length > 3 * 1024 * 1024) { // 3MB limit for localStorage
                
                // Use IndexedDB for large projects (can handle hundreds of MB)
                // Wait for IndexedDB to be ready if needed
                if (this.app.fileManager) {
                    // Ensure IndexedDB is initialized
                    if (!this.app.fileManager.db) {
                        await this.app.fileManager.initDB();
                    }
                    
                    if (this.app.fileManager.db) {
                        try {
                            const transaction = this.app.fileManager.db.transaction(['projectData'], 'readwrite');
                            const store = transaction.objectStore('projectData');
                            await store.put({
                                id: key,
                                data: data,
                                timestamp: Date.now()
                            });
                            // Also clear from localStorage to avoid confusion
                            localStorage.removeItem(key);
                            return;
                        } catch (e) {
                            console.error('Failed to save to IndexedDB:', e);
                            // Fall through to try localStorage with minimal version
                        }
                    }
                }
                
                // If IndexedDB fails, try minimal version in localStorage
                try {
                    const minimalData = {
                        project: {
                            images: projectCopy.images, // Keep images with URLs - essential for functionality
                            settings: projectCopy.settings,
                            frameTexts: projectCopy.frameTexts,
                            pageTexts: projectCopy.pageTexts,
                            imageScenes: projectCopy.imageScenes
                            // Skip drawings if too large (they're less critical)
                        },
                        timestamp: Date.now(),
                        currentProjectPath: this.app.currentProjectPath,
                        imageFolderPath: this.app.imageFolderPath
                    };
                    const minimalStr = JSON.stringify(minimalData);
                    if (minimalStr.length > 3 * 1024 * 1024) {
                        console.error('Project too large even for minimal save');
                        return;
                    }
                    localStorage.setItem(key, minimalStr);
                    return;
                } catch (e2) {
                    console.error('Could not save even minimal version:', e2);
                    return;
                }
            }
            
            // Small enough for localStorage - save normally
            try {
                localStorage.setItem(key, dataStr);
                // Also remove from IndexedDB if it exists there (to avoid confusion)
                if (this.app.fileManager && this.app.fileManager.db) {
                    try {
                        const transaction = this.app.fileManager.db.transaction(['projectData'], 'readwrite');
                        const store = transaction.objectStore('projectData');
                        await store.delete(key);
                    } catch (e) {
                        // Ignore errors when deleting from IndexedDB
                    }
                }
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    // Try IndexedDB as fallback
                    if (this.app.fileManager) {
                        if (!this.app.fileManager.db) {
                            await this.app.fileManager.initDB();
                        }
                        
                        if (this.app.fileManager.db) {
                            try {
                                const transaction = this.app.fileManager.db.transaction(['projectData'], 'readwrite');
                                const store = transaction.objectStore('projectData');
                                await store.put({
                                    id: key,
                                    data: data,
                                    timestamp: Date.now()
                                });
                                return;
                            } catch (e2) {
                                console.error('Failed to save to IndexedDB:', e2);
                            }
                        }
                    }
                    console.error('Could not save project - both localStorage and IndexedDB failed');
                } else {
                    console.error('Error saving to storage:', e);
                }
            }
        } catch (e) {
            console.error('Error in saveToStorage:', e);
        }
    }

    /**
     * Load project from storage
     */
    async loadFromStorage() {
        try {
            // Ensure IndexedDB is ready if fileManager exists
            if (this.app.fileManager && !this.app.fileManager.db) {
                await this.app.fileManager.initDB();
            }
            
            // Check for temp save first (try localStorage, then IndexedDB for large projects)
            let tempSave = localStorage.getItem('storyboard_tempSave');
            let currentProject = localStorage.getItem('storyboard_currentProject');
            
            // If not in localStorage, try IndexedDB (for large projects)
            if (!tempSave && this.app.fileManager && this.app.fileManager.db) {
                try {
                    const transaction = this.app.fileManager.db.transaction(['projectData'], 'readonly');
                    const store = transaction.objectStore('projectData');
                    const request = store.get('storyboard_tempSave');
                    const result = await new Promise((resolve) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => resolve(null);
                    });
                    if (result && result.data) {
                        // IndexedDB stores {id, data, timestamp}, so we need to stringify the data
                        tempSave = JSON.stringify(result.data);
                    }
                } catch (e) {
                    console.error('Error loading temp save from IndexedDB:', e);
                }
            }
            
            if (!currentProject && this.app.fileManager && this.app.fileManager.db) {
                try {
                    const transaction = this.app.fileManager.db.transaction(['projectData'], 'readonly');
                    const store = transaction.objectStore('projectData');
                    const request = store.get('storyboard_currentProject');
                    const result = await new Promise((resolve) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => resolve(null);
                    });
                    if (result && result.data) {
                        currentProject = JSON.stringify(result.data);
                    }
                } catch (e) {
                    console.error('Error loading current project from IndexedDB:', e);
                }
            }
            
            // Determine which project to load based on timestamps
            let tempData = null;
            let tempTime = 0;
            let currentData = null;
            let currentTime = 0;
            
            // Parse temp save if available
            if (tempSave) {
                try {
                    tempData = JSON.parse(tempSave);
                    tempTime = tempData.timestamp || 0;
                } catch (e) {
                    console.error('Error parsing temp save:', e);
                }
            }
            
            // Parse current project if available
            if (currentProject) {
                try {
                    currentData = JSON.parse(currentProject);
                    currentTime = currentData.timestamp || 0;
                } catch (e) {
                    console.error('Error parsing current project:', e);
                }
            }
            
            // Decide which project to load
            if (tempData && currentData) {
                // Both exist - use the newer one
                if (tempTime > currentTime) {
                    // Temp save is newer - ask user if they want to restore it
                    const restore = await this.app.customConfirm('Found a temporary save that is newer than your last saved project. Would you like to restore it?');
                    if (restore) {
                        await this.restoreProject(tempData);
                        return;
                    } else {
                        // User declined temp save, use current project instead
                        // Ensure data structure is correct
                        if (!currentData.project && currentData.images) {
                            // Old format - wrap it
                            currentData.project = {
                                images: currentData.images,
                                settings: currentData.settings || {},
                                frameTexts: currentData.frameTexts || {},
                                pageTexts: currentData.pageTexts || {},
                                imageScenes: currentData.imageScenes || {},
                                drawings: currentData.drawings || {},
                                activePanel: currentData.activePanel || null
                            };
                        }
                        await this.restoreProject(currentData, false);
                        await this.saveToStorage(false);
                        return;
                    }
                } else {
                    // Current project is newer or equal - use it (ignore older temp save)
                    // Ensure data structure is correct
                    if (!currentData.project && currentData.images) {
                        // Old format - wrap it
                        currentData.project = {
                            images: currentData.images,
                            settings: currentData.settings || {},
                            frameTexts: currentData.frameTexts || {},
                            pageTexts: currentData.pageTexts || {},
                            imageScenes: currentData.imageScenes || {},
                            drawings: currentData.drawings || {},
                            activePanel: currentData.activePanel || null
                        };
                    }
                    await this.restoreProject(currentData, false);
                    await this.saveToStorage(false);
                    return;
                }
            } else if (tempData && !currentData) {
                // Only temp save exists - ask user if they want to restore it
                const restore = await this.app.customConfirm('Found a temporary save. Would you like to restore your previous work?');
                if (restore) {
                    await this.restoreProject(tempData);
                    return;
                }
            } else if (currentData && !tempData) {
                // Only current project exists - load it
                // Ensure data structure is correct
                if (!currentData.project && currentData.images) {
                    // Old format - wrap it
                    currentData.project = {
                        images: currentData.images,
                        settings: currentData.settings || {},
                        frameTexts: currentData.frameTexts || {},
                        pageTexts: currentData.pageTexts || {},
                        imageScenes: currentData.imageScenes || {},
                        drawings: currentData.drawings || {},
                        activePanel: currentData.activePanel || null
                    };
                }
                await this.restoreProject(currentData, false);
                await this.saveToStorage(false);
                return;
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }

    /**
     * Restore project from data
     */
    async restoreProject(data, hasUnsavedChanges = true) {
        this.app.project = data.project;
        this.app.currentProjectPath = data.currentProjectPath || null;
        this.app.imageFolderPath = data.imageFolderPath || null;
        if (data.removedImages) {
            this.app.removedImages = new Set(data.removedImages);
        }
        this.app.hasUnsavedChanges = hasUnsavedChanges;
        
        // Images should now always have URLs in the project file (compressed Base64)
        // No need to reload from folder - URLs are already in the project data
        // This ensures projects work across browsers and after reload
        // CRITICAL: All image properties (url, originalUrl, editLayers, etc.) are preserved
        // because we assign the entire project object directly
        
        // Load shot list if available
        if (data.project.shotList && this.app.shotListManager) {
            this.app.shotListManager.loadFromSave(data.project.shotList);
            // Initialize shot list from storyboard if it's empty
            if (this.app.shotListManager.getAllShots().length === 0 && this.app.project.images.length > 0) {
                this.app.shotListManager.initializeFromStoryboard();
            }
        } else if (this.app.shotListManager && this.app.project.images.length > 0) {
            // No shot list in saved data, but we have images - initialize from storyboard
            this.app.shotListManager.initializeFromStoryboard();
        }
        
        // Restore audio files
        if (data.project.audioFiles) {
            this.app.project.audioFiles = data.project.audioFiles;
        } else {
            this.app.project.audioFiles = [];
        }
        
        // Restore custom files (images imported for previz)
        if (data.project.customFiles) {
            this.app.project.customFiles = data.project.customFiles;
        } else {
            this.app.project.customFiles = [];
        }
        
        // CRITICAL: Load timeline data ALWAYS when project has previz data, regardless of active workspace
        // This ensures the timeline is loaded even if user switches to previz workspace later
        if (data.project.previz) {
            // Initialize previsController if it doesn't exist
            if (!this.app.previsController && typeof PrevisController !== 'undefined') {
                this.app.previsController = new PrevisController(this.app);
            }
            
            // Initialize previsManager if it doesn't exist
            if (this.app.previsController && !this.app.previsController.previsManager) {
                this.app.previsController.init();
            }
            
            if (this.app.previsController && this.app.previsController.previsManager) {
                console.log('[LOAD] Restoring timeline data from saved project', {
                    timelineLength: data.project.previz.timeline?.length || 0,
                    videoTracksCount: data.project.previz.videoTracks?.length || 0,
                    audioTracksCount: data.project.previz.audioTracks?.length || 0,
                    activeWorkspace: data.project.activeWorkspace
                });this.app.previsController.previsManager.loadTimelineData(data.project.previz);
                // Restore video and audio tracks
                if (data.project.previz.videoTracks && this.app.previsController) {
                    this.app.previsController.videoTracks = data.project.previz.videoTracks;
                    console.log('[LOAD] Restored video tracks:', this.app.previsController.videoTracks.length);
                }
                if (data.project.previz.audioTracks && this.app.previsController) {
                    this.app.previsController.audioTracks = data.project.previz.audioTracks;
                    console.log('[LOAD] Restored audio tracks:', this.app.previsController.audioTracks.length);
                }
                // Restore clip track assignments
                if (data.project.previz.clipTrackAssignments && this.app.previsController) {
                    this.app.previsController.clipTrackAssignments = new Map();
                    data.project.previz.clipTrackAssignments.forEach(({ clipId, trackId }) => {
                        this.app.previsController.clipTrackAssignments.set(clipId, trackId);
                    });
                    console.log('[LOAD] Restored clip track assignments:', this.app.previsController.clipTrackAssignments.size);
                }
            } else {
                console.warn('[LOAD] Could not initialize previsController/previsManager for timeline data loading');}
        }
        
        // Restore active workspace
        if (data.project.activeWorkspace) {
            setTimeout(() => {
                this.app.switchWorkspace(data.project.activeWorkspace);
                // If shot list workspace, ensure it renders
                if (data.project.activeWorkspace === 'shotlist' && this.app.shotListController) {
                    setTimeout(() => {
                        this.app.shotListController.onShotListTabActivated();
                    }, 150);
                }
            }, 100);
        } else {
            // Fallback to localStorage
            const savedWorkspace = localStorage.getItem('storyboard_activeWorkspace');
            if (savedWorkspace) {
                setTimeout(() => {
                    this.app.switchWorkspace(savedWorkspace);
                    // If shot list workspace, ensure it renders
                    if (savedWorkspace === 'shotlist' && this.app.shotListController) {
                        setTimeout(() => {
                            this.app.shotListController.onShotListTabActivated();
                        }, 150);
                    }
                    // If previz workspace, ensure it renders
                    if (savedWorkspace === 'previz' && this.app.previsController) {
                        setTimeout(() => {
                            this.app.previsController.render();
                        }, 150);
                    }
                }, 100);
            }
        }
        
        // Note: File handle cannot be restored from localStorage (security restriction)
        // User will need to use Save As if they want to save to a new location
        if (this.app.fileManager && data.currentProjectPath) {
            // File handle will be null, but path is stored for reference
        }
        
        if (this.app.updateProjectName) this.app.updateProjectName();
        if (this.app.updateSaveStatus) this.app.updateSaveStatus();
        if (this.app.loadProjectToUI) this.app.loadProjectToUI();
        if (this.app.renderStoryboard) this.app.renderStoryboard();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
}

