/**
 * ImageSettingsController - Handles image settings modal and image operations
 * Extracted from app.js for better code organization
 */
class ImageSettingsController {
    constructor(app) {
        this.app = app;
    }

    /**
     * Open image settings modal
     */
    openImageSettings(image) {
        // CRITICAL: Always use the image from project.images to ensure we have the latest data
        // The image parameter might be a stale reference
        const imageInProject = this.app.project.images.find(img => img.name === image.name);
        const actualImage = imageInProject || image;
        
        this.app.currentEditingImage = actualImage;
        this.app.currentEditingImageIndex = this.app.project.images.findIndex(img => img.name === actualImage.name);
        const modal = document.getElementById('imageSettingsModal');
        document.getElementById('imageSettingsScene').value = this.app.project.imageScenes[actualImage.name] || actualImage.sceneNumber || '';
        document.getElementById('imageSettingsShot').value = actualImage.shotNumber || '';
        // Don't use filename as fallback - respect empty frameNumber
        document.getElementById('imageSettingsFrame').value = actualImage.frameNumber || '';
        // Show file path
        const filePathInput = document.getElementById('imageSettingsFilePath');
        if (filePathInput) {
            filePathInput.value = actualImage.filePath || actualImage.name || 'Unknown';
        }
        // Reset replace file input
        const replaceFileInput = document.getElementById('imageSettingsReplaceFile');
        if (replaceFileInput) {
            replaceFileInput.value = '';
        }
        // Show/hide Reset Edits button based on whether edits exist or originalUrl exists
        // originalUrl exists means the image was rasterized (edited), so we can restore it
        const resetEditsBtn = document.getElementById('imageSettingsResetEdits');
        if (resetEditsBtn) {
            const hasEditLayers = actualImage.editLayers && Array.isArray(actualImage.editLayers) && actualImage.editLayers.length > 0;
            const hasOriginalUrl = actualImage.originalUrl && actualImage.originalUrl !== actualImage.url;
            if (hasEditLayers || hasOriginalUrl) {
                resetEditsBtn.style.display = 'block';
            } else {
                resetEditsBtn.style.display = 'none';
            }
        }
        
        // Update preview image
        const previewImg = document.getElementById('imageSettingsPreviewImg');
        if (previewImg) {
            // Use actualImage (already retrieved above) to ensure we have latest data
            
            // Check if image has edit layers - if so, use composite
            // BUT: If editLayers is empty array, it means the image was rasterized and url contains the edited version
            if (actualImage.editLayers && Array.isArray(actualImage.editLayers) && actualImage.editLayers.length > 0) {
                // Use cached composite if available
                if (actualImage.compositeUrl) {
                    previewImg.src = actualImage.compositeUrl;
                } else {
                    // Create composite for preview
                    if (this.app.renderService && this.app.renderService.createImageComposite) {
                        previewImg.setAttribute('data-composite-loading', 'true');
                        previewImg.src = '';
                        this.app.renderService.createImageComposite(actualImage, previewImg);
                    } else {
                        previewImg.src = actualImage.url || '';
                    }
                }
            } else {
                // No edit layers - use the image URL directly (which may be a rasterized version)
                // If editLayers is undefined/null, it means the image was rasterized and url contains the edited version
                previewImg.src = actualImage.url || '';
            }
        }
        
        // Set up event listeners for Edit Image and Reset Edits buttons
        const editImageBtn = document.getElementById('imageSettingsEdit');
        if (editImageBtn) {
            editImageBtn.onclick = () => this.editImage();
        }
        if (resetEditsBtn) {
            resetEditsBtn.onclick = () => this.resetImageEdits();
        }
        
        modal.style.display = 'block';
    }
    
    /**
     * Edit image in drawing canvas
     */
    editImage() {
        if (!this.app.currentEditingImage) {
            console.warn('No image selected for editing');
            return;
        }
        
        // CRITICAL: Always use the image from project.images to ensure we have the latest data
        const image = this.app.currentEditingImage;
        const imageInProject = this.app.project.images.find(img => img.name === image.name);
        const actualImage = imageInProject || image;
        
        if (!actualImage.url) {
            console.error('Image has no URL:', actualImage);
            return;
        }
        
        // Close image settings modal
        const imageSettingsModal = document.getElementById('imageSettingsModal');
        if (imageSettingsModal) {
            imageSettingsModal.style.display = 'none';
        }
        
        // Open drawing canvas with image as background
        if (!this.app.openDrawingCanvas) {
            console.error('openDrawingCanvas method not available');
            return;
        }
        
        // Get image dimensions
        const img = new Image();
        img.onload = () => {
            this.app.openDrawingCanvas({
                imageUrl: actualImage.url,
                imageWidth: img.width,
                imageHeight: img.height,
                editLayers: actualImage.editLayers || [],
                editingImage: actualImage
            });
        };
        img.onerror = () => {
            console.error('Failed to load image for editing:', actualImage.url);
            if (this.app.customAlert) {
                this.app.customAlert('Failed to load image for editing. Please check the image URL.');
            }
        };
        img.src = actualImage.url;
    }
    
