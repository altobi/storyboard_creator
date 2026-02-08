/**
 * FolderExportService
 * Exports previz timeline to a selected folder with images/audio subfolders and XML file
 */
class FolderExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export timeline to a selected folder
     * @param {Object} timelineData - Timeline data from PrevisManager
     * @param {string} projectName - Name of the project
     */
    async exportToFolder(timelineData, projectName = 'Storyboard Timeline') {
        try {
            // Step 1: Let user select a folder using File System Access API
            let dirHandle = null;
            let exportFolderPath = null;

            if ('showDirectoryPicker' in window) {
                try {
                    dirHandle = await window.showDirectoryPicker({
                        mode: 'readwrite',
                        startIn: 'downloads'
                    });
                    // Get folder name (we'll use this for path construction)
                    // Note: File System Access API doesn't give us the full path, so we'll ask the user
                    const folderName = dirHandle.name || 'export';
                    
                    // Step 2: Ask user for the full path to the selected folder
                    exportFolderPath = await this.app.customPrompt(
                        'Enter Full Folder Path',
                        `Please enter the full path to the folder you just selected.\n\nExample:\nWindows: C:\\Media\\Export\nMac/Linux: /Users/username/Desktop/Export\n\nFolder name: ${folderName}`,
                        folderName.includes('\\') ? `C:\\Media\\${folderName}` : `/Users/username/Desktop/${folderName}`
                    );

                    if (!exportFolderPath) {
                        await this.app.customAlert('Export cancelled. Folder path is required.');
                        return;
                    }

                    // Normalize the path (remove trailing slashes, normalize separators)
                    exportFolderPath = exportFolderPath.replace(/\/$/, '').replace(/\\$/, '');
                } catch (err) {
                    if (err.name === 'AbortError') {
                        // User cancelled folder selection
                        return;
                    }
                    throw new Error('Failed to select folder: ' + err.message);
                }
            } else {
                // Fallback: Ask user for folder path directly
                exportFolderPath = await this.app.customPrompt(
                    'Enter Export Folder Path',
                    'Please enter the full path to the folder where you want to export.\n\nExample:\nWindows: C:\\Media\\Export\nMac/Linux: /Users/username/Desktop/Export',
                    'C:\\Media\\Export'
                );

                if (!exportFolderPath) {
                    await this.app.customAlert('Export cancelled. Folder path is required.');
                    return;
                }

                exportFolderPath = exportFolderPath.replace(/\/$/, '').replace(/\\$/, '');
            }

            // Step 3: Create subfolders and export media files
            const imagesPath = `${exportFolderPath}/images`;
            const audioPath = `${exportFolderPath}/audio`;

            // Get timeline clips
            const { timeline } = timelineData;
            const videoClips = timeline.filter(clip => 
                clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile)
            );
            const audioClips = timeline.filter(clip => clip.fileType === 'audio');

            // Track exported files to avoid duplicates
            const exportedFiles = new Map(); // filename -> full path
            let imageIndex = 1;
            let audioIndex = 1;

            // Export images
            if (dirHandle) {
                // Use File System Access API to create folders and write files
                const imagesHandle = await this.getOrCreateFolder(dirHandle, 'images');
                const audioHandle = await this.getOrCreateFolder(dirHandle, 'audio');

                // Export video/image clips - track order and clip index for unique naming
                // Sort clips by track and start time to get proper order
                const sortedVideoClips = [...videoClips].sort((a, b) => {
                    const trackA = a.trackId || 1;
                    const trackB = b.trackId || 1;
                    if (trackA !== trackB) return trackA - trackB;
                    return (a.startTime || 0) - (b.startTime || 0);
                });
                
                for (let i = 0; i < sortedVideoClips.length; i++) {
                    const clip = sortedVideoClips[i];
                    const trackId = clip.trackId || 1;
                    const clipOrder = i + 1; // Order in timeline (1-based)
                    const filename = await this.exportClipToFolder(clip, imagesHandle, imageIndex, exportedFiles, 'image', trackId, clipOrder);
                    if (filename) {
                        imageIndex++;
                        const fullPath = `${imagesPath}/${filename}`;
                        exportedFiles.set(clip.id, { filename, fullPath, type: 'image' });
                    }
                }

                // Export audio clips
                for (const clip of audioClips) {
                    const filename = await this.exportClipToFolder(clip, audioHandle, audioIndex, exportedFiles, 'audio');
                    if (filename) {
                        audioIndex++;
                        const fullPath = `${audioPath}/${filename}`;
                        exportedFiles.set(clip.id, { filename, fullPath, type: 'audio' });
                    }
                }

                // Step 4: Generate XMEML with full paths (DaVinci Resolve native format)
                if (!this.app.xmemlExportService) {
                    if (typeof XMEMLExportService !== 'undefined') {
                        this.app.xmemlExportService = new XMEMLExportService(this.app);
                    } else {
                        throw new Error('XMEML export service not available');
                    }
                }

                // Create filename map for XMEML export
                const clipToFilenameMap = new Map();
                exportedFiles.forEach((fileInfo, clipId) => {
                    clipToFilenameMap.set(clipId, fileInfo.filename);
                });

                // Generate XMEML with full absolute paths
                const xml = this.app.xmemlExportService.exportToXMEML(
                    timelineData, 
                    projectName, 
                    exportFolderPath, // pass full path for absolute path generation
                    clipToFilenameMap // pass filename mapping
                );

                // Step 5: Save XML file to the root of the selected folder (not in images subfolder)
                const xmlFilename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_timeline.xml`;
                const xmlFileHandle = await dirHandle.getFileHandle(xmlFilename, { create: true });
                const xmlWritable = await xmlFileHandle.createWritable();
                await xmlWritable.write(new Blob([xml], { type: 'application/xml' }));
                await xmlWritable.close();

                await this.app.customAlert(`Export completed successfully!\n\nXML file: ${xmlFilename}\nImages: ${imagesPath}\nAudio: ${audioPath}`);
            } else {
                // Fallback: Can't write files without File System Access API
                throw new Error('File System Access API is not supported in this browser. Please use a modern browser like Chrome or Edge.');
            }

        } catch (error) {
            console.error('Error exporting to folder:', error);
            await this.app.customAlert('Failed to export: ' + error.message);
        }
    }

    /**
     * Get or create a folder within a directory handle
     */
    async getOrCreateFolder(parentHandle, folderName) {
        try {
            return await parentHandle.getDirectoryHandle(folderName, { create: true });
        } catch (error) {
            throw new Error(`Failed to create folder "${folderName}": ${error.message}`);
        }
    }

    /**
     * Export a clip to a folder
     */
    async exportClipToFolder(clip, folderHandle, index, exportedFiles, type, trackId = null, clipOrder = null) {
        try {
            // Determine filename
            let filename = null;
            let fileData = null;

            if (type === 'image') {
                // Find image data
                let image = null;
                
                // Priority 1: Check if clip has imageUrl or fileUrl directly (for drawn images or external files)
                if (clip.imageUrl && clip.imageUrl.startsWith('data:image/')) {
                    fileData = clip.imageUrl;
                } else if (clip.fileUrl && clip.fileUrl.startsWith('data:image/')) {
                    fileData = clip.fileUrl;
                } else if (clip.isExternalFile) {
                    // External file - try to find in project images
                    image = this.app.project.images.find(img => 
                        img.name === clip.fileName || 
                        img.originalName === clip.fileName ||
                        (clip.fileName && img.name.includes(clip.fileName.split('.')[0]))
                    );
                } else {
                    // Storyboard clip - try multiple lookup strategies
                    // First try by imageId (name)
                    if (clip.imageId) {
                        image = this.app.project.images.find(img => img.name === clip.imageId);
                    }
                    
                    // If not found and has scene/shot/frame, try that
                    if (!image && clip.sceneNumber && clip.shotNumber && clip.frameNumber) {
                        image = this.app.project.images.find(img => 
                            img.sceneNumber === clip.sceneNumber && 
                            img.shotNumber === clip.shotNumber && 
                            img.frameNumber === clip.frameNumber
                        );
                    }
                    
                    // If still not found, try by imageUrl if it's a data URL
                    if (!image && clip.imageUrl && clip.imageUrl.startsWith('data:image/')) {
                        // For drawn images, use the imageUrl directly
                        fileData = clip.imageUrl;
                    } else if (!image && clip.imageId) {
                        // Last resort: try partial name match
                        image = this.app.project.images.find(img => 
                            img.name && img.name.includes(clip.imageId) ||
                            (clip.imageId && img.name === clip.imageId)
                        );
                    }
                }

                if (image && image.url) {
                    fileData = image.url;
                } else if (!fileData) {
                    console.warn('Image not found for clip:', clip.id, 'imageId:', clip.imageId, 'fileName:', clip.fileName);
                    return null;
                }

                // Get base filename (without extension)
                let baseName = '';
                if (clip.fileName) {
                    baseName = clip.fileName.split('/').pop().split('\\').pop();
                    // Remove extension
                    if (baseName.includes('.')) {
                        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
                    }
                } else if (image && image.originalName) {
                    baseName = image.originalName.split('/').pop().split('\\').pop();
                    if (baseName.includes('.')) {
                        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
                    }
                } else if (image && image.name) {
                    baseName = image.name.split('/').pop().split('\\').pop();
                    if (baseName.includes('.')) {
                        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
                    }
                } else {
                    baseName = `image_${index}`;
                }

                // Create unique filename: baseName_track_order_hash.png
                // Always use PNG format for video clips
                // Add random short hash for uniqueness (no numbers, no 'd' or 'f' to avoid sequence detection)
                const trackNum = trackId || clip.trackId || 1;
                const order = clipOrder || index;
                // Generate hash without numbers and without 'd' or 'f'
                let hash = '';
                const allowedChars = 'abceghijklmnopqrstuvwxyz'; // No numbers, no 'd' or 'f'
                for (let i = 0; i < 8; i++) {
                    hash += allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));
                }
                filename = `${baseName}_T${trackNum}_${order}_${hash}.png`;

                // Convert image to PNG format
                const blob = await this.convertImageToPNG(fileData);
                
                // Write file
                const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                return filename;

            } else if (type === 'audio') {
                // Handle audio files
                if (!clip.fileUrl) {
                    console.warn('Audio clip has no fileUrl:', clip.id);
                    return null;
                }

                filename = clip.fileName || `audio_${index}.mp3`;
                if (filename.includes('/') || filename.includes('\\')) {
                    filename = filename.split('/').pop().split('\\').pop();
                }

                // Check if we've already exported this file
                if (exportedFiles.has(filename)) {
                    const baseName = filename.substring(0, filename.lastIndexOf('.'));
                    const ext = filename.substring(filename.lastIndexOf('.'));
                    filename = `${baseName}_${index}${ext}`;
                }

                // Fetch audio file
                const response = await fetch(clip.fileUrl);
                const blob = await response.blob();
                
                // Write file
                const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                return filename;
            }

            return null;
        } catch (error) {
            console.error(`Error exporting ${type} clip:`, error);
            return null;
        }
    }

    /**
     * Convert image to PNG format
     */
    async convertImageToPNG(imageDataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Create canvas and draw image
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                // Draw white background (for transparent images)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw image
                ctx.drawImage(img, 0, 0);
                
                // Convert to PNG blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to convert image to PNG'));
                    }
                }, 'image/png', 1.0);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            img.src = imageDataURL;
        });
    }

    /**
     * Convert data URL to Blob
     */
    async dataURLToBlob(dataURL) {
        const response = await fetch(dataURL);
        return await response.blob();
    }

    /**
     * Get file extension from data URL
     */
    getExtensionFromDataUrl(dataURL) {
        if (dataURL.startsWith('data:image/')) {
            const match = dataURL.match(/data:image\/([^;]+)/);
            if (match) {
                const mimeType = match[1];
                if (mimeType === 'jpeg') return 'jpg';
                return mimeType;
            }
        }
        return 'jpg'; // default
    }
}
