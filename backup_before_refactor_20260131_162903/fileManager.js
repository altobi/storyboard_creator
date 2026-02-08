/**
 * File Manager Module
 * Handles all file operations for the Storyboard Creator application
 * Uses File System Access API when available, falls back to download method
 */

// Simple hash function for checksum
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

class FileManager {
    constructor(storyboardCreator) {
        this.app = storyboardCreator;
        this.fileHandle = null; // Store file handle for Save operations
        this.directoryHandle = null; // Store directory handle for image folder access
        this.supportsFileSystemAccess = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
        this.dbName = 'storyboard_creator_db';
        this.dbVersion = 1;
        this.initDB();
    }
    
    /**
     * Initialize IndexedDB for storing directory handles
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                console.warn('IndexedDB not supported');
                resolve(false);
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.warn('Failed to open IndexedDB');
                resolve(false);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(true);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles', { keyPath: 'id' });
                }
            };
        });
    }
    
    /**
     * Store directory handle in IndexedDB
     * Stores with both project path and a default key for easy retrieval
     */
    async storeDirectoryHandle(projectPath, directoryHandle) {
        if (!this.db || !directoryHandle) return;
        
        try {
            const transaction = this.db.transaction(['handles'], 'readwrite');
            const store = transaction.objectStore('handles');
            
            // Store with project path as key
            if (projectPath) {
                await store.put({
                    id: projectPath,
                    handle: directoryHandle
                });
            }
            
            // Also store with default key for easy retrieval
            await store.put({
                id: 'default',
                handle: directoryHandle
            });
        } catch (error) {
            console.warn('Failed to store directory handle:', error);
        }
    }
    
    /**
     * Retrieve directory handle from IndexedDB
     * Tries project-specific handle first, then default
     */
    async getDirectoryHandle(projectPath) {
        if (!this.db) return null;
        
        try {
            const transaction = this.db.transaction(['handles'], 'readonly');
            const store = transaction.objectStore('handles');
            
            // Try project-specific handle first
            if (projectPath) {
                const projectRequest = store.get(projectPath);
                const projectHandle = await new Promise((resolve) => {
                    projectRequest.onsuccess = () => {
                        const result = projectRequest.result;
                        if (result && result.handle) {
                            resolve(result.handle);
                        } else {
                            resolve(null);
                        }
                    };
                    projectRequest.onerror = () => resolve(null);
                });
                
                if (projectHandle) {
                    // Verify handle is still valid
                    try {
                        const permission = await projectHandle.queryPermission({ mode: 'read' });
                        if (permission === 'granted') {
                            return projectHandle;
                        }
                    } catch (e) {
                        // Handle invalid, try default
                    }
                }
            }
            
            // Try default handle
            const defaultRequest = store.get('default');
            return new Promise((resolve) => {
                defaultRequest.onsuccess = async () => {
                    const result = defaultRequest.result;
                    if (result && result.handle) {
                        try {
                            const permission = await result.handle.queryPermission({ mode: 'read' });
                            if (permission === 'granted') {
                                resolve(result.handle);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                defaultRequest.onerror = () => resolve(null);
            });
        } catch (error) {
            console.warn('Failed to retrieve directory handle:', error);
            return null;
        }
    }

    /**
     * Check if File System Access API is supported
     */
    isSupported() {
        return this.supportsFileSystemAccess;
    }

    /**
     * New Project - Create a new project with save location selection
     */
    async newProject() {
        // If there's an existing project, ask to save first
        if (this.app.project.images.length > 0 || this.app.hasUnsavedChanges) {
            const shouldSave = await this.app.customConfirm(
                'You have an existing project. Would you like to save it before creating a new one?'
            );
            
            if (shouldSave === null) {
                // User cancelled
                return false;
            }
            
            if (shouldSave) {
                // Save existing project
                const saved = await this.save();
                if (!saved) {
                    // User cancelled save, don't proceed with new project
                    return false;
                }
            }
        }

        // Clear current project
        this.app.newProject();
        this.fileHandle = null;
        this.app.currentProjectPath = null;

        // Show dialog to select save location and name
        const projectInfo = await this.showNewProjectDialog();
        if (!projectInfo) {
            // User cancelled
            return false;
        }

        // For File System Access API, the file handle is already set in showNewProjectDialog
        // Just save the empty project to establish the file
        if (this.supportsFileSystemAccess && this.fileHandle) {
            const lightweightProject = this.createLightweightProject();
            
            const projectData = {
                version: '1.0.0',
                project: lightweightProject,
                currentProjectPath: this.app.currentProjectPath,
                imageFolderPath: this.app.imageFolderPath,
                removedImages: Array.from(this.app.removedImages),
                timestamp: Date.now()
            };
            
            const dataStr = JSON.stringify(projectData, null, 2);
            const checksum = simpleHash(dataStr);
            projectData.checksum = checksum;
            const finalDataStr = JSON.stringify(projectData, null, 2);
            const dataBlob = new Blob([finalDataStr], { type: 'application/json' });
            const writable = await this.fileHandle.createWritable();
            await writable.write(dataBlob);
            await writable.close();
            this.app.currentProjectPath = this.fileHandle.name;
            this.app.hasUnsavedChanges = false;
            this.app.saveToStorage();
            this.app.updateProjectName();
            return true;
        } else {
            // Fallback: Use Save As
            const saved = await this.saveAs(projectInfo.directory, projectInfo.filename);
            return saved;
        }
    }

    /**
     * Show dialog for new project (directory and filename)
     */
    async showNewProjectDialog() {
        if (this.supportsFileSystemAccess) {
            try {
                // Use File System Access API
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: 'storyboard-project.sbp',
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }]
                });
                
                this.fileHandle = fileHandle;
                return {
                    directory: null, // Not needed with File System Access API
                    filename: fileHandle.name
                };
            } catch (error) {
                if (error.name === 'AbortError') {
                    return null; // User cancelled
                }
                console.error('Error showing save dialog:', error);
                await this.app.customAlert('Error: Could not access file system. Please try again.');
                return null;
            }
        } else {
            // Fallback: Use custom prompt for filename
            const filename = await this.app.customPrompt(
                'Enter a name for your new project:',
                'storyboard-project.sbp',
                'New Project'
            );
            
            if (!filename) {
                return null; // User cancelled
            }

            // For fallback, we'll use Save As which will trigger download
            return {
                directory: null,
                filename: filename.endsWith('.sbp') ? filename : filename + '.sbp'
            };
        }
    }

