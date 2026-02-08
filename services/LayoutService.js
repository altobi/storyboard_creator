/**
 * Layout Service
 * Handles layout calculations and page sizing
 */

import { PAGE_SIZES, LAYOUT_CONSTANTS, IMAGE_ASPECT_RATIO } from '../config/constants.js';
import { calculateOptimalLayout } from '../utils/math.js';

class LayoutService {
    constructor() {
        this.pageSizes = PAGE_SIZES;
    }

    /**
     * Get page size dimensions
     * @param {string} pageSizeName - Page size name (e.g., 'A4')
     * @returns {Object} Page size object with width and height in mm
     */
    getPageSize(pageSizeName) {
        return this.pageSizes[pageSizeName] || this.pageSizes['A4'];
    }

    /**
     * Calculate optimal layout for images
     * @param {number} imagesPerPage - Number of images per page
     * @param {Object} settings - Project settings
     * @returns {Object} Layout object with rows and cols
     */
    calculateLayout(imagesPerPage, settings) {
        const pageSize = this.getPageSize(settings.pageSize);
        const orientation = settings.orientation;
        
        return calculateOptimalLayout(imagesPerPage, pageSize, orientation, {
            pageText: settings.pageText,
            imageScale: settings.imageScale || 100,
            imageAspectRatio: IMAGE_ASPECT_RATIO
        });
    }

    /**
     * Get maximum images per page based on page size and orientation
     * @param {Object} settings - Project settings
     * @returns {number} Maximum images per page
     */
    getMaxImagesPerPage(settings) {
        const pageSize = this.getPageSize(settings.pageSize);
        const orientation = settings.orientation;
        
        // Calculate based on minimum frame size
        const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
        
        const pageWidthPx = pageWidthMm * LAYOUT_CONSTANTS.MM_TO_PX;
        const pageHeightPx = pageHeightMm * LAYOUT_CONSTANTS.MM_TO_PX;
        
        const availableWidthPx = pageWidthPx - (LAYOUT_CONSTANTS.PAGE_PADDING_MM * LAYOUT_CONSTANTS.MM_TO_PX * 2);
        const availableHeightPx = pageHeightPx - (LAYOUT_CONSTANTS.PAGE_PADDING_MM * LAYOUT_CONSTANTS.MM_TO_PX * 2);
        
        const maxCols = Math.floor((availableWidthPx + LAYOUT_CONSTANTS.GAP_PX) / (LAYOUT_CONSTANTS.MIN_FRAME_WIDTH_PX + LAYOUT_CONSTANTS.GAP_PX));
        const maxRows = Math.floor(availableHeightPx / (LAYOUT_CONSTANTS.MIN_FRAME_WIDTH_PX * 2)); // Rough estimate
        
        return maxCols * maxRows;
    }
}

export default LayoutService;

