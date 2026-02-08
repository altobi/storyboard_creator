/**
 * Zoom utilities - Handles zoom functionality
 * Extracted from app.js for better code organization
 */

/**
 * Zoom functions that can be used by the app
 */
const ZoomUtils = {
    /**
     * Apply zoom to the viewport
     */
    zoom(app, factor) {
        if (!app || !app.storyboardContainer) return;
        
        app.zoomLevel = Math.max(0.25, Math.min(3.0, app.zoomLevel * factor));
        ZoomUtils.applyZoom(app);
    },
    
    /**
     * Fit zoom to content
     */
    zoomFit(app) {
        if (!app || !app.storyboardContainer) return;
        
        const container = app.storyboardContainer;
        const content = container.querySelector('.storyboard-content');
        
        if (!content) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const contentWidth = content.scrollWidth;
        const contentHeight = content.scrollHeight;
        
        const scaleX = containerWidth / contentWidth;
        const scaleY = containerHeight / contentHeight;
        app.zoomLevel = Math.min(scaleX, scaleY) * 0.95; // 95% to add some padding
        
        ZoomUtils.applyZoom(app);
    },
    
    /**
     * Apply current zoom level
     */
    applyZoom(app) {
        if (!app || !app.storyboardContainer) return;
        
        const content = app.storyboardContainer.querySelector('.storyboard-content');
        if (!content) return;
        
        content.style.transform = `scale(${app.zoomLevel})`;
        content.style.transformOrigin = 'top left';
        
        // Update zoom display
        const zoomInput = document.getElementById('zoomLevel');
        if (zoomInput) {
            zoomInput.value = Math.round(app.zoomLevel * 100);
        }
    }
};

// For non-module environments, attach to window
if (typeof window !== 'undefined') {
    window.ZoomUtils = ZoomUtils;
}

