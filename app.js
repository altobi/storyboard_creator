// Storyboard Creator Application
class StoryboardCreator {
    constructor() {
        // Initialize image structure parser (check if available)
        // Try multiple ways to access it
        if (typeof ImageStructureParser !== 'undefined') {
            this.imageStructureParser = new ImageStructureParser();
        } else if (typeof window !== 'undefined' && window.ImageStructureParser) {
            this.imageStructureParser = new window.ImageStructureParser();
        } else {
            // Create a minimal fallback
            this.imageStructureParser = {
                parseFileStructure: () => ({ type: 'simple', images: [], recognized: false, structureInfo: null }),
                getRecognitionExamples: () => []
            };
        }
        this.pendingImportFiles = null;
        this.project = {
            images: [],
            settings: {
                orientation: 'landscape',
                pageSize: 'A4',
                layoutRows: 2, // Default for landscape (will be set based on orientation)
                layoutCols: 3, // Default for landscape
                imageScale: 100,
                fontFamily: 'Arial, sans-serif',
                fontSize: 12,
                lineHeight: 1.5,
                textColor: '#000000',
                textAlign: 'left',
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
                watermarkImagePosition: 'center',
                watermarkImageSize: 50,
                watermarkOpacity: 30,
                frameTextScale: 100, // Scale for frame text height (30-100%)
                imageAspectRatio: 'none', // Aspect ratio for image cropping: 'none', '16:9', '21:9', etc., or 'custom'
                customAspectRatioWidth: 16, // Custom aspect ratio width
                customAspectRatioHeight: 9, // Custom aspect ratio height
                enableDrawing: false,
                // Shot list settings
                frameRate: 24, // Default frame rate for shot list duration calculations
                productionTimeMultiplier: 1.5, // Multiplier for expected production time
                customShotListColumns: [], // Custom columns added by user
                // Image compression settings
                imageCompression: {
                    enabled: true, // Whether compression is enabled
                    maxSizeMB: 1, // Maximum file size in MB (after compression)
                    maxWidthOrHeight: 1920, // Maximum dimension in pixels (maintains aspect ratio)
                    quality: 0.75, // Compression quality (0-1, higher = better quality)
                    format: 'webp' // Output format: 'webp', 'jpeg', 'png'
                }
            },
            frameTexts: {}, // Store text for each frame by image name
            pageTexts: {}, // Store custom text for each page
            imageScenes: {}, // Store scene for each image
            drawings: {}, // Store legacy drawing data for each page (for backward compatibility)
            activePanel: null,
            activeWorkspace: 'storyboard', // Current workspace: 'storyboard', 'shotlist', 'previz'
            shotList: [], // Shot list data (managed by ShotListManager)
            audioFiles: [], // Audio files imported for previz
            customFiles: [] // Custom files (images/video) imported for previz (not storyboard images)
        };
        
        this.hasUnsavedChanges = false;
        this.lastChangeTime = null; // Track when changes were made
        this.currentEditingImage = null;
        this.isDrawing = false;
        this.currentCanvas = null;
        this.currentPageIndex = null;
        this.currentProjectPath = null; // Track current save path
        this.autoSaveInterval = null;
        this.zoomLevel = 1.0; // Current zoom level
        this.imageFolderPath = null; // Store folder path for reload
        this.removedImages = new Set(); // Track removed images
        this.statusUpdateInterval = null; // Interval for status indicator updates
        this.drawingSystem = null; // Legacy drawing system (for backward compatibility)
        this.annotationSystem = null; // New annotation system using Fabric.js
        this.fileManager = null; // Will be initialized after FileManager class is available
        this.imageManager = null; // Will be initialized after ImageManager class is available
        this.uiManager = null; // Will be initialized after UIManager class is available
        this.pdfManager = null; // Will be initialized after PDFManager class is available
        this.modalController = null; // Will be initialized after ModalController class is available
        this.imageSettingsController = null; // Will be initialized after ImageSettingsController class is available
        this.shotListController = null; // Will be initialized after ShotListController class is available
        this.previsController = null; // Will be initialized after PrevisController class is available
        this.storageService = null; // Will be initialized after StorageService class is available
        this.renderService = null; // Will be initialized after RenderService class is available
        this.shotListManager = null; // Will be initialized after ShotListManager class is available
        this.imagesNeedReload = false; // Flag for images that need to be reloaded
        this.pendingImageMetadata = null; // Store image metadata when reloading
        
        this.pageSizes = {
            'A4': { width: 210, height: 297 }, // mm
            'A3': { width: 297, height: 420 },
            'Letter': { width: 215.9, height: 279.4 },
            'Legal': { width: 215.9, height: 355.6 },
            'Tabloid': { width: 279.4, height: 431.8 }
        };
        
        // Initialize managers first (before event listeners)
        if (typeof FileManager !== 'undefined') {
            this.fileManager = new FileManager(this);
        }
        if (typeof ImageManager !== 'undefined') {
            this.imageManager = new ImageManager(this);
        }
        if (typeof UIManager !== 'undefined') {
            this.uiManager = new UIManager(this);
        }
        if (typeof PDFManager !== 'undefined') {
            this.pdfManager = new PDFManager(this);
        }
        if (typeof ModalController !== 'undefined') {
            this.modalController = new ModalController(this);
        }
        if (typeof ImageSettingsController !== 'undefined') {
            this.imageSettingsController = new ImageSettingsController(this);
        }
        if (typeof ShotListController !== 'undefined') {
            this.shotListController = new ShotListController(this);
        }
        if (typeof PrevisController !== 'undefined') {
            this.previsController = new PrevisController(this);
        }
        if (typeof StorageService !== 'undefined') {
            this.storageService = new StorageService(this);
        }
        if (typeof RenderService !== 'undefined') {
            this.renderService = new RenderService(this);
        }
        if (typeof ShotListManager !== 'undefined') {
            this.shotListManager = new ShotListManager(this);
        }
        if (typeof XMLExportService !== 'undefined') {
            this.xmlExportService = new XMLExportService(this);
        }
        if (typeof EDLExportService !== 'undefined') {
            this.edlExportService = new EDLExportService(this);
        }
        if (typeof VideoExportService !== 'undefined') {
            this.videoExportService = new VideoExportService(this);
        }
        if (typeof BundledExportService !== 'undefined') {
            this.bundledExportService = new BundledExportService(this);
        }
        
        // Initialize first to set up event listeners
        this.init();
        
        // DISABLED: Auto-restore on page load
        // User must explicitly open a project file or create a new one
        // Clear all cached project data on page load
        const clearCachedData = async () => {
            try {
                // Clear localStorage project data
                localStorage.removeItem('storyboard_tempSave');
                localStorage.removeItem('storyboard_currentProject');
                localStorage.removeItem('storyboard_activeWorkspace');
                
                // Clear IndexedDB project data if available
                if (this.fileManager && this.fileManager.db) {
                    try {
                        const transaction = this.fileManager.db.transaction(['projectData'], 'readwrite');
                        const store = transaction.objectStore('projectData');
                        await store.delete('storyboard_tempSave');
                        await store.delete('storyboard_currentProject');
                    } catch (e) {
                        console.warn('Could not clear IndexedDB project data:', e);
                    }
                }
                
                console.log('[INIT] Cleared all cached project data - user must open a project file');
            } catch (e) {
                console.error('Error clearing cached data:', e);
            }
        };
        clearCachedData().catch(e => {
            console.error('Error loading from storage:', e);
            // Continue even if loading fails
        });
        
        // Initialize annotation system
        setTimeout(() => {
            if (typeof AnnotationSystem !== 'undefined' && typeof Konva !== 'undefined') {
                this.annotationSystem = new AnnotationSystem(this);
                // Sync initial settings
                if (this.annotationSystem && this.project.settings) {
                    this.annotationSystem.setTool(this.project.settings.drawingTool || 'brush');
                    this.annotationSystem.setBrushSize(this.project.settings.brushSize || 5);
                    this.annotationSystem.setBrushColor(this.project.settings.brushColor || '#000000');
                    if (this.project.settings.fillColor && this.project.settings.fillColor !== 'transparent') {
                        this.annotationSystem.setFillColor(this.project.settings.fillColor);
                    }
                    if (this.project.settings.fillShape) {
                        this.annotationSystem.setFillEnabled(true);
                    }
                    this.annotationSystem.setEnabled(this.project.settings.enableAnnotation || false);
                }
            }
        }, 100);
    }
    
