/**
 * Math Utilities
 * Pure functions for mathematical calculations
 */

import { LAYOUT_CONSTANTS } from '../config/constants.js';

/**
 * Convert millimeters to pixels
 * @param {number} mm - Value in millimeters
 * @returns {number} Value in pixels
 */
export function mmToPixels(mm) {
    return mm * LAYOUT_CONSTANTS.MM_TO_PX;
}

/**
 * Convert pixels to millimeters
 * @param {number} px - Value in pixels
 * @returns {number} Value in millimeters
 */
export function pixelsToMM(px) {
    return px / LAYOUT_CONSTANTS.MM_TO_PX;
}

/**
 * Calculate optimal layout for images per page
 * @param {number} imagesPerPage - Number of images to display per page
 * @param {Object} pageSize - Page size object with width and height in mm
 * @param {string} orientation - 'portrait' or 'landscape'
 * @param {Object} options - Additional options
 * @returns {Object} Layout object with rows, cols, and metadata
 */
export function calculateOptimalLayout(imagesPerPage, pageSize, orientation, options = {}) {
    const {
        pageText = '',
        imageScale = 100,
        pagePaddingMM = LAYOUT_CONSTANTS.PAGE_PADDING_MM,
        headerTextSpaceMM = LAYOUT_CONSTANTS.HEADER_TEXT_SPACE_MM,
        gapPx = LAYOUT_CONSTANTS.GAP_PX,
        shotNumberHeightPx = LAYOUT_CONSTANTS.SHOT_NUMBER_HEIGHT_PX,
        frameTextTotalPx = LAYOUT_CONSTANTS.FRAME_TEXT_TOTAL_PX,
        componentMarginsPx = LAYOUT_CONSTANTS.COMPONENT_MARGINS_PX,
        minFrameWidthPx = LAYOUT_CONSTANTS.MIN_FRAME_WIDTH_PX,
        heightTolerancePx = LAYOUT_CONSTANTS.HEIGHT_TOLERANCE_PX,
        imageAspectRatio = 0.5
    } = options;

    // Get page dimensions in mm
    const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
    const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;

    // Convert mm to pixels
    const pageWidthPx = mmToPixels(pageWidthMm);
    const pageHeightPx = mmToPixels(pageHeightMm);

    // Page padding in pixels
    const pagePaddingPx = mmToPixels(pagePaddingMM);

    // Header text space in pixels
    const headerTextSpacePx = pageText ? mmToPixels(headerTextSpaceMM) : 0;

    // Available space for grid
    const availableWidthPx = pageWidthPx - (pagePaddingPx * 2);
    const availableHeightPx = pageHeightPx - (pagePaddingPx * 2) - headerTextSpacePx;

    // Image scale factor
    const scale = imageScale / 100;

    // Calculate maximum possible columns
    const maxCols = Math.floor((availableWidthPx + gapPx) / (minFrameWidthPx + gapPx));

    // Store all valid layouts
    const validLayouts = [];

    // Test all possible row/column combinations
    for (let rows = 1; rows <= imagesPerPage; rows++) {
        const cols = Math.ceil(imagesPerPage / rows);

        // Skip if too many columns
        if (cols > maxCols) continue;

        // Must have enough slots for all images
        if (rows * cols < imagesPerPage) continue;

        // Calculate actual frame width in pixels
        const frameWidthPx = (availableWidthPx - (cols - 1) * gapPx) / cols;

        // Skip if frame is too narrow
        if (frameWidthPx < minFrameWidthPx) continue;

        // Calculate image height based on frame width
        const imageHeightPx = frameWidthPx * imageAspectRatio * scale;

        // Calculate total frame height
        const frameHeightPx = shotNumberHeightPx + imageHeightPx + frameTextTotalPx + componentMarginsPx;

        // Calculate total height needed for all rows
        const totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;

        // Skip if it doesn't fit vertically
        if (totalHeightNeededPx > availableHeightPx - heightTolerancePx) continue;

        // This is a valid layout - store it with metadata
        const unusedSlots = (rows * cols) - imagesPerPage;
        const spaceUtilization = totalHeightNeededPx / availableHeightPx;

        validLayouts.push({
            rows,
            cols,
            frameWidthPx,
            frameHeightPx,
            totalHeightNeededPx,
            unusedSlots,
            spaceUtilization,
            aspectRatio: rows / cols
        });
    }

    // If no valid layouts found, return a safe fallback
    if (validLayouts.length === 0) {
        const fallbackCols = Math.min(imagesPerPage, maxCols);
        const fallbackRows = Math.ceil(imagesPerPage / fallbackCols);
        return { rows: fallbackRows, cols: fallbackCols };
    }

    // Sort layouts by preference:
    // 1. Minimize unused slots
    // 2. Maximize space utilization
    // 3. Prefer layouts closer to square (aspect ratio closer to 1)
    validLayouts.sort((a, b) => {
        if (a.unusedSlots !== b.unusedSlots) {
            return a.unusedSlots - b.unusedSlots;
        }
        if (Math.abs(a.spaceUtilization - 0.9) !== Math.abs(b.spaceUtilization - 0.9)) {
            return Math.abs(a.spaceUtilization - 0.9) - Math.abs(b.spaceUtilization - 0.9);
        }
        return Math.abs(a.aspectRatio - 1) - Math.abs(b.aspectRatio - 1);
    });

    // Return the best layout
    return validLayouts[0];
}

