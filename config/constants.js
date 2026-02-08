/**
 * Application Constants
 * Centralized configuration and constants
 */

export const PAGE_SIZES = {
    'A4': { width: 210, height: 297 }, // mm
    'A3': { width: 297, height: 420 },
    'Letter': { width: 215.9, height: 279.4 },
    'Legal': { width: 215.9, height: 355.6 },
    'Tabloid': { width: 279.4, height: 431.8 }
};

export const DEFAULT_SETTINGS = {
    orientation: 'landscape',
    pageSize: 'A4',
    imagesPerPage: 6,
    imageScale: 100,
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    lineHeight: 1.5,
    textColor: '#000000',
    textAlign: 'left',
    pageText: '',
    pageBackgroundColor: '#404040',
    separateScenes: false,
    showBottomText: true,
    enableCoverPage: false,
    coverPageTitle: '',
    coverPageYear: '',
    coverPageCreators: '',
    coverPageLogo: null,
    enableWatermark: false,
    watermarkType: 'text',
    watermarkText: '',
    watermarkImage: null,
    watermarkOpacity: 30,
    enableDrawing: false
};

export const LAYOUT_CONSTANTS = {
    MM_TO_PX: 3.779527559, // 1mm = 3.779527559px at 96dpi
    PAGE_PADDING_MM: 5,
    HEADER_TEXT_SPACE_MM: 20,
    GAP_PX: 20,
    SHOT_NUMBER_HEIGHT_PX: 35,
    FRAME_TEXT_TOTAL_PX: 81,
    COMPONENT_MARGINS_PX: 25,
    MIN_FRAME_WIDTH_PX: 80,
    HEIGHT_TOLERANCE_PX: 5
};

export const IMAGE_ASPECT_RATIO = 0.5; // Height = 50% of width for landscape images

export const HANDWRITING_FONTS = [
    'Kalam',
    'Caveat',
    'Permanent Marker',
    'Shadows Into Light'
];

