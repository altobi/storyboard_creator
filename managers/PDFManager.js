/**
 * PDF Manager
 * Handles PDF export functionality
 * Extracted from FileManager for better separation of concerns
 */

class PDFManager {
    constructor(app) {
        this.app = app;
        this.isExporting = false; // Flag to prevent double file picker calls
    }

    /**
     * Show export storyboard PDF dialog
     */
    async showExportStoryboardPDFDialog() {
        const modal = document.getElementById('exportStoryboardPDFModal');
        if (!modal) {
            // Fallback to direct export if modal doesn't exist
            return await this.exportPDF();
        }

        // Get default project name (from project name or filename)
        const defaultProjectName = this.app.project.name || 
            (this.app.currentProjectPath ? this.app.currentProjectPath.replace(/\.[^/.]+$/, '') : 'Storyboard');
        
        const projectNameInput = document.getElementById('exportStoryboardProjectName');
        const useCustomBackgroundCheck = document.getElementById('exportStoryboardUseCustomBackground');
        const backgroundColorInput = document.getElementById('exportStoryboardBackgroundColor');
        const useCustomCoverBackgroundCheck = document.getElementById('exportStoryboardUseCustomCoverBackground');
        const coverPageBackgroundColorInput = document.getElementById('exportStoryboardCoverPageBackgroundColor');
        const cancelBtn = document.getElementById('exportStoryboardPDFCancel');
        const exportBtn = document.getElementById('exportStoryboardPDFExport');
        const closeBtn = modal.querySelector('.modal-close');

        if (projectNameInput) projectNameInput.value = defaultProjectName;
        if (backgroundColorInput) backgroundColorInput.value = this.app.project.settings.pageBackgroundColor || '#404040';
        if (coverPageBackgroundColorInput) coverPageBackgroundColorInput.value = this.app.project.settings.pageBackgroundColor || '#404040';

        return new Promise((resolve) => {
            const handleExport = async () => {
                const settings = {
                    projectName: projectNameInput?.value || defaultProjectName,
                    useCustomBackground: useCustomBackgroundCheck?.checked || false,
                    backgroundColor: backgroundColorInput?.value || this.app.project.settings.pageBackgroundColor || '#404040',
                    useCustomCoverBackground: useCustomCoverBackgroundCheck?.checked || false,
                    coverPageBackgroundColor: coverPageBackgroundColorInput?.value || this.app.project.settings.pageBackgroundColor || '#404040'
                };
                modal.style.display = 'none';
                exportBtn.removeEventListener('click', handleExport);
                cancelBtn?.removeEventListener('click', handleCancel);
                closeBtn?.removeEventListener('click', handleCancel);
                
                // Request file handle FIRST (while we have user gesture)
                let fileHandle = null;
                const version = this.app.project.version || '';
                const versionSuffix = version ? `_v${version}` : '';
                const filename = `${settings.projectName.replace(/[^a-z0-9]/gi, '_')}${versionSuffix}.pdf`;
                
                if (this.app.fileManager?.supportsFileSystemAccess) {
                    try {
                        fileHandle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: 'PDF files',
                                accept: { 'application/pdf': ['.pdf'] }
                            }]
                        });
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            console.error('Error requesting file handle:', error);
                            await this.app.customAlert('Error: ' + error.message);
                        }
                        resolve(false);
                        return;
                    }
                }
                
                // Now generate PDF and write to file handle
                const result = await this.exportPDF(settings, fileHandle, filename);
                resolve(result);
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                exportBtn.removeEventListener('click', handleExport);
                cancelBtn?.removeEventListener('click', handleCancel);
                closeBtn?.removeEventListener('click', handleCancel);
                resolve(false);
            };

            exportBtn.addEventListener('click', handleExport);
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (closeBtn) closeBtn.addEventListener('click', handleCancel);

            modal.style.display = 'block';
        });
    }

    /**
     * Export storyboard to PDF
     * @param {Object} settings - Export settings from dialog
     * @param {FileSystemFileHandle} fileHandle - Optional file handle (if already requested)
     * @param {string} filename - Optional filename (if file handle was requested)
     * @returns {Promise<boolean>} Success status
     */
    async exportPDF(settings = {}, fileHandle = null, filename = null) {
        // Prevent double calls
        if (this.isExporting) {
            return false;
        }
        
        if (this.app.project.images.length === 0) {
            await this.app.customAlert('No storyboard to export. Please import images first.');
            return false;
        }

        if (!window.jspdf || !window.html2canvas) {
            await this.app.customAlert('PDF libraries not loaded. Please refresh the page.');
            return false;
        }

        // Use settings from dialog or defaults
        const projectName = settings.projectName || this.app.project.name || 'Storyboard';
        const useCustomBackground = settings.useCustomBackground || false;
        const backgroundColor = settings.backgroundColor || this.app.project.settings.pageBackgroundColor || '#404040';
        const useCustomCoverBackground = settings.useCustomCoverBackground || false;
        const coverPageBackgroundColor = settings.coverPageBackgroundColor || this.app.project.settings.pageBackgroundColor || '#404040';

        this.isExporting = true;
        try {
            const { jsPDF } = window.jspdf;
            const orientation = this.app.project.settings.orientation;
            const pageSize = this.app.app?.pageSizes?.[this.app.project.settings.pageSize] || 
                           this.app.pageSizes?.[this.app.project.settings.pageSize] ||
                           { width: 210, height: 297 }; // Default to A4

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

            // Capture each page as an image and add to PDF
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                if (i > 0) {
                    pdf.addPage();
                }

                // Set page background color (use custom if enabled, otherwise use project setting)
                const isCoverPage = i === 0 && this.app.project.settings.enableCoverPage;
                let bgColor = backgroundColor;
                if (isCoverPage && useCustomCoverBackground) {
                    bgColor = coverPageBackgroundColor;
                } else if (!isCoverPage && useCustomBackground) {
                    bgColor = backgroundColor;
                } else if (!useCustomBackground && !useCustomCoverBackground) {
                    bgColor = this.app.project.settings.pageBackgroundColor || '#404040';
                }
                
                const rgb = this.hexToRgb(bgColor);
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

                // Add image to PDF (fit to page)
                pdf.addImage(imgData, 'PNG', 0, 0, pdfSize[0], pdfSize[1], undefined, 'FAST');
            }

            // Generate filename if not provided
            if (!filename) {
                const version = this.app.project.version || '';
                const versionSuffix = version ? `_v${version}` : '';
                filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}${versionSuffix}.pdf`;
            }

            // Generate PDF blob
            const blob = pdf.output('blob');
            
            // Save PDF using File System Access API if available
            if (fileHandle && this.app.fileManager?.supportsFileSystemAccess) {
                try {
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    this.app.showToast('PDF exported successfully!', 'success');
                    this.isExporting = false;
                    return true;
                } catch (error) {
                    this.isExporting = false;
                    console.error('Error saving PDF:', error);
                    await this.app.customAlert('Error saving PDF: ' + error.message);
                    return false;
                }
            } else if (this.app.fileManager?.supportsFileSystemAccess && !fileHandle) {
                // Fallback: request file handle now (may fail due to user gesture)
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'PDF files',
                            accept: { 'application/pdf': ['.pdf'] }
                        }]
                    });

                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    this.app.showToast('PDF exported successfully!', 'success');
                    this.isExporting = false;
                    return true;
                } catch (error) {
                    this.isExporting = false;
                    if (error.name !== 'AbortError') {
                        console.error('Error saving PDF:', error);
                        await this.app.customAlert('Error saving PDF: ' + error.message);
                    }
                    return false;
                }
            } else {
                // Fallback: download PDF
                pdf.save(filename);
                this.app.showToast('PDF exported successfully!', 'success');
                this.isExporting = false;
                return true;
            }
        } catch (error) {
            this.isExporting = false;
            console.error('Error exporting PDF:', error);
            await this.app.customAlert('Error exporting PDF: ' + error.message);
            return false;
        }
    }

    /**
     * Convert hex color to RGB
     * @param {string} hex - Hex color string
     * @returns {Object|null} RGB object or null
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// Export for both ES6 modules and regular scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFManager;
} else {
    window.PDFManager = PDFManager;
}

