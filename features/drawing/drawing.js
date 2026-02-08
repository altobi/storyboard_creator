/**
 * Professional Drawing System for Storyboard Creator
 * Handles all drawing operations with proper tools, undo/redo, and performance optimization
 */

class DrawingSystem {
    constructor(storyboardCreator) {
        this.app = storyboardCreator;
        this.canvases = new Map(); // Store canvas instances per page
        this.history = new Map(); // Undo/redo history per page
        this.historyIndex = new Map(); // Current history index per page
        this.maxHistorySize = 50; // Increased history size
        
        // Drawing state - sync with app settings
        this.currentTool = storyboardCreator.project?.settings?.drawingTool || 'brush';
        this.brushSize = storyboardCreator.project?.settings?.brushSize || 5;
        this.brushColor = storyboardCreator.project?.settings?.brushColor || '#000000';
        this.fillColor = storyboardCreator.project?.settings?.fillColor || '#000000';
        this.smoothing = (storyboardCreator.project?.settings?.brushSmoothing || 50) / 100;
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPath = [];
    }
    
    /**
     * Initialize drawing canvas for a page
     */
    initCanvas(pageElement, pageIndex) {
        if (this.canvases.has(pageIndex)) {
            return; // Already initialized
        }
        
        const canvas = document.createElement('canvas');
        canvas.className = 'drawing-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'auto';
        canvas.style.zIndex = '100';
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Set canvas size to match page - wait for page to be fully rendered
        const updateCanvasSize = () => {
            const rect = pageElement.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                // Page not yet rendered, try again
                setTimeout(updateCanvasSize, 50);
                return;
            }
            const dpr = window.devicePixelRatio || 1;
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            
            ctx.scale(dpr, dpr);
            
            // Reload drawing if it exists after resize
            if (this.app.project.drawings && this.app.project.drawings[pageIndex] && oldWidth > 0) {
                this.loadDrawing(canvas, this.app.project.drawings[pageIndex]);
            }
        };
        