    init() {
        this.setupEventListeners();
        this.setupColorPickers();
        // Use UIManager if available, otherwise use local methods
        if (this.uiManager) {
            this.uiManager.updateScaleDisplay();
            this.uiManager.updateProjectName();
        } else {
            this.updateScaleDisplay();
            this.updateProjectName();
        }
        // Setup modals - use ModalController if available
        if (this.modalController) {
            this.modalController.setupModal();
        } else {
            this.setupModal();
        }
        // Setup shot list controller
        if (this.shotListController) {
            this.shotListController.init();
        }
        // Setup previs controller
        if (this.previsController) {
            this.previsController.init();
        }
        // Setup drawing canvas (must be called after modal setup)
        this.setupDrawingCanvas();
        this.setupPanels();
        this.setupDrawing();
        this.setupCoverPage();
        this.setupWatermark();
        this.setupColorPickers();
        this.setupBrowserWarning();
        this.startAutoSave();
        this.initSaveStatusIndicator();
        this.setupResizeHandler();
        
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
                        // For Safari compatibility, we need to handle file input synchronously
                        // Check if File System Access API is supported
                        if (!this.fileManager.supportsFileSystemAccess) {
                            // Safari fallback - create file input synchronously in click handler
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.sbp';
                            input.style.display = 'none';
                            
                            input.onchange = async (fileEvent) => {
                                const file = fileEvent.target.files[0];
                                if (file) {
                                    await this.fileManager.openProjectFromFile(file);
                                }
                                // Cleanup
                                setTimeout(() => {
                                    if (input.parentNode) {
                                        document.body.removeChild(input);
                                    }
                                }, 100);
                            };
                            
                            document.body.appendChild(input);
                            input.click();
                        } else {
                            // Chrome/Edge - use File System Access API
                            await this.fileManager.openProject();
                        }
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
              // About button handler
              const aboutBtn = document.getElementById('aboutBtn');
              if (aboutBtn) {
                  aboutBtn.addEventListener('click', () => {
                      const aboutModal = document.getElementById('aboutModal');
                      if (aboutModal) {
                          aboutModal.style.display = 'flex';
                          // Close button handlers
                          const closeBtn = aboutModal.querySelector('.modal-close');
                          const closeActionBtn = document.getElementById('aboutModalClose');
                          const closeHandler = () => {
                              aboutModal.style.display = 'none';
                          };
                          if (closeBtn) {
                              closeBtn.onclick = closeHandler;
                          }
                          if (closeActionBtn) {
                              closeActionBtn.onclick = closeHandler;
                          }
                          // Close on backdrop click
                          aboutModal.addEventListener('click', (e) => {
                              if (e.target === aboutModal) {
                                  closeHandler();
                              }
                          });
                      }
                  });
              }
              
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
            
            // Export PDF - handled by ShotListController to avoid conflicts
            // Export Storyboard PDF - handled by ShotListController to avoid conflicts
            
            // Export Shot List PDF - handled by ShotListController to avoid double calls
            
            // Import Images - Open modal instead of direct import
            const importImagesBtn = document.getElementById('importImagesBtn');
            if (importImagesBtn) {
                importImagesBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.openImageImportModal();
                });
            }
            
            // Initialize Image Import Modal
            this.initImageImportModal();
            
            // Keep legacy imageFolder for backward compatibility
            const imageFolder = document.getElementById('imageFolder');
            if (imageFolder) {
                imageFolder.addEventListener('change', (e) => {
                    this.importImages(e);
                });
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
            
            // Handle export menu hover and click
            const exportMenuBtn = document.getElementById('exportMenuBtn');
            const exportSubmenu = document.getElementById('exportSubmenu');
            if (exportMenuBtn && exportSubmenu) {
                let menuTimeout = null;
                
                const showMenu = () => {
                    if (menuTimeout) clearTimeout(menuTimeout);
                    // Position submenu to the right of the button (since it has a right arrow)
                    const btnRect = exportMenuBtn.getBoundingClientRect();
                    exportSubmenu.style.display = 'block';
                    exportSubmenu.style.position = 'fixed';
                    exportSubmenu.style.top = `${btnRect.top}px`;
                    exportSubmenu.style.left = `${btnRect.right + 2}px`;
                    exportSubmenu.style.zIndex = '1000';
                };
                
                const hideMenu = () => {
                    menuTimeout = setTimeout(() => {
                        exportSubmenu.style.display = 'none';
                    }, 200); // Small delay to allow moving to dropdown
                };
                
                exportMenuBtn.addEventListener('mouseenter', showMenu);
                exportMenuBtn.addEventListener('mouseleave', hideMenu);
                exportSubmenu.addEventListener('mouseenter', showMenu);
                exportSubmenu.addEventListener('mouseleave', hideMenu);
                
                // Close menu when clicking outside
                document.addEventListener('click', (e) => {
                    if (!exportSubmenu.contains(e.target) && !exportMenuBtn.contains(e.target)) {
                        exportSubmenu.style.display = 'none';
                    }
                });
            }
            
            const zoomInBtn = document.getElementById('zoomIn');
            if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoom(1.1));
            
            const zoomOutBtn = document.getElementById('zoomOut');
            if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoom(0.9));
            
            // Zoom dropdown
            const zoomDropdownBtn = document.getElementById('zoomDropdownBtn');
            const zoomDropdown = document.getElementById('zoomDropdown');
            const zoomControlWrapper = document.querySelector('.zoom-control-wrapper');
            if (zoomDropdownBtn && zoomDropdown && zoomControlWrapper) {
                zoomDropdownBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    zoomControlWrapper.classList.toggle('active');
                });
                
                // Handle dropdown items
                const zoomItems = zoomDropdown.querySelectorAll('.zoom-dropdown-item');
                zoomItems.forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const zoomValue = item.dataset.zoom;
                        if (zoomValue === 'fit') {
                            this.zoomFit();
                        } else {
                            const zoom = parseInt(zoomValue);
                            this.zoomLevel = zoom / 100;
                            this.applyZoom();
                            const zoomLevelInput = document.getElementById('zoomLevel');
                            if (zoomLevelInput) {
                                zoomLevelInput.value = zoom;
                            }
                        }
                        zoomControlWrapper.classList.remove('active');
                    });
                });
            }
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (zoomControlWrapper && !e.target.closest('.zoom-control-wrapper')) {
                    zoomControlWrapper.classList.remove('active');
                }
            });
            
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
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            document.getElementById('pageSize').addEventListener('change', (e) => {
                this.project.settings.pageSize = e.target.value;
                this.markChanged();
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            // Manual layout rows and columns with sliders
            const layoutRowsSlider = document.getElementById('layoutRows');
            const layoutRowsInput = document.getElementById('layoutRowsInput');
            const layoutColsSlider = document.getElementById('layoutCols');
            const layoutColsInput = document.getElementById('layoutColsInput');
            
            const updateLayout = () => {
                const rows = Math.max(1, Math.min(4, parseInt(layoutRowsSlider ? layoutRowsSlider.value : (layoutRowsInput ? layoutRowsInput.value : 2)) || 2));
                const cols = Math.max(1, Math.min(4, parseInt(layoutColsSlider ? layoutColsSlider.value : (layoutColsInput ? layoutColsInput.value : 2)) || 2));
                
                this.project.settings.layoutRows = rows;
                this.project.settings.layoutCols = cols;
                
                // Update UI - sync slider and input
                if (layoutRowsSlider) layoutRowsSlider.value = rows;
                if (layoutRowsInput) layoutRowsInput.value = rows;
                if (layoutColsSlider) layoutColsSlider.value = cols;
                if (layoutColsInput) layoutColsInput.value = cols;
                
                // Update layout info
                const totalImages = rows * cols;
                const layoutInfo = document.getElementById('layoutInfo');
                if (layoutInfo) {
                    layoutInfo.textContent = `Total: ${totalImages} image${totalImages !== 1 ? 's' : ''} per page`;
                }
                
                this.markChanged();
                this.renderStoryboard();
            };
            
            // Rows slider and input
            if (layoutRowsSlider) {
                layoutRowsSlider.addEventListener('input', updateLayout);
            }
            if (layoutRowsInput) {
                layoutRowsInput.addEventListener('change', updateLayout);
                layoutRowsInput.addEventListener('input', updateLayout);
            }
            
            // Columns slider and input
            if (layoutColsSlider) {
                layoutColsSlider.addEventListener('input', updateLayout);
            }
            if (layoutColsInput) {
                layoutColsInput.addEventListener('change', updateLayout);
                layoutColsInput.addEventListener('input', updateLayout);
            }
            
            // Initialize layout info
            const layoutInfo = document.getElementById('layoutInfo');
            if (layoutInfo) {
                const totalImages = (this.project.settings.layoutRows || 2) * (this.project.settings.layoutCols || 2);
                layoutInfo.textContent = `Total: ${totalImages} image${totalImages !== 1 ? 's' : ''} per page`;
            }
            
            
            
            document.getElementById('imageScale').addEventListener('input', (e) => {
                const scale = parseInt(e.target.value);
                this.project.settings.imageScale = scale;
                document.getElementById('imageScaleInput').value = scale;
                this.markChanged();
                // Update image scale on existing frames without full re-render
                if (this.renderService) {
                    this.renderService.updateImageScale();
                } else {
                    this.updateImageScale();
                }
            });
            
            document.getElementById('imageScaleInput').addEventListener('change', (e) => {
                const scale = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
                this.project.settings.imageScale = scale;
                document.getElementById('imageScale').value = scale;
                e.target.value = scale;
                this.markChanged();
                // Update image scale without full re-render for better performance
                if (this.renderService) {
                    this.renderService.updateImageScale();
                } else {
                    this.updateImageScale();
                }
            });
            
            // Frame text scale controls
            document.getElementById('frameTextScale').addEventListener('input', (e) => {
                const scale = parseInt(e.target.value);
                this.project.settings.frameTextScale = scale;
                document.getElementById('frameTextScaleInput').value = scale;
                this.markChanged();
                // Frame text scale affects max images per page - smaller text allows more images
                this.renderStoryboard();
            });
            
            document.getElementById('frameTextScaleInput').addEventListener('change', (e) => {
                const scale = Math.max(0, Math.min(100, parseInt(e.target.value) || 100));
                this.project.settings.frameTextScale = scale;
                document.getElementById('frameTextScale').value = scale;
                e.target.value = scale;
                this.markChanged();
                // Frame text scale affects max images per page - smaller text allows more images
                this.renderStoryboard();
            });
            
            // Image aspect ratio controls
            const imageAspectRatio = document.getElementById('imageAspectRatio');
            const customAspectRatioContainer = document.getElementById('customAspectRatioContainer');
            const customAspectRatioWidth = document.getElementById('customAspectRatioWidth');
            const customAspectRatioHeight = document.getElementById('customAspectRatioHeight');
            
            if (imageAspectRatio) {
                imageAspectRatio.addEventListener('change', (e) => {
                    const value = e.target.value;
                    this.project.settings.imageAspectRatio = value;
                    
                    // Show/hide custom fields
                    if (customAspectRatioContainer) {
                        customAspectRatioContainer.style.display = value === 'custom' ? 'block' : 'none';
                    }
                    
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            if (customAspectRatioWidth && customAspectRatioHeight) {
                const updateCustomAspectRatio = () => {
                    const width = parseFloat(customAspectRatioWidth.value) || 16;
                    const height = parseFloat(customAspectRatioHeight.value) || 9;
                    this.project.settings.customAspectRatioWidth = width;
                    this.project.settings.customAspectRatioHeight = height;
                    this.markChanged();
                    this.renderStoryboard();
                };
                
                customAspectRatioWidth.addEventListener('change', updateCustomAspectRatio);
                customAspectRatioWidth.addEventListener('input', updateCustomAspectRatio);
                customAspectRatioHeight.addEventListener('change', updateCustomAspectRatio);
                customAspectRatioHeight.addEventListener('input', updateCustomAspectRatio);
            }
            
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
            
            // Page number include cover page setting - removed (functionality doesn't work)
            
            // Page number settings
            const pageNumberPositionEl = document.getElementById('pageNumberPosition');
            if (pageNumberPositionEl) {
                pageNumberPositionEl.addEventListener('change', (e) => {
                    this.project.settings.pageNumberPosition = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const pageNumberFontSizeEl = document.getElementById('pageNumberFontSize');
            if (pageNumberFontSizeEl) {
                pageNumberFontSizeEl.addEventListener('input', (e) => {
                    this.project.settings.pageNumberFontSize = parseInt(e.target.value) || 12;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
            const pageNumberColorEl = document.getElementById('pageNumberColor');
            if (pageNumberColorEl) {
                pageNumberColorEl.addEventListener('input', (e) => {
                    this.project.settings.pageNumberColor = e.target.value;
                    this.markChanged();
                    this.renderStoryboard();
                });
            }
            
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
                    if (this.renderService) {
                        this.renderService.updateFrameScale();
                    } else {
                        this.updateFrameScale();
                    }
                });
                
                frameScaleInputEl.addEventListener('change', (e) => {
                    const scale = Math.min(100, Math.max(0, parseInt(e.target.value) || 100));
                    this.project.settings.frameScale = scale;
                    frameScaleEl.value = scale;
                    e.target.value = scale;
                    this.markChanged();
                    if (this.renderService) {
                        this.renderService.updateFrameScale();
                    } else {
                        this.updateFrameScale();
                    }
                });
            } else {
                console.error('Frame scale elements not found!', { frameScaleEl, frameScaleInputEl });
            }
            
            // Update max rows when page size or orientation changes
            document.getElementById('pageSize').addEventListener('change', () => {
                this.updateLayoutInfo();
                this.renderStoryboard();
            });
            
            document.getElementById('pageOrientation').addEventListener('change', (e) => {
                const orientation = e.target.value;
                // Set default layout based on orientation
                if (orientation === 'portrait') {
                    if (!this.project.settings.layoutRows || this.project.settings.layoutRows === 2) {
                        this.project.settings.layoutRows = 3;
                    }
                    if (!this.project.settings.layoutCols || this.project.settings.layoutCols === 3) {
                        this.project.settings.layoutCols = 3;
                    }
                } else { // landscape
                    if (!this.project.settings.layoutRows || this.project.settings.layoutRows === 3) {
                        this.project.settings.layoutRows = 2;
                    }
                    if (!this.project.settings.layoutCols || this.project.settings.layoutCols === 3) {
                        this.project.settings.layoutCols = 3;
                    }
                }
                // Update UI
                const layoutRowsSlider = document.getElementById('layoutRows');
                const layoutRowsInput = document.getElementById('layoutRowsInput');
                const layoutColsSlider = document.getElementById('layoutCols');
                const layoutColsInput = document.getElementById('layoutColsInput');
                if (layoutRowsSlider) layoutRowsSlider.value = this.project.settings.layoutRows;
                if (layoutRowsInput) layoutRowsInput.value = this.project.settings.layoutRows;
                if (layoutColsSlider) layoutColsSlider.value = this.project.settings.layoutCols;
                if (layoutColsInput) layoutColsInput.value = this.project.settings.layoutCols;
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
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = document.getElementById('imageSettingsCancel');
            const saveBtn = document.getElementById('imageSettingsSave');
            const removeBtn = document.getElementById('imageSettingsRemove');
            const editBtn = document.getElementById('imageSettingsEdit');
            const resetEditsBtn = document.getElementById('imageSettingsResetEdits');
            
            if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
            if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
            if (saveBtn) {
                saveBtn.onclick = () => {
                    if (this.imageSettingsController) {
                        this.imageSettingsController.saveImageSettings();
                    } else {
                        this.saveImageSettings();
                    }
                };
            }
            if (removeBtn) {
                removeBtn.onclick = () => {
                    if (this.imageSettingsController) {
                        this.imageSettingsController.removeImage();
                    } else {
                        this.removeImage();
                    }
                };
            }
            if (editBtn) {
                editBtn.onclick = () => {
                    if (this.imageSettingsController) {
                        this.imageSettingsController.editImage();
                    } else {
                        // Fallback: implement editImage directly
                        this.editImage();
                    }
                };
            }
            if (resetEditsBtn) {
                resetEditsBtn.onclick = () => {
                    if (this.imageSettingsController) {
                        this.imageSettingsController.resetImageEdits();
                    } else {
                        this.resetImageEdits();
                    }
                };
            }
        }
        
        // Add image modal
        const addModal = document.getElementById('addImageModal');
        const addCloseBtn = addModal.querySelector('.modal-close');
        const addCancelBtn = document.getElementById('addImageCancel');
        const addSaveBtn = document.getElementById('addImageSave');
        const addImageFile = document.getElementById('addImageFile');
        
        addCloseBtn.onclick = () => {
            addModal.style.display = 'none';
            this.clearAddImageModal();
        };
        addCancelBtn.onclick = () => {
            addModal.style.display = 'none';
            this.clearAddImageModal();
        };
        addSaveBtn.onclick = () => this.addImage();
        
        // Auto-populate scene/shot/frame when file is selected
        if (addImageFile) {
            addImageFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && this.imageStructureParser) {
                    this.parseSingleImageFilename(file);
                }
            });
        }
        
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
            if (e.target === addModal) addModal.style.display = 'none';
        };
        
        // Setup custom dialog
        this.setupCustomDialog();
    }
    
    /**
     * Setup drawing canvas modal and functionality
     */
    setupDrawingCanvas() {
        this.drawingCanvas = null;
        
        // Ensure DOM is ready - use DOMContentLoaded or immediate execution
        const setup = () => {
            const choiceModal = document.getElementById('addImageChoiceModal');
            const drawingModal = document.getElementById('drawingCanvasModal');
            const createDrawingBtn = document.getElementById('createDrawingBtn');
            const uploadImageBtn = document.getElementById('uploadImageBtn');
            const drawingCloseBtn = document.getElementById('drawingCanvasClose');
            const drawingCancelBtn = document.getElementById('drawingCancel');
            const drawingKeepBtn = document.getElementById('drawingKeep');
            const drawingKeepAndSaveBtn = document.getElementById('drawingKeepAndSave');
            
            if (!choiceModal) {
                console.error('addImageChoiceModal not found');
                return;
            }
            if (!createDrawingBtn) {
                console.error('createDrawingBtn not found');
            }
            if (!uploadImageBtn) {
                console.error('uploadImageBtn not found');
            }
        
            // Choice modal close
            const closeBtn = choiceModal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    choiceModal.style.display = 'none';
                };
            }
            
            // Close on backdrop click - use a named function to avoid duplicates
            if (!this.choiceModalBackdropHandler) {
                this.choiceModalBackdropHandler = (e) => {
                    // Only close if clicking directly on the modal backdrop, not on children
                    if (e.target === choiceModal) {
                        choiceModal.style.display = 'none';
                    }
                };
                choiceModal.addEventListener('click', this.choiceModalBackdropHandler);
            }
        
            // Create Drawing button
            if (createDrawingBtn) {
                createDrawingBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Create Drawing button clicked');
                    if (choiceModal) choiceModal.style.display = 'none';
                    if (this.openDrawingCanvas) {
                        this.openDrawingCanvas();
                    } else {
                        console.error('openDrawingCanvas method not found');
                    }
                });
            } else {
                console.error('createDrawingBtn not found');
            }
            
            // Upload Image button
            if (uploadImageBtn) {
                uploadImageBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (choiceModal) choiceModal.style.display = 'none';
                    const addImageModal = document.getElementById('addImageModal');
                    if (addImageModal) {
                        addImageModal.style.display = 'block';
                    } else {
                        console.error('addImageModal not found');
                    }
                });
            } else {
                console.error('uploadImageBtn not found');
            }
        
            // Drawing canvas close/cancel
            if (drawingCloseBtn) {
                drawingCloseBtn.onclick = () => this.closeDrawingCanvas();
            }
            if (drawingCancelBtn) {
                drawingCancelBtn.onclick = () => this.closeDrawingCanvas();
            }
            
            // Keep button
            if (drawingKeepBtn) {
                drawingKeepBtn.onclick = () => {
                    console.log('Keep button clicked');
                    this.keepDrawing(false);
                };
            } else {
                console.error('drawingKeepBtn not found');
            }
            
            // Keep & Save button
            if (drawingKeepAndSaveBtn) {
                drawingKeepAndSaveBtn.onclick = () => {
                    console.log('Keep & Save button clicked');
                    this.keepDrawing(true);
                };
            } else {
                console.error('drawingKeepAndSaveBtn not found');
            }
            
            // Setup drawing tools
            this.setupDrawingCanvasTools();
        };
        
        // Execute immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            // DOM is already ready, but wait a bit to ensure all elements are rendered
            setTimeout(setup, 100);
        }
    }
    
    /**
     * Setup drawing canvas tool controls
     */
    setupDrawingCanvasTools() {
        const toolBrush = document.getElementById('drawingToolBrush');
        const toolPen = document.getElementById('drawingToolPen');
        const toolEraser = document.getElementById('drawingToolEraser');
        // Paint bucket color
        const paintBucketColor = document.getElementById('drawingPaintBucketColor');
        if (paintBucketColor) {
            paintBucketColor.addEventListener('input', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setPaintBucketColor(e.target.value);
                }
            });
        }
        
        const colorPicker = document.getElementById('drawingColorPicker');
        const brushSize = document.getElementById('drawingBrushSize');
        const brushSizeValue = document.getElementById('drawingBrushSizeValue');
        const undoBtn = document.getElementById('drawingUndo');
        const redoBtn = document.getElementById('drawingRedo');
        const clearBtn = document.getElementById('drawingClear');
        
        // Tool selection
        const toolSelect = document.getElementById('drawingToolSelect');
        const toolShapes = document.getElementById('drawingToolShapes');
        const toolText = document.getElementById('drawingToolText');
        
        if (toolSelect) {
            toolSelect.addEventListener('click', () => this.setDrawingTool('select'));
        }
        if (toolBrush) {
            toolBrush.addEventListener('click', () => this.setDrawingTool('brush'));
        }
        if (toolPen) {
            toolPen.addEventListener('click', () => this.setDrawingTool('pen'));
        }
        if (toolEraser) {
            toolEraser.addEventListener('click', () => this.setDrawingTool('eraser'));
        }
        const toolPaintBucket = document.getElementById('drawingToolPaintBucket');
        if (toolPaintBucket) {
            toolPaintBucket.addEventListener('click', () => this.setDrawingTool('paintBucket'));
        }
        if (toolShapes) {
            toolShapes.addEventListener('click', () => {
                // If no shape is selected, default to rectangle
                if (!this.drawingCanvas || !this.drawingCanvas.shapeType) {
                    this.setDrawingTool('rectangle');
                } else {
                    this.setDrawingTool(this.drawingCanvas.shapeType);
                }
            });
        }
        if (toolText) {
            toolText.addEventListener('click', () => this.setDrawingTool('text'));
        }
        
        // Shape settings
        const shapeStroke = document.getElementById('drawingShapeStroke');
        const shapeWidth = document.getElementById('drawingShapeWidth');
        const shapeWidthValue = document.getElementById('drawingShapeWidthValue');
        const shapeFill = document.getElementById('drawingShapeFill');
        const shapeFillColor = document.getElementById('drawingShapeFillColor');
        const shapeFillColorGroup = document.getElementById('drawingShapeFillColorGroup');
        
        if (shapeStroke) {
            shapeStroke.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setColor(e.target.value);
                }
            });
        }
        if (shapeWidth) {
            shapeWidth.addEventListener('input', (e) => {
                const width = parseInt(e.target.value);
                if (shapeWidthValue) {
                    shapeWidthValue.textContent = width;
                }
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeStrokeWidth(width);
                }
            });
        }
        if (shapeFill) {
            shapeFill.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeFillEnabled(e.target.checked);
                    if (shapeFillColorGroup) {
                        shapeFillColorGroup.style.display = e.target.checked ? 'flex' : 'none';
                    }
                }
            });
        }
        if (shapeFillColor) {
            shapeFillColor.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeFillColor(e.target.value);
                }
            });
        }
        
        // Text settings
        const textFont = document.getElementById('drawingTextFont');
        const textSize = document.getElementById('drawingTextSize');
        const textColor = document.getElementById('drawingTextColor');
        const textBold = document.getElementById('drawingTextBold');
        const textItalic = document.getElementById('drawingTextItalic');
        const textUnderline = document.getElementById('drawingTextUnderline');
        
        if (textFont) {
            textFont.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextFont(e.target.value);
                }
            });
        }
        if (textSize) {
            textSize.addEventListener('change', (e) => {
                const size = parseInt(e.target.value) || 20;
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextSize(size);
                }
            });
        }
        if (textColor) {
            textColor.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextColor(e.target.value);
                }
            });
        }
        if (textBold) {
            textBold.addEventListener('click', () => {
                const isActive = textBold.classList.contains('active');
                textBold.classList.toggle('active');
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextStyle(!isActive, textItalic?.classList.contains('active'), textUnderline?.classList.contains('active'));
                }
            });
        }
        if (textItalic) {
            textItalic.addEventListener('click', () => {
                const isActive = textItalic.classList.contains('active');
                textItalic.classList.toggle('active');
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextStyle(textBold?.classList.contains('active'), !isActive, textUnderline?.classList.contains('active'));
                }
            });
        }
        if (textUnderline) {
            textUnderline.addEventListener('click', () => {
                const isActive = textUnderline.classList.contains('active');
                textUnderline.classList.toggle('active');
                if (this.drawingCanvas) {
                    this.drawingCanvas.setTextStyle(textBold?.classList.contains('active'), textItalic?.classList.contains('active'), !isActive);
                }
            });
        }
        
        // Brush opacity
        const brushOpacity = document.getElementById('drawingBrushOpacity');
        const brushOpacityValue = document.getElementById('drawingBrushOpacityValue');
        if (brushOpacity && brushOpacityValue) {
            brushOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                brushOpacityValue.textContent = value + '%';
                if (this.drawingCanvas) {
                    this.drawingCanvas.setBrushOpacity(value);
                }
            });
        }
        
        // Brush smoothing
        const brushSmoothing = document.getElementById('drawingBrushSmoothing');
        const brushSmoothingValue = document.getElementById('drawingBrushSmoothingValue');
        if (brushSmoothing && brushSmoothingValue) {
            brushSmoothing.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                brushSmoothingValue.textContent = value;
                if (this.drawingCanvas) {
                    this.drawingCanvas.setBrushSmoothing(value);
                }
            });
        }
        
        // Pen tool settings
        const penColorPicker = document.getElementById('drawingPenColorPicker');
        const penSize = document.getElementById('drawingPenSize');
        const penSizeValue = document.getElementById('drawingPenSizeValue');
        if (penColorPicker) {
            penColorPicker.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setColor(e.target.value);
                }
            });
        }
        if (penSize && penSizeValue) {
            penSize.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                penSizeValue.textContent = value;
                if (this.drawingCanvas) {
                    this.drawingCanvas.setBrushSize(value);
                }
            });
        }
        
        // Pen opacity
        const penOpacity = document.getElementById('drawingPenOpacity');
        const penOpacityValue = document.getElementById('drawingPenOpacityValue');
        if (penOpacity && penOpacityValue) {
            penOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                penOpacityValue.textContent = value + '%';
                if (this.drawingCanvas) {
                    this.drawingCanvas.setPenOpacity(value);
                }
            });
        }
        
        // Layer filters
        const layerFilter = document.getElementById('drawingLayerFilter');
        const layerFilterIntensity = document.getElementById('drawingLayerFilterIntensity');
        const layerFilterIntensityValue = document.getElementById('drawingLayerFilterIntensityValue');
        if (layerFilter) {
            layerFilter.addEventListener('change', (e) => {
                const filterType = e.target.value;
                const intensityControl = layerFilterIntensity;
                const intensityValue = layerFilterIntensityValue;
                
                if (filterType) {
                    if (intensityControl) intensityControl.style.display = 'block';
                    if (intensityValue) intensityValue.style.display = 'inline';
                } else {
                    if (intensityControl) intensityControl.style.display = 'none';
                    if (intensityValue) intensityValue.style.display = 'none';
                }
                
                if (this.drawingCanvas) {
                    this.drawingCanvas.applyLayerFilter(filterType, parseInt(intensityControl?.value || 50));
                }
            });
        }
        if (layerFilterIntensity && layerFilterIntensityValue) {
            layerFilterIntensity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                layerFilterIntensityValue.textContent = value;
                if (this.drawingCanvas && layerFilter) {
                    this.drawingCanvas.applyLayerFilter(layerFilter.value, value);
                }
            });
        }
        
        // Layer management
        const addLayerBtn = document.getElementById('drawingAddLayer');
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                if (this.drawingCanvas) {
                    this.addDrawingLayer();
                }
            });
        }
        
        // Layer settings bar (opacity and blending mode)
        const layerOpacity = document.getElementById('drawingLayerOpacity');
        const layerOpacityValue = document.getElementById('drawingLayerOpacityValue');
        const layerBlendingMode = document.getElementById('drawingLayerBlendingMode');
        
        if (layerOpacity && layerOpacityValue) {
            let opacityTimeout = null;
            layerOpacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                layerOpacityValue.textContent = value + '%';
                
                // Debounce the actual update to prevent lag
                clearTimeout(opacityTimeout);
                opacityTimeout = setTimeout(() => {
                    if (this.drawingCanvas) {
                        const currentLayerIndex = this.drawingCanvas.currentLayerIndex;
                        if (currentLayerIndex >= 0 && currentLayerIndex < this.drawingCanvas.layers.length) {
                            this.drawingCanvas.setLayerOpacity(currentLayerIndex, value);
                        }
                    }
                }, 10); // Small delay to batch updates
            });
        }
        
        if (layerBlendingMode) {
            layerBlendingMode.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    const currentLayerIndex = this.drawingCanvas.currentLayerIndex;
                    if (currentLayerIndex >= 0 && currentLayerIndex < this.drawingCanvas.layers.length) {
                        this.drawingCanvas.setLayerBlendingMode(currentLayerIndex, e.target.value);
                    }
                }
            });
        }
        
        // Import image button
        const importImageBtn = document.getElementById('drawingImportImage');
        if (importImageBtn) {
            importImageBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file && this.drawingCanvas) {
                        try {
                            await this.drawingCanvas.importImage(file);
                        } catch (error) {
                            await this.customAlert('Failed to import image: ' + error.message);
                        }
                    }
                };
                input.click();
            });
        }
        
        // Zoom controls
        const zoomIn = document.getElementById('drawingZoomIn');
        const zoomOut = document.getElementById('drawingZoomOut');
        const zoomFit = document.getElementById('drawingZoomFit');
        const zoomReset = document.getElementById('drawingZoomReset');
        
        if (zoomIn) {
            zoomIn.addEventListener('click', () => {
                if (this.drawingCanvas) this.drawingCanvas.zoomIn();
            });
        }
        if (zoomOut) {
            zoomOut.addEventListener('click', () => {
                if (this.drawingCanvas) this.drawingCanvas.zoomOut();
            });
        }
        if (zoomFit) {
            zoomFit.addEventListener('click', () => {
                if (this.drawingCanvas) this.drawingCanvas.zoomFit();
            });
        }
        if (zoomReset) {
            zoomReset.addEventListener('click', () => {
                if (this.drawingCanvas) this.drawingCanvas.zoomReset();
            });
        }
        
        // Transform tools (flip, skew)
        const selectionMode = document.getElementById('drawingSelectionMode');
        if (selectionMode) {
            selectionMode.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setSelectionMode(e.target.value);
                }
            });
        }
        const flipHorizontal = document.getElementById('drawingFlipHorizontal');
        const flipVertical = document.getElementById('drawingFlipVertical');
        const skewX = document.getElementById('drawingSkewX');
        const skewXValue = document.getElementById('drawingSkewXValue');
        const skewY = document.getElementById('drawingSkewY');
        const skewYValue = document.getElementById('drawingSkewYValue');
        const resetTransform = document.getElementById('drawingResetTransform');
        const opacity = document.getElementById('drawingOpacity');
        const opacityValue = document.getElementById('drawingOpacityValue');
        
        if (flipHorizontal) {
            flipHorizontal.addEventListener('click', () => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.flipHorizontal();
                }
            });
        }
        if (flipVertical) {
            flipVertical.addEventListener('click', () => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.flipVertical();
                }
            });
        }
        if (skewX) {
            skewX.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (skewXValue) {
                    skewXValue.textContent = value.toFixed(1);
                }
                if (this.drawingCanvas && skewY) {
                    const skewYVal = parseFloat(skewY.value);
                    this.drawingCanvas.applySkew(value, skewYVal);
                }
            });
        }
        if (skewY) {
            skewY.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (skewYValue) {
                    skewYValue.textContent = value.toFixed(1);
                }
                if (this.drawingCanvas && skewX) {
                    const skewXVal = parseFloat(skewX.value);
                    this.drawingCanvas.applySkew(skewXVal, value);
                }
            });
        }
        if (resetTransform) {
            resetTransform.addEventListener('click', () => {
                if (this.drawingCanvas && this.drawingCanvas.selectedShape) {
                    const shape = this.drawingCanvas.selectedShape;
                    shape.scaleX(1);
                    shape.scaleY(1);
                    shape.rotation(0);
                    shape.skewX(0);
                    shape.skewY(0);
                    this.drawingCanvas.getCurrentLayer().draw();
                    this.drawingCanvas.saveState();
                    if (this.drawingCanvas.onHistoryChange) {
                        this.drawingCanvas.onHistoryChange();
                    }
                    // Reset sliders
                    if (skewX) {
                        skewX.value = 0;
                        if (skewXValue) skewXValue.textContent = '0°';
                    }
                    if (skewY) {
                        skewY.value = 0;
                        if (skewYValue) skewYValue.textContent = '0°';
                    }
                }
            });
        }
        if (opacity) {
            opacity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (opacityValue) {
                    opacityValue.textContent = value + '%';
                }
                if (this.drawingCanvas && this.drawingCanvas.selectedShape) {
                    this.drawingCanvas.selectedShape.opacity(value / 100);
                    this.drawingCanvas.getCurrentLayer().draw();
                }
            });
        }
        
        // Shapes tool - unified tool for rectangle, circle, ellipse, triangle, polygon, line, arrow
        const shapeMenuBtn = document.getElementById('drawingShapeMenuBtn');
        const shapeMenu = document.getElementById('drawingShapeMenu');
        const shapeGrid = document.getElementById('drawingShapeGrid');
        
        // Flag to prevent close handler from interfering immediately after menu item click
        // Declared outside blocks so it's accessible to all handlers
        let menuItemJustClicked = false;
        
        // Setup shapes menu button - handle both instances (basic shapes and custom shapes)
        // Use event delegation to handle buttons that may be added dynamically
        if (shapeMenu) {
            
            // Use event delegation on document to catch clicks on any shape menu button
            document.addEventListener('click', (e) => {
                const clickedBtn = e.target.closest('.drawing-shape-menu-btn, #drawingShapeMenuBtn');
                if (clickedBtn && shapeMenu) {
                    e.preventDefault();
                    e.stopPropagation();
                    const isVisible = shapeMenu.style.display !== 'none';
                    
                    if (!isVisible) {
                        // Position menu relative to the clicked button
                        const btnRect = clickedBtn.getBoundingClientRect();
                        
                        // Position menu below the button with proper z-index
                        shapeMenu.style.position = 'fixed';
                        shapeMenu.style.top = (btnRect.bottom + 5) + 'px';
                        shapeMenu.style.left = btnRect.left + 'px';
                        shapeMenu.style.zIndex = '10001';
                        shapeMenu.style.display = 'block';
                    } else {
                        shapeMenu.style.display = 'none';
                    }
                }
            }, true); // Use capture phase to run before close handler
            
            // Close menu when clicking outside (but not when clicking on canvas during drawing)
            // Use setTimeout to ensure this runs after the button click handler
            document.addEventListener('click', (e) => {
                setTimeout(() => {
                    // Skip if menu item was just clicked (handled by menu item handler)
                    if (menuItemJustClicked) {
                        menuItemJustClicked = false;
                        return;
                    }
                    
                    if (!shapeMenu || shapeMenu.style.display === 'none') return;
                    
                    // Get all shape menu buttons dynamically (in case new ones were added)
                    const allShapeMenuButtons = document.querySelectorAll('.drawing-shape-menu-btn, #drawingShapeMenuBtn');
                    
                    // Don't close if clicking on any shape menu button or its children
                    const clickedOnButton = Array.from(allShapeMenuButtons).some(btn => {
                        return btn.contains(e.target) || btn === e.target || e.target.closest('.drawing-shape-menu-btn, #drawingShapeMenuBtn') === btn;
                    });
                    // Don't close if clicking inside the menu (including SVG elements inside)
                    // Also check if clicking on menu grid items or their children
                    const clickedOnMenuItem = e.target.closest('.custom-shape-grid-item') !== null;
                    const clickedInMenu = shapeMenu.contains(e.target) || 
                                         e.target.closest('#drawingShapeMenu') === shapeMenu ||
                                         clickedOnMenuItem;
                    // Don't close if clicking on canvas (might be drawing)
                    const clickedOnCanvas = e.target.closest('.drawing-canvas-container') || e.target.closest('canvas');
                    
                    if (!clickedOnButton && !clickedInMenu && !clickedOnCanvas) {
                        shapeMenu.style.display = 'none';
                    }
                }, 0);
            });
        }
        
        // Setup shapes grid - unified menu with basic shapes and custom arrows
        if (shapeGrid) {
            // Basic shapes section
            const basicShapes = [
                { value: 'rectangle', title: 'Rectangle', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>' },
                { value: 'circle', title: 'Circle', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' },
                { value: 'ellipse', title: 'Ellipse', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>' },
                { value: 'triangle', title: 'Triangle', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L22 20 L2 20 Z"/></svg>' },
                { value: 'polygon', title: 'Polygon', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L22 8 L18 20 L6 20 L2 8 Z"/></svg>' },
                { value: 'line', title: 'Line', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>' },
                { value: 'arrow', title: 'Arrow', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="18" y2="12"/><polyline points="18 8 22 12 18 16"/></svg>' }
            ];
            
            // Custom arrows section - using exact normalized paths from DrawingCanvas.js
            // Helper function to normalize points and create SVG (same logic as DrawingCanvas)
            // Also ensures the icon fits within a square by scaling the viewBox
            const normalizePathAndCreateSVG = (points) => {
                const minX = Math.min(...points.map(p => p.x));
                const minY = Math.min(...points.map(p => p.y));
                const normalized = points.map(p => ({ x: p.x - minX, y: p.y - minY }));
                const pathData = 'M ' + normalized.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
                const maxX = Math.max(...normalized.map(p => p.x));
                const maxY = Math.max(...normalized.map(p => p.y));
                
                // Calculate dimensions and ensure it fits in a square
                const width = maxX;
                const height = maxY;
                const maxDim = Math.max(width, height);
                const padding = maxDim * 0.1; // 10% padding
                const viewBoxSize = maxDim + padding * 2;
                
                // Center the shape in the viewBox
                const offsetX = (viewBoxSize - width) / 2;
                const offsetY = (viewBoxSize - height) / 2;
                
                return `<svg viewBox="${-offsetX} ${-offsetY} ${viewBoxSize} ${viewBoxSize}" fill="currentColor"><path d="${pathData}"/></svg>`;
            };
            
            // Helper to create SVG from path string (for arrows that already have normalized paths)
            const createSVGFromPath = (pathData) => {
                // Parse path to get bounding box
                const pathMatch = pathData.match(/[ML]\s+([-\d.]+)\s+([-\d.]+)/g);
                if (!pathMatch) return `<svg viewBox="0 0 40 40" fill="currentColor"><path d="${pathData}"/></svg>`;
                
                const points = pathMatch.map(m => {
                    const coords = m.match(/([-\d.]+)\s+([-\d.]+)/);
                    return { x: parseFloat(coords[1]), y: parseFloat(coords[2]) };
                });
                
                const minX = Math.min(...points.map(p => p.x));
                const minY = Math.min(...points.map(p => p.y));
                const maxX = Math.max(...points.map(p => p.x));
                const maxY = Math.max(...points.map(p => p.y));
                
                const width = maxX - minX;
                const height = maxY - minY;
                const maxDim = Math.max(width, height);
                const padding = maxDim * 0.1;
                const viewBoxSize = maxDim + padding * 2;
                
                // Center the shape
                const offsetX = (viewBoxSize - width) / 2 - minX;
                const offsetY = (viewBoxSize - height) / 2 - minY;
                
                return `<svg viewBox="${-offsetX} ${-offsetY} ${viewBoxSize} ${viewBoxSize}" fill="currentColor"><path d="${pathData}"/></svg>`;
            };
            
            const customArrows = [
                { value: 'arrow-roll', title: 'Camera Roll', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12 Q8 6 12 12 Q16 18 20 12" stroke-linecap="round"/><polyline points="20 12 22 10"/></svg>' },
                { value: 'arrow-zoom-in', title: 'Zoom In', svg: '<svg viewBox="0 0 120 60" fill="currentColor"><path d="M0,0 L0,60 L70,45 L70,60 L120,30 L70,0 L70,15 Z"/></svg>' },
                { value: 'arrow-zoom-out', title: 'Zoom Out', svg: '<svg viewBox="0 0 130 100" fill="currentColor"><path d="M0,20 L0,30 L80,55 L80,75 L130,25 L80,-25 L80,-5 Z"/></svg>' },
                { value: 'arrow-u-turn', title: 'U-Turn', svg: '<svg viewBox="0 0 130 120" fill="currentColor"><path d="M0,0 L80,0 C110,0 110,60 80,60 L60,60 L60,40 L20,70 L60,100 L60,80 L80,80 C130,80 130,-20 80,-20 L0,-20 Z"/></svg>' },
                { value: 'arrow-split', title: 'Split Path', svg: '<svg viewBox="0 0 120 120" fill="currentColor"><rect x="0" y="-10" width="60" height="20"/><path d="M50,0 L120,-50" stroke="currentColor" stroke-width="3" fill="none"/><path d="M50,0 L120,50" stroke="currentColor" stroke-width="3" fill="none"/><polyline points="120,-50 130,-60" stroke="currentColor" stroke-width="3" fill="none"/><polyline points="120,50 130,60" stroke="currentColor" stroke-width="3" fill="none"/></svg>' },
                { value: 'arrow-whip', title: 'Whip Pan', svg: '<svg viewBox="0 0 140 40" fill="none" stroke="currentColor" stroke-width="2"><line x1="20" y1="0" x2="140" y2="0"/><line x1="0" y1="-20" x2="80" y2="-20" stroke-width="1"/><line x1="10" y1="20" x2="90" y2="20" stroke-width="1"/><polyline points="140,0 155,-15"/></svg>' },
                { value: 'arrow-dotted', title: 'Dotted', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3,3"><line x1="2" y1="12" x2="18" y2="12"/><polyline points="18 12 20 10"/></svg>' },
                { value: 'arrow-double', title: 'Two-Way', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><polyline points="18 8 22 12 18 16"/><polyline points="6 16 2 12 6 8"/></svg>' },
                { value: 'arrow-thin-zoom', title: 'Thin Zoom', svg: '<svg viewBox="0 0 140 30" fill="currentColor"><path d="M0,0 L0,20 L100,15 L100,30 L140,10 L100,-10 L100,5 Z"/></svg>' },
                // Custom arrows 01-14: Using exact same point arrays and normalization as DrawingCanvas.js
                // Note: Arrows 7, 8, 9 currently use the same path as arrow 3 in DrawingCanvas.js
                // We'll use the normalized paths from the drawing code for consistency
                { value: 'arrow-custom-01', title: 'Custom Arrow 01', svg: createSVGFromPath('M 0 0 L 65.7050018311 0 L 65.7050018311 -8.5979995728 L 86.8809967041 12.5769996643 L 65.7050018311 33.7560005188 L 65.7050018311 25.158000946 L 0 25.158000946 Z') },
                { value: 'arrow-custom-02', title: 'Custom Arrow 02', svg: normalizePathAndCreateSVG([{x: 221.1380004883, y: 874.1599731445}, {x: 229.7350006104, y: 874.1599731445}, {x: 219.7350006104, y: 835.4559936523}, {x: 264.8930053711, y: 835.4559936523}, {x: 254.8930053711, y: 874.1599731445}, {x: 263.4909973145, y: 874.1599731445}, {x: 242.3150024414, y: 889.3359985352}]) },
                { value: 'arrow-custom-03', title: 'Custom Arrow 03', svg: normalizePathAndCreateSVG([{x: 343.1220092773, y: 839.9459838867}, {x: 351.7200012207, y: 839.9459838867}, {x: 351.7200012207, y: 838.2940063477}, {x: 351.7200012207, y: 801.241027832}, {x: 351.7200012207, y: 799.5889892578}, {x: 343.1220092773, y: 799.5889892578}, {x: 364.299987793, y: 778.4140014648}, {x: 385.4750061035, y: 799.5889892578}, {x: 376.8779907227, y: 799.5889892578}, {x: 376.8779907227, y: 801.241027832}, {x: 376.8779907227, y: 838.2940063477}, {x: 376.8779907227, y: 839.9459838867}, {x: 385.4750061035, y: 839.9459838867}, {x: 364.299987793, y: 861.1220092773}]) },
                { value: 'arrow-custom-04', title: 'Custom Arrow 04', svg: createSVGFromPath('M 0 0 L 0 -22 C -19.037 -22.078 -41.287 -20.434 -41.287 -7.627 C -41.287 1.064 -41.262 3.941 -41.287 8.176 C -39.319 -0.967 -18.066 -0.072 0 0 Z M -41.287 8.176 L -20.11 -12.999 L -41.287 -34.177 Z') },
                { value: 'arrow-custom-05', title: 'Custom Arrow 05', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 18.809, y: -17.695}, {x: -0.076, y: -40.689}, {x: -0.061, y: -32.423}, {x: -34.504, y: -37.265}, {x: -34.458, y: -13.099}, {x: -0.016, y: -8.257}]) },
                { value: 'arrow-custom-06', title: 'Custom Arrow 06', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: -0.016, y: -8.266}, {x: 34.436, y: -3.423}, {x: 34.39, y: -27.59}, {x: -0.061, y: -32.432}, {x: -0.076, y: -40.689}, {x: -18.886, y: -23.002}]) },
                // Arrows 7, 8, 9: Extract paths from SVG files and convert relative to absolute
                // Arrow 07: Main path from arrow_07.svg (converted from relative to absolute)
                { value: 'arrow-custom-07', title: 'Custom Arrow 07', svg: normalizePathAndCreateSVG([{x: 314.9, y: 21.4}, {x: 410.5, y: 231.1}, {x: 323, y: 479.8}, {x: 321.4, y: 386.7}, {x: 154.1, y: 422.3}, {x: 149.3, y: 150.1}, {x: 316.5, y: 114.5}]) },
                // Arrow 08: Using the clipPath path from arrow_08.svg (same as arrow_02 structure)
                { value: 'arrow-custom-08', title: 'Custom Arrow 08', svg: normalizePathAndCreateSVG([{x: 221.1380004883, y: 874.1599731445}, {x: 229.7350006104, y: 874.1599731445}, {x: 219.7350006104, y: 835.4559936523}, {x: 264.8930053711, y: 835.4559936523}, {x: 254.8930053711, y: 874.1599731445}, {x: 263.4909973145, y: 874.1599731445}, {x: 242.3150024414, y: 889.3359985352}]) },
                // Arrow 09: Main path from arrow_09.svg (converted from relative to absolute)
                { value: 'arrow-custom-09', title: 'Custom Arrow 09', svg: normalizePathAndCreateSVG([{x: 186, y: 21.8}, {x: 186, y: 111.4}, {x: 333.2, y: 222.3}, {x: 333.3, y: 484.6}, {x: 186.1, y: 373.7}, {x: 186.2, y: 463.3}, {x: 105.6, y: 181.9}]) },
                { value: 'arrow-custom-10', title: 'Custom Arrow 10', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 7.422, y: -25.906}, {x: 0.017, y: -40.639}, {x: 0.014, y: -32.392}, {x: -13.535, y: -22.183}, {x: -13.545, y: 1.962}, {x: 0.003, y: -8.247}]) },
                { value: 'arrow-custom-11', title: 'Custom Arrow 11', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 7.426, y: -25.908}, {x: 4.413, y: -23.639}, {x: 4.429, y: -60.78}, {x: -4.378, y: -54.144}, {x: -4.394, y: -17.002}, {x: -7.402, y: -14.735}]) },
                { value: 'arrow-custom-12', title: 'Custom Arrow 12', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 5.62, y: -0.594}, {x: 7.406, y: -14.733}, {x: 1.786, y: -14.139}]) },
                { value: 'arrow-custom-13', title: 'Custom Arrow 13', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 8.807, y: -6.636}, {x: 8.822, y: -43.777}, {x: 11.834, y: -46.047}, {x: 4.429, y: -60.78}, {x: -2.994, y: -34.874}, {x: 0.015, y: -37.142}]) },
                { value: 'arrow-custom-14', title: 'Custom Arrow 14', svg: normalizePathAndCreateSVG([{x: 0, y: 0}, {x: 27, y: -3.606}, {x: 18.894, y: -4.174}, {x: 31.737, y: -13.321}, {x: 8.002, y: -14.981}, {x: -4.841, y: -5.834}, {x: -12.948, y: -6.402}]) }
            ];
            
            shapeGrid.innerHTML = '';
            
            // Add section header for basic shapes
            const basicHeader = document.createElement('div');
            basicHeader.style.cssText = 'grid-column: 1 / -1; padding: 8px 4px 4px; font-size: 11px; color: #888; font-weight: bold; text-transform: uppercase;';
            basicHeader.textContent = 'Basic Shapes';
            shapeGrid.appendChild(basicHeader);
            
            // Add basic shapes
            basicShapes.forEach(shape => {
                const btn = document.createElement('button');
                btn.className = 'custom-shape-grid-item';
                btn.title = shape.title;
                btn.dataset.shape = shape.value;
                btn.style.cssText = 'width: 40px; height: 40px; padding: 5px; background: #3c3c3c; border: 1px solid #444; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #ccc;';
                btn.innerHTML = shape.svg;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.drawingCanvas) {
                        this.drawingCanvas.shapeType = shape.value;
                        this.setDrawingTool(shape.value);
                        shapeGrid.querySelectorAll('.custom-shape-grid-item').forEach(item => {
                            item.style.background = '#3c3c3c';
                        });
                        btn.style.background = '#007acc';
                        // Close menu after a short delay to ensure click handlers have processed
                        setTimeout(() => {
                            if (shapeMenu) {
                                shapeMenu.style.display = 'none';
                            }
                        }, 100);
                    }
                }, true); // Use capture phase to handle before close handler
                shapeGrid.appendChild(btn);
            });
            
            // Add section divider
            const divider = document.createElement('div');
            divider.style.cssText = 'grid-column: 1 / -1; height: 1px; background: #444; margin: 8px 0;';
            shapeGrid.appendChild(divider);
            
            // Add section header for custom arrows
            const customHeader = document.createElement('div');
            customHeader.style.cssText = 'grid-column: 1 / -1; padding: 8px 4px 4px; font-size: 11px; color: #888; font-weight: bold; text-transform: uppercase;';
            customHeader.textContent = 'Custom Arrows';
            shapeGrid.appendChild(customHeader);
            
            // Add custom arrows
            customArrows.forEach(shape => {
                const btn = document.createElement('button');
                btn.className = 'custom-shape-grid-item';
                btn.title = shape.title;
                btn.dataset.shape = shape.value;
                btn.style.cssText = 'width: 40px; height: 40px; padding: 5px; background: #3c3c3c; border: 1px solid #444; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #ccc;';
                btn.innerHTML = shape.svg;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Set flag to prevent close handler from interfering
                    menuItemJustClicked = true;
                    if (this.drawingCanvas) {
                        // Store the custom shape type
                        this.drawingCanvas.customShapeType = shape.value;
                        // Treat custom shapes like normal shapes - use the shape tool but store the type
                        // This way they use the same settings panel and button behavior
                        this.drawingCanvas.shapeType = 'customShape';
                        this.setDrawingTool('customShape');
                        shapeGrid.querySelectorAll('.custom-shape-grid-item').forEach(item => {
                            item.style.background = '#3c3c3c';
                        });
                        btn.style.background = '#007acc';
                        // Close menu immediately (same as basic shapes)
                        if (shapeMenu) {
                            shapeMenu.style.display = 'none';
                        }
                        // Clear flag after a short delay
                        setTimeout(() => { menuItemJustClicked = false; }, 50);
                    }
                }, true); // Use capture phase to handle before close handler
                shapeGrid.appendChild(btn);
            });
        }
        
        // Custom shape settings (stroke, fill, etc. - still needed for custom shapes)
        const customShapeStroke = document.getElementById('drawingCustomShapeStroke');
        const customShapeWidth = document.getElementById('drawingCustomShapeWidth');
        const customShapeWidthValue = document.getElementById('drawingCustomShapeWidthValue');
        const customShapeFill = document.getElementById('drawingCustomShapeFill');
        const customShapeFillColorGroup = document.getElementById('drawingCustomShapeFillColorGroup');
        const customShapeFillColor = document.getElementById('drawingCustomShapeFillColor');
        if (customShapeStroke) {
            customShapeStroke.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setColor(e.target.value);
                }
            });
        }
        if (customShapeFill) {
            customShapeFill.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeFillEnabled(e.target.checked);
                }
                if (customShapeFillColorGroup) {
                    customShapeFillColorGroup.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }
        if (customShapeFillColor) {
            customShapeFillColor.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeFillColor(e.target.value);
                }
            });
        }
        if (customShapeWidth) {
            customShapeWidth.addEventListener('input', (e) => {
                const width = parseInt(e.target.value);
                if (customShapeWidthValue) {
                    customShapeWidthValue.textContent = width;
                }
                if (this.drawingCanvas) {
                    this.drawingCanvas.setShapeStrokeWidth(width);
                }
            });
        }
        
        // Aspect ratio and crop
        const aspectRatioSelect = document.getElementById('drawingAspectRatio');
        const cropBtn = document.getElementById('drawingCrop');
        
        if (aspectRatioSelect) {
            aspectRatioSelect.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.applyAspectRatio(e.target.value);
                }
            });
        }
        
        if (cropBtn) {
            cropBtn.addEventListener('click', () => {
                if (this.drawingCanvas) {
                    this.setDrawingTool('crop');
                }
            });
        }
        
        // Color picker
        if (colorPicker) {
            // Update color immediately on input (as user drags) and on change (when released)
            colorPicker.addEventListener('input', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setColor(e.target.value);
                }
            });
            colorPicker.addEventListener('change', (e) => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.setColor(e.target.value);
                }
            });
        }
        
        // Brush size
        if (brushSize) {
            brushSize.oninput = (e) => {
                const size = parseInt(e.target.value);
                if (brushSizeValue) {
                    brushSizeValue.textContent = size;
                }
                if (this.drawingCanvas) {
                    this.drawingCanvas.setBrushSize(size);
                }
            };
        }
        
        // Undo/Redo/Clear
        if (undoBtn) {
            undoBtn.onclick = () => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.undo();
                    this.updateDrawingCanvasButtons();
                }
            };
        }
        if (redoBtn) {
            redoBtn.onclick = () => {
                if (this.drawingCanvas) {
                    this.drawingCanvas.redo();
                    this.updateDrawingCanvasButtons();
                }
            };
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (this.drawingCanvas) {
                    // Ensure dialog appears above drawing canvas
                    const dialog = document.getElementById('customDialog');
                    if (dialog) {
                        dialog.style.zIndex = '10002';
                    }
                    const confirmed = await this.customConfirm('Clear the entire canvas?');
                    if (confirmed) {
                        this.drawingCanvas.clear();
                        this.updateDrawingCanvasButtons();
                        this.updateLayersUI();
                    }
                }
            });
        }
    }
    
    /**
     * Open drawing canvas modal
     * @param {Object} options - Options for opening canvas
     * @param {string} options.imageUrl - Optional image URL to use as background
     * @param {number} options.imageWidth - Optional image width
     * @param {number} options.imageHeight - Optional image height
     * @param {Array} options.editLayers - Optional edit layer data to restore
     */
    openDrawingCanvas(options = {}) {
        const modal = document.getElementById('drawingCanvasModal');
        const container = document.getElementById('drawingCanvasWrapper');
        const canvasContainer = document.getElementById('drawingCanvasContainer');
        
        if (!modal || !container || !canvasContainer) return;
        
        modal.style.display = 'block';
        
        // Initialize canvas after modal is shown
        setTimeout(() => {
            // Get dimensions from the parent container (drawingCanvasContainer) which has flex: 1
            const containerRect = canvasContainer.getBoundingClientRect();
            
            // Calculate available space (accounting for padding)
            let availableWidth = Math.floor(containerRect.width - 40); // 20px padding on each side
            let availableHeight = Math.floor(containerRect.height - 40); // 20px padding on top and bottom
            
            // If container is too small or invalid, use viewport size minus panels
            if (availableWidth <= 0 || availableHeight <= 0 || isNaN(availableWidth) || isNaN(availableHeight)) {
                // Account for left panel (60px), right panel (250px), and padding
                availableWidth = Math.floor(window.innerWidth - 60 - 250 - 40);
                availableHeight = Math.floor(window.innerHeight - 200); // Account for top bar and bottom controls
            }
            
            // Calculate aspect ratio FIRST before creating canvas
            const aspectRatioSelect = document.getElementById('drawingAspectRatio');
            let targetAspectRatio = null;
            if (aspectRatioSelect) {
                // Get selected ratio - default to '16:9' if not set
                const selectedRatio = aspectRatioSelect.value || '16:9';
                
                if (selectedRatio === 'page') {
                    // Use the helper function to ensure exact match with RenderService
                    targetAspectRatio = this.calculatePageAspectRatio();
                } else if (selectedRatio !== 'custom') {
                    // Parse ratio like "16:9"
                    const [w, h] = selectedRatio.split(':').map(Number);
                    targetAspectRatio = w / h;
                }
            }
            
            // If we have an image to edit, calculate canvas size to match image aspect ratio exactly
            let width, height;
            if (options.imageUrl && options.imageWidth && options.imageHeight) {
                const imageAspectRatio = options.imageWidth / options.imageHeight;
                const containerAspectRatio = availableWidth / availableHeight;
                
                // Fit image to available space while maintaining exact aspect ratio
                if (imageAspectRatio > containerAspectRatio) {
                    // Image is wider - fit to width
                    width = availableWidth;
                    height = width / imageAspectRatio;
                } else {
                    // Image is taller - fit to height
                    height = availableHeight;
                    width = height * imageAspectRatio;
                }
                
                // Ensure minimum size
                if (width < 400) {
                    width = 400;
                    height = width / imageAspectRatio;
                }
                if (height < 300) {
                    height = 300;
                    width = height * imageAspectRatio;
                }
                
                // Don't exceed available space
                if (width > availableWidth) {
                    width = availableWidth;
                    height = width / imageAspectRatio;
                }
                if (height > availableHeight) {
                    height = availableHeight;
                    width = height * imageAspectRatio;
                }
            } else if (targetAspectRatio) {
                // No image - use aspect ratio from dropdown
                const containerAspectRatio = availableWidth / availableHeight;
                
                // Fit to container while maintaining aspect ratio
                if (targetAspectRatio > containerAspectRatio) {
                    // Canvas aspect ratio is wider - fit to width
                    width = availableWidth;
                    height = width / targetAspectRatio;
                } else {
                    // Canvas aspect ratio is taller - fit to height
                    height = availableHeight;
                    width = height * targetAspectRatio;
                }
                
                // Ensure minimum size
                if (width < 200) {
                    width = 200;
                    height = width / targetAspectRatio;
                }
                if (height < 150) {
                    height = 150;
                    width = height * targetAspectRatio;
                }
                
                // Don't exceed available space
                if (width > availableWidth) {
                    width = availableWidth;
                    height = width / targetAspectRatio;
                }
                if (height > availableHeight) {
                    height = availableHeight;
                    width = height * targetAspectRatio;
                }
            } else {
                // No image and no aspect ratio - use available space with minimums
                width = Math.max(availableWidth, 600);
                height = Math.max(availableHeight, 400);
            }
            
            // Round to integers
            width = Math.floor(width);
            height = Math.floor(height);
            
            // Set wrapper size explicitly to ensure proper layout
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            container.style.minWidth = '0'; // Allow wrapper to shrink
            container.style.minHeight = '0'; // Allow wrapper to shrink
            container.style.maxWidth = width + 'px'; // Prevent expansion beyond canvas size
            container.style.maxHeight = height + 'px'; // Prevent expansion beyond canvas size
            container.style.margin = 'auto';
            container.style.display = 'block';
            
            // Store wrapper dimensions for zoom to reference
            container.dataset.baseWidth = width;
            container.dataset.baseHeight = height;
            
            this.drawingCanvas = new DrawingCanvas(container, width, height);
            
            // Set aspect ratio on canvas if we calculated it
            // CRITICAL: Store in both places to ensure resize handlers always use it
            if (targetAspectRatio) {
                this.drawingCanvas.aspectRatio = targetAspectRatio;
                this.drawingCanvas.originalAspectRatio = targetAspectRatio; // Also update original
            }
            
            // Set background image if provided
            if (options.imageUrl) {
                // Use the actual image dimensions, not the canvas size
                this.drawingCanvas.setBackgroundImage(
                    options.imageUrl,
                    options.imageWidth,
                    options.imageHeight
                );
            }
            
            // Load edit layers if provided
            if (options.editLayers && options.editLayers.length > 0) {
                setTimeout(() => {
                    this.drawingCanvas.loadEditLayerData(options.editLayers);
                }, 100);
            }
            
            // Store image editing context if provided
            this.drawingCanvas.editingImage = options.editingImage || null;
            
            // Setup callbacks
            this.drawingCanvas.onHistoryChange = () => {
                this.updateDrawingCanvasButtons();
            };
            this.drawingCanvas.onLayersChange = () => {
                this.updateLayersUI();
            };
            
            // Add beforeunload handler to warn about unsaved changes
            this.drawingCanvasBeforeUnloadHandler = (e) => {
                if (this.drawingCanvas && this.drawingCanvas.hasUnsavedChanges) {
                    e.preventDefault();
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                    return e.returnValue;
                }
            };
            window.addEventListener('beforeunload', this.drawingCanvasBeforeUnloadHandler);
            this.drawingCanvas.onSelectionChange = (shape) => {
                this.updateToolSettings();
                // Update text settings UI if a text is selected
                if (shape && shape.getType && shape.getType() === 'Text') {
                    this.updateTextSettingsUI(shape);
                }
            };
            
            this.setDrawingTool('select');
            this.updateDrawingCanvasButtons();
            this.updateToolSettings();
            
            // Update layers UI immediately and also trigger the callback
            // Call it multiple times to ensure it works
            this.updateLayersUI();
            setTimeout(() => {
                this.updateLayersUI();
            }, 100);
            setTimeout(() => {
                this.updateLayersUI();
            }, 300);
            
            // Initialize lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            
            // Handle window resize - maintain aspect ratio if editing an image
            const resizeObserver = new ResizeObserver(() => {
                if (this.drawingCanvas && container && canvasContainer) {
                    const newContainerRect = canvasContainer.getBoundingClientRect();
                    let availableWidth = Math.floor(newContainerRect.width - 40);
                    let availableHeight = Math.floor(newContainerRect.height - 40);
                    
                    // If editing an image, maintain aspect ratio
                    if (this.drawingCanvas.backgroundImageUrl && this.drawingCanvas.originalAspectRatio) {
                        const containerAspectRatio = availableWidth / availableHeight;
                        let newWidth, newHeight;
                        
                        if (this.drawingCanvas.originalAspectRatio > containerAspectRatio) {
                            // Canvas is wider - fit to width
                            newWidth = availableWidth;
                            newHeight = availableWidth / this.drawingCanvas.originalAspectRatio;
                        } else {
                            // Canvas is taller - fit to height
                            newHeight = availableHeight;
                            newWidth = availableHeight * this.drawingCanvas.originalAspectRatio;
                        }
                        
                        // Ensure minimum size
                        if (newWidth < 400) {
                            newWidth = 400;
                            newHeight = newWidth / this.drawingCanvas.originalAspectRatio;
                        }
                        if (newHeight < 300) {
                            newHeight = 300;
                            newWidth = newHeight * this.drawingCanvas.originalAspectRatio;
                        }
                        
                        // Only resize if dimensions changed significantly
                        if (Math.abs(newWidth - this.drawingCanvas.width) > 1 || 
                            Math.abs(newHeight - this.drawingCanvas.height) > 1) {
                            container.style.width = newWidth + 'px';
                            container.style.height = newHeight + 'px';
                            container.style.minWidth = newWidth + 'px';
                            container.style.minHeight = newHeight + 'px';
                            container.style.maxWidth = newWidth + 'px';
                            container.style.maxHeight = newHeight + 'px';
                            // Use resizeWithScale to maintain aspect ratio and scale content
                            if (this.drawingCanvas.resizeWithScale) {
                                this.drawingCanvas.resizeWithScale(newWidth, newHeight);
                            } else {
                                this.drawingCanvas.resize(newWidth, newHeight);
                            }
                        }
                    } else {
                        // No image - maintain aspect ratio from dropdown
                        const aspectRatio = this.drawingCanvas.aspectRatio || this.drawingCanvas.originalAspectRatio;
                        const containerAspectRatio = availableWidth / availableHeight;
                        let newWidth, newHeight;
                        
                        if (aspectRatio > containerAspectRatio) {
                            // Canvas is wider - fit to width
                            newWidth = availableWidth;
                            newHeight = newWidth / aspectRatio;
                        } else {
                            // Canvas is taller - fit to height
                            newHeight = availableHeight;
                            newWidth = newHeight * aspectRatio;
                        }
                        
                        // Ensure minimum size
                        if (newWidth < 200) {
                            newWidth = 200;
                            newHeight = newWidth / aspectRatio;
                        }
                        if (newHeight < 150) {
                            newHeight = 150;
                            newWidth = newHeight * aspectRatio;
                        }
                        
                        // Only resize if dimensions changed significantly
                        if (Math.abs(newWidth - this.drawingCanvas.width) > 5 || 
                            Math.abs(newHeight - this.drawingCanvas.height) > 5) {
                            container.style.width = newWidth + 'px';
                            container.style.height = newHeight + 'px';
                            container.style.minWidth = newWidth + 'px';
                            container.style.minHeight = newHeight + 'px';
                            container.style.maxWidth = newWidth + 'px';
                            container.style.maxHeight = newHeight + 'px';
                            // Use resizeWithScale to maintain aspect ratio and scale content
                            if (this.drawingCanvas.resizeWithScale) {
                                this.drawingCanvas.resizeWithScale(newWidth, newHeight);
                            } else {
                                this.drawingCanvas.resize(newWidth, newHeight);
                            }
                        }
                    }
                }
            });
            resizeObserver.observe(canvasContainer);
            
            // Store observer for cleanup
            this.drawingCanvasResizeObserver = resizeObserver;
        }, 100);
    }
    
    /**
     * Close drawing canvas modal
     */
    closeDrawingCanvas(force = false) {
        // Check for unsaved changes
        if (!force && this.drawingCanvas && this.drawingCanvas.hasUnsavedChanges) {
            const choice = confirm('You have unsaved changes.\n\nClick OK to keep your drawing, or Cancel to discard and close.');
            if (choice) {
                // User wants to keep, so call keepDrawing
                this.keepDrawing(false);
                return;
            }
            // User clicked Cancel - they want to discard, but we should ask if they want to stay
            const stay = confirm('Do you want to stay and continue editing?');
            if (stay) {
                // User wants to stay, don't close
                return;
            }
            // User wants to discard and close, continue with close
        }
        
        const modal = document.getElementById('drawingCanvasModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Clean up resize observer
        if (this.drawingCanvasResizeObserver) {
            this.drawingCanvasResizeObserver.disconnect();
            this.drawingCanvasResizeObserver = null;
        }
        
        // Remove beforeunload handler
        if (this.drawingCanvasBeforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.drawingCanvasBeforeUnloadHandler);
            this.drawingCanvasBeforeUnloadHandler = null;
        }
        
        if (this.drawingCanvas) {
            this.drawingCanvas.destroy();
            this.drawingCanvas = null;
        }
        
        // Clear inputs
        const sceneInput = document.getElementById('drawingScene');
        const shotInput = document.getElementById('drawingShot');
        const frameInput = document.getElementById('drawingFrame');
        if (sceneInput) sceneInput.value = '';
        if (shotInput) shotInput.value = '';
        if (frameInput) frameInput.value = '';
    }
    
    /**
     * Set drawing tool
     */
    setDrawingTool(tool) {
        if (!this.drawingCanvas) return;
        
        this.drawingCanvas.setTool(tool);
        
        // Update button states - remove active from all
        const toolIds = ['drawingToolSelect', 'drawingToolBrush', 'drawingToolPen', 'drawingToolEraser', 
                         'drawingToolShapes', 'drawingToolText',
                         'drawingToolPaintBucket', 'drawingCrop'];
        toolIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('active');
        });
        
        // Add active to selected tool
        const toolMap = {
            'select': 'drawingToolSelect',
            'brush': 'drawingToolBrush',
            'pen': 'drawingToolPen',
            'eraser': 'drawingToolEraser',
            'rectangle': 'drawingToolShapes',
            'circle': 'drawingToolShapes',
            'ellipse': 'drawingToolShapes',
            'triangle': 'drawingToolShapes',
            'polygon': 'drawingToolShapes',
            'line': 'drawingToolShapes',
            'arrow': 'drawingToolShapes',
            'text': 'drawingToolText',
            'customShape': 'drawingToolShapes',
            'crop': 'drawingCrop',
            'paintBucket': 'drawingToolPaintBucket'
        };
        
        const activeBtnId = toolMap[tool];
        if (activeBtnId) {
            const activeBtn = document.getElementById(activeBtnId);
            if (activeBtn) activeBtn.classList.add('active');
        }
        
        // Update tool settings visibility
        this.updateToolSettings();
    }
    
    /**
     * Update layer settings bar (opacity and blending mode for selected layer)
     */
    updateLayerSettingsBar() {
        if (!this.drawingCanvas) return;
        
        const layerOpacity = document.getElementById('drawingLayerOpacity');
        const layerOpacityValue = document.getElementById('drawingLayerOpacityValue');
        const layerBlendingMode = document.getElementById('drawingLayerBlendingMode');
        
        const currentLayerIndex = this.drawingCanvas.currentLayerIndex;
        if (currentLayerIndex >= 0 && currentLayerIndex < this.drawingCanvas.layers.length) {
            const layerData = this.drawingCanvas.layers[currentLayerIndex];
            const opacity = layerData.opacity !== undefined ? layerData.opacity : 100;
            const blendingMode = layerData.blendingMode || 'normal';
            
            if (layerOpacity) {
                layerOpacity.value = opacity;
            }
            if (layerOpacityValue) {
                layerOpacityValue.textContent = opacity + '%';
            }
            if (layerBlendingMode) {
                layerBlendingMode.value = blendingMode;
            }
        }
    }
    
    /**
     * Update text settings UI to reflect selected text properties
     */
    updateTextSettingsUI(textNode) {
        if (!textNode || !textNode.getType || textNode.getType() !== 'Text') return;
        
        const textFont = document.getElementById('drawingTextFont');
        const textSize = document.getElementById('drawingTextSize');
        const textColor = document.getElementById('drawingTextColor');
        const textBold = document.getElementById('drawingTextBold');
        const textItalic = document.getElementById('drawingTextItalic');
        const textUnderline = document.getElementById('drawingTextUnderline');
        
        if (textFont) {
            textFont.value = textNode.fontFamily() || 'Arial';
        }
        if (textSize) {
            textSize.value = textNode.fontSize() || 20;
        }
        if (textColor) {
            textColor.value = textNode.fill() || '#000000';
        }
        if (textBold) {
            const fontStyle = textNode.fontStyle() || '';
            textBold.classList.toggle('active', fontStyle.includes('bold'));
        }
        if (textItalic) {
            const fontStyle = textNode.fontStyle() || '';
            textItalic.classList.toggle('active', fontStyle.includes('italic'));
        }
        if (textUnderline) {
            textUnderline.classList.toggle('active', textNode.textDecoration() === 'underline');
        }
    }
    
    /**
     * Update tool settings visibility based on selected tool
     */
    updateToolSettings() {
        if (!this.drawingCanvas) return;
        
        const brushSettings = document.getElementById('drawingSettingsBrush');
        const penSettings = document.getElementById('drawingSettingsPen');
        const shapeSettings = document.getElementById('drawingSettingsShape');
        const textSettings = document.getElementById('drawingSettingsText');
        const customShapeSettings = document.getElementById('drawingSettingsCustomShape');
        const selectSettings = document.getElementById('drawingSettingsSelect');
        const paintBucketSettings = document.getElementById('drawingSettingsPaintBucket');
        
        // Hide all settings
        if (brushSettings) brushSettings.style.display = 'none';
        if (penSettings) penSettings.style.display = 'none';
        if (shapeSettings) shapeSettings.style.display = 'none';
        if (textSettings) textSettings.style.display = 'none';
        if (customShapeSettings) customShapeSettings.style.display = 'none';
        if (selectSettings) selectSettings.style.display = 'none';
        if (paintBucketSettings) paintBucketSettings.style.display = 'none';
        
        // Show appropriate settings
        const tool = this.drawingCanvas.currentTool;
        
        // Show/hide smoothing slider based on tool
        const smoothingGroup = document.getElementById('drawingBrushSmoothingGroup');
        if (smoothingGroup) {
            smoothingGroup.style.display = (tool === 'brush') ? 'flex' : 'none';
        }
        
        if (tool === 'brush' || tool === 'eraser') {
            if (brushSettings) brushSettings.style.display = 'flex';
        } else if (tool === 'pen') {
            if (penSettings) penSettings.style.display = 'flex';
        } else if (tool === 'rectangle' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon' || tool === 'line' || tool === 'arrow') {
            if (shapeSettings) shapeSettings.style.display = 'flex';
        } else if (tool === 'curve') {
            if (brushSettings) brushSettings.style.display = 'flex'; // Use brush settings for curve tool
        } else if (tool === 'text') {
            if (textSettings) textSettings.style.display = 'flex';
        } else if (tool === 'select') {
            if (selectSettings) selectSettings.style.display = 'flex';
        } else if (tool === 'customShape') {
            // Use the same settings panel as other shapes for consistency
            // Hide customShapeSettings to avoid duplicates
            if (shapeSettings) shapeSettings.style.display = 'flex';
            if (customShapeSettings) customShapeSettings.style.display = 'none';
        } else if (tool === 'paintBucket') {
            if (paintBucketSettings) paintBucketSettings.style.display = 'flex';
        }
        
        // Update shape menu button to show selected shape (for both basic shapes and custom shapes)
        // Use class selector to handle both buttons (one in shapeSettings, one in customShapeSettings)
        const shapeMenuButtons = document.querySelectorAll('.drawing-shape-menu-btn, #drawingShapeMenuBtn');
        const shapeGrid = document.getElementById('drawingShapeGrid');
        const shapeMenu = document.getElementById('drawingShapeMenu');
        if (shapeMenuButtons.length > 0 && shapeGrid) {
            // Check if shape settings panel is visible (either basic shapes or custom shapes)
            const isShapeSettingsVisible = (shapeSettings && shapeSettings.style.display !== 'none') ||
                                          (customShapeSettings && customShapeSettings.style.display !== 'none');
            
            // Show the shape menu button for all shape tools OR if shape settings panel is visible
            const isShapeTool = tool === 'rectangle' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon' || tool === 'line' || tool === 'arrow' || tool === 'customShape';
            
            if (isShapeTool || isShapeSettingsVisible) {
                // Make sure all shape menu buttons are visible
                // Also check if the button is inside a visible settings panel
                shapeMenuButtons.forEach(btn => {
                    const shapeMenuContainer = btn.closest('div[style*="position: relative"]');
                    if (shapeMenuContainer) {
                        // Check if button is inside shapeSettings or customShapeSettings
                        const isInShapeSettings = shapeSettings && shapeSettings.contains(btn);
                        const isInCustomShapeSettings = customShapeSettings && customShapeSettings.contains(btn);
                        
                        // Simplified logic: show button if it's in a visible settings panel OR if it's a shape tool
                        // Treat customShape the same as other shape tools
                        // For customShape, only show button from shapeSettings (not customShapeSettings)
                        if (tool === 'customShape') {
                            // For custom shapes, only show button from shapeSettings panel
                            if (isInShapeSettings && shapeSettings && shapeSettings.style.display !== 'none') {
                                shapeMenuContainer.style.display = 'block';
                            } else {
                                // Hide button from customShapeSettings panel
                                shapeMenuContainer.style.display = 'none';
                            }
                        } else if (isInShapeSettings && shapeSettings && shapeSettings.style.display !== 'none') {
                            shapeMenuContainer.style.display = 'block';
                        } else if (isInCustomShapeSettings && customShapeSettings && customShapeSettings.style.display !== 'none') {
                            shapeMenuContainer.style.display = 'block';
                        } else if (isShapeTool) {
                            // For any shape tool (including customShape), show the button
                            shapeMenuContainer.style.display = 'block';
                        } else {
                            shapeMenuContainer.style.display = 'none';
                        }
                    }
                });
                
                // Update active state in shape grid (only if it's a shape tool)
                if (isShapeTool) {
                    shapeGrid.querySelectorAll('.custom-shape-grid-item').forEach(item => {
                        const isActive = (tool === 'customShape' && this.drawingCanvas && item.dataset.shape === this.drawingCanvas.customShapeType) ||
                                        (tool !== 'customShape' && item.dataset.shape === tool);
                        if (isActive) {
                            item.style.background = '#007acc';
                        } else {
                            item.style.background = '#3c3c3c';
                        }
                    });
                }
            } else {
                // Hide the shape menu buttons only if shape settings panel is also hidden
                if (!isShapeSettingsVisible) {
                    shapeMenuButtons.forEach(btn => {
                        const shapeMenuContainer = btn.closest('div[style*="position: relative"]');
                        if (shapeMenuContainer) {
                            shapeMenuContainer.style.display = 'none';
                        }
                    });
                }
            }
        }
    }
    
    /**
     * Update layers UI
     */
    updateLayersUI() {
        if (!this.drawingCanvas) {
            console.warn('updateLayersUI: drawingCanvas is null');
            return;
        }
        
        const layersList = document.getElementById('drawingLayersList');
        if (!layersList) {
            console.warn('updateLayersUI: drawingLayersList element not found');
            return;
        }
        
        // Clear existing layers
        layersList.innerHTML = '';
        
        // Check if we have layers
        if (!this.drawingCanvas.layers || this.drawingCanvas.layers.length === 0) {
            console.warn('updateLayersUI: No layers found');
            return;
        }
        
        // Add layers in reverse order (top to bottom)
        for (let i = this.drawingCanvas.layers.length - 1; i >= 0; i--) {
            const layerData = this.drawingCanvas.layers[i];
            const layerItem = document.createElement('div');
            layerItem.className = 'drawing-layer-item';
            if (i === this.drawingCanvas.currentLayerIndex) {
                layerItem.classList.add('active');
            }
            
            // Get applied filters for this layer
            const appliedFilters = layerData.filters || [];
            const filtersHtml = appliedFilters.map((filter, idx) => `
                <div class="layer-filter-item" data-filter-index="${idx}" style="display: flex; align-items: center; gap: 5px; padding: 2px 5px; background: #3c3c3c; border-radius: 3px; margin-top: 2px;">
                    <div class="filter-visibility-btn" style="width: 12px; height: 12px; cursor: pointer;">
                        <i data-lucide="${filter.enabled !== false ? 'eye' : 'eye-off'}" style="width: 12px; height: 12px; color: ${filter.enabled !== false ? '#4ade80' : '#999'}"></i>
                    </div>
                    <span style="font-size: 10px; color: #ccc;">${filter.name}</span>
                </div>
            `).join('');
            
            layerItem.innerHTML = `
                <div class="layer-visibility-btn" style="width: 16px; height: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="${layerData.visible ? 'eye' : 'eye-off'}" class="layer-visibility-icon" style="width: 16px; height: 16px;"></i>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="color: #ccc; font-size: 12px;">${layerData.name}</span>
                    <div class="layer-filters-list" style="display: flex; flex-direction: column; gap: 2px;">
                        ${filtersHtml}
                    </div>
                </div>
                <div style="display: flex; flex-direction: row; gap: 8px; align-items: center;">
                    <div class="layer-filter-btn" data-layer-index="${i}" style="width: 16px; height: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Add Filter">
                        <i data-lucide="sparkles" style="width: 14px; height: 14px; color: #60a5fa;"></i>
                    </div>
                    <div class="layer-delete-btn" style="width: 14px; height: 14px; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="trash-2" class="layer-delete-icon" style="width: 14px; height: 14px; color: #ef4444;"></i>
                    </div>
                </div>
            `;
            
            // Visibility toggle - attach to parent div
            const visibilityBtn = layerItem.querySelector('.layer-visibility-btn');
            if (visibilityBtn) {
                visibilityBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    layerData.visible = !layerData.visible;
                    layerData.layer.visible(layerData.visible);
                    layerData.layer.draw();
                    this.drawingCanvas.hasUnsavedChanges = true;
                    this.drawingCanvas.stage.draw();
                    this.updateLayersUI();
                });
            }
            
            // Layer selection
            layerItem.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility-btn') || e.target.closest('.layer-delete-btn')) {
                    return;
                }
                this.drawingCanvas.currentLayerIndex = i;
                // Update draggable state when layer changes
                this.drawingCanvas.setTool(this.drawingCanvas.currentTool);
                this.updateLayersUI();
                // Update layer settings bar
                this.updateLayerSettingsBar();
            });
            
            // Filter button - attach to parent div
            const filterBtn = layerItem.querySelector('.layer-filter-btn');
            if (filterBtn) {
                filterBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.openLayerFilterDialog(i, layerData);
                });
            }
            
            // Delete layer (including background) - attach to parent div
            const deleteBtn = layerItem.querySelector('.layer-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this.drawingCanvas.layers.length <= 1) {
                        await this.customAlert('Cannot delete the last layer.');
                        return;
                    }
                    const confirmed = await this.customConfirm(`Delete "${layerData.name}"?`);
                    if (confirmed) {
                        layerData.layer.destroy();
                        this.drawingCanvas.layers.splice(i, 1);
                        
                        // Adjust current layer index
                        if (this.drawingCanvas.currentLayerIndex >= this.drawingCanvas.layers.length) {
                            this.drawingCanvas.currentLayerIndex = this.drawingCanvas.layers.length - 1;
                        } else if (this.drawingCanvas.currentLayerIndex > i) {
                            this.drawingCanvas.currentLayerIndex--;
                        }
                        
                        // If background was deleted, update display
                        if (layerData.background) {
                            this.drawingCanvas.updateBackgroundDisplay();
                        }
                        
                        this.drawingCanvas.hasUnsavedChanges = true;
                        this.drawingCanvas.saveState();
                        this.updateLayersUI();
                    }
                });
            }
            
            layersList.appendChild(layerItem);
        }
        
        // Initialize lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Update layer settings bar
        this.updateLayerSettingsBar();
        
        // Force a redraw to ensure everything is visible
        setTimeout(() => {
            if (this.drawingCanvas && this.drawingCanvas.stage) {
                this.drawingCanvas.stage.draw();
            }
        }, 50);
    }
    
    /**
     * Open layer filter dialog
     */
    openLayerFilterDialog(layerIndex, layerData) {
        const dialog = document.getElementById('layerFilterDialog');
        if (!dialog) return;
        
        // Initialize filters array if not exists
        if (!layerData.filters) {
            layerData.filters = [];
        }
        
        // Center dialog on screen
        dialog.style.left = (window.innerWidth / 2 - 200) + 'px';
        dialog.style.top = (window.innerHeight / 2 - 250) + 'px';
        dialog.style.display = 'block';
        dialog.dataset.layerIndex = layerIndex;
        
        // Update applied filters list
        this.updateFilterDialogAppliedList(layerData.filters);
        
        // Setup dialog drag
        this.setupFilterDialogDrag();
        
        // Setup filter controls
        const filterType = document.getElementById('layerFilterType');
        const filterIntensity = document.getElementById('layerFilterIntensity');
        const filterIntensityValue = document.getElementById('layerFilterIntensityValue');
        const filterIntensityGroup = document.getElementById('layerFilterIntensityGroup');
        const filterAddBtn = document.getElementById('layerFilterAdd');
        const filterCloseBtn = document.getElementById('layerFilterDialogClose');
        
        // Store original filters for preview restoration
        let originalFilters = null;
        
        if (filterType) {
            filterType.value = '';
            filterType.onchange = () => {
                const needsIntensity = ['blur', 'brighten', 'contrast', 'hue', 'noise', 'pixelate', 'posterize', 'rgb', 'saturate', 'threshold'].includes(filterType.value);
                if (filterIntensityGroup) {
                    filterIntensityGroup.style.display = needsIntensity ? 'block' : 'none';
                }
                
                // Live preview when filter type changes - clear previous preview first
                if (filterType.value) {
                    // Save original filters if not already saved
                    if (!originalFilters) {
                        const layer = this.drawingCanvas.layers[layerIndex].layer;
                        originalFilters = [];
                        layer.find('Shape').forEach(shape => {
                            if (shape.filters) {
                                originalFilters.push({
                                    shape: shape,
                                    filters: shape.filters() ? [...shape.filters()] : []
                                });
                            }
                        });
                    }
                    
                    // Clear all preview filters first
                    this.drawingCanvas.clearPreviewFilters(layerIndex);
                    
                    // Apply new preview filter
                    const value = parseInt(filterIntensity?.value || 50);
                    const tempFilter = {
                        name: filterType.value,
                        intensity: value,
                        enabled: true,
                        isPreview: true // Mark as preview
                    };
                    this.drawingCanvas.applyLayerFilterAtIndex(layerIndex, -1, tempFilter);
                } else {
                    // Restore original filters if no filter selected
                    if (originalFilters) {
                        originalFilters.forEach(item => {
                            item.shape.filters(item.filters);
                            if (item.shape.cache) item.shape.cache();
                        });
                        this.drawingCanvas.layers[layerIndex].layer.draw();
                        originalFilters = null;
                    }
                }
            };
        }
        
        if (filterIntensity && filterIntensityValue) {
            filterIntensity.oninput = (e) => {
                const value = parseInt(e.target.value);
                filterIntensityValue.textContent = value;
                
                // Live preview - clear previous preview and apply new one
                if (filterType.value) {
                    // Clear all preview filters first
                    this.drawingCanvas.clearPreviewFilters(layerIndex);
                    
                    // Apply new preview filter
                    const tempFilter = {
                        name: filterType.value,
                        intensity: value,
                        enabled: true,
                        isPreview: true // Mark as preview
                    };
                    this.drawingCanvas.applyLayerFilterAtIndex(layerIndex, -1, tempFilter);
                }
            };
        }
        
        if (filterAddBtn) {
            filterAddBtn.onclick = () => {
                const filterName = filterType.value;
                if (!filterName) return;
                
                // Clear preview filters before adding permanent filter
                this.drawingCanvas.clearPreviewFilters(layerIndex);
                
                const intensity = parseInt(filterIntensity?.value || 50);
                const filter = {
                    name: filterName,
                    intensity: intensity,
                    enabled: true
                };
                
                layerData.filters.push(filter);
                this.drawingCanvas.applyLayerFilterAtIndex(layerIndex, layerData.filters.length - 1, filter);
                this.updateFilterDialogAppliedList(layerData.filters);
                this.updateLayersUI();
                
                // Reset form and restore original filters
                if (filterType) filterType.value = '';
                if (filterIntensityGroup) filterIntensityGroup.style.display = 'none';
                originalFilters = null;
            };
        }
        
        if (filterCloseBtn) {
            filterCloseBtn.onclick = () => {
                // Clear preview filters when closing
                this.drawingCanvas.clearPreviewFilters(layerIndex);
                dialog.style.display = 'none';
                originalFilters = null;
            };
        }
    }
    
    /**
     * Update filter dialog applied list
     */
    updateFilterDialogAppliedList(filters) {
        const appliedItems = document.getElementById('layerFilterAppliedItems');
        if (!appliedItems) return;
        
        appliedItems.innerHTML = '';
        
        if (filters.length === 0) {
            appliedItems.innerHTML = '<div style="color: #999; font-size: 11px; font-style: italic;">No filters applied</div>';
            return;
        }
        
        filters.forEach((filter, idx) => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: #3c3c3c; border-radius: 4px;';
            item.innerHTML = `
                <div class="filter-item-visibility" style="width: 16px; height: 16px; cursor: pointer;">
                    <i data-lucide="${filter.enabled !== false ? 'eye' : 'eye-off'}" style="width: 16px; height: 16px; color: ${filter.enabled !== false ? '#4ade80' : '#999'}"></i>
                </div>
                <span style="flex: 1; color: #ccc; font-size: 12px;">${filter.name}${filter.intensity !== undefined ? ' (' + filter.intensity + ')' : ''}</span>
                <button class="filter-item-remove" data-filter-index="${idx}" style="background: #ef4444; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">Remove</button>
            `;
            
            const visibilityBtn = item.querySelector('.filter-item-visibility');
            const removeBtn = item.querySelector('.filter-item-remove');
            
            visibilityBtn.onclick = () => {
                filter.enabled = !filter.enabled;
                const layerIndex = parseInt(document.getElementById('layerFilterDialog').dataset.layerIndex);
                this.drawingCanvas.applyLayerFilterAtIndex(layerIndex, idx, filter);
                this.updateFilterDialogAppliedList(filters);
                this.updateLayersUI();
            };
            
            removeBtn.onclick = () => {
                filters.splice(idx, 1);
                const layerIndex = parseInt(document.getElementById('layerFilterDialog').dataset.layerIndex);
                this.drawingCanvas.removeLayerFilterAtIndex(layerIndex, idx);
                this.updateFilterDialogAppliedList(filters);
                this.updateLayersUI();
            };
            
            appliedItems.appendChild(item);
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Setup filter dialog drag functionality
     */
    setupFilterDialogDrag() {
        const dialog = document.getElementById('layerFilterDialog');
        const header = document.getElementById('layerFilterDialogHeader');
        if (!dialog || !header) return;
        
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        header.onmousedown = (e) => {
            isDragging = true;
            initialX = e.clientX - dialog.offsetLeft;
            initialY = e.clientY - dialog.offsetTop;
        };
        
        document.onmousemove = (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                dialog.style.left = currentX + 'px';
                dialog.style.top = currentY + 'px';
            }
        };
        
        document.onmouseup = () => {
            isDragging = false;
        };
    }
    
    /**
     * Add new drawing layer
     */
    addDrawingLayer() {
        if (!this.drawingCanvas) return;
        
        this.drawingCanvas.layerCounter++;
        const newLayer = new Konva.Layer({
            clipX: 0,
            clipY: 0,
            clipWidth: this.drawingCanvas.width,
            clipHeight: this.drawingCanvas.height
        });
        this.drawingCanvas.stage.add(newLayer);
        
        this.drawingCanvas.layers.push({
            name: `Layer ${this.drawingCanvas.layerCounter}`,
            layer: newLayer,
            visible: true,
            locked: false,
            background: false,
            filters: [],
            opacity: 100,
            blendingMode: 'normal'
        });
        
        // Apply initial opacity
        newLayer.opacity(1);
        
        this.drawingCanvas.currentLayerIndex = this.drawingCanvas.layers.length - 1;
        this.drawingCanvas.hasUnsavedChanges = true;
        this.drawingCanvas.saveState();
        this.updateLayersUI();
    }
    
    /**
     * Calculate page aspect ratio - matches RenderService.createPage exactly
     * This ensures the drawing canvas "match page" option matches the storyboard pages
     * CRITICAL: Must use EXACT same logic and same pageSize object as RenderService
     */
    calculatePageAspectRatio() {
        // Get pageSize EXACTLY the same way RenderService does (line 233)
        // RenderService uses: this.app.pageSizes[this.app.project.settings.pageSize]
        // We use: this.pageSizes[this.project.settings.pageSize] (same object)
        const pageSize = this.pageSizes[this.project.settings.pageSize];
        
        // If pageSize doesn't exist (shouldn't happen, but handle gracefully)
        if (!pageSize) {
            console.error(`Page size ${this.project.settings.pageSize} not found in pageSizes, using A4`);
            const fallbackPageSize = this.pageSizes.A4;
            const orientation = this.project.settings.orientation;
            const pageWidthMm = orientation === 'portrait' ? fallbackPageSize.width : fallbackPageSize.height;
            const pageHeightMm = orientation === 'portrait' ? fallbackPageSize.height : fallbackPageSize.width;
            const aspectRatio = pageWidthMm / pageHeightMm;
            
            return aspectRatio;
        }
        
        // Get orientation EXACTLY the same way RenderService does (line 232)
        // RenderService uses: this.app.project.settings.orientation (no fallback)
        const orientation = this.project.settings.orientation;
        
        // EXACT same calculation as RenderService.createPage (line 394-396)
        const pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
        const pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
        const aspectRatio = pageWidthMm / pageHeightMm;
        
        return aspectRatio;
    }
    
    /**
     * Apply aspect ratio to canvas
     */
    applyAspectRatio(ratioType) {
        if (!this.drawingCanvas) return;
        
        const container = document.getElementById('drawingCanvasWrapper');
        if (!container) return;
        
        const containerRect = container.parentElement.getBoundingClientRect();
        let aspectRatio;
        
        if (ratioType === 'page') {
            // Use the helper function to ensure exact match with RenderService
            aspectRatio = this.calculatePageAspectRatio();
        } else if (ratioType === 'custom') {
            // Prompt for custom aspect ratio
            const width = prompt('Enter width (e.g., 16):');
            const height = prompt('Enter height (e.g., 9):');
            if (width && height) {
                aspectRatio = parseFloat(width) / parseFloat(height);
            } else {
                return;
            }
        } else {
            // Parse ratio like "16:9"
            const [w, h] = ratioType.split(':').map(Number);
            aspectRatio = w / h;
        }
        
        // Calculate size maintaining aspect ratio, fitting to container
        // Use the actual container dimensions, not parent
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const maxWidth = Math.max(containerWidth - 40, 200); // Account for padding, minimum 200px
        const maxHeight = Math.max(containerHeight - 40, 150); // Minimum 150px
        
        let width = maxWidth;
        let height = maxHeight;
        
        // Fit to container while maintaining aspect ratio
        const containerAspectRatio = maxWidth / maxHeight;
        if (aspectRatio > containerAspectRatio) {
            // Canvas aspect ratio is wider than container - fit to width
            width = maxWidth;
            height = width / aspectRatio;
            // If height exceeds max, fit to height instead
            if (height > maxHeight) {
                height = maxHeight;
                width = height * aspectRatio;
            }
        } else {
            // Canvas aspect ratio is taller than container - fit to height
            height = maxHeight;
            width = height * aspectRatio;
            // If width exceeds max, fit to width instead
            if (width > maxWidth) {
                width = maxWidth;
                height = width / aspectRatio;
            }
        }
        
        // Ensure minimum size
        if (width < 200) {
            width = 200;
            height = width / aspectRatio;
        }
        if (height < 150) {
            height = 150;
            width = height * aspectRatio;
        }
        
        // Center the canvas in the container
        const wrapper = document.getElementById('drawingCanvasWrapper');
        if (wrapper) {
            const finalWidth = Math.floor(width);
            const finalHeight = Math.floor(height);
            wrapper.style.width = finalWidth + 'px';
            wrapper.style.height = finalHeight + 'px';
            wrapper.style.minWidth = '0'; // Allow wrapper to shrink
            wrapper.style.minHeight = '0'; // Allow wrapper to shrink
            wrapper.style.maxWidth = finalWidth + 'px'; // Prevent expansion beyond canvas size
            wrapper.style.maxHeight = finalHeight + 'px'; // Prevent expansion beyond canvas size
            wrapper.style.margin = 'auto';
            wrapper.style.display = 'block';
            
            // Store wrapper dimensions for zoom to reference
            wrapper.dataset.baseWidth = finalWidth;
            wrapper.dataset.baseHeight = finalHeight;
        }
        
        this.drawingCanvas.resize(Math.floor(width), Math.floor(height));
        
        // CRITICAL: Store aspect ratio in both places to ensure resize handlers always use it
        this.drawingCanvas.aspectRatio = aspectRatio;
        this.drawingCanvas.originalAspectRatio = aspectRatio; // Also update original so fallback works
    }
    
    /**
     * Start crop tool
     */
    async startCrop() {
        if (!this.drawingCanvas) return;
        
        // For now, crop to current canvas size
        // In the future, this could allow selecting a crop area
        const confirmed = await this.customConfirm('Crop canvas to current view? This will remove any content outside the visible area.');
        if (confirmed) {
            // Crop to current canvas dimensions
            this.drawingCanvas.crop(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        }
    }
    
    /**
     * Update drawing canvas button states
     */
    updateDrawingCanvasButtons() {
        if (!this.drawingCanvas) return;
        
        const undoBtn = document.getElementById('drawingUndo');
        const redoBtn = document.getElementById('drawingRedo');
        
        if (undoBtn) {
            undoBtn.disabled = this.drawingCanvas.historyIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.drawingCanvas.historyIndex >= this.drawingCanvas.history.length - 1;
        }
    }
    
    /**
     * Keep drawing (add to storyboard)
     */
    async keepDrawing(saveToDisk = false) {
        console.log('keepDrawing called, saveToDisk:', saveToDisk);
        if (!this.drawingCanvas) {
            console.error('keepDrawing: drawingCanvas is null');
            return;
        }
        
        console.log('keepDrawing: editingImage =', this.drawingCanvas.editingImage);
        
        // Check if we're editing an existing image
        if (this.drawingCanvas && this.drawingCanvas.editingImage) {
            // Save reference to editing image BEFORE closing canvas (which may destroy it)
            const editingImage = this.drawingCanvas.editingImage;
            console.log('keepDrawing: Editing existing image:', editingImage.name);
            try {
                // SIMPLE APPROACH: Just export the drawing canvas stage directly as a screenshot
                // Then scale it to the original image size
                const originalImageWidth = this.drawingCanvas.backgroundImageWidth;
                const originalImageHeight = this.drawingCanvas.backgroundImageHeight;
                
                if (!originalImageWidth || !originalImageHeight) {
                    throw new Error('Cannot rasterize: Original image dimensions not available');
                }
                
                // Export the current canvas stage directly (this is what the user sees)
                const canvasDataURL = this.drawingCanvas.stage.toDataURL({ 
                    mimeType: 'image/png', 
                    quality: 1,
                    pixelRatio: 1
                });
                
                // Now scale this canvas screenshot to the original image size
                const canvasImg = new Image();
                canvasImg.crossOrigin = 'anonymous';
                
                canvasImg.onload = () => {
                    // Create a temporary canvas to scale the image
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = originalImageWidth;
                    tempCanvas.height = originalImageHeight;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Draw the canvas screenshot scaled to original image size
                    tempCtx.drawImage(canvasImg, 0, 0, originalImageWidth, originalImageHeight);
                    
                    // Get the scaled data URL
                    const rasterizedDataURL = tempCanvas.toDataURL('image/png', 1);
                    
                    // Update the image with the rasterized version
                    const imageIndex = this.project.images.findIndex(img => img.name === editingImage.name);
                    if (imageIndex !== -1) {
                        const imageInProject = this.project.images[imageIndex];
                        
                        // CRITICAL: Save the original URL before replacing it (if not already saved)
                        // This allows us to restore the original image later
                        if (!imageInProject.originalUrl) {
                            imageInProject.originalUrl = imageInProject.url;
                        }
                        
                        // Replace the image URL with the rasterized version
                        imageInProject.url = rasterizedDataURL;
                        // CRITICAL: Delete editLayers (don't set to empty array) so renderer uses URL directly
                        delete imageInProject.editLayers;
                        imageInProject.compositeUrl = null;
                        delete imageInProject.compositeUrl;
                        
                        // Also update editingImage reference
                        if (!editingImage.originalUrl) {
                            editingImage.originalUrl = editingImage.url;
                        }
                        editingImage.url = rasterizedDataURL;
                        delete editingImage.editLayers;
                        editingImage.compositeUrl = null;
                        delete editingImage.compositeUrl;
                    } else {
                        // Save original URL before replacing
                        if (!editingImage.originalUrl) {
                            editingImage.originalUrl = editingImage.url;
                        }
                        editingImage.url = rasterizedDataURL;
                        delete editingImage.editLayers;
                        editingImage.compositeUrl = null;
                        delete editingImage.compositeUrl;
                    }
                    
                    // Mark project as changed
                    this.markChanged();
                    
                    // Close drawing canvas
                    if (this.drawingCanvas) {
                        this.drawingCanvas.resetUnsavedChanges();
                    }
                    this.closeDrawingCanvas(true);
                    
                    // Close image settings modal if open
                    const imageSettingsModal = document.getElementById('imageSettingsModal');
                    if (imageSettingsModal) {
                        imageSettingsModal.style.display = 'none';
                    }
                    
                    // Hide reset button (no edit layers to reset)
                    const resetEditsBtn = document.getElementById('imageSettingsResetEdits');
                    if (resetEditsBtn) {
                        resetEditsBtn.style.display = 'none';
                    }
                    
                    // Save and re-render
                    setTimeout(async () => {
                        if (this.storageService) {
                            await this.storageService.saveToStorage(false);
                        }
                        
                        // Force re-render storyboard
                        if (this.renderService && this.renderService.renderStoryboard) {
                            this.renderService.renderStoryboard();
                        } else if (this.uiManager && this.uiManager.renderStoryboard) {
                            this.uiManager.renderStoryboard();
                        } else if (this.renderStoryboard) {
                            this.renderStoryboard();
                        }
                    }, 300);
                };
                
                canvasImg.onerror = () => {
                    this.customAlert('Error: Could not export canvas screenshot');
                };
                
                canvasImg.src = canvasDataURL;
                
                // OLD COMPLEX APPROACH - REMOVED
                // The code below was trying to recreate the canvas at original size
                // but it was too complex and error-prone. The new approach above
                // just exports what the user sees and scales it.
                
                return;
            } catch (error) {
                console.error('Error rasterizing canvas:', error);
                this.customAlert('Error saving edits: ' + error.message);
            }
        }
        
        const sceneInput = document.getElementById('drawingScene');
        const shotInput = document.getElementById('drawingShot');
        const frameInput = document.getElementById('drawingFrame');
        
        const sceneNumber = sceneInput ? sceneInput.value.trim() : '';
        const shotNumber = shotInput ? shotInput.value.trim() : '';
        const frameNumber = frameInput ? frameInput.value.trim() : '';
        
        // Export canvas as image
        const dataURL = this.drawingCanvas.toDataURL('image/png');
        
        // If save to disk, prompt for file save
        if (saveToDisk) {
            try {
                const blob = await this.drawingCanvas.toBlob('image/png');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `drawing_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Error saving drawing:', error);
                await this.customAlert('Error saving drawing to disk.');
                return;
            }
        }
        
        // Create image object
        const imageName = `drawing_${Date.now()}.png`;
        const newImage = {
            name: imageName,
            originalName: imageName,
            url: dataURL,
            sceneNumber: sceneNumber,
            shotNumber: shotNumber,
            frameNumber: frameNumber,
            scene: sceneNumber,
            filePath: imageName
        };
        
        // Insert at current position or at end
        if (this.currentEditingImageIndex !== undefined && this.currentEditingImageIndex >= 0) {
            this.project.images.splice(this.currentEditingImageIndex + 1, 0, newImage);
        } else {
            this.project.images.push(newImage);
        }
        
        // Sort images
        this.sortImagesByStructure();
        
        // Reset unsaved changes flag since drawing is being kept
        if (this.drawingCanvas) {
            this.drawingCanvas.hasUnsavedChanges = false;
        }
        
        this.markChanged();
        this.closeDrawingCanvas(true); // Force close without prompt since we're keeping it
        this.renderStoryboard();
        
        // Rebuild previz timeline if it exists (to include new storyboard images from drawing)
        if (this.previsController && this.previsController.previsManager) {
            this.previsController.previsManager.buildTimelineFromStoryboard();
            this.previsController.renderTimeline();
        }
        
        // Ensure annotation system state is correct
        setTimeout(() => {
            this.ensureAnnotationSystemState();
        }, 200);
    }
    
    setupCustomDialog() {
        const dialog = document.getElementById('customDialog');
        const yesBtn = document.getElementById('customDialogYes');
        const noBtn = document.getElementById('customDialogNo');
        const cancelBtn = document.getElementById('customDialogCancel');
        const input = document.getElementById('customDialogInput');
        const actionsDiv = document.querySelector('.custom-dialog-actions');
        
        // Store original HTML of actions div to restore after customChoice
        if (actionsDiv) {
            this.customDialogOriginalHTML = actionsDiv.innerHTML;
        }
        
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
        // Use ModalController if available
        if (this.modalController) {
            this.modalController.showToast(message, type, duration);
            return;
        }
        // Use UIManager if available
        if (this.uiManager) {
            this.uiManager.showToast(message, type);
            return;
        }
        
        // Fallback to old implementation
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
        // Use UIManager if available
        if (this.uiManager) {
            const projectName = this.currentProjectPath 
                ? this.currentProjectPath.replace(/\.sbp$/, '').split('/').pop()
                : null;
            this.uiManager.updateProjectName(projectName);
            return;
        }
        
        // Fallback to old implementation
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
    
    // Custom alert - delegate to ModalController if available
    customAlert(message) {
        if (this.modalController) {
            return this.modalController.customAlert(message);
        }
        // Fallback to old implementation
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
    
    // Custom confirm - delegate to ModalController if available
    customConfirm(message) {
        if (this.modalController) {
            return this.modalController.customConfirm(message);
        }
        // Fallback to old implementation
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            const input = document.getElementById('customDialogInput');
            const actionsDiv = document.querySelector('.custom-dialog-actions');
            
            // Restore original buttons if they were removed by customChoice
            if (actionsDiv && this.customDialogOriginalHTML && !yesBtn) {
                actionsDiv.innerHTML = this.customDialogOriginalHTML;
                // Re-get buttons after restoration
                const restoredYesBtn = document.getElementById('customDialogYes');
                const restoredNoBtn = document.getElementById('customDialogNo');
                const restoredCancelBtn = document.getElementById('customDialogCancel');
                
                if (restoredYesBtn && restoredNoBtn) {
                    title.textContent = 'Confirm';
                    messageEl.textContent = message;
                    if (input) input.style.display = 'none';
                    if (restoredCancelBtn) restoredCancelBtn.style.display = 'none';
                    restoredYesBtn.textContent = 'Yes';
                    restoredNoBtn.textContent = 'No';
                    restoredYesBtn.style.display = 'block';
                    restoredNoBtn.style.display = 'block';
                    
                    restoredYesBtn.onclick = () => {
                        dialog.style.display = 'none';
                        resolve(true);
                    };
                    
                    restoredNoBtn.onclick = () => {
                        dialog.style.display = 'none';
                        resolve(false);
                    };
                    
                    dialog.style.display = 'block';
                    return;
                }
            }
            
            // Normal flow if buttons exist
            if (!yesBtn || !noBtn) {
                console.error('Dialog buttons not found');
                resolve(false);
                return;
            }
            
            title.textContent = 'Confirm';
            messageEl.textContent = message;
            if (input) input.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'none';
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
    
    // Custom choice dialog with multiple options - delegate to ModalController if available
    customChoice(titleText, message, options) {
        if (this.modalController) {
            return this.modalController.customChoice(titleText, message, options);
        }
        // Fallback to old implementation
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const input = document.getElementById('customDialogInput');
            const actionsDiv = document.querySelector('.custom-dialog-actions');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            
            title.textContent = titleText;
            messageEl.textContent = message;
            input.style.display = 'none';
            
            // Hide default buttons
            if (yesBtn) yesBtn.style.display = 'none';
            if (noBtn) noBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'none';
            
            // Store original HTML if not already stored
            if (!this.customDialogOriginalHTML && actionsDiv) {
                this.customDialogOriginalHTML = actionsDiv.innerHTML;
            }
            const originalHTML = this.customDialogOriginalHTML || actionsDiv.innerHTML;
            
            // Clear existing buttons and create new ones
            actionsDiv.innerHTML = '';
            
            // Create buttons for each option
            options.forEach((option, index) => {
                const btn = document.createElement('button');
                btn.textContent = option;
                btn.className = index === options.length - 1 && option === 'Cancel' ? 'btn btn-secondary' : 'btn btn-primary';
                btn.style.marginLeft = index > 0 ? '10px' : '0';
                
                btn.onclick = () => {
                    // Restore original buttons before resolving
                    if (originalHTML && actionsDiv) {
                        actionsDiv.innerHTML = originalHTML;
                    }
                    dialog.style.display = 'none';
                    resolve(option);
                };
                
                actionsDiv.appendChild(btn);
            });
            
            dialog.style.display = 'block';
        });
    }
    
    // Custom prompt - delegate to ModalController if available
    customPrompt(message, defaultValue = '') {
        if (this.modalController) {
            return this.modalController.customPrompt(message, defaultValue);
        }
        // Fallback to old implementation
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
        const toggleAnnotationPanelBtn = document.getElementById('toggleAnnotationPanel');
        if (toggleAnnotationPanelBtn) {
            toggleAnnotationPanelBtn.addEventListener('click', () => {
                const annotationPanel = document.getElementById('annotationPanel');
                const isOpening = !annotationPanel.classList.contains('active');
                this.togglePanel('annotation');
                // Enable/disable annotation system based on panel state and checkbox
                if (this.annotationSystem) {
                    const enableAnnotation = document.getElementById('enableAnnotation');
                    const isEnabled = isOpening && enableAnnotation && enableAnnotation.checked;
                    this.annotationSystem.setEnabled(isEnabled);
                }
            });
        }
        document.getElementById('toggleAdvancedSettings').addEventListener('click', () => this.togglePanel('advancedSettings'));
        const toggleProjectInfoBtn = document.getElementById('toggleProjectInfo');
        if (toggleProjectInfoBtn) {
            toggleProjectInfoBtn.addEventListener('click', () => {
                this.togglePanel('projectInfo');
                if (this.updateProjectInfo) this.updateProjectInfo();
            });
        }
        
        // Panel close buttons
        document.getElementById('closePageSettings').addEventListener('click', () => this.closePanel('pageSettings'));
        document.getElementById('closeTextSettings').addEventListener('click', () => this.closePanel('textSettings'));
        const closeAnnotationPanelBtn = document.getElementById('closeAnnotationPanel');
        if (closeAnnotationPanelBtn) {
            closeAnnotationPanelBtn.addEventListener('click', () => {
                this.closePanel('annotation');
                // Disable annotation system when panel is closed
                if (this.annotationSystem) {
                    this.annotationSystem.setEnabled(false);
                }
            });
        }
        document.getElementById('closeAdvancedSettings').addEventListener('click', () => this.closePanel('advancedSettings'));
        const closeProjectInfoBtn = document.getElementById('closeProjectInfo');
        if (closeProjectInfoBtn) {
            closeProjectInfoBtn.addEventListener('click', () => this.closePanel('projectInfo'));
        }
        
        // Compression settings
        this.setupCompressionSettings();
        
        // Workspace tabs
        this.setupWorkspaceTabs();
    }
    
    setupWorkspaceTabs() {
        const tabs = document.querySelectorAll('.workspace-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const workspace = tab.dataset.workspace;
                this.switchWorkspace(workspace);
            });
        });
    }
    
    switchWorkspace(workspace) {
        // Update active tab
        document.querySelectorAll('.workspace-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.workspace === workspace) {
                tab.classList.add('active');
            }
        });
        
        // Update active workspace content
        document.querySelectorAll('.workspace-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Map workspace names to element IDs (handle capitalization correctly)
        const workspaceIdMap = {
            'storyboard': 'workspaceStoryboard',
            'shotlist': 'workspaceShotList',
            'previz': 'workspacePreviz'
        };
        
        const workspaceContentId = workspaceIdMap[workspace] || `workspace${workspace.charAt(0).toUpperCase() + workspace.slice(1)}`;
        const workspaceContent = document.getElementById(workspaceContentId);
        if (workspaceContent) {
            workspaceContent.classList.add('active');
        } else {
            console.warn('Workspace content not found:', workspaceContentId);
        }
        
        // Update active workspace
        this.activeWorkspace = workspace;
        this.project.activeWorkspace = workspace;
        
        // Save workspace preference
        localStorage.setItem('storyboard_activeWorkspace', workspace);
        
        // Show/hide header zoom controls based on workspace
        const zoomControls = document.querySelector('.toolbar-zoom');
        if (zoomControls) {
            if (workspace === 'previz' || workspace === 'shotlist') {
                zoomControls.style.display = 'none';
            } else {
                zoomControls.style.display = 'flex';
            }
        }
        
        // Render workspace-specific content
        if (workspace === 'shotlist' && this.shotListController) {
            setTimeout(() => {
                this.shotListController.onShotListTabActivated();
            }, 100);
        } else if (workspace === 'previz' && this.previsController) {
            setTimeout(() => {
                this.previsController.render();
            }, 100);
        }
        
        // Show/hide annotation panel based on workspace
        const annotationPanel = document.getElementById('annotationPanel');
        const toggleAnnotationBtn = document.getElementById('toggleAnnotationPanel');
        if (annotationPanel && toggleAnnotationBtn) {
            if (workspace === 'storyboard') {
                // Show annotation panel button and allow panel to be shown
                toggleAnnotationBtn.style.display = '';
            } else {
                // Hide annotation panel button and close panel if open
                toggleAnnotationBtn.style.display = 'none';
                if (annotationPanel.classList.contains('active')) {
                    annotationPanel.classList.remove('active');
                }
            }
        }
        
        // Show/hide settings panel buttons based on workspace
        const storyboardSettingsButtons = [
            'togglePageSettings',
            'toggleTextSettings',
        ];
        
        if (workspace === 'storyboard') {
            // Show storyboard settings panel buttons
            storyboardSettingsButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.style.display = '';
                    btn.classList.remove('workspace-hidden');
                }
            });
        } else {
            // Hide storyboard-specific settings panel buttons
            storyboardSettingsButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.style.display = 'none';
                    btn.classList.add('workspace-hidden');
                }
            });
            
            // Close any open storyboard-specific panels
            this.closePanel('pageSettings');
            this.closePanel('textSettings');
        }
        
        // Store active workspace in project
        if (this.project) {
            this.project.activeWorkspace = workspace;
        }
    }
    
    setupCompressionSettings() {
        const compressionEnabled = document.getElementById('compressionEnabled');
        const compressionSettings = document.getElementById('compressionSettings');
        const maxSize = document.getElementById('compressionMaxSize');
        const maxSizeInput = document.getElementById('compressionMaxSizeInput');
        const maxDimension = document.getElementById('compressionMaxDimension');
        const maxDimensionInput = document.getElementById('compressionMaxDimensionInput');
        const quality = document.getElementById('compressionQuality');
        const qualityInput = document.getElementById('compressionQualityInput');
        const format = document.getElementById('compressionFormat');
        
        // Load settings from project
        if (this.project.settings.imageCompression) {
            const comp = this.project.settings.imageCompression;
            if (compressionEnabled) compressionEnabled.checked = comp.enabled !== false;
            if (maxSize) maxSize.value = comp.maxSizeMB || 1;
            if (maxSizeInput) maxSizeInput.value = comp.maxSizeMB || 1;
            if (maxDimension) maxDimension.value = comp.maxWidthOrHeight || 2048;
            if (maxDimensionInput) maxDimensionInput.value = comp.maxWidthOrHeight || 2048;
            if (quality) quality.value = (comp.quality || 0.85) * 100;
            if (qualityInput) qualityInput.value = (comp.quality || 0.85) * 100;
            if (format) format.value = comp.format || 'webp';
        }
        
        // Update compression settings visibility
        const updateVisibility = () => {
            if (compressionSettings) {
                compressionSettings.style.display = compressionEnabled?.checked ? 'block' : 'none';
            }
        };
        updateVisibility();
        
        // Sync sliders and inputs
        if (maxSize && maxSizeInput) {
            maxSize.addEventListener('input', (e) => {
                maxSizeInput.value = e.target.value;
                this.updateCompressionSetting('maxSizeMB', parseFloat(e.target.value));
            });
            maxSizeInput.addEventListener('input', (e) => {
                maxSize.value = e.target.value;
                this.updateCompressionSetting('maxSizeMB', parseFloat(e.target.value));
            });
        }
        
        if (maxDimension && maxDimensionInput) {
            maxDimension.addEventListener('input', (e) => {
                maxDimensionInput.value = e.target.value;
                this.updateCompressionSetting('maxWidthOrHeight', parseInt(e.target.value));
            });
            maxDimensionInput.addEventListener('input', (e) => {
                maxDimension.value = e.target.value;
                this.updateCompressionSetting('maxWidthOrHeight', parseInt(e.target.value));
            });
        }
        
        if (quality && qualityInput) {
            quality.addEventListener('input', (e) => {
                qualityInput.value = e.target.value;
                this.updateCompressionSetting('quality', parseInt(e.target.value) / 100);
            });
            qualityInput.addEventListener('input', (e) => {
                quality.value = e.target.value;
                this.updateCompressionSetting('quality', parseInt(e.target.value) / 100);
            });
        }
        
        if (format) {
            format.addEventListener('change', (e) => {
                this.updateCompressionSetting('format', e.target.value);
            });
        }
        
        if (compressionEnabled) {
            compressionEnabled.addEventListener('change', (e) => {
                this.updateCompressionSetting('enabled', e.target.checked);
                updateVisibility();
            });
        }
    }
    
    updateCompressionSetting(key, value) {
        if (!this.project.settings.imageCompression) {
            this.project.settings.imageCompression = {};
        }
        this.project.settings.imageCompression[key] = value;
        this.markChanged();
    }
    
    updateProjectInfo() {
        // Calculate statistics
        const frames = this.project.images.length;
        const shots = new Set(this.project.images
            .filter(img => img.shotNumber && img.shotNumber.trim() !== '')
            .map(img => img.shotNumber.trim())
        ).size;
        const scenes = new Set(this.project.images
            .filter(img => img.sceneNumber && img.sceneNumber.trim() !== '')
            .map(img => img.sceneNumber.trim())
        ).size;
        
        // Calculate pages
        const rows = this.project.settings.layoutRows || 2;
        const cols = this.project.settings.layoutCols || 3;
        const imagesPerPage = rows * cols;
        const coverPage = this.project.settings.enableCoverPage ? 1 : 0;
        const storyboardPages = Math.ceil(frames / imagesPerPage);
        const totalPages = coverPage + storyboardPages;
        
        // Update statistics
        const framesEl = document.getElementById('projectInfoFrames');
        const shotsEl = document.getElementById('projectInfoShots');
        const scenesEl = document.getElementById('projectInfoScenes');
        const pagesEl = document.getElementById('projectInfoPages');
        
        if (framesEl) framesEl.textContent = frames;
        if (shotsEl) shotsEl.textContent = shots;
        if (scenesEl) scenesEl.textContent = scenes;
        if (pagesEl) pagesEl.textContent = totalPages;
        
        // Update project file info
        const nameEl = document.getElementById('projectInfoName');
        const pathEl = document.getElementById('projectInfoPath');
        const lastSavedEl = document.getElementById('projectInfoLastSaved');
        const sizeEl = document.getElementById('projectInfoSize');
        
        if (nameEl) {
            nameEl.textContent = this.currentProjectPath || 'No project open';
        }
        if (pathEl) {
            pathEl.textContent = this.currentProjectPath || '-';
        }
        if (lastSavedEl) {
            // Try to get last saved time from storage
            const lastSaved = localStorage.getItem('storyboard_lastSaved');
            if (lastSaved) {
                const date = new Date(parseInt(lastSaved));
                lastSavedEl.textContent = date.toLocaleString();
            } else {
                lastSavedEl.textContent = 'Never';
            }
        }
        if (sizeEl) {
            // Calculate approximate project size
            const projectData = JSON.stringify(this.project);
            const sizeMB = (projectData.length / 1024 / 1024).toFixed(2);
            sizeEl.textContent = `${sizeMB} MB`;
        }
        
        // Update settings summary
        const pageSizeEl = document.getElementById('projectInfoPageSize');
        const orientationEl = document.getElementById('projectInfoOrientation');
        const layoutEl = document.getElementById('projectInfoLayout');
        const compressionEl = document.getElementById('projectInfoCompression');
        
        if (pageSizeEl) {
            pageSizeEl.textContent = this.project.settings.pageSize || 'A4';
        }
        if (orientationEl) {
            const orient = this.project.settings.orientation || 'landscape';
            orientationEl.textContent = orient.charAt(0).toUpperCase() + orient.slice(1);
        }
        if (layoutEl) {
            layoutEl.textContent = `${rows} × ${cols} (${imagesPerPage} images/page)`;
        }
        if (compressionEl) {
            const comp = this.project.settings.imageCompression || {};
            const enabled = comp.enabled !== false;
            if (enabled) {
                compressionEl.textContent = `${comp.maxWidthOrHeight || 1920}px, ${((comp.quality || 0.75) * 100).toFixed(0)}% quality, ${comp.format || 'webp'}`;
            } else {
                compressionEl.textContent = 'Disabled';
            }
        }
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
        // Special case for 'annotation' -> 'toggleAnnotationPanel'
        let btnId;
        if (panelName === 'annotation') {
            btnId = 'toggleAnnotationPanel';
        } else {
            btnId = 'toggle' + panelName.charAt(0).toUpperCase() + panelName.slice(1);
        }
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
            const previousPanel = this.activePanel;
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.toolbar-panel-btn').forEach(b => b.classList.remove('active'));
            
            // Disable annotation system if switching away from annotation panel
            if (previousPanel === 'annotation' && panelName !== 'annotation' && this.annotationSystem) {
                this.annotationSystem.setEnabled(false);
            }
            
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
        
        // Disable annotation system when annotation panel is closed
        if (panelName === 'annotation' && this.annotationSystem) {
            this.annotationSystem.setEnabled(false);
        }
    }
    
    /**
     * Ensure annotation system state is correct based on panel and checkbox state
     * Call this after renderStoryboard() to ensure canvases have correct pointer events
     */
    ensureAnnotationSystemState() {
        if (!this.annotationSystem) return;
        
        const annotationPanel = document.getElementById('annotationPanel');
        const enableAnnotation = document.getElementById('enableAnnotation');
        const isPanelOpen = annotationPanel && annotationPanel.classList.contains('active');
        const isEnabled = enableAnnotation && enableAnnotation.checked;
        
        // Only enable if both panel is open AND checkbox is checked
        this.annotationSystem.setEnabled(isPanelOpen && isEnabled);
    }
    
    setupDrawing() {
        const enableAnnotation = document.getElementById('enableAnnotation');
        const annotationControls = document.getElementById('annotationControls');
        const annotationPanel = document.getElementById('annotationPanel');
        if (enableAnnotation && annotationControls) {
            enableAnnotation.addEventListener('change', (e) => {
                this.project.settings.enableAnnotation = e.target.checked;
                annotationControls.style.display = e.target.checked ? 'block' : 'none';
                
                // Enable/disable annotation system
                if (this.annotationSystem) {
                    // Only enable if panel is open
                    const isPanelOpen = annotationPanel && annotationPanel.classList.contains('active');
                    this.annotationSystem.setEnabled(e.target.checked && isPanelOpen);
                    
                    // Initialize canvases on existing pages if needed
                    if (e.target.checked) {
                        setTimeout(() => {
                            const pages = document.querySelectorAll('.storyboard-page[data-page-index]');
                            pages.forEach(page => {
                                const pageIndex = parseInt(page.dataset.pageIndex || '0');
                                // Always re-initialize to ensure annotations are loaded
                                this.annotationSystem.initCanvas(page, pageIndex);
                            });
                        }, 200);
                    }
                }
                
                this.markChanged();
                // Don't re-render storyboard - this removes canvases. Just update visibility
                if (this.updateProjectInfo) this.updateProjectInfo();
            });
        }
        
        // Also disable when panel is closed
        if (annotationPanel) {
            const closeBtn = document.getElementById('closeAnnotationPanel');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (this.annotationSystem) {
                        this.annotationSystem.setEnabled(false);
                    }
                });
            }
        }
        
        // Drawing tool selection - sync with annotation system
        const updateDrawingTool = (tool) => {
            this.project.settings.drawingTool = tool;
            
            // Use new AnnotationSystem if available
            if (this.annotationSystem) {
                this.annotationSystem.setTool(tool);
            }
            // Fallback to legacy DrawingSystem
            else if (this.drawingSystem) {
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
        
        // Shapes dropdown button
        let shapesBtn = document.getElementById('shapesBtn');
        let shapesDropdown = document.getElementById('shapesDropdown');
        let shapesDropdownContainer = shapesBtn ? shapesBtn.closest('.tool-btn-dropdown') : null;
        
        if (shapesBtn && shapesDropdownContainer) {
            shapesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                shapesDropdownContainer.classList.toggle('active');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!shapesDropdownContainer.contains(e.target)) {
                    shapesDropdownContainer.classList.remove('active');
                }
            });
            
            // Handle shape grid item clicks
            shapesDropdown.querySelectorAll('.shapes-grid-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tool = item.dataset.tool;
                    updateDrawingTool(tool);
                    document.getElementById('drawingTool').value = tool;
                    
                    // Update active state - mark shapes button as active and the grid item
                    document.querySelectorAll('.tool-btn').forEach(b => {
                        b.classList.remove('active');
                        // Mark shapes button as active if a shape tool is selected
                        const isShapeTool = tool === 'line' || tool.startsWith('arrow') || tool === 'rectangle' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon';
                        if (b.id === 'shapesBtn' && isShapeTool) {
                            b.classList.add('active');
                        }
                    });
                    shapesDropdown.querySelectorAll('.shapes-grid-item').forEach(gi => {
                        gi.classList.toggle('active', gi.dataset.tool === tool);
                    });
                    
                    // Close dropdown
                    shapesDropdownContainer.classList.remove('active');
                    
                    // Show/hide fill shape option
                    const fillGroup = document.getElementById('fillShapeGroup');
                    const fillColorGroup = document.getElementById('fillColorGroup');
                    const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-zoom-in', 'arrow-zoom-out', 'arrow-orbit', 'arrow-u-turn', 'arrow-3d-corner', 'arrow-thin-zoom'];
                    if (fillGroup) {
                        fillGroup.style.display = fillableShapes.includes(tool) ? 'block' : 'none';
                    }
                    if (fillColorGroup) {
                        fillColorGroup.style.display = fillableShapes.includes(tool) && this.project.settings.fillShape ? 'block' : 'none';
                    }
                    
                    this.markChanged();
                });
            });
        }
        
        // Tool button selection (for non-shape tools)
        document.querySelectorAll('.tool-btn').forEach(btn => {
            // Skip shapes button - it's handled separately
            if (btn.id === 'shapesBtn') return;
            
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                if (!tool) return; // Skip if no tool attribute
                
                updateDrawingTool(tool);
                document.getElementById('drawingTool').value = tool;
                
                // Update active state
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Close shapes dropdown if open
                if (shapesDropdownContainer) {
                    shapesDropdownContainer.classList.remove('active');
                }
                
                // Show/hide fill shape option
                const fillGroup = document.getElementById('fillShapeGroup');
                const fillColorGroup = document.getElementById('fillColorGroup');
                const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-zoom-in', 'arrow-zoom-out', 'arrow-orbit', 'arrow-u-turn', 'arrow-3d-corner'];
                if (fillGroup) {
                    fillGroup.style.display = fillableShapes.includes(tool) ? 'block' : 'none';
                }
                if (fillColorGroup) {
                    fillColorGroup.style.display = fillableShapes.includes(tool) && this.project.settings.fillShape ? 'block' : 'none';
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
            const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-block'];
            if (fillGroup) {
                fillGroup.style.display = fillableShapes.includes(tool) ? 'block' : 'none';
            }
            if (fillColorGroup) {
                fillColorGroup.style.display = fillableShapes.includes(tool) && this.project.settings.fillShape ? 'block' : 'none';
            }
            this.markChanged();
        });
        
        // Brush size with number input - sync with new drawing system
        const brushSize = document.getElementById('brushSize');
        const brushSizeInput = document.getElementById('brushSizeInput');
        if (brushSize && brushSizeInput) {
            const updateBrushSize = (value) => {
                this.project.settings.brushSize = value;
                if (this.annotationSystem) {
                    this.annotationSystem.setBrushSize(value);
                } else if (this.drawingSystem) {
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
                if (this.annotationSystem) {
                    this.annotationSystem.setBrushColor(value);
                } else if (this.drawingSystem) {
                    this.drawingSystem.setBrushColor(value);
                }
            };
            
            brushColor.addEventListener('input', (e) => {
                updateBrushColor(e.target.value);
            });
        }
        
        const fillColor = document.getElementById('fillColor');
        if (fillColor) {
            // Set initial value from project settings
            if (this.project.settings.fillColor && this.project.settings.fillColor !== 'transparent') {
                fillColor.value = this.project.settings.fillColor;
            }
            
            const updateFillColor = (value) => {
                this.project.settings.fillColor = value;
                if (this.annotationSystem) {
                    this.annotationSystem.setFillColor(value);
                } else if (this.drawingSystem) {
                    this.drawingSystem.setFillColor(value);
                }
            };
            
            fillColor.addEventListener('input', (e) => {
                updateFillColor(e.target.value);
            });
        }
        
        const fillShapeCheckbox = document.getElementById('fillShape');
        if (fillShapeCheckbox) {
            // Set initial state from project settings
            fillShapeCheckbox.checked = this.project.settings.fillShape || false;
            
            fillShapeCheckbox.addEventListener('change', (e) => {
                this.project.settings.fillShape = e.target.checked;
                // Update annotation system fill enabled state
                if (this.annotationSystem) {
                    this.annotationSystem.setFillEnabled(e.target.checked);
                }
                // Show/hide fill color group based on checkbox
                const fillColorGroup = document.getElementById('fillColorGroup');
                if (fillColorGroup) {
                    const currentTool = this.project.settings.drawingTool || 'brush';
                    const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-block'];
                    fillColorGroup.style.display = (fillableShapes.includes(currentTool) && e.target.checked) ? 'block' : 'none';
                }
                // Update tool if a fillable shape is selected
                const currentTool = this.project.settings.drawingTool || 'brush';
                const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-block'];
                if (fillableShapes.includes(currentTool)) {
                    updateDrawingTool(currentTool);
                }
                this.markChanged();
            });
        }
        
        // Make updateDrawingTool available in this scope
        this.updateDrawingTool = updateDrawingTool;
        
        // Drawing controls - use new drawing system
        const undoBtn = document.getElementById('undoDrawing');
        const redoBtn = document.getElementById('redoDrawing');
        const clearBtn = document.getElementById('clearPageDrawing');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                const pages = document.querySelectorAll('.storyboard-page[data-page-index]');
                let activePage = null;
                
                for (const page of pages) {
                    const rect = page.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        activePage = page;
                        break;
                    }
                }
                
                if (!activePage && pages.length > 0) {
                    activePage = pages[0];
                }
                
                if (activePage) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    if (this.annotationSystem) {
                        this.annotationSystem.undo(pageIndex);
                    } else if (this.drawingSystem) {
                        this.drawingSystem.undo(pageIndex);
                    }
                }
            });
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                const pages = document.querySelectorAll('.storyboard-page[data-page-index]');
                let activePage = null;
                
                for (const page of pages) {
                    const rect = page.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        activePage = page;
                        break;
                    }
                }
                
                if (!activePage && pages.length > 0) {
                    activePage = pages[0];
                }
                
                if (activePage) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    if (this.annotationSystem) {
                        this.annotationSystem.redo(pageIndex);
                    } else if (this.drawingSystem) {
                        this.drawingSystem.redo(pageIndex);
                    }
                }
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const pages = document.querySelectorAll('.storyboard-page[data-page-index]');
                let activePage = null;
                
                for (const page of pages) {
                    const rect = page.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        activePage = page;
                        break;
                    }
                }
                
                if (!activePage && pages.length > 0) {
                    activePage = pages[0];
                }
                
                if (activePage) {
                    const pageIndex = parseInt(activePage.dataset.pageIndex || '0');
                    if (this.annotationSystem) {
                        this.annotationSystem.clear(pageIndex);
                        this.renderStoryboard();
                    } else if (this.drawingSystem) {
                        this.drawingSystem.clear(pageIndex);
                        this.renderStoryboard();
                    }
                }
            });
        }
        
        document.getElementById('clearDrawing').addEventListener('click', async () => {
            const confirmed = await this.customConfirm('Clear all annotations?');
            if (confirmed) {
                if (this.annotationSystem) {
                    this.annotationSystem.clearAll();
                }
                if (this.project.annotations) {
                    this.project.annotations = {};
                }
                if (this.project.drawings) {
                    this.project.drawings = {};
                }
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
        
        // Update active state for tool buttons
        const shapesBtnEl = document.getElementById('shapesBtn');
        const shapesDropdownEl = document.getElementById('shapesDropdown');
        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.id === 'shapesBtn') {
                // Mark shapes button as active if a shape tool is selected
                const isShapeTool = initialTool === 'line' || initialTool.startsWith('arrow') || initialTool === 'rectangle' || initialTool === 'circle' || initialTool === 'ellipse' || initialTool === 'triangle' || initialTool === 'polygon';
                b.classList.toggle('active', isShapeTool);
            } else {
                b.classList.toggle('active', b.dataset.tool === initialTool);
            }
        });
        
        // Update active state for shape grid items
        if (shapesDropdownEl) {
            shapesDropdownEl.querySelectorAll('.shapes-grid-item').forEach(gi => {
                gi.classList.toggle('active', gi.dataset.tool === initialTool);
            });
        }
        
        const fillGroup = document.getElementById('fillShapeGroup');
        const fillColorGroup = document.getElementById('fillColorGroup');
        const fillableShapes = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'arrow-block'];
        if (fillGroup) {
            fillGroup.style.display = fillableShapes.includes(initialTool) ? 'block' : 'none';
        }
        if (fillColorGroup) {
            fillColorGroup.style.display = fillableShapes.includes(initialTool) && this.project.settings.fillShape ? 'block' : 'none';
        }
        
        // Initialize drawing system tool
        if (this.drawingSystem) {
            updateDrawingTool(initialTool);
        }
    }
    
    setupColorPickers() {
        // Track which color picker is currently open and when it was opened
        let openColorPicker = null;
        let openTime = 0;
        
        // Get all color picker inputs
        const colorPickers = document.querySelectorAll('input[type="color"]');
        
        colorPickers.forEach(colorPicker => {
            // Find the close button for this color picker
            const closeButton = colorPicker.parentElement.querySelector('.color-picker-close');
            
            // Hide close button initially
            if (closeButton) {
                closeButton.style.display = 'none';
            }
            
            // Track when a color picker is focused (opened)
            colorPicker.addEventListener('focus', () => {
                openColorPicker = colorPicker;
                openTime = Date.now();
                // Show close button when color picker is focused
                if (closeButton) {
                    closeButton.style.display = 'flex';
                }
            });
            
            // Track when color picker loses focus (closed)
            colorPicker.addEventListener('blur', () => {
                if (openColorPicker === colorPicker) {
                    openColorPicker = null;
                    openTime = 0;
                }
                // Hide close button with small delay to allow close button click to register
                setTimeout(() => {
                    if (document.activeElement !== colorPicker && closeButton) {
                        closeButton.style.display = 'none';
                    }
                }, 100);
            });
        });
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
        ['coverPageTitleFontFamily', 'coverPageTitleFontSize', 'coverPageTitleColor', 
         'coverPageYearFontFamily', 'coverPageYearFontSize', 'coverPageYearColor', 
         'coverPageCreatorsFontFamily', 'coverPageCreatorsFontSize', 'coverPageCreatorsColor'].forEach(id => {
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
        
        // Watermark image position
        const watermarkImagePosition = document.getElementById('watermarkImagePosition');
        if (watermarkImagePosition) {
            watermarkImagePosition.addEventListener('change', (e) => {
                this.project.settings.watermarkImagePosition = e.target.value;
                this.hasUnsavedChanges = true;
                this.renderStoryboard();
            });
        }
        
        // Watermark image size
        const watermarkImageSize = document.getElementById('watermarkImageSize');
        const watermarkImageSizeInput = document.getElementById('watermarkImageSizeInput');
        if (watermarkImageSize && watermarkImageSizeInput) {
            watermarkImageSize.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                watermarkImageSizeInput.value = value;
                this.project.settings.watermarkImageSize = value;
                this.hasUnsavedChanges = true;
                this.renderStoryboard();
            });
            watermarkImageSizeInput.addEventListener('change', (e) => {
                const value = Math.max(10, Math.min(100, parseInt(e.target.value) || 50));
                watermarkImageSize.value = value;
                watermarkImageSizeInput.value = value;
                this.project.settings.watermarkImageSize = value;
                this.hasUnsavedChanges = true;
                this.renderStoryboard();
            });
        }
    }
    
    updateScaleDisplay() {
        // Use UIManager if available
        if (this.uiManager) {
            this.uiManager.updateScaleDisplay();
            return;
        }
        
        // Fallback to old implementation
        const scale = this.project.settings.imageScale;
        const scaleInput = document.getElementById('imageScaleInput');
        const scaleSlider = document.getElementById('imageScale');
        if (scaleInput) scaleInput.value = scale;
        if (scaleSlider) scaleSlider.value = scale;
    }
    
    markChanged() {
        this.hasUnsavedChanges = true;
        this.lastChangeTime = Date.now(); // Track when change was made
        this.updateSaveStatus(); // Update status indicator
        // Debounce auto-save to avoid performance issues
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            if (this.storageService) {
                this.storageService.saveToStorage(true).catch(e => console.error('Error saving to storage:', e));
            } else {
                this.saveToStorage(true).catch(e => console.error('Error saving to storage:', e));
            }
        }, 1000); // Wait 1 second after last change
    }
    
    /**
     * Initialize save status indicator
     */
    initSaveStatusIndicator() {
        // Update status every 10 seconds
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        this.statusUpdateInterval = setInterval(() => {
            this.updateSaveStatus();
        }, 10000);
        
        // Initial update
        this.updateSaveStatus();
    }
    
    /**
     * Update save status indicator
     */
    updateSaveStatus() {
        const indicator = document.getElementById('saveStatusIndicator');
        const circle = indicator?.querySelector('.save-status-circle');
        if (!indicator || !circle) return;
        
        if (!this.hasUnsavedChanges) {
            // Green: All saved
            circle.className = 'save-status-circle status-saved';
            indicator.title = 'All changes saved';
        } else {
            const now = Date.now();
            const timeSinceChange = this.lastChangeTime ? (now - this.lastChangeTime) / 1000 / 60 : 0; // Minutes
            
            if (timeSinceChange >= 5) {
                // Red: Unsaved for 5+ minutes
                circle.className = 'save-status-circle status-warning-red';
                const minutes = Math.floor(timeSinceChange);
                indicator.title = `Unsaved changes for ${minutes} minute${minutes !== 1 ? 's' : ''}. Please save your work.`;
            } else {
                // Orange: Unsaved changes
                circle.className = 'save-status-circle status-warning';
                indicator.title = 'You have unsaved changes';
            }
        }
    }
    
    /**
     * Calculate optimal rows and columns based on images per page and actual rendered container
     * Uses UV-packing style optimization to maximize space utilization
     */
    calculateOptimalLayout(imagesPerPage) {
        // Try to get actual rendered container dimensions first
        const existingContainer = document.querySelector('.image-grid-container');
        let availableWidthPx, availableHeightPx;
        
        if (existingContainer) {
            // Use actual rendered dimensions
            const containerRect = existingContainer.getBoundingClientRect();
            availableWidthPx = containerRect.width;
            availableHeightPx = containerRect.height;
            
        } else {
            // Fallback: calculate from page dimensions
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
            
            // Header text space (removed - no global page text)
            const headerTextSpacePx = 0;
            
            // Footer text space in pixels (bottom text area + margin-top)
            // Footer has max-height: 80px + margin-top: 10px = 90px max
            // IMPORTANT: When showBottomText is false, footerTextSpacePx is 0,
            // meaning that 90px becomes available for the image grid container
            const footerTextSpacePx = this.project.settings.showBottomText ? 90 : 0;
            
            // Available space for grid
            // Must account for: padding (top + bottom), header, footer
            // When footer is disabled (showBottomText = false), footerTextSpacePx = 0,
            // so the full height minus header is available for images
            availableWidthPx = pageWidthPx - (pagePaddingPx * 2);
            availableHeightPx = pageHeightPx - (pagePaddingPx * 2) - headerTextSpacePx - footerTextSpacePx;
            
        }
        
        // CSS gap between frames (20px from CSS)
        const gapPx = 20;
        
        // Frame component heights in pixels (from actual CSS - MUST match reality)
        // Shot number container: margin-bottom 10px + rectangle height ~25px = 35px
        const shotNumberHeightPx = 35;
        // Frame text: min-height 60px + padding 8px*2 + margin-top 5px = 81px
        // Apply frame text scale (30-100%) - this makes the entire frame smaller, allowing better distribution
        const frameTextScale = (this.project.settings.frameTextScale || 100) / 100;
        const baseFrameTextTotalPx = 81; // Base height: 60px min-height + 16px padding + 5px margin
        const frameTextTotalPx = baseFrameTextTotalPx * frameTextScale;
        
        // Margins between components: 
        // - shot-number-container margin-bottom: 10px
        // - frame-image-container margin-bottom: 10px  
        // - frame-text margin-top: 5px
        const componentMarginsPx = 25;
        
        // Image scale factor
        const imageScale = (this.project.settings.imageScale || 100) / 100;
        
        // Image container no longer has min-height - it can shrink to natural image size
        const IMAGE_CONTAINER_MIN_HEIGHT_PX = 0;
        
        // Minimum frame width in pixels (to ensure readability)
        const MIN_FRAME_WIDTH_PX = 80;
        
        // Calculate maximum possible columns
        const maxCols = Math.floor((availableWidthPx + gapPx) / (MIN_FRAME_WIDTH_PX + gapPx));
        
        // Store all valid layouts
        const validLayouts = [];
        
        // Test all possible row/column combinations
        // For each, calculate optimal scale to maximize space usage
        for (let rows = 1; rows <= imagesPerPage; rows++) {
            const cols = Math.ceil(imagesPerPage / rows);
            
            // Skip if too many columns
            if (cols > maxCols) continue;
            
            // Must have enough slots for all images
            if (rows * cols < imagesPerPage) continue;
            
            // Calculate base frame width (without scaling)
            const baseFrameWidthPx = (availableWidthPx - (cols - 1) * gapPx) / cols;
            
            // Skip if base frame is too narrow
            if (baseFrameWidthPx < MIN_FRAME_WIDTH_PX) continue;
            
            // Calculate what frame height would be at base width
            const baseScaledImageHeightPx = baseFrameWidthPx * 0.5 * imageScale;
            const baseImageContainerHeightPx = Math.max(baseScaledImageHeightPx, IMAGE_CONTAINER_MIN_HEIGHT_PX);
            const baseFrameHeightPx = shotNumberHeightPx + baseImageContainerHeightPx + frameTextTotalPx + componentMarginsPx;
            const baseTotalHeightNeededPx = rows * baseFrameHeightPx + (rows - 1) * gapPx;
            
            // Calculate optimal scale factor to maximize space usage
            // We can scale down frames to fit better vertically, or scale up if there's extra space
            let optimalScale = 1.0;
            let frameWidthPx = baseFrameWidthPx;
            let frameHeightPx = baseFrameHeightPx;
            let totalHeightNeededPx = baseTotalHeightNeededPx;
            
            if (baseTotalHeightNeededPx > availableHeightPx - 10) {
                // Need to scale down to fit vertically
                const maxHeightAvailable = availableHeightPx - 10;
                const heightScale = maxHeightAvailable / baseTotalHeightNeededPx;
                optimalScale = Math.max(heightScale, 0.5); // Don't scale below 50%
                
                // Recalculate with scale
                frameWidthPx = baseFrameWidthPx * optimalScale;
                // Ensure we don't go below minimum width
                if (frameWidthPx < MIN_FRAME_WIDTH_PX) continue;
                
                const scaledImageHeightPx = frameWidthPx * 0.5 * imageScale;
                const imageContainerHeightPx = Math.max(scaledImageHeightPx, IMAGE_CONTAINER_MIN_HEIGHT_PX);
                frameHeightPx = shotNumberHeightPx + imageContainerHeightPx + frameTextTotalPx + componentMarginsPx;
                totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;
            } else if (baseTotalHeightNeededPx < availableHeightPx * 0.8) {
                // Could scale up to use more space (but don't exceed available)
                const targetHeight = availableHeightPx * 0.95; // Use 95% of available height
                const heightScale = targetHeight / baseTotalHeightNeededPx;
                optimalScale = Math.min(heightScale, 1.2); // Don't scale above 120%
                
                // Recalculate with scale
                frameWidthPx = baseFrameWidthPx * optimalScale;
                // Ensure we don't exceed available width
                const maxWidth = (availableWidthPx - (cols - 1) * gapPx) / cols;
                if (frameWidthPx > maxWidth) {
                    frameWidthPx = maxWidth;
                    optimalScale = frameWidthPx / baseFrameWidthPx;
                }
                
                const scaledImageHeightPx = frameWidthPx * 0.5 * imageScale;
                const imageContainerHeightPx = Math.max(scaledImageHeightPx, IMAGE_CONTAINER_MIN_HEIGHT_PX);
                frameHeightPx = shotNumberHeightPx + imageContainerHeightPx + frameTextTotalPx + componentMarginsPx;
                totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;
                
                // Ensure it still fits
                if (totalHeightNeededPx > availableHeightPx - 10) {
                    // Revert to base if scaled version doesn't fit
                    frameWidthPx = baseFrameWidthPx;
                    frameHeightPx = baseFrameHeightPx;
                    totalHeightNeededPx = baseTotalHeightNeededPx;
                    optimalScale = 1.0;
                }
            }
            
            // Final check: ensure it fits
            if (totalHeightNeededPx > availableHeightPx - 10) continue;
            if (frameWidthPx < MIN_FRAME_WIDTH_PX) continue;
            
            // This is a valid layout - store it with metadata
            const unusedSlots = (rows * cols) - imagesPerPage;
            const spaceUtilization = totalHeightNeededPx / availableHeightPx;
            const widthUtilization = (cols * frameWidthPx + (cols - 1) * gapPx) / availableWidthPx;
            
            validLayouts.push({
                rows,
                cols,
                frameWidthPx,
                frameHeightPx,
                totalHeightNeededPx,
                unusedSlots,
                spaceUtilization,
                widthUtilization,
                aspectRatio: rows / cols,
                optimalScale,
                totalAreaUsed: frameWidthPx * frameHeightPx * imagesPerPage
            });
        }
        
        // If no valid layouts found, return a safe fallback
        if (validLayouts.length === 0) {
            const fallbackCols = Math.min(imagesPerPage, maxCols);
            const fallbackRows = Math.ceil(imagesPerPage / fallbackCols);
            return { rows: fallbackRows, cols: fallbackCols };
        }
        
        // Score and rank layouts using UV-packing style optimization
        // Goal: Maximize total area used while fitting within bounds
        validLayouts.forEach(layout => {
            // Calculate actual area used by frames (after scaling)
            const totalFrameArea = layout.totalAreaUsed;
            
            // Calculate available area in the container
            const availableArea = availableWidthPx * availableHeightPx;
            
            // Calculate wasted space
            const gridWidth = layout.cols * layout.frameWidthPx + (layout.cols - 1) * gapPx;
            const gridHeight = layout.totalHeightNeededPx;
            const gridArea = gridWidth * gridHeight;
            const unusedSlotArea = layout.unusedSlots * layout.frameWidthPx * layout.frameHeightPx;
            const unusedVerticalSpace = (availableHeightPx - gridHeight) * gridWidth;
            const unusedHorizontalSpace = (availableWidthPx - gridWidth) * gridHeight;
            const wastedSpace = unusedSlotArea + unusedVerticalSpace + unusedHorizontalSpace;
            
            // Area utilization: how much of the available container area is used by frames
            const areaUtilization = totalFrameArea / availableArea;
            
            // Efficiency score: maximize area used (primary factor)
            // Higher is better - we want to use as much space as possible
            const efficiencyScore = areaUtilization * 1000; // Scale up for precision
            
            // Penalty for wasted space
            const wastePenalty = (wastedSpace / availableArea) * 200;
            
            // Bonus for good aspect ratio (closer to square is better for readability)
            const aspectRatio = layout.rows / layout.cols;
            const aspectScore = (1 - Math.abs(aspectRatio - 1)) * 10; // Max 10 points for square
            
            // Small penalty for excessive scaling (prefer layouts that don't need much scaling)
            const scalePenalty = Math.abs(layout.optimalScale - 1.0) * 5;
            
            // Small preference for more rows (helps avoid very wide single-row layouts)
            const rowBonus = Math.min(layout.rows / 3, 1) * 3; // Max 3 points
            
            // Final score: maximize area used, minimize waste and scaling
            layout.score = efficiencyScore - wastePenalty + aspectScore - scalePenalty + rowBonus;
            
            // Store metadata for debugging
            layout.areaUtilization = areaUtilization;
            layout.wastedSpace = wastedSpace;
            layout.efficiencyScore = efficiencyScore;
        });
        
        // Sort by score (highest first) - best space utilization wins
        validLayouts.sort((a, b) => {
            // Primary: total score
            if (Math.abs(a.score - b.score) > 1) {
                return b.score - a.score;
            }
            // Secondary: prefer fewer unused slots
            if (a.unusedSlots !== b.unusedSlots) {
                return a.unusedSlots - b.unusedSlots;
            }
            // Tertiary: prefer better overall space utilization
            return b.areaUtilization - a.areaUtilization;
        });
        
        // Return the best layout with scale information
        const best = validLayouts[0];
        return { 
            rows: best.rows, 
            cols: best.cols,
            frameWidthPx: best.frameWidthPx,
            optimalScale: best.optimalScale
        };
    }
    
    /**
     * Get maximum images per page by testing layouts using EXACT same logic as calculateOptimalLayout
     * This ensures 100% consistency - we use the exact same calculation code
     */
    /**
     * Get maximum images per page based on ACTUAL rendered gridContainer dimensions
     * This ensures the calculation matches what's actually rendered on screen
     */
    getMaxImagesPerPage() {
        // Try to get actual rendered gridContainer dimensions
        const existingContainer = document.querySelector('.image-grid-container');
        
        if (existingContainer) {
            // Use actual rendered dimensions
            // The container already accounts for footer space (it's a flex sibling)
            // When footer is hidden, container automatically gets more space
            const containerRect = existingContainer.getBoundingClientRect();
            const availableWidthPx = containerRect.width;
            const availableHeightPx = containerRect.height;
            
            
            return this.calculateMaxFromDimensions(availableWidthPx, availableHeightPx);
        }
        
        
        // Fallback: calculate from page dimensions (for initial load before rendering)
        // This correctly accounts for footer space - when showBottomText is false, 
        // footerTextSpacePx is 0, so that space is available for images
        return this.calculateMaxFromPageDimensions();
    }
    
    /**
     * Calculate max images from actual grid container dimensions
     */
    calculateMaxFromDimensions(availableWidthPx, availableHeightPx) {
        // Constants (from CSS)
        const gapPx = 20;
        const MIN_FRAME_WIDTH_PX = 80;
        const shotNumberHeightPx = 35;
        // Apply frame text scale (30-100%) - this makes the entire frame smaller, allowing better distribution
        const frameTextScale = (this.project.settings.frameTextScale || 100) / 100;
        const baseFrameTextTotalPx = 81; // Base height: 60px min-height + 16px padding + 5px margin
        const frameTextTotalPx = baseFrameTextTotalPx * frameTextScale;
        const componentMarginsPx = 25;
        const IMAGE_CONTAINER_MIN_HEIGHT_PX = 0;
        const imageScale = (this.project.settings.imageScale || 100) / 100;
        
        // Frame text scale applied
        
        // Calculate maximum possible columns
        const maxCols = Math.floor((availableWidthPx + gapPx) / (MIN_FRAME_WIDTH_PX + gapPx));
        
        // Calculate minimum frame height (with scaled frame text)
        const minFrameHeightPx = shotNumberHeightPx + IMAGE_CONTAINER_MIN_HEIGHT_PX + frameTextTotalPx + componentMarginsPx;
        
        // Estimate upper bound - calculate what could theoretically fit
        const estimatedMaxRows = Math.floor((availableHeightPx + gapPx) / (minFrameHeightPx + gapPx));
        // Start with a reasonable estimate, but continue testing beyond it
        let upperBound = maxCols * Math.max(estimatedMaxRows, 1);
        // Set a practical maximum to prevent infinite loops (e.g., 100 images)
        const absoluteMax = 100;
        upperBound = Math.min(upperBound, absoluteMax);
        
        // Inputs
        
        let maxImages = 0;
        let lastValidLayout = null;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 5; // Stop after 5 consecutive failures
        
        // Test each count - continue until we find the actual maximum
        for (let testCount = 1; testCount <= upperBound; testCount++) {
            let fits = false;
            let bestLayout = null;
            
            for (let rows = 1; rows <= testCount; rows++) {
                const cols = Math.ceil(testCount / rows);
                
                if (cols > maxCols) {
                    continue;
                }
                if (rows * cols < testCount) {
                    continue;
                }
                
                const frameWidthPx = (availableWidthPx - (cols - 1) * gapPx) / cols;
                if (frameWidthPx < MIN_FRAME_WIDTH_PX) {
                    continue;
                }
                
                const scaledImageHeightPx = frameWidthPx * 0.5 * imageScale;
                const imageContainerHeightPx = Math.max(scaledImageHeightPx, IMAGE_CONTAINER_MIN_HEIGHT_PX);
                // Frame height includes scaled frame text - smaller text = smaller frame = better distribution
                const frameHeightPx = shotNumberHeightPx + imageContainerHeightPx + frameTextTotalPx + componentMarginsPx;
                const totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;
                
                const fitsCheck = totalHeightNeededPx <= availableHeightPx - 10;
                
                if (fitsCheck) {
                    fits = true;
                    bestLayout = {
                        rows,
                        cols,
                        frameWidth: Math.round(frameWidthPx),
                        frameHeight: Math.round(frameHeightPx),
                        totalHeight: Math.round(totalHeightNeededPx),
                        availableHeight: Math.round(availableHeightPx)
                    };
                    break;
                }
            }
            
            if (fits) {
                maxImages = testCount;
                lastValidLayout = bestLayout;
                consecutiveFailures = 0; // Reset failure counter
            } else {
                consecutiveFailures++;
                
                // If we've had multiple consecutive failures, we've likely found the max
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    break;
                }
                
                // Also check if we've tested enough to be confident
                // If we found a valid layout recently, keep going a bit more
                if (testCount > maxImages + 10 && maxImages > 0) {
                    break;
                }
            }
        }
        
        
        return Math.max(1, maxImages);
    }
    
    /**
     * Calculate max images from page dimensions (fallback for initial load)
     */
    calculateMaxFromPageDimensions() {
        const pageSizeObj = this.pageSizes[this.project.settings.pageSize];
        const orientation = this.project.settings.orientation;
        
        if (!pageSizeObj) {
            return 12;
        }
        
        // Get page dimensions in mm
        const pageWidthMm = orientation === 'portrait' ? pageSizeObj.width : pageSizeObj.height;
        const pageHeightMm = orientation === 'portrait' ? pageSizeObj.height : pageSizeObj.width;
        
        // Convert mm to pixels
        const mmToPx = 3.779527559;
        const pageWidthPx = pageWidthMm * mmToPx;
        const pageHeightPx = pageHeightMm * mmToPx;
        
        // Page padding (5mm on each side)
        const pagePaddingPx = 5 * mmToPx;
        
        // Header and footer space
        const headerTextSpacePx = 0; // No global page text
        // IMPORTANT: When showBottomText is false, footerTextSpacePx is 0,
        // meaning that 90px becomes available for the image grid container
        const footerTextSpacePx = this.project.settings.showBottomText ? 90 : 0;
        
        // Available space for grid
        // When footer is disabled (showBottomText = false), footerTextSpacePx = 0,
        // so the full height minus header is available for images
        const availableWidthPx = pageWidthPx - (pagePaddingPx * 2);
        const availableHeightPx = pageHeightPx - (pagePaddingPx * 2) - headerTextSpacePx - footerTextSpacePx;
        
        return this.calculateMaxFromDimensions(availableWidthPx, availableHeightPx);
    }
    
    /**
     * Helper function to test if a specific number of images can fit on the page
     * This is used by calculateOptimalLayout, not by getMaxImagesPerPage
     * Image scale IS considered here for actual layout calculations
     */
    canFitImagesOnPage(imagesPerPage, pageSize, orientation, imageScale, availableWidthPx, availableHeightPx, gapPx, shotNumberHeightPx, frameTextTotalPx, componentMarginsPx, MIN_FRAME_WIDTH_PX, maxCols, IMAGE_CONTAINER_MIN_HEIGHT_PX) {
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
            
            // Calculate image height based on frame width and scale
            // Most storyboard images are landscape (16:9 or 4:3)
            // Use 0.5 as estimate (height = 50% of width for landscape)
            const scaledImageHeightPx = frameWidthPx * 0.5 * imageScale;
            
            // CRITICAL: Use the MAXIMUM of scaled height and container min-height
            // The container enforces a minimum height regardless of image scale
            const imageContainerHeightPx = Math.max(scaledImageHeightPx, IMAGE_CONTAINER_MIN_HEIGHT_PX);
            
            // Calculate total frame height
            const frameHeightPx = shotNumberHeightPx + imageContainerHeightPx + frameTextTotalPx + componentMarginsPx;
            
            // Calculate total height needed for all rows
            const totalHeightNeededPx = rows * frameHeightPx + (rows - 1) * gapPx;
            
            // Check if it fits
            // CRITICAL: Use same tolerance as getMaxImagesPerPage for consistency
            // Use 10px tolerance to account for CSS rounding and flexbox spacing
            if (totalHeightNeededPx <= availableHeightPx - 10) {
                return true; // Found at least one valid layout
            }
        }
        
        return false; // No valid layout found
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
    
    // Rendering methods moved to RenderService
    // These are kept as fallbacks for compatibility
    updateImageScale() {
        if (this.renderService) {
            this.renderService.updateImageScale();
        }
    }
    
    updateFrameScale() {
        if (this.renderService) {
            this.renderService.updateFrameScale();
        }
    }
    
    updateLayoutInfo() {
        // Use UIManager if available
        if (this.uiManager) {
            this.uiManager.updateLayoutInfo();
            return;
        }
        
        // Update layout info display with manual rows/cols
        const rows = this.project.settings.layoutRows || 2;
        const cols = this.project.settings.layoutCols || 2;
        const totalImages = rows * cols;
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            layoutInfo.textContent = `Total: ${totalImages} image${totalImages !== 1 ? 's' : ''} per page`;
        }
    }
    
    
    newProject() {
        this.project = {
            images: [],
            settings: {
                orientation: 'landscape',
                pageSize: 'A4',
                layoutRows: 2, // Default for landscape (will be set based on orientation)
                layoutCols: 3, // Default for landscape
                imageScale: 100,
                fontFamily: 'Arial, sans-serif',
                fontSize: 12,
                lineHeight: 1.5,
                textColor: '#000000',
                textAlign: 'left',
                pageBackgroundColor: '#404040',
                separateScenes: false,
                showBottomText: true,
                enableCoverPage: false,
                coverPageTitle: '',
                coverPageTitleFontFamily: "'Kalam', cursive",
                coverPageTitleFontSize: 48,
                coverPageTitleColor: '#000000',
                coverPageYear: '',
                coverPageYearFontFamily: "'Kalam', cursive",
                coverPageYearFontSize: 24,
                coverPageYearColor: '#666666',
                coverPageCreators: '',
                coverPageCreatorsFontFamily: "'Kalam', cursive",
                coverPageCreatorsFontSize: 18,
                coverPageCreatorsColor: '#333333',
                coverPageLogo: null,
                enableWatermark: false,
                watermarkType: 'text',
                watermarkText: '',
                watermarkImage: null,
                watermarkImagePosition: 'center',
                watermarkImageSize: 50,
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
        this.lastChangeTime = null;
        this.updateSaveStatus();
        this.resetUI();
        this.renderStoryboard();
    }
    
    resetUI() {
        const pageOrientation = document.getElementById('pageOrientation');
        const pageSize = document.getElementById('pageSize');
        const layoutRowsSlider = document.getElementById('layoutRows');
        const layoutRowsInput = document.getElementById('layoutRowsInput');
        const layoutColsSlider = document.getElementById('layoutCols');
        const layoutColsInput = document.getElementById('layoutColsInput');
        const imageScale = document.getElementById('imageScale');
        const imageScaleInput = document.getElementById('imageScaleInput');
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const lineHeight = document.getElementById('lineHeight');
        const textColor = document.getElementById('textColor');
        const textAlign = document.getElementById('textAlign');
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
        if (layoutRowsSlider) layoutRowsSlider.value = 2;
        if (layoutRowsInput) layoutRowsInput.value = 2;
        if (layoutColsSlider) layoutColsSlider.value = 2;
        if (layoutColsInput) layoutColsInput.value = 2;
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            layoutInfo.textContent = `Total: 4 images per page`;
        }
        if (imageScale) imageScale.value = 100;
        if (imageScaleInput) imageScaleInput.value = 100;
        const frameTextScale = document.getElementById('frameTextScale');
        const frameTextScaleInput = document.getElementById('frameTextScaleInput');
        if (frameTextScale) frameTextScale.value = 100;
        if (frameTextScaleInput) frameTextScaleInput.value = 100;
        
        // Reset aspect ratio settings
        const imageAspectRatio = document.getElementById('imageAspectRatio');
        const customAspectRatioContainer = document.getElementById('customAspectRatioContainer');
        const customAspectRatioWidth = document.getElementById('customAspectRatioWidth');
        const customAspectRatioHeight = document.getElementById('customAspectRatioHeight');
        if (imageAspectRatio) imageAspectRatio.value = '16:9';
        if (customAspectRatioContainer) customAspectRatioContainer.style.display = 'none';
        if (customAspectRatioWidth) customAspectRatioWidth.value = 16;
        if (customAspectRatioHeight) customAspectRatioHeight.value = 9;
        if (fontFamily) fontFamily.value = 'Arial, sans-serif';
        if (fontSize) fontSize.value = 12;
        if (lineHeight) lineHeight.value = 1.5;
        if (textColor) textColor.value = '#000000';
        if (textAlign) textAlign.value = 'left';
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
        const enablePageNumbers = document.getElementById('enablePageNumbers');
        if (enablePageNumbers) enablePageNumbers.checked = true; // Default to enabled
        
        // Reset compression settings
        const compressionEnabled = document.getElementById('compressionEnabled');
        const compressionMaxSize = document.getElementById('compressionMaxSize');
        const compressionMaxSizeInput = document.getElementById('compressionMaxSizeInput');
        const compressionMaxDimension = document.getElementById('compressionMaxDimension');
        const compressionMaxDimensionInput = document.getElementById('compressionMaxDimensionInput');
        const compressionQuality = document.getElementById('compressionQuality');
        const compressionQualityInput = document.getElementById('compressionQualityInput');
        const compressionFormat = document.getElementById('compressionFormat');
        if (compressionEnabled) compressionEnabled.checked = true;
        if (compressionMaxSize) compressionMaxSize.value = 1;
        if (compressionMaxSizeInput) compressionMaxSizeInput.value = 1;
        if (compressionMaxDimension) compressionMaxDimension.value = 1920;
        if (compressionMaxDimensionInput) compressionMaxDimensionInput.value = 1920;
        if (compressionQuality) compressionQuality.value = 75;
        if (compressionQualityInput) compressionQualityInput.value = 75;
        if (compressionFormat) compressionFormat.value = 'webp';
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
    
    /**
     * Initialize the Image Import Modal
     */
    initImageImportModal() {
        const modal = document.getElementById('imageImportModal');
        const closeBtn = document.getElementById('imageImportModalClose');
        const cancelBtn = document.getElementById('imageImportCancel');
        const loadBtn = document.getElementById('imageImportLoad');
        const browseBtn = document.getElementById('browseImageFolder');
        const fileInput = document.getElementById('imageImportFileInput');
        const pathInput = document.getElementById('imageImportPath');

        // Populate structure examples - will be called when modal opens
        // Don't call here as parser might not be ready yet, call in openImageImportModal instead

        // Setup collapsible structure examples section
        const structureHeader = document.querySelector('.structure-info-header');
        const structureContainer = document.querySelector('.structure-examples-container');
        if (structureHeader && structureContainer) {
            structureHeader.addEventListener('click', () => {
                const isHidden = structureContainer.style.display === 'none';
                structureContainer.style.display = isHidden ? 'block' : 'none';
                const toggleIcon = structureHeader.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.textContent = isHidden ? '▼' : '▶';
                }
            });
        }

        // Close modal handlers
        const closeModal = () => {
            modal.style.display = 'none';
            this.pendingImportFiles = null;
            pathInput.value = '';
            document.getElementById('recognitionResults').style.display = 'none';
            loadBtn.disabled = true;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Browse button
        if (browseBtn) {
            browseBtn.addEventListener('click', async () => {
                // Use File System Access API if available
                if (this.fileManager && this.fileManager.supportsFileSystemAccess) {
                    try {
                        const startDir = await this.fileManager.getDirectoryForPicker();
                        const pickerOptions = {
                            mode: 'read',
                            id: 'importImages'
                        };
                        if (startDir) {
                            try {
                                pickerOptions.startIn = startDir;
                            } catch (e) {}
                        }
                        const directoryHandle = await window.showDirectoryPicker(pickerOptions);
                        this.fileManager.directoryHandle = directoryHandle;
                        const projectPath = this.currentProjectPath || 'default';
                        await this.fileManager.storeDirectoryHandle(projectPath, directoryHandle);
                        
                        // Get files from directory
                        const files = await this.getFilesFromDirectoryHandle(directoryHandle);
                        this.pendingImportFiles = files;
                        pathInput.value = directoryHandle.name;
                        this.analyzeImageStructure(files);
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            console.error('Error selecting directory:', error);
                            this.customAlert('Error selecting folder: ' + error.message);
                        }
                    }
                } else {
                    // Fallback to file input
                    fileInput.click();
                }
            });
        }

        // File input change
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files).filter(file => 
                    file.type.startsWith('image/')
                );
                if (files.length > 0) {
                    this.pendingImportFiles = files;
                    const folderName = files[0].webkitRelativePath?.split('/')[0] || 'Selected Folder';
                    pathInput.value = folderName;
                    this.analyzeImageStructure(files);
                }
            });
        }

        // Load button
        if (loadBtn) {
            loadBtn.addEventListener('click', async () => {
                if (this.pendingImportFiles) {
                    await this.loadImagesWithStructure(this.pendingImportFiles);
                    closeModal();
                }
            });
        }

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    /**
     * Populate structure examples in the modal
     */
    populateStructureExamples() {
        const examplesContainer = document.getElementById('structureExamples');
        if (examplesContainer) {
            // Check if parser is available
            if (!this.imageStructureParser) {
                examplesContainer.innerHTML = '<p style="color: #a0a0a0;">Structure parser not initialized.</p>';
                return;
            }
            
            if (typeof this.imageStructureParser.getRecognitionExamples !== 'function') {
                examplesContainer.innerHTML = '<p style="color: #a0a0a0;">Structure parser method not available.</p>';
                return;
            }
            
            try {
                const examples = this.imageStructureParser.getRecognitionExamples();
                if (examples && Array.isArray(examples) && examples.length > 0) {
                    examplesContainer.innerHTML = examples.map(example => `
                        <div class="structure-example-card">
                            <div class="structure-example-header">
                                <span class="structure-example-icon">${example.icon || '📁'}</span>
                                <span class="structure-example-name">${example.name || 'Unknown'}</span>
                            </div>
                            <p class="structure-example-description">${example.description || ''}</p>
                            <ul class="structure-example-list">
                                ${(example.examples || []).map(ex => `<li>${ex}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('');
                } else {
                    examplesContainer.innerHTML = '<p style="color: #a0a0a0;">No examples available.</p>';
                }
            } catch (error) {
                examplesContainer.innerHTML = '<p style="color: #a0a0a0;">Error loading structure examples.</p>';
            }
        }
    }

    /**
     * Open the Image Import Modal
     */
    openImageImportModal() {
        const modal = document.getElementById('imageImportModal');
        if (modal) {
            modal.style.display = 'block';
            // Repopulate examples when modal opens (in case parser wasn't ready before)
            this.populateStructureExamples();
        }
    }

    /**
     * Get all files from a directory handle recursively
     */
    async getFilesFromDirectoryHandle(directoryHandle) {
        const files = [];
        
        async function processEntry(entry, path = '') {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                // CRITICAL: Always construct the full relative path
                // Even if path is empty (root level), we still want the full path structure
                // For root files, relativePath will be just the filename (which is correct)
                // For nested files, relativePath will be "folder/subfolder/filename"
                const relativePath = path ? `${path}/${entry.name}` : entry.name;
                
                // Create a wrapper object that stores both the file and the path
                // This allows the parser to access webkitRelativePath while keeping
                // the original File object for FileReader
                const fileWrapper = {
                    file: file, // Store the original File object
                    webkitRelativePath: relativePath, // Store the path
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                };
                
                files.push(fileWrapper);
            } else if (entry.kind === 'directory') {
                const dirHandle = entry;
                const newPath = path ? `${path}/${entry.name}` : entry.name;
                for await (const handle of dirHandle.values()) {
                    await processEntry(handle, newPath);
                }
            }
        }

        for await (const entry of directoryHandle.values()) {
            await processEntry(entry);
        }

        return files.filter(file => file.type && file.type.startsWith('image/'));
    }

    /**
     * Analyze image structure and display results
     */
    analyzeImageStructure(files) {
        const enableRecognition = document.getElementById('enableStructureRecognition')?.checked !== false;
        const resultsDiv = document.getElementById('recognitionResults');
        const infoDiv = document.getElementById('recognitionInfo');
        const loadBtn = document.getElementById('imageImportLoad');

        if (!enableRecognition) {
            resultsDiv.style.display = 'block';
            infoDiv.innerHTML = '<em>Structure recognition is disabled. Images will be loaded without automatic numbering. You can add scene/shot/frame numbers manually in the storyboard.</em>';
            loadBtn.disabled = false;
            return;
        }

        const structure = this.imageStructureParser.parseFileStructure(files);

        if (structure.recognized && structure.structureInfo) {
            resultsDiv.style.display = 'block';
            const info = structure.structureInfo;
            let infoText = `<strong>Structure Type:</strong> ${info.structure}<br>`;
            
            if (info.scenes) infoText += `<strong>Scenes:</strong> ${info.scenes}<br>`;
            if (info.shots) infoText += `<strong>Shots:</strong> ${info.shots}<br>`;
            if (info.frames) infoText += `<strong>Frames:</strong> ${info.frames}<br>`;
            if (info.recognized !== undefined) {
                infoText += `<strong>Recognized:</strong> ${info.recognized} of ${info.total} files<br>`;
            }
            
            infoText += '<br><em>Scene, shot, and frame numbers will be automatically populated.</em>';
            infoDiv.innerHTML = infoText;
        } else {
            resultsDiv.style.display = 'block';
            infoDiv.innerHTML = '<em>Structure not recognized. Images will be loaded with frame numbers from filenames.</em>';
        }

        loadBtn.disabled = false;
    }

    /**
     * Load images with structure recognition
     */
    async loadImagesWithStructure(files) {
        // Check if structure recognition is enabled
        const enableRecognition = document.getElementById('enableStructureRecognition')?.checked !== false;
        
        let structure;
        if (enableRecognition) {
            structure = this.imageStructureParser.parseFileStructure(files);
        } else {
            // Disabled: just load files without structure recognition
            structure = {
                type: 'simple',
                images: files.map(file => {
                    const fileName = file.name || (file.file && file.file.name) || 'unknown';
                    return {
                        file: file,
                        sceneNumber: '',
                        shotNumber: '',
                        frameNumber: '', // Empty - user will fill manually
                        path: file.webkitRelativePath || fileName
                    };
                }),
                recognized: false,
                structureInfo: null
            };
        }
        
        // If structure.images is empty but we have files, use the files directly
        // Always respect the toggle - don't use filenames when recognition is disabled
        if (!structure.images || structure.images.length === 0) {
            structure.images = files.map(file => {
                const fileName = file.name || (file.file && file.file.name) || 'unknown';
                return {
                    file: file,
                    sceneNumber: '',
                    shotNumber: '',
                    frameNumber: '', // Always empty when recognition is disabled
                    path: file.webkitRelativePath || fileName
                };
            });
        }
        
        try {
            // Load images as base64
            const loadedImages = await Promise.all(
                structure.images.map(async (item) => {
                    let file = item.file;
                    let relativePath = item.path; // Preserve the path from item
                    
                    if (!file) {
                        return null;
                    }
                    
                    // CRITICAL: If file is a wrapper object, extract the path BEFORE extracting the file
                    // The wrapper's webkitRelativePath is the ONLY source of the full path
                    // Once we extract file.file, we lose access to the wrapper's properties
                    if (file && file.file && file.file instanceof File) {
                        // This is our wrapper object - capture the path FIRST
                        if (file.webkitRelativePath) {
                            relativePath = file.webkitRelativePath; // This is the full relative path
                        }
                        // Now extract the actual File object for FileReader
                        file = file.file;
                    }
                    
                    // Ensure we have a valid File/Blob object
                    if (!(file instanceof File) && !(file instanceof Blob)) {
                        console.error('File is not a File or Blob:', file, typeof file, file?.constructor?.name);
                        return null;
                    }
                    
                    // CRITICAL: Get the full relative path - prioritize in this order:
                    // 1. relativePath (from wrapper - this is the most reliable)
                    // 2. file.webkitRelativePath (from File object - for file input fallback)
                    // 3. file.name (fallback - just filename, not ideal)
                    const filePath = relativePath || file.webkitRelativePath || file.name;
                    
                    return new Promise(async (resolve, reject) => {
                        try {
                            // Compress image before converting to Base64
                            // This significantly reduces project file size while maintaining quality
                            let compressedUrl;
                            
                            // Get compression settings from project
                            const compSettings = this.project.settings.imageCompression || {};
                            const enabled = compSettings.enabled !== false; // Default to true
                            
                            if (enabled && window.ImageCompression && typeof window.ImageCompression.compressImage === 'function') {
                                const format = compSettings.format || 'webp';
                                compressedUrl = await window.ImageCompression.compressImage(file, {
                                    maxSizeMB: compSettings.maxSizeMB || 0.5, // Reduced from 1MB
                                    maxWidthOrHeight: compSettings.maxWidthOrHeight || 1920,
                                    useWebWorker: true,
                                    fileType: `image/${format}`,
                                    initialQuality: compSettings.quality || 0.75 // Optimized for size
                                });
                            } else {
                                // Fallback: use FileReader if compression not available
                                compressedUrl = await new Promise((res, rej) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => res(e.target.result);
                                    reader.onerror = () => rej(new Error('Failed to read file'));
                                    reader.readAsDataURL(file);
                                });
                            }
                            
                            // Use the captured filePath (which should be the full relative path from wrapper)
                            // Note: If files are in the root of the selected directory, filePath will be just the filename
                            // This is CORRECT - the relative path from the root IS just the filename
                            const finalFilePath = filePath || file.name;
                            
                            resolve({
                                name: file.name,
                                originalName: file.name,
                                url: compressedUrl,
                                sceneNumber: item.sceneNumber || '',
                                shotNumber: item.shotNumber || '',
                                frameNumber: item.frameNumber || '', // Don't use filename when recognition disabled
                                scene: item.sceneNumber || '', // For backward compatibility
                                filePath: finalFilePath // CRITICAL: Save the relative path (filename for root files, "folder/subfolder/filename" for nested files)
                            });
                        } catch (error) {
                            console.error('Error compressing/reading file:', file.name, error);
                            reject(new Error(`Failed to process ${file.name}`));
                        }
                    });
                })
            );
            
            // Filter out null results
            const validImages = loadedImages.filter(img => img !== null);

            // Check for duplicates
            const isFirstImport = this.project.images.length === 0;
            const existingImagesMap = new Map();
            const duplicateImages = [];
            const newImages = [];
            
            if (!isFirstImport) {
                this.project.images.forEach(img => {
                    existingImagesMap.set(img.name, img);
                });
            }

            // Separate duplicates from new images
            validImages.forEach(newImg => {
                if (existingImagesMap.has(newImg.name)) {
                    duplicateImages.push(newImg);
                } else {
                    newImages.push(newImg);
                }
            });

            // Handle duplicates if any found
            let handleDuplicates = 'skip'; // 'skip' or 'copy'
            if (duplicateImages.length > 0 && !isFirstImport) {
                const duplicateNames = duplicateImages.map(img => img.name).join(', ');
                const message = `Found ${duplicateImages.length} image(s) that already exist in the project:\n\n${duplicateNames}\n\nHow would you like to handle these duplicates?`;
                
                const choice = await this.customChoice(
                    'Duplicate Images Found',
                    message,
                    [
                        { label: 'Skip Duplicates', value: 'skip', primary: false },
                        { label: 'Load as Copies', value: 'copy', primary: false },
                        { label: 'Cancel', value: 'cancel', primary: true }
                    ]
                );
                
                if (choice === 'cancel' || choice === 'Cancel' || choice === null) {
                    return; // User cancelled
                }
                
                // choice will be 'copy' or 'skip' at this point
                handleDuplicates = choice;
            }

            // Process images based on duplicate handling choice
            const imagesToAdd = [...newImages];
            if (handleDuplicates === 'copy') {
                // Add duplicates as copies with unique names
                duplicateImages.forEach(dupImg => {
                    let copyNumber = 1;
                    let newName = dupImg.name;
                    const nameParts = newName.split('.');
                    const extension = nameParts.pop();
                    const baseName = nameParts.join('.');
                    
                    // Find a unique name for the copy
                    // Check both existing images and images we're about to add
                    const allExistingNames = new Set([...existingImagesMap.keys(), ...imagesToAdd.map(img => img.name)]);
                    while (allExistingNames.has(newName)) {
                        newName = `${baseName}_copy${copyNumber}.${extension}`;
                        copyNumber++;
                    }
                    
                    const copyImg = {
                        ...dupImg,
                        name: newName,
                        originalName: dupImg.name, // Keep original name for reference
                        filePath: dupImg.filePath || dupImg.name // Preserve the filePath from original
                    };
                    imagesToAdd.push(copyImg);
                });
            } else if (handleDuplicates === 'skip') {
                // Update existing images with new URLs if needed, but don't add duplicates
                duplicateImages.forEach(dupImg => {
                    const existing = existingImagesMap.get(dupImg.name);
                    if (existing) {
                        // Preserve existing metadata, but update scene/shot/frame if structure recognized AND recognition is enabled
                        if (structure.recognized && enableRecognition) {
                            if (dupImg.sceneNumber) existing.sceneNumber = dupImg.sceneNumber;
                            if (dupImg.shotNumber) existing.shotNumber = dupImg.shotNumber;
                            if (dupImg.frameNumber) existing.frameNumber = dupImg.frameNumber;
                        }
                        existing.url = dupImg.url; // Update URL
                    }
                });
            }

            // Add new images
            imagesToAdd.forEach(newImg => {
                // CRITICAL: Ensure filePath is set - if it's just the filename, that's OK for root files
                // But log it so we can verify the path is being captured correctly
                if (!newImg.filePath) {
                    console.error(`ERROR: Image "${newImg.name}" missing filePath entirely!`);
                    newImg.filePath = newImg.name; // Fallback to filename
                }
                this.project.images.push(newImg);
                if (newImg.sceneNumber && enableRecognition) {
                    this.project.imageScenes[newImg.name] = newImg.sceneNumber;
                }
            });
            
            // Store the directory name for reference (needed when loading project)
            if (this.fileManager && this.fileManager.directoryHandle) {
                this.imageFolderPath = this.fileManager.directoryHandle.name;
            }

            // Sort images: Scene → Shot → Frame (missing values come last)
            this.sortImagesByStructure();

            // Mark as changed and render
            this.markChanged();
            if (this.storageService) {
                await this.storageService.saveToStorage(false);
            } else {
                await this.saveToStorage(false);
            }
            this.renderStoryboard();
            
            // Rebuild previz timeline if it exists (to include new storyboard images)
            if (this.previsController && this.previsController.previsManager) {
                this.previsController.previsManager.buildTimelineFromStoryboard();
                this.previsController.renderTimeline();
            }
            if (this.updateProjectInfo) this.updateProjectInfo();
            
            // Show success message
            const totalLoaded = imagesToAdd.length;
            const skippedCount = handleDuplicates === 'skip' ? duplicateImages.length : 0;
            const copiedCount = handleDuplicates === 'copy' ? duplicateImages.length : 0;
            let message = `Successfully loaded ${totalLoaded} image${totalLoaded !== 1 ? 's' : ''}`;
            if (skippedCount > 0) {
                message += ` (${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped)`;
            } else if (copiedCount > 0) {
                message += ` (${copiedCount} duplicate${copiedCount !== 1 ? 's' : ''} loaded as copies)`;
            }
            if (structure.recognized) {
                message += ' with structure recognition';
            }
            this.showToast(message);
        } catch (error) {
            console.error('Error loading images:', error);
            await this.customAlert('Error loading images: ' + error.message);
        }
    }

    async importImages(event) {
        if (!event || !event.target || !event.target.files) {
            console.error('importImages: Invalid event or missing files');
            return;
        }
        
        const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        
        if (files.length === 0) {
            await this.customAlert('No image files found in the selected folder.');
            return;
        }
        
        // Store folder path for reload
        if (event.target.files.length > 0) {
            this.imageFolderPath = event.target.files[0].webkitRelativePath.split('/')[0] || null;
        }
        
        try {
            // Use ImageManager if available, otherwise fall back to old logic
            if (this.imageManager) {
                const isReloading = this.imagesNeedReload && this.pendingImageMetadata;
                const isFirstImport = this.project.images.length === 0 || isReloading;
                
                // Load images using ImageManager
                const newImages = await this.imageManager.loadImagesFromFiles(files, {
                    preserveMetadata: !isFirstImport,
                    isReloading: isReloading,
                    pendingMetadata: this.pendingImageMetadata
                });
                
                // Merge with existing images
                this.project.images = this.imageManager.mergeImages(
                    newImages,
                    this.project.images,
                    isFirstImport
                );
                
                // Clear reload flags if reloading
                if (isReloading) {
                    this.imagesNeedReload = false;
                    this.pendingImageMetadata = null;
                }
            } else {
                // Fallback to old logic if ImageManager not available
                // [Keep old logic here as fallback - too long to duplicate]
                return;
            }
            
            
            // Verify all images have URLs
            this.project.images.forEach((img, idx) => {
                if (!img.url) {
                    console.error(`Image ${idx} (${img.name}) missing URL:`, img);
                }
            });
            
            this.markChanged();
            
            // Use UIManager for rendering if available
            if (this.uiManager) {
                this.uiManager.renderStoryboard();
            } else {
                this.renderStoryboard();
            }
            if (this.updateProjectInfo) this.updateProjectInfo();
        } catch (error) {
            console.error('Error importing images:', error);
            await this.customAlert('Error importing images: ' + error.message);
        }
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
        if (this.renderService) {
            this.renderService.renderStoryboard();
        } else if (this.uiManager) {
            this.uiManager.renderStoryboard();
        } else {
            // Fallback - should not happen in normal operation
            console.warn('No render service available');
        }
    }
    
    // Rendering methods moved to RenderService
    // These are kept as fallback stubs for compatibility
    createPage(...args) {
        if (this.renderService) {
            return this.renderService.createPage(...args);
        }
        console.warn('createPage called but RenderService not available');
    }
    
    createCoverPage(...args) {
        if (this.renderService) {
            return this.renderService.createCoverPage(...args);
        }
        console.warn('createCoverPage called but RenderService not available');
    }
    
    createFrame(...args) {
        if (this.renderService) {
            return this.renderService.createFrame(...args);
        }
        console.warn('createFrame called but RenderService not available');
    }
    
    openImageSettings(image) {
        this.currentEditingImage = image;
        this.currentEditingImageIndex = this.project.images.findIndex(img => img.name === image.name);
        const modal = document.getElementById('imageSettingsModal');
        document.getElementById('imageSettingsScene').value = this.project.imageScenes[image.name] || image.sceneNumber || '';
        document.getElementById('imageSettingsShot').value = image.shotNumber || '';
        // Don't use filename as fallback - respect empty frameNumber
        document.getElementById('imageSettingsFrame').value = image.frameNumber || '';
        // Show file path
        const filePathInput = document.getElementById('imageSettingsFilePath');
        if (filePathInput) {
            filePathInput.value = image.filePath || image.name || 'Unknown';
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
            const hasEditLayers = image.editLayers && image.editLayers.length > 0;
            const hasOriginalUrl = image.originalUrl && image.originalUrl !== image.url;
            if (hasEditLayers || hasOriginalUrl) {
                resetEditsBtn.style.display = 'block';
            } else {
                resetEditsBtn.style.display = 'none';
            }
        }
        
        // Update preview image
        const previewImg = document.getElementById('imageSettingsPreviewImg');
        if (previewImg) {
            // Check if image has edit layers - if so, use composite
            if (image.editLayers && image.editLayers.length > 0) {
                // Use cached composite if available
                if (image.compositeUrl) {
                    previewImg.src = image.compositeUrl;
                } else {
                    // Create composite for preview
                    if (this.renderService && this.renderService.createImageComposite) {
                        this.renderService.createImageComposite(image, previewImg);
                    } else {
                        // Fallback to original
                        previewImg.src = image.url || '';
                    }
                }
            } else {
                // No edits, use original image
                previewImg.src = image.url || '';
            }
        }
        
        modal.style.display = 'block';
    }
    
    /**
     * Edit image in drawing canvas
     */
    editImage() {
        if (!this.currentEditingImage) return;
        
        const image = this.currentEditingImage;
        
        // Close image settings modal
        const imageSettingsModal = document.getElementById('imageSettingsModal');
        if (imageSettingsModal) {
            imageSettingsModal.style.display = 'none';
        }
        
        // Open drawing canvas with image as background
        if (this.openDrawingCanvas) {
            // Get image dimensions
            const img = new Image();
            img.onload = () => {
                this.openDrawingCanvas({
                    imageUrl: image.url,
                    imageWidth: img.width,
                    imageHeight: img.height,
                    editLayers: image.editLayers || [],
                    editingImage: image
                });
            };
            img.onerror = () => {
                console.error('Failed to load image for editing:', image.url);
            };
            img.src = image.url;
        }
    }
    
    /**
     * Reset image edits (remove edit layers)
     */
    async resetImageEdits() {
        if (!this.currentEditingImage) return;
        
        const confirmed = await this.customConfirm('Reset all edits for this image? This will remove all drawing layers and restore the original image.');
        if (confirmed) {
            // Remove edit layers and cached composite
            delete this.currentEditingImage.editLayers;
            delete this.currentEditingImage.compositeUrl;
            
            // Hide reset button
            const resetEditsBtn = document.getElementById('imageSettingsResetEdits');
            if (resetEditsBtn) {
                resetEditsBtn.style.display = 'none';
            }
            
            // Mark project as changed
            this.markChanged();
            
            // Re-render storyboard
            if (this.renderStoryboard) {
                this.renderStoryboard();
            }
        }
    }
    
    async saveImageSettings() {
        if (!this.currentEditingImage) return;
        
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
                    const oldImage = { ...this.currentEditingImage };
                    
                    // Update the image with new data
                    Object.assign(this.currentEditingImage, newImageData);
                    
                    // Preserve scene/shot/frame numbers if they exist
                    if (oldImage.sceneNumber) {
                        this.currentEditingImage.sceneNumber = oldImage.sceneNumber;
                    }
                    if (oldImage.shotNumber) {
                        this.currentEditingImage.shotNumber = oldImage.shotNumber;
                    }
                    if (oldImage.frameNumber) {
                        this.currentEditingImage.frameNumber = oldImage.frameNumber;
                    }
                    
                    // Preserve frame text
                    if (this.project.frameTexts[oldImage.name]) {
                        this.project.frameTexts[this.currentEditingImage.name] = this.project.frameTexts[oldImage.name];
                        delete this.project.frameTexts[oldImage.name];
                    }
                    
                    // Update image scenes mapping
                    if (this.project.imageScenes[oldImage.name]) {
                        this.project.imageScenes[this.currentEditingImage.name] = this.project.imageScenes[oldImage.name];
                        delete this.project.imageScenes[oldImage.name];
                    }
                    
                    // Update the image in the array
                    const imageIndex = this.project.images.findIndex(img => img.name === oldImage.name);
                    if (imageIndex !== -1) {
                        this.project.images[imageIndex] = this.currentEditingImage;
                    }
                }
            } catch (error) {
                console.error('Error replacing image:', error);
                await this.customAlert('Error replacing image: ' + error.message);
                return;
            }
        }
        
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
        
        // Re-sort images after updating scene/shot/frame numbers
        this.sortImagesByStructure();
        
        // Update the current editing image index since the image may have moved
        if (this.currentEditingImage) {
            this.currentEditingImageIndex = this.project.images.findIndex(img => img.name === this.currentEditingImage.name);
        }
        
        this.markChanged();
        document.getElementById('imageSettingsModal').style.display = 'none';
        this.renderStoryboard();
    }
    
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
            
            // Sync previz timeline when storyboard frame is deleted
            if (this.previsController && this.previsController.previsManager) {
                // Rebuild timeline from storyboard (this will remove the deleted frame)
                this.previsController.previsManager.buildTimelineFromStoryboard();
                // Re-render timeline if previz is active
                if (this.previsController) {
                    this.previsController.renderTimeline();
                }
            }
            
            // Ensure annotation system state is correct after image deletion and re-render
            // Do this after renderStoryboard so canvases are recreated with correct state
            setTimeout(() => {
                this.ensureAnnotationSystemState();
                // Reset cursor on all pages after deletion
                document.querySelectorAll('.storyboard-page').forEach(page => {
                    page.style.cursor = 'default';
                });
            }, 200);
        }
    }
    
    /**
     * Parse single image filename to extract scene/shot/frame numbers
     * Auto-populates the add image modal fields if structure is recognized
     */
    parseSingleImageFilename(file) {
        if (!file || !this.imageStructureParser) return;
        
        // Create a mock file structure for the parser
        const mockFile = {
            name: file.name,
            webkitRelativePath: file.name,
            file: file
        };
        
        // Parse the filename structure
        const structure = this.imageStructureParser.parseFileStructure([mockFile]);
        
        // Get values from modal inputs (user may have edited them)
        const sceneInput = document.getElementById('addImageScene');
        const shotInput = document.getElementById('addImageShot');
        const frameInput = document.getElementById('addImageFrame');
        
        if (structure.images && structure.images.length > 0) {
            const parsed = structure.images[0];
            // Only auto-populate if field is empty
            if (sceneInput && !sceneInput.value && parsed.sceneNumber) {
                sceneInput.value = parsed.sceneNumber;
            }
            if (shotInput && !shotInput.value && parsed.shotNumber) {
                shotInput.value = parsed.shotNumber;
            }
            if (frameInput && !frameInput.value && parsed.frameNumber) {
                frameInput.value = parsed.frameNumber;
            }
        }
    }
    
    /**
     * Clear add image modal fields
     */
    clearAddImageModal() {
        const fileInput = document.getElementById('addImageFile');
        const sceneInput = document.getElementById('addImageScene');
        const shotInput = document.getElementById('addImageShot');
        const frameInput = document.getElementById('addImageFrame');
        
        if (fileInput) fileInput.value = '';
        if (sceneInput) sceneInput.value = '';
        if (shotInput) shotInput.value = '';
        if (frameInput) frameInput.value = '';
    }
    
    async addImage() {
        const fileInput = document.getElementById('addImageFile');
        const sceneInput = document.getElementById('addImageScene');
        const shotInput = document.getElementById('addImageShot');
        const frameInput = document.getElementById('addImageFrame');
        const file = fileInput.files[0];
        
        if (!file) {
            await this.customAlert('Please select an image file.');
            return;
        }
        
        // Check if file already exists
        const existingImage = this.project.images.find(img => img.name === file.name);
        let loadAsCopy = false;
        
        if (existingImage) {
            const choice = await this.customChoice(
                'Image Already Exists',
                `The image "${file.name}" already exists in the project.\n\nWould you like to load it as a copy?`,
                ['Load as Copy', 'Cancel']
            );
            
            if (choice === 'Cancel' || choice === null) {
                return; // User cancelled
            }
            
            loadAsCopy = true;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            // Get values from inputs (user may have edited them)
            const sceneNumber = sceneInput ? sceneInput.value.trim() : '';
            const shotNumber = shotInput ? shotInput.value.trim() : '';
            const frameNumber = frameInput ? frameInput.value.trim() : '';
            
            let imageName = file.name;
            
            // If loading as copy, create a unique name
            if (loadAsCopy) {
                let copyNumber = 1;
                const nameParts = imageName.split('.');
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                
                // Find a unique name for the copy
                while (this.project.images.find(img => img.name === imageName)) {
                    imageName = `${baseName}_copy${copyNumber}.${extension}`;
                    copyNumber++;
                }
            }
            
            const newImage = {
                name: imageName,
                originalName: file.name, // Keep original name for reference
                url: e.target.result,
                sceneNumber: sceneNumber,
                shotNumber: shotNumber,
                frameNumber: frameNumber,
                scene: sceneNumber, // Keep for backward compatibility
                filePath: file.webkitRelativePath || file.name
            };
            
            // Insert at current position or at end
            if (this.currentEditingImageIndex !== undefined && this.currentEditingImageIndex >= 0) {
                this.project.images.splice(this.currentEditingImageIndex + 1, 0, newImage);
            } else {
                this.project.images.push(newImage);
            }
            
            // Sort images: Scene → Shot → Frame (missing values come last)
            this.sortImagesByStructure();
            
            this.markChanged();
            document.getElementById('addImageModal').style.display = 'none';
            this.clearAddImageModal();
            this.renderStoryboard();
            
            // Rebuild previz timeline if it exists (to include new storyboard images)
            if (this.previsController && this.previsController.previsManager) {
                this.previsController.previsManager.buildTimelineFromStoryboard();
                this.previsController.renderTimeline();
            }
            // Ensure annotation system state is correct after adding image and re-render
            // Do this after renderStoryboard so canvases are recreated with correct state
            setTimeout(() => {
                this.ensureAnnotationSystemState();
            }, 200);
        };
        reader.readAsDataURL(file);
    }
    
    /**
     * Sort images by Scene → Shot → Frame, with missing values coming last
     */
    sortImagesByStructure() {
        this.project.images.sort((a, b) => {
            // Images with scene numbers come before those without
            const aHasScene = a.sceneNumber && a.sceneNumber.trim() !== '';
            const bHasScene = b.sceneNumber && b.sceneNumber.trim() !== '';
            
            if (aHasScene && !bHasScene) return -1;
            if (!aHasScene && bHasScene) return 1;
            
            // If both have scenes, sort by scene number
            if (aHasScene && bHasScene) {
                const sceneA = parseInt(a.sceneNumber) || 0;
                const sceneB = parseInt(b.sceneNumber) || 0;
                if (sceneA !== sceneB) return sceneA - sceneB;
            }
            
            // Sort by shot
            const aHasShot = a.shotNumber && a.shotNumber.trim() !== '';
            const bHasShot = b.shotNumber && b.shotNumber.trim() !== '';
            
            if (aHasShot && !bHasShot) return -1;
            if (!aHasShot && bHasShot) return 1;
            
            if (aHasShot && bHasShot) {
                const shotA = parseInt(a.shotNumber) || 0;
                const shotB = parseInt(b.shotNumber) || 0;
                if (shotA !== shotB) return shotA - shotB;
            }
            
            // Sort by frame
            const aHasFrame = a.frameNumber && a.frameNumber.trim() !== '';
            const bHasFrame = b.frameNumber && b.frameNumber.trim() !== '';
            
            if (aHasFrame && !bHasFrame) return -1;
            if (!aHasFrame && bHasFrame) return 1;
            
            if (aHasFrame && bHasFrame) {
                // Try numeric comparison first
                const frameA = parseInt(a.frameNumber);
                const frameB = parseInt(b.frameNumber);
                if (!isNaN(frameA) && !isNaN(frameB)) {
                    if (frameA !== frameB) return frameA - frameB;
                } else {
                    // If not numeric, use alphabetical
                    return a.frameNumber.localeCompare(b.frameNumber, undefined, { numeric: true, sensitivity: 'base' });
                }
            }
            
            // If all else is equal, sort by filename
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }
    
    
    setupBrowserWarning() {
        // Enhanced beforeunload handler to warn about unsaved changes
        // Especially important when fileHandle is lost (after refresh)
        window.addEventListener('beforeunload', (e) => {
            // Check if there are unsaved changes
            if (this.hasUnsavedChanges) {
                // If we don't have a fileHandle, warn more strongly
                const hasFileHandle = this.fileManager && this.fileManager.fileHandle;
                if (!hasFileHandle) {
                    // File handle lost (e.g., after refresh) - warn user
                    const message = 'You have unsaved changes and the connection to your project file has been lost. Your changes may be lost if you leave this page.';
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                } else {
                    // Normal unsaved changes warning
                    const message = 'You have unsaved changes. Are you sure you want to leave?';
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                }
            }
        });
    }
    
    setupResizeHandler() {
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updatePageDimensions();
            }, 100); // Debounce resize events
        };
        
        window.addEventListener('resize', handleResize);
    }
    
    updatePageDimensions() {
        const pages = document.querySelectorAll('.storyboard-page');
        if (pages.length === 0) return;
        
        const mmToPx = 3.779527559;
        const maxWidth = window.innerWidth * 0.9;
        
        pages.forEach(page => {
            // Get stored page dimensions from dataset
            let pageWidthMm = parseFloat(page.dataset.pageWidth);
            let pageHeightMm = parseFloat(page.dataset.pageHeight);
            
            if (!pageWidthMm || !pageHeightMm) {
                // If no stored dimensions, calculate from current page size and orientation
                const orientation = page.classList.contains('portrait') ? 'portrait' : 'landscape';
                const pageSizeName = this.project?.settings?.pageSize || 'A4';
                const pageSize = this.pageSizes[pageSizeName];
                
                if (pageSize) {
                    pageWidthMm = orientation === 'portrait' ? pageSize.width : pageSize.height;
                    pageHeightMm = orientation === 'portrait' ? pageSize.height : pageSize.width;
                    
                    // Store for future use
                    page.dataset.pageWidth = pageWidthMm;
                    page.dataset.pageHeight = pageHeightMm;
                } else {
                    // Fallback if pageSize not found
                    return;
                }
            }
            
            // Use stored dimensions to maintain aspect ratio
            const pageWidthPx = pageWidthMm * mmToPx;
            const pageHeightPx = pageHeightMm * mmToPx;
            
            // Calculate scale factor based on current window width
            // Maintain aspect ratio by scaling both dimensions by the same factor
            const scaleFactor = Math.min(1, maxWidth / pageWidthPx);
            const calculatedWidth = pageWidthPx * scaleFactor;
            const calculatedHeight = pageHeightPx * scaleFactor;
            
            page.style.width = `${calculatedWidth}px`;
            page.style.height = `${calculatedHeight}px`;
            page.style.maxWidth = '90vw'; // Ensure it doesn't exceed viewport
            page.dataset.scale = scaleFactor;
        });
        
        // Recalculate max images per page after dimensions are updated
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
        });
    }
    
    
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges && this.project.images.length > 0) {
                if (this.storageService) {
                    this.storageService.saveToStorage(true).catch(e => console.error('Error auto-saving:', e));
                } else {
                    this.saveToStorage(true).catch(e => console.error('Error auto-saving:', e));
                }
            }
        }, 30000); // 30 seconds
    }
    
    // Storage methods moved to StorageService
    // These are kept as fallback stubs for compatibility
    async saveToStorage(isTemp = false) {
        if (this.storageService) {
            return await this.storageService.saveToStorage(isTemp);
        }
        console.warn('saveToStorage called but StorageService not available');
    }
    
    async restoreProject(data, hasUnsavedChanges = true) {
        if (this.storageService) {
            return await this.storageService.restoreProject(data, hasUnsavedChanges);
        }
        console.warn('restoreProject called but StorageService not available');
    }
    
    async loadFromStorage() {
        if (this.storageService) {
            return await this.storageService.loadFromStorage();
        }
        console.warn('loadFromStorage called but StorageService not available');
    }
    
    
    loadProjectToUI() {
        document.getElementById('pageOrientation').value = this.project.settings.orientation || 'landscape';
        document.getElementById('pageSize').value = this.project.settings.pageSize || 'A4';
        const maxImages = this.getMaxImagesPerPage();
        // Load layout rows and columns
        // Load layout rows and columns
        const layoutRowsSlider = document.getElementById('layoutRows');
        const layoutRowsInput = document.getElementById('layoutRowsInput');
        const layoutColsSlider = document.getElementById('layoutCols');
        const layoutColsInput = document.getElementById('layoutColsInput');
        // Set default layout based on orientation if not already set
        const orientation = this.project.settings.orientation || 'landscape';
        let defaultRows = 2;
        let defaultCols = 3;
        if (orientation === 'portrait') {
            defaultRows = 3;
            defaultCols = 3;
        }
        const rowsValue = this.project.settings.layoutRows || defaultRows;
        const colsValue = this.project.settings.layoutCols || defaultCols;
        if (layoutRowsSlider) layoutRowsSlider.value = rowsValue;
        if (layoutRowsInput) layoutRowsInput.value = rowsValue;
        if (layoutColsSlider) layoutColsSlider.value = colsValue;
        if (layoutColsInput) layoutColsInput.value = colsValue;
        const layoutInfo = document.getElementById('layoutInfo');
        if (layoutInfo) {
            const totalImages = (this.project.settings.layoutRows || 2) * (this.project.settings.layoutCols || 2);
            layoutInfo.textContent = `Total: ${totalImages} image${totalImages !== 1 ? 's' : ''} per page`;
        }
        const imageScale = document.getElementById('imageScale');
        const imageScaleInput = document.getElementById('imageScaleInput');
        if (imageScale) imageScale.value = this.project.settings.imageScale || 100;
        if (imageScaleInput) imageScaleInput.value = this.project.settings.imageScale || 100;
        const frameTextScale = document.getElementById('frameTextScale');
        const frameTextScaleInput = document.getElementById('frameTextScaleInput');
        if (frameTextScale) frameTextScale.value = this.project.settings.frameTextScale || 100;
        if (frameTextScaleInput) frameTextScaleInput.value = this.project.settings.frameTextScale || 100;
        
        // Load aspect ratio settings
        const imageAspectRatio = document.getElementById('imageAspectRatio');
        const customAspectRatioContainer = document.getElementById('customAspectRatioContainer');
        const customAspectRatioWidth = document.getElementById('customAspectRatioWidth');
        const customAspectRatioHeight = document.getElementById('customAspectRatioHeight');
        if (imageAspectRatio) {
            imageAspectRatio.value = this.project.settings.imageAspectRatio || '16:9';
            if (customAspectRatioContainer) {
                customAspectRatioContainer.style.display = (this.project.settings.imageAspectRatio === 'custom') ? 'block' : 'none';
            }
        }
        if (customAspectRatioWidth) customAspectRatioWidth.value = this.project.settings.customAspectRatioWidth || 16;
        if (customAspectRatioHeight) customAspectRatioHeight.value = this.project.settings.customAspectRatioHeight || 9;
        
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const lineHeight = document.getElementById('lineHeight');
        const textColor = document.getElementById('textColor');
        const textAlign = document.getElementById('textAlign');
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
        if (pageBackgroundColor) pageBackgroundColor.value = this.project.settings.pageBackgroundColor || '#404040';
        if (frameScale) frameScale.value = this.project.settings.frameScale || 100;
        if (frameScaleInput) frameScaleInput.value = this.project.settings.frameScale || 100;
        if (separateScenes) separateScenes.checked = this.project.settings.separateScenes || false;
        if (enablePageNumbers) enablePageNumbers.checked = this.project.settings.enablePageNumbers !== false; // Default to true
        if (pageNumberPosition) pageNumberPosition.value = this.project.settings.pageNumberPosition || 'bottom-center';
        if (pageNumberFontSize) pageNumberFontSize.value = this.project.settings.pageNumberFontSize || 12;
        if (pageNumberColor) pageNumberColor.value = this.project.settings.pageNumberColor || '#b4b4b4'; // Default to 180:180:180 (RGB to hex: #b4b4b4)
        if (pageNumberSettings) pageNumberSettings.style.display = (this.project.settings.enablePageNumbers !== false) ? 'block' : 'none';
        
        // Load compression settings
        const compSettings = this.project.settings.imageCompression || {};
        const compressionEnabled = document.getElementById('compressionEnabled');
        const compressionMaxSize = document.getElementById('compressionMaxSize');
        const compressionMaxSizeInput = document.getElementById('compressionMaxSizeInput');
        const compressionMaxDimension = document.getElementById('compressionMaxDimension');
        const compressionMaxDimensionInput = document.getElementById('compressionMaxDimensionInput');
        const compressionQuality = document.getElementById('compressionQuality');
        const compressionQualityInput = document.getElementById('compressionQualityInput');
        const compressionFormat = document.getElementById('compressionFormat');
        const compressionSettings = document.getElementById('compressionSettings');
        
        if (compressionEnabled) {
            compressionEnabled.checked = compSettings.enabled !== false;
            if (compressionSettings) {
                compressionSettings.style.display = compressionEnabled.checked ? 'block' : 'none';
            }
        }
        if (compressionMaxSize) compressionMaxSize.value = compSettings.maxSizeMB || 1;
        if (compressionMaxSizeInput) compressionMaxSizeInput.value = compSettings.maxSizeMB || 1;
        if (compressionMaxDimension) compressionMaxDimension.value = compSettings.maxWidthOrHeight || 1920;
        if (compressionMaxDimensionInput) compressionMaxDimensionInput.value = compSettings.maxWidthOrHeight || 1920;
        if (compressionQuality) compressionQuality.value = (compSettings.quality || 0.75) * 100;
        if (compressionQualityInput) compressionQualityInput.value = (compSettings.quality || 0.75) * 100;
        if (compressionFormat) compressionFormat.value = compSettings.format || 'webp';
        
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
        const enableCoverPage = document.getElementById('enableCoverPage');
        if (enableCoverPage) {
            enableCoverPage.checked = this.project.settings.enableCoverPage || false;
            // Show/hide cover page settings based on checkbox state
            const coverPageSettings = document.getElementById('coverPageSettings');
            if (coverPageSettings) {
                coverPageSettings.style.display = enableCoverPage.checked ? 'block' : 'none';
            }
        }
        document.getElementById('coverPageTitle').value = this.project.settings.coverPageTitle || '';
        if (document.getElementById('coverPageTitleFontFamily')) document.getElementById('coverPageTitleFontFamily').value = this.project.settings.coverPageTitleFontFamily || "'Kalam', cursive";
        document.getElementById('coverPageTitleFontSize').value = this.project.settings.coverPageTitleFontSize || 48;
        document.getElementById('coverPageTitleColor').value = this.project.settings.coverPageTitleColor || '#000000';
        document.getElementById('coverPageYear').value = this.project.settings.coverPageYear || '';
        if (document.getElementById('coverPageYearFontFamily')) document.getElementById('coverPageYearFontFamily').value = this.project.settings.coverPageYearFontFamily || "'Kalam', cursive";
        document.getElementById('coverPageYearFontSize').value = this.project.settings.coverPageYearFontSize || 24;
        document.getElementById('coverPageYearColor').value = this.project.settings.coverPageYearColor || '#666666';
        document.getElementById('coverPageCreators').value = this.project.settings.coverPageCreators || '';
        if (document.getElementById('coverPageCreatorsFontFamily')) document.getElementById('coverPageCreatorsFontFamily').value = this.project.settings.coverPageCreatorsFontFamily || "'Kalam', cursive";
        document.getElementById('coverPageCreatorsFontSize').value = this.project.settings.coverPageCreatorsFontSize || 18;
        document.getElementById('coverPageCreatorsColor').value = this.project.settings.coverPageCreatorsColor || '#333333';
        document.getElementById('enableWatermark').checked = this.project.settings.enableWatermark || false;
        document.getElementById('watermarkType').value = this.project.settings.watermarkType || 'text';
        document.getElementById('watermarkText').value = this.project.settings.watermarkText || '';
        if (document.getElementById('watermarkImagePosition')) document.getElementById('watermarkImagePosition').value = this.project.settings.watermarkImagePosition || 'center';
        if (document.getElementById('watermarkImageSize')) document.getElementById('watermarkImageSize').value = this.project.settings.watermarkImageSize || 50;
        if (document.getElementById('watermarkImageSizeInput')) document.getElementById('watermarkImageSizeInput').value = this.project.settings.watermarkImageSize || 50;
        document.getElementById('watermarkOpacity').value = this.project.settings.watermarkOpacity || 30;
        const enableAnnotation = document.getElementById('enableAnnotation');
        if (enableAnnotation) {
            enableAnnotation.checked = this.project.settings.enableAnnotation || false;
            // Also update the controls visibility
            const annotationControls = document.getElementById('annotationControls');
            if (annotationControls) {
                annotationControls.style.display = enableAnnotation.checked ? 'block' : 'none';
            }
        }
        
        // Restore active workspace
        const savedWorkspace = this.project.activeWorkspace || 'storyboard';
        if (this.switchWorkspace) {
            this.switchWorkspace(savedWorkspace);
        }
        
        if (this.project.settings.coverPageLogo) {
            document.getElementById('coverPageLogoPreview').innerHTML = `<img src="${this.project.settings.coverPageLogo}" alt="Logo">`;
        }
        if (this.project.settings.watermarkImage) {
            document.getElementById('watermarkImagePreview').innerHTML = `<img src="${this.project.settings.watermarkImage}" alt="Watermark">`;
        }
        
        this.updateScaleDisplay();
        this.updateLayoutInfo();
        if (this.updateProjectInfo) this.updateProjectInfo();
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
    window.app = new StoryboardCreator();
    
    // Initialize services that might load after DOMContentLoaded (due to defer attribute)
    // Use a more robust initialization that checks multiple times
    const initDeferredServices = () => {
        if (typeof VideoExportService !== 'undefined' && !window.app.videoExportService) {
            window.app.videoExportService = new VideoExportService(window.app);
        }
        if (typeof EDLExportService !== 'undefined' && !window.app.edlExportService) {
            window.app.edlExportService = new EDLExportService(window.app);
        }
        if (typeof XMLExportService !== 'undefined' && !window.app.xmlExportService) {
            window.app.xmlExportService = new XMLExportService(window.app);
        }
    };
    
    // Try immediately
    initDeferredServices();
    
    // Try again after a short delay
    setTimeout(initDeferredServices, 100);
    
    // Try again after a longer delay (in case scripts are slow to load)
    setTimeout(initDeferredServices, 500);
    
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
