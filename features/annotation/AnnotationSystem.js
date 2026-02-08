/**
 * Annotation System using Konva.js
 * Provides drawing and annotation tools for storyboard pages
 */
class AnnotationSystem {
    constructor(app) {
        this.app = app;
        this.isEnabled = false;
        this.currentTool = 'brush';
        this.brushSize = 5;
        this.brushColor = '#000000';
        this.fillColor = 'transparent';
        
        // Store Konva stages for each page
        this.stages = new Map();
        
        // Drawing state
        this.drawingState = new Map(); // pageIndex -> { isDrawing, currentLine, currentShape, etc. }
        
        // History for undo/redo
        this.history = new Map(); // pageIndex -> [{ action, data }]
        this.historyIndex = new Map(); // pageIndex -> current history index
    }
    
    /**
     * Initialize Konva stage for a page
     */
    initCanvas(pageElement, pageIndex) {
        // Remove existing stage if present
        if (this.stages.has(pageIndex)) {
            const existing = this.stages.get(pageIndex);
            if (existing.stage) {
                existing.stage.destroy();
            }
            if (existing.container && existing.container.parentNode) {
                existing.container.parentNode.removeChild(existing.container);
            }
            this.stages.delete(pageIndex);
        }
        
        // Get page dimensions
        const pageWidth = pageElement.offsetWidth;
        const pageHeight = pageElement.offsetHeight;
        
        // Create container div for Konva
        const container = document.createElement('div');
        container.className = 'annotation-canvas-container';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        // Set pointerEvents based on current enabled state
        container.style.pointerEvents = this.isEnabled ? 'auto' : 'none';
        container.style.zIndex = '1000';
        
        pageElement.appendChild(container);
        
        // Create Konva stage
        const stage = new Konva.Stage({
            container: container,
            width: pageWidth,
            height: pageHeight
        });
        
        // Create layer for annotations
        const layer = new Konva.Layer();
        stage.add(layer);
        
        // Store stage and layer
        this.stages.set(pageIndex, {
            stage: stage,
            layer: layer,
            container: container,
            pageElement: pageElement
        });
        
        // Initialize drawing state
        this.drawingState.set(pageIndex, {
            isDrawing: false,
            currentLine: null,
            currentShape: null,
            startPoint: null
        });
        
        // Initialize history
        this.history.set(pageIndex, []);
        this.historyIndex.set(pageIndex, -1);
        
        // Load existing annotations if any
        this.loadAnnotations(pageIndex);
        
        // Setup event listeners
        this.setupCanvasEvents(stage, layer, pageIndex);
        
        // Apply current tool settings
        this.setTool(this.currentTool);
    }
    
    /**
     * Setup event listeners for canvas
     */
    setupCanvasEvents(stage, layer, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        
        stage.on('mousedown touchstart', (e) => {
            if (!this.isEnabled) return;
            
            e.evt.preventDefault();
            const pos = stage.getPointerPosition();
            
            if (this.currentTool === 'select') {
                // Check if clicking on empty space to deselect
                const clickedOnEmpty = e.target === stage;
                if (clickedOnEmpty) {
                    // Remove transformer if clicking on empty space
                    const transformer = layer.findOne('Transformer');
                    if (transformer) {
                        transformer.destroy();
                        layer.draw();
                    }
                }
                // Let Konva handle selection naturally for shapes
                return;
            }
            
            state.isDrawing = true;
            state.startPoint = pos;
            
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                this.startFreehandDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'line') {
                this.startLineDrawing(layer, pos, pageIndex);
            } else if (this.currentTool.startsWith('arrow')) {
                this.startArrowDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'rectangle') {
                this.startRectangleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'circle' || this.currentTool === 'ellipse') {
                this.startCircleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'triangle' || this.currentTool === 'polygon') {
                this.startPolygonDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'eraser') {
                this.startErasing(layer, pos, pageIndex);
            }
        });
        
