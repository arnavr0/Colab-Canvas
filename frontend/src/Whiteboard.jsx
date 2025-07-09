import React, { useRef, useEffect, useState } from 'react';
import { SketchPicker } from 'react-color';
import './Whiteboard.css';

const Whiteboard = ({ roomId }) => {
    // Refs for canvas and WebSocket
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const wsRef = useRef(null);

    // State for drawing tools and properties
    const [activeTool, setActiveTool] = useState('brush');
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });

    // State for the inline text editor
    const [textInput, setTextInput] = useState(null);

    // State for the custom color picker visibility
    const [displayColorPicker, setDisplayColorPicker] = useState(false);

    // --- SETUP EFFECTS ---

    // 1. Initialize Canvas on component mount
    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth * 0.9;
        canvas.height = window.innerHeight * 0.8;
        canvas.style.backgroundColor = '#FFFFFF';

        const context = canvas.getContext('2d');
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.globalCompositeOperation = 'source-over';
        contextRef.current = context;
    }, []);

    // 2. Update canvas context when tool properties change
    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = color;
        }
    }, [color]);

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.lineWidth = brushSize;
        }
    }, [brushSize]);

    // 3. Setup WebSocket connection
    useEffect(() => {
        wsRef.current = new WebSocket(`ws://localhost:8080/ws/${roomId}`);

        wsRef.current.onopen = () => console.log('Connected to WebSocket');
        wsRef.current.onclose = () => console.log('Disconnected from WebSocket');

        wsRef.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            drawOnCanvas(message.type, message.payload);
        };

        const ws = wsRef.current;
        // Cleanup on component unmount
        return () => {
            ws.close();
        };
    }, [roomId]);


    // --- UTILITY AND COMMUNICATION FUNCTIONS ---

    const getMousePos = (canvas, event) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const sendWebSocketMessage = (type, payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }));
        }
    };

    // Central function to render any drawing action
    const drawOnCanvas = (type, payload) => {
        const context = contextRef.current;
        if (!context) return;

        // Save current context settings to restore them later
        const prev = {
            strokeStyle: context.strokeStyle,
            lineWidth: context.lineWidth,
            fillStyle: context.fillStyle,
            font: context.font,
            composite: context.globalCompositeOperation,
        };

        // Apply drawing properties based on the payload from the server
        switch (type) {
            case 'draw':
                context.globalCompositeOperation = payload.tool === 'eraser' ? 'destination-out' : 'source-over';
                context.strokeStyle = payload.tool === 'eraser' ? 'rgba(0,0,0,1)' : payload.color;
                context.lineWidth = payload.lineWidth;
                context.beginPath();
                context.moveTo(payload.x0 * context.canvas.width, payload.y0 * context.canvas.height);
                context.lineTo(payload.x1 * context.canvas.width, payload.y1 * context.canvas.height);
                context.stroke();
                context.closePath();
                break;
            case 'shape':
                context.globalCompositeOperation = 'source-over';
                if (payload.shape === 'rectangle') {
                    context.fillStyle = payload.color;
                    context.fillRect(
                        payload.x * context.canvas.width,
                        payload.y * context.canvas.height,
                        payload.width * context.canvas.width,
                        payload.height * context.canvas.height
                    );
                }
                break;
            case 'text':
                context.globalCompositeOperation = 'source-over';
                context.fillStyle = payload.color;
                context.font = `${payload.fontSize}px sans-serif`;
                const lines = payload.text.split('\n');
                lines.forEach((line, index) => {
                    context.fillText(
                        line,
                        payload.x * context.canvas.width,
                        payload.y * context.canvas.height + (index * payload.fontSize)
                    );
                });
                break;
            case 'clear':
                context.globalCompositeOperation = 'source-over';
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
                break;
            default:
                break;
        }

        // Restore context to local user's settings
        context.strokeStyle = prev.strokeStyle;
        context.lineWidth = prev.lineWidth;
        context.fillStyle = prev.fillStyle;
        context.font = prev.font;
        context.globalCompositeOperation = prev.composite;
    };


    // --- MOUSE AND TOOL EVENT HANDLERS ---

    const startDrawing = (event) => {
        // Ignore clicks on UI elements (like the text editor)
        if (event.target.nodeName === 'TEXTAREA') return;

        // If there's an active text box, finalize it before starting a new action
        if (textInput) {
            handleFinalizeText();
        }

        setIsDrawing(true);
        const pos = getMousePos(canvasRef.current, event);
        startPos.current = pos;
        
        // Handle text tool click separately
        if (activeTool === 'text') {
            setTextInput({ x: pos.x, y: pos.y, value: '', width: 200, height: 100 });
            setIsDrawing(false); // No dragging needed for text placement
            return;
        }

        // Prepare for drawing (brush or eraser)
        const ctx = contextRef.current;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    };

    const draw = (event) => {
        if (!isDrawing || activeTool === 'text') return;
        
        const currentPos = getMousePos(canvasRef.current, event);
        const canvas = canvasRef.current;
        const ctx = contextRef.current;

        if (activeTool === 'brush' || activeTool === 'eraser') {
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();

            const drawPayload = {
                x0: startPos.current.x / canvas.width,
                y0: startPos.current.y / canvas.height,
                x1: currentPos.x / canvas.width,
                y1: currentPos.y / canvas.height,
                tool: activeTool,
                color: color,
                lineWidth: brushSize,
            };
            sendWebSocketMessage('draw', drawPayload);
            startPos.current = currentPos;
        }
    };

    const finishDrawing = (event) => {
        if (!isDrawing) return;
        setIsDrawing(false);

        const canvas = canvasRef.current;
        const endPos = getMousePos(canvas, event);

        // Handle shape drawing on mouse up
        if (activeTool === 'rectangle') {
            const rectPayload = {
                shape: 'rectangle',
                x: Math.min(startPos.current.x, endPos.x) / canvas.width,
                y: Math.min(startPos.current.y, endPos.y) / canvas.height,
                width: Math.abs(endPos.x - startPos.current.x) / canvas.width,
                height: Math.abs(endPos.y - startPos.current.y) / canvas.height,
                color: color,
            };
            drawOnCanvas('shape', rectPayload); // Draw locally
            sendWebSocketMessage('shape', rectPayload);
        }

        // Reset for next drawing action
        contextRef.current.closePath();
        contextRef.current.globalCompositeOperation = 'source-over';
    };
    
    // --- SPECIFIC HANDLERS FOR UI ELEMENTS ---

    const handleClear = () => {
        drawOnCanvas('clear', {}); // Clear locally
        sendWebSocketMessage('clear', {});
    };

    const handleFinalizeText = () => {
        if (!textInput || textInput.value.trim() === '') {
            setTextInput(null);
            return;
        }
        const canvas = canvasRef.current;
        const textPayload = {
            text: textInput.value,
            x: textInput.x / canvas.width,
            y: (textInput.y + (brushSize * 1.5)) / canvas.height, // Adjust for font baseline
            color: color,
            fontSize: brushSize * 1.5,
        };
        drawOnCanvas('text', textPayload);
        sendWebSocketMessage('text', textPayload);
        setTextInput(null); // Hide the textarea
    };

    const handleColorClick = () => setDisplayColorPicker(!displayColorPicker);
    const handleColorClose = () => setDisplayColorPicker(false);
    const handleColorChange = (newColor) => setColor(newColor.hex);


    // --- RENDER ---

    return (
        <div>
            <h2>Whiteboard Room: {roomId}</h2>
            <div className="toolbar">
                <button onClick={() => setActiveTool('brush')} className={activeTool === 'brush' ? 'active' : ''}>Brush</button>
                <button onClick={() => setActiveTool('eraser')} className={activeTool === 'eraser' ? 'active' : ''}>Eraser</button>
                <button onClick={() => setActiveTool('rectangle')} className={activeTool === 'rectangle' ? 'active' : ''}>Rectangle</button>
                <button onClick={() => setActiveTool('text')} className={activeTool === 'text' ? 'active' : ''}>Text</button>
                
                <div className="color-picker-container">
                    <label>Color:</label>
                    <div className="color-swatch" style={{ backgroundColor: color }} onClick={handleColorClick} />
                    {displayColorPicker ? (
                        <div className="color-picker-popover">
                            <div className="color-picker-cover" onClick={handleColorClose} />
                            <SketchPicker color={color} onChange={handleColorChange} />
                        </div>
                    ) : null}
                </div>

                <label htmlFor="brushSize">Size:</label>
                <input type="range" id="brushSize" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(e.target.value)} />
                <span>{brushSize}</span>

                <button onClick={handleClear} className="clear-btn">Clear All</button>
            </div>

            <div className="canvas-container">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={finishDrawing}
                    onMouseOut={finishDrawing} // Stop drawing if mouse leaves canvas
                />
                {textInput && (
                    <div className="text-editor" style={{ top: textInput.y, left: textInput.x }}>
                        <textarea
                            style={{
                                width: `${textInput.width}px`,
                                height: `${textInput.height}px`,
                                fontSize: `${brushSize * 1.5}px`,
                                color: color,
                                border: `2px dashed ${color}`,
                            }}
                            value={textInput.value}
                            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                            onBlur={handleFinalizeText} // Finalize when user clicks away
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Whiteboard;