    /**
     * Reset image edits (remove edit layers)
     */
    async resetImageEdits() {
        if (!this.app.currentEditingImage) return;
        
        const confirmed = await this.app.customConfirm('Reset all edits for this image? This will remove all drawing layers and restore the original image.');
        if (confirmed) {
            // CRITICAL: Always use the image from project.images to ensure we update the correct reference
            const image = this.app.currentEditingImage;
            const imageIndex = this.app.project.images.findIndex(img => img.name === image.name);
            
            if (imageIndex === -1) {
                console.error('Image not found in project.images:', image.name);
                return;
            }
            
            const imageInProject = this.app.project.images[imageIndex];
            
            // Store the old rasterized URL before replacing it (for cleanup)
            const oldRasterizedUrl = imageInProject.originalUrl ? imageInProject.url : null;
            
            // Restore original URL if it exists (for rasterized images)
            if (imageInProject.originalUrl) {
                // Store original URL before replacing
                const originalUrlValue = imageInProject.originalUrl;
                
                // Replace the rasterized URL with the original
                imageInProject.url = originalUrlValue;
                
                // Explicitly remove originalUrl property (Safari compatibility)
                imageInProject.originalUrl = undefined;
                delete imageInProject.originalUrl;
                
                // Also update the currentEditingImage reference
                image.url = originalUrlValue;
                image.originalUrl = undefined;
                delete image.originalUrl;
            }
            
            // Remove edit layers and cached composite from the image object
            // Explicitly set to undefined first, then delete (Safari compatibility)
            imageInProject.editLayers = undefined;
            delete imageInProject.editLayers;
            
            imageInProject.compositeUrl = undefined;
            delete imageInProject.compositeUrl;
            
            // Also update the currentEditingImage reference
            image.editLayers = undefined;
            delete image.editLayers;
            
            image.compositeUrl = undefined;
            delete image.compositeUrl;
            
            // Hide reset button
            const resetEditsBtn = document.getElementById('imageSettingsResetEdits');
            if (resetEditsBtn) {
                resetEditsBtn.style.display = 'none';
            }
            
            // Update preview image immediately
            const previewImg = document.getElementById('imageSettingsPreviewImg');
            if (previewImg) {
                previewImg.src = imageInProject.url || '';
            }
            
            // Mark project as changed
            this.app.markChanged();
            
            // Save to storage immediately to persist the reset
            // Use a small delay to ensure all property deletions are processed (Safari compatibility)
            if (this.app.storageService) {
                // Force a microtask to ensure property deletions are complete
                await new Promise(resolve => setTimeout(resolve, 0));
                await this.app.storageService.saveToStorage(false);
                
                // Verify the save worked by checking if originalUrl is still deleted
                const verifyImage = this.app.project.images.find(img => img.name === image.name);
                if (verifyImage && verifyImage.originalUrl !== undefined) {
                    // Still exists - try deleting again and saving
                    verifyImage.originalUrl = undefined;
                    delete verifyImage.originalUrl;
                    await this.app.storageService.saveToStorage(false);
                }
            }
            
            // Re-render storyboard to show the restored original image
            if (this.app.renderStoryboard) {
                this.app.renderStoryboard();
            }
            
            // The old rasterized URL (oldRasterizedUrl) is now unreferenced and will be garbage collected
            // No need to explicitly delete it - JavaScript's garbage collector will handle it
        }
    }
    
