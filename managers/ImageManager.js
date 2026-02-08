/**
 * Image Manager
 * Handles image loading, processing, and metadata management
 */

class ImageManager {
    constructor(app) {
        this.app = app;
        this.removedImages = new Set();
    }

    /**
     * Load images from FileList (file input)
     * @param {FileList} files - FileList from file input
     * @param {Object} options - Options for loading
     * @returns {Promise<Array>} Array of loaded image objects
     */
    async loadImagesFromFiles(files, options = {}) {
        const {
            preserveMetadata = false,
            isReloading = false,
            pendingMetadata = null
        } = options;

        // Filter image files
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/')
        );

        if (imageFiles.length === 0) {
            throw new Error('No image files found');
        }

        // Sort files by name
        imageFiles.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Load images as base64
        const loadedImages = await Promise.all(
            imageFiles
                .filter(file => !this.removedImages.has(file.name))
                .map((file) => this.loadImageFile(file, preserveMetadata))
        );

        // Merge with metadata if reloading
        if (isReloading && pendingMetadata) {
            return this.mergeWithMetadata(loadedImages, pendingMetadata);
        }

        return loadedImages;
    }

    /**
     * Load a single image file
     * @param {File} file - File object
     * @param {boolean} preserveMetadata - Whether to preserve existing metadata
     * @returns {Promise<Object>} Image object with metadata
     */
    async loadImageFile(file, preserveMetadata = false) {
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
                    maxSizeMB: compSettings.maxSizeMB || 0.5, // Reduced from 1MB
                    maxWidthOrHeight: compSettings.maxWidthOrHeight || 1920, // Reduced from 2048
                    useWebWorker: true,
                    fileType: `image/${format}`,
                    initialQuality: compSettings.quality || 0.75 // Reduced from 0.85 for better compression
                });
            } else {
                // Fallback: use FileReader if compression not available or disabled
                compressedUrl = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = (e) => res(e.target.result);
                    reader.onerror = () => rej(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });
            }
            
            // Extract frame number from filename (remove extension)
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            
            // Get existing metadata if preserving
            let existingScene = '';
            let existingShot = '';
            
            if (preserveMetadata && this.app.project) {
                existingScene = this.app.project.imageScenes[file.name] || '';
                const existingImage = this.app.project.images.find(img => img.name === file.name);
                existingShot = existingImage ? (existingImage.shotNumber || '') : '';
            }
            
            // Get the full path - check if file is a wrapper object first
            let filePath = file.name;
            if (file.webkitRelativePath) {
                filePath = file.webkitRelativePath;
            } else if (file.file && file.file.webkitRelativePath) {
                // File is a wrapper, get path from wrapper
                filePath = file.file.webkitRelativePath;
            } else if (file.file && file.webkitRelativePath) {
                // Wrapper has webkitRelativePath property
                filePath = file.webkitRelativePath;
            }
            
            return {
                name: file.name,
                originalName: file.name,
                url: compressedUrl,
                sceneNumber: existingScene,
                shotNumber: existingShot, // Empty for new images, preserved for existing
                frameNumber: fileName, // Auto-populated from filename
                scene: existingScene, // Keep for backward compatibility
                filePath: filePath // Use the full path
            };
        } catch (error) {
            throw new Error(`Failed to load image: ${file.name} - ${error.message}`);
        }
    }

    /**
     * Merge loaded images with pending metadata
     * @param {Array} images - Loaded images
     * @param {Array} metadata - Pending metadata
     * @returns {Array} Images with merged metadata
     */
    mergeWithMetadata(images, metadata) {
        const metadataMap = new Map();
        metadata.forEach(meta => {
            metadataMap.set(meta.name, meta);
        });
        
        return images.map(img => {
            const meta = metadataMap.get(img.name);
            if (meta) {
                // Restore metadata from saved project
                img.sceneNumber = meta.sceneNumber || '';
                img.shotNumber = meta.shotNumber || '';
                img.frameNumber = meta.frameNumber || '';
                img.scene = meta.scene || meta.sceneNumber || '';
            }
            return img;
        });
    }

    /**
     * Merge new images with existing images
     * @param {Array} newImages - Newly loaded images
     * @param {Array} existingImages - Existing images
     * @param {boolean} isFirstImport - Whether this is the first import
     * @returns {Array} Merged image array
     */
    mergeImages(newImages, existingImages, isFirstImport) {
        if (isFirstImport) {
            return newImages;
        }

        const existingImagesMap = new Map();
        existingImages.forEach(img => {
            existingImagesMap.set(img.name, img);
        });

        // Update existing images with new URLs, preserve metadata
        newImages.forEach(newImg => {
            const existing = existingImagesMap.get(newImg.name);
            if (existing) {
                // Preserve existing scene, shot, and frame numbers
                existing.url = newImg.url; // Update URL in case file changed
                existing.filePath = newImg.filePath;
            } else {
                // New image, add to map
                existingImagesMap.set(newImg.name, newImg);
            }
        });

        // Filter out images that were removed from folder
        const newImageNames = new Set(newImages.map(img => img.name));
        const imagesToKeep = Array.from(existingImagesMap.values()).filter(img => {
            // Keep if it's in the new folder OR if it was manually added (no filePath)
            return newImageNames.has(img.name) || !img.filePath;
        });

        // Sort by name
        return imagesToKeep.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    /**
     * Mark an image as removed
     * @param {string} imageName - Image name
     */
    markRemoved(imageName) {
        this.removedImages.add(imageName);
    }

    /**
     * Clear removed images tracking
     */
    clearRemovedImages() {
        this.removedImages.clear();
    }

    /**
     * Get image metadata (scene, shot, frame numbers)
     * @param {string} imageName - Image name
     * @returns {Object} Metadata object
     */
    getImageMetadata(imageName) {
        const image = this.app.project?.images.find(img => img.name === imageName);
        if (!image) return null;

        return {
            sceneNumber: image.sceneNumber || '',
            shotNumber: image.shotNumber || '',
            frameNumber: image.frameNumber || '',
            scene: image.scene || image.sceneNumber || ''
        };
    }

    /**
     * Update image metadata
     * @param {string} imageName - Image name
     * @param {Object} metadata - Metadata to update
     */
    updateImageMetadata(imageName, metadata) {
        const image = this.app.project?.images.find(img => img.name === imageName);
        if (!image) return;

        if (metadata.sceneNumber !== undefined) {
            image.sceneNumber = metadata.sceneNumber;
            image.scene = metadata.sceneNumber; // Keep for backward compatibility
            if (this.app.project) {
                this.app.project.imageScenes[imageName] = metadata.sceneNumber;
            }
        }
        if (metadata.shotNumber !== undefined) {
            image.shotNumber = metadata.shotNumber;
        }
        if (metadata.frameNumber !== undefined) {
            image.frameNumber = metadata.frameNumber;
        }
    }

    /**
     * Validate image object
     * @param {Object} image - Image object
     * @returns {boolean} True if valid
     */
    validateImage(image) {
        return image && 
               image.name && 
               image.url && 
               typeof image.name === 'string' && 
               typeof image.url === 'string';
    }
}

// Export for both ES6 modules and regular scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageManager;
} else {
    window.ImageManager = ImageManager;
}

