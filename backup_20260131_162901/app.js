// Storyboard Creator Application
class StoryboardCreator {
    constructor() {
        this.project = {
            images: [],
            settings: {
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
            },
            frameTexts: {}, // Store text for each frame by image name
            pageTexts: {}, // Store custom text for each page
            imageScenes: {}, // Store scene for each image
            drawings: {}, // Store drawing data for each page
            activePanel: null
        };
        
        this.hasUnsavedChanges = false;
        this.currentEditingImage = null;
        this.isDrawing = false;
        this.currentCanvas = null;
        this.currentPageIndex = null;
        this.currentProjectPath = null; // Track current save path
        this.autoSaveInterval = null;
        this.zoomLevel = 1.0; // Current zoom level
        this.imageFolderPath = null; // Store folder path for reload
        this.removedImages = new Set(); // Track removed images
        this.drawingSystem = null; // Will be initialized after DrawingSystem class is available
        this.fileManager = null; // Will be initialized after FileManager class is available
        this.imagesNeedReload = false; // Flag for images that need to be reloaded
        this.pendingImageMetadata = null; // Store image metadata when reloading
        
        this.pageSizes = {
            'A4': { width: 210, height: 297 }, // mm
            'A3': { width: 297, height: 420 },
            'Letter': { width: 215.9, height: 279.4 },
            'Legal': { width: 215.9, height: 355.6 },
            'Tabloid': { width: 279.4, height: 431.8 }
        };
        
        // Initialize file manager and drawing system first (before event listeners)
        if (typeof FileManager !== 'undefined') {
            this.fileManager = new FileManager(this);
        }
        
        // Initialize first to set up event listeners
        this.init();
        
        // Load from localStorage if available (async, won't block initialization)
        this.loadFromStorage().catch(e => {
            console.error('Error loading from storage:', e);
            // Continue even if loading fails
        });
        
        // Initialize drawing system after DOM is ready
        setTimeout(() => {
            if (typeof DrawingSystem !== 'undefined') {
                this.drawingSystem = new DrawingSystem(this);
                // Sync initial settings
                if (this.drawingSystem && this.project.settings) {
                    this.drawingSystem.setTool(this.project.settings.drawingTool || 'brush');
                    this.drawingSystem.setBrushSize(this.project.settings.brushSize || 5);
                    this.drawingSystem.setBrushColor(this.project.settings.brushColor || '#000000');
                    if (this.project.settings.fillColor && this.project.settings.fillColor !== 'transparent') {
                        this.drawingSystem.setFillColor(this.project.settings.fillColor);
                    }
                }
            }
        }, 100);
    }
    
    init() {
        this.setupEventListeners();
        this.updateScaleDisplay();
        this.setupModal();
        this.setupPanels();
        this.setupDrawing();
        this.setupCoverPage();
        this.setupWatermark();
        this.setupBrowserWarning();
        this.startAutoSave();
        this.updateProjectName(); // Initialize project name display
        
        // Initialize UI with default values if no project is loaded
        if (!this.project.images || this.project.images.length === 0) {
            // Ensure defaults are set in UI
            const orientationSelect = document.getElementById('pageOrientation');
            if (orientationSelect && !orientationSelect.value) {
                orientationSelect.value = 'landscape';
            }
            const imagesPerPageSlider = document.getElementById('imagesPerPage');
            const imagesPerPageInput = document.getElementById('imagesPerPageInput');
            if (imagesPerPageSlider && imagesPerPageInput) {
                if (!imagesPerPageSlider.value || imagesPerPageSlider.value === '0') {
                    imagesPerPageSlider.value = 6;
                    imagesPerPageInput.value = 6;
                }
            }
        }
    }
    