    /**
     * Save - Save to existing file without dialog
     */
    async save() {
        if (!this.fileHandle && !this.app.currentProjectPath) {
            // No file handle or path, use Save As
            return await this.saveAs();
        }

        try {
            // Create lightweight project data (without base64 image URLs)
            const lightweightProject = this.createLightweightProject();
            
            const projectData = {
                version: '1.0.0', // Project file version for future compatibility
                project: lightweightProject,
                currentProjectPath: this.app.currentProjectPath,
                imageFolderPath: this.app.imageFolderPath,
                removedImages: Array.from(this.app.removedImages),
                timestamp: Date.now()
            };
            
            const dataStr = JSON.stringify(projectData, null, 2);
            // Add checksum for corruption detection
            const checksum = simpleHash(dataStr);
            projectData.checksum = checksum;
            const finalDataStr = JSON.stringify(projectData, null, 2);
            const dataBlob = new Blob([finalDataStr], { type: 'application/json' });

            if (this.supportsFileSystemAccess && this.fileHandle) {
                // Use File System Access API to write directly
                const writable = await this.fileHandle.createWritable();
                await writable.write(dataBlob);
                await writable.close();
                
                this.app.hasUnsavedChanges = false;
                this.app.saveToStorage();
                this.app.updateProjectName();
                this.app.showToast('Project saved successfully', 'success');
                return true;
            } else {
                // Fallback: Use download method
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = this.app.currentProjectPath || 'storyboard-project.sbp';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                this.app.hasUnsavedChanges = false;
                this.app.saveToStorage();
                this.app.updateProjectName();
                this.app.showToast('Project saved successfully', 'success');
                return true;
            }
        } catch (error) {
            console.error('Error saving project:', error);
            if (error.name === 'AbortError') {
                return false; // User cancelled
            }
            await this.app.customAlert('Error saving project: ' + error.message);
            return false;
        }
    }

