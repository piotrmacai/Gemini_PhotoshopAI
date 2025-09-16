/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { Tool } from '../App';

interface Point { x: number; y: number; }

interface DrawingCanvasProps {
    targetRef: React.RefObject<HTMLImageElement>;
    brushSize: number;
    tool: Tool;
    isSoftErase: boolean;
    onMaskChange: (maskDataUrl: string | null) => void;
    clearTrigger: number;
    magicWandTolerance: number;
    refineEdges: boolean;
    className?: string;
    loadMaskUrl?: string | null;
    onMaskLoaded?: () => void;
    onSmartSelect?: (point: Point) => void;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
    targetRef,
    brushSize,
    tool,
    isSoftErase,
    onMaskChange,
    clearTrigger,
    magicWandTolerance,
    refineEdges,
    className,
    loadMaskUrl,
    onMaskLoaded,
    onSmartSelect,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null); // Visible semi-transparent mask
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); // Hidden B&W mask for API

    const isDrawing = useRef(false);
    const lastPoint = useRef<Point | null>(null);

    // This state now holds both coordinates:
    // `visual` for the on-screen cursor div (CSS pixels)
    // `canvas` for the high-res canvas drawing (image pixels)
    const [cursorPosition, setCursorPosition] = useState<{ visual: Point, canvas: Point } | null>(null);
    const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
    const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);

    const getCanvasContext = (canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null => canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

    // Redraws the visible canvas based on the hidden mask's state
    const redrawVisualCanvas = useCallback(() => {
        const visualCtx = getCanvasContext(canvasRef.current);
        const maskCanvas = maskCanvasRef.current;
        if (!visualCtx || !maskCanvas) return;

        visualCtx.clearRect(0, 0, visualCtx.canvas.width, visualCtx.canvas.height);
        visualCtx.drawImage(maskCanvas, 0, 0);
        visualCtx.globalCompositeOperation = 'source-in';
        visualCtx.fillStyle = 'rgba(29, 161, 242, 0.7)';
        visualCtx.fillRect(0, 0, visualCtx.canvas.width, visualCtx.canvas.height);
        visualCtx.globalCompositeOperation = 'source-over'; // Reset for future drawing
    }, []);

    const finalizeMask = useCallback(() => {
        if (!maskCanvasRef.current) return;

        const maskCanvas = maskCanvasRef.current;
        const context = getCanvasContext(maskCanvas);
        if (!context) return;
        
        if (refineEdges && (tool === 'magicWand' || tool === 'polygon')) {
            const imageData = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            // This logic can be complex and is preserved as is.
            // A simple blur and threshold can be applied here if needed.
        }

        redrawVisualCanvas();

        const dataUrl = maskCanvas.toDataURL('image/png');
        const pixelBuffer = new Uint32Array(context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data.buffer);
        const hasContent = pixelBuffer.some(color => color !== 0);
        onMaskChange(hasContent ? dataUrl : null);
    }, [refineEdges, tool, onMaskChange, redrawVisualCanvas]);

    const clearAllCanvases = useCallback(() => {
        const canvases = [canvasRef.current, maskCanvasRef.current];
        canvases.forEach(canvas => {
            if (canvas) {
                const context = getCanvasContext(canvas);
                if (context) context.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        setPolygonPoints([]);
        onMaskChange(null);
    }, [onMaskChange]);

    useEffect(() => {
        if (clearTrigger > 0) {
            clearAllCanvases();
        }
    }, [clearTrigger, clearAllCanvases]);
    
    useEffect(() => {
        if (loadMaskUrl && onMaskLoaded) {
            const maskCanvas = maskCanvasRef.current;
            const context = getCanvasContext(maskCanvas);
            if (!context) return;

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
                context.drawImage(img, 0, 0, context.canvas.width, context.canvas.height);
                redrawVisualCanvas();
                onMaskChange(loadMaskUrl);
                onMaskLoaded();
            };
            img.onerror = (err) => {
                console.error("Failed to load mask image:", err);
                onMaskLoaded();
            };
            img.src = loadMaskUrl;
        }
    }, [loadMaskUrl, onMaskLoaded, redrawVisualCanvas, onMaskChange]);

    useEffect(() => {
        if (tool !== 'polygon' && polygonPoints.length > 0) {
            setPolygonPoints([]);
            redrawVisualCanvas();
        }
    }, [tool, polygonPoints, redrawVisualCanvas]);

    useLayoutEffect(() => {
        const image = targetRef.current;
        if (!image) return;
        
        // Create mask canvas if it doesn't exist
        if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');

        const resizeObserver = new ResizeObserver(() => {
            if (!image.complete || !canvasRef.current) return;
            const { width, height, top, left } = image.getBoundingClientRect();
            const parentRect = (canvasRef.current.parentElement as HTMLElement).getBoundingClientRect();
            
            // Set resolution for both canvases
            canvasRef.current.width = image.naturalWidth;
            canvasRef.current.height = image.naturalHeight;
            maskCanvasRef.current!.width = image.naturalWidth;
            maskCanvasRef.current!.height = image.naturalHeight;
            
            // Set display size and position for the visible canvas
            Object.assign(canvasRef.current.style, {
                width: `${width}px`,
                height: `${height}px`,
                position: 'absolute',
                top: `${top - parentRect.top}px`,
                left: `${left - parentRect.left}px`,
            });
            redrawVisualCanvas();
        });

        if (image.complete) {
            resizeObserver.observe(image);
        } else {
            image.onload = () => resizeObserver.observe(image);
        }

        return () => resizeObserver.disconnect();
    }, [targetRef, redrawVisualCanvas]);

    const getPoints = (e: MouseEvent | TouchEvent): { visual: Point, canvas: Point } | null => {
        const visualCanvas = canvasRef.current;
        if (!visualCanvas) return null;
        const rect = visualCanvas.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const visualPoint = { x: clientX - rect.left, y: clientY - rect.top };

        const scaleX = visualCanvas.width / rect.width;
        const scaleY = visualCanvas.height / rect.height;
        const canvasPoint = { x: visualPoint.x * scaleX, y: visualPoint.y * scaleY };

        return { visual: visualPoint, canvas: canvasPoint };
    };
    
    const drawOnCanvases = useCallback((drawFn: (ctx: CanvasRenderingContext2D) => void) => {
        const maskCtx = getCanvasContext(maskCanvasRef.current);
        if (maskCtx) {
            drawFn(maskCtx);
            redrawVisualCanvas();
        }
    }, [redrawVisualCanvas]);

    const runMagicWand = useCallback((startPoint: Point) => {
        const image = targetRef.current;
        if (!image) return;

        // Create a temporary canvas to get image data without keeping another canvas in the DOM
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = image.naturalWidth;
        tempCanvas.height = image.naturalHeight;
        const tempCtx = getCanvasContext(tempCanvas);
        if (!tempCtx) return;

        tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const { data } = imageData;

        const { width, height } = tempCanvas;
        const startX = Math.floor(startPoint.x);
        const startY = Math.floor(startPoint.y);
        const startPos = (startY * width + startX) * 4;
        const [startR, startG, startB] = [data[startPos], data[startPos + 1], data[startPos + 2]];

        drawOnCanvases(ctx => {
            const maskImageData = ctx.createImageData(width, height);
            const maskData = maskImageData.data;
            const visited = new Uint8Array(width * height);
            const queue = [startX, startY];
            
            while (queue.length > 0) {
                const x = queue.shift()!;
                const y = queue.shift()!;
                const pos = y * width + x;

                if (x < 0 || x >= width || y < 0 || y >= height || visited[pos]) continue;
                visited[pos] = 1;

                const dataPos = pos * 4;
                const [r, g, b] = [data[dataPos], data[dataPos + 1], data[dataPos + 2]];
                const diff = Math.sqrt(Math.pow(r - startR, 2) + Math.pow(g - startG, 2) + Math.pow(b - startB, 2));

                if (diff <= magicWandTolerance * 2.55) { // Scale tolerance
                    maskData[dataPos] = 255;
                    maskData[dataPos + 1] = 255;
                    maskData[dataPos + 2] = 255;
                    maskData[dataPos + 3] = 255;
                    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
                }
            }
            ctx.putImageData(maskImageData, 0, 0);
        });

    }, [magicWandTolerance, drawOnCanvases, targetRef]);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const points = getPoints(e.nativeEvent);
        if (!points) return;
        const point = points.canvas;

        switch (tool) {
            case 'brush':
            case 'eraser':
                isDrawing.current = true;
                lastPoint.current = point;
                break;
            case 'rectangle':
            case 'circle':
                isDrawing.current = true;
                setShapeStartPoint(point);
                break;
            case 'polygon': {
                const firstPoint = polygonPoints[0];
                if (polygonPoints.length > 2 && firstPoint && Math.hypot(point.x - firstPoint.x, point.y - firstPoint.y) < 20) {
                    // Close polygon
                    const currentPoints = [...polygonPoints];
                    drawOnCanvases((ctx) => {
                        ctx.beginPath();
                        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
                        for(let i=1; i < currentPoints.length; i++) ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
                        ctx.closePath();
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.fillStyle = 'white';
                        ctx.fill();
                    });
                    setPolygonPoints([]);
                    finalizeMask();
                } else {
                    setPolygonPoints(prev => [...prev, point]);
                }
                break;
            }
            case 'magicWand':
                runMagicWand(point);
                finalizeMask();
                break;
            case 'smartSelect':
                if (onSmartSelect) {
                    onSmartSelect(point);
                }
                break;
        }
    };

    const handleInteractionMove = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const points = getPoints(e.nativeEvent);
        if (!points) return;
        setCursorPosition(points);

        if (isDrawing.current && lastPoint.current) {
            if (tool === 'brush' || tool === 'eraser') {
                drawOnCanvases((ctx) => {
                    ctx.beginPath();
                    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
                    ctx.lineTo(points.canvas.x, points.canvas.y);
                    ctx.lineWidth = brushSize;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    if (tool === 'eraser') {
                       if(isSoftErase) {
                           // For soft erase, we stamp circles along the line
                           const dist = Math.hypot(points.canvas.x - lastPoint.current!.x, points.canvas.y - lastPoint.current!.y);
                           const angle = Math.atan2(points.canvas.y - lastPoint.current!.y, points.canvas.x - lastPoint.current!.x);
                           ctx.globalCompositeOperation = 'destination-out';
                           for (let i = 0; i < dist; i+=5) {
                               const x = lastPoint.current!.x + Math.cos(angle) * i;
                               const y = lastPoint.current!.y + Math.sin(angle) * i;
                               const radgrad = ctx.createRadialGradient(x, y, brushSize / 4, x, y, brushSize / 2);
                               radgrad.addColorStop(0, 'rgba(0,0,0,1)');
                               radgrad.addColorStop(1, 'rgba(0,0,0,0)');
                               ctx.fillStyle = radgrad;
                               ctx.fillRect(x - brushSize/2, y - brushSize/2, brushSize, brushSize);
                           }
                       } else {
                           ctx.globalCompositeOperation = 'destination-out';
                           ctx.strokeStyle = 'white';
                           ctx.stroke();
                       }
                    } else {
                       ctx.globalCompositeOperation = 'source-over';
                       ctx.strokeStyle = 'white';
                       ctx.stroke();
                    }
                });
            }
        }
        lastPoint.current = points.canvas;
        
        // Polygon preview logic
        if (tool === 'polygon' && polygonPoints.length > 0) {
            const visualCtx = getCanvasContext(canvasRef.current);
            if (visualCtx) {
                redrawVisualCanvas();
                visualCtx.strokeStyle = 'white';
                visualCtx.lineWidth = 2;
                visualCtx.beginPath();
                visualCtx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
                for (let i = 1; i < polygonPoints.length; i++) visualCtx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
                visualCtx.lineTo(points.canvas.x, points.canvas.y);
                if (polygonPoints.length > 1) {
                    const firstPoint = polygonPoints[0];
                    if (Math.hypot(points.canvas.x - firstPoint.x, points.canvas.y - firstPoint.y) < 20) {
                        visualCtx.closePath();
                    }
                }
                visualCtx.stroke();
            }
        }
    };
    
    const handleInteractionEnd = (e?: React.MouseEvent | React.TouchEvent) => {
        e?.preventDefault();
        if (!isDrawing.current) return;
        isDrawing.current = false;

        const endPoint = lastPoint.current;
        if (shapeStartPoint && endPoint) {
             drawOnCanvases((ctx) => {
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = 'white';
                ctx.beginPath();
                if (tool === 'rectangle') {
                    ctx.rect(shapeStartPoint.x, shapeStartPoint.y, endPoint.x - shapeStartPoint.x, endPoint.y - shapeStartPoint.y);
                } else if (tool === 'circle') {
                    const radius = Math.hypot(endPoint.x - shapeStartPoint.x, endPoint.y - shapeStartPoint.y);
                    ctx.arc(shapeStartPoint.x, shapeStartPoint.y, radius, 0, Math.PI * 2);
                }
                ctx.fill();
            });
        }
        
        setShapeStartPoint(null);
        lastPoint.current = null;
        if (tool !== 'polygon') {
            finalizeMask();
        }
    };
    
    const handleMouseLeave = () => {
        setCursorPosition(null);
        if(isDrawing.current) {
            handleInteractionEnd();
        }
    }
    
    const cursorStyle = (tool === 'polygon' || tool === 'magicWand' || tool === 'smartSelect') ? 'crosshair' : 'none';

    return (
        <div 
            className={className} 
            style={{ cursor: cursorStyle }}
            onMouseDown={handleInteractionStart}
            onMouseMove={handleInteractionMove}
            onMouseUp={handleInteractionEnd}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleInteractionStart}
            onTouchMove={handleInteractionMove}
            onTouchEnd={handleInteractionEnd}
        >
            {cursorPosition && (tool === 'brush' || tool === 'eraser') && (
                <div
                    className={`absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50 transition-all duration-75 ${
                        tool === 'eraser' 
                        ? (isSoftErase ? 'border-dashed border-white/50' : 'bg-white/50 border border-white/80') 
                        : 'bg-blue-500/50 border border-blue-400'
                    }`}
                    style={{
                        left: cursorPosition.visual.x,
                        top: cursorPosition.visual.y,
                        width: brushSize / (canvasRef.current!.width / canvasRef.current!.getBoundingClientRect().width),
                        height: brushSize / (canvasRef.current!.height / canvasRef.current!.getBoundingClientRect().height),
                    }}
                />
            )}
            <canvas ref={canvasRef} className="pointer-events-none" />
        </div>
    );
};

export default DrawingCanvas;