    setupEventListeners() {
        try {
            // Toolbar buttons - use event delegation to ensure clicks work even if menu closes
            
            // New Project
            const newProjectBtn = document.getElementById('newProject');
            if (newProjectBtn) {
                newProjectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.newProject();
                    }
                });
            }
            
            // Open Project
            const openProjectBtn = document.getElementById('openProjectBtn');
            if (openProjectBtn) {
                openProjectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.openProject();
                    }
                });
            }
            
            // Save Project
            const saveProjectBtn = document.getElementById('saveProject');
            if (saveProjectBtn) {
                saveProjectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.save();
                    }
                });
            }
            
            // Save Project As
            const saveProjectAsBtn = document.getElementById('saveProjectAs');
            if (saveProjectAsBtn) {
                saveProjectAsBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.saveAs();
                    }
                });
            }
            
            // Close Project
            const closeProjectBtn = document.getElementById('closeProject');
            if (closeProjectBtn) {
                closeProjectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.closeProject();
                    }
                });
            }
            
            // Export PDF
            const exportPDFBtn = document.getElementById('exportPDF');
            if (exportPDFBtn) {
                exportPDFBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.fileManager) {
                        await this.fileManager.exportPDF();
                    }
                });
            }
            
            // Import Images
            const importImagesBtn = document.getElementById('importImagesBtn');
            if (importImagesBtn) {
                importImagesBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Use File System Access API if available
                    if (this.fileManager && this.fileManager.supportsFileSystemAccess) {
                        try {
                            const directoryHandle = await window.showDirectoryPicker({
                                mode: 'read'
                            });
                            
                            // Store the directory handle
                            this.fileManager.directoryHandle = directoryHandle;
                            const projectPath = this.currentProjectPath || 'default';
                            await this.fileManager.storeDirectoryHandle(projectPath, directoryHandle);
                            
                            // Load images from directory
                            await this.fileManager.loadImagesFromDirectoryHandle(directoryHandle);
                        } catch (error) {
                            if (error.name !== 'AbortError') {
                                console.error('Error selecting directory:', error);
                                await this.customAlert('Error selecting folder: ' + error.message);
                            }
                        }
                    } else {
                        // Fallback to file input
                        const imageFolder = document.getElementById('imageFolder');
                        if (imageFolder) {
                            // Reset the input to allow selecting the same folder again
                            imageFolder.value = '';
                            imageFolder.click();
                        } else {
                            console.error('imageFolder input not found');
                        }
                    }
                });
            }
            
            const imageFolder = document.getElementById('imageFolder');
            if (imageFolder) {
                imageFolder.addEventListener('change', (e) => {
                    console.log('imageFolder change event fired', e.target.files?.length || 0, 'files');
                    this.importImages(e);
                });
            } else {
                console.error('imageFolder input not found for change listener');
            }
            
            
            // Handle file menu hover and click
            const fileMenuBtn = document.getElementById('fileMenuBtn');
            const fileMenu = document.getElementById('fileMenu');
            if (fileMenuBtn && fileMenu) {
                let menuTimeout = null;
                
                const showMenu = () => {
                    if (menuTimeout) clearTimeout(menuTimeout);
                    fileMenu.style.display = 'block';
                };
                
                const hideMenu = () => {
                    menuTimeout = setTimeout(() => {
                        fileMenu.style.display = 'none';
                    }, 200); // Small delay to allow moving to dropdown
                };
                
                fileMenuBtn.addEventListener('mouseenter', showMenu);
                fileMenuBtn.addEventListener('mouseleave', hideMenu);
                fileMenu.addEventListener('mouseenter', showMenu);
                fileMenu.addEventListener('mouseleave', hideMenu);
                
                // Close menu when clicking on menu items (after their handlers fire)
                fileMenu.addEventListener('click', (e) => {
                    const clickedMenuItem = e.target.closest('.menu-item');
                    if (clickedMenuItem) {
                        // Don't close immediately - let the button's click handler fire first
                        // The menu will close when clicking outside
                        e.stopPropagation();
                    }
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', (e) => {
                    if (!fileMenu.contains(e.target) && !fileMenuBtn.contains(e.target)) {
                        fileMenu.style.display = 'none';
                    }
                });
            }
            
            const zoomInBtn = document.getElementById('zoomIn');
            if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoom(1.1));
            
            const zoomOutBtn = document.getElementById('zoomOut');
            if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoom(0.9));
            
            const zoomFitBtn = document.getElementById('zoomFit');
            if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => this.zoomFit());
            
            const zoomLevelInput = document.getElementById('zoomLevel');
            if (zoomLevelInput) {
                zoomLevelInput.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value) || 100;
                    const clampedValue = Math.max(25, Math.min(300, value));
                    this.zoomLevel = clampedValue / 100;
                    this.applyZoom();
                });
                zoomLevelInput.addEventListener('blur', (e) => {
                    const value = parseInt(e.target.value) || 100;
                    const clampedValue = Math.max(25, Math.min(300, value));
                    e.target.value = clampedValue;
                    this.zoomLevel = clampedValue / 100;
                    this.applyZoom();
                });
            }
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
        
        // Settings
        try {
            document.getElementById('pageOrientation').addEventListener('change', (e) => {
                this.project.settings.orientation = e.target.value;
                this.markChanged();
                updateMaxImagesPerPage();
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            document.getElementById('pageSize').addEventListener('change', (e) => {
                this.project.settings.pageSize = e.target.value;
                this.markChanged();
                updateMaxImagesPerPage();
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            // Images per page slider and input
            const imagesPerPageSlider = document.getElementById('imagesPerPage');
            const imagesPerPageInput = document.getElementById('imagesPerPageInput');
            
            const updateImagesPerPage = (value) => {
                const maxImages = this.getMaxImagesPerPage();
                const imagesPerPage = Math.max(1, Math.min(maxImages, parseInt(value) || 6));
                this.project.settings.imagesPerPage = imagesPerPage;
                imagesPerPageSlider.value = imagesPerPage;
                imagesPerPageInput.value = imagesPerPage;
                
                // Calculate and display optimal layout
                const layout = this.calculateOptimalLayout(imagesPerPage);
                const layoutInfo = document.getElementById('layoutInfo');
                if (layoutInfo) {
                    layoutInfo.textContent = `Layout: ${layout.rows} row${layout.rows !== 1 ? 's' : ''} × ${layout.cols} column${layout.cols !== 1 ? 's' : ''}`;
                }
                
                this.markChanged();
                this.renderStoryboard();
            };
            
            // Update max values when page size or orientation changes
            const updateMaxImagesPerPage = () => {
                const maxImages = this.getMaxImagesPerPage();
                imagesPerPageSlider.max = maxImages;
                imagesPerPageInput.max = maxImages;
                
                // Clamp current value if it exceeds new max
                if (this.project.settings.imagesPerPage > maxImages) {
                    updateImagesPerPage(maxImages);
                }
            };
            
            imagesPerPageSlider.addEventListener('input', (e) => {
                updateImagesPerPage(e.target.value);
            });
            
            imagesPerPageInput.addEventListener('change', (e) => {
                updateImagesPerPage(e.target.value);
            });
            
            // Set initial max values
            updateMaxImagesPerPage();
            
            document.getElementById('imageScale').addEventListener('input', (e) => {
                const scale = parseInt(e.target.value);
                this.project.settings.imageScale = scale;
                document.getElementById('imageScaleInput').value = scale;
                this.markChanged();
                this.renderStoryboard();
            });
            
            document.getElementById('imageScaleInput').addEventListener('change', (e) => {
                const scale = Math.max(50, Math.min(100, parseInt(e.target.value) || 100));
                this.project.settings.imageScale = scale;
                document.getElementById('imageScale').value = scale;
                e.target.value = scale;
                this.markChanged();
                this.renderStoryboard();
            });
            
            document.getElementById('showBottomText').addEventListener('change', (e) => {
                this.project.settings.showBottomText = e.target.checked;
                this.markChanged();
                this.renderStoryboard();
            });
            
            document.getElementById('enablePageNumbers').addEventListener('change', (e) => {
                this.project.settings.enablePageNumbers = e.target.checked;
                document.getElementById('pageNumberSettings').style.display = e.target.checked ? 'block' : 'none';
                this.markChanged();
                this.renderStoryboard();
            });
            
            // Text settings
            const fontSizeEl = document.getElementById('fontSize');
            if (fontSizeEl) {
                fontSizeEl.addEventListener('change', (e) => {
                    this.project.settings.fontSize = parseInt(e.target.value) || 12;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const lineHeightEl = document.getElementById('lineHeight');
            if (lineHeightEl) {
                lineHeightEl.addEventListener('change', (e) => {
                    this.project.settings.lineHeight = parseFloat(e.target.value) || 1.5;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const textColorEl = document.getElementById('textColor');
            if (textColorEl) {
                textColorEl.addEventListener('change', (e) => {
                    this.project.settings.textColor = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const textAlignEl = document.getElementById('textAlign');
            if (textAlignEl) {
                textAlignEl.addEventListener('change', (e) => {
                    this.project.settings.textAlign = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const fontFamilyEl = document.getElementById('fontFamily');
            if (fontFamilyEl) {
                fontFamilyEl.addEventListener('change', (e) => {
                    this.project.settings.fontFamily = e.target.value;
                    this.hasUnsavedChanges = true;
                    this.renderStoryboard();
                });
            }
            
            const pageTextEl = document.getElementById('pageText');
            if (pageTextEl) {
                pageTextEl.addEventListener('input', (e) => {
                    this.project.settings.pageText = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const pageBackgroundColorEl = document.getElementById('pageBackgroundColor');
            if (pageBackgroundColorEl) {
                pageBackgroundColorEl.addEventListener('change', (e) => {
                    this.project.settings.pageBackgroundColor = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            // Frame scale control
            const frameScaleEl = document.getElementById('frameScale');
            const frameScaleInputEl = document.getElementById('frameScaleInput');
            if (frameScaleEl && frameScaleInputEl) {
                frameScaleEl.addEventListener('input', (e) => {
                    const scale = Math.min(100, Math.max(10, parseInt(e.target.value) || 100));
                    this.project.settings.frameScale = scale;
                    frameScaleInputEl.value = scale;
                    this.markChanged();
                    console.log('Frame scale slider changed to:', scale);
                    this.updateFrameScale();
                });
                
                frameScaleInputEl.addEventListener('change', (e) => {
                    const scale = Math.min(100, Math.max(10, parseInt(e.target.value) || 100));
                    this.project.settings.frameScale = scale;
                    frameScaleEl.value = scale;
                    e.target.value = scale;
                    this.markChanged();
                    console.log('Frame scale input changed to:', scale);
                    this.updateFrameScale();
                });
            } else {
                console.error('Frame scale elements not found!', { frameScaleEl, frameScaleInputEl });
            }
            
            // Update max rows when page size or orientation changes
            document.getElementById('pageSize').addEventListener('change', () => {
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            document.getElementById('pageOrientation').addEventListener('change', () => {
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            document.getElementById('separateScenes').addEventListener('change', (e) => {
                this.project.settings.separateScenes = e.target.checked;
                this.markChanged();
                this.renderStoryboard();
            });
        } catch (error) {
            console.error('Error setting up settings event listeners:', error);
        }
        
        // Setup text settings event listeners
        this.setupTextSettings();
    }
    
    getFontWeights(fontFamily) {
        // Return available weights for different font families
        if (fontFamily.includes('Permanent Marker')) {
            return ['400']; // Only normal weight
        }
        if (fontFamily.includes('Kalam')) {
            return ['300', '400', '700']; // Kalam supports these weights
        }
        if (fontFamily.includes('Caveat')) {
            return ['400', '700']; // Caveat supports these weights
        }
        if (fontFamily.includes('Shadows Into Light') || fontFamily.includes('Dancing Script') ||
            fontFamily.includes('Pacifico')) {
            return ['400']; // Handwriting fonts typically only have normal
        }
        // Standard fonts support multiple weights
        return ['normal', 'bold', '100', '300', '400', '500', '700', '900'];
    }
    
    updateFontWeightOptions(fontFamilyId, weightSelectId) {
        const fontFamilyEl = document.getElementById(fontFamilyId);
        const weightSelectEl = document.getElementById(weightSelectId);
        if (!fontFamilyEl || !weightSelectEl) return;
        
        const fontFamily = fontFamilyEl.value;
        const availableWeights = this.getFontWeights(fontFamily);
        const currentValue = weightSelectEl.value;
        
        // Clear and repopulate
        weightSelectEl.innerHTML = '';
        availableWeights.forEach(weight => {
            const option = document.createElement('option');
            option.value = weight;
            option.textContent = weight === 'normal' ? 'Normal' : 
                                weight === 'bold' ? 'Bold' : 
                                weight === '100' ? 'Thin' :
                                weight === '300' ? 'Light' :
                                weight === '400' ? 'Regular' :
                                weight === '500' ? 'Medium' :
                                weight === '700' ? 'Bold' :
                                weight === '900' ? 'Black' : weight;
            if (weight === currentValue || (currentValue === '300' && weight === '400' && availableWeights.length === 1)) {
                option.selected = true;
            }
            weightSelectEl.appendChild(option);
        });
        
        // Update setting if current value is not available
        if (!availableWeights.includes(currentValue)) {
            const newWeight = availableWeights[0];
            weightSelectEl.value = newWeight;
            if (weightSelectId === 'pageFontWeight') {
                this.project.settings.pageFontWeight = newWeight;
            } else if (weightSelectId === 'frameFontWeight') {
                this.project.settings.frameFontWeight = newWeight;
            } else if (weightSelectId === 'shotFontWeight') {
                this.project.settings.shotFontWeight = newWeight;
            }
        }
    }
    
    setupTextSettings() {
        // Page text settings
        ['pageFontStyle', 'pageTextColor', 'pageTextAlign'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.project.settings[id] = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
        });
        
        // Page font family - update weight options when changed
        const pageFontFamilyEl = document.getElementById('pageFontFamily');
        if (pageFontFamilyEl) {
            pageFontFamilyEl.addEventListener('change', (e) => {
                this.project.settings.pageFontFamily = e.target.value;
                this.updateFontWeightOptions('pageFontFamily', 'pageFontWeight');
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Page font weight
        const pageFontWeightEl = document.getElementById('pageFontWeight');
        if (pageFontWeightEl) {
            pageFontWeightEl.addEventListener('change', (e) => {
                this.project.settings.pageFontWeight = e.target.value;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Page font size and line height (numeric)
        const pageFontSizeEl = document.getElementById('pageFontSize');
        if (pageFontSizeEl) {
            pageFontSizeEl.addEventListener('change', (e) => {
                this.project.settings.pageFontSize = parseInt(e.target.value) || 12;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        const pageLineHeightEl = document.getElementById('pageLineHeight');
        if (pageLineHeightEl) {
            pageLineHeightEl.addEventListener('change', (e) => {
                this.project.settings.pageLineHeight = parseFloat(e.target.value) || 1.5;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Frame text settings
        ['frameFontStyle', 'frameTextColor', 'frameTextAlign'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.project.settings[id] = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
        });
        
        // Frame font family - update weight options when changed
        const frameFontFamilyEl = document.getElementById('frameFontFamily');
        if (frameFontFamilyEl) {
            frameFontFamilyEl.addEventListener('change', (e) => {
                this.project.settings.frameFontFamily = e.target.value;
                this.updateFontWeightOptions('frameFontFamily', 'frameFontWeight');
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Frame font weight
        const frameFontWeightEl = document.getElementById('frameFontWeight');
        if (frameFontWeightEl) {
            frameFontWeightEl.addEventListener('change', (e) => {
                this.project.settings.frameFontWeight = e.target.value;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Frame font size (numeric)
        const frameFontSizeEl = document.getElementById('frameFontSize');
        if (frameFontSizeEl) {
            frameFontSizeEl.addEventListener('change', (e) => {
                this.project.settings.frameFontSize = parseInt(e.target.value) || 12;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Shot number settings
        ['shotTextColor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.project.settings[id] = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
        });
        
        // Shot font family - update weight options when changed
        const shotFontFamilyEl = document.getElementById('shotFontFamily');
        if (shotFontFamilyEl) {
            shotFontFamilyEl.addEventListener('change', (e) => {
                this.project.settings.shotFontFamily = e.target.value;
                this.updateFontWeightOptions('shotFontFamily', 'shotFontWeight');
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Shot circle scale control
        const shotCircleScaleEl = document.getElementById('shotCircleScale');
        const shotCircleScaleInputEl = document.getElementById('shotCircleScaleInput');
        if (shotCircleScaleEl && shotCircleScaleInputEl) {
            shotCircleScaleEl.addEventListener('input', (e) => {
                const scale = Math.min(200, Math.max(50, parseInt(e.target.value) || 100));
                this.project.settings.shotCircleScale = scale;
                shotCircleScaleInputEl.value = scale;
                this.markChanged();
                this.renderStoryboard();
            });
            
            shotCircleScaleInputEl.addEventListener('change', (e) => {
                const scale = Math.min(200, Math.max(50, parseInt(e.target.value) || 100));
                this.project.settings.shotCircleScale = scale;
                shotCircleScaleEl.value = scale;
                e.target.value = scale;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Shot font weight
        const shotFontWeightEl = document.getElementById('shotFontWeight');
        if (shotFontWeightEl) {
            shotFontWeightEl.addEventListener('change', (e) => {
                this.project.settings.shotFontWeight = e.target.value;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Shot font size (numeric)
        const shotFontSizeEl = document.getElementById('shotFontSize');
        if (shotFontSizeEl) {
            shotFontSizeEl.addEventListener('change', (e) => {
                this.project.settings.shotFontSize = parseInt(e.target.value) || 14;
                this.markChanged();
                this.renderStoryboard();
            });
        }
        
        // Initialize font weight options based on default fonts (after a short delay to ensure DOM is ready)
        setTimeout(() => {
            this.updateFontWeightOptions('pageFontFamily', 'pageFontWeight');
            this.updateFontWeightOptions('frameFontFamily', 'frameFontWeight');
            this.updateFontWeightOptions('shotFontFamily', 'shotFontWeight');
        }, 100);
    }
    
    setupModal() {
        const modal = document.getElementById('imageSettingsModal');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('imageSettingsCancel');
        const saveBtn = document.getElementById('imageSettingsSave');
        const removeBtn = document.getElementById('imageSettingsRemove');
        
        closeBtn.onclick = () => modal.style.display = 'none';
        cancelBtn.onclick = () => modal.style.display = 'none';
        saveBtn.onclick = () => this.saveImageSettings();
        removeBtn.onclick = () => this.removeImage();
        
        // Add image modal
        const addModal = document.getElementById('addImageModal');
        const addCloseBtn = addModal.querySelector('.modal-close');
        const addCancelBtn = document.getElementById('addImageCancel');
        const addSaveBtn = document.getElementById('addImageSave');
        
        addCloseBtn.onclick = () => addModal.style.display = 'none';
        addCancelBtn.onclick = () => addModal.style.display = 'none';
        addSaveBtn.onclick = () => this.addImage();
        
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
            if (e.target === addModal) addModal.style.display = 'none';
        };
        
        // Setup custom dialog
        this.setupCustomDialog();
    }
    
    setupCustomDialog() {
        const dialog = document.getElementById('customDialog');
        const yesBtn = document.getElementById('customDialogYes');
        const noBtn = document.getElementById('customDialogNo');
        const cancelBtn = document.getElementById('customDialogCancel');
        const input = document.getElementById('customDialogInput');
        
        // Close on backdrop click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.style.display = 'none';
            }
        });
        
        // Store callbacks
        this.customDialogResolve = null;
    }
    
    // Show toast notification
    showToast(message, type = 'success', duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastMessage) return;
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
    
    // Update project name in header
    updateProjectName() {
        const projectNameEl = document.getElementById('projectName');
        if (!projectNameEl) return;
        
        if (this.currentProjectPath) {
            // Remove .sbp extension and show just the name
            const name = this.currentProjectPath.replace(/\.sbp$/i, '');
            projectNameEl.textContent = name;
            projectNameEl.classList.add('has-project');
        } else {
            projectNameEl.textContent = 'No project open';
            projectNameEl.classList.remove('has-project');
        }
    }
    
    // Custom alert
    customAlert(message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            const input = document.getElementById('customDialogInput');
            
            title.textContent = 'Alert';
            messageEl.textContent = message;
            input.style.display = 'none';
            noBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            yesBtn.textContent = 'OK';
            yesBtn.style.display = 'block';
            
            yesBtn.onclick = () => {
                dialog.style.display = 'none';
                resolve(true);
            };
            
            dialog.style.display = 'block';
        });
    }
    
    // Custom confirm
    customConfirm(message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            const input = document.getElementById('customDialogInput');
            
            title.textContent = 'Confirm';
            messageEl.textContent = message;
            input.style.display = 'none';
            cancelBtn.style.display = 'none';
            yesBtn.textContent = 'Yes';
            noBtn.textContent = 'No';
            yesBtn.style.display = 'block';
            noBtn.style.display = 'block';
            
            yesBtn.onclick = () => {
                dialog.style.display = 'none';
                resolve(true);
            };
            
            noBtn.onclick = () => {
                dialog.style.display = 'none';
                resolve(false);
            };
            
            dialog.style.display = 'block';
        });
    }
    
    // Custom prompt
    customPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            const input = document.getElementById('customDialogInput');
            
            title.textContent = 'Prompt';
            messageEl.textContent = message;
            input.value = defaultValue;
            input.style.display = 'block';
            noBtn.style.display = 'none';
            cancelBtn.textContent = 'Cancel';
            yesBtn.textContent = 'OK';
            yesBtn.style.display = 'block';
            cancelBtn.style.display = 'block';
            
            const handleConfirm = () => {
                dialog.style.display = 'none';
                resolve(input.value);
            };
            
            const handleCancel = () => {
                dialog.style.display = 'none';
                resolve(null);
            };
            
            yesBtn.onclick = handleConfirm;
            cancelBtn.onclick = handleCancel;
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
            };
            
            dialog.style.display = 'block';
            setTimeout(() => input.focus(), 100);
        });
    }
    
    setupPanels() {
        // Panel toggle buttons
        document.getElementById('togglePageSettings').addEventListener('click', () => this.togglePanel('pageSettings'));
        document.getElementById('toggleTextSettings').addEventListener('click', () => this.togglePanel('textSettings'));
        document.getElementById('toggleDrawingPanel').addEventListener('click', () => this.togglePanel('drawingPanel'));
        
        // Panel close buttons
        document.getElementById('closePageSettings').addEventListener('click', () => this.closePanel('pageSettings'));
        document.getElementById('closeTextSettings').addEventListener('click', () => this.closePanel('textSettings'));
        document.getElementById('closeDrawingPanel').addEventListener('click', () => this.closePanel('drawingPanel'));
    }
    
    togglePanel(panelName) {
        // Handle panel names that already end with 'Panel'
        const panelId = panelName.endsWith('Panel') ? panelName : panelName + 'Panel';
        const panel = document.getElementById(panelId);
        if (!panel) {
            console.error('Panel not found:', panelId);
            return;
        }
        
        // Handle button ID - it's 'toggle' + capitalized panel name
        const btnId = 'toggle' + panelName.charAt(0).toUpperCase() + panelName.slice(1);
        const btn = document.getElementById(btnId);
        if (!btn) {
            console.error('Button not found:', btnId);
            return;
        }
        
        const mainContent = document.querySelector('.main-content');
        
        if (this.activePanel === panelName && panel.classList.contains('active')) {
            this.closePanel(panelName);
        } else {
            // Close other panels
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.toolbar-panel-btn').forEach(b => b.classList.remove('active'));
            
            // Open this panel
            panel.classList.add('active');
            btn.classList.add('active');
            mainContent.classList.add('panel-open');
            this.activePanel = panelName;
        }
    }
    
    closePanel(panelName) {
        const panelId = panelName.endsWith('Panel') ? panelName : panelName + 'Panel';
        const panel = document.getElementById(panelId);
        const btnId = 'toggle' + panelName.charAt(0).toUpperCase() + panelName.slice(1);
        const btn = document.getElementById(btnId);
        const mainContent = document.querySelector('.main-content');
        
        if (panel) panel.classList.remove('active');
        if (btn) btn.classList.remove('active');
        mainContent.classList.remove('panel-open');
        this.activePanel = null;
    }
    
    setupDrawing() {
        document.getElementById('enableDrawing').addEventListener('change', (e) => {
            this.project.settings.enableDrawing = e.target.checked;
            document.getElementById('drawingControls').style.display = e.target.checked ? 'block' : 'none';
            this.markChanged();
            this.renderStoryboard();
        });
        
        // Drawing tool selection - sync with new drawing system
        const updateDrawingTool = (tool) => {
            this.project.settings.drawingTool = tool;
            if (this.drawingSystem) {
                // Map tool names to drawing system tools
                let drawingTool = tool;
                if (tool === 'rectangle' && this.project.settings.fillShape) {
                    drawingTool = 'rectangle-fill';
                } else if (tool === 'circle' && this.project.settings.fillShape) {
                    drawingTool = 'circle-fill';
                }
                this.drawingSystem.setTool(drawingTool);
            }
        };
        
        // Tool button selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                updateDrawingTool(tool);
                document.getElementById('drawingTool').value = tool;
                
                // Update active state
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show/hide fill shape option
                const fillGroup = document.getElementById('fillShapeGroup');
                const fillColorGroup = document.getElementById('fillColorGroup');
                if (fillGroup) {
                    fillGroup.style.display = (tool === 'rectangle' || tool === 'circle') ? 'block' : 'none';
                }
                if (fillColorGroup) {
                    fillColorGroup.style.display = (tool === 'rectangle' || tool === 'circle') && this.project.settings.fillShape ? 'block' : 'none';
                }
                
                this.markChanged();
            });
        });
        
        // Sync select with buttons
        document.getElementById('drawingTool').addEventListener('change', (e) => {
            const tool = e.target.value;
            updateDrawingTool(tool);
            document.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tool === tool);
            });
            const fillGroup = document.getElementById('fillShapeGroup');
            const fillColorGroup = document.getElementById('fillColorGroup');
            if (fillGroup) {
                fillGroup.style.display = (tool === 'rectangle' || tool === 'circle') ? 'block' : 'none';
            }
            if (fillColorGroup) {
                fillColorGroup.style.display = (tool === 'rectangle' || tool === 'circle') && this.project.settings.fillShape ? 'block' : 'none';
            }
            this.markChanged();
        });
        
        // Brush size with number input - sync with new drawing system
        const brushSize = document.getElementById('brushSize');
        const brushSizeInput = document.getElementById('brushSizeInput');
        if (brushSize && brushSizeInput) {
            const updateBrushSize = (value) => {
                this.project.settings.brushSize = value;
                if (this.drawingSystem) {
                    this.drawingSystem.setBrushSize(value);
                }
            };
            
            brushSize.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                brushSizeInput.value = value;
                updateBrushSize(value);
            });
            brushSizeInput.addEventListener('change', (e) => {
                const value = Math.max(1, Math.min(50, parseInt(e.target.value) || 5));
                brushSize.value = value;
                brushSizeInput.value = value;
                updateBrushSize(value);
            });
        }
        
        // Smoothing with number input
        const brushSmoothing = document.getElementById('brushSmoothing');
        const brushSmoothingInput = document.getElementById('brushSmoothingInput');
        if (brushSmoothing && brushSmoothingInput) {
            brushSmoothing.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                brushSmoothingInput.value = value;
                this.project.settings.brushSmoothing = value;
                this.markChanged();
            });
            brushSmoothingInput.addEventListener('change', (e) => {
                const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 50));
                brushSmoothing.value = value;
                brushSmoothingInput.value = value;
                this.project.settings.brushSmoothing = value;
                this.markChanged();
            });
        }
        
        // Color inputs - sync with new drawing system
        const brushColor = document.getElementById('brushColor');
        if (brushColor) {
            const updateBrushColor = (value) => {
                this.project.settings.brushColor = value;
                if (this.drawingSystem) {
                    this.drawingSystem.setBrushColor(value);
                }
            };
            
            brushColor.addEventListener('input', (e) => {
                updateBrushColor(e.target.value);
            });
        }
        
        const fillColor = document.getElementById('fillColor');
        if (fillColor) {
            const updateFillColor = (value) => {
                this.project.settings.fillColor = value;
                if (this.drawingSystem && value !== 'transparent') {
                    this.drawingSystem.setFillColor(value);
                }
            };
            
            fillColor.addEventListener('input', (e) => {
                updateFillColor(e.target.value);
            });
        }
        
        document.getElementById('fillShape').addEventListener('change', (e) => {
            this.project.settings.fillShape = e.target.checked;
            // Update tool if rectangle or circle is selected
            const currentTool = this.project.settings.drawingTool || 'brush';
            if (currentTool === 'rectangle' || currentTool === 'circle') {
                updateDrawingTool(currentTool);
            }
            this.markChanged();
        });
        
        // Make updateDrawingTool available in this scope
        this.updateDrawingTool = updateDrawingTool;
        
        // Drawing controls - use new drawing system
        const undoBtn = document.getElementById('undoDrawing');
        const redoBtn = document.getElementById('redoDrawing');
        const clearBtn = document.getElementById('clearPageDrawing');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                const activePage = document.querySelector('.storyboard-page:has(.drawing-canvas)');
                if (activePage && this.drawingSystem) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    this.drawingSystem.undo(pageIndex);
                }
            });
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                const activePage = document.querySelector('.storyboard-page:has(.drawing-canvas)');
                if (activePage && this.drawingSystem) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    this.drawingSystem.redo(pageIndex);
                }
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const activePage = document.querySelector('.storyboard-page:has(.drawing-canvas)');
                if (activePage && this.drawingSystem) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    this.drawingSystem.clear(pageIndex);
                    this.renderStoryboard();
                }
            });
        }
        
        document.getElementById('clearDrawing').addEventListener('click', async () => {
            const confirmed = await this.customConfirm('Clear all drawings?');
            if (confirmed) {
                this.project.drawings = {};
                this.markChanged();
                this.renderStoryboard();
            }
        });
        
        // Set initial tool button active state
        const initialTool = this.project.settings.drawingTool || 'brush';
        const drawingToolSelect = document.getElementById('drawingTool');
        if (drawingToolSelect) {
            drawingToolSelect.value = initialTool;
        }
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === initialTool);
        });
        const fillGroup = document.getElementById('fillShapeGroup');
        const fillColorGroup = document.getElementById('fillColorGroup');
        if (fillGroup) {
            fillGroup.style.display = (initialTool === 'rectangle' || initialTool === 'circle') ? 'block' : 'none';
        }
        if (fillColorGroup) {
            fillColorGroup.style.display = (initialTool === 'rectangle' || initialTool === 'circle') && this.project.settings.fillShape ? 'block' : 'none';
        }
        
        // Initialize drawing system tool
        if (this.drawingSystem) {
            updateDrawingTool(initialTool);
        }
    }
    
    setupCoverPage() {
        document.getElementById('enableCoverPage').addEventListener('change', (e) => {
            this.project.settings.enableCoverPage = e.target.checked;
            document.getElementById('coverPageSettings').style.display = e.target.checked ? 'block' : 'none';
            this.hasUnsavedChanges = true;
            this.renderStoryboard();
        });
        
        document.getElementById('coverPageLogoBtn').addEventListener('click', () => {
            document.getElementById('coverPageLogo').click();
        });
        
        document.getElementById('coverPageLogo').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.project.settings.coverPageLogo = event.target.result;
                    document.getElementById('coverPageLogoPreview').innerHTML = `<img src="${event.target.result}" alt="Logo">`;
                    this.hasUnsavedChanges = true;
                    this.renderStoryboard();
                };
                reader.readAsDataURL(file);
            }
        });
        
        ['coverPageTitle', 'coverPageYear', 'coverPageCreators'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.project.settings[id] = e.target.value;
                this.markChanged();
                this.renderStoryboard();
            });
        });
        
        // Cover page font settings
        ['coverPageTitleFontSize', 'coverPageTitleColor', 'coverPageYearFontSize', 'coverPageYearColor', 
         'coverPageCreatorsFontSize', 'coverPageCreatorsColor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.project.settings[id] = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
        });
    }
    
    setupWatermark() {
        document.getElementById('enableWatermark').addEventListener('change', (e) => {
            this.project.settings.enableWatermark = e.target.checked;
            document.getElementById('watermarkSettings').style.display = e.target.checked ? 'block' : 'none';
            this.hasUnsavedChanges = true;
            this.renderStoryboard();
        });
        
        document.getElementById('watermarkType').addEventListener('change', (e) => {
            this.project.settings.watermarkType = e.target.value;
            document.getElementById('watermarkTextSettings').style.display = e.target.value === 'text' ? 'block' : 'none';
            document.getElementById('watermarkImageSettings').style.display = e.target.value === 'image' ? 'block' : 'none';
            this.hasUnsavedChanges = true;
            this.renderStoryboard();
        });
        
        document.getElementById('watermarkImageBtn').addEventListener('click', () => {
            document.getElementById('watermarkImage').click();
        });
        
        document.getElementById('watermarkImage').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.project.settings.watermarkImage = event.target.result;
                    document.getElementById('watermarkImagePreview').innerHTML = `<img src="${event.target.result}" alt="Watermark">`;
                    this.hasUnsavedChanges = true;
                    this.renderStoryboard();
                };
                reader.readAsDataURL(file);
            }
        });
        
        document.getElementById('watermarkText').addEventListener('input', (e) => {
            this.project.settings.watermarkText = e.target.value;
            this.hasUnsavedChanges = true;
            this.renderStoryboard();
        });
        
        document.getElementById('watermarkOpacity').addEventListener('input', (e) => {
            this.project.settings.watermarkOpacity = parseInt(e.target.value);
            document.getElementById('watermarkOpacityValue').textContent = e.target.value + '%';
            this.hasUnsavedChanges = true;
            this.renderStoryboard();
        });
    }
    
    updateScaleDisplay() {
        const scale = this.project.settings.imageScale;
        document.getElementById('imageScaleInput').value = scale;
        document.getElementById('imageScale').value = scale;
    }
    
    markChanged() {
        this.hasUnsavedChanges = true;
        // Debounce auto-save to avoid performance issues
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveToStorage(true); // Auto-save temp after delay
        }, 1000); // Wait 1 second after last change
    }
    
    /**
     * Calculate optimal rows and columns based on images per page and page dimensions
     * Uses a simple, robust approach: divide available space proportionally
     * and test which layouts actually fit
     */
    calculateOptimalLayout(imagesPerPage) {
        const pageSize = this.pageSizes[this.project.settings.pageSize];
        const orientation = this.project.settings.orientation;
        
        // Get page dimensions in mm
        const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
        
        // Convert mm to pixels for calculation (1mm = 3.779527559px at 96dpi)
        const mmToPx = 3.779527559;
        const pageWidthPx = pageWidthMm * mmToPx;
        const pageHeightPx = pageHeightMm * mmToPx;
        
        // Page padding in pixels (5mm = ~18.9px)
        const pagePaddingPx = 5 * mmToPx;
        
        // Header text space in pixels (~20mm = ~75.6px)
        const headerTextSpacePx = this.project.settings.pageText ? 20 * mmToPx : 0;
        
        // Available space for grid
        const availableWidthPx = pageWidthPx - (pagePaddingPx * 2);
        const availableHeightPx = pageHeightPx - (pagePaddingPx * 2) - headerTextSpacePx;
        
        // CSS gap between frames (20px from CSS)
        const gapPx = 20;
        
        // Frame component heights in pixels (from actual CSS - using realistic estimates)
        // Shot number: margin-bottom 10px + rectangle with padding ~25px = 35px
        const shotNumberHeightPx = 35;
        // Frame text: min-height 60px + padding 16px + margin 5px = 81px
        const frameTextTotalPx = 81;
        // Margins between components: margin-bottom on image container 10px + other spacing ~15px
        const componentMarginsPx = 25;
        
        // Image scale factor
        const imageScale = (this.project.settings.imageScale || 100) / 100;
        
        // Minimum frame width in pixels (to ensure readability)
        // Reduced to allow more columns when needed
        const MIN_FRAME_WIDTH_PX = 80;
        
        // Calculate maximum possible columns
        const maxCols = Math.floor((availableWidthPx + gapPx) / (MIN_FRAME_WIDTH_PX + gapPx));
        
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
            if (frameWidthPx < MIN_FRAME_WIDTH_PX) continue;
            
            // Calculate image height based on frame width
            // Most storyboard images are landscape (16:9 or 4:3)
            // Use 0.5 as a more realistic estimate (height = 50% of width for landscape)
            // This allows more layouts to be considered valid
            const imageHeightPx = frameWidthPx * 0.5 * imageScale;
            
            // Calculate total frame height
            const frameHeightPx = shotNumberHeightPx + imageHeightPx + frameTextTotalPx + componentMarginsPx;
            
            // Calculate total height needed for all rows
            const totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;
            
            // Skip if it doesn't fit vertically (with 5px tolerance for rounding and CSS variations)
            // Less conservative to allow more valid layouts
            if (totalHeightNeededPx > availableHeightPx - 5) continue;
            
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
        
        // Score and rank layouts
        // Priority order:
        // 1. Prefer more rows (vertical layouts) when space allows - VERY STRONG preference
        // 2. Minimize unused slots
        // 3. Prefer better space utilization (use available space well)
        // 4. Prefer layouts closer to square aspect ratio (but less important)
        validLayouts.forEach(layout => {
            // Much stronger preference for more rows - this is the primary factor
            // For landscape, we especially want to avoid single-row layouts when possible
            const rowScore = layout.rows * 25; // Very strong preference for more rows
            
            // Penalty for unused slots
            const unusedPenalty = layout.unusedSlots * 10;
            
            // Bonus for using space well (but not too tight)
            const utilizationBonus = Math.min(layout.spaceUtilization, 0.92) * 3;
            
            // Small penalty for very non-square layouts (but rows are more important)
            const aspectPenalty = Math.abs(layout.aspectRatio - 1) * 0.5;
            
            // Extra bonus for layouts with 2+ rows (to avoid single-row when possible)
            const multiRowBonus = layout.rows >= 2 ? 20 : 0;
            
            layout.score = rowScore - unusedPenalty + utilizationBonus - aspectPenalty + multiRowBonus;
        });
        
        // Sort by score (highest first)
        validLayouts.sort((a, b) => b.score - a.score);
        
        // Return the best layout
        const best = validLayouts[0];
        return { rows: best.rows, cols: best.cols };
    }
    
    /**
     * Get maximum images per page based on page size and orientation
     * These limits prevent layout from breaking with too many images
     */
    getMaxImagesPerPage() {
        const pageSize = this.project.settings.pageSize;
        const orientation = this.project.settings.orientation;
        
        // Define limits for each page size and orientation
        const limits = {
            'A4': {
                'portrait': 9,
                'landscape': 10
            },
            'A3': {
                'portrait': 12,
                'landscape': 15
            },
            'Letter': {
                'portrait': 9,
                'landscape': 10
            },
            'Legal': {
                'portrait': 12,
                'landscape': 12
            },
            'Tabloid': {
                'portrait': 15,
                'landscape': 18
            }
        };
        
        return limits[pageSize]?.[orientation] || 12; // Default to 12 if not found
    }
    
    // Legacy functions kept for compatibility but now use calculateOptimalLayout
    getMaxRows() {
        const maxImages = this.getMaxImagesPerPage();
        const layout = this.calculateOptimalLayout(maxImages);
        return layout.rows;
    }
    
    getMaxCols() {
        const maxImages = this.getMaxImagesPerPage();
        const layout = this.calculateOptimalLayout(maxImages);
        return layout.cols;
    }
    
    updateFrameScale() {
        // Update scale on frames in real-time
        const frames = document.querySelectorAll('.storyboard-frame');
        const scale = this.project.settings.frameScale || 100;
        const scaleValue = scale / 100;
        
        console.log(`updateFrameScale: Found ${frames.length} frames, scale=${scale}% (${scaleValue})`);
        
        frames.forEach((frame, index) => {
            frame.style.transform = `scale(${scaleValue})`;
            frame.style.transformOrigin = 'center';
            
            if (index === 0) {
                console.log(`Frame 0 transform applied: ${frame.style.transform}`);
            }
        });
    }
    
    updateLayoutInfo() {
        // Update the layout info display when page settings change
        const imagesPerPage = this.project.settings.imagesPerPage || 6;
        const layout = this.calculateOptimalLayout(imagesPerPage);
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            layoutInfo.textContent = `Layout: ${layout.rows} row${layout.rows !== 1 ? 's' : ''} × ${layout.cols} column${layout.cols !== 1 ? 's' : ''}`;
        }
    }
    
    
    newProject() {
        this.project = {
            images: [],
            settings: {
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
                coverPageTitleFontSize: 48,
                coverPageTitleColor: '#000000',
                coverPageYear: '',
                coverPageYearFontSize: 24,
                coverPageYearColor: '#666666',
                coverPageCreators: '',
                coverPageCreatorsFontSize: 18,
                coverPageCreatorsColor: '#333333',
                coverPageLogo: null,
                enableWatermark: false,
                watermarkType: 'text',
                watermarkText: '',
                watermarkImage: null,
                watermarkOpacity: 30,
                enableDrawing: false,
                drawingTool: 'brush',
                brushSize: 5,
                brushSmoothing: 50,
                brushColor: '#e6edf3',
                fillColor: 'transparent',
                fillShape: false,
                enablePageNumbers: false,
                pageNumberPosition: 'bottom-center',
                pageNumberFontSize: 12,
                pageNumberColor: '#000000',
                // Text settings
                pageFontFamily: "'Kalam', cursive",
                pageFontSize: 12,
                pageFontWeight: '400',
                pageFontStyle: 'normal',
                pageLineHeight: 1.5,
                pageTextColor: '#b4b4b4',
                pageTextAlign: 'left',
                frameFontFamily: "'Kalam', cursive",
                frameFontSize: 12,
                frameFontWeight: '400',
                frameFontStyle: 'normal',
                frameTextColor: '#b4b4b4',
                frameTextAlign: 'left',
                shotFontFamily: "'Kalam', cursive",
                shotFontSize: 14,
                shotFontWeight: 'bold',
                shotTextColor: '#ebebeb',
                shotCircleScale: 100,
                frameScale: 100
            },
            frameTexts: {},
            pageTexts: {},
            imageScenes: {},
            drawings: {},
            activePanel: null
        };
        this.hasUnsavedChanges = false;
        this.resetUI();
        this.renderStoryboard();
    }
    
    resetUI() {
        const pageOrientation = document.getElementById('pageOrientation');
        const pageSize = document.getElementById('pageSize');
        const imagesPerPage = document.getElementById('imagesPerPage');
        const imagesPerPageInput = document.getElementById('imagesPerPageInput');
        const imageScale = document.getElementById('imageScale');
        const imageScaleInput = document.getElementById('imageScaleInput');
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const lineHeight = document.getElementById('lineHeight');
        const textColor = document.getElementById('textColor');
        const textAlign = document.getElementById('textAlign');
        const pageText = document.getElementById('pageText');
        const pageBackgroundColor = document.getElementById('pageBackgroundColor');
        const frameScale = document.getElementById('frameScale');
        const frameScaleInput = document.getElementById('frameScaleInput');
        const separateScenes = document.getElementById('separateScenes');
        const showBottomText = document.getElementById('showBottomText');
        const enableCoverPage = document.getElementById('enableCoverPage');
        const coverPageTitle = document.getElementById('coverPageTitle');
        const coverPageTitleFontSize = document.getElementById('coverPageTitleFontSize');
        const coverPageTitleColor = document.getElementById('coverPageTitleColor');
        const coverPageYear = document.getElementById('coverPageYear');
        const coverPageYearFontSize = document.getElementById('coverPageYearFontSize');
        const coverPageYearColor = document.getElementById('coverPageYearColor');
        const coverPageCreators = document.getElementById('coverPageCreators');
        const coverPageCreatorsFontSize = document.getElementById('coverPageCreatorsFontSize');
        const coverPageCreatorsColor = document.getElementById('coverPageCreatorsColor');
        const enableWatermark = document.getElementById('enableWatermark');
        const watermarkType = document.getElementById('watermarkType');
        const watermarkText = document.getElementById('watermarkText');
        const watermarkOpacity = document.getElementById('watermarkOpacity');
        const enableDrawing = document.getElementById('enableDrawing');
        
        if (pageOrientation) pageOrientation.value = 'landscape';
        if (pageSize) pageSize.value = 'A4';
        const maxImages = this.getMaxImagesPerPage();
        if (imagesPerPage) {
            imagesPerPage.max = maxImages;
            imagesPerPage.value = 6;
        }
        if (imagesPerPageInput) {
            imagesPerPageInput.max = maxImages;
            imagesPerPageInput.value = 6;
        }
        const layout = this.calculateOptimalLayout(6);
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            layoutInfo.textContent = `Layout: ${layout.rows} row${layout.rows !== 1 ? 's' : ''} × ${layout.cols} column${layout.cols !== 1 ? 's' : ''}`;
        }
        if (imageScale) imageScale.value = 100;
        if (imageScaleInput) imageScaleInput.value = 100;
        if (fontFamily) fontFamily.value = 'Arial, sans-serif';
        if (fontSize) fontSize.value = 12;
        if (lineHeight) lineHeight.value = 1.5;
        if (textColor) textColor.value = '#000000';
        if (textAlign) textAlign.value = 'left';
        if (pageText) pageText.value = '';
        if (pageBackgroundColor) pageBackgroundColor.value = '#404040';
        if (frameScale) frameScale.value = 100;
        if (frameScaleInput) frameScaleInput.value = 100;
        if (document.getElementById('pageTextColor')) document.getElementById('pageTextColor').value = '#b4b4b4';
        if (document.getElementById('frameTextColor')) document.getElementById('frameTextColor').value = '#b4b4b4';
        if (document.getElementById('shotTextColor')) document.getElementById('shotTextColor').value = '#ebebeb';
        if (document.getElementById('shotCircleScale')) document.getElementById('shotCircleScale').value = 100;
        if (document.getElementById('shotCircleScaleInput')) document.getElementById('shotCircleScaleInput').value = 100;
        if (separateScenes) separateScenes.checked = false;
        if (showBottomText) showBottomText.checked = true;
        if (enableCoverPage) enableCoverPage.checked = false;
        if (coverPageTitle) coverPageTitle.value = '';
        if (coverPageTitleFontSize) coverPageTitleFontSize.value = 48;
        if (coverPageTitleColor) coverPageTitleColor.value = '#000000';
        if (coverPageYear) coverPageYear.value = '';
        if (coverPageYearFontSize) coverPageYearFontSize.value = 24;
        if (coverPageYearColor) coverPageYearColor.value = '#666666';
        if (coverPageCreators) coverPageCreators.value = '';
        if (coverPageCreatorsFontSize) coverPageCreatorsFontSize.value = 18;
        if (coverPageCreatorsColor) coverPageCreatorsColor.value = '#333333';
        if (enableWatermark) enableWatermark.checked = false;
        if (watermarkType) watermarkType.value = 'text';
        if (watermarkText) watermarkText.value = '';
        if (watermarkOpacity) watermarkOpacity.value = 30;
        if (enableDrawing) enableDrawing.checked = false;
        this.updateScaleDisplay();
        this.updateLayoutInfo();
    }
    
    async importImages(event) {
        if (!event || !event.target || !event.target.files) {
            console.error('importImages: Invalid event or missing files');
            return;
        }
        
        const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        console.log(`importImages: Found ${files.length} image files`);
        
        if (files.length === 0) {
            await this.customAlert('No image files found in the selected folder.');
            return;
        }
        
        // Store folder path for reload
        if (event.target.files.length > 0) {
            this.imageFolderPath = event.target.files[0].webkitRelativePath.split('/')[0] || null;
        }
        
        // Store directory handle if using File System Access API
        // Note: With file input, we can't get a directory handle directly
        // The handle will be obtained when opening a project
        
        // Sort files by name (preserving full filename)
        files.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        // Load images, filtering out removed ones
        const imagePromises = files
            .filter(file => !this.removedImages.has(file.name))
            .map((file, index) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // Extract frame number from filename (remove extension)
                        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
                        
                        const existingScene = this.project.imageScenes[file.name] || '';
                        // Only preserve shot number if image already exists, otherwise leave empty
                        const existingImage = this.project.images.find(img => img.name === file.name);
                        const existingShot = existingImage ? (existingImage.shotNumber || '') : '';
                        resolve({
                            name: file.name,
                            originalName: file.name,
                            url: e.target.result,
                            sceneNumber: existingScene,
                            shotNumber: existingShot, // Empty for new images, preserved for existing
                            frameNumber: fileName, // Auto-populated from filename (not shot number)
                            scene: existingScene, // Keep for backward compatibility
                            filePath: file.webkitRelativePath || file.name
                        });
                    };
                    reader.readAsDataURL(file);
                });
            });
        
        const newImages = await Promise.all(imagePromises);
        
        // Verify all images have URLs
        newImages.forEach(img => {
            if (!img.url) {
                console.error('Image loaded without URL:', img.name);
            }
        });
        
        // Check if we're reloading images for an existing project (images need reload)
        const isReloading = this.imagesNeedReload && this.pendingImageMetadata;
        
        // Merge with existing images, preserving existing data
        const isFirstImport = this.project.images.length === 0 || isReloading;
        const existingImagesMap = new Map();
        
        if (!isFirstImport) {
            // Build map of existing images
            this.project.images.forEach(img => {
                existingImagesMap.set(img.name, img);
            });
            
            // Update existing images with new URLs, preserve scene/shot/frame numbers
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
        } else if (isReloading && this.pendingImageMetadata) {
            // Reloading images - merge metadata with new image URLs
            const metadataMap = new Map();
            this.pendingImageMetadata.forEach(meta => {
                metadataMap.set(meta.name, meta);
            });
            
            newImages.forEach(newImg => {
                const metadata = metadataMap.get(newImg.name);
                if (metadata) {
                    // Restore metadata from saved project
                    newImg.sceneNumber = metadata.sceneNumber || '';
                    newImg.shotNumber = metadata.shotNumber || '';
                    newImg.frameNumber = metadata.frameNumber || '';
                    newImg.scene = metadata.scene || metadata.sceneNumber || '';
                }
            });
            
            // Clear reload flags
            this.imagesNeedReload = false;
            this.pendingImageMetadata = null;
        }
        
        // Determine final image list
        let imagesToKeep;
        if (isFirstImport) {
            // First import - just add all new images
            imagesToKeep = newImages;
        } else {
            // Reload - preserve manually added images, update/remove folder images
            const newImageNames = new Set(newImages.map(img => img.name));
            imagesToKeep = Array.from(existingImagesMap.values()).filter(img => {
                // Keep if it's in the new folder OR if it was manually added (no filePath)
                return newImageNames.has(img.name) || !img.filePath;
            });
        }
        
        this.project.images = imagesToKeep.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        console.log(`Loaded ${newImages.length} new images. Total images after merge: ${this.project.images.length}`);
        console.log('First import?', this.project.images.length === newImages.length);
        
        if (this.project.images.length === 0) {
            console.error('No images were added! Check the import logic.');
        }
        
        this.project.images.forEach((img, idx) => {
            if (!img.url) {
                console.error(`Image ${idx} (${img.name}) missing URL:`, img);
            } else {
                console.log(`Image ${idx}: name=${img.name}, scene=${img.sceneNumber || 'none'}, shot=${img.shotNumber || 'none'}, frame=${img.frameNumber || 'none'}`);
            }
        });
        
        this.markChanged();
        this.renderStoryboard();
    }
    
    
    zoom(factor) {
        this.zoomLevel = Math.max(0.25, Math.min(3.0, this.zoomLevel * factor));
        this.applyZoom();
    }
    
    zoomFit() {
        const container = document.getElementById('storyboardContainer');
        const pages = container.querySelectorAll('.storyboard-page');
        if (pages.length === 0) return;
        
        const firstPage = pages[0];
        const pageWidth = firstPage.offsetWidth;
        const containerWidth = container.offsetWidth - 40; // Account for padding
        this.zoomLevel = containerWidth / pageWidth;
        this.applyZoom();
    }
    
    applyZoom() {
        const container = document.getElementById('storyboardContainer');
        container.style.transform = `scale(${this.zoomLevel})`;
        container.style.transformOrigin = 'top center';
        const zoomInput = document.getElementById('zoomLevel');
        if (zoomInput) {
            zoomInput.value = Math.round(this.zoomLevel * 100);
        }
    }
    
    renderStoryboard() {
        const container = document.getElementById('storyboardContainer');
        
        // Preserve drawings before clearing
        const preservedDrawings = { ...this.project.drawings };
        
        if (this.project.images.length === 0) {
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
        this.project.drawings = preservedDrawings;
        
        const imagesPerPage = this.project.settings.imagesPerPage || 6;
        const layout = this.calculateOptimalLayout(imagesPerPage);
        const rows = layout.rows;
        const cols = layout.cols;
        const orientation = this.project.settings.orientation;
        const pageSize = this.pageSizes[this.project.settings.pageSize];
        const fontFamily = this.project.settings.fontFamily;
        const pageText = this.project.settings.pageText;
        const pageBgColor = this.project.settings.pageBackgroundColor;
        const scale = this.project.settings.imageScale / 100;
        const separateScenes = this.project.settings.separateScenes;
        
        console.log('Rendering storyboard with', this.project.images.length, 'images');
        this.project.images.forEach((img, idx) => {
            console.log(`Image ${idx}: name=${img.name}, hasURL=${!!img.url}, urlLength=${img.url ? img.url.length : 0}`);
        });
        
        // Determine if handwriting font
        const isHandwriting = fontFamily.includes('Kalam') || 
                             fontFamily.includes('Caveat') || 
                             fontFamily.includes('Permanent Marker') || 
                             fontFamily.includes('Shadows Into Light');
        
        // Group images by scene if separation is enabled
        let imageGroups = [];
        if (separateScenes) {
            const sceneGroups = {};
            this.project.images.forEach(image => {
                const scene = this.project.imageScenes[image.name] || 'Unassigned';
                if (!sceneGroups[scene]) {
                    sceneGroups[scene] = [];
                }
                sceneGroups[scene].push(image);
            });
            imageGroups = Object.values(sceneGroups);
        } else {
            imageGroups = [this.project.images];
        }
        
        // Create cover page if enabled
        if (this.project.settings.enableCoverPage) {
            const coverPage = this.createCoverPage(orientation, pageSize, fontFamily, pageBgColor);
            container.appendChild(coverPage);
        }
        
        // Create pages for each group
        let globalPageIndex = this.project.settings.enableCoverPage ? 1 : 0;
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
                    globalPageIndex++
                );
                container.appendChild(page);
            }
        });
        
        // Apply frame scale to all frames after rendering
        this.updateFrameScale();
    }
    
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
        page.dataset.pageWidth = pageWidthMm; // Store actual mm width for PDF
        page.dataset.pageHeight = pageHeightMm; // Store actual mm height for PDF
        page.dataset.scale = scaleFactor; // Store scale factor for zoom
        
        // Global page text at top (header)
        const globalPageText = this.project.settings.pageText || '';
        if (globalPageText) {
            const pageTextEl = document.createElement('div');
            pageTextEl.className = 'page-text';
            pageTextEl.textContent = globalPageText;
            pageTextEl.style.fontFamily = this.project.settings.pageFontFamily || "'Kalam', cursive";
            pageTextEl.style.fontSize = (this.project.settings.pageFontSize || 12) + 'px';
            pageTextEl.style.fontWeight = this.project.settings.pageFontWeight || '400';
            pageTextEl.style.fontStyle = this.project.settings.pageFontStyle || 'normal';
            pageTextEl.style.color = this.project.settings.pageTextColor || '#b4b4b4';
            pageTextEl.style.textAlign = this.project.settings.pageTextAlign || 'left';
            pageTextEl.style.lineHeight = (this.project.settings.pageLineHeight || 1.5).toString();
            pageTextEl.style.marginBottom = '10px';
            pageTextEl.style.flexShrink = 0; // Don't shrink header
            page.appendChild(pageTextEl);
        }
        
        // Image grid container (flex-grow to fill available space)
        const gridContainer = document.createElement('div');
        gridContainer.style.flex = '1 1 auto';
        gridContainer.style.display = 'flex';
        gridContainer.style.flexDirection = 'column';
        gridContainer.style.minHeight = 0; // Important for flex children
        
        // Image grid
        const grid = document.createElement('div');
        grid.className = 'image-grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        // Use auto for rows so they don't stretch - images maintain fixed distance
        grid.style.gridTemplateRows = `repeat(${rows}, auto)`;
        grid.style.flex = '1 1 auto'; // Fill available space
        grid.style.minHeight = 0; // Important for grid
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
                this.currentEditingImageIndex = this.project.images.findIndex(img => img.name === image.name);
                document.getElementById('addImageModal').style.display = 'block';
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
                    this.currentEditingImageIndex = this.project.images.findIndex(img => img.name === lastImage.name);
                } else {
                    this.currentEditingImageIndex = -1;
                }
                document.getElementById('addImageModal').style.display = 'block';
            });
            emptySlot.appendChild(addBtn);
            grid.appendChild(emptySlot);
        }
        
        gridContainer.appendChild(grid);
        page.appendChild(gridContainer);
        
        // Per-page custom text at bottom (footer) - doesn't affect image layout
        if (this.project.settings.showBottomText) {
            const pageTextBottom = document.createElement('textarea');
            pageTextBottom.className = 'page-text-bottom';
            pageTextBottom.placeholder = 'Enter custom text for this page...';
            pageTextBottom.value = this.project.pageTexts[pageIndex] || '';
            pageTextBottom.style.fontFamily = this.project.settings.pageFontFamily || "'Kalam', cursive";
            pageTextBottom.style.fontSize = (this.project.settings.pageFontSize || 12) + 'px';
            pageTextBottom.style.fontWeight = this.project.settings.pageFontWeight || '400';
            pageTextBottom.style.fontStyle = this.project.settings.pageFontStyle || 'normal';
            pageTextBottom.style.color = this.project.settings.pageTextColor || '#b4b4b4';
            pageTextBottom.style.textAlign = this.project.settings.pageTextAlign || 'left';
            pageTextBottom.style.lineHeight = (this.project.settings.pageLineHeight || 1.5).toString();
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
                this.project.pageTexts[pageIndex] = e.target.value;
                clearTimeout(textTimeout);
                textTimeout = setTimeout(() => {
                    this.markChanged();
                }, 500); // Save 500ms after typing stops
            });
            page.appendChild(pageTextBottom);
        }
        
        // Add page number if enabled
        if (this.project.settings.enablePageNumbers) {
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = (pageIndex + 1).toString();
            pageNumber.style.position = 'absolute';
            pageNumber.style.fontSize = (this.project.settings.pageNumberFontSize || 12) + 'px';
            // Use a visible color - white if page background is dark, black if light
            const pageBgColor = this.project.settings.pageBackgroundColor || '#404040';
            const isDarkBg = this.isColorDark(pageBgColor);
            const defaultColor = isDarkBg ? '#ffffff' : '#000000';
            pageNumber.style.color = this.project.settings.pageNumberColor || defaultColor;
            pageNumber.style.fontWeight = 'bold';
            pageNumber.style.zIndex = '100';
            pageNumber.style.pointerEvents = 'none';
            
            const position = this.project.settings.pageNumberPosition || 'bottom-center';
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
            console.log('Page number added:', pageIndex + 1, 'at position:', position, 'color:', pageNumber.style.color);
        } else {
            console.log('Page numbers disabled');
        }
        
        // Add watermark if enabled
        if (this.project.settings.enableWatermark) {
            const watermark = document.createElement('div');
            watermark.className = this.project.settings.watermarkType === 'text' ? 'page-watermark' : 'page-watermark-image';
            watermark.style.opacity = this.project.settings.watermarkOpacity / 100;
            
            if (this.project.settings.watermarkType === 'text' && this.project.settings.watermarkText) {
                watermark.textContent = this.project.settings.watermarkText;
            } else if (this.project.settings.watermarkType === 'image' && this.project.settings.watermarkImage) {
                const watermarkImg = document.createElement('img');
                watermarkImg.src = this.project.settings.watermarkImage;
                watermark.appendChild(watermarkImg);
            }
            page.appendChild(watermark);
        }
        
        // Store page index for drawing system
        page.dataset.pageIndex = pageIndex;
        
        // Add drawing canvas if enabled - use new drawing system
        if (this.project.settings.enableDrawing && this.drawingSystem) {
            // Use the new drawing system
            setTimeout(() => {
                this.drawingSystem.initCanvas(page, pageIndex);
            }, 100);
        }
        
        return page;
    }
    
    createCoverPage(orientation, pageSize, fontFamily, pageBgColor) {
        const page = document.createElement('div');
        page.className = `storyboard-page cover-page ${orientation}`;
        page.style.fontFamily = fontFamily;
        page.style.backgroundColor = pageBgColor;
        
        // Convert mm to pixels (1mm = 3.779527559 pixels at 96 DPI)
        const mmToPx = 3.779527559;
        
        // Apply adjustable padding (same as regular pages)
        const pagePaddingMm = this.project.settings.pagePadding || 5;
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
        page.dataset.pageWidth = pageWidthMm; // Store actual mm width for PDF
        page.dataset.pageHeight = pageHeightMm; // Store actual mm height for PDF
        page.dataset.scale = scale; // Store scale factor for zoom
        
        if (this.project.settings.coverPageTitle) {
            const title = document.createElement('div');
            title.className = 'cover-page-title';
            title.textContent = this.project.settings.coverPageTitle;
            title.style.fontSize = (this.project.settings.coverPageTitleFontSize || 48) + 'px';
            title.style.color = this.project.settings.coverPageTitleColor || '#000000';
            page.appendChild(title);
        }
        
        if (this.project.settings.coverPageYear) {
            const year = document.createElement('div');
            year.className = 'cover-page-year';
            year.textContent = this.project.settings.coverPageYear;
            year.style.fontSize = (this.project.settings.coverPageYearFontSize || 24) + 'px';
            year.style.color = this.project.settings.coverPageYearColor || '#666666';
            page.appendChild(year);
        }
        
        if (this.project.settings.coverPageCreators) {
            const creators = document.createElement('div');
            creators.className = 'cover-page-creators';
            creators.textContent = this.project.settings.coverPageCreators;
            creators.style.fontSize = (this.project.settings.coverPageCreatorsFontSize || 18) + 'px';
            creators.style.color = this.project.settings.coverPageCreatorsColor || '#333333';
            page.appendChild(creators);
        }
        
        if (this.project.settings.coverPageLogo) {
            const logo = document.createElement('img');
            logo.className = 'cover-page-logo';
            logo.src = this.project.settings.coverPageLogo;
            page.appendChild(logo);
        }
        
        return page;
    }
    
    // Old drawing system removed - now using DrawingSystem class from drawing.js
    
    createFrame(image, scale, isHandwriting, fontFamily, pageIndex, frameIndex) {
        const frame = document.createElement('div');
        frame.className = 'storyboard-frame';
        
        // Apply frame scale
        const frameScale = this.project.settings.frameScale || 100;
        const scaleValue = frameScale / 100;
        frame.style.transform = `scale(${scaleValue})`;
        frame.style.transformOrigin = 'center';
        
        // Shot number rectangle with three sections (Scene, Shot, Frame)
        const shotContainer = document.createElement('div');
        shotContainer.className = 'shot-number-container';
        
        const rectangle = document.createElement('div');
        rectangle.className = 'shot-number-rectangle';
        // Apply rectangle scale
        const rectangleScale = this.project.settings.shotCircleScale || 100;
        const rectangleScaleValue = rectangleScale / 100;
        rectangle.style.transform = `scale(${rectangleScaleValue})`;
        
        // Get values from image data
        const sceneNumber = this.project.imageScenes[image.name] || image.sceneNumber || '';
        const shotNumber = image.shotNumber || '';
        const frameNumber = image.frameNumber || image.name.replace(/\.[^/.]+$/, '') || '';
        
        // Scene section
        const sceneSection = document.createElement('div');
        sceneSection.className = 'shot-section shot-section-scene';
        sceneSection.textContent = sceneNumber ? `Scene: ${sceneNumber}` : 'Scene:';
        sceneSection.style.fontFamily = this.project.settings.shotFontFamily || "'Kalam', cursive";
        sceneSection.style.fontSize = (this.project.settings.shotFontSize || 14) + 'px';
        sceneSection.style.fontWeight = this.project.settings.shotFontWeight || 'bold';
        sceneSection.style.color = this.project.settings.shotTextColor || '#ebebeb';
        if (!sceneNumber) {
            sceneSection.style.opacity = '0.6';
            sceneSection.style.fontStyle = 'italic';
        }
        
        // Shot section
        const shotSection = document.createElement('div');
        shotSection.className = 'shot-section shot-section-shot';
        shotSection.textContent = shotNumber ? `Shot: ${shotNumber}` : 'Shot:';
        shotSection.style.fontFamily = this.project.settings.shotFontFamily || "'Kalam', cursive";
        shotSection.style.fontSize = (this.project.settings.shotFontSize || 14) + 'px';
        shotSection.style.fontWeight = this.project.settings.shotFontWeight || 'bold';
        shotSection.style.color = this.project.settings.shotTextColor || '#ebebeb';
        if (!shotNumber) {
            shotSection.style.opacity = '0.6';
            shotSection.style.fontStyle = 'italic';
        }
        
        // Frame section
        const frameSection = document.createElement('div');
        frameSection.className = 'shot-section shot-section-frame';
        frameSection.textContent = frameNumber ? `Frame: ${frameNumber}` : 'Frame:';
        frameSection.style.fontFamily = this.project.settings.shotFontFamily || "'Kalam', cursive";
        frameSection.style.fontSize = (this.project.settings.shotFontSize || 14) + 'px';
        frameSection.style.fontWeight = this.project.settings.shotFontWeight || 'bold';
        frameSection.style.color = this.project.settings.shotTextColor || '#ebebeb';
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
        imageContainer.addEventListener('click', () => this.openImageSettings(image));
        
        const img = document.createElement('img');
        if (image && image.url) {
            img.src = image.url;
            console.log('Setting image src:', image.name, 'URL length:', image.url ? image.url.substring(0, 50) + '...' : 'null');
        } else {
            console.error('Image missing URL in createFrame:', image);
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
        }
        img.className = 'frame-image';
        img.style.transform = `scale(${scale})`;
        img.style.transformOrigin = 'center';
        img.alt = image ? image.name : 'Unknown';
        img.onerror = function() {
            console.error('Failed to load image:', image ? image.name : 'Unknown', image ? image.url : 'No URL');
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
        };
        img.onload = function() {
            console.log('Image loaded successfully:', image ? image.name : 'Unknown');
        };
        
        imageContainer.appendChild(img);
        frame.appendChild(imageContainer);
        
        // Text area with font controls
        const textArea = document.createElement('textarea');
        textArea.className = 'frame-text';
        textArea.placeholder = 'Enter description for this frame...';
        textArea.value = this.project.frameTexts[image.name] || '';
        textArea.style.fontFamily = this.project.settings.frameFontFamily || "'Kalam', cursive";
        textArea.style.fontSize = (this.project.settings.frameFontSize || 12) + 'px';
        textArea.style.fontWeight = this.project.settings.frameFontWeight || '400';
        textArea.style.fontStyle = this.project.settings.frameFontStyle || 'normal';
        textArea.style.color = this.project.settings.frameTextColor || '#b4b4b4';
        textArea.style.textAlign = this.project.settings.frameTextAlign || 'left';
        // Debounce text input to avoid performance issues
        let textTimeout;
        textArea.addEventListener('input', (e) => {
            this.project.frameTexts[image.name] = e.target.value;
            clearTimeout(textTimeout);
            textTimeout = setTimeout(() => {
                this.markChanged();
            }, 500); // Save 500ms after typing stops
        });
        
        frame.appendChild(textArea);
        
        return frame;
    }
    
    openImageSettings(image) {
        this.currentEditingImage = image;
        this.currentEditingImageIndex = this.project.images.findIndex(img => img.name === image.name);
        const modal = document.getElementById('imageSettingsModal');
        document.getElementById('imageSettingsScene').value = this.project.imageScenes[image.name] || image.sceneNumber || '';
        document.getElementById('imageSettingsShot').value = image.shotNumber || '';
        document.getElementById('imageSettingsFrame').value = image.frameNumber || image.name.replace(/\.[^/.]+$/, '') || '';
        modal.style.display = 'block';
    }
    
    async saveImageSettings() {
        if (!this.currentEditingImage) return;
        
        const newScene = document.getElementById('imageSettingsScene').value.trim();
        const newShot = document.getElementById('imageSettingsShot').value.trim();
        const newFrame = document.getElementById('imageSettingsFrame').value.trim();
        const renameFile = document.getElementById('imageSettingsRenameFile').checked;
        
        // Update scene number
        if (newScene) {
            this.project.imageScenes[this.currentEditingImage.name] = newScene;
            this.currentEditingImage.sceneNumber = newScene;
        } else {
            delete this.project.imageScenes[this.currentEditingImage.name];
            this.currentEditingImage.sceneNumber = '';
        }
        
        // Update shot number
        this.currentEditingImage.shotNumber = newShot;
        
        // Update frame number
        this.currentEditingImage.frameNumber = newFrame;
        
        // Rename file if requested
        if (renameFile && newFrame) {
            const confirmed = await this.customConfirm(`This will rename the file "${this.currentEditingImage.originalName}" to "${newFrame}.${this.currentEditingImage.name.split('.').pop()}". Continue?`);
            if (confirmed) {
                // Note: Browser security prevents direct file renaming
                // This would require a backend service or File System Access API
                await this.customAlert('File renaming requires a backend service. The change is saved in the project but the actual file will not be renamed on disk.');
            }
        }
        
        this.markChanged();
        document.getElementById('imageSettingsModal').style.display = 'none';
        this.renderStoryboard();
    }
    
    async removeImage() {
        if (!this.currentEditingImage) return;
        
        const confirmed = await this.customConfirm(`Remove image "${this.currentEditingImage.name}" from the project?`);
        if (confirmed) {
            // Remove from images array
            this.project.images = this.project.images.filter(img => img.name !== this.currentEditingImage.name);
            // Mark as removed for reload
            this.removedImages.add(this.currentEditingImage.name);
            // Clean up associated data
            delete this.project.frameTexts[this.currentEditingImage.name];
            delete this.project.imageScenes[this.currentEditingImage.name];
            
            this.markChanged();
            document.getElementById('imageSettingsModal').style.display = 'none';
            this.renderStoryboard();
        }
    }
    
    async addImage() {
        const fileInput = document.getElementById('addImageFile');
        const file = fileInput.files[0];
        if (!file) {
            await this.customAlert('Please select an image file.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            const newImage = {
                name: file.name,
                originalName: file.name,
                url: e.target.result,
                sceneNumber: '',
                shotNumber: '',
                frameNumber: fileName, // Auto-populated from filename
                scene: '', // Keep for backward compatibility
                filePath: file.webkitRelativePath || file.name
            };
            
            // Insert at current position or at end
            if (this.currentEditingImageIndex !== undefined && this.currentEditingImageIndex >= 0) {
                this.project.images.splice(this.currentEditingImageIndex + 1, 0, newImage);
            } else {
                this.project.images.push(newImage);
            }
            
            // Sort to maintain order
            this.project.images.sort((a, b) => {
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });
            
            this.markChanged();
            document.getElementById('addImageModal').style.display = 'none';
            fileInput.value = '';
            this.renderStoryboard();
        };
        reader.readAsDataURL(file);
    }
    
    
    setupBrowserWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }
    
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges && this.project.images.length > 0) {
                this.saveToStorage(true); // Save as temp
            }
        }, 30000); // 30 seconds
    }
    
    saveToStorage(isTemp = false) {
        const key = isTemp ? 'storyboard_tempSave' : 'storyboard_currentProject';
        try {
            // Create a lightweight copy without base64 image data
            const projectCopy = {
                images: this.project.images.map(img => ({
                    name: img.name,
                    filePath: img.filePath,
                    sceneNumber: img.sceneNumber,
                    shotNumber: img.shotNumber,
                    frameNumber: img.frameNumber
                    // Don't save url (base64) - it's too large
                })),
                settings: this.project.settings,
                frameTexts: this.project.frameTexts,
                pageTexts: this.project.pageTexts,
                imageScenes: this.project.imageScenes,
                drawings: this.project.drawings, // Keep drawings but they're also base64 - might need compression
                activePanel: this.project.activePanel
            };
            
            const data = {
                project: projectCopy,
                timestamp: Date.now(),
                currentProjectPath: this.currentProjectPath,
                imageFolderPath: this.imageFolderPath,
                removedImages: Array.from(this.removedImages)
            };
            
            const dataStr = JSON.stringify(data);
            // Check size and warn if too large
            if (dataStr.length > 2 * 1024 * 1024) { // 2MB limit (more conservative)
                console.warn('Project data is very large, may exceed localStorage quota');
                // Try to save a more minimal version
                try {
                    const minimalData = {
                        project: {
                            images: projectCopy.images,
                            settings: projectCopy.settings,
                            frameTexts: projectCopy.frameTexts,
                            pageTexts: projectCopy.pageTexts,
                            imageScenes: projectCopy.imageScenes
                            // Skip drawings if too large
                        },
                        timestamp: Date.now(),
                        currentProjectPath: this.currentProjectPath
                    };
                    localStorage.setItem(key, JSON.stringify(minimalData));
                    return;
                } catch (e2) {
                    console.error('Could not save even minimal version:', e2);
                    return;
                }
            }
            
            localStorage.setItem(key, dataStr);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded. Project is too large to auto-save.');
                // Try to save a minimal version without drawings
                try {
                    const minimalData = {
                        project: {
                            images: this.project.images.map(img => ({
                                name: img.name,
                                sceneNumber: img.sceneNumber,
                                shotNumber: img.shotNumber,
                                frameNumber: img.frameNumber
                            })),
                            settings: this.project.settings,
                            frameTexts: this.project.frameTexts,
                            pageTexts: this.project.pageTexts,
                            imageScenes: this.project.imageScenes
                        },
                        timestamp: Date.now(),
                        currentProjectPath: this.currentProjectPath
                    };
                    localStorage.setItem(key, JSON.stringify(minimalData));
                } catch (e2) {
                    console.error('Could not save even minimal version:', e2);
                }
            } else {
                console.error('Error saving to localStorage:', e);
            }
        }
    }
    
    restoreProject(data, hasUnsavedChanges = true) {
        this.project = data.project;
        this.currentProjectPath = data.currentProjectPath || null;
        this.imageFolderPath = data.imageFolderPath || null;
        if (data.removedImages) {
            this.removedImages = new Set(data.removedImages);
        }
        this.hasUnsavedChanges = hasUnsavedChanges;
        
        // Check if images need to be reloaded (new lightweight format)
        // The FileManager will handle reloading automatically
        if (data.project.images && data.project.images.length > 0) {
            const firstImage = data.project.images[0];
            if (!firstImage.url && firstImage.filePath) {
                // Images don't have URLs - FileManager will reload them automatically
                // No need to show alert here - FileManager handles it
            }
        }
        
        // Note: File handle cannot be restored from localStorage (security restriction)
        // User will need to use Save As if they want to save to a new location
        if (this.fileManager && data.currentProjectPath) {
            // File handle will be null, but path is stored for reference
        }
        
        this.updateProjectName();
        this.loadProjectToUI();
        this.renderStoryboard();
    }
    
    async loadFromStorage() {
        try {
            // Check for temp save first
            const tempSave = localStorage.getItem('storyboard_tempSave');
            const currentProject = localStorage.getItem('storyboard_currentProject');
            
            if (tempSave) {
                try {
                    const tempData = JSON.parse(tempSave);
                    const tempTime = tempData.timestamp || 0;
                    
                    if (currentProject) {
                        try {
                            const currentData = JSON.parse(currentProject);
                            const currentTime = currentData.timestamp || 0;
                            
                            // If temp is newer, ask to restore
                            if (tempTime > currentTime) {
                                const restore = await this.customConfirm('Found a temporary save that is newer than your last saved project. Would you like to restore it?');
                                if (restore) {
                                    this.restoreProject(tempData);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing current project:', e);
                        }
                    } else {
                        // No current project, but have temp save
                        const restore = await this.customConfirm('Found a temporary save. Would you like to restore your previous work?');
                        if (restore) {
                            this.restoreProject(tempData);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing temp save:', e);
                }
            }
            
            // Load current project if available (always load, not just on restore)
            if (currentProject) {
                try {
                    const currentData = JSON.parse(currentProject);
                    this.restoreProject(currentData, false);
                    return; // Don't continue to empty state
                } catch (e) {
                    console.error('Error loading current project:', e);
                }
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
    
    
    loadProjectToUI() {
        document.getElementById('pageOrientation').value = this.project.settings.orientation || 'landscape';
        document.getElementById('pageSize').value = this.project.settings.pageSize || 'A4';
        const maxImages = this.getMaxImagesPerPage();
        document.getElementById('imagesPerPage').max = maxImages;
        document.getElementById('imagesPerPageInput').max = maxImages;
        let imagesPerPage = this.project.settings.imagesPerPage || (this.project.settings.layoutRows && this.project.settings.layoutCols ? this.project.settings.layoutRows * this.project.settings.layoutCols : 6);
        // Clamp to max if it exceeds
        if (imagesPerPage > maxImages) {
            imagesPerPage = maxImages;
            this.project.settings.imagesPerPage = maxImages;
        }
        document.getElementById('imagesPerPage').value = imagesPerPage;
        document.getElementById('imagesPerPageInput').value = imagesPerPage;
        const layout = this.calculateOptimalLayout(imagesPerPage);
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            layoutInfo.textContent = `Layout: ${layout.rows} row${layout.rows !== 1 ? 's' : ''} × ${layout.cols} column${layout.cols !== 1 ? 's' : ''}`;
        }
        const imageScale = document.getElementById('imageScale');
        const imageScaleInput = document.getElementById('imageScaleInput');
        if (imageScale) imageScale.value = this.project.settings.imageScale || 100;
        if (imageScaleInput) imageScaleInput.value = this.project.settings.imageScale || 100;
        
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const lineHeight = document.getElementById('lineHeight');
        const textColor = document.getElementById('textColor');
        const textAlign = document.getElementById('textAlign');
        const pageText = document.getElementById('pageText');
        const pageBackgroundColor = document.getElementById('pageBackgroundColor');
        const frameScale = document.getElementById('frameScale');
        const frameScaleInput = document.getElementById('frameScaleInput');
        const separateScenes = document.getElementById('separateScenes');
        const enablePageNumbers = document.getElementById('enablePageNumbers');
        const pageNumberPosition = document.getElementById('pageNumberPosition');
        const pageNumberFontSize = document.getElementById('pageNumberFontSize');
        const pageNumberColor = document.getElementById('pageNumberColor');
        const pageNumberSettings = document.getElementById('pageNumberSettings');
        
        if (fontFamily) fontFamily.value = this.project.settings.fontFamily || 'Arial, sans-serif';
        if (fontSize) fontSize.value = this.project.settings.fontSize || 12;
        if (lineHeight) lineHeight.value = this.project.settings.lineHeight || 1.5;
        if (textColor) textColor.value = this.project.settings.textColor || '#000000';
        if (textAlign) textAlign.value = this.project.settings.textAlign || 'left';
        if (pageText) pageText.value = this.project.settings.pageText || '';
        if (pageBackgroundColor) pageBackgroundColor.value = this.project.settings.pageBackgroundColor || '#404040';
        if (frameScale) frameScale.value = this.project.settings.frameScale || 100;
        if (frameScaleInput) frameScaleInput.value = this.project.settings.frameScale || 100;
        if (separateScenes) separateScenes.checked = this.project.settings.separateScenes || false;
        if (enablePageNumbers) enablePageNumbers.checked = this.project.settings.enablePageNumbers || false;
        if (pageNumberPosition) pageNumberPosition.value = this.project.settings.pageNumberPosition || 'bottom-center';
        if (pageNumberFontSize) pageNumberFontSize.value = this.project.settings.pageNumberFontSize || 12;
        if (pageNumberColor) pageNumberColor.value = this.project.settings.pageNumberColor || '#000000';
        if (pageNumberSettings) pageNumberSettings.style.display = (this.project.settings.enablePageNumbers) ? 'block' : 'none';
        
        // Text settings
        if (document.getElementById('pageFontFamily')) document.getElementById('pageFontFamily').value = this.project.settings.pageFontFamily || "'Kalam', cursive";
        if (document.getElementById('pageFontSize')) document.getElementById('pageFontSize').value = this.project.settings.pageFontSize || 12;
        if (document.getElementById('pageFontWeight')) {
            // Update weight options first, then set value
            this.updateFontWeightOptions('pageFontFamily', 'pageFontWeight');
            document.getElementById('pageFontWeight').value = this.project.settings.pageFontWeight || '400';
        }
        if (document.getElementById('pageFontStyle')) document.getElementById('pageFontStyle').value = this.project.settings.pageFontStyle || 'normal';
        if (document.getElementById('pageLineHeight')) document.getElementById('pageLineHeight').value = this.project.settings.pageLineHeight || 1.5;
        if (document.getElementById('pageTextColor')) document.getElementById('pageTextColor').value = this.project.settings.pageTextColor || '#b4b4b4';
        if (document.getElementById('pageTextAlign')) document.getElementById('pageTextAlign').value = this.project.settings.pageTextAlign || 'left';
        
        if (document.getElementById('frameFontFamily')) document.getElementById('frameFontFamily').value = this.project.settings.frameFontFamily || "'Kalam', cursive";
        if (document.getElementById('frameFontSize')) document.getElementById('frameFontSize').value = this.project.settings.frameFontSize || 12;
        if (document.getElementById('frameFontWeight')) {
            // Update weight options first, then set value
            this.updateFontWeightOptions('frameFontFamily', 'frameFontWeight');
            document.getElementById('frameFontWeight').value = this.project.settings.frameFontWeight || '400';
        }
        if (document.getElementById('frameFontStyle')) document.getElementById('frameFontStyle').value = this.project.settings.frameFontStyle || 'normal';
        if (document.getElementById('frameTextColor')) document.getElementById('frameTextColor').value = this.project.settings.frameTextColor || '#b4b4b4';
        if (document.getElementById('frameTextAlign')) document.getElementById('frameTextAlign').value = this.project.settings.frameTextAlign || 'left';
        
        if (document.getElementById('shotFontFamily')) document.getElementById('shotFontFamily').value = this.project.settings.shotFontFamily || "'Kalam', cursive";
        if (document.getElementById('shotFontSize')) document.getElementById('shotFontSize').value = this.project.settings.shotFontSize || 14;
        if (document.getElementById('shotFontWeight')) {
            // Update weight options first, then set value
            this.updateFontWeightOptions('shotFontFamily', 'shotFontWeight');
            document.getElementById('shotFontWeight').value = this.project.settings.shotFontWeight || 'bold';
        }
        if (document.getElementById('shotTextColor')) document.getElementById('shotTextColor').value = this.project.settings.shotTextColor || '#ebebeb';
        if (document.getElementById('shotCircleScale')) document.getElementById('shotCircleScale').value = this.project.settings.shotCircleScale || 100;
        if (document.getElementById('shotCircleScaleInput')) document.getElementById('shotCircleScaleInput').value = this.project.settings.shotCircleScale || 100;
        document.getElementById('showBottomText').checked = this.project.settings.showBottomText !== false;
        document.getElementById('enableCoverPage').checked = this.project.settings.enableCoverPage || false;
        document.getElementById('coverPageTitle').value = this.project.settings.coverPageTitle || '';
        document.getElementById('coverPageTitleFontSize').value = this.project.settings.coverPageTitleFontSize || 48;
        document.getElementById('coverPageTitleColor').value = this.project.settings.coverPageTitleColor || '#000000';
        document.getElementById('coverPageYear').value = this.project.settings.coverPageYear || '';
        document.getElementById('coverPageYearFontSize').value = this.project.settings.coverPageYearFontSize || 24;
        document.getElementById('coverPageYearColor').value = this.project.settings.coverPageYearColor || '#666666';
        document.getElementById('coverPageCreators').value = this.project.settings.coverPageCreators || '';
        document.getElementById('coverPageCreatorsFontSize').value = this.project.settings.coverPageCreatorsFontSize || 18;
        document.getElementById('coverPageCreatorsColor').value = this.project.settings.coverPageCreatorsColor || '#333333';
        document.getElementById('enableWatermark').checked = this.project.settings.enableWatermark || false;
        document.getElementById('watermarkType').value = this.project.settings.watermarkType || 'text';
        document.getElementById('watermarkText').value = this.project.settings.watermarkText || '';
        document.getElementById('watermarkOpacity').value = this.project.settings.watermarkOpacity || 30;
        document.getElementById('enableDrawing').checked = this.project.settings.enableDrawing || false;
        
        if (this.project.settings.coverPageLogo) {
            document.getElementById('coverPageLogoPreview').innerHTML = `<img src="${this.project.settings.coverPageLogo}" alt="Logo">`;
        }
        if (this.project.settings.watermarkImage) {
            document.getElementById('watermarkImagePreview').innerHTML = `<img src="${this.project.settings.watermarkImage}" alt="Watermark">`;
        }
        
        this.updateScaleDisplay();
        this.updateLayoutInfo();
    }
    
    isColorDark(color) {
        // Check if a color is dark (for determining text color)
        const rgb = this.hexToRgb(color);
        if (!rgb) return false;
        // Calculate luminance
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance < 0.5;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    
    async addCoverPageToPDF(pdf, pageSize, orientation, fontFamily, pageBgColor) {
        const pageWidth = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeight = orientation === 'portrait' ? pageSize.height : pageSize.width;
        
        // Set background color
        const rgb = this.hexToRgb(pageBgColor);
        if (rgb) {
            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        }
        
        let yPos = pageHeight / 2;
        
        if (this.project.settings.coverPageTitle) {
            const titleSize = this.project.settings.coverPageTitleFontSize || 36;
            const titleColor = this.hexToRgb(this.project.settings.coverPageTitleColor || '#000000');
            pdf.setFontSize(titleSize);
            if (titleColor) {
                pdf.setTextColor(titleColor.r, titleColor.g, titleColor.b);
            } else {
                pdf.setTextColor(0, 0, 0);
            }
            pdf.text(this.project.settings.coverPageTitle, pageWidth / 2, yPos - 60, { align: 'center' });
            yPos += 20;
        }
        
        if (this.project.settings.coverPageYear) {
            const yearSize = this.project.settings.coverPageYearFontSize || 18;
            const yearColor = this.hexToRgb(this.project.settings.coverPageYearColor || '#666666');
            pdf.setFontSize(yearSize);
            if (yearColor) {
                pdf.setTextColor(yearColor.r, yearColor.g, yearColor.b);
            } else {
                pdf.setTextColor(100, 100, 100);
            }
            pdf.text(this.project.settings.coverPageYear, pageWidth / 2, yPos - 40, { align: 'center' });
            yPos += 20;
        }
        
        if (this.project.settings.coverPageCreators) {
            const creatorsSize = this.project.settings.coverPageCreatorsFontSize || 14;
            const creatorsColor = this.hexToRgb(this.project.settings.coverPageCreatorsColor || '#333333');
            pdf.setFontSize(creatorsSize);
            if (creatorsColor) {
                pdf.setTextColor(creatorsColor.r, creatorsColor.g, creatorsColor.b);
            } else {
                pdf.setTextColor(50, 50, 50);
            }
            const lines = pdf.splitTextToSize(this.project.settings.coverPageCreators, pageWidth - 60);
            if (Array.isArray(lines)) {
                pdf.text(lines, pageWidth / 2, yPos - 20, { align: 'center' });
            } else {
                pdf.text(lines, pageWidth / 2, yPos - 20, { align: 'center' });
            }
        }
        
        if (this.project.settings.coverPageLogo) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                img.onload = () => {
                    try {
                        const logoWidth = 50;
                        const logoHeight = (img.height / img.width) * logoWidth;
                        const format = this.project.settings.coverPageLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                        pdf.addImage(img, format, (pageWidth - logoWidth) / 2, yPos + 20, logoWidth, logoHeight);
                    } catch (err) {
                        console.error('Error adding logo to PDF:', err);
                    }
                    resolve();
                };
                img.onerror = resolve;
                img.src = this.project.settings.coverPageLogo;
            });
        }
    }
    
    async addPageToPDF(pdf, images, pageSize, orientation, rows, cols, fontFamily, pageText, scale, isHandwriting, pageBgColor, pageIndex) {
        if (!images || images.length === 0) {
            console.warn('No images provided for PDF page');
            return;
        }
        
        // Get page dimensions - ensure pageSize is valid
        if (!pageSize || typeof pageSize.width !== 'number' || typeof pageSize.height !== 'number') {
            console.error('Invalid pageSize:', pageSize);
            return;
        }
        
        const pageWidth = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeight = orientation === 'portrait' ? pageSize.height : pageSize.width;
        
        // Set background color
        const rgb = this.hexToRgb(pageBgColor);
        if (rgb) {
            pdf.setFillColor(rgb.r, rgb.g, rgb.b);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        }
        
        // Note: This function is no longer used since we're using html2canvas
        // But keeping it for backward compatibility if needed
        const pagePaddingMm = 5; // Minimal padding
        const gap = 10; // Gap between cells
        const availableWidth = pageWidth - (pagePaddingMm * 2);
        const availableHeight = pageHeight - (pagePaddingMm * 2);
        let yPos = pagePaddingMm;
        
        // Calculate cell dimensions - ensure we have valid rows and cols
        const validRows = Math.max(1, Math.min(rows, images.length));
        const validCols = Math.max(1, Math.min(cols, images.length));
        
        const cellWidth = (availableWidth - (validCols - 1) * gap) / validCols;
        const cellHeight = (availableHeight - (validRows - 1) * gap) / validRows;
        
        // Process images in grid order
        for (let index = 0; index < Math.min(images.length, rows * cols); index++) {
            const image = images[index];
            if (!image || !image.url) {
                console.warn('Invalid image at index', index);
                continue;
            }
            
            const col = index % validCols;
            const row = Math.floor(index / validCols);
            
            const xPos = pagePaddingMm + col * (cellWidth + gap);
            const yPosFrame = yPos + row * (cellHeight + gap);
            
            // Shot number with circle
            const shotNum = image.shotNumber || '?';
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            
            const shotX = xPos + cellWidth / 2;
            const shotY = yPosFrame + 8;
            
            if (isHandwriting) {
                pdf.circle(shotX, shotY - 3, 4, 'S');
            }
            pdf.text(String(shotNum), shotX, shotY, { align: 'center' });
            
            // Image area - reserve space for shot number (15mm) and text (20mm)
            const imageStartY = yPosFrame + 15;
            const imageAreaHeight = cellHeight - 35; // Reserve space
            const imageAreaWidth = cellWidth - 4; // Small padding
            const imagePadding = 2;
            
            // Load and add image
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve) => {
                    img.onload = () => {
                        try {
                            // Calculate image dimensions maintaining aspect ratio
                            const imgAspectRatio = img.height / img.width;
                            let imgWidth = imageAreaWidth * scale;
                            let imgHeight = imgWidth * imgAspectRatio;
                            
                            // If image is too tall, scale down to fit
                            if (imgHeight > imageAreaHeight) {
                                imgHeight = imageAreaHeight;
                                imgWidth = imgHeight / imgAspectRatio;
                            }
                            
                            // Center the image in the cell
                            const imgX = xPos + imagePadding + (imageAreaWidth - imgWidth) / 2;
                            const imgY = imageStartY + (imageAreaHeight - imgHeight) / 2;
                            
                            // Determine image format
                            const format = image.url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                            pdf.addImage(img, format, imgX, imgY, imgWidth, imgHeight);
                            
                            // Frame text below image
                            const frameText = this.project.frameTexts[image.name] || '';
                            if (frameText) {
                                pdf.setFontSize(7);
                                pdf.setFont('helvetica', 'normal');
                                const textY = imageStartY + imageAreaHeight + 3;
                                const textLines = pdf.splitTextToSize(frameText, cellWidth - 2 * imagePadding);
                                if (Array.isArray(textLines)) {
                                    pdf.text(textLines, xPos + imagePadding, textY);
                                } else {
                                    pdf.text(textLines, xPos + imagePadding, textY);
                                }
                            }
                        } catch (err) {
                            console.error('Error processing image:', err);
                        }
                        resolve();
                    };
                    img.onerror = () => {
                        console.error('Error loading image:', image.name);
                        resolve();
                    };
                    img.src = image.url;
                });
            } catch (error) {
                console.error('Error adding image to PDF:', error);
            }
        }
        
        // Add per-page text at bottom (if enabled)
        if (this.project.settings.showBottomText) {
            const pageTextBottom = this.project.pageTexts[pageIndex] || '';
            if (pageTextBottom) {
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(0, 0, 0);
                const textY = pageHeight - 20;
                const textLines = pdf.splitTextToSize(pageTextBottom, pageWidth - 2 * pagePadding);
                if (Array.isArray(textLines)) {
                    pdf.text(textLines, pagePadding, textY);
                } else {
                    pdf.text(textLines, pagePadding, textY);
                }
            }
        }
        
        // Add watermark if enabled
        if (this.project.settings.enableWatermark) {
            const opacity = this.project.settings.watermarkOpacity / 100;
            if (this.project.settings.watermarkType === 'text' && this.project.settings.watermarkText) {
                pdf.setTextColor(150, 150, 150);
                pdf.setFontSize(48);
                pdf.setFont('helvetica', 'normal');
                pdf.text(this.project.settings.watermarkText, pageWidth / 2, pageHeight / 2, {
                    align: 'center',
                    angle: -45,
                    opacity: opacity
                });
            } else if (this.project.settings.watermarkType === 'image' && this.project.settings.watermarkImage) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve) => {
                    img.onload = () => {
                        try {
                            const wmWidth = pageWidth * 0.5;
                            const wmHeight = (img.height / img.width) * wmWidth;
                            const format = this.project.settings.watermarkImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                            pdf.addImage(img, format, (pageWidth - wmWidth) / 2, (pageHeight - wmHeight) / 2, wmWidth, wmHeight, undefined, 'FAST', 0, opacity);
                        } catch (err) {
                            console.error('Error adding watermark image:', err);
                        }
                        resolve();
                    };
                    img.onerror = resolve;
                    img.src = this.project.settings.watermarkImage;
                });
            }
        }
        
        // Add drawing if exists
        if (this.project.drawings && this.project.drawings[pageIndex]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                img.onload = () => {
                    try {
                        pdf.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
                    } catch (err) {
                        console.error('Error adding drawing to PDF:', err);
                    }
                    resolve();
                };
                img.onerror = resolve;
                img.src = this.project.drawings[pageIndex];
            });
        }
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new StoryboardCreator();
});
