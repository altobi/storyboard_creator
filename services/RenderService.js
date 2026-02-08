/**
 * RenderService - Handles all rendering logic for storyboard pages and frames
 * Extracted from app.js for better code organization
 */
class RenderService {
    constructor(app) {
        this.app = app;
    }
    
    /**
     * Create composite image from original image and edit layers
     */
    createImageComposite(image, imgElement) {
        console.log('[COMPOSITE] Creating composite for:', image.name, 'with', image.editLayers?.length || 0, 'layers');
        
        // Load original image first
        const originalImg = new Image();
        originalImg.crossOrigin = 'anonymous';
        originalImg.onload = () => {
            // Create a temporary Konva stage to render edit layers at original image size
            const tempStage = new Konva.Stage({
                container: document.createElement('div'),
                width: originalImg.width,
                height: originalImg.height
            });
            
            // Add background layer with original image
            const bgLayer = new Konva.Layer();
            const bgImage = new Konva.Image({
                x: 0,
                y: 0,
                image: originalImg,
                width: originalImg.width,
                height: originalImg.height
            });
            bgLayer.add(bgImage);
            tempStage.add(bgLayer);
            
            // Restore and render edit layers
            if (image.editLayers && Array.isArray(image.editLayers) && image.editLayers.length > 0) {
                let shapesRestored = 0;
                image.editLayers.forEach((layerState, layerIndex) => {
                    if (!layerState || !layerState.shapes || !Array.isArray(layerState.shapes) || layerState.shapes.length === 0) {
                        return;
                    }
                    
                    const editLayer = new Konva.Layer({
                        opacity: (layerState.opacity || 100) / 100
                    });
                    
                    // Apply blending mode to layer if not normal
                    if (layerState.blendingMode && layerState.blendingMode !== 'normal') {
                        const modeMap = {
                            'multiply': 'multiply',
                            'screen': 'screen',
                            'overlay': 'overlay',
                            'darken': 'darken',
                            'lighten': 'lighten',
                            'color-dodge': 'color-dodge',
                            'color-burn': 'color-burn',
                            'hard-light': 'hard-light',
                            'soft-light': 'soft-light',
                            'difference': 'difference',
                            'exclusion': 'exclusion'
                        };
                        editLayer.globalCompositeOperation(modeMap[layerState.blendingMode] || 'source-over');
                    }
                    
                    // Restore shapes
                    // IMPORTANT: Shapes are stored in image coordinates (original image size)
                    // The tempStage is at original image size, so shapes should be positioned directly
                    layerState.shapes.forEach((shapeData, shapeIndex) => {
                        try {
                            if (!shapeData || !shapeData.className) {
                                console.warn('[COMPOSITE] Invalid shape data:', shapeIndex, shapeData);
                                return;
                            }
                            
                            // Log shape position for debugging
                            if (shapeIndex === 0) {
                                console.log('[COMPOSITE] First shape data:', {
                                    className: shapeData.className,
                                    x: shapeData.x,
                                    y: shapeData.y,
                                    width: shapeData.width,
                                    height: shapeData.height,
                                    points: shapeData.points ? shapeData.points.length + ' points' : 'none'
                                });
                            }
                            
                            const shape = Konva.Node.create(shapeData);
                            if (shape) {
                                editLayer.add(shape);
                                shapesRestored++;
                                
                                // Log actual position after creation
                                if (shapeIndex === 0) {
                                    console.log('[COMPOSITE] First shape created at:', {
                                        x: shape.x(),
                                        y: shape.y(),
                                        width: shape.width ? shape.width() : 'N/A',
                                        height: shape.height ? shape.height() : 'N/A'
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn('[COMPOSITE] Error restoring shape', shapeIndex, ':', error, shapeData);
                        }
                    });
                    
                    tempStage.add(editLayer);
                });
                console.log('[COMPOSITE] Restored', shapesRestored, 'shapes');
            }
            
            // Render all layers to get composite
            tempStage.draw();
            const compositeDataURL = tempStage.toDataURL({ mimeType: 'image/png', quality: 1 });
            
            // Cache the composite URL on the image object
            image.compositeUrl = compositeDataURL;
            
            // CRITICAL: Also update the image in project.images array
            if (this.app && this.app.project && this.app.project.images) {
                const imageInProject = this.app.project.images.find(img => img.name === image.name);
                if (imageInProject) {
                    imageInProject.compositeUrl = compositeDataURL;
                }
            }
            
            // Set image source - IMPORTANT: Clear old src and handlers first
            // Remove any existing handlers to prevent conflicts
            const oldOnError = imgElement.onerror;
            const oldOnLoad = imgElement.onload;
            imgElement.onerror = null;
            imgElement.onload = null;
            
            // Set up load handler BEFORE setting src
            imgElement.onload = () => {
                console.log('[COMPOSITE] ✓ Composite loaded:', imgElement.naturalWidth, 'x', imgElement.naturalHeight);
                imgElement.removeAttribute('data-composite-loading');
                // Clean up handler
                imgElement.onload = null;
            };
            
            // Set up error handler BEFORE setting src (only fires if image fails to load)
            imgElement.onerror = (e) => {
                console.error('[COMPOSITE] ✗ Failed to load composite, falling back to original');
                imgElement.removeAttribute('data-composite-loading');
                // Fallback to original image
                if (image && image.url) {
                    imgElement.src = image.url;
                }
                // Clean up handler
                imgElement.onerror = null;
            };
            
            // Clear src first to force browser to recognize new image
            const currentSrc = imgElement.src;
            imgElement.src = '';
            
            // Set the composite after a tiny delay to ensure handlers are attached
            setTimeout(() => {
                imgElement.src = compositeDataURL;
                console.log('[COMPOSITE] Set src to composite data URL');
                
                // Verify it was set correctly
                if (imgElement.src !== compositeDataURL) {
                    console.warn('[COMPOSITE] WARNING: src was not set correctly!');
                    imgElement.src = compositeDataURL;
                }
            }, 0);
            
            // Clean up
            tempStage.destroy();
        };
        originalImg.onerror = () => {
            console.error('[COMPOSITE] Failed to load original image:', image.url);
            if (image && image.url) {
                imgElement.src = image.url;
            }
        };
        originalImg.src = image.url;
    }

    /**
     * Render the entire storyboard
     */
    renderStoryboard() {
        // Initialize shot list from storyboard if images exist and shot list is empty
        if (this.app.shotListManager && this.app.project.images.length > 0) {
            const shots = this.app.shotListManager.getAllShots();
            if (shots.length === 0) {
                this.app.shotListManager.initializeFromStoryboard();
            } else {
                // Sync with storyboard to update frame counts
                this.app.shotListManager.syncWithStoryboard();
            }
        }
        
        // Use UIManager if available
        if (this.app.uiManager) {
            this.app.uiManager.renderStoryboard();
            return;
        }
        
        // Fallback to old implementation
        const container = document.getElementById('storyboardContainer');
        
        // Preserve drawings before clearing
        const preservedDrawings = { ...this.app.project.drawings };
        
        if (this.app.project.images.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Create a new project or open an existing one to get started.</p>
                    <p>Import images from a folder to begin creating your storyboard.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        // Restore drawings after clearing
        this.app.project.drawings = preservedDrawings;
        
        // Use manual layout rows and columns
        const rows = this.app.project.settings.layoutRows || 2;
        const cols = this.app.project.settings.layoutCols || 2;
        const imagesPerPage = rows * cols;
        const orientation = this.app.project.settings.orientation;
        const pageSize = this.app.pageSizes[this.app.project.settings.pageSize];
        const fontFamily = this.app.project.settings.fontFamily;
        // Global page text removed - passing empty string for backward compatibility
        const pageText = '';
        const pageBgColor = this.app.project.settings.pageBackgroundColor;
        const scale = this.app.project.settings.imageScale / 100;
        const separateScenes = this.app.project.settings.separateScenes;
        
        // Determine if handwriting font
        const isHandwriting = fontFamily.includes('Kalam') || 
                             fontFamily.includes('Caveat') || 
                             fontFamily.includes('Permanent Marker') || 
                             fontFamily.includes('Shadows Into Light');
        
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
        
        // Cover page numbering - always include cover page in numbering (setting removed)
        const includeCoverPageInNumbering = true;
        const hasCoverPage = this.app.project.settings.enableCoverPage;
        
        // Create cover page if enabled
        if (hasCoverPage) {
            const coverPage = this.createCoverPage(orientation, pageSize, fontFamily, pageBgColor);
            // Add page number to cover page if enabled and included in numbering
            if (this.app.project.settings.enablePageNumbers && includeCoverPageInNumbering) {
                const pageNumber = document.createElement('div');
                pageNumber.className = 'page-number';
                pageNumber.textContent = '1'; // Cover page is always page 1 if included
                pageNumber.style.position = 'absolute';
                pageNumber.style.fontSize = (this.app.project.settings.pageNumberFontSize || 12) + 'px';
                const pageBgColor = this.app.project.settings.pageBackgroundColor || '#404040';
                const isDarkBg = this.app.isColorDark ? this.app.isColorDark(pageBgColor) : false;
                const defaultColor = isDarkBg ? '#ffffff' : '#000000';
                pageNumber.style.color = this.app.project.settings.pageNumberColor || defaultColor;
                pageNumber.style.fontWeight = 'bold';
                pageNumber.style.zIndex = '100';
                pageNumber.style.pointerEvents = 'none';
                
                const position = this.app.project.settings.pageNumberPosition || 'bottom-center';
                switch (position) {
                    case 'top-left':
                        pageNumber.style.top = '10px';
                        pageNumber.style.left = '10px';
                        break;
                    case 'top-center':
                        pageNumber.style.top = '10px';
                        pageNumber.style.left = '50%';
                        pageNumber.style.transform = 'translateX(-50%)';
                        break;
                    case 'top-right':
                        pageNumber.style.top = '10px';
                        pageNumber.style.right = '10px';
                        break;
                    case 'bottom-left':
                        pageNumber.style.bottom = '10px';
                        pageNumber.style.left = '10px';
                        break;
                    case 'bottom-center':
                        pageNumber.style.bottom = '10px';
                        pageNumber.style.left = '50%';
                        pageNumber.style.transform = 'translateX(-50%)';
                        break;
                    case 'bottom-right':
                        pageNumber.style.bottom = '10px';
                        pageNumber.style.right = '10px';
                        break;
                }
                coverPage.appendChild(pageNumber);
            }
            container.appendChild(coverPage);
        }
        
        // Create pages for each group
        // Determine starting page index based on cover page inclusion setting
        // If cover page is included and numbered, first storyboard page starts at 2
        // Otherwise, first storyboard page starts at 1
        let globalPageIndex = 0;
        // Only adjust page index if page numbers are enabled
        if (this.app.project.settings.enablePageNumbers) {
            // Explicitly check: if cover page exists AND is included in numbering, start at 2
            // Otherwise (cover page doesn't exist OR is NOT included), start at 1
            const coverPageIsNumbered = hasCoverPage && includeCoverPageInNumbering;
            if (coverPageIsNumbered) {
                globalPageIndex = 1; // First storyboard page will be page 2 (cover page is page 1)
            } else {
                globalPageIndex = 0; // First storyboard page will be page 1 (cover page not numbered or doesn't exist)
            }
        } else {
            globalPageIndex = 0; // Page numbers disabled, index doesn't matter but set to 0 for consistency
        }
        
        imageGroups.forEach((imageGroup, groupIndex) => {
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
                    globalPageIndex
                );
                container.appendChild(page);
                globalPageIndex++; // Increment after creating page
            }
        });
        
        // Apply frame scale and image scale to all frames after rendering
        // Use setTimeout to ensure layout is complete and images are loaded before measuring
        setTimeout(() => {
            this.updateFrameScale();
            // Call updateImageScale after a longer delay to ensure images have loaded
            setTimeout(() => {
                this.updateImageScale();
            }, 100);
        }, 0);
    }

    /**
     * Create a storyboard page
     */
    createPage(images, orientation, pageSize, fontFamily, pageText, rows, cols, scale, isHandwriting, pageBgColor, pageIndex) {
        const page = document.createElement('div');
        page.className = `storyboard-page ${orientation}`;
        page.style.fontFamily = fontFamily;
        page.style.backgroundColor = pageBgColor;
        
        // Use flexbox layout: header, content (flex-grow), footer
        page.style.display = 'flex';
        page.style.flexDirection = 'column';
        
        // Apply minimal padding to page (frames have their own padding/margin)
        const mmToPx = 3.779527559;
        const pagePaddingPx = 5 * mmToPx; // Minimal page padding
        page.style.padding = `${pagePaddingPx}px`;
        
        // Calculate aspect ratio and scale to fit viewport while maintaining aspect ratio
        // Use actual page dimensions in mm (same as cover page)
        const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
        const aspectRatio = pageWidthMm / pageHeightMm;
        
        const pageWidthPx = pageWidthMm * mmToPx;
        const pageHeightPx = pageHeightMm * mmToPx;
        
        // Scale to fit viewport (max 90% width) while maintaining aspect ratio
        const maxWidth = window.innerWidth * 0.9;
        const scaleFactor = Math.min(1, maxWidth / pageWidthPx);
        const calculatedWidth = pageWidthPx * scaleFactor;
        const calculatedHeight = pageHeightPx * scaleFactor;
        
        page.style.width = `${calculatedWidth}px`;
        page.style.height = `${calculatedHeight}px`;
        page.style.maxWidth = '90vw'; // Ensure it doesn't exceed viewport
        page.dataset.pageWidth = pageWidthMm; // Store actual mm width for PDF
        page.dataset.pageHeight = pageHeightMm; // Store actual mm height for PDF
        page.dataset.scale = scaleFactor; // Store scale factor for zoom
        
        // Image grid container (flex-grow to fill available space)
        const gridContainer = document.createElement('div');
        gridContainer.className = 'image-grid-container'; // Add class name for selection
        gridContainer.style.flex = '1 1 auto';
        gridContainer.style.display = 'flex';
        gridContainer.style.flexDirection = 'column';
        gridContainer.style.minHeight = 0; // Important for flex children
        gridContainer.style.maxHeight = '100%'; // Don't exceed parent
        gridContainer.style.overflow = 'hidden'; // Prevent overflow
        
        // Image grid
        const grid = document.createElement('div');
        grid.className = 'image-grid';
        
        // Set grid template using manual rows and columns
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${rows}, auto)`;
        grid.style.width = '100%';
        grid.style.height = '100%';
        grid.style.maxHeight = '100%'; // Don't exceed container
        grid.style.overflow = 'hidden'; // Clip content that exceeds bounds
        grid.style.alignContent = 'start'; // Align items to top, don't stretch
        
        images.forEach((image, index) => {
            const frame = this.createFrame(image, scale, isHandwriting, fontFamily, pageIndex, index);
            
            // Create a wrapper for the frame with hover button
            const frameWrapper = document.createElement('div');
            frameWrapper.className = 'frame-wrapper';
            frameWrapper.appendChild(frame);
            
            // Add "Add Image" button that appears on hover
            const addBtn = document.createElement('div');
            addBtn.className = 'add-image-button';
            addBtn.innerHTML = '+';
            addBtn.title = 'Add image here';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.currentEditingImageIndex = this.app.project.images.findIndex(img => img.name === image.name);
                document.getElementById('addImageChoiceModal').style.display = 'block';
            });
            frameWrapper.appendChild(addBtn);
            
            grid.appendChild(frameWrapper);
        });
        
        // Add "Add Image" button at the end if there's space
        if (images.length < rows * cols) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'empty-slot';
            const addBtn = document.createElement('div');
            addBtn.className = 'add-image-button empty-slot-button';
            addBtn.innerHTML = '+<br><small>Add Image</small>';
            addBtn.title = 'Add image here';
            addBtn.addEventListener('click', () => {
                const lastImage = images[images.length - 1];
                if (lastImage) {
                    this.app.currentEditingImageIndex = this.app.project.images.findIndex(img => img.name === lastImage.name);
                } else {
                    this.app.currentEditingImageIndex = -1;
                }
                document.getElementById('addImageChoiceModal').style.display = 'block';
            });
            emptySlot.appendChild(addBtn);
            grid.appendChild(emptySlot);
        }
        
        gridContainer.appendChild(grid);
        page.appendChild(gridContainer);
        
        // Per-page custom text at bottom (footer) - doesn't affect image layout
        if (this.app.project.settings.showBottomText) {
            const pageTextBottom = document.createElement('textarea');
            pageTextBottom.className = 'page-text-bottom';
            pageTextBottom.placeholder = 'Enter custom text for this page...';
            pageTextBottom.value = this.app.project.pageTexts[pageIndex] || '';
            pageTextBottom.style.fontFamily = this.app.project.settings.pageFontFamily || "'Kalam', cursive";
            pageTextBottom.style.fontSize = (this.app.project.settings.pageFontSize || 12) + 'px';
            pageTextBottom.style.fontWeight = this.app.project.settings.pageFontWeight || '400';
            pageTextBottom.style.fontStyle = this.app.project.settings.pageFontStyle || 'normal';
            pageTextBottom.style.color = this.app.project.settings.pageTextColor || '#b4b4b4';
            pageTextBottom.style.textAlign = this.app.project.settings.pageTextAlign || 'left';
            pageTextBottom.style.lineHeight = (this.app.project.settings.pageLineHeight || 1.5).toString();
            pageTextBottom.style.width = '100%';
            pageTextBottom.style.marginTop = '10px';
            pageTextBottom.style.maxWidth = '100%';
            pageTextBottom.style.boxSizing = 'border-box';
            pageTextBottom.style.flexShrink = 0; // Don't shrink footer
            pageTextBottom.style.maxHeight = '80px'; // Limit footer height to prevent overflow
            pageTextBottom.style.overflowY = 'auto'; // Allow scrolling if content is too long
            // Debounce text input to avoid performance issues
            let textTimeout;
            pageTextBottom.addEventListener('input', (e) => {
                this.app.project.pageTexts[pageIndex] = e.target.value;
                clearTimeout(textTimeout);
                textTimeout = setTimeout(() => {
                    if (this.app.markChanged) this.app.markChanged();
                }, 500); // Save 500ms after typing stops
            });
            page.appendChild(pageTextBottom);
        }
        
        // Add page number if enabled
        if (this.app.project.settings.enablePageNumbers) {
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = (pageIndex + 1).toString();
            pageNumber.style.position = 'absolute';
            pageNumber.style.fontSize = (this.app.project.settings.pageNumberFontSize || 12) + 'px';
            // Use the user's selected color, or default based on background if not set
            const pageBgColor = this.app.project.settings.pageBackgroundColor || '#404040';
            const isDarkBg = this.app.isColorDark ? this.app.isColorDark(pageBgColor) : false;
            const defaultColor = isDarkBg ? '#ffffff' : '#000000';
            // Use user's color if set, otherwise use default based on background
            pageNumber.style.color = this.app.project.settings.pageNumberColor || defaultColor;
            pageNumber.style.fontWeight = 'bold';
            pageNumber.style.zIndex = '100';
            pageNumber.style.pointerEvents = 'none';
            
            const position = this.app.project.settings.pageNumberPosition || 'bottom-center';
            switch (position) {
                case 'top-left':
                    pageNumber.style.top = '10px';
                    pageNumber.style.left = '10px';
                    break;
                case 'top-center':
                    pageNumber.style.top = '10px';
                    pageNumber.style.left = '50%';
                    pageNumber.style.transform = 'translateX(-50%)';
                    break;
                case 'top-right':
                    pageNumber.style.top = '10px';
                    pageNumber.style.right = '10px';
                    break;
                case 'bottom-left':
                    pageNumber.style.bottom = '10px';
                    pageNumber.style.left = '10px';
                    break;
                case 'bottom-center':
                    pageNumber.style.bottom = '10px';
                    pageNumber.style.left = '50%';
                    pageNumber.style.transform = 'translateX(-50%)';
                    break;
                case 'bottom-right':
                    pageNumber.style.bottom = '10px';
                    pageNumber.style.right = '10px';
                    break;
            }
            page.appendChild(pageNumber);
        }
        
        // Add watermark if enabled
        if (this.app.project.settings.enableWatermark) {
            const watermark = document.createElement('div');
            watermark.className = this.app.project.settings.watermarkType === 'text' ? 'page-watermark' : 'page-watermark-image';
            watermark.style.opacity = this.app.project.settings.watermarkOpacity / 100;
            
            if (this.app.project.settings.watermarkType === 'text' && this.app.project.settings.watermarkText) {
                watermark.textContent = this.app.project.settings.watermarkText;
            } else if (this.app.project.settings.watermarkType === 'image' && this.app.project.settings.watermarkImage) {
                const watermarkImg = document.createElement('img');
                watermarkImg.src = this.app.project.settings.watermarkImage;
                
                // Set image size based on percentage
                const sizePercent = this.app.project.settings.watermarkImageSize || 50;
                watermarkImg.style.width = sizePercent + '%';
                watermarkImg.style.height = 'auto';
                watermarkImg.style.maxWidth = '100%';
                watermarkImg.style.maxHeight = '100%';
                watermarkImg.style.objectFit = 'contain';
                
                watermark.appendChild(watermarkImg);
                
                // Set position based on user selection
                const position = this.app.project.settings.watermarkImagePosition || 'center';
                watermark.style.position = 'absolute';
                watermark.style.margin = '0';
                
                // Reset transform
                watermark.style.transform = 'none';
                watermark.style.top = 'auto';
                watermark.style.left = 'auto';
                watermark.style.right = 'auto';
                watermark.style.bottom = 'auto';
                
                switch (position) {
                    case 'top-left':
                        watermark.style.top = '10px';
                        watermark.style.left = '10px';
                        break;
                    case 'top-center':
                        watermark.style.top = '10px';
                        watermark.style.left = '50%';
                        watermark.style.transform = 'translateX(-50%)';
                        break;
                    case 'top-right':
                        watermark.style.top = '10px';
                        watermark.style.right = '10px';
                        break;
                    case 'center-left':
                        watermark.style.top = '50%';
                        watermark.style.left = '10px';
                        watermark.style.transform = 'translateY(-50%)';
                        break;
                    case 'center':
                        watermark.style.top = '50%';
                        watermark.style.left = '50%';
                        watermark.style.transform = 'translate(-50%, -50%)';
                        break;
                    case 'center-right':
                        watermark.style.top = '50%';
                        watermark.style.right = '10px';
                        watermark.style.transform = 'translateY(-50%)';
                        break;
                    case 'bottom-left':
                        watermark.style.bottom = '10px';
                        watermark.style.left = '10px';
                        break;
                    case 'bottom-center':
                        watermark.style.bottom = '10px';
                        watermark.style.left = '50%';
                        watermark.style.transform = 'translateX(-50%)';
                        break;
                    case 'bottom-right':
                        watermark.style.bottom = '10px';
                        watermark.style.right = '10px';
                        break;
                }
            }
            page.appendChild(watermark);
        }
        
        // Store page index for annotation system
        // Use a consistent page index that doesn't change when cover page is toggled
        // For storyboard pages, use the actual storyboard page index (0-based, excluding cover page)
        // The cover page should not have annotations
        // The pageIndex passed here is the globalPageIndex which accounts for cover page
        // We need to convert it back to storyboard page index (0-based) for consistent annotation storage
        const hasCoverPage = this.app.project.settings.enableCoverPage;
        const storyboardPageIndex = hasCoverPage ? Math.max(0, pageIndex - 1) : pageIndex;
        page.dataset.pageIndex = storyboardPageIndex;
        
        // Initialize annotation canvas - always initialize to preserve annotations
        // Only initialize for storyboard pages, not cover pages
        setTimeout(() => {
            if (this.app.annotationSystem) {
                // Always re-initialize to ensure annotations are loaded after page re-render
                // The initCanvas method will handle cleanup of existing canvas if needed
                this.app.annotationSystem.initCanvas(page, storyboardPageIndex);
            } else if (this.app.drawingSystem) {
                this.app.drawingSystem.initCanvas(page, storyboardPageIndex);
            }
        }, 100);
        
        return page;
    }

    /**
     * Create cover page
     */
    createCoverPage(orientation, pageSize, fontFamily, pageBgColor) {
        const page = document.createElement('div');
        page.className = `storyboard-page cover-page ${orientation}`;
        page.style.fontFamily = fontFamily;
        page.style.backgroundColor = pageBgColor;
        
        // Convert mm to pixels (1mm = 3.779527559 pixels at 96 DPI)
        const mmToPx = 3.779527559;
        
        // Apply adjustable padding (same as regular pages)
        const pagePaddingMm = this.app.project.settings.pagePadding || 5;
        const pagePaddingPx = pagePaddingMm * mmToPx;
        page.style.padding = `${pagePaddingPx}px`;
        
        // Calculate aspect ratio and scale to fit viewport while maintaining aspect ratio
        // Use actual page dimensions in mm
        const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
        const aspectRatio = pageWidthMm / pageHeightMm;
        const pageWidthPx = pageWidthMm * mmToPx;
        const pageHeightPx = pageHeightMm * mmToPx;
        
        // Scale to fit viewport (max 90% width) while maintaining aspect ratio
        const maxWidth = window.innerWidth * 0.9;
        const scale = Math.min(1, maxWidth / pageWidthPx);
        const calculatedWidth = pageWidthPx * scale;
        const calculatedHeight = pageHeightPx * scale;
        
        page.style.width = `${calculatedWidth}px`;
        page.style.height = `${calculatedHeight}px`;
        page.style.maxWidth = '90vw'; // Ensure it doesn't exceed viewport
        page.dataset.pageWidth = pageWidthMm; // Store actual mm width for PDF
        page.dataset.pageHeight = pageHeightMm; // Store actual mm height for PDF
        page.dataset.scale = scale; // Store scale factor for zoom
        
        if (this.app.project.settings.coverPageTitle) {
            const title = document.createElement('div');
            title.className = 'cover-page-title';
            title.textContent = this.app.project.settings.coverPageTitle;
            title.style.fontFamily = this.app.project.settings.coverPageTitleFontFamily || "'Kalam', cursive";
            title.style.fontSize = (this.app.project.settings.coverPageTitleFontSize || 48) + 'px';
            title.style.color = this.app.project.settings.coverPageTitleColor || '#000000';
            page.appendChild(title);
        }
        
        if (this.app.project.settings.coverPageYear) {
            const year = document.createElement('div');
            year.className = 'cover-page-year';
            year.textContent = this.app.project.settings.coverPageYear;
            year.style.fontFamily = this.app.project.settings.coverPageYearFontFamily || "'Kalam', cursive";
            year.style.fontSize = (this.app.project.settings.coverPageYearFontSize || 24) + 'px';
            year.style.color = this.app.project.settings.coverPageYearColor || '#666666';
            page.appendChild(year);
        }
        
        if (this.app.project.settings.coverPageCreators) {
            const creators = document.createElement('div');
            creators.className = 'cover-page-creators';
            creators.textContent = this.app.project.settings.coverPageCreators;
            creators.style.fontFamily = this.app.project.settings.coverPageCreatorsFontFamily || "'Kalam', cursive";
            creators.style.fontSize = (this.app.project.settings.coverPageCreatorsFontSize || 18) + 'px';
            creators.style.color = this.app.project.settings.coverPageCreatorsColor || '#333333';
            page.appendChild(creators);
        }
        
        if (this.app.project.settings.coverPageLogo) {
            const logo = document.createElement('img');
            logo.className = 'cover-page-logo';
            logo.src = this.app.project.settings.coverPageLogo;
            page.appendChild(logo);
        }
        
        return page;
    }

    /**
     * Create a storyboard frame
     */
    createFrame(image, scale, isHandwriting, fontFamily, pageIndex, frameIndex) {
        // CRITICAL: Get the actual image object from project.images to ensure we have the latest data
        // This ensures editLayers and compositeUrl are always up to date
        let actualImage = image;
        if (this.app && this.app.project && this.app.project.images && image && image.name) {
            const imageInProject = this.app.project.images.find(img => img.name === image.name);
            if (imageInProject) {
                actualImage = imageInProject;
            }
        }
        
        const frame = document.createElement('div');
        frame.className = 'storyboard-frame';
        
        // Apply frame scale
        const frameScale = this.app.project.settings.frameScale || 100;
        const scaleValue = frameScale / 100;
        frame.style.transform = `scale(${scaleValue})`;
        frame.style.transformOrigin = 'center';
        
        // Shot number rectangle with three sections (Scene, Shot, Frame)
        const shotContainer = document.createElement('div');
        shotContainer.className = 'shot-number-container';
        
        const rectangle = document.createElement('div');
        rectangle.className = 'shot-number-rectangle';
        // Apply rectangle scale
        const rectangleScale = this.app.project.settings.shotCircleScale || 100;
        const rectangleScaleValue = rectangleScale / 100;
        rectangle.style.transform = `scale(${rectangleScaleValue})`;
        
        // Get values from image data (use actualImage now)
        // Don't use filename as fallback for frameNumber - respect empty values when recognition is disabled
        const sceneNumber = this.app.project.imageScenes[actualImage.name] || actualImage.sceneNumber || '';
        const shotNumber = actualImage.shotNumber || '';
        const frameNumber = actualImage.frameNumber || ''; // Never use filename as fallback
        
        // Scene section
        const sceneSection = document.createElement('div');
        sceneSection.className = 'shot-section shot-section-scene';
        sceneSection.textContent = sceneNumber ? `Scene: ${sceneNumber}` : 'Scene:';
        sceneSection.style.fontFamily = this.app.project.settings.shotFontFamily || "'Kalam', cursive";
        sceneSection.style.fontSize = (this.app.project.settings.shotFontSize || 14) + 'px';
        sceneSection.style.fontWeight = this.app.project.settings.shotFontWeight || 'bold';
        sceneSection.style.color = this.app.project.settings.shotTextColor || '#ebebeb';
        if (!sceneNumber) {
            sceneSection.style.opacity = '0.6';
            sceneSection.style.fontStyle = 'italic';
        }
        
        // Shot section
        const shotSection = document.createElement('div');
        shotSection.className = 'shot-section shot-section-shot';
        shotSection.textContent = shotNumber ? `Shot: ${shotNumber}` : 'Shot:';
        shotSection.style.fontFamily = this.app.project.settings.shotFontFamily || "'Kalam', cursive";
        shotSection.style.fontSize = (this.app.project.settings.shotFontSize || 14) + 'px';
        shotSection.style.fontWeight = this.app.project.settings.shotFontWeight || 'bold';
        shotSection.style.color = this.app.project.settings.shotTextColor || '#ebebeb';
        if (!shotNumber) {
            shotSection.style.opacity = '0.6';
            shotSection.style.fontStyle = 'italic';
        }
        
        // Frame section
        const frameSection = document.createElement('div');
        frameSection.className = 'shot-section shot-section-frame';
        frameSection.textContent = frameNumber ? `Frame: ${frameNumber}` : 'Frame:';
        frameSection.style.fontFamily = this.app.project.settings.shotFontFamily || "'Kalam', cursive";
        frameSection.style.fontSize = (this.app.project.settings.shotFontSize || 14) + 'px';
        frameSection.style.fontWeight = this.app.project.settings.shotFontWeight || 'bold';
        frameSection.style.color = this.app.project.settings.shotTextColor || '#ebebeb';
        if (!frameNumber) {
            frameSection.style.opacity = '0.6';
            frameSection.style.fontStyle = 'italic';
        }
        
        rectangle.appendChild(sceneSection);
        rectangle.appendChild(shotSection);
        rectangle.appendChild(frameSection);
        shotContainer.appendChild(rectangle);
        frame.appendChild(shotContainer);
        
        // Image (clickable to open settings)
        const imageContainer = document.createElement('div');
        imageContainer.className = 'frame-image-container';
        imageContainer.addEventListener('click', () => {
            if (this.app.imageSettingsController) {
                this.app.imageSettingsController.openImageSettings(actualImage);
            } else if (this.app.openImageSettings) {
                this.app.openImageSettings(actualImage);
            }
        });
        
        const img = document.createElement('img');
        img.className = 'frame-image';
        img.alt = actualImage ? actualImage.name : 'Image';
        img.style.transform = 'scale(1)';
        img.style.transformOrigin = 'center center';
        
        // Check if image has edit layers - if so, create composite (use actualImage)
        // IMPORTANT: If editLayers is undefined/null (not an empty array), it means the image was rasterized
        // and we should use the URL directly (which contains the rasterized version)
        const hasEditLayers = actualImage && actualImage.editLayers && Array.isArray(actualImage.editLayers) && actualImage.editLayers.length > 0;
        
        if (hasEditLayers) {
            // Use cached composite if available (use actualImage)
            if (actualImage.compositeUrl) {
                img.setAttribute('data-composite-loading', 'true');
                img.onload = () => {
                    img.removeAttribute('data-composite-loading');
                    img.onload = null;
                };
                img.onerror = (e) => {
                    img.removeAttribute('data-composite-loading');
                    actualImage.compositeUrl = null;
                    this.createImageComposite(actualImage, img);
                    img.onerror = null;
                };
                img.src = actualImage.compositeUrl;
            } else {
                img.setAttribute('data-composite-loading', 'true');
                this.createImageComposite(actualImage, img);
            }
        } else {
            // No edit layers - use the image URL directly (which may be a rasterized version)
            // If editLayers is undefined/null, it means the image was rasterized and url contains the edited version
            if (actualImage && actualImage.url) {
                // Clear old src and handlers first
                img.onload = null;
                img.onerror = null;
                img.src = ''; // Clear old src
                
                // Set up error handler - only trigger on actual load failures
                img.onerror = function() {
                    // Only log if this is a real error (src is set and not a fallback SVG)
                    if (this.src && this.src !== '' && !this.src.includes('data:image/svg+xml') && !this.src.includes('data:image/png;base64,PHN2Zy')) {
                        // Check if image actually failed to load (not just a temporary state)
                        // Wait a bit to see if it's just a slow load
                        setTimeout(() => {
                            if (this.complete === false || this.naturalWidth === 0) {
                                console.error('Failed to load image:', actualImage ? actualImage.name : 'Unknown');
                                // Only set fallback if this is not a composite image
                                if (!actualImage || !actualImage.editLayers || actualImage.editLayers.length === 0) {
                                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                                }
                            }
                        }, 100);
                    }
                };
                
                // Set the new src with cache-busting for data URLs (add timestamp fragment)
                // This ensures the browser recognizes it as a new image even if it's the same data URL
                let imageUrl = actualImage.url;
                if (imageUrl.startsWith('data:')) {
                    // For data URLs, we can't add query params, but we can force reload by clearing and resetting
                    // The browser should recognize it as new if we clear first
                    // Use requestAnimationFrame to ensure the clear takes effect before setting new src
                    requestAnimationFrame(() => {
                        img.src = imageUrl;
                    });
                } else {
                    // For regular URLs, add cache-busting parameter
                    const separator = imageUrl.includes('?') ? '&' : '?';
                    imageUrl = imageUrl + separator + '_t=' + Date.now();
                    img.src = imageUrl;
                }
                
                // Force a reflow to ensure browser processes the new src
                void img.offsetHeight;
            } else {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
            }
        }
        
        img.className = 'frame-image';
        img.alt = actualImage ? actualImage.name : 'Unknown';
        
        // Apply aspect ratio cropping
        const aspectRatio = this.app.project.settings.imageAspectRatio || 'none';
        if (aspectRatio !== 'none') {
            let aspectRatioValue;
            if (aspectRatio === 'custom') {
                const width = this.app.project.settings.customAspectRatioWidth || 16;
                const height = this.app.project.settings.customAspectRatioHeight || 9;
                aspectRatioValue = width / height;
            } else {
                // Parse aspect ratio string (e.g., "16:9", "2.35:1")
                const parts = aspectRatio.split(':');
                if (parts.length === 2) {
                    aspectRatioValue = parseFloat(parts[0]) / parseFloat(parts[1]);
                } else {
                    aspectRatioValue = null;
                }
            }
            
            if (aspectRatioValue) {
                // Apply aspect ratio to container, but ensure it fits within available space
                // Use object-fit: contain to ensure image fits without overflow
                imageContainer.style.width = '100%';
                imageContainer.style.overflow = 'hidden';
                
                // Set aspect ratio, but use contain instead of cover to prevent overflow
                imageContainer.style.aspectRatio = `${aspectRatioValue}`;
                imageContainer.style.maxWidth = '100%';
                imageContainer.style.maxHeight = '100%';
                imageContainer.style.height = 'auto';
                imageContainer.style.minHeight = '0'; // Override min-height to allow shrinking
                
                // Scale will be handled by updateImageScale() using width/height
                // Don't use transform here - it doesn't affect layout
                
                // Use object-fit: cover to crop the image to aspect ratio
                // The container will be constrained by max-height to prevent overflow
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.objectPosition = 'center';
            }
        } else {
            // Reset to original behavior - apply scale to image directly
            imageContainer.style.aspectRatio = '';
            imageContainer.style.overflow = '';
            imageContainer.style.maxHeight = '';
            imageContainer.style.maxWidth = '';
            imageContainer.style.height = '';
            imageContainer.style.minHeight = '';
            imageContainer.style.transform = '';
            imageContainer.style.transformOrigin = '';
            img.style.width = '';
            img.style.height = '';
            img.style.objectFit = '';
            img.style.objectPosition = '';
            
            // When no aspect ratio, scaling will be handled by updateImageScale()
            // which uses width/height instead of transform to affect layout
        }
        
        // Error handler is set up above for non-composite images
        // Composite images have their own error handler in createImageComposite
        
        // Adjust margins to keep elements close when image is scaled (for aspect ratio case)
        if (aspectRatio !== 'none' && scale < 1) {
            imageContainer.style.marginBottom = '0'; // Remove margin when scaled
            // Adjust shot number container margin to keep it close
            const shotContainer = frame.querySelector('.shot-number-container');
            if (shotContainer) {
                shotContainer.style.marginBottom = '5px'; // Reduce margin when scaled
            }
        } else if (aspectRatio !== 'none') {
            imageContainer.style.marginBottom = ''; // Restore default margin
            const shotContainer = frame.querySelector('.shot-number-container');
            if (shotContainer) {
                shotContainer.style.marginBottom = ''; // Restore default margin
            }
        }
        
        imageContainer.appendChild(img);
        frame.appendChild(imageContainer);
        
        // Text area with font controls
        const textArea = document.createElement('textarea');
        textArea.className = 'frame-text';
        textArea.placeholder = 'Enter description for this frame...';
        textArea.value = this.app.project.frameTexts[image.name] || '';
        textArea.style.fontFamily = this.app.project.settings.frameFontFamily || "'Kalam', cursive";
        textArea.style.fontSize = (this.app.project.settings.frameFontSize || 12) + 'px';
        textArea.style.fontWeight = this.app.project.settings.frameFontWeight || '400';
        textArea.style.fontStyle = this.app.project.settings.frameFontStyle || 'normal';
        textArea.style.color = this.app.project.settings.frameTextColor || '#b4b4b4';
        textArea.style.textAlign = this.app.project.settings.frameTextAlign || 'left';
        
        // Apply frame text scale to height
        const frameTextScale = (this.app.project.settings.frameTextScale || 100) / 100;
        const baseMinHeight = 60; // Base min-height from CSS
        const basePadding = 8; // Base padding from CSS
        const baseMarginTop = 5; // Base margin-top from CSS
        textArea.style.minHeight = (baseMinHeight * frameTextScale) + 'px';
        textArea.style.paddingTop = (basePadding * frameTextScale) + 'px';
        textArea.style.paddingBottom = (basePadding * frameTextScale) + 'px';
        textArea.style.marginTop = (baseMarginTop * frameTextScale) + 'px';
        // Debounce text input to avoid performance issues
        let textTimeout;
        textArea.addEventListener('input', (e) => {
            this.app.project.frameTexts[image.name] = e.target.value;
            clearTimeout(textTimeout);
            textTimeout = setTimeout(() => {
                if (this.app.markChanged) this.app.markChanged();
            }, 500); // Save 500ms after typing stops
        });
        
        frame.appendChild(textArea);
        
        return frame;
    }

    /**
     * Update image scale on all frames
     */
    updateImageScale() {
        // Update image scale on all frames - use width/height instead of transform
        const frames = document.querySelectorAll('.storyboard-frame');
        const scale = this.app.project.settings.imageScale || 100;
        const scaleValue = scale / 100;
        const aspectRatio = this.app.project.settings.imageAspectRatio || 'none';
        
        frames.forEach((frame) => {
            const imageContainer = frame.querySelector('.frame-image-container');
            const img = frame.querySelector('.frame-image');
            
            if (!imageContainer || !img) return;
            
            if (aspectRatio === 'none') {
                // No aspect ratio - scale the container dimensions directly
                if (scale < 100) {
                    // Get image dimensions (use natural if available, otherwise use current)
                    const imgWidth = img.naturalWidth || img.offsetWidth || 1;
                    const imgHeight = img.naturalHeight || img.offsetHeight || 1;
                    
                    if (imgWidth > 0 && imgHeight > 0) {
                        // Get the frame width to calculate scaled dimensions
                        const frameWidth = frame.offsetWidth || imageContainer.parentElement.offsetWidth;
                        
                        // Calculate scaled dimensions maintaining aspect ratio
                        const naturalAspectRatio = imgWidth / imgHeight;
                        const scaledWidth = frameWidth * scaleValue;
                        const scaledHeight = scaledWidth / naturalAspectRatio;
                        
                        // Apply scaled dimensions to container (affects layout)
                        // Only change width and height, leave margins and min-height as CSS defines
                        imageContainer.style.width = `${scaledWidth}px`;
                        imageContainer.style.height = `${scaledHeight}px`;
                        
                        // Image fills container - no transform needed
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'contain';
                    }
                } else if (scale === 100) {
                    // Reset to full size - only clear width and height
                    imageContainer.style.width = '';
                    imageContainer.style.height = '';
                    img.style.width = '';
                    img.style.height = '';
                    img.style.objectFit = '';
                }
            } else {
                // Aspect ratio is set - scale the container that has aspect ratio
                if (scale < 100) {
                    // Get the frame width to calculate scaled dimensions
                    const frameWidth = frame.offsetWidth || imageContainer.parentElement.offsetWidth;
                    
                    // Calculate scaled width
                    const scaledWidth = frameWidth * scaleValue;
                    
                    // Get aspect ratio to calculate height
                    let aspectRatioValue;
                    if (aspectRatio === 'custom') {
                        const width = this.app.project.settings.customAspectRatioWidth || 16;
                        const height = this.app.project.settings.customAspectRatioHeight || 9;
                        aspectRatioValue = width / height;
                    } else {
                        const parts = aspectRatio.split(':');
                        if (parts.length === 2) {
                            aspectRatioValue = parseFloat(parts[0]) / parseFloat(parts[1]);
                        }
                    }
                    
                    if (aspectRatioValue) {
                        const scaledHeight = scaledWidth / aspectRatioValue;
                        
                        // Only change width and height, leave margins and min-height as CSS defines
                        imageContainer.style.width = `${scaledWidth}px`;
                        imageContainer.style.height = `${scaledHeight}px`;
                    }
                } else if (scale === 100) {
                    // Reset to full size - only clear width and height
                    imageContainer.style.width = '';
                    imageContainer.style.height = '';
                }
            }
        });
    }

    /**
     * Update frame scale on all frames
     */
    updateFrameScale() {
        // Update scale on frames in real-time
        const frames = document.querySelectorAll('.storyboard-frame');
        const scale = this.app.project.settings.frameScale || 100;
        const scaleValue = scale / 100;
        
        frames.forEach((frame, index) => {
            // Apply transform to frame
            frame.style.transform = `scale(${scaleValue})`;
            frame.style.transformOrigin = 'top center'; // Scale from top center
            
            // Adjust wrapper to accommodate scaled frame
            const wrapper = frame.closest('.frame-wrapper');
            if (wrapper) {
                if (scale < 1) {
                    // Use setTimeout to ensure measurement happens after current layout
                    setTimeout(() => {
                        // Temporarily remove transform to get accurate natural height
                        const originalTransform = frame.style.transform;
                        frame.style.transform = 'none';
                        
                        // Force a reflow to get accurate measurements
                        void frame.offsetHeight;
                        
                        const naturalHeight = frame.offsetHeight || frame.scrollHeight;
                        
                        // Reapply transform
                        frame.style.transform = originalTransform;
                        
                        // Only adjust height, not width - let grid handle width
                        wrapper.style.height = `${naturalHeight * scaleValue}px`;
                        wrapper.style.alignSelf = 'start'; // Align to top of grid cell
                    }, 0);
                } else {
                    // Reset wrapper height when scale is 100% or more
                    wrapper.style.height = '';
                    wrapper.style.alignSelf = '';
                }
            }
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderService;
}

