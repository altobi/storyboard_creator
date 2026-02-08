/**
 * Professional Drawing Canvas using Konva.js
 * Provides a full-featured drawing interface with layers, selection, and comprehensive tools
 */
class DrawingCanvas {
    constructor(containerElement, width = 1200, height = 800) {
        this.container = containerElement;
        this.width = width;
        this.height = height;
        
        // Drawing state
        this.currentTool = 'select';
        this.currentColor = '#000000';
        this.brushSize = 5;
        this.brushOpacity = 100; // 0-100, opacity for brush tool only
        this.penOpacity = 100; // 0-100, opacity for pen tool only (separate from brush)
        this.brushSmoothing = 50; // 0-100, 0 = no smoothing (pen), 100 = maximum smoothing
        this.shapeStrokeWidth = 2;
        this.shapeOpacity = 100; // 0-100, opacity for shapes
        this.shapeFillEnabled = false;
        this.shapeFillColor = '#000000';
        this.paintBucketColor = '#000000'; // Color for paint bucket tool
        this.customShapeType = 'arrow-pan';
        this.isDrawing = false;
        this.currentShape = null;
        this.startPos = null;
        this.hasUnsavedChanges = false; // Track if canvas has been modified
        
        
        // Text settings
        this.textFont = 'Arial';
        this.textSize = 20;
        this.textColor = '#000000';
        this.textBold = false;
        this.textItalic = false;
        this.textUnderline = false;
        
        // Layers system
        this.layers = [];
        this.currentLayerIndex = 0;
        this.layerCounter = 0;
        
        // Selection
        this.transformer = null;
        this.selectedShape = null;
        this.selectedShapes = []; // For multi-select
        this.selectionMode = 'single'; // 'single' (combined with rectangle), 'lasso'
        this.selectionRect = null; // For rectangle selection
        this.selectionLasso = null; // For lasso selection
        this.lassoPoints = []; // For lasso selection
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Background image info (for preserving during undo)
        this.backgroundImageUrl = null;
        this.backgroundImageWidth = null;
        this.backgroundImageHeight = null;
        
        // Store original aspect ratio for resize handling
        this.originalAspectRatio = width / height;
        this.originalWidth = width;
        this.originalHeight = height;
        
        // Initialize Konva stage
        this.initCanvas();
        this.setupEventListeners();
        this.setupResizeHandler();
        this.setupKonvajsContentObserver();
    }
    
    /**
     * Initialize Konva canvas with layers
     */
    initCanvas() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create Konva stage with clipping
        this.stage = new Konva.Stage({
            container: this.container,
            width: this.width,
            height: this.height
        });
        
        // Add clipping rectangle to prevent drawing outside bounds
        this.clipRect = new Konva.Rect({
            x: 0,
            y: 0,
            width: this.width,
            height: this.height
        });
        
        // Create background layer (white by default)
        const backgroundLayer = new Konva.Layer();
        const backgroundRect = new Konva.Rect({
            x: 0,
            y: 0,
            width: this.width,
            height: this.height,
            fill: '#ffffff',
            name: 'background'
        });
        backgroundLayer.add(backgroundRect);
        this.stage.add(backgroundLayer);
        
        // Create main drawing layer with clipping
        const drawingLayer = new Konva.Layer({
            clipX: 0,
            clipY: 0,
            clipWidth: this.width,
            clipHeight: this.height
        });
        this.stage.add(drawingLayer);
        
        // Create transformer layer for selection handles
        const transformerLayer = new Konva.Layer();
        this.transformer = new Konva.Transformer({
            rotateAnchorOffset: 40,
            enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
            borderStroke: '#007acc',
            anchorFill: '#007acc',
            anchorStroke: '#ffffff',
            anchorSize: 8
        });
        transformerLayer.add(this.transformer);
        this.stage.add(transformerLayer);
        
        // Store layers
        this.layers = [
            { name: 'Background', layer: backgroundLayer, visible: true, locked: false, background: true, filters: [], opacity: 100, blendingMode: 'normal' },
            { name: 'Layer 1', layer: drawingLayer, visible: true, locked: false, background: false, filters: [], opacity: 100, blendingMode: 'normal' }
        ];
        
        // Apply initial opacity to layers
        backgroundLayer.opacity(1);
        drawingLayer.opacity(1);
        this.currentLayerIndex = 1;
        this.layerCounter = 1;
        
        // Setup transformer callbacks
        this.transformer.on('transformend', () => {
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        });
        
        // Keep transformer visible during transform
        this.transformer.on('transformstart', () => {
            // Ensure transformer stays visible
            this.transformer.getLayer().show();
        });
        
        // Prevent transformer from being destroyed
        this.transformer.on('dragstart', () => {
            this.transformer.getLayer().show();
        });
        
        // Save state when transformer finishes transforming
        this.transformer.on('transformend', () => {
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        });
        
        // Save initial state - this will be replaced when setBackgroundImage is called
        // if a background image is provided
        this.saveState();
        
        // Update background display
        this.updateBackgroundDisplay();
        
        // Update canvas container to show paper edges
        this.updateCanvasContainer();
        