    /**
     * Save As - Show file picker to choose save location
     */
    async saveAs(directory = null, suggestedFilename = null) {
        try {
            const filename = suggestedFilename || 
                (this.app.currentProjectPath ? this.app.currentProjectPath : 'storyboard-project.sbp');

            if (this.supportsFileSystemAccess) {
                // Use File System Access API
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }]
                });
                
                // Create lightweight project data (without base64 image URLs)
                const lightweightProject = this.createLightweightProject();
                
                const projectData = {
                    version: '1.0.0',
                    project: lightweightProject,
                    currentProjectPath: this.app.currentProjectPath,
                    imageFolderPath: this.app.imageFolderPath,
                    removedImages: Array.from(this.app.removedImages),
                    timestamp: Date.now()
                };
                
                const dataStr = JSON.stringify(projectData, null, 2);
                const checksum = simpleHash(dataStr);
                projectData.checksum = checksum;
                const finalDataStr = JSON.stringify(projectData, null, 2);
                const dataBlob = new Blob([finalDataStr], { type: 'application/json' });
                const writable = await fileHandle.createWritable();
                await writable.write(dataBlob);
                await writable.close();
                
                this.fileHandle = fileHandle;
                this.app.currentProjectPath = fileHandle.name;
                this.app.hasUnsavedChanges = false;
                this.app.saveToStorage();
                this.app.updateProjectName();
                this.app.showToast('Project saved successfully', 'success');
                return true;
            } else {
                // Fallback: Use download method
                const lightweightProject = this.createLightweightProject();
                
                const projectData = {
                    version: '1.0.0',
                    project: lightweightProject,
                    currentProjectPath: this.app.currentProjectPath,
                    imageFolderPath: this.app.imageFolderPath,
                    removedImages: Array.from(this.app.removedImages),
                    timestamp: Date.now()
                };
                
                const dataStr = JSON.stringify(projectData, null, 2);
                const checksum = simpleHash(dataStr);
                projectData.checksum = checksum;
                const finalDataStr = JSON.stringify(projectData, null, 2);
                const dataBlob = new Blob([finalDataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 100);
                
                this.app.currentProjectPath = filename;
                this.app.hasUnsavedChanges = false;
                this.app.saveToStorage();
                this.app.updateProjectName();
                this.app.showToast('Project saved successfully', 'success');
                return true;
            }
        } catch (error) {
            console.error('Error in saveAs:', error);
            if (error.name === 'AbortError') {
                return false; // User cancelled
            }
            await this.app.customAlert('Error saving project: ' + error.message);
            return false;
        }
    }

    /**
     * Open Project - Load project from file
     */
    async openProject() {
        try {
            if (this.supportsFileSystemAccess) {
                // Use File System Access API
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }],
                    multiple: false
                });
                
                const file = await fileHandle.getFile();
                const text = await file.text();
                
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('Invalid project file: Not valid JSON. File may be corrupted.');
                }
                
                // Handle both old format (direct project) and new format (wrapped)
                if (data.project) {
                    // New format with metadata
                    data = data;
                } else {
                    // Old format - wrap it
                    data = { project: data, version: '0.9.0' }; // Mark as old version
                }
                
                // Validate project data
                try {
                    this.validateProjectData(data);
                } catch (e) {
                    throw new Error('Invalid project file: ' + e.message);
                }
                
                // Migrate project data
                this.migrateProjectData(data.project);
                
                // Reload images from folder if imageFolderPath exists
                // This will update data.project.images with loaded images
                if (data.imageFolderPath && data.project.images.length > 0) {
                    await this.reloadImagesFromFolder(data);
                }
                
                this.fileHandle = fileHandle;
                this.app.currentProjectPath = fileHandle.name;
                // Update data.currentProjectPath for restoreProject
                data.currentProjectPath = fileHandle.name;
                this.app.restoreProject(data, false);
                this.app.hasUnsavedChanges = false;
                this.app.updateProjectName();
                return true;
            } else {
                // Fallback: Use file input
                return new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.sbp';
                    input.style.display = 'none';
                    
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) {
                            resolve(false);
                            return;
                        }
                        
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                let data;
                                try {
                                    data = JSON.parse(event.target.result);
                                } catch (e) {
                                    throw new Error('Not valid JSON. File may be corrupted.');
                                }
                                
                                // Handle both old format (direct project) and new format (wrapped)
                                if (data.project) {
                                    // New format with metadata
                                    data = data;
                                } else {
                                    // Old format - wrap it
                                    data = { project: data, version: '0.9.0' };
                                }
                                
                                // Validate project data
                                try {
                                    this.validateProjectData(data);
                                } catch (e) {
                                    throw new Error('Invalid project structure: ' + e.message);
                                }
                                
                                // Migrate project data
                                this.migrateProjectData(data.project);
                                
                                // Reload images from folder if imageFolderPath exists
                                // This will update data.project.images with loaded images
                                if (data.imageFolderPath && data.project.images.length > 0) {
                                    await this.reloadImagesFromFolder(data);
                                }
                                
                                this.app.currentProjectPath = file.name;
                                // Update data.currentProjectPath for restoreProject
                                data.currentProjectPath = file.name;
                                this.app.restoreProject(data, false);
                                this.app.hasUnsavedChanges = false;
                                this.app.updateProjectName();
                                resolve(true);
                            } catch (error) {
                                console.error('Error loading project:', error);
                                await this.app.customAlert('Error loading project file: ' + error.message);
                                resolve(false);
                            }
                        };
                        reader.readAsText(file);
                    };
                    
                    input.oncancel = () => resolve(false);
                    document.body.appendChild(input);
                    input.click();
                    setTimeout(() => document.body.removeChild(input), 100);
                });
            }
        } catch (error) {
            console.error('Error opening project:', error);
            if (error.name === 'AbortError') {
                return false; // User cancelled
            }
            await this.app.customAlert('Error opening project: ' + error.message);
            return false;
        }
    }

    /**
     * Close Project - Clear project and cache
     */
    async closeProject() {
        if (this.app.hasUnsavedChanges || this.app.project.images.length > 0) {
            const result = await this.app.customConfirm(
                'You have unsaved changes. Would you like to save before closing?'
            );
            
            if (result === null) {
                // User cancelled
                return false;
            }
            
            if (result) {
                // Save before closing
                const saved = await this.save();
                if (!saved) {
                    // User cancelled save, don't close
                    return false;
                }
            }
        }

        // Clear project
        this.app.newProject();
        this.fileHandle = null;
        this.app.currentProjectPath = null;
        
        // Clear localStorage
        localStorage.removeItem('storyboard_currentProject');
        localStorage.removeItem('storyboard_tempSave');
        
        return true;
    }

    /**
     * Export PDF - Export storyboard to PDF file
     */
    async exportPDF() {
        if (this.app.project.images.length === 0) {
            await this.app.customAlert('No storyboard to export. Please import images first.');
            return false;
        }
        
        if (!window.jspdf || !window.html2canvas) {
            await this.app.customAlert('PDF libraries not loaded. Please refresh the page.');
            return false;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const orientation = this.app.project.settings.orientation;
            const pageSize = this.app.pageSizes[this.app.project.settings.pageSize];
            
            // Determine PDF orientation and size
            const pdfOrientation = orientation === 'portrait' ? 'p' : 'l';
            const pdfSize = orientation === 'portrait' 
                ? [pageSize.width, pageSize.height] 
                : [pageSize.height, pageSize.width];
            
            const pdf = new jsPDF({
                orientation: pdfOrientation,
                unit: 'mm',
                format: pdfSize
            });
            
            // Get all rendered pages from the DOM
            const container = document.getElementById('storyboardContainer');
            const pages = container.querySelectorAll('.storyboard-page');
            
            if (pages.length === 0) {
                await this.app.customAlert('No pages to export. Please render the storyboard first.');
                return false;
            }
            
            // Show progress (optional - can be enhanced with a progress bar)
            const totalPages = pages.length;
            
            // Capture each page as an image and add to PDF
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                
                if (i > 0) {
                    pdf.addPage();
                }
                
                // Set page background color
                const bgColor = this.app.project.settings.pageBackgroundColor || '#404040';
                const rgb = this.app.hexToRgb(bgColor);
                if (rgb) {
                    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                    pdf.rect(0, 0, pdfSize[0], pdfSize[1], 'F');
                }
                
                // Use html2canvas to capture the page
                const canvas = await html2canvas(page, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: null,
                    width: page.offsetWidth,
                    height: page.offsetHeight,
                    ignoreElements: (element) => {
                        if (element.tagName === 'TEXTAREA') return true;
                        if (element.classList.contains('add-image-button') || 
                            element.classList.contains('empty-slot') ||
                            element.classList.contains('empty-slot-button')) {
                            return true;
                        }
                        return false;
                    }
                });
                
                // Convert canvas to image data
                const imgData = canvas.toDataURL('image/png');
                
                // Calculate dimensions to fit PDF page
                const pageWidthMm = pdfSize[0];
                const pageHeightMm = pdfSize[1];
                const pageWidthPx = page.offsetWidth;
                const pageHeightPx = page.offsetHeight;
                
                const pagePaddingTotal = 5 * 2;
                const availableWidth = pageWidthMm - pagePaddingTotal;
                const availableHeight = pageHeightMm - pagePaddingTotal;
                
                const scaleX = availableWidth / (pageWidthPx * 0.264583);
                const scaleY = availableHeight / (pageHeightPx * 0.264583);
                const scale = Math.min(scaleX, scaleY);
                
                const imgWidth = pageWidthPx * 0.264583 * scale;
                const imgHeight = pageHeightPx * 0.264583 * scale;
                const x = (pageWidthMm - imgWidth) / 2;
                const y = (pageHeightMm - imgHeight) / 2;
                
                pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            }
            
            // Save PDF
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `storyboard-export-${timestamp}.pdf`;
            
            if (this.supportsFileSystemAccess) {
                // Use File System Access API
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'PDF Document',
                            accept: { 'application/pdf': ['.pdf'] }
                        }]
                    });
                    
                    const pdfBlob = pdf.output('blob');
                    const writable = await fileHandle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                    
                    return true;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        return false; // User cancelled
                    }
                    throw error;
                }
            } else {
                // Fallback: Download
                pdf.save(filename);
                return true;
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            if (error.name === 'AbortError') {
                return false; // User cancelled
            }
            await this.app.customAlert('Error exporting PDF: ' + error.message);
            return false;
        }
    }

    /**
     * Set file handle (used when loading a project)
     */
    setFileHandle(handle) {
        this.fileHandle = handle;
    }

    /**
     * Get current file handle
     */
    getFileHandle() {
        return this.fileHandle;
    }

    /**
     * Create lightweight project data (without base64 image URLs)
     * Only stores paths and metadata, not the actual image data
     */
    createLightweightProject() {
        return {
            images: this.app.project.images.map(img => ({
                name: img.name,
                originalName: img.originalName || img.name,
                filePath: img.filePath || img.name,
                sceneNumber: img.sceneNumber || '',
                shotNumber: img.shotNumber || '',
                frameNumber: img.frameNumber || '',
                scene: img.scene || img.sceneNumber || '' // Backward compatibility
                // Explicitly NOT saving url (base64) - will be reloaded from folder
            })),
            settings: this.app.project.settings,
            frameTexts: this.app.project.frameTexts || {},
            pageTexts: this.app.project.pageTexts || {},
            imageScenes: this.app.project.imageScenes || {},
            drawings: this.app.project.drawings || {}, // Drawings are small, keep them
            activePanel: this.app.project.activePanel
        };
    }
    
    /**
     * Validate project file structure and checksum
     */
    validateProjectData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid project file: Not a valid object');
        }
        
        // Check version
        if (!data.version) {
            console.warn('Project file missing version - may be from older version');
        }
        
        // Validate project structure
        if (!data.project || typeof data.project !== 'object') {
            throw new Error('Invalid project file: Missing project data');
        }
        
        if (!Array.isArray(data.project.images)) {
            throw new Error('Invalid project file: Images must be an array');
        }
        
        if (!data.project.settings || typeof data.project.settings !== 'object') {
            throw new Error('Invalid project file: Missing settings');
        }
        
        // Validate checksum if present
        if (data.checksum) {
            const dataCopy = { ...data };
            delete dataCopy.checksum;
            const dataStr = JSON.stringify(dataCopy, null, 2);
            const calculatedChecksum = simpleHash(dataStr);
            
            if (calculatedChecksum !== data.checksum) {
                console.warn('Project file checksum mismatch - file may be corrupted');
                // Don't throw - allow loading with warning
            }
        }
        
        return true;
    }
    
    /**
     * Reload images from folder when loading a project
     * This restores the base64 URLs from the image files
     */
    async reloadImagesFromFolder(data) {
        if (!data.imageFolderPath || !data.project.images || data.project.images.length === 0) {
            console.warn('No image folder path or images stored - images will need to be re-imported');
            return;
        }
        
        try {
            // Try to access the directory using File System Access API
            if (this.supportsFileSystemAccess) {
                // First, try to get stored directory handle from IndexedDB
                const projectPath = data.currentProjectPath || 'default';
                let directoryHandle = await this.getDirectoryHandle(projectPath);
                
                if (directoryHandle) {
                    // We have a stored handle, use it directly
                    this.directoryHandle = directoryHandle;
                    // Update data.project.images with loaded images
                    data.project.images = await this.loadImagesFromDirectory(directoryHandle, data.project.images);
                    return;
                }
                
                // No stored handle, prompt user once
                try {
                    this.directoryHandle = await window.showDirectoryPicker({
                        mode: 'read'
                    });
                    
                    // Store the handle for future use
                    await this.storeDirectoryHandle(projectPath, this.directoryHandle);
                    
                    // Load images from the directory and update data.project.images
                    data.project.images = await this.loadImagesFromDirectory(this.directoryHandle, data.project.images);
                    return;
                } catch (error) {
                    if (error.name === 'AbortError') {
                        // User cancelled - set flags for later import
                        this.app.imagesNeedReload = true;
                        this.app.pendingImageMetadata = data.project.images;
                        return;
                    }
                    throw error;
                }
            } else {
                // Fallback: Use file input to select folder
                const loadedImages = await this.loadImagesViaFileInput(data.project.images);
                if (loadedImages && Array.isArray(loadedImages)) {
                    data.project.images = loadedImages;
                }
            }
        } catch (error) {
            console.error('Error reloading images:', error);
            // Fallback: Set flags for manual import
            this.app.imagesNeedReload = true;
            this.app.pendingImageMetadata = data.project.images;
        }
    }
    
    /**
     * Load images from a directory handle (for import, no metadata merging)
     */
    async loadImagesFromDirectoryHandle(directoryHandle) {
        const imageFiles = [];
        
        // Recursively get all image files from directory
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file') {
                const fileName = name.toLowerCase();
                if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                    imageFiles.push({ handle, name });
                }
            } else if (handle.kind === 'directory') {
                // Recursively search subdirectories
                await this.searchDirectoryForImages(handle, new Map(), imageFiles);
            }
        }
        
        // Sort by filename
        imageFiles.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        // Load images as base64
        const loadedImages = await Promise.all(
            imageFiles.map(async ({ handle, name }) => {
                const file = await handle.getFile();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileName = name.replace(/\.[^/.]+$/, ''); // Remove extension
                        const existingScene = this.app.project.imageScenes[name] || '';
                        const existingImage = this.app.project.images.find(img => img.name === name);
                        const existingShot = existingImage ? (existingImage.shotNumber || '') : '';
                        
                        resolve({
                            name: name,
                            originalName: name,
                            url: e.target.result,
                            sceneNumber: existingScene,
                            shotNumber: existingShot,
                            frameNumber: fileName,
                            scene: existingScene,
                            filePath: name
                        });
                    };
                    reader.readAsDataURL(file);
                });
            })
        );
        
        // Merge with existing images (same logic as importImages)
        const isFirstImport = this.app.project.images.length === 0;
        const existingImagesMap = new Map();
        
        if (!isFirstImport) {
            this.app.project.images.forEach(img => {
                existingImagesMap.set(img.name, img);
            });
            
            loadedImages.forEach(newImg => {
                const existing = existingImagesMap.get(newImg.name);
                if (existing) {
                    existing.url = newImg.url;
                    existing.filePath = newImg.filePath;
                } else {
                    existingImagesMap.set(newImg.name, newImg);
                }
            });
            
            this.app.project.images = Array.from(existingImagesMap.values());
        } else {
            this.app.project.images = loadedImages;
        }
        
        // Store folder path
        this.app.imageFolderPath = 'imported';
        
        this.app.markChanged();
        this.app.renderStoryboard();
    }
    
    /**
     * Load images from a directory handle using File System Access API (with metadata merging)
     * Returns the loaded images array
     */
    async loadImagesFromDirectory(directoryHandle, imageMetadata) {
        const imageFiles = [];
        const metadataMap = new Map();
        
        // Create map of metadata by filename
        imageMetadata.forEach(meta => {
            metadataMap.set(meta.name, meta);
        });
        
        // Recursively get all image files from directory
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file') {
                const fileName = name.toLowerCase();
                if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                    // Check if this image is in our metadata
                    if (metadataMap.has(name)) {
                        imageFiles.push({ handle, name, metadata: metadataMap.get(name) });
                    }
                }
            } else if (handle.kind === 'directory') {
                // Recursively search subdirectories
                await this.searchDirectoryForImages(handle, metadataMap, imageFiles);
            }
        }
        
        // Sort by filename to match original order
        imageFiles.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        // Load images as base64
        const loadedImages = await Promise.all(
            imageFiles.map(async ({ handle, name, metadata }) => {
                const file = await handle.getFile();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        resolve({
                            name: name,
                            originalName: metadata.originalName || name,
                            url: e.target.result,
                            sceneNumber: metadata.sceneNumber || '',
                            shotNumber: metadata.shotNumber || '',
                            frameNumber: metadata.frameNumber || '',
                            scene: metadata.scene || metadata.sceneNumber || '',
                            filePath: metadata.filePath || name
                        });
                    };
                    reader.readAsDataURL(file);
                });
            })
        );
        
        // Return loaded images (don't update app.project here - that will be done in restoreProject)
        this.app.imagesNeedReload = false;
        this.app.pendingImageMetadata = null;
        
        return loadedImages;
    }
    
    /**
     * Recursively search directory for images
     */
    async searchDirectoryForImages(directoryHandle, metadataMap, imageFiles) {
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file') {
                const fileName = name.toLowerCase();
                if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                    if (metadataMap.has(name)) {
                        imageFiles.push({ handle, name, metadata: metadataMap.get(name) });
                    }
                }
            } else if (handle.kind === 'directory') {
                await this.searchDirectoryForImages(handle, metadataMap, imageFiles);
            }
        }
    }
    
    /**
     * Load images via file input (fallback for browsers without File System Access API)
     */
    async loadImagesViaFileInput(imageMetadata) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.directory = true;
            input.multiple = true;
            input.accept = 'image/*';
            input.style.display = 'none';
            
            input.onchange = async (e) => {
                const files = Array.from(e.target.files).filter(file => 
                    file.type.startsWith('image/')
                );
                
                if (files.length === 0) {
                    resolve(false);
                    return;
                }
                
                // Create metadata map
                const metadataMap = new Map();
                imageMetadata.forEach(meta => {
                    metadataMap.set(meta.name, meta);
                });
                
                // Load images
                const loadedImages = await Promise.all(
                    files
                        .filter(file => metadataMap.has(file.name))
                        .map(file => {
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    const metadata = metadataMap.get(file.name);
                                    resolve({
                                        name: file.name,
                                        originalName: metadata.originalName || file.name,
                                        url: e.target.result,
                                        sceneNumber: metadata.sceneNumber || '',
                                        shotNumber: metadata.shotNumber || '',
                                        frameNumber: metadata.frameNumber || '',
                                        scene: metadata.scene || metadata.sceneNumber || '',
                                        filePath: metadata.filePath || file.name
                                    });
                                };
                                reader.readAsDataURL(file);
                            });
                        })
                );
                
                // Sort by filename
                loadedImages.sort((a, b) => {
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                });
                
                // Return loaded images (don't update app.project here - that will be done in restoreProject)
                this.app.imagesNeedReload = false;
                this.app.pendingImageMetadata = null;
                
                resolve(loadedImages);
            };
            
            input.oncancel = () => {
                // User cancelled - set flags for later
                this.app.imagesNeedReload = true;
                this.app.pendingImageMetadata = imageMetadata;
                resolve(false);
            };
            
            document.body.appendChild(input);
            input.click();
            setTimeout(() => document.body.removeChild(input), 100);
        });
    }
    
    /**
     * Migrate project data for backward compatibility
     */
    migrateProjectData(project) {
        // Ensure new fields exist for backward compatibility
        if (!project.pageTexts) project.pageTexts = {};
        if (!project.imageScenes) project.imageScenes = {};
        if (!project.settings) project.settings = {};
        if (!project.settings.pageBackgroundColor) project.settings.pageBackgroundColor = '#404040';
        if (!project.settings.separateScenes) project.settings.separateScenes = false;
        if (!project.settings.orientation) project.settings.orientation = 'landscape';
        if (!project.settings.imagesPerPage) project.settings.imagesPerPage = 6;
        
        // Migrate old layoutRows/layoutCols to imagesPerPage
        if (!project.settings.imagesPerPage || project.settings.imagesPerPage === 0) {
            if (project.settings.layoutRows && project.settings.layoutCols) {
                project.settings.imagesPerPage = project.settings.layoutRows * project.settings.layoutCols;
            } else {
                // Convert old layout format
                const oldLayout = project.settings.layout || 'grid-2';
                const num = parseInt(oldLayout.split('-')[1]) || 2;
                project.settings.imagesPerPage = num <= 1 ? 1 : num <= 2 ? 4 : num <= 3 ? 6 : 6;
            }
        }
    }
}

