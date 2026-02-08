/**
 * UI Manager
 * Handles UI rendering, DOM manipulation, and visual updates
 * This is a wrapper around rendering logic that will be gradually refactored
 */

// Constants (will be available from config/constants.js or defined here)
const HANDWRITING_FONTS = ['Kalam', 'Caveat', 'Permanent Marker', 'Shadows Into Light'];

class UIManager {
    constructor(app) {
        this.app = app;
        // Use LayoutService if available, otherwise use app's calculateOptimalLayout
        this.layoutService = typeof LayoutService !== 'undefined' ? new LayoutService() : null;
    }

    /**
     * Render the entire storyboard
     */
    renderStoryboard() {
        const container = document.getElementById('storyboardContainer');
        if (!container) return;

        // Preserve drawings before clearing
        const preservedDrawings = { ...this.app.project.drawings };

        if (this.app.project.images.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; min-height: 400px;">
                    <p style="margin-bottom: 20px;">Create a new project or open an existing one to get started.</p>
                    <p style="margin-bottom: 30px;">Import images from a folder or add a blank image to begin creating your storyboard.</p>
                    <button id="emptyStateAddImageBtn" class="btn btn-primary" style="padding: 12px 24px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <span>Add Image</span>
                    </button>
                </div>
            `;
            
            // Add event listener for the add image button
            const addImageBtn = document.getElementById('emptyStateAddImageBtn');
            if (addImageBtn) {
                addImageBtn.addEventListener('click', () => {
                    const addImageChoiceModal = document.getElementById('addImageChoiceModal');
                    if (addImageChoiceModal) {
                        addImageChoiceModal.style.display = 'block';
                    }
                });
            }
            return;
        }

        container.innerHTML = '';

        // Restore drawings after clearing
        this.app.project.drawings = preservedDrawings;

        // Use manual layout rows and columns
        const rows = this.app.project.settings.layoutRows || 2;
        const cols = this.app.project.settings.layoutCols || 2;
        const imagesPerPage = rows * cols;
        
        // Get page size
        let pageSize;
        if (this.layoutService) {
            pageSize = this.layoutService.getPageSize(this.app.project.settings.pageSize);
        } else {
            pageSize = this.app.pageSizes[this.app.project.settings.pageSize];
        }
        const orientation = this.app.project.settings.orientation;
        const fontFamily = this.app.project.settings.fontFamily;
        // Global page text removed - no longer used
        const pageText = '';
        const pageBgColor = this.app.project.settings.pageBackgroundColor;
        const scale = this.app.project.settings.imageScale / 100;
        const separateScenes = this.app.project.settings.separateScenes;

        // Determine if handwriting font
        const isHandwriting = HANDWRITING_FONTS.some(font => fontFamily.includes(font));

        // Group images by scene if separation is enabled
        let imageGroups = [];
        if (separateScenes) {
            const sceneGroups = {};
            this.app.project.images.forEach(image => {
                const scene = this.app.project.imageScenes[image.name] || 'Unassigned';
                if (!sceneGroups[scene]) {
                    sceneGroups[scene] = [];
                }
                sceneGroups[scene].push(image);
            });
            imageGroups = Object.values(sceneGroups);
        } else {
            imageGroups = [this.app.project.images];
        }

        // Create cover page if enabled
        if (this.app.project.settings.enableCoverPage) {
            const coverPage = this.createCoverPage(orientation, pageSize, fontFamily, pageBgColor);
            container.appendChild(coverPage);
        }

        // Create pages for each group
        let globalPageIndex = this.app.project.settings.enableCoverPage ? 1 : 0;
        imageGroups.forEach((imageGroup) => {
            for (let i = 0; i < imageGroup.length; i += imagesPerPage) {
                const pageImages = imageGroup.slice(i, i + imagesPerPage);
                const pageIndex = Math.floor(i / imagesPerPage);
                const page = this.createPage(
                    pageImages,
                    orientation,
                    pageSize,
                    fontFamily,
                    pageText,
                    rows,
                    cols,
                    scale,
                    isHandwriting,
                    pageBgColor,
                    globalPageIndex++
                );
                container.appendChild(page);
            }
        });

        // Apply frame scale to all frames after rendering
        this.updateFrameScale();
    }

    /**
     * Create a storyboard page
     * @private
     */
    createPage(images, orientation, pageSize, fontFamily, pageText, rows, cols, scale, isHandwriting, pageBgColor, pageIndex) {
        // Delegate to app's createPage method for now (will refactor later)
        // This maintains all existing functionality while we migrate
        return this.app.createPage(images, orientation, pageSize, fontFamily, pageText, rows, cols, scale, isHandwriting, pageBgColor, pageIndex);
    }

    /**
     * Create cover page
     * @private
     */
    createCoverPage(orientation, pageSize, fontFamily, pageBgColor) {
        // Delegate to app's createCoverPage method for now
        return this.app.createCoverPage(orientation, pageSize, fontFamily, pageBgColor);
    }

    /**
     * Update frame scale for all frames
     */
    updateFrameScale() {
        const frames = document.querySelectorAll('.storyboard-frame');
        const scale = this.app.project.settings.imageScale || 100;
        const scaleValue = scale / 100;

        frames.forEach(frame => {
            const img = frame.querySelector('.frame-image');
            if (img) {
                img.style.transform = `scale(${scaleValue})`;
                img.style.transformOrigin = 'center center';
            }
        });
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type ('success' or 'error')
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Update project name display
     * @param {string} projectName - Project name
     */
    updateProjectName(projectName = null) {
        const projectNameEl = document.getElementById('projectName');
        if (!projectNameEl) return;

        if (projectName) {
            projectNameEl.textContent = projectName;
            projectNameEl.classList.add('has-project');
        } else {
            projectNameEl.textContent = 'No project open';
            projectNameEl.classList.remove('has-project');
        }
    }

    /**
     * Update layout info display
     */
    updateLayoutInfo() {
        // Use manual layout rows and columns
        const rows = this.app.project.settings.layoutRows || 2;
        const cols = this.app.project.settings.layoutCols || 2;
        const totalImages = rows * cols;
        const layoutInfo = document.getElementById('layoutInfo');
        
        if (layoutInfo) {
            layoutInfo.textContent = `Total: ${totalImages} image${totalImages !== 1 ? 's' : ''} per page`;
        }
    }

    /**
     * Update scale display
     */
    updateScaleDisplay() {
        const scaleInput = document.getElementById('imageScale');
        if (scaleInput) {
            scaleInput.value = this.app.project.settings.imageScale || 100;
        }
    }

    /**
     * Apply zoom to container
     * @param {number} zoomLevel - Zoom level (0.25 to 3.0)
     */
    applyZoom(zoomLevel) {
        const container = document.getElementById('storyboardContainer');
        if (!container) return;

        container.style.transform = `scale(${zoomLevel})`;
        container.style.transformOrigin = 'top center';
        
        const zoomInput = document.getElementById('zoomLevel');
        if (zoomInput) {
            zoomInput.value = Math.round(zoomLevel * 100);
        }
    }

    /**
     * Calculate zoom to fit
     * @returns {number} Zoom level
     */
    calculateZoomFit() {
        const container = document.getElementById('storyboardContainer');
        if (!container) return 1.0;

        const pages = container.querySelectorAll('.storyboard-page');
        if (pages.length === 0) return 1.0;

        const firstPage = pages[0];
        const pageWidth = firstPage.offsetWidth;
        const containerWidth = container.offsetWidth - 40; // Account for padding

        return containerWidth / pageWidth;
    }
}

// Export for both ES6 modules and regular scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}