        stage.on('mousemove touchmove', (e) => {
            if (!this.isEnabled || !state.isDrawing) return;
            
            e.evt.preventDefault();
            const pos = stage.getPointerPosition();
            
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                this.continueFreehandDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'line') {
                this.updateLineDrawing(layer, pos, pageIndex);
            } else if (this.currentTool.startsWith('arrow')) {
                this.updateArrowDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'rectangle') {
                this.updateRectangleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'circle' || this.currentTool === 'ellipse') {
                this.updateCircleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'triangle' || this.currentTool === 'polygon') {
                this.updatePolygonDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'eraser') {
                this.continueErasing(layer, pos, pageIndex);
            }
        });
        
        stage.on('mouseup touchend', (e) => {
            if (!this.isEnabled || !state.isDrawing) return;
            
            e.evt.preventDefault();
            const pos = stage.getPointerPosition();
            
            state.isDrawing = false;
            
            if (this.currentTool === 'brush' || this.currentTool === 'pen') {
                this.finishFreehandDrawing(layer, pageIndex);
            } else if (this.currentTool === 'line') {
                this.finishLineDrawing(layer, pos, pageIndex);
            } else if (this.currentTool.startsWith('arrow')) {
                this.finishArrowDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'rectangle') {
                this.finishRectangleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'circle' || this.currentTool === 'ellipse') {
                this.finishCircleDrawing(layer, pos, pageIndex);
            } else if (this.currentTool === 'triangle' || this.currentTool === 'polygon') {
                this.finishPolygonDrawing(layer, pos, pageIndex);
            }
            
            // Save annotations
            this.saveAnnotations(pageIndex);
        });
    }
    
    /**
     * Start freehand drawing
     */
    startFreehandDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        
        // Differentiate brush and pen tools
        // Brush: softer edges, opacity variation, smoother
        // Pen: hard edges, consistent opacity, sharp
        const isBrush = this.currentTool === 'brush';
        
        const line = new Konva.Line({
            points: [pos.x, pos.y],
            stroke: this.brushColor,
            strokeWidth: this.brushSize,
            lineCap: isBrush ? 'round' : 'square',
            lineJoin: isBrush ? 'round' : 'miter',
            tension: isBrush ? 0.5 : 0, // Smooth curves for brush, straight lines for pen
            opacity: isBrush ? 0.8 : 1.0, // Slightly transparent for brush
            shadowBlur: isBrush ? this.brushSize * 0.3 : 0, // Soft shadow for brush
            shadowColor: this.brushColor,
            shadowOpacity: isBrush ? 0.3 : 0
        });
        
        line.setAttr('data-page-index', pageIndex);
        layer.add(line);
        state.currentLine = line;
    }
    
    /**
     * Continue freehand drawing
     */
    continueFreehandDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentLine) return;
        
        const points = state.currentLine.points();
        points.push(pos.x, pos.y);
        state.currentLine.points(points);
        layer.batchDraw();
    }
    
    /**
     * Finish freehand drawing
     */
    finishFreehandDrawing(layer, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (state.currentLine) {
            this.addToHistory(pageIndex, 'add', state.currentLine);
            state.currentLine = null;
        }
    }
    
    /**
     * Start line drawing
     */
    startLineDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        const line = new Konva.Line({
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: this.brushColor,
            strokeWidth: this.brushSize,
            lineCap: 'round'
        });
        
        line.setAttr('data-page-index', pageIndex);
        layer.add(line);
        state.currentShape = line;
    }
    
    /**
     * Update line drawing
     */
    updateLineDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        state.currentShape.points([start.x, start.y, pos.x, pos.y]);
        layer.batchDraw();
    }
    
    /**
     * Finish line drawing
     */
    finishLineDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (state.currentShape) {
            this.addToHistory(pageIndex, 'add', state.currentShape);
            this.makeSelectable(state.currentShape);
            state.currentShape = null;
        }
    }
    
    /**
     * Start brush arrow drawing (freehand line with arrowhead at end)
     * Note: This appears to be incomplete/unused code
     */
    startBrushArrowDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state || !state.currentLine) {
            return; // No current line to convert to arrow
        }
        
        // Calculate angle for arrowhead
        const endX = pos.x;
        const endY = pos.y;
        const linePoints = state.currentLine.points();
        const prevX = linePoints.length >= 2 ? linePoints[linePoints.length - 4] : endX - 10;
        const prevY = linePoints.length >= 2 ? linePoints[linePoints.length - 3] : endY;
        const dx = endX - prevX;
        const dy = endY - prevY;
        const angle = Math.atan2(dy, dx);
        
        // Create arrowhead
        const arrowLength = 15;
        const arrowWidth = 15;
        
        // Create arrowhead
        const arrowHead = new Konva.Arrow({
            x: endX,
            y: endY,
            points: [0, 0, arrowLength, 0],
            pointerLength: arrowLength,
            pointerWidth: arrowWidth,
            fill: this.brushColor,
            stroke: this.brushColor,
            strokeWidth: this.brushSize,
            rotation: angle * 180 / Math.PI
        });
        
        // Create a group to hold both line and arrowhead
        const combinedGroup = new Konva.Group();
        combinedGroup.setAttr('data-page-index', pageIndex);
        
        // Remove line from layer and add to group
        state.currentLine.remove();
        combinedGroup.add(state.currentLine);
        
        // Add arrowhead to group
        combinedGroup.add(arrowHead);
        
        // Add group to layer
        layer.add(combinedGroup);
        
        this.makeSelectable(combinedGroup);
        this.addToHistory(pageIndex, 'add', combinedGroup);
        
        state.currentLine = null;
        layer.batchDraw();
    }
    
    /**
     * Start arrow drawing
     */
    startArrowDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        // Create a temporary line for preview
        const line = new Konva.Line({
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: this.brushColor,
            strokeWidth: this.brushSize,
            lineCap: 'round',
            lineJoin: 'round'
        });
        line.setAttr('data-page-index', pageIndex);
        line.setAttr('data-temp-arrow', true);
        layer.add(line);
        state.currentShape = line;
    }
    
    /**
     * Update arrow drawing
     */
    updateArrowDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        state.currentShape.points([start.x, start.y, pos.x, pos.y]);
        layer.batchDraw();
    }
    
    /**
     * Transform points from example coordinates to actual coordinates
     */
    transformPoints(points, exampleStartX, exampleStartY, exampleEndX, exampleEndY, actualStartX, actualStartY, actualEndX, actualEndY) {
        const exampleDx = exampleEndX - exampleStartX;
        const exampleDy = exampleEndY - exampleStartY;
        const actualDx = actualEndX - actualStartX;
        const actualDy = actualEndY - actualStartY;
        
        const exampleLength = Math.sqrt(exampleDx * exampleDx + exampleDy * exampleDy);
        const actualLength = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
        const scale = actualLength / exampleLength;
        
        const exampleAngle = Math.atan2(exampleDy, exampleDx);
        const actualAngle = Math.atan2(actualDy, actualDx);
        const angleDiff = actualAngle - exampleAngle;
        
        const cos = Math.cos(angleDiff);
        const sin = Math.sin(angleDiff);
        
        return points.map((p, i) => {
            if (i % 2 === 0) {
                const x = p - exampleStartX;
                const y = points[i + 1] - exampleStartY;
                const rotX = x * cos - y * sin;
                const rotY = x * sin + y * cos;
                const scaledX = rotX * scale;
                const scaledY = rotY * scale;
                return [actualStartX + scaledX, actualStartY + scaledY];
            }
            return null;
        }).filter(p => p !== null).flat();
    }
    
    /**
     * Finish arrow drawing - creates different arrow types based on tool
     */
    finishArrowDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        const startX = start.x;
        const startY = start.y;
        const endX = pos.x;
        const endY = pos.y;
        
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 20) {
            state.currentShape.destroy();
            state.currentShape = null;
            layer.batchDraw();
            return;
        }
        
        const arrowType = this.currentTool;
        const angle = Math.atan2(dy, dx);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Remove temporary line
        state.currentShape.destroy();
        
        let arrowShape = null;
        let arrowGroup = null;
        
        // Helper function to transform points to match start/end coordinates
        // Points are transformed so the first point is at start and last point is at end
        const transformPoints = (points, expectedLength = 120) => {
            if (points.length < 4) return points;
            
            // Get first and last points from example
            const firstX = points[0];
            const firstY = points[1];
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            
            // Calculate example vector
            const exampleDx = lastX - firstX;
            const exampleDy = lastY - firstY;
            const exampleLength = Math.sqrt(exampleDx * exampleDx + exampleDy * exampleDy);
            
            if (exampleLength === 0) return points;
            
            // Calculate scale
            const scale = length / exampleLength;
            
            // Calculate rotation angle
            const exampleAngle = Math.atan2(exampleDy, exampleDx);
            const actualAngle = angle;
            const rotation = actualAngle - exampleAngle;
            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);
            
            // Transform all points
            const transformed = [];
            for (let i = 0; i < points.length; i += 2) {
                // Translate to origin (relative to first point)
                const relX = (points[i] - firstX) * scale;
                const relY = (points[i + 1] - firstY) * scale;
                
                // Rotate
                const rotX = relX * cosR - relY * sinR;
                const rotY = relX * sinR + relY * cosR;
                
                // Translate to start position
                transformed.push(startX + rotX, startY + rotY);
            }
            return transformed;
        };
        
        // Helper to get center point of path for positioning
        const getPathCenter = (pathData) => {
            // Extract approximate center from path data
            // For most paths, we can estimate from the data
            const matches = pathData.match(/M\s*(\d+),(\d+)/);
            if (matches) {
                return { x: parseFloat(matches[1]), y: parseFloat(matches[2]) };
            }
            return { x: 0, y: 0 };
        };
        
        // Helper function to transform path data
        const transformPath = (pathData, exampleWidth, exampleHeight) => {
            const scaleX = length / exampleWidth;
            const scaleY = length / exampleHeight;
            const scale = Math.min(scaleX, scaleY);
            return { pathData, scale, angle };
        };
        
        switch (arrowType) {
            case 'arrow':
                // Standard Konva Arrow
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 15,
                    pointerWidth: 15,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    draggable: false
                });
                break;
                
            case 'arrow-roll':
                // 3. CAMERA ROLL - exact from example
                // Path goes from (0,40) to (100,40) - center at y=40
                const rollScale = length / 100;
                arrowGroup = new Konva.Group({ x: startX, y: startY - (40 * rollScale), draggable: false });
                const rollPath = new Konva.Path({
                    data: 'M0,40 C20,10 40,10 50,40 C60,70 80,70 100,40',
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    lineCap: 'round'
                });
                const rollHead = new Konva.Arrow({
                    points: [100, 40, 110, 30],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.scaleX(rollScale);
                arrowGroup.scaleY(rollScale);
                arrowGroup.add(rollPath, rollHead);
                break;
                
            case 'arrow-zoom-in':
                // 4. ZOOM IN (Perspective) - exact from example
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY,
                    data: 'M0,20 L0,80 L70,65 L70,80 L120,50 L70,20 L70,35 Z',
                    fill: this.brushColor,
                    draggable: false,
                    shadowColor: 'black',
                    shadowBlur: 2,
                    shadowOpacity: 0.2
                });
                const zoomInTransform = transformPath('M0,20 L0,80 L70,65 L70,80 L120,50 L70,20 L70,35 Z', 120, 80);
                arrowShape.scaleX(zoomInTransform.scale);
                arrowShape.scaleY(zoomInTransform.scale);
                arrowShape.rotation(zoomInTransform.angle * 180 / Math.PI);
                break;
                
            case 'arrow-zoom-out':
                // 5. ZOOM OUT (Megaphone) - exact from example
                // Path goes from (0,50) to (130,50) - center at y=50
                const zoomOutScale = length / 130;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY - (50 * zoomOutScale),
                    data: 'M0,45 L0,55 L80,80 L80,100 L130,50 L80,0 L80,20 Z',
                    fill: this.brushColor,
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
                // 10. BLOCK U-TURN - exact from example
                // Path goes from (0,10) to (130,10) - center at y=10
                const uTurnScale = length / 130;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY - (10 * uTurnScale),
                    data: 'M0,20 L80,20 C110,20 110,80 80,80 L60,80 L60,60 L20,90 L60,120 L60,100 L80,100 C130,100 130,0 80,0 L0,0 Z',
                    fill: this.brushColor,
                    draggable: false
                });
                arrowShape.scaleX(uTurnScale);
                arrowShape.scaleY(uTurnScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
                
            case 'arrow-split':
                // 11. SPLIT PATH - exact from example
                // Stem center is at (50,50), branches go to (120,0) and (120,100)
                // We position so the stem center (50,50) is at the midpoint
                const splitScale = length / 120;
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                arrowGroup = new Konva.Group({ x: midX - (50 * splitScale), y: midY - (50 * splitScale), draggable: false });
                const stem = new Konva.Rect({
                    width: 60 * splitScale,
                    height: 20 * splitScale,
                    fill: this.brushColor,
                    x: 0,
                    y: 40 * splitScale
                });
                const branch1 = new Konva.Arrow({
                    points: [50 * splitScale, 50 * splitScale, 120 * splitScale, 0],
                    pointerLength: 15 * splitScale,
                    pointerWidth: 15 * splitScale,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize * 1.2
                });
                const branch2 = new Konva.Arrow({
                    points: [50 * splitScale, 50 * splitScale, 120 * splitScale, 100 * splitScale],
                    pointerLength: 15 * splitScale,
                    pointerWidth: 15 * splitScale,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize * 1.2
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.add(branch1, branch2, stem);
                break;
                
            case 'arrow-whip':
                // 12. WHIP PAN - exact from example
                // Main arrow goes from (20,20) to (140,20) - center at y=20
                const whipScale = length / 140;
                arrowGroup = new Konva.Group({ x: startX - (20 * whipScale), y: startY - (20 * whipScale), draggable: false });
                const whipMain = new Konva.Arrow({
                    points: [20 * whipScale, 20 * whipScale, 140 * whipScale, 20 * whipScale],
                    pointerLength: 15 * whipScale,
                    pointerWidth: 15 * whipScale,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                });
                const line1 = new Konva.Line({
                    points: [0, 0, 80 * whipScale, 0],
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize * 0.4
                });
                const line2 = new Konva.Line({
                    points: [10 * whipScale, 40 * whipScale, 90 * whipScale, 40 * whipScale],
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize * 0.4
                });
                arrowGroup.rotation(angle * 180 / Math.PI);
                arrowGroup.add(whipMain, line1, line2);
                break;
                
            case 'arrow-dotted':
                // 16. STRAIGHT DOTTED - exact from example
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    dash: [12, 8],
                    draggable: false
                });
                break;
                
            case 'arrow-double':
                // 17. DOUBLE HEADED - exact from example
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 10,
                    pointerWidth: 10,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    pointerAtBeginning: true,
                    draggable: false
                });
                break;
                
            case 'arrow-thin-zoom':
                // 20. THIN PERSPECTIVE ZOOM - exact from example
                // Path goes from (0,50) to (140,50) - center at y=50
                const thinZoomScale = length / 140;
                arrowShape = new Konva.Path({
                    x: startX,
                    y: startY - (50 * thinZoomScale),
                    data: 'M0,40 L0,60 L100,55 L100,70 L140,50 L100,30 L100,45 Z',
                    fill: this.brushColor,
                    draggable: false,
                    shadowColor: 'black',
                    shadowBlur: 2,
                    shadowOpacity: 0.2
                });
                arrowShape.scaleX(thinZoomScale);
                arrowShape.scaleY(thinZoomScale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
                
            case 'arrow-cut':
                // Cut / Stop - X mark
                arrowGroup = new Konva.Group({ x: startX, y: startY, draggable: false });
                const xSize = Math.min(length, 50);
                const xLine1 = new Konva.Line({
                    points: [0, 0, xSize, xSize],
                    stroke: '#cc0000',
                    strokeWidth: this.brushSize * 1.5,
                    lineCap: 'round'
                });
                const xLine2 = new Konva.Line({
                    points: [xSize, 0, 0, xSize],
                    stroke: '#cc0000',
                    strokeWidth: this.brushSize * 1.5,
                    lineCap: 'round'
                });
                arrowGroup.add(xLine1, xLine2);
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize
                });
                // Position head at the end of the curve (x = -41.287, y = 8.176)
                const arrow04Head = new Konva.Path({
                    x: -41.287 * arrow04Scale,
                    y: 8.176 * arrow04Scale,
                    data: arrow04HeadPath,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
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
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    draggable: false
                });
                arrowShape.offsetX(0);
                arrowShape.offsetY(arrow14CenterY);
                arrowShape.scaleX(arrow14Scale);
                arrowShape.scaleY(arrow14Scale);
                arrowShape.rotation(angle * 180 / Math.PI);
                break;
                
            default:
                // Default to standard arrow
                arrowShape = new Konva.Arrow({
                    x: startX,
                    y: startY,
                    points: [0, 0, dx, dy],
                    pointerLength: 15,
                    pointerWidth: 15,
                    fill: this.brushColor,
                    stroke: this.brushColor,
                    strokeWidth: this.brushSize,
                    draggable: false
                });
        }
        
        if (arrowGroup) {
            arrowGroup.setAttr('data-page-index', pageIndex);
            layer.add(arrowGroup);
            this.makeSelectable(arrowGroup);
            this.addToHistory(pageIndex, 'add', arrowGroup);
        } else if (arrowShape) {
            arrowShape.setAttr('data-page-index', pageIndex);
            layer.add(arrowShape);
            this.makeSelectable(arrowShape);
            this.addToHistory(pageIndex, 'add', arrowShape);
        }
        
        state.currentShape = null;
        layer.batchDraw();
    }
    
    /**
     * Transform arrow points to fit start/end coordinates
     */
    transformArrowToPoints(arrow, startX, startY, endX, endY) {
        const currentPoints = arrow.points();
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Get original length from first and last points
        const origDx = currentPoints[currentPoints.length - 2] - currentPoints[0];
        const origDy = currentPoints[currentPoints.length - 1] - currentPoints[1];
        const origLength = Math.sqrt(origDx * origDx + origDy * origDy);
        const scale = origLength > 0 ? length / origLength : 1;
        
        // Transform points
        const transformed = [];
        for (let i = 0; i < currentPoints.length; i += 2) {
            const x = currentPoints[i] * scale;
            const y = currentPoints[i + 1] * scale;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rotX = x * cos - y * sin;
            const rotY = x * sin + y * cos;
            transformed.push(rotX, rotY);
        }
        
        arrow.points(transformed);
        arrow.x(startX);
        arrow.y(startY);
    }
    
    /**
     * Transform path data to fit start/end coordinates
     */
    transformPathToPoints(path, exampleStartX, exampleStartY, exampleEndX, exampleEndY, actualStartX, actualStartY, actualEndX, actualEndY) {
        // This is a simplified transformation - for complex paths, we'd need to parse and transform the SVG path data
        // For now, we'll use scale and rotation
        const exampleDx = exampleEndX - exampleStartX;
        const exampleDy = exampleEndY - exampleStartY;
        const actualDx = actualEndX - actualStartX;
        const actualDy = actualEndY - actualStartY;
        
        const exampleLength = Math.sqrt(exampleDx * exampleDx + exampleDy * exampleDy);
        const actualLength = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
        const scale = actualLength / exampleLength;
        
        const exampleAngle = Math.atan2(exampleDy, exampleDx);
        const actualAngle = Math.atan2(actualDy, actualDx);
        const angleDiff = actualAngle - exampleAngle;
        
        path.scaleX(scale);
        path.scaleY(scale);
        path.rotation(angleDiff * 180 / Math.PI);
        path.x(actualStartX);
        path.y(actualStartY);
    }
    
    /**
     * Start rectangle drawing
     */
    startRectangleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        // Use fill color if enabled, otherwise use brush color as default, or null if fill is disabled
        let fill = null;
        if (this.fillEnabled) {
            fill = (this.fillColor && this.fillColor !== 'transparent') ? this.fillColor : (this.brushColor || '#000000');
        }
        
        const rect = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: this.brushColor,
            strokeWidth: this.brushSize,
            fill: fill
        });
        
        rect.setAttr('data-page-index', pageIndex);
        layer.add(rect);
        state.currentShape = rect;
    }
    
    /**
     * Update rectangle drawing
     */
    updateRectangleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        const width = pos.x - start.x;
        const height = pos.y - start.y;
        
        state.currentShape.x(Math.min(start.x, pos.x));
        state.currentShape.y(Math.min(start.y, pos.y));
        state.currentShape.width(Math.abs(width));
        state.currentShape.height(Math.abs(height));
        layer.batchDraw();
    }
    
    /**
     * Finish rectangle drawing
     */
    finishRectangleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (state.currentShape) {
            this.addToHistory(pageIndex, 'add', state.currentShape);
            this.makeSelectable(state.currentShape);
            state.currentShape = null;
        }
    }
    
    /**
     * Start circle/ellipse drawing
     */
    startCircleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        
        // Use fill color if enabled, otherwise use brush color as default, or null if fill is disabled
        let fill = null;
        if (this.fillEnabled) {
            fill = (this.fillColor && this.fillColor !== 'transparent') ? this.fillColor : (this.brushColor || '#000000');
        }
        
        if (this.currentTool === 'ellipse') {
            const ellipse = new Konva.Ellipse({
                x: pos.x,
                y: pos.y,
                radiusX: 0,
                radiusY: 0,
                stroke: this.brushColor,
                strokeWidth: this.brushSize,
                fill: fill
            });
            ellipse.setAttr('data-page-index', pageIndex);
            layer.add(ellipse);
            state.currentShape = ellipse;
        } else {
            const circle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: 0,
                stroke: this.brushColor,
                strokeWidth: this.brushSize,
                fill: fill
            });
            circle.setAttr('data-page-index', pageIndex);
            layer.add(circle);
            state.currentShape = circle;
        }
    }
    
    /**
     * Update circle/ellipse drawing
     */
    updateCircleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        
        if (this.currentTool === 'ellipse') {
            const radiusX = Math.abs(pos.x - start.x);
            const radiusY = Math.abs(pos.y - start.y);
            state.currentShape.radiusX(radiusX);
            state.currentShape.radiusY(radiusY);
        } else {
            const radius = Math.sqrt(
                Math.pow(pos.x - start.x, 2) + Math.pow(pos.y - start.y, 2)
            );
            state.currentShape.radius(radius);
        }
        
        layer.batchDraw();
    }
    
    /**
     * Finish circle/ellipse drawing
     */
    finishCircleDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (state.currentShape) {
            this.addToHistory(pageIndex, 'add', state.currentShape);
            this.makeSelectable(state.currentShape);
            state.currentShape = null;
        }
    }
    
    /**
     * Start polygon/triangle drawing
     */
    startPolygonDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        
        // Use fill color if enabled, otherwise use brush color as default, or null if fill is disabled
        let fill = null;
        if (this.fillEnabled) {
            fill = (this.fillColor && this.fillColor !== 'transparent') ? this.fillColor : (this.brushColor || '#000000');
        }
        
        if (this.currentTool === 'triangle') {
            // Create a proper triangle shape (not RegularPolygon) to match the icon
            const triangle = new Konva.Line({
                points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
                stroke: this.brushColor,
                strokeWidth: this.brushSize,
                fill: fill,
                closed: true
            });
            triangle.setAttr('data-page-index', pageIndex);
            layer.add(triangle);
            state.currentShape = triangle;
        } else if (this.currentTool === 'polygon') {
            // Create a star-like polygon to match the icon
            const polygon = new Konva.Line({
                points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
                stroke: this.brushColor,
                strokeWidth: this.brushSize,
                fill: fill,
                closed: true
            });
            polygon.setAttr('data-page-index', pageIndex);
            layer.add(polygon);
            state.currentShape = polygon;
        }
    }
    
    /**
     * Update polygon/triangle drawing
     */
    updatePolygonDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (!state.currentShape) return;
        
        const start = state.startPoint;
        const radius = Math.sqrt(
            Math.pow(pos.x - start.x, 2) + Math.pow(pos.y - start.y, 2)
        );
        
        if (this.currentTool === 'triangle') {
            // Update triangle points - create an equilateral triangle
            const angle = Math.PI / 2; // Point upward
            const points = [
                start.x, start.y - radius, // Top point
                start.x - radius * Math.cos(Math.PI / 6), start.y + radius * Math.sin(Math.PI / 6), // Bottom left
                start.x + radius * Math.cos(Math.PI / 6), start.y + radius * Math.sin(Math.PI / 6)  // Bottom right
            ];
            state.currentShape.points(points);
        } else if (this.currentTool === 'polygon') {
            // Update star/polygon points - create a 5-pointed star
            const sides = 5;
            const outerRadius = radius;
            const innerRadius = radius * 0.4;
            const points = [];
            for (let i = 0; i < sides * 2; i++) {
                const angle = (i * Math.PI) / sides - Math.PI / 2;
                const r = i % 2 === 0 ? outerRadius : innerRadius;
                points.push(start.x + r * Math.cos(angle), start.y + r * Math.sin(angle));
            }
            state.currentShape.points(points);
        }
        
        layer.batchDraw();
    }
    
    /**
     * Finish polygon/triangle drawing
     */
    finishPolygonDrawing(layer, pos, pageIndex) {
        const state = this.drawingState.get(pageIndex);
        if (state.currentShape) {
            this.addToHistory(pageIndex, 'add', state.currentShape);
            this.makeSelectable(state.currentShape);
            state.currentShape = null;
        }
    }
    
    /**
     * Start erasing
     */
    startErasing(layer, pos, pageIndex) {
        this.eraseAtPosition(layer, pos, pageIndex);
    }
    
    /**
     * Continue erasing
     */
    continueErasing(layer, pos, pageIndex) {
        this.eraseAtPosition(layer, pos, pageIndex);
    }
    
    /**
     * Erase at position
     */
    eraseAtPosition(layer, pos, pageIndex) {
        const shapes = layer.getChildren();
        const eraserRadius = this.brushSize;
        const state = this.drawingState.get(pageIndex);
        
        shapes.forEach(shape => {
            // Skip current drawing shape
            if (shape === state.currentLine || shape === state.currentShape) return;
            
            // Check if eraser is near the shape
            const box = shape.getClientRect();
            
            // If eraser is within shape bounds, remove it
            if (pos.x >= box.x - eraserRadius && pos.x <= box.x + box.width + eraserRadius &&
                pos.y >= box.y - eraserRadius && pos.y <= box.y + box.height + eraserRadius) {
                shape.destroy();
                this.addToHistory(pageIndex, 'remove', shape);
                this.saveAnnotations(pageIndex);
            }
        });
        
        layer.batchDraw();
    }
    
    /**
     * Make shape selectable and draggable
     */
    makeSelectable(shape) {
        // Remove any existing click handlers to avoid duplicates
        shape.off('click');
        shape.off('dragend');
        
        // Set draggable based on current tool
        shape.draggable(this.currentTool === 'select');
        
        // Add click handler to select and show transformer
        shape.on('click', (e) => {
            // Only handle if select tool is active
            if (this.currentTool !== 'select') {
                return;
            }
            
            // Stop event propagation to prevent stage click handler
            e.cancelBubble = true;
            
            const layer = shape.getLayer();
            
            // Remove existing transformer from all shapes
            const existingTransformer = layer.findOne('Transformer');
            if (existingTransformer) {
                existingTransformer.destroy();
            }
            
            // Add transformer for resize/rotate
            const transformer = new Konva.Transformer({
                nodes: [shape],
                rotateEnabled: true,
                enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
                borderStroke: '#0096ff',
                borderStrokeWidth: 2,
                anchorFill: '#0096ff',
                anchorStroke: '#ffffff',
                anchorStrokeWidth: 2,
                anchorSize: 8
            });
            
            layer.add(transformer);
            layer.draw();
            
            // Save on transform end
            transformer.on('transformend', () => {
                const pageIndex = shape.getAttr('data-page-index');
                if (pageIndex !== undefined) {
                    this.saveAnnotations(pageIndex);
                }
            });
        });
        
        // Save on drag end
        shape.on('dragend', () => {
            const pageIndex = shape.getAttr('data-page-index');
            if (pageIndex !== undefined) {
                this.saveAnnotations(pageIndex);
            }
        });
    }
    
    /**
     * Set current tool
     */
    setTool(tool) {
        this.currentTool = tool;
        
        // Update cursor and draggable state for all stages
        this.stages.forEach((data, pageIndex) => {
            const stage = data.stage;
            const layer = data.layer;
            
            if (tool === 'select') {
                stage.container().style.cursor = 'default';
                // Enable selection mode - make all shapes draggable
                layer.getChildren().forEach(shape => {
                    if (shape.getClassName() !== 'Transformer') {
                        shape.draggable(true);
                        // Re-apply selectable handlers
                        this.makeSelectable(shape);
                    }
                });
            } else {
                stage.container().style.cursor = 'crosshair';
                // Disable dragging for drawing tools
                layer.getChildren().forEach(shape => {
                    if (shape.getClassName() !== 'Transformer') {
                        shape.draggable(false);
                    }
                });
                // Remove transformers when switching away from select tool
                const transformer = layer.findOne('Transformer');
                if (transformer) {
                    transformer.destroy();
                    layer.draw();
                }
            }
        });
    }
    
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        this.stages.forEach((data, pageIndex) => {
            if (enabled) {
                data.container.style.pointerEvents = 'auto';
                data.container.style.visibility = 'visible';
                data.container.style.opacity = '1';
                // Set cursor based on current tool
                if (this.currentTool === 'select') {
                    data.stage.container().style.cursor = 'default';
                } else {
                    data.stage.container().style.cursor = 'crosshair';
                }
            } else {
                data.container.style.pointerEvents = 'none';
                // Keep visible so drawings persist
                data.container.style.visibility = 'visible';
                data.container.style.opacity = '1';
                // Remove drawing cursor when disabled - reset on both stage and page element
                data.stage.container().style.cursor = 'default';
                // Also reset cursor on the page element itself
                const pageElement = data.container.closest('.storyboard-page');
                if (pageElement) {
                    pageElement.style.cursor = 'default';
                }
            }
        });
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
     * Note: This only affects NEW shapes. Existing shapes keep their original fill.
     */
    setFillColor(color) {
        this.fillColor = color;
        // Don't update existing shapes - each shape should keep its own fill
    }
    
    /**
     * Set fill enabled state
     */
    setFillEnabled(enabled) {
        this.fillEnabled = enabled;
        // Don't update existing shapes - each shape should keep its own fill
    }
    
    /**
     * Add to history
     */
    addToHistory(pageIndex, action, shape) {
        if (!this.history.has(pageIndex)) {
            this.history.set(pageIndex, []);
            this.historyIndex.set(pageIndex, -1);
        }
        
        const history = this.history.get(pageIndex);
        const index = this.historyIndex.get(pageIndex);
        
        // Remove any future history
        history.splice(index + 1);
        
        // Add new action
        history.push({ action, shape: shape.toObject() });
        this.historyIndex.set(pageIndex, history.length - 1);
    }
    
    /**
     * Undo
     */
    undo(pageIndex) {
        if (!this.history.has(pageIndex)) return;
        
        const history = this.history.get(pageIndex);
        const index = this.historyIndex.get(pageIndex);
        
        if (index < 0) return;
        
        const action = history[index];
        const layer = this.stages.get(pageIndex).layer;
        
        // Find and remove the shape
        const shapes = layer.getChildren();
        // Simple implementation: remove last added shape
        if (shapes.length > 0) {
            shapes[shapes.length - 1].destroy();
            layer.draw();
        }
        
        this.historyIndex.set(pageIndex, index - 1);
        this.saveAnnotations(pageIndex);
    }
    
    /**
     * Redo
     */
    redo(pageIndex) {
        if (!this.history.has(pageIndex)) return;
        
        const history = this.history.get(pageIndex);
        const index = this.historyIndex.get(pageIndex);
        
        if (index >= history.length - 1) return;
        
        const nextAction = history[index + 1];
        // Recreate shape from saved data
        const shape = Konva.Node.create(nextAction.shape);
        const layer = this.stages.get(pageIndex).layer;
        layer.add(shape);
        this.makeSelectable(shape);
        layer.draw();
        
        this.historyIndex.set(pageIndex, index + 1);
        this.saveAnnotations(pageIndex);
    }
    
    /**
     * Clear page
     */
    clear(pageIndex) {
        if (!this.stages.has(pageIndex)) {
            // If stage doesn't exist, still clear the saved annotations
            if (this.app.project.annotations && this.app.project.annotations[pageIndex]) {
                this.app.project.annotations[pageIndex] = [];
            }
            return;
        }
        
        const layer = this.stages.get(pageIndex).layer;
        layer.destroyChildren();
        layer.draw();
        
        // Clear drawing state
        if (this.drawingState.has(pageIndex)) {
            const state = this.drawingState.get(pageIndex);
            state.isDrawing = false;
            state.currentLine = null;
            state.currentShape = null;
            state.startPoint = null;
        }
        
        // Clear history
        if (this.history.has(pageIndex)) {
            this.history.set(pageIndex, []);
            this.historyIndex.set(pageIndex, -1);
        }
        
        this.saveAnnotations(pageIndex);
    }
    
    /**
     * Clear all
     */
    clearAll() {
        this.stages.forEach((data, pageIndex) => {
            this.clear(pageIndex);
        });
    }
    
    /**
     * Save annotations
     */
    saveAnnotations(pageIndex) {
        if (!this.stages.has(pageIndex)) return;
        
        const layer = this.stages.get(pageIndex).layer;
        const shapes = layer.getChildren();
        
        // Save as JSON
        const annotations = shapes.map(shape => shape.toObject());
        
        // Store in project
        if (!this.app.project.annotations) {
            this.app.project.annotations = {};
        }
        this.app.project.annotations[pageIndex] = annotations;
    }
    
    /**
     * Load annotations
     */
    loadAnnotations(pageIndex) {
        if (!this.app.project.annotations || !this.app.project.annotations[pageIndex]) {
            return;
        }
        
        const annotations = this.app.project.annotations[pageIndex];
        if (!this.stages.has(pageIndex)) return;
        
        const layer = this.stages.get(pageIndex).layer;
        
        annotations.forEach(shapeData => {
            const shape = Konva.Node.create(shapeData);
            layer.add(shape);
            this.makeSelectable(shape);
        });
        
        layer.draw();
    }
    
    /**
     * Get canvases map (for compatibility)
     */
    get canvases() {
        return this.stages;
    }
}