        // Initial size setup
        const rect = pageElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.scale(dpr, dpr);
        } else {
            // Page not rendered yet, wait
            setTimeout(updateCanvasSize, 100);
        }
        
        // Load existing drawing if any
        if (this.app.project.drawings && this.app.project.drawings[pageIndex] && rect.width > 0) {
            this.loadDrawing(canvas, this.app.project.drawings[pageIndex]);
        }
        
        // Setup event listeners
        this.setupCanvasEvents(canvas, pageIndex, ctx);
        
        pageElement.appendChild(canvas);
        this.canvases.set(pageIndex, { canvas, ctx, pageElement });
        this.history.set(pageIndex, []);
        this.historyIndex.set(pageIndex, -1);
        
        // Save initial state
        this.saveToHistory(pageIndex);
        
        // Update canvas size on window resize
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                updateCanvasSize();
            });
            resizeObserver.observe(pageElement);
        }
    }
    
    /**
     * Setup canvas event listeners
     */
    setupCanvasEvents(canvas, pageIndex, ctx) {
        const getPoint = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX || e.touches[0].clientX) - rect.left,
                y: (e.clientY || e.touches[0].clientY) - rect.top
            };
        };
        
        const startDraw = (e) => {
            if (!this.app.project.settings.enableDrawing) return;
            e.preventDefault();
            this.isDrawing = true;
            const point = getPoint(e);
            this.startPoint = point;
            this.currentPath = [point];
            
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = this.brushColor;
                ctx.lineWidth = this.brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            } else if (this.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
            }
        };
        
        const draw = (e) => {
            if (!this.isDrawing || !this.app.project.settings.enableDrawing) return;
            e.preventDefault();
            
            const point = getPoint(e);
            this.currentPath.push(point);
            
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = this.brushColor;
                ctx.lineWidth = this.brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Smooth drawing with quadratic curves
                if (this.currentPath.length > 2) {
                    const prev = this.currentPath[this.currentPath.length - 2];
                    const curr = this.currentPath[this.currentPath.length - 1];
                    const midX = (prev.x + curr.x) / 2;
                    const midY = (prev.y + curr.y) / 2;
                    
                    ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(midX, midY);
                } else {
                    ctx.lineTo(point.x, point.y);
                    ctx.stroke();
                }
            } else if (this.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(point.x, point.y, this.brushSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        };
        
        const stopDraw = (e) => {
            if (!this.isDrawing || !this.app.project.settings.enableDrawing) return;
            e.preventDefault();
            
            this.isDrawing = false;
            
            // Finish drawing based on tool
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                if (this.currentPath.length > 0) {
                    const lastPoint = this.currentPath[this.currentPath.length - 1];
                    ctx.lineTo(lastPoint.x, lastPoint.y);
                    ctx.stroke();
                }
            } else if (this.currentTool === 'line') {
                const endPoint = getPoint(e);
                this.drawLine(ctx, this.startPoint, endPoint);
            } else if (this.currentTool === 'arrow') {
                const endPoint = getPoint(e);
                this.drawArrow(ctx, this.startPoint, endPoint);
            } else if (this.currentTool === 'rectangle') {
                const endPoint = getPoint(e);
                this.drawRectangle(ctx, this.startPoint, endPoint, false);
            } else if (this.currentTool === 'rectangle-fill') {
                const endPoint = getPoint(e);
                this.drawRectangle(ctx, this.startPoint, endPoint, true);
            } else if (this.currentTool === 'circle') {
                const endPoint = getPoint(e);
                this.drawCircle(ctx, this.startPoint, endPoint, false);
            } else if (this.currentTool === 'circle-fill') {
                const endPoint = getPoint(e);
                this.drawCircle(ctx, this.startPoint, endPoint, true);
            }
            // Eraser is handled during draw, no need for stop action
            
            // Save to history and project
            this.saveToHistory(pageIndex);
            this.saveDrawing(pageIndex);
            this.currentPath = [];
            this.startPoint = null;
        };
        
        // Mouse events
        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);
        
        // Touch events
        canvas.addEventListener('touchstart', startDraw);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDraw);
        
        // Eraser handling
        const eraserDraw = (e) => {
            if (!this.isDrawing || this.currentTool !== 'eraser') return;
            e.preventDefault();
            
            const point = getPoint(e);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.brushSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        };
        
        canvas.addEventListener('mousemove', eraserDraw);
        canvas.addEventListener('touchmove', eraserDraw);
    }
    
    /**
     * Draw helper methods
     */
    drawLine(ctx, start, end) {
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    
    drawArrow(ctx, start, end) {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headlen = Math.max(this.brushSize * 3, 15);
        
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }
    
    drawRectangle(ctx, start, end, fill) {
        const width = end.x - start.x;
        const height = end.y - start.y;
        
        if (fill) {
            ctx.fillStyle = this.fillColor;
            ctx.fillRect(start.x, start.y, width, height);
        } else {
            ctx.strokeStyle = this.brushColor;
            ctx.lineWidth = this.brushSize;
            ctx.strokeRect(start.x, start.y, width, height);
        }
    }
    
    drawCircle(ctx, start, end, fill) {
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        
        if (fill) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        } else {
            ctx.strokeStyle = this.brushColor;
            ctx.lineWidth = this.brushSize;
            ctx.stroke();
        }
    }
    
    /**
     * Save current canvas state to history
     */
    saveToHistory(pageIndex) {
        const canvas = this.canvases.get(pageIndex)?.canvas;
        if (!canvas) return;
        
        const history = this.history.get(pageIndex) || [];
        const index = this.historyIndex.get(pageIndex) || -1;
        
        // Remove any future history if we're not at the end
        if (index < history.length - 1) {
            history.splice(index + 1);
        }
        
        // Add new state
        history.push(canvas.toDataURL());
        
        // Limit history size
        if (history.length > this.maxHistorySize) {
            history.shift();
        } else {
            this.historyIndex.set(pageIndex, history.length - 1);
        }
        
        this.history.set(pageIndex, history);
    }
    
    /**
     * Undo last action
     */
    undo(pageIndex) {
        const history = this.history.get(pageIndex) || [];
        let index = this.historyIndex.get(pageIndex) || -1;
        
        if (index > 0) {
            index--;
            this.historyIndex.set(pageIndex, index);
            this.loadDrawing(this.canvases.get(pageIndex).canvas, history[index]);
            this.saveDrawing(pageIndex);
        }
    }
    
    /**
     * Redo last undone action
     */
    redo(pageIndex) {
        const history = this.history.get(pageIndex) || [];
        let index = this.historyIndex.get(pageIndex) || -1;
        
        if (index < history.length - 1) {
            index++;
            this.historyIndex.set(pageIndex, index);
            this.loadDrawing(this.canvases.get(pageIndex).canvas, history[index]);
            this.saveDrawing(pageIndex);
        }
    }
    
    /**
     * Load drawing from data URL
     */
    loadDrawing(canvas, dataUrl) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        };
        img.src = dataUrl;
    }
    
    /**
     * Save drawing to project
     */
    saveDrawing(pageIndex) {
        const canvas = this.canvases.get(pageIndex)?.canvas;
        if (!canvas) return;
        
        if (!this.app.project.drawings) {
            this.app.project.drawings = {};
        }
        
        this.app.project.drawings[pageIndex] = canvas.toDataURL();
        this.app.markChanged();
    }
    
    /**
     * Clear canvas
     */
    clear(pageIndex) {
        const canvasData = this.canvases.get(pageIndex);
        if (!canvasData) return;
        
        const ctx = canvasData.ctx;
        ctx.clearRect(0, 0, canvasData.canvas.width, canvasData.canvas.height);
        this.saveToHistory(pageIndex);
        this.saveDrawing(pageIndex);
    }
    
    /**
     * Set drawing tool
     */
    setTool(tool) {
        this.currentTool = tool;
    }
    
    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.brushSize = size;
    }
    
    /**
     * Set brush color
     */
    setBrushColor(color) {
        this.brushColor = color;
    }
    
    /**
     * Set fill color
     */
    setFillColor(color) {
        this.fillColor = color;
    }
    
    /**
     * Remove canvas for a page (cleanup)
     */
    removeCanvas(pageIndex) {
        const canvasData = this.canvases.get(pageIndex);
        if (canvasData && canvasData.canvas.parentNode) {
            canvasData.canvas.parentNode.removeChild(canvasData.canvas);
        }
        this.canvases.delete(pageIndex);
        this.history.delete(pageIndex);
        this.historyIndex.delete(pageIndex);
    }
}

