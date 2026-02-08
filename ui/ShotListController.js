/**
 * Shot List Controller
 * Handles UI interactions and rendering for the shot list workspace
 */

class ShotListController {
    constructor(app) {
        this.app = app;
        this.editingShotId = null;
        this.durationMode = 'frames'; // 'frames' or 'seconds'
        this.customColumns = []; // Custom column definitions
        this.zoomLevel = 1.0; // Zoom level for shot list (1.0 = 100%)
        this.isExportingPDF = false; // Flag to prevent double file picker calls
    }

    /**
     * Initialize shot list UI
     */
    init() {
        this.loadCustomColumns(); // Load BEFORE setting up modals
        this.setupEventListeners();
        this.setupExportMenu();
        this.setupShotEditModal();
        this.setupShotListSettingsModal();
        
        // Load saved zoom level
        if (this.app.project.settings?.shotListZoom) {
            this.zoomLevel = this.app.project.settings.shotListZoom;
            this.applyZoom();
        }
    }
    
    /**
     * Apply zoom (alias for setZoom for consistency)
     */
    applyZoom() {
        this.setZoom(this.zoomLevel);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add shot button
        const addShotBtn = document.getElementById('addShotBtn');
        if (addShotBtn) {
            addShotBtn.addEventListener('click', () => this.showAddShotModal());
        }

        // Settings button
        const settingsBtn = document.getElementById('shotListSettingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsModal());
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('shotListZoomIn');
        const zoomOutBtn = document.getElementById('shotListZoomOut');
        const zoomLevelInput = document.getElementById('shotListZoomLevel');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        if (zoomLevelInput) {
            zoomLevelInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value) || 100;
                this.setZoom(value / 100);
            });
            zoomLevelInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 100;
                this.setZoom(value / 100);
            });
        }

        // Workspace tab switching - initialize shot list when switching to it
        const shotListTab = document.getElementById('tabShotList');
        if (shotListTab) {
            shotListTab.addEventListener('click', () => {
                this.onShotListTabActivated();
            });
        }
    }
    
    /**
     * Zoom in shot list
     */
    zoomIn() {
        this.setZoom(Math.min(this.zoomLevel * 1.1, 2.0));
    }
    
    /**
     * Zoom out shot list
     */
    zoomOut() {
        this.setZoom(Math.max(this.zoomLevel * 0.9, 0.5));
    }
    
    /**
     * Set zoom level for shot list
     */
    setZoom(level) {
        this.zoomLevel = Math.max(0.5, Math.min(2.0, level));
        
        // Update input
        const zoomLevelInput = document.getElementById('shotListZoomLevel');
        if (zoomLevelInput) {
            zoomLevelInput.value = Math.round(this.zoomLevel * 100);
        }
        
        // Apply zoom directly to the table
        const table = document.getElementById('shotListTable');
        const container = document.querySelector('.shotlist-table-container');
        const innerDiv = container?.querySelector('div[style*="overflow"]');
        
        if (table && container && innerDiv) {
            // Apply zoom to the table itself
            table.style.transform = `scale(${this.zoomLevel})`;
            table.style.transformOrigin = 'top left';
            
            // Adjust scrollbar visibility based on scaled content
            const parentWidth = container.clientWidth;
            const parentHeight = container.clientHeight;
            const scaledWidth = table.offsetWidth * this.zoomLevel;
            const scaledHeight = table.offsetHeight * this.zoomLevel;
            
            // If scaled content fits, hide scrollbars
            if (scaledWidth <= parentWidth) {
                innerDiv.style.overflowX = 'hidden';
            } else {
                innerDiv.style.overflowX = 'auto';
            }
            
            if (scaledHeight <= parentHeight) {
                innerDiv.style.overflowY = 'hidden';
            } else {
                innerDiv.style.overflowY = 'auto';
            }
        }
        
        // Save zoom level to project
        if (this.app.project.settings) {
            this.app.project.settings.shotListZoom = this.zoomLevel;
            this.app.markChanged();
            this.app.storageService.saveToStorage(false);
        }
    }

    /**
     * Setup shot edit modal
     */
    setupShotEditModal() {
        const modal = document.getElementById('shotEditModal');
        if (!modal) return;

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('shotEditCancel');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeShotEditModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeShotEditModal());

        // Save button
        const saveBtn = document.getElementById('shotEditSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveShot());
        }

        // Duration toggle
        const durationToggle = document.getElementById('shotEditDurationToggle');
        if (durationToggle) {
            durationToggle.addEventListener('click', () => this.toggleDurationMode());
        }

        // Custom value inputs for dropdowns
        this.setupCustomValueInputs();
    }

    /**
     * Setup custom value inputs for dropdowns
     */
    setupCustomValueInputs() {
        const dropdowns = [
            { select: 'shotEditCameraAngle', custom: 'shotEditCameraAngleCustom' },
            { select: 'shotEditCameraMovement', custom: 'shotEditCameraMovementCustom' },
            { select: 'shotEditCameraLens', custom: 'shotEditCameraLensCustom' },
            { select: 'shotEditDistance', custom: 'shotEditDistanceCustom' }
        ];

        dropdowns.forEach(({ select, custom }) => {
            const selectEl = document.getElementById(select);
            const customEl = document.getElementById(custom);
            if (selectEl && customEl) {
                selectEl.addEventListener('change', (e) => {
                    if (e.target.value === 'custom') {
                        customEl.style.display = 'block';
                        customEl.focus();
                    } else {
                        customEl.style.display = 'none';
                        customEl.value = '';
                    }
                });
            }
        });
    }

    /**
     * Setup shot list settings modal
     */
    setupShotListSettingsModal() {
        const modal = document.getElementById('shotListSettingsModal');
        if (!modal) return;

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('shotListSettingsCancel');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeSettingsModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeSettingsModal());

        // Save button
        const saveBtn = document.getElementById('shotListSettingsSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Add custom column button
        const addColumnBtn = document.getElementById('addCustomColumnBtn');
        if (addColumnBtn) {
            addColumnBtn.addEventListener('click', () => this.addCustomColumn());
        }
    }

    /**
     * Setup export submenu
     */
    setupExportMenu() {
        const exportMenuBtn = document.getElementById('exportMenuBtn');
        const exportSubmenu = document.getElementById('exportSubmenu');
        const fileMenu = document.getElementById('fileMenu');

        if (exportMenuBtn && exportSubmenu) {
            // Show submenu on hover/click
            exportMenuBtn.addEventListener('mouseenter', () => {
                if (fileMenu && fileMenu.classList.contains('active')) {
                    const rect = exportMenuBtn.getBoundingClientRect();
                    exportSubmenu.style.display = 'block';
                    exportSubmenu.style.position = 'fixed';
                    exportSubmenu.style.left = `${rect.right}px`;
                    exportSubmenu.style.top = `${rect.top}px`;
                }
            });

            exportSubmenu.addEventListener('mouseenter', () => {
                exportSubmenu.style.display = 'block';
            });

            exportSubmenu.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    if (!exportSubmenu.matches(':hover')) {
                        exportSubmenu.style.display = 'none';
                    }
                }, 100);
            });

            // Export Storyboard PDF
            const exportStoryboardPDF = document.getElementById('exportStoryboardPDF');
            if (exportStoryboardPDF) {
                exportStoryboardPDF.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    if (this.app.pdfManager && this.app.pdfManager.showExportStoryboardPDFDialog) {
                        await this.app.pdfManager.showExportStoryboardPDFDialog();
                    } else if (this.app.pdfManager) {
                        await this.app.pdfManager.exportPDF();
                    } else if (this.app.fileManager) {
                        await this.app.fileManager.exportPDF();
                    }
                });
            }

            // Export Shot List PDF
            const exportShotListPDF = document.getElementById('exportShotListPDF');
            if (exportShotListPDF) {
                exportShotListPDF.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    await this.showExportShotListPDFDialog();
                });
            }

            // Export Previz Timeline XML
            const exportPrevizXML = document.getElementById('exportPrevizXML');
            if (exportPrevizXML) {
                exportPrevizXML.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    await this.exportPrevizXML();
                });
            }

            // Export Previz Timeline EDL
            const exportPrevizEDL = document.getElementById('exportPrevizEDL');
            if (exportPrevizEDL) {
                exportPrevizEDL.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    await this.exportPrevizEDL();
                });
            }

            // Export Previz Timeline (XML + Media)
            const exportPrevizBundled = document.getElementById('exportPrevizBundled');
            if (exportPrevizBundled) {
                exportPrevizBundled.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    await this.exportPrevizToFolder();
                });
            }

            // Export Previz Timeline Video
            const exportPrevizVideo = document.getElementById('exportPrevizVideo');
            if (exportPrevizVideo) {
                exportPrevizVideo.addEventListener('click', async () => {
                    exportSubmenu.style.display = 'none';
                    await this.exportPrevizVideo();
                });
            }
        }
    }

    /**
     * Export previz timeline to XML
     */
    async exportPrevizXML() {
        if (!this.app.previsController || !this.app.previsController.previsManager) {
            await this.app.customAlert('No timeline data available to export.');
            return;
        }

        // Try to initialize XML export service if not available
        if (!this.app.xmlExportService) {
            if (typeof XMLExportService !== 'undefined') {
                this.app.xmlExportService = new XMLExportService(this.app);
            } else {
                await this.app.customAlert('XML export service not available. Please refresh the page.');
                return;
            }
        }

        const timelineData = this.app.previsController.previsManager.getTimelineData();
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            await this.app.customAlert('Timeline is empty. Add clips to the timeline before exporting.');
            return;
        }

        try {
            // Ask user for export folder path
            const exportFolderPath = await this.app.customPrompt(
                'Enter Export Folder Path',
                'Enter the full path to the folder where you want to export the XML file and images.\n\nExample: C:\\Media\\Export or /Users/username/Desktop/Export\n\nThis path will be used in the XML file references.',
                'C:\\Media\\Export'
            );
            
            if (!exportFolderPath) {
                // User cancelled
                return;
            }
            
            const projectName = this.app.project.name || 'Storyboard Timeline';
            // Pass export folder path to XML export
            const xml = this.app.xmlExportService.exportToFCPXML(timelineData, projectName, false, null, exportFolderPath);
            const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_timeline.xml`;
            this.app.xmlExportService.downloadXML(xml, filename);
        } catch (error) {
            console.error('Error exporting XML:', error);
            await this.app.customAlert('Failed to export XML: ' + error.message);
        }
    }

    /**
     * Export previz timeline to EDL
     */
    async exportPrevizEDL() {
        if (!this.app.previsController || !this.app.previsController.previsManager) {
            await this.app.customAlert('No timeline data available to export.');
            return;
        }

        // Try to initialize EDL export service if not available
        if (!this.app.edlExportService) {
            if (typeof EDLExportService !== 'undefined') {
                this.app.edlExportService = new EDLExportService(this.app);
            } else {
                await this.app.customAlert('EDL export service not available. Please refresh the page.');
                return;
            }
        }

        const timelineData = this.app.previsController.previsManager.getTimelineData();
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            await this.app.customAlert('Timeline is empty. Add clips to the timeline before exporting.');
            return;
        }

        try {
            // Ask user for export folder path
            const exportFolderPath = await this.app.customPrompt(
                'Enter Export Folder Path',
                'Enter the full path to the folder where you want to export the EDL file and images.\n\nExample: C:\\Media\\Export or /Users/username/Desktop/Export\n\nThis path will be used in the EDL file references.',
                'C:\\Media\\Export'
            );
            
            if (!exportFolderPath) {
                // User cancelled
                return;
            }
            
            const projectName = this.app.project.name || 'Storyboard Timeline';
            // Pass export folder path to EDL export
            const edl = this.app.edlExportService.exportToEDL(timelineData, projectName, false, null, exportFolderPath);
            const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_timeline.edl`;
            this.app.edlExportService.downloadEDL(edl, filename);
        } catch (error) {
            console.error('Error exporting EDL:', error);
            await this.app.customAlert('Failed to export EDL: ' + error.message);
        }
    }

    /**
     * Export previz timeline to selected folder (XML + Media)
     */
    async exportPrevizToFolder() {
        if (!this.app.previsController || !this.app.previsController.previsManager) {
            await this.app.customAlert('No timeline data available to export.');
            return;
        }

        // Try to initialize folder export service if not available
        if (!this.app.folderExportService) {
            if (typeof FolderExportService !== 'undefined') {
                this.app.folderExportService = new FolderExportService(this.app);
            } else {
                // Try multiple times with increasing delays (for defer scripts)
                for (let attempt = 0; attempt < 5; attempt++) {
                    if (typeof FolderExportService !== 'undefined') {
                        this.app.folderExportService = new FolderExportService(this.app);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
                }
                
                if (!this.app.folderExportService) {
                    await this.app.customAlert('Folder export service not available. The script may not have loaded. Please refresh the page.');
                    return;
                }
            }
        }

        const timelineData = this.app.previsController.previsManager.getTimelineData();
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            await this.app.customAlert('Timeline is empty. Add clips to the timeline before exporting.');
            return;
        }

        try {
            const projectName = this.app.project.name || 'Storyboard Timeline';
            await this.app.folderExportService.exportToFolder(timelineData, projectName);
        } catch (error) {
            console.error('Error exporting to folder:', error);
            await this.app.customAlert('Failed to export: ' + error.message);
        }
    }

    /**
     * Export previz timeline bundled (XML + all media files) - DEPRECATED
     */
    async exportPrevizBundled() {
        if (!this.app.previsController || !this.app.previsController.previsManager) {
            await this.app.customAlert('No timeline data available to export.');
            return;
        }

        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            await this.app.customAlert('JSZip library not loaded. Please refresh the page to load the required libraries.');
            return;
        }

        // Try to initialize bundled export service if not available
        if (!this.app.bundledExportService) {
            // Try multiple times with increasing delays (for defer scripts)
            for (let attempt = 0; attempt < 5; attempt++) {
                if (typeof BundledExportService !== 'undefined') {
                    this.app.bundledExportService = new BundledExportService(this.app);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            }
            
            if (!this.app.bundledExportService) {
                await this.app.customAlert('Bundled export service not available. The script may not have loaded. Please refresh the page.');
                return;
            }
        }

        const timelineData = this.app.previsController.previsManager.getTimelineData();
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            await this.app.customAlert('Timeline is empty. Add clips to the timeline before exporting.');
            return;
        }

        try {
            const projectName = this.app.project.name || 'Storyboard Timeline';
            // Use EDL format for bundled export (works better with DaVinci Resolve)
            await this.app.bundledExportService.exportBundled('edl', timelineData, projectName);
        } catch (error) {
            console.error('Error exporting bundled timeline:', error);
            await this.app.customAlert('Failed to export bundled timeline: ' + error.message);
        }
    }

    /**
     * Export previz timeline to video
     */
    async exportPrevizVideo() {
        if (!this.app.previsController || !this.app.previsController.previsManager) {
            await this.app.customAlert('No timeline data available to export.');
            return;
        }

        // Try to initialize video export service if not available
        if (!this.app.videoExportService) {
            // Try multiple times with increasing delays
            for (let attempt = 0; attempt < 5; attempt++) {
                if (typeof VideoExportService !== 'undefined') {
                    this.app.videoExportService = new VideoExportService(this.app);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            }
            
            if (!this.app.videoExportService) {
                await this.app.customAlert('Video export service not available. The script may not have loaded. Please check the browser console for errors.');
                return;
            }
        }

        const timelineData = this.app.previsController.previsManager.getTimelineData();
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            await this.app.customAlert('Timeline is empty. Add clips to the timeline before exporting.');
            return;
        }

        try {
            await this.app.videoExportService.showExportDialog();
        } catch (error) {
            console.error('Error showing export dialog:', error);
            await this.app.customAlert('Failed to show export dialog: ' + error.message);
        }
    }

    /**
     * Called when shot list tab is activated
     */
    onShotListTabActivated() {
        if (!this.app.shotListManager) return;

        // Ensure custom columns are loaded
        this.loadCustomColumns();

        // Sync with storyboard to ensure we have all shots
        this.app.shotListManager.syncWithStoryboard();

        // Render the shot list
        this.renderShotList();
    }

    /**
     * Load custom columns from project settings
     */
    loadCustomColumns() {
        if (this.app.project.settings?.customShotListColumns) {
            this.customColumns = this.app.project.settings.customShotListColumns;
        }
    }

    /**
     * Render the shot list table
     */
    renderShotList() {
        if (!this.app.shotListManager) return;

        const tbody = document.getElementById('shotListTableBody');
        const thead = document.getElementById('shotListTableHead');
        const emptyState = document.getElementById('shotListEmpty');
        const countBadge = document.getElementById('shotListCount');

        if (!tbody || !thead) return;

        const shots = this.app.shotListManager.getAllShots();

        // Update count
        if (countBadge) {
            countBadge.textContent = `${shots.length} ${shots.length === 1 ? 'shot' : 'shots'}`;
        }

        // Render table headers (including custom columns)
        this.renderTableHeaders(thead);

        // Clear table
        tbody.innerHTML = '';

        if (shots.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Group shots by scene and render with scene summaries
        const sceneGroups = new Map();
        shots.forEach(shot => {
            const sceneNum = shot.sceneNumber || 'Unknown';
            if (!sceneGroups.has(sceneNum)) {
                sceneGroups.set(sceneNum, []);
            }
            sceneGroups.get(sceneNum).push(shot);
        });

        // Sort scenes
        const sortedScenes = Array.from(sceneGroups.entries()).sort((a, b) => {
            const numA = parseInt(a[0]) || 0;
            const numB = parseInt(b[0]) || 0;
            return numA - numB;
        });

        // Render shots grouped by scene
        sortedScenes.forEach(([sceneNum, sceneShots]) => {
            sceneShots.forEach(shot => {
                const row = this.createShotRow(shot);
                tbody.appendChild(row);
            });

            // Add scene summary row
            const summaryRow = this.createSceneSummaryRow(sceneNum, sceneShots);
            tbody.appendChild(summaryRow);
        });

        // Render overall summary
        this.renderSummary(shots);

        // Reinitialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Apply current zoom after rendering
        setTimeout(() => {
            this.setZoom(this.zoomLevel);
        }, 0);
    }
    
    /**
     * Create scene summary row
     */
    createSceneSummaryRow(sceneNum, sceneShots) {
        const row = document.createElement('tr');
        row.className = 'scene-summary-row';
        row.style.cssText = 'background: #252526; border-top: 2px solid #555;';
        
        // Calculate scene totals
        let sceneSetupTime = 0;
        let sceneDurationFrames = 0;
        let sceneExpectedTime = 0;
        const productionMultiplier = this.app.project.settings?.productionTimeMultiplier || 1.5;

        sceneShots.forEach(shot => {
            const setupTime = shot.setupTimeMinutes || 0;
            sceneSetupTime += setupTime;

            const durationFrames = shot.durationFrames || 0;
            sceneDurationFrames += durationFrames;

            const takes = parseInt(shot.predictedTakes) || 1;
            const durationMinutes = (durationFrames / this.app.shotListManager.getFrameRate()) / 60;
            const shotTime = (setupTime + durationMinutes) * takes * productionMultiplier;
            sceneExpectedTime += shotTime;
        });

        const formatTime = (minutes) => {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        };

        // Create summary cell spanning all columns
        const summaryCell = document.createElement('td');
        summaryCell.colSpan = 14 + this.customColumns.length; // Count all columns
        summaryCell.style.cssText = 'padding: 8px 12px; color: #888; font-size: 12px; font-style: italic;';
        summaryCell.innerHTML = `
            <strong style="color: #ccc;">Scene ${sceneNum} Summary:</strong>
            ${sceneShots.length} shots | 
            Setup: ${formatTime(sceneSetupTime)} | 
            Duration: ${sceneDurationFrames} frames | 
            Expected: <span style="color: #007acc;">${formatTime(sceneExpectedTime)}</span>
        `;
        row.appendChild(summaryCell);

        return row;
    }

    /**
     * Render summary row
     */
    renderSummary(shots) {
        const summaryDiv = document.getElementById('shotListSummary');
        if (!summaryDiv) {
            console.warn('Shot list summary div not found');
            return;
        }

        if (shots.length === 0) {
            summaryDiv.style.display = 'none';
            return;
        }

        summaryDiv.style.display = 'block';

        // Calculate totals
        let totalSetupTime = 0;
        let totalDurationFrames = 0;
        let totalExpectedTime = 0;
        const productionMultiplier = this.app.project.settings?.productionTimeMultiplier || 1.5;

        // Group shots by scene for scene summaries
        const sceneGroups = new Map();
        shots.forEach(shot => {
            const sceneNum = shot.sceneNumber || 'Unknown';
            if (!sceneGroups.has(sceneNum)) {
                sceneGroups.set(sceneNum, []);
            }
            sceneGroups.get(sceneNum).push(shot);
        });

        shots.forEach(shot => {
            // Setup time in minutes
            const setupTime = shot.setupTimeMinutes || 0;
            totalSetupTime += setupTime;

            // Duration in frames
            const durationFrames = shot.durationFrames || 0;
            totalDurationFrames += durationFrames;

            // Predicted takes
            const takes = parseInt(shot.predictedTakes) || 1;

            // Expected time = (setup + duration) * takes * multiplier
            const durationMinutes = (durationFrames / this.app.shotListManager.getFrameRate()) / 60;
            const shotTime = (setupTime + durationMinutes) * takes * productionMultiplier;
            totalExpectedTime += shotTime;
        });

        // Update summary display
        const totalShotsEl = document.getElementById('summaryTotalShots');
        const totalSetupEl = document.getElementById('summaryTotalSetupTime');
        const totalDurationEl = document.getElementById('summaryTotalDuration');
        const expectedTimeEl = document.getElementById('summaryExpectedTime');

        const formatTime = (minutes) => {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        };

        if (totalShotsEl) totalShotsEl.textContent = shots.length;
        if (totalSetupEl) {
            totalSetupEl.textContent = formatTime(totalSetupTime);
        }
        if (totalDurationEl) {
            // Format duration as seconds/min/hour and frames in parentheses
            const frameRate = this.app.shotListManager.getFrameRate();
            const totalSeconds = totalDurationFrames / frameRate;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = Math.floor(totalSeconds % 60);
            
            let durationText = '';
            if (hours > 0) {
                durationText = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                durationText = `${minutes}m ${seconds}s`;
            } else {
                durationText = `${seconds}s`;
            }
            
            totalDurationEl.textContent = `${durationText} (${totalDurationFrames} frames)`;
        }
        if (expectedTimeEl) {
            expectedTimeEl.textContent = formatTime(totalExpectedTime);
        }
    }

    /**
     * Render table headers including custom columns
     */
    renderTableHeaders(thead) {
        const tr = thead.querySelector('tr');
        if (!tr) return;

        // Remove existing custom column headers (keep standard ones)
        const existingCustomHeaders = tr.querySelectorAll('[data-custom-column]');
        existingCustomHeaders.forEach(h => h.remove());

        // Add custom column headers
        this.customColumns.forEach((col, index) => {
            const th = document.createElement('th');
            th.dataset.customColumn = col.id;
            th.style.cssText = 'padding: 12px; text-align: left; font-weight: 600; color: #ccc; border-bottom: 2px solid #444; min-width: 120px;';
            th.textContent = col.name;
            // Insert before Actions column
            const actionsTh = tr.querySelector('th:last-child');
            if (actionsTh) {
                tr.insertBefore(th, actionsTh);
            } else {
                tr.appendChild(th);
            }
        });
    }

    /**
     * Create a table row for a shot
     */
    createShotRow(shot) {
        const row = document.createElement('tr');
        row.dataset.shotId = shot.id;
        row.style.borderBottom = '1px solid #333';

        // Status badge color
        const statusColors = {
            'pending': '#888',
            'approved': '#007acc',
            'shot': '#22c55e',
            'cut': '#ef4444'
        };
        const statusColor = statusColors[shot.status] || '#888';

        // Format duration
        const frameRate = this.app.shotListManager.getFrameRate();
        const durationDisplay = shot.durationFrames > 0 
            ? `${shot.durationFrames} frames (${(shot.durationFrames / frameRate).toFixed(2)}s)`
            : '-';

        // Create cells in the exact order they appear in headers (including custom columns)
        // Standard columns first
        const createCell = (content, style = '') => {
            const td = document.createElement('td');
            td.style.cssText = `padding: 12px; color: #ccc; ${style}`;
            if (typeof content === 'string') {
                td.innerHTML = content;
            } else {
                td.appendChild(content);
            }
            return td;
        };

        // Scene
        row.appendChild(createCell(shot.sceneNumber || '-'));
        
        // Shot
        row.appendChild(createCell(shot.shotNumber || '-'));
        
        // Frames
        row.appendChild(createCell(String(shot.frameCount || 0), 'text-align: center;'));
        
        // Description
        const descDiv = document.createElement('div');
        descDiv.style.cssText = 'max-width: 200px; word-wrap: break-word; white-space: normal; overflow-wrap: break-word;';
        descDiv.textContent = shot.description || '-';
        descDiv.title = shot.description || '';
        row.appendChild(createCell(descDiv));
        
        // Duration
        row.appendChild(createCell(durationDisplay));
        
        // Camera Angle
        row.appendChild(createCell(shot.cameraAngle || '-'));
        
        // Camera Movement
        row.appendChild(createCell(shot.cameraMovement || '-'));
        
        // Camera Lens
        row.appendChild(createCell(shot.cameraLens || '-'));
        
        // Distance
        row.appendChild(createCell(shot.distance || '-'));
        
        // Type
        row.appendChild(createCell(shot.shotType || '-'));
        
        // Location
        const locDiv = document.createElement('div');
        locDiv.style.cssText = 'max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        locDiv.textContent = shot.location || '-';
        locDiv.title = shot.location || '';
        row.appendChild(createCell(locDiv));
        
        // Characters
        row.appendChild(createCell(shot.characters || '-'));
        
        // Setup Time
        row.appendChild(createCell(shot.setupTimeMinutes ? `${shot.setupTimeMinutes} min` : (shot.setupTime || '-')));
        
        // Predicted Takes
        row.appendChild(createCell(shot.predictedTakes || '-'));
        
        // Status
        const statusSpan = document.createElement('span');
        statusSpan.style.cssText = `background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;`;
        statusSpan.textContent = shot.status || 'pending';
        row.appendChild(createCell(statusSpan));
        
        // Custom columns (inserted before Actions)
        this.customColumns.forEach(col => {
            const value = shot.customFields?.[col.id] || '-';
            const td = document.createElement('td');
            td.dataset.customColumn = col.id;
            td.style.cssText = 'padding: 12px; color: #ccc;';
            td.textContent = value;
            row.appendChild(td);
        });
        
        // Actions (always last)
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 8px; justify-content: center;';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-icon';
        editBtn.dataset.action = 'edit';
        editBtn.title = 'Edit Shot';
        editBtn.style.cssText = 'background: #007acc; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer;';
        const editIcon = document.createElement('i');
        editIcon.setAttribute('data-lucide', 'pencil');
        editIcon.style.cssText = 'width: 14px; height: 14px;';
        editBtn.appendChild(editIcon);
        editBtn.addEventListener('click', () => this.showEditShotModal(shot.id));
        actionsDiv.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.title = 'Delete Shot';
        deleteBtn.style.cssText = 'background: #c53030; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer;';
        
        // Only allow delete if shot is manual and has no storyboard frames
        const canDelete = shot.isManual && (!shot.storyboardImage || shot.frameCount === 0);
        if (!canDelete) {
            deleteBtn.style.opacity = '0.5';
            deleteBtn.style.cursor = 'not-allowed';
            deleteBtn.title = 'Cannot delete: Shot has storyboard frames';
        } else {
            deleteBtn.addEventListener('click', () => this.deleteShot(shot.id));
        }
        
        const deleteIcon = document.createElement('i');
        deleteIcon.setAttribute('data-lucide', 'trash-2');
        deleteIcon.style.cssText = 'width: 14px; height: 14px;';
        deleteBtn.appendChild(deleteIcon);
        actionsDiv.appendChild(deleteBtn);
        
        row.appendChild(createCell(actionsDiv, 'text-align: center;'));

        return row;
    }

    /**
     * Show add shot modal
     */
    async showAddShotModal() {
        // Simple prompt for now - can be enhanced
        const sceneNumber = prompt('Enter Scene Number:');
        if (!sceneNumber) return;

        const shotNumber = prompt('Enter Shot Number:');
        if (!shotNumber) return;

        if (this.app.shotListManager) {
            const shot = this.app.shotListManager.addManualShot(sceneNumber, shotNumber);
            this.renderShotList();
            // Show edit modal to fill in details
            setTimeout(() => this.showEditShotModal(shot.id), 100);
        }
    }

    /**
     * Show edit shot modal
     */
    showEditShotModal(shotId) {
        if (!this.app.shotListManager) return;

        const shot = this.app.shotListManager.getShot(shotId);
        if (!shot) return;

        this.editingShotId = shotId;
        const modal = document.getElementById('shotEditModal');
        const title = document.getElementById('shotEditModalTitle');

        if (!modal) return;

        // Set title
        if (title) {
            title.textContent = `Edit Shot ${shot.sceneNumber || ''}/${shot.shotNumber || ''}`;
        }

        // Populate form
        document.getElementById('shotEditScene').value = shot.sceneNumber || '';
        document.getElementById('shotEditShot').value = shot.shotNumber || '';
        document.getElementById('shotEditDescription').value = shot.description || '';
        
        // Duration - start with frames
        this.durationMode = 'frames';
        const durationInput = document.getElementById('shotEditDuration');
        const durationUnit = document.getElementById('shotEditDurationUnit');
        const durationToggle = document.getElementById('shotEditDurationToggle');
        if (durationInput) {
            durationInput.value = shot.durationFrames || 0;
        }
        if (durationUnit) {
            durationUnit.textContent = 'frames';
        }
        if (durationToggle) {
            durationToggle.textContent = 'Switch to Seconds';
        }

        // Camera fields
        this.setSelectOrCustom('shotEditCameraAngle', 'shotEditCameraAngleCustom', shot.cameraAngle);
        this.setSelectOrCustom('shotEditCameraMovement', 'shotEditCameraMovementCustom', shot.cameraMovement);
        this.setSelectOrCustom('shotEditCameraLens', 'shotEditCameraLensCustom', shot.cameraLens);
        this.setSelectOrCustom('shotEditDistance', 'shotEditDistanceCustom', shot.distance);
        this.setSelectOrCustom('shotEditShotType', 'shotEditShotTypeCustom', shot.shotType);

        document.getElementById('shotEditLocation').value = shot.location || '';
        document.getElementById('shotEditCharacters').value = shot.characters || '';
        document.getElementById('shotEditSetupTime').value = shot.setupTimeMinutes || shot.setupTime || '';
        document.getElementById('shotEditPredictedTakes').value = shot.predictedTakes || '';
        document.getElementById('shotEditProps').value = shot.props || '';
        document.getElementById('shotEditEquipment').value = shot.equipment || '';
        document.getElementById('shotEditAudio').value = shot.audio || '';
        document.getElementById('shotEditWardrobe').value = shot.wardrobe || '';
        document.getElementById('shotEditMakeup').value = shot.makeup || '';
        document.getElementById('shotEditStatus').value = shot.status || 'pending';
        document.getElementById('shotEditSpecialNotes').value = shot.specialNotes || '';

        // Show modal
        modal.style.display = 'block';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Set select dropdown or show custom input
     */
    setSelectOrCustom(selectId, customId, value) {
        const select = document.getElementById(selectId);
        const custom = document.getElementById(customId);
        if (!select || !custom) return;

        // Check if value is in options
        const option = Array.from(select.options).find(opt => opt.value === value);
        if (option) {
            select.value = value;
            custom.style.display = 'none';
            custom.value = '';
        } else if (value) {
            // Custom value
            select.value = 'custom';
            custom.style.display = 'block';
            custom.value = value;
        } else {
            select.value = '';
            custom.style.display = 'none';
            custom.value = '';
        }
    }

    /**
     * Toggle duration mode (frames <-> seconds)
     */
    toggleDurationMode() {
        const durationInput = document.getElementById('shotEditDuration');
        const durationUnit = document.getElementById('shotEditDurationUnit');
        const durationToggle = document.getElementById('shotEditDurationToggle');
        const frameRate = this.app.shotListManager.getFrameRate();

        if (!durationInput || !durationUnit || !durationToggle) return;

        const currentValue = parseFloat(durationInput.value) || 0;

        if (this.durationMode === 'frames') {
            // Switch to seconds
            const seconds = this.app.shotListManager.framesToSeconds(currentValue);
            durationInput.value = seconds.toFixed(2);
            durationUnit.textContent = 'seconds';
            durationToggle.textContent = 'Switch to Frames';
            this.durationMode = 'seconds';
        } else {
            // Switch to frames
            const frames = this.app.shotListManager.secondsToFrames(currentValue);
            durationInput.value = frames;
            durationUnit.textContent = 'frames';
            durationToggle.textContent = 'Switch to Seconds';
            this.durationMode = 'frames';
        }
    }

    /**
     * Save shot from modal
     */
    saveShot() {
        if (!this.app.shotListManager || !this.editingShotId) return;

        const shot = this.app.shotListManager.getShot(this.editingShotId);
        if (!shot) return;

        // Get form values
        const sceneNumber = document.getElementById('shotEditScene').value;
        const shotNumber = document.getElementById('shotEditShot').value;
        const description = document.getElementById('shotEditDescription').value;
        
        // Duration
        const durationInput = document.getElementById('shotEditDuration');
        const durationValue = parseFloat(durationInput.value) || 0;
        if (this.durationMode === 'frames') {
            this.app.shotListManager.updateDuration(shot, durationValue, true);
        } else {
            this.app.shotListManager.updateDuration(shot, durationValue, false);
        }

        // Camera fields
        const cameraAngle = this.getSelectOrCustom('shotEditCameraAngle', 'shotEditCameraAngleCustom');
        const cameraMovement = this.getSelectOrCustom('shotEditCameraMovement', 'shotEditCameraMovementCustom');
        const cameraLens = this.getSelectOrCustom('shotEditCameraLens', 'shotEditCameraLensCustom');
        const distance = this.getSelectOrCustom('shotEditDistance', 'shotEditDistanceCustom');
        const shotType = this.getSelectOrCustom('shotEditShotType', 'shotEditShotTypeCustom');

        const location = document.getElementById('shotEditLocation').value;
        const characters = document.getElementById('shotEditCharacters').value;
        const setupTimeMinutes = parseInt(document.getElementById('shotEditSetupTime').value) || 0;
        const predictedTakes = document.getElementById('shotEditPredictedTakes').value;
        const props = document.getElementById('shotEditProps').value;
        const equipment = document.getElementById('shotEditEquipment').value;
        const audio = document.getElementById('shotEditAudio').value;
        const wardrobe = document.getElementById('shotEditWardrobe').value;
        const makeup = document.getElementById('shotEditMakeup').value;
        const status = document.getElementById('shotEditStatus').value;
        const specialNotes = document.getElementById('shotEditSpecialNotes').value;

        // Update shot
        this.app.shotListManager.updateShot(this.editingShotId, {
            sceneNumber,
            shotNumber,
            description,
            cameraAngle,
            cameraMovement,
            cameraLens,
            distance,
            shotType,
            location,
            characters,
            setupTimeMinutes,
            predictedTakes,
            props,
            equipment,
            audio,
            wardrobe,
            makeup,
            status,
            specialNotes
        });

        this.closeShotEditModal();
        this.renderShotList();
    }

    /**
     * Get value from select or custom input
     */
    getSelectOrCustom(selectId, customId) {
        const select = document.getElementById(selectId);
        const custom = document.getElementById(customId);
        if (!select || !custom) return '';

        if (select.value === 'custom') {
            return custom.value.trim();
        }
        return select.value;
    }

    /**
     * Close shot edit modal
     */
    closeShotEditModal() {
        const modal = document.getElementById('shotEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.editingShotId = null;
        this.durationMode = 'frames';
    }

    /**
     * Delete a shot
     */
    deleteShot(shotId) {
        if (!this.app.shotListManager) return;
        
        const shot = this.app.shotListManager.getShot(shotId);
        if (!shot) return;
        
        // Only allow delete if shot is manual and has no storyboard frames
        const canDelete = shot.isManual && (!shot.storyboardImage || shot.frameCount === 0);
        if (!canDelete) {
            this.app.customAlert('Cannot delete this shot. Only manually created shots without storyboard frames can be deleted.');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this shot?')) return;

        this.app.shotListManager.deleteShot(shotId);
        this.renderShotList();
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        const modal = document.getElementById('shotListSettingsModal');
        if (!modal) return;

        // Set frame rate
        const frameRateInput = document.getElementById('shotListFrameRate');
        if (frameRateInput) {
            frameRateInput.value = this.app.project.settings.frameRate || 24;
        }

        // Set production multiplier
        const multiplierInput = document.getElementById('shotListProductionMultiplier');
        if (multiplierInput) {
            multiplierInput.value = this.app.project.settings.productionTimeMultiplier || 1.5;
        }

        // Render custom columns
        this.renderCustomColumns();

        modal.style.display = 'block';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Render custom columns list
     */
    renderCustomColumns() {
        const container = document.getElementById('customColumnsList');
        if (!container) return;

        container.innerHTML = '';

        this.customColumns.forEach((col, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; background: #252526; border-radius: 4px;';
            div.innerHTML = `
                <input type="text" value="${col.name}" data-column-id="${col.id}" style="flex: 1; padding: 6px; background: #1e1e1e; border: 1px solid #444; border-radius: 4px; color: #ccc;">
                <button class="btn-icon delete-column" data-column-id="${col.id}" style="background: #c53030; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            `;

            const deleteBtn = div.querySelector('.delete-column');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.removeCustomColumn(col.id));
            }

            container.appendChild(div);
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Add custom column
     */
    addCustomColumn() {
        const name = prompt('Enter column name:');
        if (!name || !name.trim()) return;

        const column = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim()
        };

        this.customColumns.push(column);
        this.renderCustomColumns();
    }

    /**
     * Remove custom column
     */
    removeCustomColumn(columnId) {
        if (!confirm('Are you sure you want to remove this custom column? All data in this column will be lost.')) {
            return;
        }

        this.customColumns = this.customColumns.filter(col => col.id !== columnId);
        this.renderCustomColumns();
    }

    /**
     * Save settings
     */
    saveSettings() {
        const frameRateInput = document.getElementById('shotListFrameRate');
        if (frameRateInput) {
            this.app.project.settings.frameRate = parseInt(frameRateInput.value) || 24;
        }

        const multiplierInput = document.getElementById('shotListProductionMultiplier');
        if (multiplierInput) {
            this.app.project.settings.productionTimeMultiplier = parseFloat(multiplierInput.value) || 1.5;
        }

        // Save custom columns
        this.app.project.settings.customShotListColumns = this.customColumns;

        this.app.markChanged();
        this.closeSettingsModal();
        
        // Re-render to update summary with new multiplier
        this.renderShotList();
    }

    /**
     * Close settings modal
     */
    closeSettingsModal() {
        const modal = document.getElementById('shotListSettingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Show export shot list PDF dialog
     */
    async showExportShotListPDFDialog() {
        const modal = document.getElementById('exportShotListPDFModal');
        if (!modal) {
            // Fallback to direct export if modal doesn't exist
            return await this.exportShotListPDF();
        }

        // Get default project name (from project name or filename)
        const defaultProjectName = this.app.project.name || 
            (this.app.currentProjectPath ? this.app.currentProjectPath.replace(/\.[^/.]+$/, '') : 'ShotList');
        
        const projectNameInput = document.getElementById('exportShotListProjectName');
        const includeCustomColumnsCheck = document.getElementById('exportShotListIncludeCustomColumns');
        const backgroundColorInput = document.getElementById('exportShotListBackgroundColor');
        const textColorInput = document.getElementById('exportShotListTextColor');
        const sceneRowBackgroundColorInput = document.getElementById('exportShotListSceneRowBackgroundColor');
        const sceneRowTextColorInput = document.getElementById('exportShotListSceneRowTextColor');
        const cancelBtn = document.getElementById('exportShotListPDFCancel');
        const exportBtn = document.getElementById('exportShotListPDFExport');
        const closeBtn = modal.querySelector('.modal-close');

        if (projectNameInput) projectNameInput.value = defaultProjectName;
        if (includeCustomColumnsCheck) includeCustomColumnsCheck.checked = true;

        return new Promise((resolve) => {
            const handleExport = async () => {
                const settings = {
                    projectName: projectNameInput?.value || defaultProjectName,
                    includeCustomColumns: includeCustomColumnsCheck?.checked !== false,
                    backgroundColor: backgroundColorInput?.value || '#ffffff',
                    textColor: textColorInput?.value || '#000000',
                    sceneRowBackgroundColor: sceneRowBackgroundColorInput?.value || '#f0f0f0',
                    sceneRowTextColor: sceneRowTextColorInput?.value || '#505050'
                };
                modal.style.display = 'none';
                exportBtn.removeEventListener('click', handleExport);
                cancelBtn?.removeEventListener('click', handleCancel);
                closeBtn?.removeEventListener('click', handleCancel);
                
                // Request file handle FIRST (while we have user gesture)
                let fileHandle = null;
                const version = this.app.project.version || '';
                const versionSuffix = version ? `_v${version}` : '';
                const filename = `${settings.projectName.replace(/[^a-z0-9]/gi, '_')}${versionSuffix}_ShotList.pdf`;
                
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
                const result = await this.exportShotListPDF(settings, fileHandle, filename);
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
     * Export shot list to PDF
     * @param {Object} settings - Export settings from dialog
     * @param {FileSystemFileHandle} fileHandle - Optional file handle (if already requested)
     * @param {string} filename - Optional filename (if file handle was requested)
     */
    async exportShotListPDF(settings = {}, fileHandle = null, filename = null) {
        // Prevent double calls
        if (this.isExportingPDF) {
            return false;
        }

        if (!this.app.shotListManager) {
            await this.app.customAlert('Shot list manager not available.');
            return false;
        }

        const shots = this.app.shotListManager.getAllShots();

        if (shots.length === 0) {
            await this.app.customAlert('No shots to export. Please add shots to the shot list first.');
            return false;
        }

        if (!window.jspdf) {
            await this.app.customAlert('PDF library not loaded. Please refresh the page.');
            return false;
        }

        // Use settings from dialog or defaults
        const projectName = settings.projectName || this.app.project.name || 'ShotList';
        const includeCustomColumns = settings.includeCustomColumns !== false;
        const backgroundColor = settings.backgroundColor || '#ffffff';
        const textColor = settings.textColor || '#000000';
        const sceneRowBackgroundColor = settings.sceneRowBackgroundColor || '#f0f0f0';
        const sceneRowTextColor = settings.sceneRowTextColor || '#505050';

        this.isExportingPDF = true;
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = 297; // A4 landscape width
            const pageHeight = 210; // A4 landscape height
            const margin = 10;
            const headerHeight = 25;
            const footerHeight = 10;
            const tableStartY = margin + headerHeight;
            const tableEndY = pageHeight - margin - footerHeight;
            const rowHeight = 6;
            const frameRate = this.app.shotListManager.getFrameRate();
            const productionMultiplier = this.app.project.settings?.productionTimeMultiplier || 1.5;

            // Define all columns (standard + custom)
            const standardColumns = [
                { key: 'sceneNumber', header: 'Scene', width: 12 },
                { key: 'shotNumber', header: 'Shot', width: 12 },
                { key: 'frameCount', header: 'Frames', width: 12 },
                { key: 'description', header: 'Description', width: 50, wrap: true },
                { key: 'duration', header: 'Duration', width: 25 },
                { key: 'cameraAngle', header: 'Angle', width: 25, wrap: true },
                { key: 'cameraMovement', header: 'Movement', width: 25, wrap: true },
                { key: 'cameraLens', header: 'Lens', width: 20, wrap: true },
                { key: 'distance', header: 'Distance', width: 20 },
                { key: 'shotType', header: 'Type', width: 20 },
                { key: 'location', header: 'Location', width: 30, wrap: true },
                { key: 'characters', header: 'Characters', width: 25, wrap: true },
                { key: 'setupTime', header: 'Setup', width: 20 },
                { key: 'predictedTakes', header: 'Takes', width: 15 },
                { key: 'status', header: 'Status', width: 20 }
            ];

            // Add custom columns (only if enabled)
            const customColumnDefs = includeCustomColumns ? this.customColumns.map(col => ({
                key: `custom_${col.id}`,
                header: col.name,
                width: 25,
                wrap: true
            })) : [];

            const allColumns = [...standardColumns, ...customColumnDefs];
            const totalColumnWidth = allColumns.reduce((sum, col) => sum + col.width, 0);
            const scaleFactor = (pageWidth - 2 * margin) / totalColumnWidth;
            const scaledColumnWidths = allColumns.map(col => col.width * scaleFactor);

            // Group shots by scene
            const sceneGroups = new Map();
            shots.forEach(shot => {
                const sceneNum = shot.sceneNumber || 'Unknown';
                if (!sceneGroups.has(sceneNum)) {
                    sceneGroups.set(sceneNum, []);
                }
                sceneGroups.get(sceneNum).push(shot);
            });

            const sortedScenes = Array.from(sceneGroups.entries()).sort((a, b) => {
                const numA = parseInt(a[0]) || 0;
                const numB = parseInt(b[0]) || 0;
                return numA - numB;
            });

            // Set background color for all pages
            const bgRgb = this.hexToRgb(backgroundColor);
            if (bgRgb) {
                pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            }

            let currentPage = 1;
            let y = tableStartY;
            let isFirstPage = true;

            // Helper function to add page number
            const addPageNumber = (pageNum) => {
                pdf.setFontSize(8);
                pdf.setFont(undefined, 'normal');
                pdf.setTextColor(180, 180, 180);
                pdf.text(`Page ${pageNum}`, pageWidth - margin - 10, pageHeight - margin - 5);
                const textRgb = this.hexToRgb(textColor);
                if (textRgb) {
                    pdf.setTextColor(textRgb.r, textRgb.g, textRgb.b);
                } else {
                    pdf.setTextColor(0, 0, 0);
                }
            };

            // Helper function to draw table headers
            const drawHeaders = () => {
                pdf.setFontSize(7);
                pdf.setFont(undefined, 'bold');
                const textRgb = this.hexToRgb(textColor);
                if (textRgb) {
                    pdf.setTextColor(textRgb.r, textRgb.g, textRgb.b);
                }
                let x = margin;
                allColumns.forEach((col, i) => {
                    pdf.text(col.header, x, y);
                    x += scaledColumnWidths[i];
                });
                // Draw line under headers
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, y + 2, pageWidth - margin, y + 2);
                y += rowHeight + 2;
            };

            // Helper function to wrap text
            const wrapText = (text, maxWidth) => {
                if (!text || text === '-') return ['-'];
                const words = String(text).split(' ');
                const lines = [];
                let currentLine = '';
                
                words.forEach(word => {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const textWidth = pdf.getTextWidth(testLine);
                    if (textWidth > maxWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                });
                if (currentLine) {
                    lines.push(currentLine);
                }
                return lines.length > 0 ? lines : ['-'];
            };

            // Helper function to get cell value
            const getCellValue = (shot, col) => {
                if (col.key.startsWith('custom_')) {
                    const colId = col.key.replace('custom_', '');
                    return shot.customFields?.[colId] || '-';
                }
                switch (col.key) {
                    case 'duration':
                        return shot.durationFrames > 0 
                            ? `${shot.durationFrames}f (${(shot.durationFrames / frameRate).toFixed(1)}s)`
                            : '-';
                    case 'setupTime':
                        return shot.setupTimeMinutes ? `${shot.setupTimeMinutes} min` : (shot.setupTime || '-');
                    case 'frameCount':
                        return String(shot.frameCount || 0);
                    case 'cameraAngle':
                        return shot.cameraAngle || '-';
                    case 'cameraMovement':
                        return shot.cameraMovement || '-';
                    case 'cameraLens':
                        return shot.cameraLens || '-';
                    case 'distance':
                        return shot.distance || '-';
                    case 'shotType':
                        return shot.shotType || '-';
                    case 'location':
                        return shot.location || '-';
                    case 'characters':
                        return shot.characters || '-';
                    case 'predictedTakes':
                        return shot.predictedTakes || '-';
                    case 'status':
                        return shot.status || '-';
                    case 'description':
                        return shot.description || '-';
                    case 'sceneNumber':
                        return shot.sceneNumber || '-';
                    case 'shotNumber':
                        return shot.shotNumber || '-';
                    default:
                        // Fallback: try direct property access
                        const value = shot[col.key];
                        return value !== undefined && value !== null && value !== '' ? String(value) : '-';
                }
            };

            // Title and project info (only on first page)
            if (isFirstPage) {
                const version = this.app.project.version || '';
                const versionSuffix = version ? ` v${version}` : '';
                
                pdf.setFontSize(18);
                pdf.setFont(undefined, 'bold');
                const titleRgb = this.hexToRgb(textColor);
                if (titleRgb) {
                    pdf.setTextColor(titleRgb.r, titleRgb.g, titleRgb.b);
                }
                pdf.text(`${projectName}${versionSuffix} - ShotList`, margin, 15);
                
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'normal');
                const date = new Date().toLocaleDateString();
                pdf.text(`Generated: ${date}`, margin, 22);
                
                isFirstPage = false;
            }

            // Draw headers on first page
            drawHeaders();

            // Process shots grouped by scene
            sortedScenes.forEach(([sceneNum, sceneShots], sceneIndex) => {
                // Draw a line before each scene (except the first one)
                if (sceneIndex > 0) {
                    if (y + rowHeight * 2 > tableEndY) {
                        addPageNumber(currentPage);
                        pdf.addPage();
                        currentPage++;
                        // Set background for new page
                        if (bgRgb) {
                            pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                        }
                        y = tableStartY;
                        drawHeaders();
                    }
                    pdf.setDrawColor(200, 200, 200);
                    pdf.line(margin, y, pageWidth - margin, y);
                    y += 3;
                }

                sceneShots.forEach((shot, shotIndex) => {
                    // Check if we need a new page
                    if (y + rowHeight * 3 > tableEndY) {
                        addPageNumber(currentPage);
                        pdf.addPage();
                        currentPage++;
                        // Set background for new page
                        if (bgRgb) {
                            pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                        }
                        y = tableStartY;
                        drawHeaders();
                    }

                    // Draw row - ensure shots use default text color and no background
                    pdf.setFontSize(6);
                    pdf.setFont(undefined, 'normal');
                    // Always use the main text color for shots (not scene summary color)
                    const textRgb = this.hexToRgb(textColor);
                    if (textRgb) {
                        pdf.setTextColor(textRgb.r, textRgb.g, textRgb.b);
                    } else {
                        pdf.setTextColor(0, 0, 0); // Default to black
                    }
                    // Ensure no background color is set for shot rows
                    // (scene summary will set its own background later)
                    let x = margin;
                    let maxLines = 1;

                    allColumns.forEach((col, colIndex) => {
                        const cellValue = getCellValue(shot, col);
                        const cellWidth = scaledColumnWidths[colIndex];
                        
                        // Make scene number bold
                        if (col.key === 'sceneNumber') {
                            pdf.setFont(undefined, 'bold');
                        } else {
                            pdf.setFont(undefined, 'normal');
                        }
                        
                        if (col.wrap) {
                            const lines = wrapText(cellValue, cellWidth - 2);
                            maxLines = Math.max(maxLines, lines.length);
                            lines.forEach((line, lineIndex) => {
                                pdf.text(line, x + 1, y + (lineIndex * 3.5) + 3);
                            });
                        } else {
                            const text = String(cellValue);
                            const truncated = pdf.splitTextToSize(text, cellWidth - 2);
                            maxLines = Math.max(maxLines, truncated.length);
                            truncated.forEach((line, lineIndex) => {
                                pdf.text(line, x + 1, y + (lineIndex * 3.5) + 3);
                            });
                        }
                        x += cellWidth;
                    });

                    y += rowHeight * maxLines + 1;
                });

                // Add spacing between shots and scene summary to prevent overlap
                y += 2;

                // Add scene summary after each scene
                if (y + rowHeight * 2 > tableEndY) {
                    addPageNumber(currentPage);
                    pdf.addPage();
                    currentPage++;
                    // Set background for new page
                    if (bgRgb) {
                        pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                    }
                    y = tableStartY;
                    drawHeaders();
                }

                // Calculate scene summary
                let sceneSetupTime = 0;
                let sceneDurationFrames = 0;
                let sceneExpectedTime = 0;

                sceneShots.forEach(shot => {
                    const setupTime = shot.setupTimeMinutes || 0;
                    sceneSetupTime += setupTime;
                    sceneDurationFrames += shot.durationFrames || 0;
                    const takes = parseInt(shot.predictedTakes) || 1;
                    const durationMinutes = (shot.durationFrames / frameRate) / 60;
                    sceneExpectedTime += (setupTime + durationMinutes) * takes * productionMultiplier;
                });

                const formatTime = (minutes) => {
                    const hours = Math.floor(minutes / 60);
                    const mins = Math.round(minutes % 60);
                    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                };

                // Draw scene summary row with grey background
                // Ensure proper spacing from shots above - summary starts AFTER the last shot
                const summaryHeight = rowHeight + 2;
                
                // Draw background rectangle with custom color - positioned AFTER shots, not overlapping
                const sceneBgRgb = this.hexToRgb(sceneRowBackgroundColor);
                if (sceneBgRgb) {
                    pdf.setFillColor(sceneBgRgb.r, sceneBgRgb.g, sceneBgRgb.b);
                    // Draw background starting at current y (after shots), with proper height
                    pdf.rect(margin, y, pageWidth - 2 * margin, summaryHeight, 'F');
                }
                
                // Draw summary text with custom color - positioned on the background
                pdf.setFontSize(7);
                pdf.setFont(undefined, 'italic');
                const sceneTextRgb = this.hexToRgb(sceneRowTextColor);
                if (sceneTextRgb) {
                    pdf.setTextColor(sceneTextRgb.r, sceneTextRgb.g, sceneTextRgb.b);
                } else {
                    pdf.setTextColor(80, 80, 80);
                }
                const summaryText = `Scene ${sceneNum} Summary: ${sceneShots.length} shots | Setup: ${formatTime(sceneSetupTime)} | Duration: ${sceneDurationFrames} frames | Expected: ${formatTime(sceneExpectedTime)}`;
                // Position text in the center of the background rectangle
                pdf.text(summaryText, margin, y + rowHeight);
                // Reset text color back to main text color (not black, but the user's text color setting)
                const mainTextRgb = this.hexToRgb(textColor);
                if (mainTextRgb) {
                    pdf.setTextColor(mainTextRgb.r, mainTextRgb.g, mainTextRgb.b);
                } else {
                    pdf.setTextColor(0, 0, 0);
                }
                pdf.setFont(undefined, 'normal');
                y += rowHeight + 2;
            });

            // Add project summary at the end
            if (y + rowHeight * 5 > tableEndY) {
                addPageNumber(currentPage);
                pdf.addPage();
                currentPage++;
                y = margin;
            }

            // Calculate project totals
            let totalSetupTime = 0;
            let totalDurationFrames = 0;
            let totalExpectedTime = 0;

            shots.forEach(shot => {
                const setupTime = shot.setupTimeMinutes || 0;
                totalSetupTime += setupTime;
                totalDurationFrames += shot.durationFrames || 0;
                const takes = parseInt(shot.predictedTakes) || 1;
                const durationMinutes = (shot.durationFrames / frameRate) / 60;
                totalExpectedTime += (setupTime + durationMinutes) * takes * productionMultiplier;
            });

            const formatTime = (minutes) => {
                const hours = Math.floor(minutes / 60);
                const mins = Math.round(minutes % 60);
                return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            };

            const formatDuration = (frames) => {
                const totalSeconds = frames / frameRate;
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = Math.floor(totalSeconds % 60);
                if (hours > 0) return `${hours}h ${minutes}m ${seconds}s (${frames} frames)`;
                if (minutes > 0) return `${minutes}m ${seconds}s (${frames} frames)`;
                return `${seconds}s (${frames} frames)`;
            };

            y += 5;
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text('Project Summary', margin, y);
            y += 6;

            pdf.setFontSize(8);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Total Shots: ${shots.length}`, margin, y);
            y += 5;
            pdf.text(`Total Setup Time: ${formatTime(totalSetupTime)}`, margin, y);
            y += 5;
            pdf.text(`Total Duration: ${formatDuration(totalDurationFrames)}`, margin, y);
            y += 5;
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(0, 122, 204);
            pdf.text(`Expected Production Time: ${formatTime(totalExpectedTime)}`, margin, y);
            pdf.setTextColor(0, 0, 0);

            // Add page number to last page
            addPageNumber(currentPage);

            // Generate filename if not provided
            if (!filename) {
                const version = this.app.project.version || '';
                const versionSuffix = version ? `_v${version}` : '';
                filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}${versionSuffix}_ShotList.pdf`;
            }

            // Generate PDF blob
            const blob = pdf.output('blob');
            
            // Save PDF using File System Access API if available
            if (fileHandle && this.app.fileManager?.supportsFileSystemAccess) {
                try {
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    this.app.showToast('Shot list PDF exported successfully!', 'success');
                    this.isExportingPDF = false;
                    return true;
                } catch (error) {
                    this.isExportingPDF = false;
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

                    this.app.showToast('Shot list PDF exported successfully!', 'success');
                    this.isExportingPDF = false;
                    return true;
                } catch (error) {
                    this.isExportingPDF = false;
                    if (error.name !== 'AbortError') {
                        console.error('Error saving PDF:', error);
                        await this.app.customAlert('Error saving PDF: ' + error.message);
                    }
                    return false;
                }
            } else {
                // Fallback: download PDF
                pdf.save(filename);
                this.app.showToast('Shot list PDF exported successfully!', 'success');
                this.isExportingPDF = false;
                return true;
            }
        } catch (error) {
            this.isExportingPDF = false;
            console.error('Error exporting shot list PDF:', error);
            await this.app.customAlert('Error exporting shot list PDF. Please try again.');
            return false;
        }
    }

    /**
     * Convert hex color to RGB
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