        // Trigger layers change callback to ensure UI is updated
        // Call it immediately and also with a delay to ensure DOM is ready
        if (this.onLayersChange) {
            this.onLayersChange();
            setTimeout(() => {
                this.onLayersChange();
            }, 50);
            setTimeout(() => {
                this.onLayersChange();
            }, 200);
        }
    }
    
    /**
     * Get current drawing layer
     */
    getCurrentLayer() {
        return this.layers[this.currentLayerIndex].layer;
    }
    
    /**
     * Setup event listeners for drawing
     */
    setupEventListeners() {
        this.stage.on('mousedown touchstart', (e) => {
            if (this.currentTool === 'select') {
                this.handleSelect(e);
                return;
            }
            
            if (this.currentTool === 'text') {
                // Check if clicking on existing text node
                const pos = this.stage.getPointerPosition();
                if (!pos) {
                    return;
                }
                
                // If clicking on transformer or its handles, don't create new text
                const clickedShape = e.target;
                if (clickedShape === this.transformer || (clickedShape.getParent && clickedShape.getParent() === this.transformer)) {
                    return;
                }
                
                // Use getIntersection to find what's actually at the click position
                const shapeAtPos = this.stage.getIntersection(pos);
                if (shapeAtPos) {
                    // Check if it's a text node - try multiple detection methods
                    let textNode = null;
                    
                    // Method 1: Direct type check
                    if (shapeAtPos.getType && shapeAtPos.getType() === 'Text') {
                        textNode = shapeAtPos;
                    } 
                    // Method 2: Check if it's an instance of Konva.Text
                    else if (shapeAtPos instanceof Konva.Text) {
                        textNode = shapeAtPos;
                    }
                    // Method 3: Check parent nodes
                    else if (shapeAtPos.getParent) {
                        let parent = shapeAtPos.getParent();
                        while (parent && parent !== this.stage) {
                            if ((parent.getType && parent.getType() === 'Text') || (parent instanceof Konva.Text)) {
                                textNode = parent;
                                break;
                            }
                            parent = parent.getParent();
                        }
                    }
                    
                    if (textNode && textNode.getLayer() === this.getCurrentLayer()) {
                        // For single click: just select the text node (double-click will edit)
                        // Don't prevent default - let double-click event fire
                        this.selectShape(textNode);
                        // Don't return here - let the event continue so double-click can work
                        // But also don't create new text on single click
                        return;
                    }
                }
                
                // Check if clicking directly on text node via e.target
                if (clickedShape && clickedShape.getType && clickedShape.getType() === 'Text' && clickedShape.getLayer() === this.getCurrentLayer()) {
                    // For single click: just select the text node (double-click will edit)
                    this.selectShape(clickedShape);
                    return;
                }
                
                // Otherwise start new text input (clicked on empty space or non-text shape)
                this.startTextInput(e);
                return;
            }
            
            if (this.currentTool === 'customShape') {
                this.startCustomShape(e);
                return;
            }
            
            if (this.currentTool === 'curve') {
                this.handleCurveClick(e);
                return;
            }
            
            // Don't draw if clicking on transformer
            if (e.target === this.transformer || e.target.getParent() === this.transformer) {
                return;
            }
            
            // Check if click is within canvas bounds
            const pos = this.stage.getPointerPosition();
            if (!pos || pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.height) {
                return;
            }
            
            this.startDrawing(e);
        });
        
        this.stage.on('mousemove touchmove', (e) => {
            if (this.currentTool === 'select' && this.isDrawing) {
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    if ((this.selectionMode === 'single' || this.selectionMode === 'rectangle') && this.selectionRect) {
                        this.continueRectangleSelection(pos);
                    } else if (this.selectionMode === 'lasso' && this.selectionLasso) {
                        this.continueLassoSelection(pos);
                    }
                }
            } else if (this.isDrawing && this.currentShape) {
                this.continueDrawing(e);
            }
        });
        
        this.stage.on('mouseup touchend mouseleave', () => {
            if (this.currentTool === 'select' && this.isDrawing) {
                if ((this.selectionMode === 'single' || this.selectionMode === 'rectangle') && this.selectionRect) {
                    this.finishRectangleSelection();
                } else if (this.selectionMode === 'lasso' && this.selectionLasso) {
                    this.finishLassoSelection();
                }
            } else if (this.isDrawing) {
                this.finishDrawing();
            }
        });
        
        // Zoom with scroll wheel - scale the container, not the stage
        this.container.addEventListener('wheel', (e) => {
            // Only zoom if not drawing and not using Ctrl/Cmd (which is for browser zoom)
            if (!this.isDrawing && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.95 : 1.05;
                const newZoom = Math.max(0.1, Math.min(5, this.zoomLevel * delta));
                this.setZoom(newZoom);
            }
        }, { passive: false });
        
        // Initialize zoom state
        this.zoomLevel = 1;
        this.stage.scale({ x: 1, y: 1 });
        
        // Keyboard event listeners
        this.setupKeyboardListeners();
    }
    
    /**
     * Setup keyboard event listeners
     */
    setupKeyboardListeners() {
        // Listen for keyboard events on the container
        this.container.addEventListener('keydown', (e) => {
            // Only handle if not typing in an input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Delete/Backspace to delete selected shapes
            if ((e.key === 'Delete' || e.key === 'Backspace') && (this.selectedShape || this.selectedShapes.length > 0)) {
                e.preventDefault();
                this.deleteSelectedShapes();
            }
        });
        
        // Make container focusable for keyboard events
        this.container.setAttribute('tabindex', '0');
        this.container.style.outline = 'none';
    }
    
    /**
     * Delete selected shapes
     */
    deleteSelectedShapes() {
        const shapesToDelete = this.selectedShapes.length > 0 ? [...this.selectedShapes] : (this.selectedShape ? [this.selectedShape] : []);
        
        if (shapesToDelete.length === 0) return;
        
        shapesToDelete.forEach(shape => {
            shape.destroy();
        });
        
        // Clear selection
        this.selectedShape = null;
        this.selectedShapes = [];
        this.transformer.nodes([]);
        
        // Update all layers
        this.layers.forEach(layerData => {
            layerData.layer.draw();
        });
        
        // Save state
        this.hasUnsavedChanges = true;
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
        if (this.onSelectionChange) {
            this.onSelectionChange(null);
        }
    }
    
    /**
     * Handle select tool
     */
    handleSelect(e) {
        // Don't select if clicking on transformer handles
        if (e.target === this.transformer || e.target.getParent() === this.transformer) {
            return;
        }
        
        const clickedOnEmpty = e.target === this.stage || e.target.name() === 'background';
        
        if (this.selectionMode === 'single' || this.selectionMode === 'rectangle') {
            // Combined single and rectangle selection
            if (clickedOnEmpty) {
                // Start rectangle selection on empty space
                if (!this.isDrawing) {
                    const pos = this.stage.getPointerPosition();
                    if (pos) {
                        this.startRectangleSelection(pos);
                    }
                }
            } else {
                // Select clicked shape - only from current layer
                const shape = e.target;
                const shapeLayer = shape.getLayer();
                
                // Check if shape is actually in the current layer by checking layer membership
                const currentLayer = this.getCurrentLayer();
                const isInCurrentLayer = shapeLayer === currentLayer;
                
                // Don't select background, transformer layer, or shapes from other layers
                const isValidTarget = shape.name() !== 'background' && 
                                      shapeLayer !== this.transformer.getLayer() &&
                                      isInCurrentLayer;
                
                if (isValidTarget) {
                    this.selectShape(shape);
                } else if (!isInCurrentLayer) {
                    // Clicked on shape from different layer - deselect
                    this.transformer.nodes([]);
                    this.selectedShape = null;
                    this.selectedShapes = [];
                    if (this.onSelectionChange) {
                        this.onSelectionChange(null);
                    }
                }
            }
        } else if (this.selectionMode === 'lasso') {
            // Start lasso selection
            if (clickedOnEmpty && !this.isDrawing) {
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    this.startLassoSelection(pos);
                }
            }
        }
    }
    
    /**
     * Select a shape and show transformer
     */
    selectShape(shape) {
        this.selectedShape = shape;
        this.selectedShapes = shape ? [shape] : [];
        
        // Update transform controls to reflect current shape values (don't reset)
        const skewXSlider = document.getElementById('drawingSkewX');
        const skewYSlider = document.getElementById('drawingSkewY');
        const skewXValue = document.getElementById('drawingSkewXValue');
        const skewYValue = document.getElementById('drawingSkewYValue');
        
        if (shape) {
            const currentSkewX = shape.skewX() || 0;
            const currentSkewY = shape.skewY() || 0;
            
            if (skewXSlider) {
                skewXSlider.value = currentSkewX;
                if (skewXValue) skewXValue.textContent = currentSkewX.toFixed(1);
            }
            if (skewYSlider) {
                skewYSlider.value = currentSkewY;
                if (skewYValue) skewYValue.textContent = currentSkewY.toFixed(1);
            }
        } else {
            // No shape selected - reset sliders
            if (skewXSlider) {
                skewXSlider.value = 0;
                if (skewXValue) skewXValue.textContent = '0';
            }
            if (skewYSlider) {
                skewYSlider.value = 0;
                if (skewYValue) skewYValue.textContent = '0';
            }
        }
        
        // Don't reset skew on the shape - preserve existing transforms
        
        // Clear transformer first to avoid conflicts
        this.transformer.nodes([]);
        
        // Update draggable state - only selected shapes should be draggable
        this.updateDraggableState();
        
        // Add dragend handler to save state when shape is moved
        if (shape) {
            shape.off('dragend'); // Remove any existing handler
            shape.on('dragend', () => {
                this.saveState();
                if (this.onHistoryChange) {
                    this.onHistoryChange();
                }
            });
        }
        
        // Small delay to ensure transformer is ready
        setTimeout(() => {
            this.transformer.nodes(shape ? [shape] : []);
            this.transformer.getLayer().batchDraw();
        }, 10);
        
        if (this.onSelectionChange) {
            this.onSelectionChange(shape);
        }
    }
    
    /**
     * Select multiple shapes
     */
    selectShapes(shapes) {
        this.selectedShapes = shapes.filter(s => s && s.name() !== 'background');
        this.selectedShape = this.selectedShapes.length === 1 ? this.selectedShapes[0] : null;
        
        // Clear transformer first
        this.transformer.nodes([]);
        
        // Update draggable state - only selected shapes should be draggable
        this.updateDraggableState();
        
        // Add dragend handlers to save state when shapes are moved
        this.selectedShapes.forEach(shape => {
            shape.off('dragend'); // Remove any existing handler
            shape.on('dragend', () => {
                this.hasUnsavedChanges = true;
                this.saveState();
                if (this.onHistoryChange) {
                    this.onHistoryChange();
                }
            });
        });
        
        // Small delay to ensure transformer is ready
        setTimeout(() => {
            this.transformer.nodes(this.selectedShapes);
            this.transformer.getLayer().batchDraw();
        }, 10);
        
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selectedShapes.length === 1 ? this.selectedShapes[0] : null);
        }
    }
    
    /**
     * Update draggable state for all shapes - only selected shapes should be draggable
     */
    updateDraggableState() {
        const selectedShapes = this.selectedShapes.length > 0 ? this.selectedShapes : (this.selectedShape ? [this.selectedShape] : []);
        const selectedShapeIds = new Set(selectedShapes.map(s => s._id || s.id()));
        
        this.layers.forEach((layerData, index) => {
            if (index > 0 || !layerData.background) { // Skip background layer
                layerData.layer.find('Shape').forEach(shape => {
                    if (shape.name() !== 'background') {
                        const isSelected = selectedShapeIds.has(shape._id || shape.id());
                        shape.draggable(this.currentTool === 'select' && isSelected);
                    }
                });
                // Also handle Groups and Text nodes
                layerData.layer.find('Group').forEach(group => {
                    const isSelected = selectedShapeIds.has(group._id || group.id());
                    group.draggable(this.currentTool === 'select' && isSelected);
                });
                layerData.layer.find('Text').forEach(text => {
                    const isSelected = selectedShapeIds.has(text._id || text.id());
                    text.draggable(this.currentTool === 'select' && isSelected);
                });
            }
        });
    }
    
    /**
     * Set selection mode
     */
    setSelectionMode(mode) {
        this.selectionMode = mode;
        // Clear any active selection rectangles or lassos
        if (this.selectionRect) {
            this.selectionRect.destroy();
            this.selectionRect = null;
        }
        if (this.selectionLasso) {
            this.selectionLasso.destroy();
            this.selectionLasso = null;
        }
        this.lassoPoints = [];
        this.isDrawing = false;
    }
    
    /**
     * Start rectangle selection
     */
    startRectangleSelection(pos) {
        this.isDrawing = true;
        this.startPos = pos;
        const layer = this.transformer.getLayer();
        
        this.selectionRect = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: '#007acc',
            strokeWidth: 2,
            fill: 'rgba(0, 122, 204, 0.1)',
            dash: [5, 5],
            name: 'selectionRect'
        });
        layer.add(this.selectionRect);
        layer.draw();
    }
    
    /**
     * Continue rectangle selection
     */
    continueRectangleSelection(pos) {
        if (!this.selectionRect || !this.startPos) return;
        
        const width = pos.x - this.startPos.x;
        const height = pos.y - this.startPos.y;
        this.selectionRect.setAttrs({
            x: Math.min(this.startPos.x, pos.x),
            y: Math.min(this.startPos.y, pos.y),
            width: Math.abs(width),
            height: Math.abs(height)
        });
        this.selectionRect.getLayer().draw();
    }
    
    /**
     * Finish rectangle selection
     */
    finishRectangleSelection() {
        if (!this.selectionRect || !this.startPos) {
            this.isDrawing = false;
            return;
        }
        
        const rect = this.selectionRect;
        const rectX = rect.x();
        const rectY = rect.y();
        const rectWidth = rect.width();
        const rectHeight = rect.height();
        
        // Find all shapes in the current layer that intersect with the rectangle
        const currentLayer = this.getCurrentLayer();
        const selectedShapes = [];
        
        currentLayer.find('Shape').forEach(shape => {
            if (shape.name() === 'background' || shape.name() === 'selectionRect' || shape.name() === 'selectionLasso') {
                return;
            }
            
            const box = shape.getClientRect();
            // Check if shape intersects with selection rectangle
            if (box.x < rectX + rectWidth &&
                box.x + box.width > rectX &&
                box.y < rectY + rectHeight &&
                box.y + box.height > rectY) {
                selectedShapes.push(shape);
            }
        });
        
        // Remove selection rectangle
        rect.destroy();
        this.selectionRect = null;
        this.isDrawing = false;
        
        // Select found shapes
        if (selectedShapes.length > 0) {
            this.selectShapes(selectedShapes);
        } else {
            this.transformer.nodes([]);
            this.selectedShapes = [];
            this.selectedShape = null;
        }
    }
    
    /**
     * Start lasso selection
     */
    startLassoSelection(pos) {
        this.isDrawing = true;
        this.startPos = pos;
        this.lassoPoints = [pos.x, pos.y];
        const layer = this.transformer.getLayer();
        
        this.selectionLasso = new Konva.Line({
            points: this.lassoPoints,
            stroke: '#007acc',
            strokeWidth: 2,
            fill: 'rgba(0, 122, 204, 0.1)',
            closed: true,
            dash: [5, 5],
            name: 'selectionLasso'
        });
        layer.add(this.selectionLasso);
        layer.draw();
    }
    
    /**
     * Continue lasso selection
     */
    continueLassoSelection(pos) {
        if (!this.selectionLasso) return;
        
        this.lassoPoints.push(pos.x, pos.y);
        this.selectionLasso.points(this.lassoPoints);
        this.selectionLasso.getLayer().draw();
    }
    
    /**
     * Finish lasso selection
     */
    finishLassoSelection() {
        if (!this.selectionLasso || this.lassoPoints.length < 6) {
            if (this.selectionLasso) {
                this.selectionLasso.destroy();
                this.selectionLasso = null;
            }
            this.lassoPoints = [];
            this.isDrawing = false;
            return;
        }
        
        // Close the lasso path
        if (this.lassoPoints.length >= 6) {
            this.lassoPoints.push(this.lassoPoints[0], this.lassoPoints[1]);
        }
        
        // Find all shapes in the current layer that are inside the lasso path
        const currentLayer = this.getCurrentLayer();
        const selectedShapes = [];
        
        // Simple point-in-polygon check for shape centers
        const isPointInPolygon = (x, y, points) => {
            let inside = false;
            for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
                const xi = points[i], yi = points[i + 1];
                const xj = points[j], yj = points[j + 1];
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };
        
        currentLayer.find('Shape').forEach(shape => {
            if (shape.name() === 'background' || shape.name() === 'selectionRect' || shape.name() === 'selectionLasso') {
                return;
            }
            
            const box = shape.getClientRect();
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            
            // Check if shape center is inside lasso path
            if (isPointInPolygon(centerX, centerY, this.lassoPoints)) {
                selectedShapes.push(shape);
            }
        });
        
        // Remove selection lasso
        this.selectionLasso.destroy();
        this.selectionLasso = null;
        this.lassoPoints = [];
        this.isDrawing = false;
        
        // Select found shapes
        if (selectedShapes.length > 0) {
            this.selectShapes(selectedShapes);
        } else {
            this.transformer.nodes([]);
            this.selectedShapes = [];
            this.selectedShape = null;
        }
    }
    
    /**
     * Start drawing
     */
    startDrawing(e) {
        if (this.currentTool === 'eraser') {
            this.startErasing(e);
            return;
        }
        
        this.isDrawing = true;
        const pos = this.stage.getPointerPosition();
        this.startPos = pos;
        const layer = this.getCurrentLayer();
        
        // Hide transformer while drawing
        this.transformer.nodes([]);
        
        if (this.currentTool === 'brush' || this.currentTool === 'pen') {
            // For brush/pen, store raw points for smoothing
            this.rawPoints = [pos.x, pos.y];
            
            // Brush uses smoothing value, pen uses 0
            const smoothing = 0; // Will be handled by smoothPoints function for brush
            
            // Use correct opacity based on tool
            const opacity = this.currentTool === 'pen' ? this.penOpacity : this.brushOpacity;
            
            // Read color fresh to ensure latest value is used (not cached)
            const strokeColor = this.currentColor;
            
            this.currentShape = new Konva.Line({
                points: [pos.x, pos.y],
                stroke: strokeColor,
                strokeWidth: this.brushSize,
                lineCap: 'round',
                lineJoin: 'round',
                globalCompositeOperation: 'source-over',
                tension: smoothing,
                opacity: opacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'rectangle') {
            const fill = this.shapeFillEnabled ? this.shapeFillColor : null;
            this.currentShape = new Konva.Rect({
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                fill: fill,
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'circle') {
            const fill = this.shapeFillEnabled ? this.shapeFillColor : null;
            this.currentShape = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: 0,
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                fill: fill,
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'ellipse') {
            const fill = this.shapeFillEnabled ? this.shapeFillColor : null;
            this.currentShape = new Konva.Ellipse({
                x: pos.x,
                y: pos.y,
                radiusX: 0,
                radiusY: 0,
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                fill: fill,
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'triangle') {
            const fill = this.shapeFillEnabled ? this.shapeFillColor : null;
            this.currentShape = new Konva.Line({
                points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                fill: fill,
                closed: true,
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'polygon') {
            const fill = this.shapeFillEnabled ? this.shapeFillColor : null;
            // Create a 5-point polygon
            this.currentShape = new Konva.Line({
                points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                fill: fill,
                closed: true,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'line') {
            this.currentShape = new Konva.Line({
                points: [pos.x, pos.y, pos.x, pos.y],
                stroke: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                lineCap: 'round',
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'arrow') {
            this.currentShape = new Konva.Arrow({
                points: [pos.x, pos.y, pos.x, pos.y],
                stroke: this.currentColor,
                fill: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                pointerLength: 15,
                pointerWidth: 15,
                opacity: this.shapeOpacity / 100,
                draggable: false
            });
            layer.add(this.currentShape);
        } else if (this.currentTool === 'crop') {
            // Crop tool - draw a rectangle to define crop area
            this.currentShape = new Konva.Rect({
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                stroke: '#007acc',
                strokeWidth: 2,
                fill: 'rgba(0, 122, 204, 0.1)',
                dash: [5, 5],
                draggable: false,
                name: 'cropRect'
            });
            // Add to a special crop layer or main layer
            layer.add(this.currentShape);
        } else if (this.currentTool === 'paintBucket') {
            // Paint bucket tool - flood fill
            this.startPaintBucket(pos);
            return;
        } else if (this.currentTool === 'customShape') {
            // Custom shapes are handled in startCustomShape
            return;
        }
    }
    
    /**
     * Start paint bucket fill
     */
    startPaintBucket(pos) {
        const layer = this.getCurrentLayer();
        
        // Get the pixel color at the click position from the stage
        const imageData = this.stage.toDataURL({ 
            x: Math.floor(pos.x), 
            y: Math.floor(pos.y), 
            width: 1, 
            height: 1 
        });
        
        // Create a temporary canvas to get the pixel color
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            tempCtx.drawImage(img, 0, 0);
            const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
            const targetColor = {
                r: pixelData[0],
                g: pixelData[1],
                b: pixelData[2],
                a: pixelData[3]
            };
            
            // Check if we clicked inside a closed shape
            const clickedShape = this.findShapeAtPosition(pos, layer);
            
            if (clickedShape && this.isClosedShape(clickedShape)) {
                // Fill the closed shape
                this.fillClosedShape(clickedShape);
            } else {
                // Perform flood fill
                this.performFloodFill(pos, targetColor);
            }
            
            this.hasUnsavedChanges = true;
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        };
        img.src = imageData;
    }
    
    /**
     * Find shape at position
     */
    findShapeAtPosition(pos, layer) {
        const shapes = layer.find('Shape').concat(layer.find('Group'));
        for (let shape of shapes) {
            if (shape.name() === 'background') continue;
            
            // Check if point is inside shape
            const box = shape.getClientRect();
            if (pos.x >= box.x && pos.x <= box.x + box.width &&
                pos.y >= box.y && pos.y <= box.y + box.height) {
                return shape;
            }
        }
        return null;
    }
    
    /**
     * Check if shape is closed (can be filled)
     */
    isClosedShape(shape) {
        if (shape instanceof Konva.Rect || 
            shape instanceof Konva.Circle || 
            shape instanceof Konva.Ellipse) {
            return true;
        }
        if (shape instanceof Konva.Line) {
            return shape.closed();
        }
        if (shape instanceof Konva.Group) {
            // Check if group contains closed shapes
            return shape.find('Rect').length > 0 || 
                   shape.find('Circle').length > 0 ||
                   shape.find('Ellipse').length > 0;
        }
        return false;
    }
    
    /**
     * Fill a closed shape
     */
    fillClosedShape(shape) {
        if (shape instanceof Konva.Rect || 
            shape instanceof Konva.Circle || 
            shape instanceof Konva.Ellipse) {
            shape.fill(this.paintBucketColor);
            shape.opacity(this.shapeOpacity / 100);
        } else if (shape instanceof Konva.Line && shape.closed()) {
            shape.fill(this.paintBucketColor);
            shape.opacity(this.shapeOpacity / 100);
        } else if (shape instanceof Konva.Group) {
            shape.find('Shape').forEach(s => {
                if (s.fill) {
                    s.fill(this.paintBucketColor);
                    s.opacity(this.shapeOpacity / 100);
                }
            });
        }
        this.getCurrentLayer().draw();
    }
    
    /**
     * Perform flood fill algorithm
     */
    performFloodFill(startPos, targetColor) {
        // Create a temporary canvas for flood fill
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw current stage to temp canvas
        const stageDataURL = this.stage.toDataURL();
        const img = new Image();
        img.onload = () => {
            tempCtx.drawImage(img, 0, 0);
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, this.width, this.height);
            const data = imageData.data;
            
            // Convert target color to RGBA
            const targetR = targetColor.r;
            const targetG = targetColor.g;
            const targetB = targetColor.b;
            const targetA = targetColor.a;
            
            // Convert fill color to RGBA
            const fillColor = this.hexToRgb(this.paintBucketColor);
            const fillR = fillColor.r;
            const fillG = fillColor.g;
            const fillB = fillColor.b;
            const fillA = Math.floor(this.shapeOpacity / 100 * 255);
            
            // Flood fill algorithm
            const stack = [{ x: Math.floor(startPos.x), y: Math.floor(startPos.y) }];
            const visited = new Set();
            
            while (stack.length > 0) {
                const { x, y } = stack.pop();
                const key = `${x},${y}`;
                
                if (visited.has(key)) continue;
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                
                const index = (y * this.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];
                
                // Check if pixel matches target color (with tolerance)
                const tolerance = 10;
                if (Math.abs(r - targetR) <= tolerance &&
                    Math.abs(g - targetG) <= tolerance &&
                    Math.abs(b - targetB) <= tolerance &&
                    Math.abs(a - targetA) <= tolerance) {
                    
                    // Fill pixel
                    data[index] = fillR;
                    data[index + 1] = fillG;
                    data[index + 2] = fillB;
                    data[index + 3] = fillA;
                    
                    visited.add(key);
                    
                    // Add neighbors
                    stack.push({ x: x + 1, y });
                    stack.push({ x: x - 1, y });
                    stack.push({ x, y: y + 1 });
                    stack.push({ x, y: y - 1 });
                }
            }
            
            // Put image data back
            tempCtx.putImageData(imageData, 0, 0);
            
            // Create Konva image from filled canvas
            const filledImage = new Image();
            filledImage.onload = () => {
                const konvaImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: filledImage,
                    width: this.width,
                    height: this.height,
                    opacity: this.shapeOpacity / 100
                });
                
                this.getCurrentLayer().add(konvaImage);
                this.getCurrentLayer().draw();
            };
            filledImage.src = tempCanvas.toDataURL();
        };
        img.src = stageDataURL;
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
        } : { r: 0, g: 0, b: 0 };
    }
    
    /**
     * Continue drawing
     */
    continueDrawing(e) {
        if (!this.isDrawing || !this.currentShape || !this.startPos) return;
        
        e.evt.preventDefault();
        const pos = this.stage.getPointerPosition();
        
        if (this.currentTool === 'brush' || this.currentTool === 'pen' || this.currentTool === 'eraser') {
            // Store raw point
            if (!this.rawPoints) {
                this.rawPoints = [];
            }
            this.rawPoints.push(pos.x, pos.y);
            
            // Apply smoothing for brush tool
            if (this.currentTool === 'brush' && this.brushSmoothing > 0) {
                // Apply advanced smoothing for brush tool
                const smoothedPoints = this.smoothPoints(this.rawPoints, this.brushSmoothing);
                this.currentShape.points(smoothedPoints);
            } else {
                // For pen or no smoothing, use raw points
                this.currentShape.points(this.rawPoints);
            }
        } else if (this.currentTool === 'rectangle') {
            const width = pos.x - this.startPos.x;
            const height = pos.y - this.startPos.y;
            this.currentShape.setAttrs({
                x: Math.min(this.startPos.x, pos.x),
                y: Math.min(this.startPos.y, pos.y),
                width: Math.abs(width),
                height: Math.abs(height)
            });
        } else if (this.currentTool === 'circle') {
            const radius = Math.sqrt(
                Math.pow(pos.x - this.startPos.x, 2) + 
                Math.pow(pos.y - this.startPos.y, 2)
            );
            this.currentShape.radius(radius);
        } else if (this.currentTool === 'ellipse') {
            const radiusX = Math.abs(pos.x - this.startPos.x);
            const radiusY = Math.abs(pos.y - this.startPos.y);
            this.currentShape.setAttrs({
                radiusX: radiusX,
                radiusY: radiusY
            });
        } else if (this.currentTool === 'triangle') {
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;
            // Create equilateral triangle
            const height = Math.abs(dy);
            const width = Math.abs(dx) || height;
            const points = [
                this.startPos.x, this.startPos.y + height, // bottom left
                this.startPos.x + width / 2, this.startPos.y, // top center
                this.startPos.x + width, this.startPos.y + height // bottom right
            ];
            this.currentShape.points(points);
        } else if (this.currentTool === 'polygon') {
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            const sides = 5;
            const points = [];
            for (let i = 0; i < sides; i++) {
                const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
                const x = this.startPos.x + radius * Math.cos(angle);
                const y = this.startPos.y + radius * Math.sin(angle);
                points.push(x, y);
            }
            this.currentShape.points(points);
        } else if (this.currentTool === 'line') {
            this.currentShape.points([this.startPos.x, this.startPos.y, pos.x, pos.y]);
        } else if (this.currentTool === 'arrow') {
            this.currentShape.points([this.startPos.x, this.startPos.y, pos.x, pos.y]);
        } else if (this.currentTool === 'crop') {
            // Update crop rectangle
            const width = pos.x - this.startPos.x;
            const height = pos.y - this.startPos.y;
            this.currentShape.setAttrs({
                x: Math.min(this.startPos.x, pos.x),
                y: Math.min(this.startPos.y, pos.y),
                width: Math.abs(width),
                height: Math.abs(height),
                name: 'cropRect'
            });
        } else if (this.currentTool === 'customShape') {
            // Update custom shape by recreating it with new end position
            if (this.currentShape && this.startPos) {
                const layer = this.getCurrentLayer();
                // Destroy the current shape (could be a Group or single shape)
                if (this.currentShape.destroy) {
                    this.currentShape.destroy();
                }
                // Create new shape with updated end position
                // Use a minimum distance to ensure shape is created
                const dx = pos.x - this.startPos.x;
                const dy = pos.y - this.startPos.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // If length is too small, use a minimum end position
                let endX = pos.x;
                let endY = pos.y;
                if (length < 5) {
                    // Ensure minimum 5px distance
                    endX = this.startPos.x + Math.cos(angle) * 5;
                    endY = this.startPos.y + Math.sin(angle) * 5;
                }
                
                const newShape = this.createCustomArrowShape(this.customShapeType, this.startPos.x, this.startPos.y, endX, endY);
                if (newShape) {
                    this.currentShape = newShape;
                    layer.add(newShape);
                } else {
                    // Fallback: create a simple arrow if shape creation failed
                    this.currentShape = new Konva.Arrow({
                        x: this.startPos.x,
                        y: this.startPos.y,
                        points: [0, 0, Math.max(5, length), 0],
                        stroke: this.currentColor,
                        fill: this.currentColor,
                        strokeWidth: this.shapeStrokeWidth,
                        pointerLength: 10,
                        pointerWidth: 10,
                        draggable: false
                    });
                    this.currentShape.rotation(angle * 180 / Math.PI);
                    layer.add(this.currentShape);
                }
            }
        }
        
        this.getCurrentLayer().batchDraw();
    }
    
    /**
     * Finish drawing
     */
    finishDrawing() {
        if (!this.isDrawing) return;
        
        
        this.isDrawing = false;
        
        if (this.currentShape) {
            // Handle crop tool
            if (this.currentTool === 'crop') {
                const rect = this.currentShape;
                const cropX = Math.max(0, Math.min(rect.x(), this.width));
                const cropY = Math.max(0, Math.min(rect.y(), this.height));
                const cropWidth = Math.max(10, Math.min(rect.width(), this.width - cropX));
                const cropHeight = Math.max(10, Math.min(rect.height(), this.height - cropY));
                
                // Save state before cropping (for undo)
                this.saveState();
                
                // Remove crop rectangle
                rect.destroy();
                
                // Perform crop
                this.crop(cropX, cropY, cropWidth, cropHeight);
                
                this.currentShape = null;
                this.startPos = null;
                return;
            }
            
            // Make shape selectable only in select mode
            // Don't set draggable here - it will be set by updateDraggableState when selected
            this.currentShape.draggable(false);
            
            // Rasterize brush/pen lines only (not shapes) for better performance
            // Shapes should remain as vectors for better transform quality
            if (this.currentShape && (this.currentTool === 'brush' || this.currentTool === 'pen')) {
                const currentLayer = this.getCurrentLayer();
                const shapeToRasterize = this.currentShape;
                setTimeout(() => {
                    this.rasterizeShape(shapeToRasterize, currentLayer);
                }, 100);
            }
            
            // Clear raw points and curve points
            this.rawPoints = null;
            this.curvePoints = null;
            this.curveHandles = null;
            
            // Mark as having unsaved changes
            this.hasUnsavedChanges = true;
            
            // Save state for undo/redo
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
            
            // Update layers UI
            if (this.onLayersChange) {
                this.onLayersChange();
            }
            
        }
        
        this.currentShape = null;
        this.startPos = null;
    }
    
    /**
     * Create custom arrow shape based on type
     */
    createCustomArrowShape(arrowType, startX, startY, endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Allow shapes to be created even with small length (minimum 5px)
        // This allows dragging to resize custom shapes
        if (length < 5) {
            return null;
        }
        
        // Helper function to transform points to match start/end coordinates
        const transformPoints = (points, expectedLength = 120) => {
            if (points.length < 4) return points;
            
            const firstX = points[0];
            const firstY = points[1];
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            
            const exampleDx = lastX - firstX;
            const exampleDy = lastY - firstY;
            const exampleLength = Math.sqrt(exampleDx * exampleDx + exampleDy * exampleDy);
            
            if (exampleLength === 0) return points;
            
            const scale = length / exampleLength;
            const exampleAngle = Math.atan2(exampleDy, exampleDx);
            const actualAngle = angle;
            const rotation = actualAngle - exampleAngle;
            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);
            
            const transformed = [];
            for (let i = 0; i < points.length; i += 2) {
                const relX = (points[i] - firstX) * scale;
                const relY = (points[i + 1] - firstY) * scale;
                const rotX = relX * cosR - relY * sinR;
                const rotY = relX * sinR + relY * cosR;
                transformed.push(startX + rotX, startY + rotY);
            }
            return transformed;
        };
        
        let arrowShape = null;
        let arrowGroup = null;
        
        // Use fill color if enabled, otherwise use stroke color
        const fillColor = this.shapeFillEnabled ? this.shapeFillColor : this.currentColor;
        const strokeColor = this.currentColor;
        const strokeWidth = this.shapeStrokeWidth;
        
        switch (arrowType) {
            case 'arrow-roll':
                // 3. CAMERA ROLL - Origin: Center of the spiral (0,0)
                const rollScale = length / 100;
                arrowGroup = new Konva.Group({ x: startX, y: startY, draggable: false });
                const rollPath = new Konva.Path({
                    data: 'M-50,0 C-30,-30 -10,-30 0,0 C10,30 30,30 50,0',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    lineCap: 'round'
                });
                const rollHead = new Konva.Arrow({
                    points: [50, 0, 60, -10],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.scaleX(rollScale);
                arrowGroup.scaleY(rollScale);
                arrowGroup.add(rollPath, rollHead);
                break;
            case 'arrow-zoom-in':
                // 4. ZOOM IN - Origin: Top-Left corner of the start box
                const zoomInScale = length / 120;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: 'M0,0 L0,60 L70,45 L70,60 L120,30 L70,0 L70,15 Z',
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false,
                    shadowColor: 'black',
                    shadowBlur: 2,
                    shadowOpacity: 0.2
                });
                arrowShape.scaleX(zoomInScale);
                arrowShape.scaleY(zoomInScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-zoom-out':
                // 5. ZOOM OUT - Origin: Top-Left of the small start
                const zoomOutScale = length / 130;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: 'M0,20 L0,30 L80,55 L80,75 L130,25 L80,-25 L80,-5 Z',
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false,
                    shadowColor: 'black',
                    shadowBlur: 2,
                    shadowOpacity: 0.2
                });
                arrowShape.scaleX(zoomOutScale);
                arrowShape.scaleY(zoomOutScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-u-turn':
                // 10. BLOCK U-TURN - Origin: Top-Left of the entrance
                const uTurnScale = length / 130;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: 'M0,0 L80,0 C110,0 110,60 80,60 L60,60 L60,40 L20,70 L60,100 L60,80 L80,80 C130,80 130,-20 80,-20 L0,-20 Z',
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.scaleX(uTurnScale);
                arrowShape.scaleY(uTurnScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-split':
                // 11. SPLIT PATH - Origin: Start of the stem
                const splitScale = length / 120;
                arrowGroup = new Konva.Group({ x: startX, y: startY, draggable: false });
                const stem = new Konva.Rect({
                    width: 60 * splitScale,
                    height: 20 * splitScale,
                    fill: fillColor,
                    x: 0,
                    y: -10 * splitScale
                });
                const branch1 = new Konva.Arrow({
                    points: [50 * splitScale, 0, 120 * splitScale, -50 * splitScale],
                    pointerLength: 15 * splitScale,
                    pointerWidth: 15 * splitScale,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth * 1.2
                });
                const branch2 = new Konva.Arrow({
                    points: [50 * splitScale, 0, 120 * splitScale, 50 * splitScale],
                    pointerLength: 15 * splitScale,
                    pointerWidth: 15 * splitScale,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth * 1.2
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.add(branch1, branch2, stem);
                break;
            case 'arrow-whip':
                // 12. WHIP PAN - Origin: Start of the lines
                const whipScale = length / 140;
                arrowGroup = new Konva.Group({ x: startX, y: startY, draggable: false });
                const whipMain = new Konva.Arrow({
                    points: [20 * whipScale, 0, 140 * whipScale, 0],
                    pointerLength: 15 * whipScale,
                    pointerWidth: 15 * whipScale,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                });
                const line1 = new Konva.Line({
                    points: [0, -20 * whipScale, 80 * whipScale, -20 * whipScale],
                    stroke: strokeColor,
                    strokeWidth: strokeWidth * 0.4
                });
                const line2 = new Konva.Line({
                    points: [10 * whipScale, 20 * whipScale, 90 * whipScale, 20 * whipScale],
                    stroke: strokeColor,
                    strokeWidth: strokeWidth * 0.4
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.add(whipMain, line1, line2);
                break;
            case 'arrow-dotted':
                // 16. STRAIGHT DOTTED
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    dash: [12, 8],
                    draggable: false
                });
                break;
            case 'arrow-double':
                // 17. DOUBLE HEADED
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    pointerAtBeginning: true,
                    draggable: false
                });
                break;
            case 'arrow-thin-zoom':
                // 20. THIN PERSPECTIVE ZOOM - Origin: Top-Left of tail
                const thinZoomScale = length / 140;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: 'M0,0 L0,20 L100,15 L100,30 L140,10 L100,-10 L100,5 Z',
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false,
                    shadowColor: 'black',
                    shadowBlur: 2,
                    shadowOpacity: 0.2
                });
                arrowShape.scaleX(thinZoomScale);
                arrowShape.scaleY(thinZoomScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-01':
                // Custom arrow 01 from SVG file
                // Path data extracted from arrow_01.svg: M 0 0 L 65.7050018311 0 L 65.7050018311 -8.5979995728 L 86.8809967041 12.5769996643 L 65.7050018311 33.7560005188 L 65.7050018311 25.158000946 L 0 25.158000946
                const arrow01PathData = 'M 0 0 L 65.7050018311 0 L 65.7050018311 -8.5979995728 L 86.8809967041 12.5769996643 L 65.7050018311 33.7560005188 L 65.7050018311 25.158000946 L 0 25.158000946 Z';
                
                // Calculate dimensions: path starts at (0,0) and extends to right
                const arrow01Width = 86.8809967041; // Rightmost X coordinate
                const arrow01MinY = -8.5979995728;
                const arrow01MaxY = 33.7560005188;
                const arrow01CenterY = (arrow01MinY + arrow01MaxY) / 2; // Vertical center
                
                // Scale based on desired length vs original width
                const arrow01Scale = length / arrow01Width;
                
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow01PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                
                // Set pivot point to far left (x=0 in path coordinates) and vertical center
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow01CenterY);
                
                // Scale and rotate
                arrowShape.scaleX(arrow01Scale);
                arrowShape.scaleY(arrow01Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
                
            case 'arrow-custom-02':
                // Custom arrow 02 from SVG file - extract path from clipPath and use directly like arrow_01
                // Path data from clipPath in arrow_02.svg: M 221.1380004883 874.1599731445 L 229.7350006104 874.1599731445 L 219.7350006104 835.4559936523 L 264.8930053711 835.4559936523 L 254.8930053711 874.1599731445 L 263.4909973145 874.1599731445 L 242.3150024414 889.3359985352
                // Normalize path: find leftmost point and subtract from all x coordinates
                const arrow02OriginalPath = 'M 221.1380004883 874.1599731445 L 229.7350006104 874.1599731445 L 219.7350006104 835.4559936523 L 264.8930053711 835.4559936523 L 254.8930053711 874.1599731445 L 263.4909973145 874.1599731445 L 242.3150024414 889.3359985352';
                
                // Parse path to find min X and normalize
                const pathPoints = [
                    {x: 221.1380004883, y: 874.1599731445},
                    {x: 229.7350006104, y: 874.1599731445},
                    {x: 219.7350006104, y: 835.4559936523},
                    {x: 264.8930053711, y: 835.4559936523},
                    {x: 254.8930053711, y: 874.1599731445},
                    {x: 263.4909973145, y: 874.1599731445},
                    {x: 242.3150024414, y: 889.3359985352}
                ];
                
                // Find min X and min/max Y
                const minX = Math.min(...pathPoints.map(p => p.x));
                const minY = Math.min(...pathPoints.map(p => p.y));
                const maxY = Math.max(...pathPoints.map(p => p.y));
                
                // Normalize path: subtract minX from all x coordinates, subtract minY from all y coordinates
                const normalizedPoints = pathPoints.map(p => ({
                    x: p.x - minX,
                    y: p.y - minY
                }));
                
                // Build normalized path string
                const arrow02PathData = `M ${normalizedPoints[0].x} ${normalizedPoints[0].y} L ${normalizedPoints[1].x} ${normalizedPoints[1].y} L ${normalizedPoints[2].x} ${normalizedPoints[2].y} L ${normalizedPoints[3].x} ${normalizedPoints[3].y} L ${normalizedPoints[4].x} ${normalizedPoints[4].y} L ${normalizedPoints[5].x} ${normalizedPoints[5].y} L ${normalizedPoints[6].x} ${normalizedPoints[6].y} Z`;
                
                // Calculate dimensions: path now starts at x=0 (normalized)
                const arrow02Width = Math.max(...normalizedPoints.map(p => p.x)); // Rightmost X coordinate
                // Calculate center Y from normalized points (same approach as arrow_01)
                const arrow02MinY = Math.min(...normalizedPoints.map(p => p.y)); // Should be 0 after normalization
                const arrow02MaxY = Math.max(...normalizedPoints.map(p => p.y)); // Max Y in normalized coordinates
                const arrow02CenterY = (arrow02MinY + arrow02MaxY) / 2; // Vertical center (normalized)
                
                // Scale based on desired length vs original width
                const arrow02Scale = length / arrow02Width;
                
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow02PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                
                // Set pivot point to far left (x=0 in path coordinates) and vertical center
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow02CenterY);
                
                // Scale and rotate
                arrowShape.scaleX(arrow02Scale);
                arrowShape.scaleY(arrow02Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-03':
                // Custom arrow 03 - same shape as arrow_02 (double arrow)
                const arrow03OriginalPath = 'M 343.1220092773 839.9459838867 L 351.7200012207 839.9459838867 L 351.7200012207 838.2940063477 L 351.7200012207 801.241027832 L 351.7200012207 799.5889892578 L 343.1220092773 799.5889892578 L 364.299987793 778.4140014648 L 385.4750061035 799.5889892578 L 376.8779907227 799.5889892578 L 376.8779907227 801.241027832 L 376.8779907227 838.2940063477 L 376.8779907227 839.9459838867 L 385.4750061035 839.9459838867 L 364.299987793 861.1220092773';
                const arrow03PathPoints = [
                    {x: 343.1220092773, y: 839.9459838867},
                    {x: 351.7200012207, y: 839.9459838867},
                    {x: 351.7200012207, y: 838.2940063477},
                    {x: 351.7200012207, y: 801.241027832},
                    {x: 351.7200012207, y: 799.5889892578},
                    {x: 343.1220092773, y: 799.5889892578},
                    {x: 364.299987793, y: 778.4140014648},
                    {x: 385.4750061035, y: 799.5889892578},
                    {x: 376.8779907227, y: 799.5889892578},
                    {x: 376.8779907227, y: 801.241027832},
                    {x: 376.8779907227, y: 838.2940063477},
                    {x: 376.8779907227, y: 839.9459838867},
                    {x: 385.4750061035, y: 839.9459838867},
                    {x: 364.299987793, y: 861.1220092773}
                ];
                const arrow03MinX = Math.min(...arrow03PathPoints.map(p => p.x));
                const arrow03MinY = Math.min(...arrow03PathPoints.map(p => p.y));
                const arrow03MaxY = Math.max(...arrow03PathPoints.map(p => p.y));
                const arrow03Normalized = arrow03PathPoints.map(p => ({
                    x: p.x - arrow03MinX,
                    y: p.y - arrow03MinY
                }));
                const arrow03PathData = `M ${arrow03Normalized[0].x} ${arrow03Normalized[0].y} L ${arrow03Normalized[1].x} ${arrow03Normalized[1].y} L ${arrow03Normalized[2].x} ${arrow03Normalized[2].y} L ${arrow03Normalized[3].x} ${arrow03Normalized[3].y} L ${arrow03Normalized[4].x} ${arrow03Normalized[4].y} L ${arrow03Normalized[5].x} ${arrow03Normalized[5].y} L ${arrow03Normalized[6].x} ${arrow03Normalized[6].y} L ${arrow03Normalized[7].x} ${arrow03Normalized[7].y} L ${arrow03Normalized[8].x} ${arrow03Normalized[8].y} L ${arrow03Normalized[9].x} ${arrow03Normalized[9].y} L ${arrow03Normalized[10].x} ${arrow03Normalized[10].y} L ${arrow03Normalized[11].x} ${arrow03Normalized[11].y} L ${arrow03Normalized[12].x} ${arrow03Normalized[12].y} L ${arrow03Normalized[13].x} ${arrow03Normalized[13].y} Z`;
                const arrow03Width = Math.max(...arrow03Normalized.map(p => p.x));
                const arrow03CenterY = (arrow03MaxY - arrow03MinY) / 2;
                const arrow03Scale = length / arrow03Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow03PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow03CenterY);
                arrowShape.scaleX(arrow03Scale);
                arrowShape.scaleY(arrow03Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-04':
                // Custom arrow 04 - curved arrow with arrowhead (from arrow_04.svg)
                // Body path: curved arrow body
                const arrow04BodyPath = 'M 0 0 L 0 -22 C -19.037 -22.078 -41.287 -20.434 -41.287 -7.627 C -41.287 1.064 -41.262 3.941 -41.287 8.176 C -39.319 -0.967 -18.066 -0.072 0 0 Z';
                // Head path: arrowhead at the end
                const arrow04HeadPath = 'M 0 0 L 21.177 -21.176 L 0 -42.354 Z';
                // Calculate dimensions - body extends from x=0 to x=-41.287, total width is 41.287
                const arrow04BodyWidth = 41.287;
                const arrow04BodyHeight = 42.354; // From -22 to 8.176, plus head height
                const arrow04TotalWidth = arrow04BodyWidth + 21.177; // Body width + head width
                const arrow04Scale = length / arrow04TotalWidth;
                arrowGroup = new Konva.Group({ x: startX, y: startY, draggable: false });
                const arrow04Body = new Konva.Path({
                    data: arrow04BodyPath,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                // Position head at the end of the curve (x = -41.287, y = 8.176)
                const arrow04Head = new Konva.Path({
                    x: -41.287 * arrow04Scale,
                    y: 8.176 * arrow04Scale,
                    data: arrow04HeadPath,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                // Set pivot to start point (0, 0) and center vertically
                arrowGroup.offsetX(0);
                arrowGroup.offsetY((arrow04BodyHeight / 2) * arrow04Scale);
                arrowGroup.scaleX(arrow04Scale);
                arrowGroup.scaleY(arrow04Scale);
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.add(arrow04Body, arrow04Head);
                break;
            case 'arrow-custom-05':
                // Arrow 05 - normalize path to start at x=0
                const arrow05OriginalPath = 'M 0 0 L 18.809 -17.695 L -0.076 -40.689 L -0.061 -32.423 L -34.504 -37.265 L -34.458 -13.099 L -0.016 -8.257 Z';
                // Parse path to get points
                const arrow05Points = [
                    {x: 0, y: 0},
                    {x: 18.809, y: -17.695},
                    {x: -0.076, y: -40.689},
                    {x: -0.061, y: -32.423},
                    {x: -34.504, y: -37.265},
                    {x: -34.458, y: -13.099},
                    {x: -0.016, y: -8.257}
                ];
                const arrow05MinX = Math.min(...arrow05Points.map(p => p.x));
                const arrow05MinY = Math.min(...arrow05Points.map(p => p.y));
                const arrow05MaxY = Math.max(...arrow05Points.map(p => p.y));
                const arrow05Normalized = arrow05Points.map(p => ({
                    x: p.x - arrow05MinX,
                    y: p.y - arrow05MinY
                }));
                const arrow05PathData = `M ${arrow05Normalized[0].x} ${arrow05Normalized[0].y} L ${arrow05Normalized[1].x} ${arrow05Normalized[1].y} L ${arrow05Normalized[2].x} ${arrow05Normalized[2].y} L ${arrow05Normalized[3].x} ${arrow05Normalized[3].y} L ${arrow05Normalized[4].x} ${arrow05Normalized[4].y} L ${arrow05Normalized[5].x} ${arrow05Normalized[5].y} L ${arrow05Normalized[6].x} ${arrow05Normalized[6].y} Z`;
                const arrow05Width = Math.max(...arrow05Normalized.map(p => p.x));
                const arrow05CenterY = (arrow05MaxY - arrow05MinY) / 2;
                const arrow05Scale = length / arrow05Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow05PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow05CenterY);
                arrowShape.scaleX(arrow05Scale);
                arrowShape.scaleY(arrow05Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-06':
                // Arrow 06 - normalize path to start at x=0
                const arrow06OriginalPath = 'M 0 0 L -0.016 -8.266 L 34.436 -3.423 L 34.39 -27.59 L -0.061 -32.432 L -0.076 -40.689 L -18.886 -23.002 Z';
                const arrow06Points = [
                    {x: 0, y: 0},
                    {x: -0.016, y: -8.266},
                    {x: 34.436, y: -3.423},
                    {x: 34.39, y: -27.59},
                    {x: -0.061, y: -32.432},
                    {x: -0.076, y: -40.689},
                    {x: -18.886, y: -23.002}
                ];
                const arrow06MinX = Math.min(...arrow06Points.map(p => p.x));
                const arrow06MinY = Math.min(...arrow06Points.map(p => p.y));
                const arrow06MaxY = Math.max(...arrow06Points.map(p => p.y));
                const arrow06Normalized = arrow06Points.map(p => ({
                    x: p.x - arrow06MinX,
                    y: p.y - arrow06MinY
                }));
                const arrow06PathData = `M ${arrow06Normalized[0].x} ${arrow06Normalized[0].y} L ${arrow06Normalized[1].x} ${arrow06Normalized[1].y} L ${arrow06Normalized[2].x} ${arrow06Normalized[2].y} L ${arrow06Normalized[3].x} ${arrow06Normalized[3].y} L ${arrow06Normalized[4].x} ${arrow06Normalized[4].y} L ${arrow06Normalized[5].x} ${arrow06Normalized[5].y} L ${arrow06Normalized[6].x} ${arrow06Normalized[6].y} Z`;
                const arrow06Width = Math.max(...arrow06Normalized.map(p => p.x));
                const arrow06CenterY = (arrow06MaxY - arrow06MinY) / 2;
                const arrow06Scale = length / arrow06Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow06PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow06CenterY);
                arrowShape.scaleX(arrow06Scale);
                arrowShape.scaleY(arrow06Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-07':
                // Arrow 07 from arrow_07.svg - main path extracted and converted from relative to absolute
                const arrow07PathPoints = [
                    {x: 314.9, y: 21.4},
                    {x: 410.5, y: 231.1},
                    {x: 323, y: 479.8},
                    {x: 321.4, y: 386.7},
                    {x: 154.1, y: 422.3},
                    {x: 149.3, y: 150.1},
                    {x: 316.5, y: 114.5}
                ];
                const arrow07MinX = Math.min(...arrow07PathPoints.map(p => p.x));
                const arrow07MinY = Math.min(...arrow07PathPoints.map(p => p.y));
                const arrow07MaxY = Math.max(...arrow07PathPoints.map(p => p.y));
                const arrow07Normalized = arrow07PathPoints.map(p => ({
                    x: p.x - arrow07MinX,
                    y: p.y - arrow07MinY
                }));
                const arrow07PathData = `M ${arrow07Normalized[0].x} ${arrow07Normalized[0].y} L ${arrow07Normalized[1].x} ${arrow07Normalized[1].y} L ${arrow07Normalized[2].x} ${arrow07Normalized[2].y} L ${arrow07Normalized[3].x} ${arrow07Normalized[3].y} L ${arrow07Normalized[4].x} ${arrow07Normalized[4].y} L ${arrow07Normalized[5].x} ${arrow07Normalized[5].y} L ${arrow07Normalized[6].x} ${arrow07Normalized[6].y} Z`;
                const arrow07Width = Math.max(...arrow07Normalized.map(p => p.x));
                const arrow07CenterY = (arrow07MaxY - arrow07MinY) / 2;
                const arrow07Scale = length / arrow07Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow07PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow07CenterY);
                arrowShape.scaleX(arrow07Scale);
                arrowShape.scaleY(arrow07Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-08':
                // Arrow 08 from arrow_08.svg - uses same clipPath structure as arrow_02
                const arrow08PathPoints = [
                    {x: 221.1380004883, y: 874.1599731445},
                    {x: 229.7350006104, y: 874.1599731445},
                    {x: 219.7350006104, y: 835.4559936523},
                    {x: 264.8930053711, y: 835.4559936523},
                    {x: 254.8930053711, y: 874.1599731445},
                    {x: 263.4909973145, y: 874.1599731445},
                    {x: 242.3150024414, y: 889.3359985352}
                ];
                const arrow08MinX = Math.min(...arrow08PathPoints.map(p => p.x));
                const arrow08MinY = Math.min(...arrow08PathPoints.map(p => p.y));
                const arrow08MaxY = Math.max(...arrow08PathPoints.map(p => p.y));
                const arrow08Normalized = arrow08PathPoints.map(p => ({
                    x: p.x - arrow08MinX,
                    y: p.y - arrow08MinY
                }));
                const arrow08PathData = `M ${arrow08Normalized[0].x} ${arrow08Normalized[0].y} L ${arrow08Normalized[1].x} ${arrow08Normalized[1].y} L ${arrow08Normalized[2].x} ${arrow08Normalized[2].y} L ${arrow08Normalized[3].x} ${arrow08Normalized[3].y} L ${arrow08Normalized[4].x} ${arrow08Normalized[4].y} L ${arrow08Normalized[5].x} ${arrow08Normalized[5].y} L ${arrow08Normalized[6].x} ${arrow08Normalized[6].y} Z`;
                const arrow08Width = Math.max(...arrow08Normalized.map(p => p.x));
                const arrow08CenterY = (arrow08MaxY - arrow08MinY) / 2;
                const arrow08Scale = length / arrow08Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow08PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow08CenterY);
                arrowShape.scaleX(arrow08Scale);
                arrowShape.scaleY(arrow08Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-09':
                // Arrow 09 from arrow_09.svg - main path extracted and converted from relative to absolute
                const arrow09PathPoints = [
                    {x: 186, y: 21.8},
                    {x: 186, y: 111.4},
                    {x: 333.2, y: 222.3},
                    {x: 333.3, y: 484.6},
                    {x: 186.1, y: 373.7},
                    {x: 186.2, y: 463.3},
                    {x: 105.6, y: 181.9}
                ];
                const arrow09MinX = Math.min(...arrow09PathPoints.map(p => p.x));
                const arrow09MinY = Math.min(...arrow09PathPoints.map(p => p.y));
                const arrow09MaxY = Math.max(...arrow09PathPoints.map(p => p.y));
                const arrow09Normalized = arrow09PathPoints.map(p => ({
                    x: p.x - arrow09MinX,
                    y: p.y - arrow09MinY
                }));
                const arrow09PathData = `M ${arrow09Normalized[0].x} ${arrow09Normalized[0].y} L ${arrow09Normalized[1].x} ${arrow09Normalized[1].y} L ${arrow09Normalized[2].x} ${arrow09Normalized[2].y} L ${arrow09Normalized[3].x} ${arrow09Normalized[3].y} L ${arrow09Normalized[4].x} ${arrow09Normalized[4].y} L ${arrow09Normalized[5].x} ${arrow09Normalized[5].y} L ${arrow09Normalized[6].x} ${arrow09Normalized[6].y} Z`;
                const arrow09Width = Math.max(...arrow09Normalized.map(p => p.x));
                const arrow09CenterY = (arrow09MaxY - arrow09MinY) / 2;
                const arrow09Scale = length / arrow09Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow09PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow09CenterY);
                arrowShape.scaleX(arrow09Scale);
                arrowShape.scaleY(arrow09Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-10':
                // Arrow 10 - normalize path to start at x=0
                const arrow10OriginalPath = 'M 0 0 L 7.422 -25.906 L 0.017 -40.639 L 0.014 -32.392 L -13.535 -22.183 L -13.545 1.962 L 0.003 -8.247 Z';
                const arrow10Points = [
                    {x: 0, y: 0},
                    {x: 7.422, y: -25.906},
                    {x: 0.017, y: -40.639},
                    {x: 0.014, y: -32.392},
                    {x: -13.535, y: -22.183},
                    {x: -13.545, y: 1.962},
                    {x: 0.003, y: -8.247}
                ];
                const arrow10MinX = Math.min(...arrow10Points.map(p => p.x));
                const arrow10MinY = Math.min(...arrow10Points.map(p => p.y));
                const arrow10MaxY = Math.max(...arrow10Points.map(p => p.y));
                const arrow10Normalized = arrow10Points.map(p => ({
                    x: p.x - arrow10MinX,
                    y: p.y - arrow10MinY
                }));
                const arrow10PathData = `M ${arrow10Normalized[0].x} ${arrow10Normalized[0].y} L ${arrow10Normalized[1].x} ${arrow10Normalized[1].y} L ${arrow10Normalized[2].x} ${arrow10Normalized[2].y} L ${arrow10Normalized[3].x} ${arrow10Normalized[3].y} L ${arrow10Normalized[4].x} ${arrow10Normalized[4].y} L ${arrow10Normalized[5].x} ${arrow10Normalized[5].y} L ${arrow10Normalized[6].x} ${arrow10Normalized[6].y} Z`;
                const arrow10Width = Math.max(...arrow10Normalized.map(p => p.x));
                const arrow10CenterY = (arrow10MaxY - arrow10MinY) / 2;
                const arrow10Scale = length / arrow10Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow10PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow10CenterY);
                arrowShape.scaleX(arrow10Scale);
                arrowShape.scaleY(arrow10Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-11':
                // Arrow 11 - normalize path to start at x=0
                const arrow11OriginalPath = 'M 0 0 L 7.426 -25.908 L 4.413 -23.639 L 4.429 -60.78 L -4.378 -54.144 L -4.394 -17.002 L -7.402 -14.735 Z';
                const arrow11Points = [
                    {x: 0, y: 0},
                    {x: 7.426, y: -25.908},
                    {x: 4.413, y: -23.639},
                    {x: 4.429, y: -60.78},
                    {x: -4.378, y: -54.144},
                    {x: -4.394, y: -17.002},
                    {x: -7.402, y: -14.735}
                ];
                const arrow11MinX = Math.min(...arrow11Points.map(p => p.x));
                const arrow11MinY = Math.min(...arrow11Points.map(p => p.y));
                const arrow11MaxY = Math.max(...arrow11Points.map(p => p.y));
                const arrow11Normalized = arrow11Points.map(p => ({
                    x: p.x - arrow11MinX,
                    y: p.y - arrow11MinY
                }));
                const arrow11PathData = `M ${arrow11Normalized[0].x} ${arrow11Normalized[0].y} L ${arrow11Normalized[1].x} ${arrow11Normalized[1].y} L ${arrow11Normalized[2].x} ${arrow11Normalized[2].y} L ${arrow11Normalized[3].x} ${arrow11Normalized[3].y} L ${arrow11Normalized[4].x} ${arrow11Normalized[4].y} L ${arrow11Normalized[5].x} ${arrow11Normalized[5].y} L ${arrow11Normalized[6].x} ${arrow11Normalized[6].y} Z`;
                const arrow11Width = Math.max(...arrow11Normalized.map(p => p.x));
                const arrow11CenterY = (arrow11MaxY - arrow11MinY) / 2;
                const arrow11Scale = length / arrow11Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow11PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow11CenterY);
                arrowShape.scaleX(arrow11Scale);
                arrowShape.scaleY(arrow11Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-12':
                // Arrow 12 - simple arrowhead (from arrow_12.svg, path at translate(448.772 669.2903))
                // After transform matrix(1, 0, 0, -1, ...) which flips Y, the path becomes:
                // M 0 0 L -5.6199998856 0.5939999819 L 1.7860000134 -14.138999939 L 7.4060001373 -14.7329998016
                // Simplified and normalized to start at x=0, pointing right
                const arrow12Points = [
                    {x: 0, y: 0},
                    {x: 5.62, y: -0.594},
                    {x: 7.406, y: -14.733},
                    {x: 1.786, y: -14.139}
                ];
                const arrow12MinX = Math.min(...arrow12Points.map(p => p.x));
                const arrow12MinY = Math.min(...arrow12Points.map(p => p.y));
                const arrow12MaxY = Math.max(...arrow12Points.map(p => p.y));
                const arrow12Normalized = arrow12Points.map(p => ({
                    x: p.x - arrow12MinX,
                    y: p.y - arrow12MinY
                }));
                const arrow12PathData = `M ${arrow12Normalized[0].x} ${arrow12Normalized[0].y} L ${arrow12Normalized[1].x} ${arrow12Normalized[1].y} L ${arrow12Normalized[2].x} ${arrow12Normalized[2].y} L ${arrow12Normalized[3].x} ${arrow12Normalized[3].y} Z`;
                const arrow12Width = Math.max(...arrow12Normalized.map(p => p.x));
                const arrow12CenterY = (arrow12MaxY - arrow12MinY) / 2;
                const arrow12Scale = length / arrow12Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow12PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow12CenterY);
                arrowShape.scaleX(arrow12Scale);
                arrowShape.scaleY(arrow12Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-13':
                // Arrow 13 - normalize path to start at x=0
                const arrow13OriginalPath = 'M 0 0 L 8.807 -6.636 L 8.822 -43.777 L 11.834 -46.047 L 4.429 -60.78 L -2.994 -34.874 L 0.015 -37.142 Z';
                const arrow13Points = [
                    {x: 0, y: 0},
                    {x: 8.807, y: -6.636},
                    {x: 8.822, y: -43.777},
                    {x: 11.834, y: -46.047},
                    {x: 4.429, y: -60.78},
                    {x: -2.994, y: -34.874},
                    {x: 0.015, y: -37.142}
                ];
                const arrow13MinX = Math.min(...arrow13Points.map(p => p.x));
                const arrow13MinY = Math.min(...arrow13Points.map(p => p.y));
                const arrow13MaxY = Math.max(...arrow13Points.map(p => p.y));
                const arrow13Normalized = arrow13Points.map(p => ({
                    x: p.x - arrow13MinX,
                    y: p.y - arrow13MinY
                }));
                const arrow13PathData = `M ${arrow13Normalized[0].x} ${arrow13Normalized[0].y} L ${arrow13Normalized[1].x} ${arrow13Normalized[1].y} L ${arrow13Normalized[2].x} ${arrow13Normalized[2].y} L ${arrow13Normalized[3].x} ${arrow13Normalized[3].y} L ${arrow13Normalized[4].x} ${arrow13Normalized[4].y} L ${arrow13Normalized[5].x} ${arrow13Normalized[5].y} L ${arrow13Normalized[6].x} ${arrow13Normalized[6].y} Z`;
                const arrow13Width = Math.max(...arrow13Normalized.map(p => p.x));
                const arrow13CenterY = (arrow13MaxY - arrow13MinY) / 2;
                const arrow13Scale = length / arrow13Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow13PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow13CenterY);
                arrowShape.scaleX(arrow13Scale);
                arrowShape.scaleY(arrow13Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
            case 'arrow-custom-14':
                // Arrow 14 - normalize path to start at x=0
                const arrow14OriginalPath = 'M 0 0 L 27 -3.606 L 18.894 -4.174 L 31.737 -13.321 L 8.002 -14.981 L -4.841 -5.834 L -12.948 -6.402 Z';
                const arrow14Points = [
                    {x: 0, y: 0},
                    {x: 27, y: -3.606},
                    {x: 18.894, y: -4.174},
                    {x: 31.737, y: -13.321},
                    {x: 8.002, y: -14.981},
                    {x: -4.841, y: -5.834},
                    {x: -12.948, y: -6.402}
                ];
                const arrow14MinX = Math.min(...arrow14Points.map(p => p.x));
                const arrow14MinY = Math.min(...arrow14Points.map(p => p.y));
                const arrow14MaxY = Math.max(...arrow14Points.map(p => p.y));
                const arrow14Normalized = arrow14Points.map(p => ({
                    x: p.x - arrow14MinX,
                    y: p.y - arrow14MinY
                }));
                const arrow14PathData = `M ${arrow14Normalized[0].x} ${arrow14Normalized[0].y} L ${arrow14Normalized[1].x} ${arrow14Normalized[1].y} L ${arrow14Normalized[2].x} ${arrow14Normalized[2].y} L ${arrow14Normalized[3].x} ${arrow14Normalized[3].y} L ${arrow14Normalized[4].x} ${arrow14Normalized[4].y} L ${arrow14Normalized[5].x} ${arrow14Normalized[5].y} L ${arrow14Normalized[6].x} ${arrow14Normalized[6].y} Z`;
                const arrow14Width = Math.max(...arrow14Normalized.map(p => p.x));
                const arrow14CenterY = (arrow14MaxY - arrow14MinY) / 2;
                const arrow14Scale = length / arrow14Width;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: arrow14PathData,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow14CenterY);
                arrowShape.scaleX(arrow14Scale);
                arrowShape.scaleY(arrow14Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
                
            default:
                // Default arrow
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 15,
                    pointerWidth: 15,
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    draggable: false
                });
        }
        
        return arrowShape || arrowGroup;
    }
    
    /**
     * Start custom shape drawing
     */
    startCustomShape(e) {
        // Check if click is within canvas bounds
        const pos = this.stage.getPointerPosition();
        if (!pos || pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.height) {
            return;
        }
        
        console.log('=== startCustomShape ===');
        console.log('Click position:', pos.x, pos.y);
        console.log('Shape type:', this.customShapeType);
        
        this.isDrawing = true;
        this.startPos = pos;
        const layer = this.getCurrentLayer();
        
        // Hide transformer while drawing
        this.transformer.nodes([]);
        
        // Create initial shape with minimum size to ensure it's created
        // Use a small offset to ensure length > 20
        const initialEndX = pos.x + 25;
        const initialEndY = pos.y;
        this.currentShape = this.createCustomArrowShape(this.customShapeType, pos.x, pos.y, initialEndX, initialEndY);
        
        if (this.currentShape) {
            layer.add(this.currentShape);
        } else {
            // Fallback: create a simple arrow if shape creation failed
            this.currentShape = new Konva.Arrow({
                x: pos.x,
                y: pos.y,
                points: [0, 0, 25, 0],
                stroke: this.currentColor,
                fill: this.currentColor,
                strokeWidth: this.shapeStrokeWidth,
                pointerLength: 10,
                pointerWidth: 10,
                draggable: false
            });
            layer.add(this.currentShape);
        }
        console.log('=== startCustomShape END ===');
    }
    
    /**
     * Start erasing
     */
    startErasing(e) {
        this.isDrawing = true;
        const pos = this.stage.getPointerPosition();
        this.startPos = pos;
        const layer = this.getCurrentLayer();
        
        // Erase by drawing with destination-out composite operation
        this.currentShape = new Konva.Line({
            points: [pos.x, pos.y],
            stroke: '#ffffff',
            strokeWidth: this.brushSize * 2,
            lineCap: 'round',
            lineJoin: 'round',
            globalCompositeOperation: 'destination-out',
            tension: 0.5
        });
        
        layer.add(this.currentShape);
    }
    
    /**
     * Start text input
     */
    startTextInput(e) {
        // Check if clicking on existing text first
        const clickedShape = e.target;
        if (clickedShape && clickedShape.getType() === 'Text' && clickedShape.getLayer() === this.getCurrentLayer()) {
            // Select existing text (don't open editor on single click)
            this.selectShape(clickedShape);
            return;
        }
        
        // Allow placing text even if clicking on shapes - just place it at the click position
        // Don't create new text if clicking on transformer
        if (clickedShape && clickedShape === this.transformer || clickedShape && clickedShape.getParent() === this.transformer) {
            return;
        }
        
        const pos = this.stage.getPointerPosition();
        const layer = this.getCurrentLayer();
        
        // Create text node
        const textNode = new Konva.Text({
            x: pos.x,
            y: pos.y,
            text: 'Double click to edit',
            fontSize: this.textSize,
            fontFamily: this.textFont,
            fontStyle: (this.textBold ? 'bold ' : '') + (this.textItalic ? 'italic' : ''),
            fill: this.textColor,
            textDecoration: this.textUnderline ? 'underline' : '',
            draggable: this.currentTool === 'select'
        });
        
        layer.add(textNode);
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
        
        // Make text editable on double click
        this.setupTextEditing(textNode);
        
        // Select the text node
        this.selectShape(textNode);
        
        layer.draw();
        
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Setup text editing for a text node
     */
    setupTextEditing(textNode) {
        // Remove existing listeners to avoid duplicates
        textNode.off('dblclick');
        
        // Double click to edit (works with any tool, including text tool)
        textNode.on('dblclick', (e) => {
            e.cancelBubble = true; // Prevent event bubbling
            if (e.evt) {
                e.evt.stopPropagation();
                e.evt.preventDefault();
            }
            this.openTextEditor(textNode);
        });
    }
    
    /**
     * Open text editor for a text node
     */
    openTextEditor(textNode) {
        const textPosition = textNode.absolutePosition();
        const stageBox = this.stage.container().getBoundingClientRect();
        
        const areaPosition = {
            x: stageBox.left + textPosition.x,
            y: stageBox.top + textPosition.y
        };
        
        // Remove existing textarea if any
        const existing = document.getElementById('drawingTextarea');
        if (existing) {
            existing.remove();
        }
        
        const textarea = document.createElement('textarea');
        textarea.id = 'drawingTextarea';
        textarea.style.zIndex = '10002';
        document.body.appendChild(textarea);
        
        textarea.value = textNode.text();
        textarea.style.position = 'absolute';
        textarea.style.top = areaPosition.y + 'px';
        textarea.style.left = areaPosition.x + 'px';
        textarea.style.width = Math.max(textNode.width(), 200) + 'px';
        textarea.style.height = Math.max(textNode.height(), 30) + 'px';
        textarea.style.fontSize = textNode.fontSize() + 'px';
        textarea.style.fontFamily = textNode.fontFamily();
        textarea.style.fontStyle = textNode.fontStyle();
        textarea.style.fontWeight = this.textBold ? 'bold' : 'normal';
        textarea.style.fontStyle = this.textItalic ? 'italic' : 'normal';
        textarea.style.textDecoration = this.textUnderline ? 'underline' : 'none';
        textarea.style.border = '2px solid #007acc';
        textarea.style.padding = '4px';
        textarea.style.margin = '0px';
        textarea.style.overflow = 'hidden';
        textarea.style.background = '#ffffff';
        textarea.style.outline = 'none';
        textarea.style.resize = 'none';
        textarea.style.color = textNode.fill();
        textarea.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        textarea.focus();
        textarea.select();
        
        const updateText = () => {
            textNode.text(textarea.value);
            // Auto-resize textarea
            textarea.style.width = Math.max(textNode.width(), 200) + 'px';
            textarea.style.height = Math.max(textNode.height(), 30) + 'px';
            this.getCurrentLayer().draw();
        };
        
        const finishEditing = () => {
            textNode.text(textarea.value);
            this.getCurrentLayer().draw();
            textarea.remove();
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        };
        
        textarea.addEventListener('input', updateText);
        textarea.addEventListener('keydown', (e) => {
            if (e.keyCode === 27) { // ESC
                textarea.remove();
            }
        });
        
        // Finish on blur
        textarea.addEventListener('blur', finishEditing);
        
        // Also finish on Ctrl+Enter
        textarea.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 && e.ctrlKey) {
                e.preventDefault();
                finishEditing();
            }
        });
        
        // Update textarea size as user types
        const updateTextareaSize = () => {
            // Temporarily set text to measure
            const oldText = textNode.text();
            textNode.text(textarea.value);
            const newWidth = Math.max(textNode.width(), 200);
            const newHeight = Math.max(textNode.height(), 30);
            textarea.style.width = newWidth + 'px';
            textarea.style.height = newHeight + 'px';
        };
        
        textarea.addEventListener('input', () => {
            updateTextareaSize();
            updateText();
        });
    }
    
    /**
     * Set drawing tool
     */
    setTool(tool) {
        
        this.currentTool = tool;
        
        // Update cursor and hide transformer when switching tools
        const container = this.stage.container();
        
        // Update draggable state - only selected shapes should be draggable
        const selectedShapes = this.selectedShapes.length > 0 ? this.selectedShapes : (this.selectedShape ? [this.selectedShape] : []);
        const selectedShapeIds = new Set(selectedShapes.map(s => s._id || s.id()));
        
        this.layers.forEach((layerData, index) => {
            if (index > 0 || !layerData.background) { // Skip background layer
                layerData.layer.find('Shape').forEach(shape => {
                    if (shape.name() !== 'background') {
                        // Only make draggable if it's selected and select tool is active
                        const isSelected = selectedShapeIds.has(shape._id || shape.id());
                        shape.draggable(tool === 'select' && isSelected);
                    }
                });
                // Also handle Groups and Text nodes
                layerData.layer.find('Group').forEach(group => {
                    const isSelected = selectedShapeIds.has(group._id || group.id());
                    group.draggable(tool === 'select' && isSelected);
                });
                layerData.layer.find('Text').forEach(text => {
                    const isSelected = selectedShapeIds.has(text._id || text.id());
                    text.draggable(tool === 'select' && isSelected);
                });
            }
        });
        
        if (tool === 'select') {
            container.style.cursor = 'default';
        } else if (tool === 'eraser') {
            container.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'10\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'2\'/></svg>") 12 12, auto';
            this.transformer.nodes([]);
            this.selectedShape = null;
            this.selectedShapes = [];
        } else if (tool === 'text') {
            container.style.cursor = 'text';
            this.transformer.nodes([]);
            this.selectedShape = null;
            this.selectedShapes = [];
            
            // Re-setup text editing for all text nodes to enable single-click editing
            this.layers.forEach((layerData) => {
                layerData.layer.find('Text').forEach(textNode => {
                    this.setupTextEditing(textNode);
                });
            });
        } else {
            container.style.cursor = 'crosshair';
            this.transformer.nodes([]);
            this.selectedShape = null;
            this.selectedShapes = [];
        }
        
        this.stage.draw();
    }
    
    /**
     * Set brush color
     */
    setColor(color) {
        // Update color immediately and ensure it's used for next drawing
        this.currentColor = color;
        // Also update shape fill color if it's the same as current color (for consistency)
        if (this.shapeFillColor === this.currentColor || !this.shapeFillEnabled) {
            // Keep them in sync if fill is using the same color
        }
    }
    
    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.brushSize = size;
    }
    
    /**
     * Set brush smoothing (0-100)
     */
    setBrushSmoothing(smoothing) {
        this.brushSmoothing = Math.max(0, Math.min(100, smoothing));
    }
    
    /**
     * Set brush opacity (0-100)
     */
    setBrushOpacity(opacity) {
        this.brushOpacity = Math.max(0, Math.min(100, opacity));
    }
    
    /**
     * Set shape opacity (0-100)
     */
    setShapeOpacity(opacity) {
        this.shapeOpacity = Math.max(0, Math.min(100, opacity));
    }
    
    /**
     * Smooth points using optimized algorithm - balanced performance and quality
     * Uses adaptive smoothing based on smoothing factor
     */
    smoothPoints(points, smoothingFactor) {
        if (points.length < 6 || smoothingFactor === 0) {
            return points;
        }
        
        // Remap smoothing factor: 0-100 -> 0-1 with exponential curve
        const remappedFactor = Math.pow(smoothingFactor / 100, 0.3); // Less aggressive for better performance
        
        // For low smoothing (0-50), use simple moving average - much faster
        if (smoothingFactor < 50) {
            const windowSize = Math.max(1, Math.floor(remappedFactor * 5) + 1);
            const result = [];
            
            for (let i = 0; i < points.length; i += 2) {
                let sumX = 0;
                let sumY = 0;
                let count = 0;
                
                for (let j = -windowSize; j <= windowSize; j++) {
                    const idx = i + j * 2;
                    if (idx >= 0 && idx < points.length) {
                        sumX += points[idx];
                        sumY += points[idx + 1];
                        count++;
                    }
                }
                
                result.push(sumX / count, sumY / count);
            }
            
            return result;
        }
        
        // For high smoothing (50-100), use optimized Catmull-Rom with fewer points
        // Only use one pass and limit the number of interpolated points
        const result = [];
        const numPoints = points.length / 2;
        
        // Always include first point
        result.push(points[0], points[1]);
        
        // Use Catmull-Rom spline interpolation with adaptive step count
        for (let i = 1; i < numPoints - 1; i++) {
            const p0 = i > 0 ? { x: points[(i - 1) * 2], y: points[(i - 1) * 2 + 1] } : { x: points[i * 2], y: points[i * 2 + 1] };
            const p1 = { x: points[i * 2], y: points[i * 2 + 1] };
            const p2 = { x: points[(i + 1) * 2], y: points[(i + 1) * 2 + 1] };
            const p3 = i < numPoints - 2 ? { x: points[(i + 2) * 2], y: points[(i + 2) * 2 + 1] } : p2;
            
            // Limit steps for performance - max 8 steps even at 100 smoothing
            const steps = Math.max(2, Math.min(8, Math.floor(remappedFactor * 6 + 2)));
            
            for (let s = 1; s < steps; s++) {
                const t = s / steps;
                const t2 = t * t;
                const t3 = t2 * t;
                
                // Catmull-Rom spline formula
                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
                );
                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
                );
                
                result.push(x, y);
            }
        }
        
        // Always include last point
        result.push(points[points.length - 2], points[points.length - 1]);
        
        return result;
    }
    
    /**
     * Set shape stroke width
     */
    setShapeStrokeWidth(width) {
        this.shapeStrokeWidth = width;
    }
    
    /**
     * Set shape fill enabled
     */
    setShapeFillEnabled(enabled) {
        this.shapeFillEnabled = enabled;
    }
    
    /**
     * Set shape fill color
     */
    setShapeFillColor(color) {
        this.shapeFillColor = color;
    }
    
    /**
     * Set paint bucket fill color
     */
    setPaintBucketColor(color) {
        this.paintBucketColor = color;
    }
    
    /**
     * Set text font
     */
    setTextFont(font) {
        this.textFont = font;
        // Update selected text or all selected texts
        const textsToUpdate = this.selectedShapes.length > 0 
            ? this.selectedShapes.filter(s => s.getType && s.getType() === 'Text')
            : (this.selectedShape && this.selectedShape.getType && this.selectedShape.getType() === 'Text' ? [this.selectedShape] : []);
        
        if (textsToUpdate.length > 0) {
            textsToUpdate.forEach(text => {
                text.fontFamily(font);
            });
            this.getCurrentLayer().draw();
            this.hasUnsavedChanges = true;
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Set text size
     */
    setTextSize(size) {
        this.textSize = size;
        // Update selected text or all selected texts
        const textsToUpdate = this.selectedShapes.length > 0 
            ? this.selectedShapes.filter(s => s.getType && s.getType() === 'Text')
            : (this.selectedShape && this.selectedShape.getType && this.selectedShape.getType() === 'Text' ? [this.selectedShape] : []);
        
        if (textsToUpdate.length > 0) {
            textsToUpdate.forEach(text => {
                text.fontSize(size);
            });
            this.getCurrentLayer().draw();
            this.hasUnsavedChanges = true;
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Set text color
     */
    setTextColor(color) {
        this.textColor = color;
        // Update selected text or all selected texts
        const textsToUpdate = this.selectedShapes.length > 0 
            ? this.selectedShapes.filter(s => s.getType && s.getType() === 'Text')
            : (this.selectedShape && this.selectedShape.getType && this.selectedShape.getType() === 'Text' ? [this.selectedShape] : []);
        
        if (textsToUpdate.length > 0) {
            textsToUpdate.forEach(text => {
                text.fill(color);
            });
            this.getCurrentLayer().draw();
            this.hasUnsavedChanges = true;
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Set text style
     */
    setTextStyle(bold, italic, underline) {
        this.textBold = bold;
        this.textItalic = italic;
        this.textUnderline = underline;
        
        const fontStyle = (bold ? 'bold ' : '') + (italic ? 'italic' : '');
        // Update selected text or all selected texts
        const textsToUpdate = this.selectedShapes.length > 0 
            ? this.selectedShapes.filter(s => s.getType && s.getType() === 'Text')
            : (this.selectedShape && this.selectedShape.getType && this.selectedShape.getType() === 'Text' ? [this.selectedShape] : []);
        
        if (textsToUpdate.length > 0) {
            textsToUpdate.forEach(text => {
                text.fontStyle(fontStyle);
                text.textDecoration(underline ? 'underline' : '');
            });
            this.getCurrentLayer().draw();
            this.hasUnsavedChanges = true;
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Clear canvas (all layers including background)
     */
    clear() {
        // Clear ALL layers including background
        this.layers.forEach((layerData, index) => {
            if (layerData.background) {
                // For background layer, reset to white
                const bgRect = layerData.layer.findOne('.background');
                if (bgRect) {
                    bgRect.fill('#ffffff');
                }
                // Clear any other children on background layer
                layerData.layer.find('Shape').forEach(shape => {
                    if (shape.name() !== 'background') {
                        shape.destroy();
                    }
                });
            } else {
                // Clear all non-background layers
                layerData.layer.destroyChildren();
            }
        });
        
        this.transformer.nodes([]);
        this.selectedShape = null;
        
        this.stage.draw();
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Get background color
     */
    getBackgroundColor() {
        const bgLayer = this.layers[0].layer;
        const bgRect = bgLayer.findOne('.background');
        const fill = bgRect ? bgRect.fill() : '#ffffff';
        return fill || '#ffffff';
    }
    
    /**
     * Set background color
     */
    setBackgroundColor(color) {
        const bgLayer = this.layers[0].layer;
        const bgRect = bgLayer.findOne('.background');
        if (bgRect) {
            bgRect.fill(color);
            bgLayer.draw();
            this.updateBackgroundDisplay();
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Set background image
     */
    setBackgroundImage(imageUrl, width, height) {
        // Store background image info for preservation during undo
        this.backgroundImageUrl = imageUrl;
        this.backgroundImageWidth = width;
        this.backgroundImageHeight = height;
        
        const bgLayer = this.layers[0].layer;
        const bgRect = bgLayer.findOne('.background');
        
        if (bgRect) {
            // Remove old background rect
            bgRect.destroy();
        }
        
        // Create image
        const img = new Image();
        img.onload = () => {
            // Canvas should already match image aspect ratio (set in openDrawingCanvas)
            // Display the image at full canvas size with no offset (1:1 mapping)
            // This ensures coordinates match exactly
            const displayWidth = this.width;
            const displayHeight = this.height;
            const offsetX = 0;
            const offsetY = 0;
            
            // Store scale factors for coordinate conversion (always relative to original image size)
            // Since canvas matches image aspect ratio, scale is simply: imageSize / canvasSize
            this.imageScaleX = img.width / displayWidth;
            this.imageScaleY = img.height / displayHeight;
            this.imageOffsetX = offsetX;
            this.imageOffsetY = offsetY;
            this.imageDisplayWidth = displayWidth;
            this.imageDisplayHeight = displayHeight;
            
            console.log('[COORDS] Image:', img.width, 'x', img.height, '| Canvas:', this.width, 'x', this.height, '| Scale:', this.imageScaleX.toFixed(3), 'x', this.imageScaleY.toFixed(3));
            
            const bgImage = new Konva.Image({
                x: offsetX,
                y: offsetY,
                image: img,
                width: displayWidth,
                height: displayHeight,
                name: 'background-image' // Use distinct name
            });
            bgLayer.add(bgImage);
            bgLayer.draw();
            this.updateBackgroundDisplay();
            
            // Replace the initial state (saved in initCanvas) with one that includes the background image
            // This ensures undo doesn't go back to a state without the background image
            if (this.history.length > 0 && this.historyIndex === 0) {
                // Replace the first state with one that has the background image
                this.history[0] = {
                    width: this.width,
                    height: this.height,
                    layers: this.layers.map(layerData => ({
                        name: layerData.name,
                        visible: layerData.visible,
                        locked: layerData.locked,
                        background: layerData.background,
                        opacity: layerData.opacity || 100,
                        blendingMode: layerData.blendingMode || 'normal',
                        filters: layerData.filters || [],
                        data: layerData.layer.toJSON()
                    }))
                };
            } else {
                // If history was modified, clear and save fresh state
                this.history = [];
                this.historyIndex = -1;
                this.saveState();
            }
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        };
        img.onerror = () => {
            console.error('Failed to load background image:', imageUrl);
        };
        img.src = imageUrl;
    }
    
    /**
     * Ensure background image is present (called after restoreState)
     */
    ensureBackgroundImage() {
        if (this.backgroundImageUrl && this.layers[0] && this.layers[0].background) {
            const bgLayer = this.layers[0].layer;
            const hasBackgroundImage = bgLayer.findOne(node => node.name() === 'background-image');
            if (!hasBackgroundImage) {
                // Background image was lost during restore, restore it immediately
                const img = new Image();
                img.onload = () => {
                    // Double-check it's still missing (might have been added by another call)
                    if (!bgLayer.findOne(node => node.name() === 'background-image')) {
                        const bgImage = new Konva.Image({
                            x: 0,
                            y: 0,
                            image: img,
                            width: this.backgroundImageWidth || this.width,
                            height: this.backgroundImageHeight || this.height,
                            name: 'background-image',
                            listening: false, // Make it non-interactive
                            draggable: false
                        });
                        // Insert at the beginning so it's behind everything
                        const children = bgLayer.getChildren();
                        bgLayer.removeChildren();
                        bgLayer.add(bgImage);
                        bgLayer.add(...children);
                        bgLayer.draw();
                        this.updateBackgroundDisplay();
                    }
                };
                img.onerror = () => {
                    console.error('Failed to restore background image:', this.backgroundImageUrl);
                };
                // Set src after onload handler is set
                img.src = this.backgroundImageUrl;
            }
        }
    }
    
    /**
     * Get all non-background layers as edit data
     */
    getEditLayerData() {
        const editLayers = [];
        this.layers.forEach((layerData, index) => {
            if (!layerData.background && index > 0) {
                // Serialize layer data
                const layerState = {
                    name: layerData.name,
                    visible: layerData.visible,
                    opacity: layerData.opacity || 100,
                    blendingMode: layerData.blendingMode || 'normal',
                    filters: layerData.filters || [],
                    shapes: []
                };
                
                // Serialize shapes in this layer (exclude background and background-image)
                // IMPORTANT: Get all children including groups and nested shapes
                const allShapes = [];
                layerData.layer.getChildren().forEach(shape => {
                    if (shape.name() !== 'background' && shape.name() !== 'background-image') {
                        // Check if it's a Group - if so, get all children
                        if (shape.getType && shape.getType() === 'Group') {
                            shape.getChildren().forEach(child => {
                                if (child.name() !== 'background' && child.name() !== 'background-image') {
                                    allShapes.push(child);
                                }
                            });
                        } else {
                            allShapes.push(shape);
                        }
                    }
                });
                
                allShapes.forEach((shape, shapeIndex) => {
                    try {
                        const shapeData = shape.toObject();
                        
                        // CRITICAL: Get actual position and size from the shape object, not from toObject()
                        // Konva's toObject() might not include all properties directly
                        const actualX = shape.x();
                        const actualY = shape.y();
                        const actualWidth = shape.width ? shape.width() : undefined;
                        const actualHeight = shape.height ? shape.height() : undefined;
                        
                        // Log original shape position before conversion (for first shape only)
                        if (shapeIndex === 0 && this.backgroundImageUrl) {
                            console.log('[SAVE] First shape before conversion:', {
                                className: shapeData.className,
                                actualX: actualX,
                                actualY: actualY,
                                actualWidth: actualWidth,
                                actualHeight: actualHeight,
                                shapeDataX: shapeData.x,
                                shapeDataY: shapeData.y,
                                shapeDataWidth: shapeData.width,
                                shapeDataHeight: shapeData.height,
                                canvasSize: this.width + 'x' + this.height,
                                imageSize: this.backgroundImageWidth + 'x' + this.backgroundImageHeight,
                                scaleX: this.imageScaleX,
                                scaleY: this.imageScaleY
                            });
                        }
                        
                        // If we have a background image with scaling, convert coordinates to image space
                        if (this.backgroundImageUrl && this.imageScaleX && this.imageScaleY) {
                            // Convert shape coordinates from canvas space to original image space
                            // Use actual position from shape object, not from toObject()
                            const convertedX = (actualX - (this.imageOffsetX || 0)) * this.imageScaleX;
                            const convertedY = (actualY - (this.imageOffsetY || 0)) * this.imageScaleY;
                            
                            // Update shapeData with converted coordinates
                            shapeData.x = convertedX;
                            shapeData.y = convertedY;
                            
                            // Scale width/height if they exist
                            if (actualWidth !== undefined && actualWidth !== null) {
                                shapeData.width = actualWidth * this.imageScaleX;
                            } else if (shapeData.width !== undefined && shapeData.width !== null) {
                                shapeData.width = shapeData.width * this.imageScaleX;
                            }
                            
                            if (actualHeight !== undefined && actualHeight !== null) {
                                shapeData.height = actualHeight * this.imageScaleY;
                            } else if (shapeData.height !== undefined && shapeData.height !== null) {
                                shapeData.height = shapeData.height * this.imageScaleY;
                            }
                            // Scale points arrays (for paths, lines, brush strokes, etc.)
                            if (shapeData.points && Array.isArray(shapeData.points)) {
                                for (let i = 0; i < shapeData.points.length; i += 2) {
                                    if (shapeData.points[i] !== undefined && shapeData.points[i] !== null) {
                                        shapeData.points[i] = (shapeData.points[i] - (this.imageOffsetX || 0)) * this.imageScaleX;
                                    }
                                    if (shapeData.points[i + 1] !== undefined && shapeData.points[i + 1] !== null) {
                                        shapeData.points[i + 1] = (shapeData.points[i + 1] - (this.imageOffsetY || 0)) * this.imageScaleY;
                                    }
                                }
                            }
                            // Handle other coordinate properties that might exist (e.g., for circles, ellipses)
                            if (shapeData.radius !== undefined && shapeData.radius !== null) {
                                shapeData.radius = shapeData.radius * Math.min(this.imageScaleX, this.imageScaleY);
                            }
                            if (shapeData.radiusX !== undefined && shapeData.radiusX !== null) {
                                shapeData.radiusX = shapeData.radiusX * this.imageScaleX;
                            }
                            if (shapeData.radiusY !== undefined && shapeData.radiusY !== null) {
                                shapeData.radiusY = shapeData.radiusY * this.imageScaleY;
                            }
                            // Scale stroke width
                            if (shapeData.strokeWidth !== undefined && shapeData.strokeWidth !== null) {
                                shapeData.strokeWidth = shapeData.strokeWidth * Math.min(this.imageScaleX, this.imageScaleY);
                            }
                            
                            // For Image shapes (rasterized brush strokes), also scale the image dimensions
                            if (shapeData.className === 'Image') {
                                // Image shapes have their own width/height that need scaling
                                // The x/y are already handled above
                                if (shapeData.image && shapeData.image.width) {
                                    // Note: The image itself doesn't need scaling, but the display dimensions do
                                    // The image data URL is already at the correct resolution
                                }
                            }
                            
                            // Log converted position (for first shape only)
                            if (shapeIndex === 0) {
                                console.log('[SAVE] First shape after conversion:', {
                                    x: shapeData.x,
                                    y: shapeData.y,
                                    width: shapeData.width,
                                    height: shapeData.height,
                                    convertedFrom: `(${actualX}, ${actualY}) -> (${convertedX}, ${convertedY})`
                                });
                            }
                        }
                        
                        // Only add shape if it has valid data
                        if (shapeData && shapeData.className) {
                            layerState.shapes.push(shapeData);
                        } else {
                            console.warn('Skipping invalid shape data:', shapeData);
                        }
                    } catch (error) {
                        console.warn('Error serializing shape:', error, shape);
                    }
                });
                
                // Only add layer if it has shapes or if it's explicitly an edit layer
                if (layerState.shapes.length > 0) {
                    editLayers.push(layerState);
                }
            }
        });
        return editLayers;
    }
    
    /**
     * Load edit layer data (restore edits on top of background)
     * Shapes are stored in image coordinates, need to convert to canvas coordinates
     */
    loadEditLayerData(editLayers) {
        if (!editLayers || editLayers.length === 0) return;
        
        // Clear existing non-background layers
        this.layers.forEach((layerData, index) => {
            if (!layerData.background && index > 0) {
                layerData.layer.destroyChildren();
            }
        });
        
        // Remove non-background layers (keep only background)
        this.layers = this.layers.filter((layerData, index) => layerData.background || index === 0);
        this.currentLayerIndex = 0;
        
        // Restore edit layers
        editLayers.forEach((layerState, index) => {
            const newLayer = new Konva.Layer({
                clipX: 0,
                clipY: 0,
                clipWidth: this.width,
                clipHeight: this.height
            });
            
            // Restore shapes - convert from image coordinates to canvas coordinates
            layerState.shapes.forEach(shapeData => {
                // Create a copy to avoid modifying the original
                const shapeDataCopy = JSON.parse(JSON.stringify(shapeData));
                
                // If we have a background image with scaling, convert coordinates from image space to canvas space
                if (this.backgroundImageUrl && this.imageScaleX && this.imageScaleY) {
                    // Convert shape coordinates from image space to canvas space
                    if (shapeDataCopy.x !== undefined && shapeDataCopy.x !== null) {
                        shapeDataCopy.x = (shapeDataCopy.x / this.imageScaleX) + (this.imageOffsetX || 0);
                    }
                    if (shapeDataCopy.y !== undefined && shapeDataCopy.y !== null) {
                        shapeDataCopy.y = (shapeDataCopy.y / this.imageScaleY) + (this.imageOffsetY || 0);
                    }
                    // Scale width/height if they exist
                    if (shapeDataCopy.width !== undefined && shapeDataCopy.width !== null) {
                        shapeDataCopy.width = shapeDataCopy.width / this.imageScaleX;
                    }
                    if (shapeDataCopy.height !== undefined && shapeDataCopy.height !== null) {
                        shapeDataCopy.height = shapeDataCopy.height / this.imageScaleY;
                    }
                    // Scale points arrays (for paths, lines, brush strokes, etc.)
                    if (shapeDataCopy.points && Array.isArray(shapeDataCopy.points)) {
                        for (let i = 0; i < shapeDataCopy.points.length; i += 2) {
                            if (shapeDataCopy.points[i] !== undefined && shapeDataCopy.points[i] !== null) {
                                shapeDataCopy.points[i] = (shapeDataCopy.points[i] / this.imageScaleX) + (this.imageOffsetX || 0);
                            }
                            if (shapeDataCopy.points[i + 1] !== undefined && shapeDataCopy.points[i + 1] !== null) {
                                shapeDataCopy.points[i + 1] = (shapeDataCopy.points[i + 1] / this.imageScaleY) + (this.imageOffsetY || 0);
                            }
                        }
                    }
                    // Handle other coordinate properties
                    if (shapeDataCopy.radius !== undefined && shapeDataCopy.radius !== null) {
                        shapeDataCopy.radius = shapeDataCopy.radius / Math.min(this.imageScaleX, this.imageScaleY);
                    }
                    if (shapeDataCopy.radiusX !== undefined && shapeDataCopy.radiusX !== null) {
                        shapeDataCopy.radiusX = shapeDataCopy.radiusX / this.imageScaleX;
                    }
                    if (shapeDataCopy.radiusY !== undefined && shapeDataCopy.radiusY !== null) {
                        shapeDataCopy.radiusY = shapeDataCopy.radiusY / this.imageScaleY;
                    }
                    // Scale stroke width back
                    if (shapeDataCopy.strokeWidth !== undefined && shapeDataCopy.strokeWidth !== null) {
                        shapeDataCopy.strokeWidth = shapeDataCopy.strokeWidth / Math.min(this.imageScaleX, this.imageScaleY);
                    }
                }
                
                try {
                    const shape = Konva.Node.create(shapeDataCopy);
                    newLayer.add(shape);
                } catch (error) {
                    console.warn('Error creating shape from data:', error, shapeDataCopy);
                }
            });
            
            this.stage.add(newLayer);
            
            // Create layer data
            const layerData = {
                name: layerState.name || `Layer ${this.layerCounter++}`,
                layer: newLayer,
                visible: layerState.visible !== false,
                background: false,
                opacity: layerState.opacity || 100,
                blendingMode: layerState.blendingMode || 'normal',
                filters: layerState.filters || []
            };
            
            // Apply opacity and blending mode
            newLayer.opacity(layerData.opacity / 100);
            if (layerData.blendingMode && layerData.blendingMode !== 'normal') {
                newLayer.globalCompositeOperation(this.getBlendingModeOperation(layerData.blendingMode));
            }
            
            // Apply filters
            if (layerData.filters.length > 0) {
                this.applyLayerFilterAtIndex(this.layers.length, layerData.filters);
            }
            
            this.layers.push(layerData);
        });
        
        // Set current layer to the last edit layer
        if (this.layers.length > 1) {
            this.currentLayerIndex = this.layers.length - 1;
        }
        
        this.stage.draw();
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Delete background (make transparent)
     */
    deleteBackground() {
        const bgLayer = this.layers[0].layer;
        const bgRect = bgLayer.findOne('.background');
        if (bgRect) {
            bgRect.fill(null);
            bgLayer.draw();
            this.updateBackgroundDisplay();
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Update background display (show/hide checkerboard)
     */
    updateBackgroundDisplay() {
        const bgColor = this.getBackgroundColor();
        const container = this.container.parentElement;
        if (container) {
            if (bgColor && bgColor !== 'transparent' && bgColor !== 'null') {
                container.style.backgroundImage = 'none';
                container.style.backgroundColor = bgColor;
            } else {
                // Show checkerboard for transparency
                container.style.backgroundImage = `
                    repeating-linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0),
                    repeating-linear-gradient(45deg, #e0e0e0 25%, #f5f5f5 25%, #f5f5f5 75%, #e0e0e0 75%, #e0e0e0)
                `;
                container.style.backgroundPosition = '0 0, 10px 10px';
                container.style.backgroundSize = '20px 20px';
                container.style.backgroundColor = 'transparent';
            }
        }
    }
    
    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            // Ensure background image is ALWAYS preserved after undo
            // This is critical - the background image must never be lost
            if (this.backgroundImageUrl) {
                // Force immediate check and restore
                this.ensureBackgroundImage();
                // Also check again after a short delay to catch any async issues
                setTimeout(() => {
                    this.ensureBackgroundImage();
                }, 50);
            }
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Redo last action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            // Ensure background image is ALWAYS preserved after redo
            // This is critical - the background image must never be lost
            if (this.backgroundImageUrl) {
                // Force immediate check and restore
                this.ensureBackgroundImage();
                // Also check again after a short delay to catch any async issues
                setTimeout(() => {
                    this.ensureBackgroundImage();
                }, 50);
            }
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Save current state to history
     */
    saveState() {
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Save all layers state and canvas dimensions
        const state = {
            width: this.width,
            height: this.height,
            layers: this.layers.map(layerData => ({
                name: layerData.name,
                visible: layerData.visible,
                locked: layerData.locked,
                background: layerData.background,
                opacity: layerData.opacity || 100,
                blendingMode: layerData.blendingMode || 'normal',
                filters: layerData.filters || [],
                data: layerData.layer.toJSON()
            }))
        };
        
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    /**
     * Restore state from history
     */
    restoreState(state) {
        // Restore canvas dimensions if they changed
        if (state.width && state.height && (state.width !== this.width || state.height !== this.height)) {
            this.resize(state.width, state.height);
        }
        
        // Remove any crop rectangles that might be lingering
        this.layers.forEach(layerData => {
            layerData.layer.find('Rect').forEach(rect => {
                if (rect.name() === 'cropRect') {
                    rect.destroy();
                }
            });
        });
        
        // CRITICAL: For background layer with background image, preserve it BEFORE restoring
        let preservedBgImage = null;
        if (this.backgroundImageUrl && this.layers[0] && this.layers[0].background) {
            const bgLayer = this.layers[0].layer;
            const existingBgImage = bgLayer.findOne(node => node.name() === 'background-image');
            if (existingBgImage) {
                // Preserve the image element AND its exact position
                preservedBgImage = {
                    image: existingBgImage.image(),
                    width: existingBgImage.width(),
                    height: existingBgImage.height(),
                    x: existingBgImage.x(),
                    y: existingBgImage.y()
                };
            }
        }
        
        // Restore all layers
        state.layers.forEach((layerState, index) => {
            if (this.layers[index]) {
                const layer = this.layers[index].layer;
                
                // For background layer with background image, we need special handling
                if (index === 0 && this.backgroundImageUrl) {
                    // CRITICAL: Preserve background image BEFORE destroying anything
                    const existingBgImage = layer.findOne(node => node.name() === 'background-image');
                    let bgImageToPreserve = null;
                    if (existingBgImage) {
                        bgImageToPreserve = {
                            image: existingBgImage.image(),
                            width: existingBgImage.width(),
                            height: existingBgImage.height(),
                            x: existingBgImage.x(),
                            y: existingBgImage.y()
                        };
                    }
                    
                    // Destroy all children
                    layer.destroyChildren();
                    
                    // Restore the layer content from state
                    const restoredLayer = Konva.Node.create(layerState.data);
                    layer.add(...restoredLayer.children);
                    
                    // ALWAYS restore the background image with EXACT same position
                    // Use preserved image if available (should always be available)
                    const bgImageData = bgImageToPreserve || preservedBgImage;
                    if (bgImageData && bgImageData.image) {
                        const bgImage = new Konva.Image({
                            x: bgImageData.x !== undefined ? bgImageData.x : (this.imageOffsetX || 0),
                            y: bgImageData.y !== undefined ? bgImageData.y : (this.imageOffsetY || 0),
                            image: bgImageData.image,
                            width: bgImageData.width || this.imageDisplayWidth || this.backgroundImageWidth || this.width,
                            height: bgImageData.height || this.imageDisplayHeight || this.backgroundImageHeight || this.height,
                            name: 'background-image',
                            listening: false,
                            draggable: false
                        });
                        // Get all current children
                        const children = layer.getChildren();
                        // Remove all children
                        layer.removeChildren();
                        // Add background image first (behind everything)
                        layer.add(bgImage);
                        // Then add all other children on top
                        layer.add(...children);
                        layer.draw();
                        this.updateBackgroundDisplay();
                    } else {
                        // Fallback: Recalculate position (shouldn't happen if preservation worked)
                        console.warn('Background image not preserved, recalculating position');
                        const img = new Image();
                        img.onload = () => {
                            if (!layer.findOne(node => node.name() === 'background-image')) {
                                // Recalculate position using stored scale factors
                                const offsetX = this.imageOffsetX !== undefined ? this.imageOffsetX : 0;
                                const offsetY = this.imageOffsetY !== undefined ? this.imageOffsetY : 0;
                                const displayWidth = this.imageDisplayWidth || this.width;
                                const displayHeight = this.imageDisplayHeight || this.height;
                                
                                const bgImage = new Konva.Image({
                                    x: offsetX,
                                    y: offsetY,
                                    image: img,
                                    width: displayWidth,
                                    height: displayHeight,
                                    name: 'background-image',
                                    listening: false,
                                    draggable: false
                                });
                                const children = layer.getChildren();
                                layer.removeChildren();
                                layer.add(bgImage);
                                layer.add(...children);
                                layer.draw();
                                this.updateBackgroundDisplay();
                            }
                        };
                        img.onerror = () => {
                            console.error('Failed to restore background image:', this.backgroundImageUrl);
                        };
                        img.src = this.backgroundImageUrl;
                    }
                } else {
                    // For non-background layers, restore normally
                    layer.destroyChildren();
                    const restoredLayer = Konva.Node.create(layerState.data);
                    layer.add(...restoredLayer.children);
                }
                
                // Re-attach text editing
                this.layers[index].layer.find('Text').forEach(textNode => {
                    this.setupTextEditing(textNode);
                });
            }
        });
        
        // Also ensure background image as a backup (double-check)
        // Call immediately and also with a small delay to catch any async issues
        if (this.backgroundImageUrl) {
            setTimeout(() => {
                this.ensureBackgroundImage();
            }, 10);
            setTimeout(() => {
                this.ensureBackgroundImage();
            }, 100);
        }
        
        // Update layer properties
        state.layers.forEach((layerState, index) => {
            if (this.layers[index]) {
                this.layers[index].visible = layerState.visible;
                this.layers[index].locked = layerState.locked;
                this.layers[index].opacity = layerState.opacity || 100;
                this.layers[index].blendingMode = layerState.blendingMode || 'normal';
                this.layers[index].filters = layerState.filters || [];
                this.layers[index].layer.visible(layerState.visible);
                this.layers[index].layer.opacity((layerState.opacity || 100) / 100);
                // Apply blending mode if supported
                if (layerState.blendingMode && layerState.blendingMode !== 'normal') {
                    this.layers[index].layer.globalCompositeOperation(this.getBlendingModeOperation(layerState.blendingMode));
                } else {
                    this.layers[index].layer.globalCompositeOperation('source-over');
                }
            }
        });
        
        // Update draggable state based on current tool
        this.layers.forEach((layerData, index) => {
            if (index > 0 || !layerData.background) { // Skip background layer
                layerData.layer.find('Shape').forEach(shape => {
                    if (shape.name() !== 'background' && shape.name() !== 'background-image') {
                        shape.draggable(this.currentTool === 'select');
                    }
                });
            }
        });
        
        this.stage.draw();
        
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Reset unsaved changes flag
     */
    resetUnsavedChanges() {
        this.hasUnsavedChanges = false;
    }
    
    /**
     * Export canvas as image data URL
     */
    toDataURL(format = 'image/png', quality = 1.0) {
        return this.stage.toDataURL({
            mimeType: format,
            quality: quality,
            pixelRatio: 2
        });
    }
    
    /**
     * Export canvas as blob
     */
    toBlob(format = 'image/png', quality = 1.0) {
        return new Promise((resolve) => {
            this.stage.toBlob({
                mimeType: format,
                quality: quality,
                pixelRatio: 2,
                callback: (blob) => {
                    resolve(blob);
                }
            });
        });
    }
    
    /**
     * Setup resize handler to maintain aspect ratio
     */
    setupResizeHandler() {
        // Use ResizeObserver to watch the PARENT container, not the wrapper itself
        // This prevents feedback loops where resizing the wrapper triggers another resize
        if (typeof ResizeObserver !== 'undefined' && this.container) {
            // Find the parent container (drawingCanvasContainer) to observe
            const parentContainer = this.container.parentElement;
            if (!parentContainer) return;
            
            this.isResizing = false; // Flag to prevent resize loops
            
            this.resizeObserver = new ResizeObserver((entries) => {
                // Prevent recursive resizing
                if (this.isResizing) return;
                
                if (!this.container || !this.stage) return;
                
                const entry = entries[0];
                if (!entry) return;
                
                const containerRect = entry.contentRect;
                if (containerRect.width <= 0 || containerRect.height <= 0) return;
                
                // Calculate new size maintaining aspect ratio
                // ALWAYS use the current aspect ratio if set, otherwise use original
                // This ensures the aspect ratio is always enforced
                const currentAspectRatio = this.aspectRatio || this.originalAspectRatio;
                const containerAspectRatio = containerRect.width / containerRect.height;
                let newWidth, newHeight;
                
                
                // Ensure we have valid dimensions with padding
                const maxWidth = Math.max(containerRect.width - 40, 200);
                const maxHeight = Math.max(containerRect.height - 40, 150);
                
                // ALWAYS maintain aspect ratio - fit to container while preserving aspect ratio
                if (currentAspectRatio > containerAspectRatio) {
                    // Canvas aspect ratio is wider than container - fit to container width
                    newWidth = maxWidth;
                    newHeight = newWidth / currentAspectRatio;
                    // If calculated height exceeds max, fit to height instead (but maintain aspect ratio)
                    if (newHeight > maxHeight) {
                        newHeight = maxHeight;
                        newWidth = newHeight * currentAspectRatio;
                    }
                } else {
                    // Canvas aspect ratio is taller than container - fit to container height
                    newHeight = maxHeight;
                    newWidth = newHeight * currentAspectRatio;
                    // If calculated width exceeds max, fit to width instead (but maintain aspect ratio)
                    if (newWidth > maxWidth) {
                        newWidth = maxWidth;
                        newHeight = newWidth / currentAspectRatio;
                    }
                }
                
                // Verify aspect ratio is maintained (with small tolerance for floating point)
                const calculatedAspectRatio = newWidth / newHeight;
                const aspectRatioDiff = Math.abs(calculatedAspectRatio - currentAspectRatio);
                if (aspectRatioDiff > 0.01) {
                    // Recalculate to ensure exact aspect ratio
                    if (currentAspectRatio > containerAspectRatio) {
                        newWidth = maxWidth;
                        newHeight = newWidth / currentAspectRatio;
                    } else {
                        newHeight = maxHeight;
                        newWidth = newHeight * currentAspectRatio;
                    }
                }
                
                // Only resize if dimensions actually changed significantly (with threshold to avoid jitter)
                const widthDiff = Math.abs(newWidth - this.width);
                const heightDiff = Math.abs(newHeight - this.height);
                if (widthDiff > 5 || heightDiff > 5) {
                    
                    this.isResizing = true;
                    this.resizeWithScale(newWidth, newHeight);
                    // Reset flag after resize completes
                    setTimeout(() => {
                        this.isResizing = false;
                    }, 100);
                }
            });
            
            // Observe the parent container, not the wrapper itself
            this.resizeObserver.observe(parentContainer);
        }
    }
    
    /**
     * Setup observer to maintain konvajs-content aspect ratio
     */
    setupKonvajsContentObserver() {
        // Watch for changes to konvajs-content and ensure it maintains aspect ratio
        const wrapper = document.getElementById('drawingCanvasWrapper');
        if (!wrapper) return;
        
        // Wait for konvajs-content to be created by Konva
        const checkForKonvajsContent = () => {
            const konvajsContent = wrapper.querySelector('.konvajs-content');
            if (konvajsContent && !this.konvajsContentObserver) {
                const targetAspectRatio = this.aspectRatio || this.originalAspectRatio;
                
                // Function to enforce aspect ratio
                const enforceAspectRatio = () => {
                    if (!konvajsContent || !this.stage) return;
                    
                    const currentWidth = parseFloat(konvajsContent.style.width) || this.width;
                    const currentHeight = parseFloat(konvajsContent.style.height) || this.height;
                    const currentAspectRatio = currentWidth / currentHeight;
                    
                    // If aspect ratio doesn't match, fix it
                    if (Math.abs(currentAspectRatio - targetAspectRatio) > 0.01) {
                        // Use canvas dimensions as the source of truth
                        const correctWidth = this.width;
                        const correctHeight = this.height;
                        
                        konvajsContent.style.width = correctWidth + 'px';
                        konvajsContent.style.height = correctHeight + 'px';
                        konvajsContent.style.minWidth = correctWidth + 'px';
                        konvajsContent.style.minHeight = correctHeight + 'px';
                        konvajsContent.style.maxWidth = correctWidth + 'px';
                        konvajsContent.style.maxHeight = correctHeight + 'px';
                        
                        // Update canvas elements inside
                        const canvasElements = konvajsContent.querySelectorAll('canvas');
                        canvasElements.forEach(canvas => {
                            canvas.style.width = correctWidth + 'px';
                            canvas.style.height = correctHeight + 'px';
                        });
                    }
                };
                
                // Observe changes to konvajs-content
                this.konvajsContentObserver = new MutationObserver((mutations) => {
                    // Only enforce if we're not currently resizing (to avoid loops)
                    if (!this.isResizing) {
                        enforceAspectRatio();
                    }
                });
                
                // Watch for attribute and style changes
                this.konvajsContentObserver.observe(konvajsContent, {
                    attributes: true,
                    attributeFilter: ['style', 'width', 'height'],
                    subtree: true,
                    childList: false
                });
                
                // Also enforce on initial setup
                enforceAspectRatio();
                
                // Periodically check (in case MutationObserver misses something)
                this.konvajsContentCheckInterval = setInterval(() => {
                    if (!this.isResizing) {
                        enforceAspectRatio();
                    }
                }, 100);
            } else if (!konvajsContent) {
                // Keep checking if konvajs-content doesn't exist yet
                setTimeout(checkForKonvajsContent, 100);
            }
        };
        
        // Start checking
        setTimeout(checkForKonvajsContent, 100);
    }
    
    /**
     * Cleanup resize observer and konvajs-content observer
     */
    cleanup() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.konvajsContentObserver) {
            this.konvajsContentObserver.disconnect();
            this.konvajsContentObserver = null;
        }
        if (this.konvajsContentCheckInterval) {
            clearInterval(this.konvajsContentCheckInterval);
            this.konvajsContentCheckInterval = null;
        }
        if (this.stage) {
            this.stage.destroy();
            this.stage = null;
        }
    }
    
    /**
     * Resize canvas with scaling (maintains aspect ratio and scales all content)
     */
    resizeWithScale(newWidth, newHeight) {
        const scaleX = newWidth / this.width;
        const scaleY = newHeight / this.height;
        
        // Update canvas dimensions
        const oldWidth = this.width;
        const oldHeight = this.height;
        this.width = newWidth;
        this.height = newHeight;
        
        // Update wrapper dimensions to match new canvas size
        const wrapperEl = document.getElementById('drawingCanvasWrapper');
        if (wrapperEl) {
            wrapperEl.style.width = newWidth + 'px';
            wrapperEl.style.height = newHeight + 'px';
            wrapperEl.dataset.baseWidth = newWidth;
            wrapperEl.dataset.baseHeight = newHeight;
        }
        
        // CRITICAL: Update image scale factors if we have a background image
        // The scale factors are used to convert coordinates from canvas space to image space
        // When canvas resizes, these factors must be updated to maintain correct coordinate conversion
        if (this.backgroundImageUrl && this.backgroundImageWidth && this.backgroundImageHeight) {
            // Recalculate scale factors based on new canvas size
            // imageScaleX = originalImageWidth / newCanvasWidth
            // imageScaleY = originalImageHeight / newCanvasHeight
            this.imageScaleX = this.backgroundImageWidth / newWidth;
            this.imageScaleY = this.backgroundImageHeight / newHeight;
            // Offset remains 0 since canvas matches image aspect ratio
            this.imageOffsetX = 0;
            this.imageOffsetY = 0;
            this.imageDisplayWidth = newWidth;
            this.imageDisplayHeight = newHeight;
            
            console.log('[RESIZE] Updated scale factors - Image:', this.backgroundImageWidth, 'x', this.backgroundImageHeight);
            console.log('[RESIZE] Canvas:', newWidth, 'x', newHeight);
            console.log('[RESIZE] New scale:', this.imageScaleX, 'x', this.imageScaleY);
        }
        
        // Resize stage
        this.stage.width(newWidth);
        this.stage.height(newHeight);
        
        // Immediately update konvajs-content to maintain aspect ratio
        // This must happen before Konva tries to auto-resize it
        if (wrapperEl) {
            const konvajsContent = wrapperEl.querySelector('.konvajs-content');
            if (konvajsContent) {
                konvajsContent.style.width = newWidth + 'px';
                konvajsContent.style.height = newHeight + 'px';
                konvajsContent.style.minWidth = newWidth + 'px';
                konvajsContent.style.minHeight = newHeight + 'px';
                konvajsContent.style.maxWidth = newWidth + 'px';
                konvajsContent.style.maxHeight = newHeight + 'px';
                konvajsContent.style.boxSizing = 'border-box';
                
                // Update canvas elements inside
                const canvasElements = konvajsContent.querySelectorAll('canvas');
                canvasElements.forEach(canvas => {
                    canvas.style.width = newWidth + 'px';
                    canvas.style.height = newHeight + 'px';
                });
                
            }
        }
        
        // Scale all layers and their content
        this.layers.forEach(layerData => {
            // Update layer clipping
            layerData.layer.clipX(0);
            layerData.layer.clipY(0);
            layerData.layer.clipWidth(newWidth);
            layerData.layer.clipHeight(newHeight);
            
            // Scale all shapes in the layer
            layerData.layer.getChildren().forEach(shape => {
                // Skip background rect and background image (they'll be resized separately)
                if (shape.name() === 'background' || shape.name() === 'background-image') {
                    return;
                }
                
                // Scale position and size
                const oldX = shape.x();
                const oldY = shape.y();
                const oldW = shape.width();
                const oldH = shape.height();
                
                shape.x(oldX * scaleX);
                shape.y(oldY * scaleY);
                
                if (oldW !== undefined && oldW !== null) {
                    shape.width(oldW * scaleX);
                }
                if (oldH !== undefined && oldH !== null) {
                    shape.height(oldH * scaleY);
                }
                
                // Scale stroke width
                if (shape.strokeWidth) {
                    const oldStrokeWidth = shape.strokeWidth();
                    if (oldStrokeWidth) {
                        shape.strokeWidth(oldStrokeWidth * Math.min(scaleX, scaleY));
                    }
                }
                
                // Scale points arrays (for paths, lines, etc.)
                if (shape.points && Array.isArray(shape.points)) {
                    const scaledPoints = [];
                    for (let i = 0; i < shape.points.length; i += 2) {
                        scaledPoints.push(shape.points[i] * scaleX);
                        if (shape.points[i + 1] !== undefined) {
                            scaledPoints.push(shape.points[i + 1] * scaleY);
                        }
                    }
                    shape.points(scaledPoints);
                }
                
                // Scale font size for text
                if (shape.getType && shape.getType() === 'Text') {
                    const oldFontSize = shape.fontSize();
                    if (oldFontSize) {
                        shape.fontSize(oldFontSize * Math.min(scaleX, scaleY));
                    }
                }
            });
            
            // Update background rect if it exists
            const bgRect = layerData.layer.findOne('.background');
            if (bgRect) {
                bgRect.width(newWidth);
                bgRect.height(newHeight);
            }
            
            // Update background image if it exists
            const bgImage = layerData.layer.findOne(node => node.name() === 'background-image');
            if (bgImage) {
                bgImage.width(newWidth);
                bgImage.height(newHeight);
                // Update scale factors
                if (this.backgroundImageWidth && this.backgroundImageHeight) {
                    this.imageScaleX = this.backgroundImageWidth / newWidth;
                    this.imageScaleY = this.backgroundImageHeight / newHeight;
                }
            }
            
            layerData.layer.draw();
        });
        
        // Update clipping
        if (this.clipRect) {
            this.clipRect.width(newWidth);
            this.clipRect.height(newHeight);
        }
        
        // Update transformer if active and has valid nodes
        if (this.transformer && this.transformer.nodes().length > 0) {
            try {
                this.transformer.forceUpdate();
            } catch (error) {
                console.warn('Error updating transformer during resize:', error);
                // Clear transformer if it's invalid
                this.transformer.nodes([]);
            }
        }
        
        // Update canvas container border
        this.updateCanvasContainer();
        
        // Update border element if it exists
        const border = this.container.querySelector('.canvas-border');
        if (border) {
            border.style.width = newWidth + 'px';
            border.style.height = newHeight + 'px';
        }
        
        // Center the canvas wrapper and konvajs-content
        // Wrapper dimensions already updated above, just update additional styles
        if (wrapperEl) {
            wrapperEl.style.minWidth = '0'; // Allow wrapper to shrink
            wrapperEl.style.minHeight = '0'; // Allow wrapper to shrink
            wrapperEl.style.maxWidth = newWidth + 'px'; // Prevent expansion beyond canvas size
            wrapperEl.style.maxHeight = newHeight + 'px'; // Prevent expansion beyond canvas size
            wrapperEl.style.margin = 'auto';
            wrapperEl.style.display = 'block';
            wrapperEl.style.overflow = 'hidden'; // Ensure wrapper clips content
            
            // Update konvajs-content immediately to maintain aspect ratio
            const konvajsContent = wrapperEl.querySelector('.konvajs-content');
            if (konvajsContent) {
                konvajsContent.style.margin = '0 auto';
                konvajsContent.style.display = 'block';
                konvajsContent.style.overflow = 'hidden'; // Ensure content is clipped
                konvajsContent.style.width = newWidth + 'px';
                konvajsContent.style.height = newHeight + 'px';
                konvajsContent.style.minWidth = newWidth + 'px';
                konvajsContent.style.minHeight = newHeight + 'px';
                konvajsContent.style.maxWidth = newWidth + 'px';
                konvajsContent.style.maxHeight = newHeight + 'px';
                konvajsContent.style.boxSizing = 'border-box';
                
                // Also update any canvas elements inside konvajs-content
                const canvasElements = konvajsContent.querySelectorAll('canvas');
                canvasElements.forEach(canvas => {
                    canvas.style.width = newWidth + 'px';
                    canvas.style.height = newHeight + 'px';
                });
            }
        }
        
        // Ensure container also clips
        if (this.container && this.container.parentElement) {
            const container = this.container.parentElement;
            if (container.id === 'drawingCanvasContainer') {
                container.style.overflow = 'hidden';
            }
        }
        
        this.stage.draw();
    }
    
    /**
     * Resize canvas (without scaling content - for initial setup)
     */
    resize(width, height) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = width;
        this.height = height;
        this.stage.width(width);
        this.stage.height(height);
        
        // Update clipping
        if (this.clipRect) {
            this.clipRect.width(width);
            this.clipRect.height(height);
        }
        
        // Update all layers clipping
        this.layers.forEach(layerData => {
            layerData.layer.clipX(0);
            layerData.layer.clipY(0);
            layerData.layer.clipWidth(width);
            layerData.layer.clipHeight(height);
        });
        
        // Remove shapes that are completely outside the new bounds
        this.layers.forEach((layerData, index) => {
            if (index > 0 || !layerData.background) { // Skip background layer
                const shapesToRemove = [];
                
                layerData.layer.find('Shape').forEach(shape => {
                    if (shape.name() !== 'background') {
                        const box = shape.getClientRect();
                        // Check if shape is completely outside bounds
                        if (box.x + box.width < 0 || box.x > width || 
                            box.y + box.height < 0 || box.y > height) {
                            shapesToRemove.push(shape);
                        }
                    }
                });
                
                // Also check Groups and Text nodes
                layerData.layer.find('Group').forEach(group => {
                    const box = group.getClientRect();
                    if (box.x + box.width < 0 || box.x > width || 
                        box.y + box.height < 0 || box.y > height) {
                        shapesToRemove.push(group);
                    }
                });
                
                layerData.layer.find('Text').forEach(text => {
                    const box = text.getClientRect();
                    if (box.x + box.width < 0 || box.x > width || 
                        box.y + box.height < 0 || box.y > height) {
                        shapesToRemove.push(text);
                    }
                });
                
                // Remove shapes outside bounds
                if (shapesToRemove.length > 0) {
                    shapesToRemove.forEach(shape => {
                        // Remove from selection if it was selected
                        if (this.selectedShape === shape) {
                            this.selectedShape = null;
                        }
                        this.selectedShapes = this.selectedShapes.filter(s => s !== shape);
                        shape.destroy();
                    });
                }
            }
        });
        
        // Update transformer if selection was affected
        if (this.selectedShapes.length > 0 || this.selectedShape) {
            const selectedShapes = this.selectedShapes.length > 0 ? this.selectedShapes : [this.selectedShape];
            // Filter out destroyed shapes - check if isDestroyed exists and is a function
            this.transformer.nodes(selectedShapes.filter(s => {
                if (!s) return false;
                // Check if shape is destroyed - Konva shapes have isDestroyed method
                if (typeof s.isDestroyed === 'function') {
                    return !s.isDestroyed();
                }
                // If no isDestroyed method, assume shape is valid
                return true;
            }));
        }
        
        // Save state after removing shapes outside bounds
        if (oldWidth !== width || oldHeight !== height) {
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
        
        // Resize background
        const bgLayer = this.layers[0].layer;
        const bgRect = bgLayer.findOne('.background');
        if (bgRect) {
            bgRect.width(width);
            bgRect.height(height);
        }
        
        // Update canvas container
        this.updateCanvasContainer();
        
        // Update border element if it exists
        const border = this.container.querySelector('.canvas-border');
        if (border) {
            border.style.width = width + 'px';
            border.style.height = height + 'px';
        }
        
        // Center the canvas wrapper and konvajs-content
        const wrapper = document.getElementById('drawingCanvasWrapper');
        if (wrapper) {
            wrapper.style.width = width + 'px';
            wrapper.style.height = height + 'px';
            wrapper.style.minWidth = '0'; // Allow wrapper to shrink
            wrapper.style.minHeight = '0'; // Allow wrapper to shrink
            wrapper.style.maxWidth = width + 'px'; // Prevent expansion beyond canvas size
            wrapper.style.maxHeight = height + 'px'; // Prevent expansion beyond canvas size
            wrapper.style.margin = 'auto';
            wrapper.style.display = 'block';
            wrapper.style.overflow = 'hidden'; // Ensure wrapper clips content
            
            setTimeout(() => {
                const konvajsContent = wrapper.querySelector('.konvajs-content');
                if (konvajsContent) {
                    konvajsContent.style.margin = '0 auto';
                    konvajsContent.style.display = 'block';
                    konvajsContent.style.overflow = 'hidden'; // Ensure content is clipped
                    konvajsContent.style.width = width + 'px';
                    konvajsContent.style.height = height + 'px';
                    konvajsContent.style.minWidth = '0';
                    konvajsContent.style.minHeight = '0';
                    konvajsContent.style.maxWidth = width + 'px';
                    konvajsContent.style.maxHeight = height + 'px';
                }
            }, 50);
        }
        
        // Ensure container also clips
        if (this.container && this.container.parentElement) {
            const container = this.container.parentElement;
            if (container.id === 'drawingCanvasContainer') {
                container.style.overflow = 'hidden';
            }
        }
        
        this.stage.draw();
    }
    
    /**
     * Update canvas container to show paper edges
     */
    updateCanvasContainer() {
        // Add border to show paper edges - create a border element
        if (this.container) {
            // Remove existing border element if any
            const existingBorder = this.container.querySelector('.canvas-border');
            if (existingBorder) {
                existingBorder.remove();
            }
            
            // Create border element
            const border = document.createElement('div');
            border.className = 'canvas-border';
            border.style.position = 'absolute';
            border.style.top = '0';
            border.style.left = '0';
            border.style.width = this.width + 'px';
            border.style.height = this.height + 'px';
            border.style.border = '2px solid #666';
            border.style.pointerEvents = 'none';
            border.style.zIndex = '1000';
            this.container.appendChild(border);
        }
    }
    
    /**
     * Get shape center for transformations
     */
    getShapeCenter(shape) {
        // Get bounding box in stage coordinates (with all transforms applied)
        const box = shape.getClientRect();
        return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2
        };
    }
    
    /**
     * Set shape offset to center and position it correctly
     */
    centerShapeForTransform(shape, centerX, centerY) {
        // Get current transform values to restore them later
        const currentX = shape.x();
        const currentY = shape.y();
        const currentOffsetX = shape.offsetX() || 0;
        const currentOffsetY = shape.offsetY() || 0;
        const currentScaleX = shape.scaleX();
        const currentScaleY = shape.scaleY();
        const currentRotation = shape.rotation() || 0;
        const currentSkewX = shape.skewX() || 0;
        const currentSkewY = shape.skewY() || 0;
        
        // Get the shape's bounding box WITHOUT transforms to get its base size
        const boxNoTransform = shape.getClientRect({ skipTransform: true });
        const shapeWidth = boxNoTransform.width;
        const shapeHeight = boxNoTransform.height;
        
        // Calculate the center offset in the shape's own coordinate system
        const newOffsetX = shapeWidth / 2;
        const newOffsetY = shapeHeight / 2;
        
        // Get current bounding box center (where center currently is in stage coords)
        const currentBox = shape.getClientRect();
        const currentBoxCenterX = currentBox.x + currentBox.width / 2;
        const currentBoxCenterY = currentBox.y + currentBox.height / 2;
        
        // Calculate where the current offset point maps to in stage coordinates
        const absTransformBefore = shape.getAbsoluteTransform();
        const currentOffsetInStage = absTransformBefore.point({ x: currentOffsetX, y: currentOffsetY });
        
        // Set the new offset to center
        shape.offsetX(newOffsetX);
        shape.offsetY(newOffsetY);
        
        // Restore transforms (they will be applied relative to the new offset)
        shape.scaleX(currentScaleX);
        shape.scaleY(currentScaleY);
        shape.rotation(currentRotation);
        shape.skewX(currentSkewX);
        shape.skewY(currentSkewY);
        
        // Calculate where the new offset point maps to in stage coordinates
        const absTransformAfter = shape.getAbsoluteTransform();
        const newOffsetInStage = absTransformAfter.point({ x: newOffsetX, y: newOffsetY });
        
        // Calculate the difference in stage coordinates between old and new offset points
        const offsetDeltaX = newOffsetInStage.x - currentOffsetInStage.x;
        const offsetDeltaY = newOffsetInStage.y - currentOffsetInStage.y;
        
        // Adjust x/y to compensate for the offset change
        // This keeps the visual position of the shape the same
        shape.x(currentX - offsetDeltaX);
        shape.y(currentY - offsetDeltaY);
        
        // Now adjust so the bounding box center is at the desired location
        const boxAfterAdjust = shape.getClientRect();
        const boxCenterAfterX = boxAfterAdjust.x + boxAfterAdjust.width / 2;
        const boxCenterAfterY = boxAfterAdjust.y + boxAfterAdjust.height / 2;
        
        const finalDeltaX = centerX - boxCenterAfterX;
        const finalDeltaY = centerY - boxCenterAfterY;
        
        shape.x(shape.x() + finalDeltaX);
        shape.y(shape.y() + finalDeltaY);
        
        // Log key values for debugging
        const finalBox = shape.getClientRect();
        const finalCenterX = finalBox.x + finalBox.width / 2;
        const finalCenterY = finalBox.y + finalBox.height / 2;
        console.log('=== centerShapeForTransform ===');
        console.log('Desired center:', centerX.toFixed(2), centerY.toFixed(2));
        console.log('Current center (before):', currentBoxCenterX.toFixed(2), currentBoxCenterY.toFixed(2));
        console.log('Final center (after):', finalCenterX.toFixed(2), finalCenterY.toFixed(2));
        console.log('Offset:', `(${currentOffsetX.toFixed(2)},${currentOffsetY.toFixed(2)}) -> (${newOffsetX.toFixed(2)},${newOffsetY.toFixed(2)})`);
        console.log('Position:', `(${currentX.toFixed(2)},${currentY.toFixed(2)}) -> (${shape.x().toFixed(2)},${shape.y().toFixed(2)})`);
        console.log('Transforms:', `scale(${currentScaleX.toFixed(2)},${currentScaleY.toFixed(2)}) rot(${currentRotation.toFixed(2)}°) skew(${currentSkewX.toFixed(2)},${currentSkewY.toFixed(2)})`);
        console.log('Center diff:', (finalCenterX - centerX).toFixed(2), (finalCenterY - centerY).toFixed(2));
    }
    
    /**
     * Flip selected shape horizontally
     */
    flipHorizontal() {
        const shapesToFlip = this.selectedShapes.length > 0 ? this.selectedShapes : (this.selectedShape ? [this.selectedShape] : []);
        
        if (shapesToFlip.length === 0) return;
        
        shapesToFlip.forEach(shape => {
            const centerBefore = this.getShapeCenter(shape);
            const currentScaleX = shape.scaleX();
            
            console.log('=== flipHorizontal ===');
            console.log('Center before:', centerBefore.x.toFixed(2), centerBefore.y.toFixed(2));
            
            // Center the shape for transformation
            this.centerShapeForTransform(shape, centerBefore.x, centerBefore.y);
            
            // Flip
            shape.scaleX(-currentScaleX);
            
            // After flip, the center may have shifted - compensate for it
            const centerAfter = this.getShapeCenter(shape);
            const centerShiftX = centerBefore.x - centerAfter.x;
            const centerShiftY = centerBefore.y - centerAfter.y;
            
            shape.x(shape.x() + centerShiftX);
            shape.y(shape.y() + centerShiftY);
            
            console.log('Center after:', this.getShapeCenter(shape).x.toFixed(2), this.getShapeCenter(shape).y.toFixed(2));
            console.log('Center shift compensated:', centerShiftX.toFixed(2), centerShiftY.toFixed(2));
        });
        
        this.getCurrentLayer().draw();
        this.transformer.forceUpdate();
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
    }
    
    /**
     * Flip selected shape vertically
     */
    flipVertical() {
        const shapesToFlip = this.selectedShapes.length > 0 ? this.selectedShapes : (this.selectedShape ? [this.selectedShape] : []);
        
        if (shapesToFlip.length === 0) return;
        
        shapesToFlip.forEach(shape => {
            const centerBefore = this.getShapeCenter(shape);
            const currentScaleY = shape.scaleY();
            
            console.log('=== flipVertical ===');
            console.log('Center before:', centerBefore.x.toFixed(2), centerBefore.y.toFixed(2));
            
            // Center the shape for transformation
            this.centerShapeForTransform(shape, centerBefore.x, centerBefore.y);
            
            // Flip
            shape.scaleY(-currentScaleY);
            
            // After flip, the center may have shifted - compensate for it
            const centerAfter = this.getShapeCenter(shape);
            const centerShiftX = centerBefore.x - centerAfter.x;
            const centerShiftY = centerBefore.y - centerAfter.y;
            
            shape.x(shape.x() + centerShiftX);
            shape.y(shape.y() + centerShiftY);
            
            console.log('Center after:', this.getShapeCenter(shape).x.toFixed(2), this.getShapeCenter(shape).y.toFixed(2));
            console.log('Center shift compensated:', centerShiftX.toFixed(2), centerShiftY.toFixed(2));
        });
        
        this.getCurrentLayer().draw();
        this.transformer.forceUpdate();
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
    }
    
    /**
     * Apply skew to selected shape
     */
    applySkew(skewX, skewY) {
        const shapesToSkew = this.selectedShapes.length > 0 ? this.selectedShapes : (this.selectedShape ? [this.selectedShape] : []);
        
        if (shapesToSkew.length === 0) return;
        
        shapesToSkew.forEach(shape => {
            const centerBefore = this.getShapeCenter(shape);
            
            console.log('=== applySkew ===');
            console.log('Skew values:', skewX.toFixed(2), skewY.toFixed(2));
            console.log('Center before:', centerBefore.x.toFixed(2), centerBefore.y.toFixed(2));
            
            // Center the shape for transformation
            this.centerShapeForTransform(shape, centerBefore.x, centerBefore.y);
            
            // Apply skew
            shape.skewX(skewX);
            shape.skewY(skewY);
            
            // After skew, the center may have shifted - compensate for it
            const centerAfter = this.getShapeCenter(shape);
            const centerShiftX = centerBefore.x - centerAfter.x;
            const centerShiftY = centerBefore.y - centerAfter.y;
            
            shape.x(shape.x() + centerShiftX);
            shape.y(shape.y() + centerShiftY);
            
            console.log('Center after:', this.getShapeCenter(shape).x.toFixed(2), this.getShapeCenter(shape).y.toFixed(2));
            console.log('Center shift compensated:', centerShiftX.toFixed(2), centerShiftY.toFixed(2));
        });
        
        this.getCurrentLayer().draw();
        this.transformer.forceUpdate();
        this.saveState();
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
    }
    
    /**
     * Apply filter to layer at specific index
     */
    applyLayerFilterAtIndex(layerIndex, filterIndex, filter) {
        if (layerIndex < 0 || layerIndex >= this.layers.length) return;
        
        const layerData = this.layers[layerIndex];
        const layer = layerData.layer;
        const normalizedIntensity = (filter.intensity || 50) / 100;
        
        // Apply to all node types (Shape, Group, Text, Line, etc.)
        const allNodes = [];
        layer.find('Shape').forEach(node => allNodes.push(node));
        layer.find('Group').forEach(node => allNodes.push(node));
        layer.find('Text').forEach(node => allNodes.push(node));
        layer.find('Line').forEach(node => allNodes.push(node));
        
        // Batch filter application for better performance
        const shapesToUpdate = [];
        
        allNodes.forEach(shape => {
            if (!shape.filters) return;
            
            let filters = shape.filters() || [];
            
            // Remove existing filter of same type (for preview filters, remove all previews first)
            const filterName = filter.name.toLowerCase();
            if (filter.isPreview) {
                // Remove all preview filters when adding a new preview
                // Keep only permanent filters (those that match layerData.filters)
                const layerFilters = layerData.filters || [];
                filters = filters.filter(f => {
                    // Check if this filter matches any permanent filter
                    return layerFilters.some(lf => {
                        const lfName = lf.name.toLowerCase();
                        const existingName = (f.name || f.constructor.name || '').toLowerCase();
                        return existingName.includes(lfName);
                    });
                });
            } else {
                // Remove existing filter of same type
                filters = filters.filter(f => {
                    const existingName = (f.name || f.constructor.name || '').toLowerCase();
                    return !existingName.includes(filterName);
                });
            }
            
            // Add new filter if enabled
            if (filter.enabled !== false) {
                let konvaFilter;
                switch(filter.name) {
                    case 'blur':
                        konvaFilter = Konva.Filters.Blur;
                        if (!shape.blurRadius) shape.blurRadius(0);
                        shape.blurRadius(normalizedIntensity * 20);
                        break;
                    case 'brighten':
                        konvaFilter = Konva.Filters.Brighten;
                        if (!shape.brightness) shape.brightness(0);
                        shape.brightness(normalizedIntensity * 0.5);
                        break;
                    case 'contrast':
                        konvaFilter = Konva.Filters.Contrast;
                        if (!shape.contrast) shape.contrast(0);
                        shape.contrast(normalizedIntensity * 0.5);
                        break;
                    case 'emboss':
                        konvaFilter = Konva.Filters.Emboss;
                        break;
                    case 'enhance':
                        konvaFilter = Konva.Filters.Enhance;
                        break;
                    case 'grayscale':
                        konvaFilter = Konva.Filters.Grayscale;
                        break;
                    case 'hue':
                        konvaFilter = Konva.Filters.HSV;
                        if (!shape.hue) shape.hue(0);
                        shape.hue(normalizedIntensity * 360);
                        break;
                    case 'invert':
                        konvaFilter = Konva.Filters.Invert;
                        break;
                    case 'noise':
                        konvaFilter = Konva.Filters.Noise;
                        if (!shape.noise) shape.noise(0);
                        shape.noise(normalizedIntensity);
                        break;
                    case 'pixelate':
                        konvaFilter = Konva.Filters.Pixelate;
                        if (!shape.pixelSize) shape.pixelSize(1);
                        shape.pixelSize(Math.max(1, normalizedIntensity * 20));
                        break;
                    case 'posterize':
                        konvaFilter = Konva.Filters.Posterize;
                        if (!shape.levels) shape.levels(1);
                        shape.levels(Math.max(1, Math.floor(normalizedIntensity * 20)));
                        break;
                    case 'rgb':
                        konvaFilter = Konva.Filters.RGB;
                        if (!shape.red) shape.red(0);
                        if (!shape.green) shape.green(0);
                        if (!shape.blue) shape.blue(0);
                        shape.red(normalizedIntensity * 255);
                        shape.green(normalizedIntensity * 255);
                        shape.blue(normalizedIntensity * 255);
                        break;
                    case 'saturate':
                        konvaFilter = Konva.Filters.HSV;
                        if (!shape.saturation) shape.saturation(0);
                        shape.saturation(normalizedIntensity);
                        break;
                    case 'sepia':
                        konvaFilter = Konva.Filters.Sepia;
                        break;
                    case 'sharpen':
                        konvaFilter = Konva.Filters.Sharpen;
                        break;
                    case 'solarize':
                        konvaFilter = Konva.Filters.Solarize;
                        break;
                    case 'threshold':
                        konvaFilter = Konva.Filters.Threshold;
                        if (!shape.threshold) shape.threshold(0);
                        shape.threshold(normalizedIntensity);
                        break;
                    default:
                        return;
                }
                
                if (konvaFilter) {
                    filters.push(konvaFilter);
                    shape.filters(filters);
                    shapesToUpdate.push(shape);
                }
            } else {
                // Filter disabled - remove it but keep shape cached
                shape.filters(filters);
                shapesToUpdate.push(shape);
            }
        });
        
        // Batch cache update for better performance
        shapesToUpdate.forEach(shape => {
            if (shape.cache) shape.cache();
        });
        
        layer.draw();
        this.hasUnsavedChanges = true;
    }
    
    /**
     * Clear preview filters from layer (filters marked with isPreview: true)
     */
    clearPreviewFilters(layerIndex) {
        if (layerIndex < 0 || layerIndex >= this.layers.length) return;
        
        const layer = this.layers[layerIndex].layer;
        
        // Remove preview filters from all node types
        const allNodes = [];
        layer.find('Shape').forEach(node => allNodes.push(node));
        layer.find('Group').forEach(node => allNodes.push(node));
        layer.find('Text').forEach(node => allNodes.push(node));
        layer.find('Line').forEach(node => allNodes.push(node));
        
        allNodes.forEach(shape => {
            if (!shape.filters) return;
            
            let filters = shape.filters() || [];
            // Remove filters that were added as preview (we'll track this differently)
            // For now, we'll clear all filters and reapply only permanent ones
            // This is handled by the fact that preview filters are temporary
        });
        
        // Reapply only permanent filters from layerData.filters
        const layerData = this.layers[layerIndex];
        if (layerData.filters && layerData.filters.length > 0) {
            // Clear all filters first
            allNodes.forEach(shape => {
                if (shape.filters) {
                    shape.filters([]);
                    if (shape.cache) shape.cache();
                }
            });
            
            // Reapply permanent filters
            layerData.filters.forEach((filter, idx) => {
                if (filter.enabled !== false) {
                    this.applyLayerFilterAtIndex(layerIndex, idx, filter);
                }
            });
        } else {
            // No permanent filters - clear all
            allNodes.forEach(shape => {
                if (shape.filters) {
                    shape.filters([]);
                    if (shape.cache) shape.cache();
                }
            });
        }
        
        layer.draw();
    }
    
    /**
     * Remove filter from layer at specific index
     */
    removeLayerFilterAtIndex(layerIndex, filterIndex) {
        if (layerIndex < 0 || layerIndex >= this.layers.length) return;
        
        const layerData = this.layers[layerIndex];
        if (!layerData.filters || filterIndex < 0 || filterIndex >= layerData.filters.length) return;
        
        const removedFilter = layerData.filters[filterIndex];
        const layer = layerData.layer;
        
        // Remove filter from all node types in layer
        const allNodes = [];
        layer.find('Shape').forEach(node => allNodes.push(node));
        layer.find('Group').forEach(node => allNodes.push(node));
        layer.find('Text').forEach(node => allNodes.push(node));
        layer.find('Line').forEach(node => allNodes.push(node));
        
        allNodes.forEach(shape => {
            if (!shape.filters) return;
            
            let filters = shape.filters() || [];
            const filterName = removedFilter.name.toLowerCase();
            
            filters = filters.filter(f => {
                const existingName = (f.name || f.constructor.name || '').toLowerCase();
                return !existingName.includes(filterName);
            });
            
            shape.filters(filters);
            if (shape.cache) shape.cache();
        });
        
        layer.draw();
        this.hasUnsavedChanges = true;
    }
    
    /**
     * Apply filter to current layer
     */
    applyLayerFilter(filterType, intensity = 50) {
        if (!filterType) {
            // Remove all filters from current layer
            const layer = this.getCurrentLayer();
            layer.find('Shape').forEach(shape => {
                if (shape.filters && shape.filters().length > 0) {
                    shape.filters([]);
                    shape.cache();
                }
            });
            layer.draw();
            this.hasUnsavedChanges = true;
            return;
        }
        
        const layer = this.getCurrentLayer();
        const normalizedIntensity = intensity / 100;
        
        layer.find('Shape').forEach(shape => {
            if (!shape.filters) return;
            
            let filters = shape.filters() || [];
            
            // Remove existing filter of same type
            filters = filters.filter(f => {
                const filterName = f.name || f.constructor.name;
                return !filterName.toLowerCase().includes(filterType.toLowerCase());
            });
            
            // Add new filter
            let filter;
            switch(filterType) {
                case 'blur':
                    filter = Konva.Filters.Blur;
                    if (!shape.blurRadius) shape.blurRadius(0);
                    shape.blurRadius(normalizedIntensity * 20);
                    break;
                case 'brighten':
                    filter = Konva.Filters.Brighten;
                    if (!shape.brightness) shape.brightness(0);
                    shape.brightness(normalizedIntensity * 0.5);
                    break;
                case 'contrast':
                    filter = Konva.Filters.Contrast;
                    if (!shape.contrast) shape.contrast(0);
                    shape.contrast(normalizedIntensity * 0.5);
                    break;
                case 'emboss':
                    filter = Konva.Filters.Emboss;
                    break;
                case 'enhance':
                    filter = Konva.Filters.Enhance;
                    break;
                case 'grayscale':
                    filter = Konva.Filters.Grayscale;
                    break;
                case 'hue':
                    filter = Konva.Filters.HSV;
                    if (!shape.hue) shape.hue(0);
                    shape.hue(normalizedIntensity * 360);
                    break;
                case 'invert':
                    filter = Konva.Filters.Invert;
                    break;
                case 'noise':
                    filter = Konva.Filters.Noise;
                    if (!shape.noise) shape.noise(0);
                    shape.noise(normalizedIntensity);
                    break;
                case 'pixelate':
                    filter = Konva.Filters.Pixelate;
                    if (!shape.pixelSize) shape.pixelSize(1);
                    shape.pixelSize(Math.max(1, normalizedIntensity * 20));
                    break;
                case 'posterize':
                    filter = Konva.Filters.Posterize;
                    if (!shape.levels) shape.levels(1);
                    shape.levels(Math.max(1, Math.floor(normalizedIntensity * 20)));
                    break;
                case 'rgb':
                    filter = Konva.Filters.RGB;
                    if (!shape.red) shape.red(0);
                    if (!shape.green) shape.green(0);
                    if (!shape.blue) shape.blue(0);
                    shape.red(normalizedIntensity * 255);
                    shape.green(normalizedIntensity * 255);
                    shape.blue(normalizedIntensity * 255);
                    break;
                case 'saturate':
                    filter = Konva.Filters.HSV;
                    if (!shape.saturation) shape.saturation(0);
                    shape.saturation(normalizedIntensity);
                    break;
                case 'sepia':
                    filter = Konva.Filters.Sepia;
                    break;
                case 'sharpen':
                    filter = Konva.Filters.Sharpen;
                    break;
                case 'solarize':
                    filter = Konva.Filters.Solarize;
                    break;
                case 'threshold':
                    filter = Konva.Filters.Threshold;
                    if (!shape.threshold) shape.threshold(0);
                    shape.threshold(normalizedIntensity);
                    break;
                default:
                    return;
            }
            
            if (filter) {
                filters.push(filter);
                shape.filters(filters);
                shape.cache();
            }
        });
        
        layer.draw();
        this.hasUnsavedChanges = true;
    }
    
    /**
     * Apply filter to selected shape or layer
     */
    applyFilter(filterName, value) {
        if (this.selectedShape) {
            // Apply filter to selected shape
            if (!this.selectedShape.filters()) {
                this.selectedShape.filters([]);
            }
            const filters = this.selectedShape.filters();
            
            // Remove existing filter of same type
            const filterIndex = filters.findIndex(f => f.name === filterName);
            if (filterIndex >= 0) {
                filters.splice(filterIndex, 1);
            }
            
            // Add new filter
            if (value !== null && value !== undefined) {
                let filter;
                switch(filterName) {
                    case 'blur':
                        filter = Konva.Filters.Blur;
                        this.selectedShape.blurRadius(value);
                        break;
                    case 'brighten':
                        filter = Konva.Filters.Brighten;
                        this.selectedShape.brightness(value);
                        break;
                    case 'contrast':
                        filter = Konva.Filters.Contrast;
                        this.selectedShape.contrast(value);
                        break;
                    case 'hue':
                        filter = Konva.Filters.HSV;
                        this.selectedShape.hue(value);
                        break;
                    case 'saturation':
                        filter = Konva.Filters.HSV;
                        this.selectedShape.saturation(value);
                        break;
                    case 'noise':
                        filter = Konva.Filters.Noise;
                        this.selectedShape.noise(value);
                        break;
                    case 'pixelate':
                        filter = Konva.Filters.Pixelate;
                        this.selectedShape.pixelSize(value);
                        break;
                    case 'posterize':
                        filter = Konva.Filters.Posterize;
                        this.selectedShape.levels(value);
                        break;
                    case 'sepia':
                        filter = Konva.Filters.Sepia;
                        break;
                    case 'grayscale':
                        filter = Konva.Filters.Grayscale;
                        break;
                    case 'emboss':
                        filter = Konva.Filters.Emboss;
                        break;
                    case 'sharpen':
                        filter = Konva.Filters.Sharpen;
                        break;
                }
                
                if (filter) {
                    filters.push(filter);
                    this.selectedShape.filters(filters);
                    this.selectedShape.cache();
                }
            } else {
                this.selectedShape.filters(filters);
                this.selectedShape.cache();
            }
            
            this.getCurrentLayer().draw();
            this.saveState();
            if (this.onHistoryChange) {
                this.onHistoryChange();
            }
        }
    }
    
    /**
     * Crop canvas to specified area
     */
    crop(x, y, width, height) {
        // Create a temporary canvas to capture the cropped area
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Get the current canvas image
        const dataURL = this.stage.toDataURL({ pixelRatio: 2 });
        const img = new Image();
        
        img.onload = () => {
            // Draw the cropped portion to temp canvas
            tempCtx.drawImage(img, x, y, width, height, 0, 0, width, height);
            
            // Resize the stage
            this.resize(width, height);
            
            // Clear all layers
            this.layers.forEach(layerData => {
                if (layerData.background) {
                    const bgRect = layerData.layer.findOne('.background');
                    if (bgRect) {
                        bgRect.fill('#ffffff');
                    }
                } else {
                    layerData.layer.destroyChildren();
                }
            });
            
            // Create a new image from the cropped canvas
            const croppedImg = new Image();
            croppedImg.onload = () => {
                const imageNode = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: croppedImg,
                    width: width,
                    height: height
                });
                this.getCurrentLayer().add(imageNode);
                this.stage.draw();
                
                // Center the canvas wrapper and konvajs-content
                const wrapper = document.getElementById('drawingCanvasWrapper');
                const container = document.getElementById('drawingCanvasContainer');
                if (wrapper && container) {
                    wrapper.style.width = width + 'px';
                    wrapper.style.height = height + 'px';
                    wrapper.style.margin = 'auto';
                    wrapper.style.display = 'block';
                    
                    setTimeout(() => {
                        const konvajsContent = wrapper.querySelector('.konvajs-content');
                        if (konvajsContent) {
                            konvajsContent.style.margin = '0 auto';
                            konvajsContent.style.display = 'block';
                        }
                    }, 50);
                }
                
                this.saveState();
                if (this.onHistoryChange) {
                    this.onHistoryChange();
                }
                if (this.onLayersChange) {
                    this.onLayersChange();
                }
            };
            croppedImg.src = tempCanvas.toDataURL();
        };
        
        img.src = dataURL;
    }
    
    /**
     * Set layer opacity (0-100)
     */
    setLayerOpacity(layerIndex, opacity) {
        if (layerIndex < 0 || layerIndex >= this.layers.length) return;
        
        const layerData = this.layers[layerIndex];
        layerData.opacity = Math.max(0, Math.min(100, opacity));
        layerData.layer.opacity(opacity / 100);
        layerData.layer.draw();
        
        this.hasUnsavedChanges = true;
        this.saveState();
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Set layer blending mode
     */
    setLayerBlendingMode(layerIndex, blendingMode) {
        if (layerIndex < 0 || layerIndex >= this.layers.length) return;
        
        const layerData = this.layers[layerIndex];
        layerData.blendingMode = blendingMode;
        
        // Apply blending mode using globalCompositeOperation
        const operation = this.getBlendingModeOperation(blendingMode);
        layerData.layer.globalCompositeOperation(operation);
        layerData.layer.draw();
        
        this.hasUnsavedChanges = true;
        this.saveState();
        if (this.onLayersChange) {
            this.onLayersChange();
        }
    }
    
    /**
     * Convert blending mode name to canvas globalCompositeOperation
     */
    getBlendingModeOperation(blendingMode) {
        const modeMap = {
            'normal': 'source-over',
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
        return modeMap[blendingMode] || 'source-over';
    }
    
    /**
     * Import image to current layer
     */
    importImage(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Invalid file type'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const layer = this.getCurrentLayer();
                    
                    // Calculate size to fit within canvas while maintaining aspect ratio
                    let imgWidth = img.width;
                    let imgHeight = img.height;
                    const maxWidth = this.width;
                    const maxHeight = this.height;
                    
                    if (imgWidth > maxWidth || imgHeight > maxHeight) {
                        const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                        imgWidth = imgWidth * scale;
                        imgHeight = imgHeight * scale;
                    }
                    
                    // Center the image
                    const x = (this.width - imgWidth) / 2;
                    const y = (this.height - imgHeight) / 2;
                    
                    const konvaImage = new Konva.Image({
                        x: x,
                        y: y,
                        image: img,
                        width: imgWidth,
                        height: imgHeight,
                        draggable: this.currentTool === 'select'
                    });
                    
                    layer.add(konvaImage);
                    layer.draw();
                    
                    this.hasUnsavedChanges = true;
                    this.saveState();
                    if (this.onHistoryChange) {
                        this.onHistoryChange();
                    }
                    
                    resolve(konvaImage);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Rasterize a shape (convert to image) for better performance and transform quality
     */
    rasterizeShape(shape, layer) {
        try {
            if (!shape || !layer) return;
            
            // Get shape bounds - use getClientRect to get the actual bounding box
            const box = shape.getClientRect();
            if (box.width === 0 || box.height === 0 || !box.width || !box.height) return;
            
            // Create a temporary layer to render the shape
            const tempStage = new Konva.Stage({
                container: document.createElement('div'),
                width: Math.ceil(box.width) + 2, // Add padding to avoid edge clipping
                height: Math.ceil(box.height) + 2
            });
            const tempLayer = new Konva.Layer();
            tempStage.add(tempLayer);
            
            // Clone shape and position it relative to its bounding box
            const clonedShape = shape.clone();
            // Move cloned shape to origin of temp canvas (accounting for padding)
            clonedShape.x(clonedShape.x() - box.x + 1);
            clonedShape.y(clonedShape.y() - box.y + 1);
            tempLayer.add(clonedShape);
            tempLayer.draw();
            
            // Get image data from the layer
            const dataURL = tempLayer.toDataURL();
            
            // Create Konva Image from the rasterized data
            const img = new Image();
            img.onload = () => {
                if (!shape.parent) return; // Shape was already destroyed
                
                // Use the bounding box position to preserve exact location
                const konvaImage = new Konva.Image({
                    x: box.x,
                    y: box.y,
                    image: img,
                    width: box.width,
                    height: box.height,
                    draggable: shape.draggable(),
                    opacity: shape.opacity(),
                    globalCompositeOperation: shape.globalCompositeOperation()
                });
                
                // Replace the original shape with the rasterized image
                const children = layer.getChildren();
                const shapeIndex = children.indexOf(shape);
                if (shapeIndex >= 0) {
                    shape.destroy();
                    layer.add(konvaImage);
                    
                    // Maintain z-order
                    const newChildren = layer.getChildren();
                    const imageIndex = newChildren.indexOf(konvaImage);
                    if (imageIndex !== shapeIndex) {
                        konvaImage.moveToTop();
                        for (let i = 0; i < shapeIndex; i++) {
                            konvaImage.moveDown();
                        }
                    }
                    
                    layer.draw();
                }
                
                // Clean up
                tempStage.destroy();
            };
            img.onerror = () => {
                tempStage.destroy();
            };
            img.src = dataURL;
        } catch (error) {
            // If rasterization fails, just keep the original shape
            console.error('Rasterization error:', error);
        }
    }
    
    /**
     * Set zoom level - scales the container, not the stage
     */
    setZoom(zoomLevel) {
        this.zoomLevel = Math.max(0.1, Math.min(5, zoomLevel));
        
        // Find the canvas wrapper element by ID
        const wrapper = document.getElementById('drawingCanvasWrapper');
        const container = document.getElementById('drawingCanvasContainer');
        
        if (wrapper) {
            // IMPORTANT: Use stored base dimensions from aspect ratio, or fall back to canvas dimensions
            // This ensures zoom doesn't break aspect ratio constraints
            const baseWidth = wrapper.dataset.baseWidth ? parseFloat(wrapper.dataset.baseWidth) : this.width;
            const baseHeight = wrapper.dataset.baseHeight ? parseFloat(wrapper.dataset.baseHeight) : this.height;
            
            // Scale the wrapper using CSS transform
            wrapper.style.transform = `scale(${this.zoomLevel})`;
            wrapper.style.transformOrigin = 'center center';
            
            // Keep wrapper at base size - transform handles visual scaling
            wrapper.style.width = baseWidth + 'px';
            wrapper.style.height = baseHeight + 'px';
            
            // Make container scrollable if zoomed in
            if (container) {
                if (this.zoomLevel > 1) {
                    container.style.overflow = 'auto';
                } else {
                    container.style.overflow = 'hidden';
                }
            }
        }
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        this.setZoom(this.zoomLevel * 1.2);
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        this.setZoom(this.zoomLevel * 0.8);
    }
    
    /**
     * Fit to screen
     */
    zoomFit() {
        const container = this.container.closest('#drawingCanvasContainer') || this.container.parentElement?.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const scaleX = containerRect.width / this.width;
            const scaleY = containerRect.height / this.height;
            const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
            this.setZoom(scale);
        }
    }
    
    /**
     * Reset zoom to 1:1
     */
    zoomReset() {
        this.setZoom(1);
    }
    
    /**
     * Destroy canvas
     */
    destroy() {
        if (this.stage) {
            this.stage.destroy();
        }
        this.container.innerHTML = '';
    }
}

