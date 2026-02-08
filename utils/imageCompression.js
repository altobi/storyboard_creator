/**
 * Image Compression Utility
 * Compresses images before converting to Base64 to reduce project file size
 * Uses browser-image-compression library for high-quality compression
 */

/**
 * Compress an image file
 * @param {File|Blob} file - The image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<string>} Base64 data URL of compressed image
 */
async function compressImage(file, options = {}) {
    // Optimized compression settings for smaller file sizes
    const defaultOptions = {
        maxSizeMB: 0.5, // 0.5MB max file size
        maxWidthOrHeight: 1920, // Reduced from 2048 - smaller dimensions for better compression
        useWebWorker: true, // Use web worker for better performance
        fileType: 'image/webp', // Convert to WebP for better compression (30-50% smaller than JPEG)
        initialQuality: 0.60, // 60% quality as requested
        alwaysKeepResolution: false // Allow downscaling if needed
    };
    
    const compressionOptions = { ...defaultOptions, ...options };
    
    // Check if browser-image-compression is available
    // The library loads as 'imageCompression' globally
    const compressionLib = typeof imageCompression !== 'undefined' ? imageCompression : 
                           (typeof window !== 'undefined' && window.imageCompression) ? window.imageCompression : null;
    
    if (!compressionLib) {
        console.warn('browser-image-compression not loaded, using fallback compression');
        return compressImageFallback(file, compressionOptions);
    }
    
    try {
        // Compress the image
        const compressedFile = await compressionLib(file, compressionOptions);
        
        // Convert to Base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read compressed image'));
            reader.readAsDataURL(compressedFile);
        });
    } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to original if compression fails
        return compressImageFallback(file, compressionOptions);
    }
}

/**
 * Fallback compression using Canvas API (if browser-image-compression is not available)
 * @param {File|Blob} file - The image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<string>} Base64 data URL of compressed image
 */
async function compressImageFallback(file, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let width = img.width;
                let height = img.height;
                const maxDimension = options.maxWidthOrHeight || 2048;
                
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to WebP if supported, otherwise JPEG
                const outputFormat = options.fileType || 'image/webp';
                const quality = options.initialQuality || 0.85;
                
                try {
                    const dataUrl = canvas.toDataURL(outputFormat, quality);
                    resolve(dataUrl);
                } catch (error) {
                    // If WebP not supported, fall back to JPEG
                    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(jpegDataUrl);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Get image file size in MB
 * @param {File|Blob} file - The file to check
 * @returns {number} File size in MB
 */
function getFileSizeMB(file) {
    return file.size / (1024 * 1024);
}

/**
 * Check if image needs compression
 * @param {File|Blob} file - The file to check
 * @param {number} maxSizeMB - Maximum size in MB
 * @param {number} maxDimension - Maximum dimension in pixels
 * @returns {Promise<boolean>} True if compression is needed
 */
async function needsCompression(file, maxSizeMB = 1, maxDimension = 2048) {
    // Check file size
    if (getFileSizeMB(file) > maxSizeMB) {
        return true;
    }
    
    // Check dimensions
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const needsResize = img.width > maxDimension || img.height > maxDimension;
            resolve(needsResize);
        };
        img.onerror = () => resolve(false); // If can't load, assume no compression needed
        img.src = URL.createObjectURL(file);
    });
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compressImage, compressImageFallback, getFileSizeMB, needsCompression };
} else {
    window.ImageCompression = {
        compressImage,
        compressImageFallback,
        getFileSizeMB,
        needsCompression
    };
}

