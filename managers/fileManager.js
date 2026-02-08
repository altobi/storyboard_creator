/**
 * File Manager Module
 * Handles all file operations for the Storyboard Creator application
 * Uses File System Access API when available, falls back to download method
 */

// Simple hash function for checksum
function simpleHash(str) {
    let hash = 0;
                    for (let i = 0;
                    i < str.length;
                    i++) {
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
                    this.dbVersion = 2; // Increment version to add projectData store
        this.initDB();
    }
    
    /**
     * Initialize IndexedDB for storing directory handles
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                resolve(false);
                    return;
            }
                    const request = indexedDB.open(this.dbName, this.dbVersion);
                    request.onerror = () => {
                resolve(false);
            };
                    request.onsuccess = () => {
                this.db = request.result;
                    resolve(true);
            };
                    request.onupgradeneeded = (event) => {
                const db = event.target.result;
                    const oldVersion = event.oldVersion;
                
                // Create handles store if it doesn't exist
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles', { keyPath: 'id' });
                }
                
                // Add projectData store for large temp saves (version 2+)
                if (oldVersion < 2 && !db.objectStoreNames.contains('projectData')) {
                    db.createObjectStore('projectData', { keyPath: 'id' });
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
            
            // Store as last used directory for file pickers
            await store.put({
                id: 'lastUsedDirectory',
                handle: directoryHandle
            });
        }
                    catch (error) {
        }
    }
    
    /**
     * Get directory for file pickers (prioritizes project directory, then last used)
     */
    async getDirectoryForPicker() {
        // First priority: If project is open, use project's directory
        // Note: getParent() may not be supported in Safari
        if (this.fileHandle && this.fileHandle.getParent && typeof this.fileHandle.getParent === 'function') {
            try {
                const projectDir = await this.fileHandle.getParent();
                    if (projectDir) {
                    // Verify permission
                    let permission = await projectDir.queryPermission({ mode: 'read' });
                    if (permission === 'granted') {
                        return projectDir;
                    }
                    else if (permission === 'prompt') {
                        permission = await projectDir.requestPermission({ mode: 'read' });
                    if (permission === 'granted') {
                            return projectDir;
                        }
                    }
                }
            }
                    catch (e) {
            }
        }
                    else if (this.fileHandle) {
        }
        
        // Second priority: Last used directory
        const lastUsed = await this.getLastUsedDirectory();
                    if (lastUsed) {
            return lastUsed;
        }
                    else {
        }
                    return null;
    }
    
    /**
     * Get last used directory handle for file pickers
     */
    async getLastUsedDirectory() {
        if (!this.db) return null;
                    try {
            const transaction = this.db.transaction(['handles'], 'readonly');
                    const store = transaction.objectStore('handles');
                    const request = store.get('lastUsedDirectory');
                    return new Promise((resolve) => {
                request.onsuccess = async () => {
                    const result = request.result;
                    if (result && result.handle) {
                        try {
                            // Verify handle is still valid
                            const permission = await result.handle.queryPermission({ mode: 'read' });
                    if (permission === 'granted') {
                                resolve(result.handle);
                            }
                    else {
                                resolve(null);
                            }
                        }
                    catch (e) {
                            resolve(null);
                        }
                    }
                    else {
                        resolve(null);
                    }
                };
                    request.onerror = () => resolve(null);
            });
        }
                    catch (error) {
            return null;
        }
    }
    
    /**
     * Store last used directory handle (for file pickers)
     */
    async storeLastUsedDirectory(directoryHandle) {
        if (!this.db || !directoryHandle) return;
                    try {
            const transaction = this.db.transaction(['handles'], 'readwrite');
                    const store = transaction.objectStore('handles');
                    await store.put({
                id: 'lastUsedDirectory',
                handle: directoryHandle
            });
        }
                    catch (error) {
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
                        }
                    else {
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
                    }
                    catch (e) {
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
                            }
                    else {
                                resolve(null);
                            }
                        }
                    catch (e) {
                            resolve(null);
                        }
                    }
                    else {
                        resolve(null);
                    }
                };
                    defaultRequest.onerror = () => resolve(null);
            });
        }
                    catch (error) {
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
            // CRITICAL: Force a microtask to ensure all property deletions are processed
            await new Promise(resolve => setTimeout(resolve, 10));
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
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
            // CRITICAL: Save to currentProject so it persists after page reload
            await this.app.saveToStorage(false);
                    this.app.updateProjectName();
                    return true;
        }
                    else {
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
                // Get directory for picker (project directory or last used)
                const startDir = await this.getDirectoryForPicker();
                    const pickerOptions = {
                    suggestedName: 'storyboard-project.sbp',
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }],
                    // Use 'id' option to help Chrome remember the directory
                    id: 'newProject'
                };
                
                // Use directory if available
                // Note: startIn may not work on all browsers/OS (especially Mac Safari)
                if (startDir) {
                    try {
                        pickerOptions.startIn = startDir;
                    }
                    catch (e) {
                    }
                }
                    else {
                }
                    const fileHandle = await window.showSaveFilePicker(pickerOptions);
                    this.fileHandle = fileHandle;
                
                // Store the directory of the saved file as last used
                // Note: getParent() may not be supported in Safari
                try {
                    if (fileHandle.getParent && typeof fileHandle.getParent === 'function') {
                        const parentDir = await fileHandle.getParent();
                    if (parentDir) {
                            await this.storeLastUsedDirectory(parentDir);
                        }
                    }
                    else {
                    }
                }
                    catch (e) {
                }
                    return {
                    directory: null, // Not needed with File System Access API
                    filename: fileHandle.name
                };
            }
                    catch (error) {
                if (error.name === 'AbortError') {
                    return null; // User cancelled
                }
                    console.error('Error showing save dialog:', error);
                    await this.app.customAlert('Error: Could not access file system. Please try again.');
                    return null;
            }
        }
                    else {
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
        // If no project path exists, use Save As (this will show dialog)
        if (!this.app.currentProjectPath) {
            console.log('[SAVE] No project path, using Save As');
                    return await this.saveAs();
        }
        console.log('[SAVE] Starting save operation', {
            hasFileHandle: !!this.fileHandle,
            fileHandleName: this.fileHandle?.name,
            currentProjectPath: this.app.currentProjectPath,
            supportsFileSystemAccess: this.supportsFileSystemAccess
        });
        try {
            // CRITICAL: Ensure all images have URLs before saving
            // Without URLs, projects won't work across browsers or after reload
            const imagesWithoutUrls = this.app.project.images.filter(img => !img.url);
            if (imagesWithoutUrls.length > 0) {
                console.error('CRITICAL: Some images are missing URLs before save:', {
                    totalImages: this.app.project.images.length,
                    imagesWithoutUrls: imagesWithoutUrls.length,
                    missingUrls: imagesWithoutUrls.map(img => img.name)
                });
                
                // Try to get URLs from DOM if available (last resort fallback)
                // This shouldn't be necessary, but helps in edge cases
                for (const img of imagesWithoutUrls) {
                    const imgElement = document.querySelector(`img[alt="${img.name}"]`);
                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:')) {
                        img.url = imgElement.src;
                    }
                }
            }
            
            // Create project data (ALWAYS includes Base64 URLs for cross-browser compatibility)
            // CRITICAL: Force a microtask to ensure all property deletions are processed
            // This is especially important for Safari, which may cache object references
            await new Promise(resolve => setTimeout(resolve, 10));
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
                // Chrome/Edge: Use File System Access API to write directly to file
                try {
                    // CRITICAL: Request write permission before writing
                    // File handles opened with showOpenFilePicker only have read permission by default
                    let permission = 'granted';
                    if (this.fileHandle.queryPermission) {
                        permission = await this.fileHandle.queryPermission({ mode: 'readwrite' });
                        if (permission !== 'granted') {
                            // Request write permission
                            permission = await this.fileHandle.requestPermission({ mode: 'readwrite' });
                        }
                    }
                    if (permission !== 'granted') {
                        // Permission denied - fall back to Save As
                        return await this.saveAs();
                    }
                    console.log('[SAVE] Creating writable stream...');
                    const writable = await this.fileHandle.createWritable();
                    console.log('[SAVE] Writable stream created, truncating file...');
                    // Truncate file to 0 bytes first to ensure complete overwrite
                    await writable.truncate(0);
                    console.log('[SAVE] File truncated, writing data blob (size:', dataBlob.size, 'bytes)...');
                    await writable.write(dataBlob);
                    console.log('[SAVE] Data written, closing stream...');
                    await writable.close();
                    console.log('[SAVE] File write completed successfully!');
                    
                    // Verify the file was written by reading it back (for debugging)
                    try {
                        const file = await this.fileHandle.getFile();
                        const fileText = await file.text();
                        const parsed = JSON.parse(fileText);
                    } catch (verifyError) {
                        // Verification failed, but file write may have succeeded
                    }
                } catch (writeError) {
                    console.error('[SAVE] File write error:', writeError);
                    console.error('[SAVE] Error details:', {
                        name: writeError.name,
                        message: writeError.message,
                        stack: writeError.stack
                    });
                    
                    // If fileHandle is invalid or permission denied, fall back to Save As
                    if (writeError.name === 'NotAllowedError' || writeError.name === 'SecurityError' || writeError.message.includes('permission')) {
                        console.log('[SAVE] Permission error, falling back to Save As');
                        return await this.saveAs();
                    }
                    throw writeError;
                }
                
                // CRITICAL: Save Base64 URLs separately to IndexedDB for Safari compatibility
                // This keeps the project file lightweight while ensuring Safari can load images
                await this.saveImageUrlsToIndexedDB(this.app.currentProjectPath);
                this.app.hasUnsavedChanges = false;
                this.app.lastChangeTime = null;
                this.app.updateSaveStatus();
                // CRITICAL: Save to currentProject so it persists after page reload
                await this.app.saveToStorage(false);
                // Store last saved timestamp
                localStorage.setItem('storyboard_lastSaved', Date.now().toString());
                this.app.updateProjectName();
                if (this.app.updateProjectInfo) this.app.updateProjectInfo();
                this.app.showToast('Project saved successfully', 'success');
                return true;
            } else {
                // Safari: No File System Access API, so we can't write to file directly
                // Just save to localStorage/IndexedDB silently (no download dialog)
                // The project will persist in browser storage and can be exported via Save As if needed
                console.log('[SAVE] No File System Access API support, saving to localStorage/IndexedDB only');
                this.app.hasUnsavedChanges = false;
                this.app.lastChangeTime = null;
                this.app.updateSaveStatus();
                // CRITICAL: Save to currentProject so it persists after page reload
                await this.app.saveToStorage(false);
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
            // CRITICAL: Ensure all images have URLs before saving
            const imagesWithoutUrls = this.app.project.images.filter(img => !img.url);
                    if (imagesWithoutUrls.length > 0) {
                console.error('CRITICAL: Some images are missing URLs before saveAs:', {
                    totalImages: this.app.project.images.length,
                    imagesWithoutUrls: imagesWithoutUrls.length,
                    missingUrls: imagesWithoutUrls.map(img => img.name)
                });
                
                // Try to get URLs from DOM if available (last resort fallback)
                for (const img of imagesWithoutUrls) {
                    const imgElement = document.querySelector(`img[alt="${img.name}"]`);
                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:')) {
                        img.url = imgElement.src;
                    }
                }
            }
                    const filename = suggestedFilename || 
                (this.app.currentProjectPath ? this.app.currentProjectPath : 'storyboard-project.sbp');
                    if (this.supportsFileSystemAccess) {
                // Use File System Access API
                // Get directory for picker (project directory or last used)
                const startDir = await this.getDirectoryForPicker();
                    const pickerOptions = {
                    suggestedName: filename,
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }],
                    // Use 'id' option to help Chrome remember the directory
                    id: 'saveAs'
                };
                
                // Use directory if available
                // Note: startIn may not work on all browsers/OS (especially Mac Safari)
                if (startDir) {
                    try {
                        pickerOptions.startIn = startDir;
                    }
                    catch (e) {
                    }
                }
                    else {
                }
                    const fileHandle = await window.showSaveFilePicker(pickerOptions);
                
                // Store the directory of the saved file as last used
                // Note: getParent() may not be supported in Safari
                try {
                    if (fileHandle.getParent && typeof fileHandle.getParent === 'function') {
                        const parentDir = await fileHandle.getParent();
                    if (parentDir) {
                            await this.storeLastUsedDirectory(parentDir);
                        }
                    }
                    else {
                        // No parent directory available
                    }
                }
                    catch (e) {
                    // Error getting parent directory, continue anyway
                }
                
                // Create project data (ALWAYS includes Base64 URLs for cross-browser compatibility)
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
                // Truncate file to 0 bytes first to ensure complete overwrite
                await writable.truncate(0);
                    await writable.write(dataBlob);
                    await writable.close();
                    this.fileHandle = fileHandle;
                    this.app.currentProjectPath = fileHandle.name;
                
                // CRITICAL: Save Base64 URLs separately to IndexedDB for Safari compatibility
                // This keeps the project file lightweight while ensuring Safari can load images
                await this.saveImageUrlsToIndexedDB(fileHandle.name);
                
                // Store the directory of the saved file as last used
                try {
                    const parentDir = await fileHandle.getParent();
                    if (parentDir) {
                        await this.storeLastUsedDirectory(parentDir);
                    }
                }
                    catch (e) {
                }
                    this.app.hasUnsavedChanges = false;
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
                // CRITICAL: Save to currentProject so it persists after page reload
                await this.app.saveToStorage(false);
                // Store last saved timestamp
                localStorage.setItem('storyboard_lastSaved', Date.now().toString());
                    this.app.updateProjectName();
                    if (this.app.updateProjectInfo) this.app.updateProjectInfo();
                    this.app.showToast('Project saved successfully', 'success');
                    return true;
            }
                    else {
                // Fallback: Use download method (Safari and other browsers without File System Access API)
                // CRITICAL: Force a microtask to ensure all property deletions are processed
                // This is especially important for Safari, which may cache object references
                await new Promise(resolve => setTimeout(resolve, 10));
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
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
                // CRITICAL: Save to currentProject so it persists after page reload
                await this.app.saveToStorage(false);
                    this.app.updateProjectName();
                    this.app.showToast('Project saved successfully', 'success');
                    return true;
            }
        }
                    catch (error) {
            console.error('Error in saveAs:', error);
                    if (error.name === 'AbortError') {
                return false; // User cancelled
            }
                    await this.app.customAlert('Error saving project: ' + error.message);
                    return false;
        }
    }

    /**
     * Open project from a File object (used by Safari fallback)
     */
    async openProjectFromFile(file) {
        try {
            const reader = new FileReader();
                    return new Promise((resolve, reject) => {
                reader.onload = async (event) => {
                    try {
                        let data;
                    try {
                            data = JSON.parse(event.target.result);
                        }
                    catch (e) {
                            console.error('JSON parse error:', e);
                    throw new Error('Not valid JSON. File may be corrupted.');
                        }
                        
                        // Handle both old format (direct project) and new format (wrapped)
                        if (data.project) {
                            // New format with metadata
                            data = data;
                        }
                    else {
                            // Old format - wrap it
                            data = { project: data, version: '0.9.0' };
                        }
                        
                        // Validate project data
                        try {
                            this.validateProjectData(data);
                        }
                    catch (e) {
                            console.error('Validation error:', e);
                    throw new Error('Invalid project structure: ' + e.message);
                        }
                        
                        // Migrate project data
                        this.migrateProjectData(data.project);
                        
                        // Project file now contains compressed Base64 URLs
                        // Images should have URLs directly in the project file
                        // Check if images have URLs - if not, try IndexedDB as fallback (backward compatibility)
                        const hasImageUrls = data.project.images.some(img => img.url);
                    if (!hasImageUrls) {
                            // Old project format - try IndexedDB as fallback
                            const projectPath = file.name;
                    const imageUrls = await this.loadImageUrlsFromIndexedDB(projectPath);
                    if (imageUrls) {
                                // Found URLs in IndexedDB - merge them into project images
                                data.project.images.forEach(img => {
                                    if (img.filePath && imageUrls[img.filePath]) {
                                        img.url = imageUrls[img.filePath];
                                    }
                    else if (img.name && imageUrls[img.name]) {
                                        img.url = imageUrls[img.name];
                                    }
                                });
                            }
                        }
                    this.app.currentProjectPath = file.name;
                    data.currentProjectPath = file.name;
                    if (this.app.storageService) {
                            await this.app.storageService.restoreProject(data, false);
                        }
                    else {
                            await this.app.restoreProject(data, false);
                        }
                    this.app.hasUnsavedChanges = false;
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
                        // CRITICAL: Save to currentProject so it persists after page reload
                        await this.app.saveToStorage(false);
                    this.app.updateProjectName();
                    resolve(true);
                    }
                    catch (error) {
                        console.error('Error loading project:', error);
                    console.error('Error stack:', error.stack);
                    try {
                            await this.app.customAlert('Error loading project file: ' + error.message);
                        }
                    catch (alertError) {
                            alert('Error loading project file: ' + error.message);
                        }
                    reject(error);
                    }
                };
                    reader.onerror = (error) => {
                    console.error('FileReader error:', error);
                    reject(new Error('Failed to read file'));
                };
                    reader.onabort = () => {
                    reject(new Error('File read was aborted'));
                };
                    reader.readAsText(file);
            });
        }
                    catch (error) {
            console.error('Error in openProjectFromFile:', error);
                    throw error;
        }
    }

    /**
     * Open Project - Load project from file
     */
    async openProject() {
        
        try {
            if (this.supportsFileSystemAccess) {
                // Use File System Access API
                // Get directory for picker (project directory or last used)
                const startDir = await this.getDirectoryForPicker();
                    const pickerOptions = {
                    types: [{
                        description: 'Storyboard Project',
                        accept: { 'application/json': ['.sbp'] }
                    }],
                    multiple: false,
                    // Use 'id' option to help Chrome remember the directory
                    id: 'openProject'
                };
                
                // Use directory if available
                // Note: startIn may not work on all browsers/OS (especially Mac Safari)
                if (startDir) {
                    try {
                        pickerOptions.startIn = startDir;
                    }
                    catch (e) {
                    }
                }
                    else {
                }
                    const [fileHandle] = await window.showOpenFilePicker(pickerOptions);
                
                // Store the directory of the opened file as last used
                // Note: getParent() may not be supported in all browsers (e.g., Safari)
                try {
                    if (fileHandle.getParent && typeof fileHandle.getParent === 'function') {
                        const parentDir = await fileHandle.getParent();
                    if (parentDir) {
                            await this.storeLastUsedDirectory(parentDir);
                        }
                    }
                    else {
                    }
                }
                    catch (e) {
                }
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    let data;
                    try {
                    data = JSON.parse(text);
                }
                    catch (e) {
                    console.error('JSON parse error:', e);
                    throw new Error('Invalid project file: Not valid JSON. File may be corrupted.');
                }
                
                // Handle both old format (direct project) and new format (wrapped)
                if (data.project) {
                    // New format with metadata
                    data = data;
                }
                    else {
                    // Old format - wrap it
                    data = { project: data, version: '0.9.0' }; // Mark as old version
                }
                
                // Validate project data
                try {
                    this.validateProjectData(data);
                }
                    catch (e) {
                    throw new Error('Invalid project file: ' + e.message);
                }
                
                // Migrate project data
                this.migrateProjectData(data.project);
                
                // Project file now contains compressed Base64 URLs
                // Images should have URLs directly in the project file
                // Check if images have URLs - if not, try IndexedDB as fallback (backward compatibility)
                const hasImageUrls = data.project.images.some(img => img.url);
                    if (!hasImageUrls) {
                    // Old project format - try IndexedDB as fallback
                    const projectPath = fileHandle.name;
                    const imageUrls = await this.loadImageUrlsFromIndexedDB(projectPath);
                    if (imageUrls) {
                        // Found URLs in IndexedDB - merge them into project images
                        data.project.images.forEach(img => {
                            if (img.filePath && imageUrls[img.filePath]) {
                                img.url = imageUrls[img.filePath];
                            }
                    else if (img.name && imageUrls[img.name]) {
                                img.url = imageUrls[img.name];
                            }
                        });
                    }
                }
                    this.fileHandle = fileHandle;
                    this.app.currentProjectPath = fileHandle.name;
                    console.log('[OPEN] File handle stored:', {
                    hasFileHandle: !!this.fileHandle,
                    fileName: fileHandle.name,
                    currentProjectPath: this.app.currentProjectPath
                });
                
                // Store the directory of the opened file as last used (duplicate check removed)
                // Note: getParent() may not be supported in all browsers (e.g., Safari)
                // This was already done above, so we skip it here to avoid duplicate calls
                
                // Update data.currentProjectPath for restoreProject
                data.currentProjectPath = fileHandle.name;
                
                // Wrap restoreProject in try-catch for better error handling
                try {
                    await this.app.restoreProject(data, false);
                }
                    catch (restoreError) {
                    console.error('Error restoring project:', restoreError);
                    console.error('Restore error stack:', restoreError.stack);
                    throw new Error('Failed to restore project: ' + restoreError.message);
                }
                    this.app.hasUnsavedChanges = false;
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
                // CRITICAL: Save to currentProject so it persists after page reload
                await this.app.saveToStorage(false);
                    this.app.updateProjectName();
                    return true;
            }
                    else {
                // Fallback: Use file input (for browsers that don't support File System Access API, like Safari)
                return new Promise((resolve) => {
                    try {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.sbp';
                    input.style.display = 'none';
                    input.setAttribute('id', 'temp-file-input-' + Date.now());
                    let resolved = false;
                    input.onchange = async (e) => {
                            if (resolved) {
                                return;
                            }
                    const file = e.target.files[0];
                    if (!file) {
                                resolved = true;
                    resolve(false);
                    cleanup();
                    return;
                        }
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                            try {
                                let data;
                    try {
                                    data = JSON.parse(event.target.result);
                                }
                    catch (e) {
                                        console.error('JSON parse error:', e);
                    throw new Error('Not valid JSON. File may be corrupted.');
                                }
                                
                                // Handle both old format (direct project) and new format (wrapped)
                                if (data.project) {
                                    // New format with metadata
                                    data = data;
                                }
                    else {
                                    // Old format - wrap it
                                    data = { project: data, version: '0.9.0' };
                                }
                                
                                // Validate project data
                                try {
                                    this.validateProjectData(data);
                                }
                    catch (e) {
                                        console.error('Validation error:', e);
                    throw new Error('Invalid project structure: ' + e.message);
                                }
                                
                                // Migrate project data
                                this.migrateProjectData(data.project);
                                
                                    // Check if images already have URLs (from Safari saves or old format)
                                    const hasImageUrls = data.project.images.some(img => img.url);
                    if (hasImageUrls) {
                                        // Images already have URLs (from Safari or old format) - use them directly
                                        // No need to reload - URLs are already in the project data
                                    }
                    else if (data.imageFolderPath && data.project.images.length > 0) {
                                        // Images don't have URLs - try to reload from folder (Chrome/Edge)
                                    await this.reloadImagesFromFolder(data);
                                }
                    this.app.currentProjectPath = file.name;
                                // Update data.currentProjectPath for restoreProject
                                data.currentProjectPath = file.name;
                    if (this.app.storageService) {
                            await this.app.storageService.restoreProject(data, false);
                        }
                    else {
                            await this.app.restoreProject(data, false);
                        }
                    this.app.hasUnsavedChanges = false;
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
                                    // CRITICAL: Save to currentProject so it persists after page reload
                                    await this.app.saveToStorage(false);
                    this.app.updateProjectName();
                    resolved = true;
                    resolve(true);
                    cleanup();
                            }
                    catch (error) {
                                console.error('Error loading project:', error);
                    console.error('Error stack:', error.stack);
                    resolved = true;
                    try {
                                await this.app.customAlert('Error loading project file: ' + error.message);
                                    }
                    catch (alertError) {
                                        alert('Error loading project file: ' + error.message);
                                    }
                    resolve(false);
                    cleanup();
                            }
                        };
                    reader.onerror = (error) => {
                                console.error('FileReader error:', error);
                    resolved = true;
                    resolve(false);
                    cleanup();
                            };
                    reader.onabort = () => {
                                resolved = true;
                    resolve(false);
                    cleanup();
                            };
                    reader.readAsText(file);
                    };
                    input.oncancel = () => {
                            if (!resolved) {
                                resolved = true;
                    resolve(false);
                            }
                    cleanup();
                        };
                    const cleanup = () => {
                            setTimeout(() => {
                                if (input.parentNode) {
                                    document.body.removeChild(input);
                                }
                            }, 1000);
                        };
                    document.body.appendChild(input);
                        
                        // Safari requires the click to happen synchronously in the same event loop
                        // Try clicking immediately first
                        try {
                    input.click();
                        }
                    catch (clickError) {
                            console.error('Error clicking file input:', clickError);
                            // If immediate click fails, try with a minimal delay
                            setTimeout(() => {
                                try {
                                    input.click();
                                }
                    catch (retryError) {
                                    console.error('Error on retry click:', retryError);
                    resolved = true;
                    resolve(false);
                    cleanup();
                                }
                            }, 0);
                        }
                    }
                    catch (error) {
                        console.error('Error creating file input:', error);
                    resolve(false);
                    }
                });
            }
        }
                    catch (error) {
            if (error.name === 'AbortError') {
                // User cancelled file picker - this is normal, not an error
                return false;
            }
                    if (error.name === 'NotAllowedError') {
                // Permission denied - this is also expected in some cases
                return false;
            }
            
            // Actual errors should be logged
            console.error('Error opening project:', error);
                    console.error('Error name:', error.name);
                    console.error('Error message:', error.message);
                    console.error('Error stack:', error.stack);
            
            // Show detailed error message to user
            const errorMessage = error.message || 'Unknown error occurred while opening the project file.';
                    console.error('Showing error alert to user:', errorMessage);
            
            // Try to show alert, but if that fails, at least log it
            try {
                await this.app.customAlert('Error opening project: ' + errorMessage + '\n\nPlease check the browser console (F12 or Cmd+Option+I) for more details.');
            }
                    catch (alertError) {
                console.error('Could not show alert:', alertError);
                // Fallback: try using native alert
                alert('Error opening project: ' + errorMessage);
            }
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
        
        // Clear localStorage (including temp save)
        localStorage.removeItem('storyboard_currentProject');
                    localStorage.removeItem('storyboard_tempSave');
        
        // Clear IndexedDB as well (for large projects)
        if (this.db) {
            try {
                const transaction = this.db.transaction(['projectData'], 'readwrite');
                    const store = transaction.objectStore('projectData');
                    await store.delete('storyboard_currentProject');
                    await store.delete('storyboard_tempSave');
            }
                    catch (e) {
            }
        }
        
        // Clear shotlist and previz cache
        if (this.app.shotListManager) {
            this.app.shotListManager.clear();
        }
                    if (this.app.previsController && this.app.previsController.previsManager) {
            this.app.previsController.previsManager.timeline = [];
                    this.app.previsController.previsManager.currentTime = 0;
                    this.app.previsController.previsManager.isPlaying = false;
                    this.app.previsController.previsManager.totalDuration = 0;
                    this.app.previsController.videoTracks = [{ id: 'video_1', name: 'Video 1', clips: [], trackNumber: 1 }];
                    this.app.previsController.audioTracks = [{ id: 'audio_1', name: 'Audio 1', clips: [] }];
                    this.app.previsController.clipTrackAssignments.clear();
                    if (this.app.previsController.renderTimeline) {
                this.app.previsController.renderTimeline();
            }
        }
        
        // Update UI: clear project name and set status to green
        this.app.updateProjectName();
                    this.app.hasUnsavedChanges = false;
                    this.app.lastChangeTime = null;
                    this.app.updateSaveStatus();
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
            for (let i = 0;
                    i < pages.length;
                    i++) {
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
                
                // Before capturing, replace textareas with divs containing their text
                // This ensures text appears in the PDF
                const textareas = page.querySelectorAll('textarea.frame-text');
                    const textareaReplacements = [];
                    textareas.forEach((textarea) => {
                    const replacement = document.createElement('div');
                    replacement.className = 'frame-text-pdf-replacement';
                    replacement.textContent = textarea.value || '';
                    replacement.style.cssText = window.getComputedStyle(textarea).cssText;
                    replacement.style.position = 'absolute';
                    replacement.style.left = textarea.offsetLeft + 'px';
                    replacement.style.top = textarea.offsetTop + 'px';
                    replacement.style.width = textarea.offsetWidth + 'px';
                    replacement.style.height = textarea.offsetHeight + 'px';
                    replacement.style.overflow = 'hidden';
                    replacement.style.whiteSpace = 'pre-wrap';
                    replacement.style.wordWrap = 'break-word';
                    replacement.style.pointerEvents = 'none';
                    replacement.style.zIndex = '1000';
                    textarea.style.visibility = 'hidden';
                    textarea.parentElement.appendChild(replacement);
                    textareaReplacements.push({ textarea, replacement });
                });
                
                // Use html2canvas to capture the page
                const canvas = await html2canvas(page, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: null,
                    width: page.offsetWidth,
                    height: page.offsetHeight,
                    ignoreElements: (element) => {
                        // Don't ignore textareas anymore - they're hidden and replaced
                        if (element.classList.contains('add-image-button') || 
                            element.classList.contains('empty-slot') ||
                            element.classList.contains('empty-slot-button')) {
                            return true;
                        }
                    return false;
                    }
                });
                
                // Restore textareas after capture
                textareaReplacements.forEach(({ textarea, replacement }) => {
                    textarea.style.visibility = '';
                    replacement.remove();
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
                    // Get directory for picker (project directory or last used)
                    const startDir = await this.getDirectoryForPicker();
                    const pickerOptions = {
                        suggestedName: filename,
                        types: [{
                            description: 'PDF Document',
                            accept: { 'application/pdf': ['.pdf'] }
                        }],
                        // Use 'id' option to help Chrome remember the directory
                        id: 'exportPDF'
                    };
                    
                    // Use directory if available
                    if (startDir) {
                        try {
                            pickerOptions.startIn = startDir;
                        }
                    catch (e) {
                            // If we can't use the directory, just proceed without startIn
                        }
                    }
                    const fileHandle = await window.showSaveFilePicker(pickerOptions);
                    
                    // Store the directory of the saved PDF as last used
                    // Note: getParent() may not be supported in Safari
                    try {
                        if (fileHandle.getParent && typeof fileHandle.getParent === 'function') {
                            const parentDir = await fileHandle.getParent();
                    if (parentDir) {
                                await this.storeLastUsedDirectory(parentDir);
                            }
                        }
                    }
                    catch (e) {
                        // Ignore if we can't get parent directory
                    }
                    const pdfBlob = pdf.output('blob');
                    const writable = await fileHandle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                    return true;
                }
                    catch (error) {
                    if (error.name === 'AbortError') {
                        return false; // User cancelled
                    }
                    throw error;
                }
            }
                    else {
                // Fallback: Download
                pdf.save(filename);
                    return true;
            }
        }
                    catch (error) {
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
     * Create project data for saving
     * Always includes Base64 URLs to ensure cross-browser compatibility
     * Chrome can reload from folders OR use saved URLs
     * Safari must use saved URLs (can't reload from folders)
     */
    createLightweightProject() {
        // Create project data with compressed Base64 URLs
        // Images are compressed before saving to keep project file size manageable
        // Compression settings are stored in project.settings.imageCompression
        
        // CRITICAL: Create a fresh copy of images to ensure we're working with current data
        // This is especially important for Safari, which may cache object references
        const images = this.app.project.images.map((img) => {
            // CRITICAL: Ensure we always save the full filePath
            // filePath should be the full relative path (e.g., "folder/subfolder/image.jpg")
            // NOT just the filename (e.g., "image.jpg")
            let filePath = img.filePath;
            
            // If filePath is missing or just the filename, try to get it from other sources
            if (!filePath || filePath === img.name) {
                // Check if there's a webkitRelativePath stored somewhere
                // This shouldn't happen if paths were set correctly during import, but handle it
                filePath = img.filePath || img.name;
            }
            
            // Validate that we have a filePath - it's critical for loading projects
            if (!filePath) {
                console.warn(`Image ${img.name}
                    missing filePath - using name as fallback`);
                    filePath = img.name;
            }
                    const imageData = {
                name: img.name,
                originalName: img.originalName || img.name,
                filePath: filePath, // ALWAYS save the full path - this is critical!
                sceneNumber: img.sceneNumber || '',
                shotNumber: img.shotNumber || '',
                frameNumber: img.frameNumber || '',
                scene: img.scene || img.sceneNumber || '' // Backward compatibility
            };
            
            // CRITICAL: Include compressed Base64 URL in project file
            // This ensures projects work across browsers and after reload
            // Images are already compressed during import, so this is the compressed version
            if (img.url) {
                imageData.url = img.url;
            }
                    else {
                console.warn(`Image ${img.name}
                    missing URL - may not load correctly`);
            }
            
            // CRITICAL: Include originalUrl if it exists (for restoring original image after rasterization)
            // Check if property exists and has a value (not undefined or null)
            // If property was deleted, it won't haveOwnProperty, so it won't be saved
            if (img.originalUrl !== undefined && img.originalUrl !== null) {
                imageData.originalUrl = img.originalUrl;
            }
            
            // CRITICAL: Include editLayers if they exist (for image editing feature)
            // Check if property exists and has a value (not undefined or null)
            // Empty arrays are valid (means image was edited but layers cleared)
            // If property was deleted, it will be undefined, so it won't be saved
            if (img.editLayers !== undefined && img.editLayers !== null) {
                imageData.editLayers = img.editLayers;
            }
                    return imageData;
        });
                    return {
            images: images,
            settings: this.app.project.settings,
            frameTexts: this.app.project.frameTexts || {},
            pageTexts: this.app.project.pageTexts || {},
            imageScenes: this.app.project.imageScenes || {},
            annotations: this.app.project.annotations || {}, // New annotation system data (Fabric.js JSON)
            drawings: this.app.project.drawings || {}, // Legacy drawing data (for backward compatibility)
            activePanel: this.app.project.activePanel,
            shotList: (() => {const shotList = this.app.shotListManager ? this.app.shotListManager.exportForSave() : [];
                    return shotList;
            })(),
            customFiles: this.app.project.customFiles || [], // Imported image files for previz
            audioFiles: this.app.project.audioFiles || [], // Imported audio files for previz
            previz: (() => {// CRITICAL: Get fresh timeline data at save time, not stale data
                // DO NOT call recalculateTimelinePositions here - it will move external clips!
                if (this.app.previsController && this.app.previsController.previsManager) {
                    const timelineData = this.app.previsController.previsManager.getTimelineData();
                    const externalClipsCount = timelineData?.timeline?.filter(c => c.isExternalFile === true).length || 0;
                    const storyboardClipsCount = timelineData?.timeline?.filter(c => !c.isExternalFile).length || 0;
                    console.log('[SAVE] createLightweightProject - timeline data:', {
                        totalClips: timelineData?.timeline?.length || 0,
                        externalClipsCount: externalClipsCount,
                        storyboardClipsCount: storyboardClipsCount,
                        hasVideoTracks: (timelineData?.videoTracks?.length || 0) > 0,
                        hasAudioTracks: (timelineData?.audioTracks?.length || 0) > 0
                    });
                    return timelineData;
                }
                    console.warn('[SAVE] No previsManager available for save');
                    return null;
            })() // Timeline data - get fresh data at save time
        };
    }
    
    /**
     * Save Base64 URLs to IndexedDB separately (for Safari compatibility)
     * Keyed by project path so we can retrieve them when loading
     */
    async saveImageUrlsToIndexedDB(projectPath) {
        if (!this.db) {
            await this.initDB();
        }
                    if (!this.db) {
            console.warn('IndexedDB not available - cannot save image URLs separately');
                    return;
        }
                    try {
            // Create a map of image URLs keyed by filePath (most reliable identifier)
            const imageUrls = {};
                    this.app.project.images.forEach(img => {
                if (img.url && img.filePath) {
                    // Use filePath as key (more reliable than name, handles duplicates in different folders)
                    imageUrls[img.filePath] = img.url;
                }
                    else if (img.url && img.name) {
                    // Fallback to name if filePath not available
                    imageUrls[img.name] = img.url;
                }
            });
            
            // Store in IndexedDB with project path as key
            const key = `imageUrls_${projectPath || 'default'}`;
                    const transaction = this.db.transaction(['projectData'], 'readwrite');
                    const store = transaction.objectStore('projectData');
                    await store.put({
                id: key,
                data: imageUrls,
                timestamp: Date.now()
            });
        }
                    catch (error) {
            console.error('Error saving image URLs to IndexedDB:', error);
        }
    }
    
    /**
     * Load Base64 URLs from IndexedDB (for Safari compatibility)
     * Returns a map of filePath -> URL
     */
    async loadImageUrlsFromIndexedDB(projectPath) {
        if (!this.db) {
            await this.initDB();
        }
                    if (!this.db) {
            return null;
        }
                    try {
            const key = `imageUrls_${projectPath || 'default'}`;
                    const transaction = this.db.transaction(['projectData'], 'readonly');
                    const store = transaction.objectStore('projectData');
                    const request = store.get(key);
                    return new Promise((resolve) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result && result.data) {
                        resolve(result.data); // Returns { filePath: url, ... }
                    }
                    else {
                        resolve(null);
                    }
                };
                    request.onerror = () => resolve(null);
            });
        }
                    catch (error) {
            console.error('Error loading image URLs from IndexedDB:', error);
                    return null;
        }
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
                    // Update data.project.images with loaded images (these will have URLs)
                    const loadedImages = await this.loadImagesFromDirectory(directoryHandle, data.project.images);
                    data.project.images = loadedImages;
                    return;
                }
                
                // No stored handle, prompt user once
                try {
                    // Get directory for picker (project directory or last used)
                    const startDir = await this.getDirectoryForPicker();
                    const pickerOptions = {
                        mode: 'read',
                        // Use 'id' option to help Chrome remember the directory
                        id: 'imageFolder'
                    };
                    
                    // Use directory if available
                    // Note: startIn may not work on all browsers/OS (especially Mac Safari)
                    if (startDir) {
                        try {
                            pickerOptions.startIn = startDir;
                        }
                    catch (e) {
                        }
                    }
                    else {
                    }
                    this.directoryHandle = await window.showDirectoryPicker(pickerOptions);
                    
                    // Store the handle for future use
                    await this.storeDirectoryHandle(projectPath, this.directoryHandle);
                    
                    // Load images from the directory and update data.project.images (these will have URLs)
                    const loadedImages = await this.loadImagesFromDirectory(this.directoryHandle, data.project.images);
                    data.project.images = loadedImages;
                    return;
                }
                    catch (error) {
                    if (error.name === 'AbortError') {
                        // User cancelled - set flags for later import
                        this.app.imagesNeedReload = true;
                    this.app.pendingImageMetadata = data.project.images;
                    return;
                    }
                    throw error;
                }
            }
                    else {
                // Safari doesn't support File System Access API
                // For Safari, we can't automatically reload images from a folder
                // The images will need to be manually re-imported
                
                // Show a message to the user that they need to re-import images
                // But don't block the project loading - let it continue with empty image URLs
                // The user can use "Import Images" to reload them
                try {
                    await this.app.customAlert(
                        'Note: Images need to be re-imported.\n\n' +
                        'Safari doesn\'t support automatic image loading from folders. ' +
                        'Please use "Import Images" from the File menu to reload your images. ' +
                        'All your settings (scene numbers, shot numbers, frame numbers, and text) will be preserved.'
                    );
                }
                    catch (alertError) {
                }
                
                // Continue without reloading images - the project will load with image metadata
                // but the images themselves will need to be re-imported
                // The image objects will have their metadata but no URL, which is fine
                return;
            }
        }
                    catch (error) {
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
            }
                    else if (handle.kind === 'directory') {
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
                }
                    else {
                    existingImagesMap.set(newImg.name, newImg);
                }
            });
                    this.app.project.images = Array.from(existingImagesMap.values());
        }
                    else {
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
        
        // Create maps for matching: by filePath (for full paths) and by name (for root files)
        const metadataByPath = new Map();
                    imageMetadata.forEach(meta => {
            if (meta.filePath) {
                // Store by filePath for matching - this works for both full paths and filenames
                metadataByPath.set(meta.filePath, meta);
            }
        });
        
        // Recursively get all image files from directory, tracking the path
        async function searchWithPath(handle, path = '', metadataMap, metadataByPath, imageFiles) {
            for await (const [name, entry] of handle.entries()) {
                if (entry.kind === 'file') {
                const fileName = name.toLowerCase();
                    if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                        const fullPath = path ? `${path}/${name}` : name;
                        // Try to match by full path first (from metadataByPath), then by name
                        // metadataByPath contains all filePaths (both full paths and filenames for root files)
                        let metadata = metadataByPath.get(fullPath) || metadataByPath.get(name) || metadataMap.get(name);
                    if (metadata) {
                            imageFiles.push({ handle: entry, name, fullPath, metadata });
                    }
                }
                }
                    else if (entry.kind === 'directory') {
                    const newPath = path ? `${path}/${entry.name}` : entry.name;
                    await searchWithPath(entry, newPath, metadataMap, metadataByPath, imageFiles);
                }
            }
        }
                    await searchWithPath(directoryHandle, '', metadataMap, metadataByPath, imageFiles);
        
        // Sort by filename to match original order
        imageFiles.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        // Load images as base64
        const loadedImages = await Promise.all(
            imageFiles.map(async ({ handle, name, fullPath, metadata }) => {
                const file = await handle.getFile();
                // Use the full path from traversal, or the saved path from metadata, or just the name
                // Prefer the saved path from metadata if it exists and is different from just the name
                const filePath = (metadata.filePath && metadata.filePath !== name) ? metadata.filePath : (fullPath || name);
                    return new Promise(async (resolve, reject) => {
                    try {
                        // Compress image before converting to Base64
                        // This significantly reduces project file size while maintaining quality
                        let compressedUrl;
                        
                        // Get compression settings from project
                        const compSettings = this.app.project.settings.imageCompression || {};
                    const enabled = compSettings.enabled !== false; // Default to true
                        
                        if (enabled && window.ImageCompression && typeof window.ImageCompression.compressImage === 'function') {
                            const format = compSettings.format || 'webp';
                    compressedUrl = await window.ImageCompression.compressImage(file, {
                                maxSizeMB: compSettings.maxSizeMB || 1,
                                maxWidthOrHeight: compSettings.maxWidthOrHeight || 2048,
                                useWebWorker: true,
                                fileType: `image/${format}`,
                                initialQuality: compSettings.quality || 0.85
                            });
                        }
                    else {
                            // Fallback: use FileReader if compression not available or disabled
                            compressedUrl = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = (e) => res(e.target.result);
                    reader.onerror = () => rej(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                            });
                        }
                    resolve({
                            name: name,
                            originalName: metadata.originalName || name,
                            url: compressedUrl,
                            sceneNumber: metadata.sceneNumber || '',
                            shotNumber: metadata.shotNumber || '',
                            frameNumber: metadata.frameNumber || '',
                            scene: metadata.scene || metadata.sceneNumber || '',
                            filePath: filePath // Use the full path
                        });
                    }
                    catch (error) {
                        console.error('Error compressing image:', name, error);
                    reject(error);
                    }
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
            }
                    else if (handle.kind === 'directory') {
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
            }
                    else {
                // Convert old layout format
                const oldLayout = project.settings.layout || 'grid-2';
                    const num = parseInt(oldLayout.split('-')[1]) || 2;
                    project.settings.imagesPerPage = num <= 1 ? 1 : num <= 2 ? 4 : num <= 3 ? 6 : 6;
            }
        }
    }
}