    /**
     * Save image settings
     */
    async saveImageSettings() {
        if (!this.app.currentEditingImage) return;
        
        const newScene = document.getElementById('imageSettingsScene').value.trim();
        const newShot = document.getElementById('imageSettingsShot').value.trim();
        const newFrame = document.getElementById('imageSettingsFrame').value.trim();
        const replaceFileInput = document.getElementById('imageSettingsReplaceFile');
        
        // Handle image replacement if a new file is selected
        if (replaceFileInput && replaceFileInput.files && replaceFileInput.files.length > 0) {
            const newFile = replaceFileInput.files[0];
            try {
                // Load the new image
                const newImageData = await this.loadSingleImageFile(newFile);
                if (newImageData) {
                    // Preserve the original image's metadata
                    const oldImage = { ...this.app.currentEditingImage };
                    
                    // Update the image with new data
                    Object.assign(this.app.currentEditingImage, newImageData);
                    
                    // Preserve scene/shot/frame numbers if they exist
                    if (oldImage.sceneNumber) {
                        this.app.currentEditingImage.sceneNumber = oldImage.sceneNumber;
                    }
                    if (oldImage.shotNumber) {
                        this.app.currentEditingImage.shotNumber = oldImage.shotNumber;
                    }
                    if (oldImage.frameNumber) {
                        this.app.currentEditingImage.frameNumber = oldImage.frameNumber;
                    }
                    
                    // Preserve frame text
                    if (this.app.project.frameTexts[oldImage.name]) {
                        this.app.project.frameTexts[this.app.currentEditingImage.name] = this.app.project.frameTexts[oldImage.name];
                        delete this.app.project.frameTexts[oldImage.name];
                    }
                    
                    // Update image scenes mapping
                    if (this.app.project.imageScenes[oldImage.name]) {
                        this.app.project.imageScenes[this.app.currentEditingImage.name] = this.app.project.imageScenes[oldImage.name];
                        delete this.app.project.imageScenes[oldImage.name];
                    }
                    
                    // Update the image in the array
                    const imageIndex = this.app.project.images.findIndex(img => img.name === oldImage.name);
                    if (imageIndex !== -1) {
                        this.app.project.images[imageIndex] = this.app.currentEditingImage;
                    }
                }
            } catch (error) {
                console.error('Error replacing image:', error);
                await this.app.customAlert('Error replacing image: ' + error.message);
                return;
            }
        }
        
        // Update scene number
        if (newScene) {
            this.app.project.imageScenes[this.app.currentEditingImage.name] = newScene;
            this.app.currentEditingImage.sceneNumber = newScene;
        } else {
            delete this.app.project.imageScenes[this.app.currentEditingImage.name];
            this.app.currentEditingImage.sceneNumber = '';
        }
        
        // Update shot number
        this.app.currentEditingImage.shotNumber = newShot;
        
        // Update frame number
        this.app.currentEditingImage.frameNumber = newFrame;
        
        // Re-sort images after updating scene/shot/frame numbers
        if (this.app.sortImagesByStructure) {
            this.app.sortImagesByStructure();
        }
        
        // Update the current editing image index since the image may have moved
        if (this.app.currentEditingImage) {
            this.app.currentEditingImageIndex = this.app.project.images.findIndex(img => img.name === this.app.currentEditingImage.name);
        }
        
        this.app.markChanged();
        document.getElementById('imageSettingsModal').style.display = 'none';
        if (this.app.renderStoryboard) {
            this.app.renderStoryboard();
        }
    }
    
    /**
     * Remove image from project
     */
    async removeImage() {
        if (!this.app.currentEditingImage) return;
        
        const confirmed = await this.app.customConfirm(`Remove image "${this.app.currentEditingImage.name}" from the project?`);
        if (confirmed) {
            // Remove from images array
            this.app.project.images = this.app.project.images.filter(img => img.name !== this.app.currentEditingImage.name);
            
            // Remove associated data
            delete this.app.project.frameTexts[this.app.currentEditingImage.name];
            delete this.app.project.imageScenes[this.app.currentEditingImage.name];
            
            this.app.currentEditingImage = null;
            this.app.currentEditingImageIndex = -1;
            
            this.app.markChanged();
            document.getElementById('imageSettingsModal').style.display = 'none';
            if (this.app.renderStoryboard) {
                this.app.renderStoryboard();
            }
            
            // Sync previz timeline when storyboard frame is deleted
            if (this.app.previsController && this.app.previsController.previsManager) {
                // Rebuild timeline from storyboard (this will remove the deleted frame)
                this.app.previsController.previsManager.buildTimelineFromStoryboard();
                // Re-render timeline if previz is active
                if (this.app.previsController) {
                    this.app.previsController.renderTimeline();
                }
            }
        }
    }
    
    /**
     * Load a single image file and return image data
     */
    async loadSingleImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    name: file.name,
                    originalName: file.name,
                    filePath: file.name,
                    url: e.target.result,
                    sceneNumber: '',
                    shotNumber: '',
                    frameNumber: ''
                };
                resolve(imageData);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageSettingsController;
}

