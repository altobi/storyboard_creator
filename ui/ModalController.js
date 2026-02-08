/**
 * ModalController - Handles all modal dialogs and custom dialogs
 * Extracted from app.js for better code organization
 */
class ModalController {
    constructor(app) {
        this.app = app;
        this.customDialogResolve = null;
        this.customDialogOriginalHTML = null;
    }

    /**
     * Setup all modal dialogs
     */
    setupModal() {
        const modal = document.getElementById('imageSettingsModal');
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = document.getElementById('imageSettingsCancel');
            const saveBtn = document.getElementById('imageSettingsSave');
            const removeBtn = document.getElementById('imageSettingsRemove');
            
            if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
            if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
            if (saveBtn) saveBtn.onclick = () => this.app.saveImageSettings();
            if (removeBtn) removeBtn.onclick = () => this.app.removeImage();
        }
        
        // Add image modal
        const addModal = document.getElementById('addImageModal');
        if (addModal) {
            const addCloseBtn = addModal.querySelector('.modal-close');
            const addCancelBtn = document.getElementById('addImageCancel');
            const addSaveBtn = document.getElementById('addImageSave');
            const addImageFile = document.getElementById('addImageFile');
            
            if (addCloseBtn) {
                addCloseBtn.onclick = () => {
                    addModal.style.display = 'none';
                    if (this.app.clearAddImageModal) this.app.clearAddImageModal();
                };
            }
            if (addCancelBtn) {
                addCancelBtn.onclick = () => {
                    addModal.style.display = 'none';
                    if (this.app.clearAddImageModal) this.app.clearAddImageModal();
                };
            }
            if (addSaveBtn) addSaveBtn.onclick = () => this.app.addImage();
            
            // Auto-populate scene/shot/frame when file is selected
            if (addImageFile && this.app.imageStructureParser) {
                addImageFile.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file && this.app.parseSingleImageFilename) {
                        this.app.parseSingleImageFilename(file);
                    }
                });
            }
        }
        
        window.onclick = (e) => {
            if (modal && e.target === modal) modal.style.display = 'none';
            if (addModal && e.target === addModal) addModal.style.display = 'none';
        };
        
        // Setup custom dialog
        this.setupCustomDialog();
    }
    
    /**
     * Setup custom dialog system
     */
    setupCustomDialog() {
        const dialog = document.getElementById('customDialog');
        if (!dialog) return;
        
        const actionsDiv = document.querySelector('.custom-dialog-actions');
        
        // Store original HTML of actions div to restore after customChoice
        if (actionsDiv) {
            this.customDialogOriginalHTML = actionsDiv.innerHTML;
        }
        
        // Close on backdrop click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeCustomDialog();
            }
        });
        
        // ESC key handler for all dialogs
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close custom dialog if open
                if (dialog && dialog.style.display === 'flex') {
                    this.closeCustomDialog();
                }
                // Close image settings modal if open
                const imageModal = document.getElementById('imageSettingsModal');
                if (imageModal && imageModal.style.display === 'block') {
                    imageModal.style.display = 'none';
                }
                // Close add image choice modal if open
                const choiceModal = document.getElementById('addImageChoiceModal');
                if (choiceModal && choiceModal.style.display === 'block') {
                    choiceModal.style.display = 'none';
                }
                // Close add image modal if open
                const addModal = document.getElementById('addImageModal');
                if (addModal && addModal.style.display === 'block') {
                    addModal.style.display = 'none';
                    if (this.app.clearAddImageModal) this.app.clearAddImageModal();
                }
                // Close drawing canvas modal if open
                const drawingModal = document.getElementById('drawingCanvasModal');
                if (drawingModal && drawingModal.style.display === 'block') {
                    if (this.app.closeDrawingCanvas) this.app.closeDrawingCanvas();
                }
                // Close image import modal if open
                const importModal = document.getElementById('imageImportModal');
                if (importModal && importModal.style.display === 'block') {
                    importModal.style.display = 'none';
                }
            }
        });
        
        // Store callbacks
        this.customDialogResolve = null;
    }
    
    /**
     * Close custom dialog and resolve with null
     */
    closeCustomDialog() {
        const dialog = document.getElementById('customDialog');
        if (dialog) {
            dialog.style.display = 'none';
            // Restore original HTML if needed
            const actionsDiv = document.querySelector('.custom-dialog-actions');
            if (actionsDiv && this.customDialogOriginalHTML) {
                actionsDiv.innerHTML = this.customDialogOriginalHTML;
            }
            // Resolve any pending promise with null (cancelled)
            if (this.customDialogResolve) {
                this.customDialogResolve(null);
                this.customDialogResolve = null;
            }
        }
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'success', duration = 3000) {
        // Use UIManager if available
        if (this.app.uiManager) {
            this.app.uiManager.showToast(message, type);
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
    
    /**
     * Custom alert dialog
     */
    async customAlert(message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const cancelBtn = document.getElementById('customDialogCancel');
            const noBtn = document.getElementById('customDialogNo');
            const input = document.getElementById('customDialogInput');
            
            if (!dialog || !title || !messageEl || !yesBtn) {
                alert(message);
                resolve();
                return;
            }
            
            title.textContent = 'Alert';
            messageEl.textContent = message;
            input.style.display = 'none';
            yesBtn.style.display = 'block';
            yesBtn.textContent = 'OK';
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (noBtn) noBtn.style.display = 'none';
            
            dialog.style.display = 'flex';
            this.customDialogResolve = resolve;
            
            const handleYes = () => {
                yesBtn.removeEventListener('click', handleYes);
                document.removeEventListener('keydown', handleEsc);
                dialog.style.display = 'none';
                this.customDialogResolve = null;
                resolve();
            };
            
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    yesBtn.removeEventListener('click', handleYes);
                    document.removeEventListener('keydown', handleEsc);
                    dialog.style.display = 'none';
                    this.customDialogResolve = null;
                    resolve();
                }
            };
            
            yesBtn.addEventListener('click', handleYes);
            document.addEventListener('keydown', handleEsc);
        });
    }
    
    /**
     * Custom confirm dialog
     */
    async customConfirm(message) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const yesBtn = document.getElementById('customDialogYes');
            const noBtn = document.getElementById('customDialogNo');
            const cancelBtn = document.getElementById('customDialogCancel');
            const input = document.getElementById('customDialogInput');
            
            if (!dialog || !title || !messageEl || !yesBtn || !noBtn) {
                const result = confirm(message);
                resolve(result);
                return;
            }
            
            title.textContent = 'Confirm';
            messageEl.textContent = message;
            input.style.display = 'none';
            yesBtn.style.display = 'block';
            yesBtn.textContent = 'Yes';
            noBtn.style.display = 'block';
            noBtn.textContent = 'No';
            if (cancelBtn) cancelBtn.style.display = 'none';
            
            dialog.style.display = 'flex';
            this.customDialogResolve = resolve;
            
            const handleYes = () => {
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                document.removeEventListener('keydown', handleEsc);
                dialog.style.display = 'none';
                this.customDialogResolve = null;
                resolve(true);
            };
            
            const handleNo = () => {
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                document.removeEventListener('keydown', handleEsc);
                dialog.style.display = 'none';
                this.customDialogResolve = null;
                resolve(false);
            };
            
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                    document.removeEventListener('keydown', handleEsc);
                    dialog.style.display = 'none';
                    this.customDialogResolve = null;
                    resolve(false); // ESC = No
                }
            };
            
            yesBtn.addEventListener('click', handleYes);
            noBtn.addEventListener('click', handleNo);
            document.addEventListener('keydown', handleEsc);
        });
    }
    
    /**
     * Custom choice dialog with multiple options
     * Options can be:
     * - Array of strings: ['Option1', 'Option2'] -> returns the selected string
     * - Array of objects: [{label: 'Option1', value: 'opt1', primary: true}] -> returns option.value
     */
    async customChoice(titleText, message, options) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const actionsDiv = document.querySelector('.custom-dialog-actions');
            const input = document.getElementById('customDialogInput');
            
            if (!dialog || !title || !messageEl || !actionsDiv) {
                const result = confirm(message);
                resolve(result);
                return;
            }
            
            title.textContent = titleText;
            messageEl.textContent = message;
            input.style.display = 'none';
            
            // Clear existing buttons and add custom ones
            actionsDiv.innerHTML = '';
            
            // Normalize options - convert strings to objects if needed
            const normalizedOptions = options.map((opt, index) => {
                if (typeof opt === 'string') {
                    return {
                        label: opt,
                        value: opt,
                        primary: index === options.length - 1 // Last option is primary (usually Cancel)
                    };
                }
                return opt;
            });
            
            normalizedOptions.forEach((option) => {
                const btn = document.createElement('button');
                btn.className = option.primary ? 'btn btn-primary' : 'btn btn-secondary';
                btn.textContent = option.label || option.value || option;
                btn.onclick = () => {
                    dialog.style.display = 'none';
                    document.removeEventListener('keydown', handleEsc);
                    // Restore original HTML
                    if (this.customDialogOriginalHTML) {
                        actionsDiv.innerHTML = this.customDialogOriginalHTML;
                    }
                    this.customDialogResolve = null;
                    resolve(option.value || option.label || option);
                };
                actionsDiv.appendChild(btn);
            });
            
            dialog.style.display = 'flex';
            this.customDialogResolve = resolve;
            
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    dialog.style.display = 'none';
                    document.removeEventListener('keydown', handleEsc);
                    // Restore original HTML
                    if (this.customDialogOriginalHTML) {
                        actionsDiv.innerHTML = this.customDialogOriginalHTML;
                    }
                    this.customDialogResolve = null;
                    resolve(null); // ESC = Cancel
                }
            };
            
            document.addEventListener('keydown', handleEsc);
        });
    }
    
    /**
     * Custom prompt dialog
     */
    async customPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('customDialog');
            const title = document.getElementById('customDialogTitle');
            const messageEl = document.getElementById('customDialogMessage');
            const input = document.getElementById('customDialogInput');
            const yesBtn = document.getElementById('customDialogYes');
            const cancelBtn = document.getElementById('customDialogCancel');
            const noBtn = document.getElementById('customDialogNo');
            
            if (!dialog || !title || !messageEl || !input || !yesBtn || !cancelBtn) {
                const result = prompt(message, defaultValue);
                resolve(result);
                return;
            }
            
            title.textContent = 'Input';
            messageEl.textContent = message;
            input.style.display = 'block';
            input.value = defaultValue;
            input.type = 'text';
            yesBtn.style.display = 'block';
            yesBtn.textContent = 'OK';
            cancelBtn.style.display = 'block';
            cancelBtn.textContent = 'Cancel';
            if (noBtn) noBtn.style.display = 'none';
            
            dialog.style.display = 'flex';
            input.focus();
            input.select();
            
            const handleYes = () => {
                yesBtn.removeEventListener('click', handleYes);
                cancelBtn.removeEventListener('click', handleCancel);
                input.removeEventListener('keypress', handleKeyPress);
                dialog.style.display = 'none';
                resolve(input.value);
            };
            
            const handleCancel = () => {
                yesBtn.removeEventListener('click', handleYes);
                cancelBtn.removeEventListener('click', handleCancel);
                input.removeEventListener('keypress', handleKeyPress);
                dialog.style.display = 'none';
                resolve(null);
            };
            
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleYes();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };
            
            yesBtn.addEventListener('click', handleYes);
            cancelBtn.addEventListener('click', handleCancel);
            input.addEventListener('keypress', handleKeyPress);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalController;
}

