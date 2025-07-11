// frontend/src/Whiteboard.jsx
import React, { useRef, useEffect, useState } from 'react';
// NO react-router-dom imports
import { SketchPicker } from 'react-color';
import './Whiteboard.css';

// The component accepts props from App.jsx
const Whiteboard = ({ roomId, username }) => {
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
    const [displayColorPicker, setDisplayColorPicker] = useState(false);
    
    // State for the list of users in the room
    const [users, setUsers] = useState([]);

    // --- SETUP EFFECTS ---
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

    useEffect(() => {
        if (contextRef.current) contextRef.current.strokeStyle = color;
    }, [color]);

    useEffect(() => {
        if (contextRef.current) contextRef.current.lineWidth = brushSize;
    }, [brushSize]);

    useEffect(() => {
        // The URL is constructed using the props passed from App.jsx
        const wsUrl = `ws://localhost:8080/ws/${roomId}?username=${encodeURIComponent(username)}`;
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => console.log(`Connected to WebSocket as ${username}`);
        wsRef.current.onclose = () => console.log('Disconnected from WebSocket');
        
        wsRef.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const { type, payload } = message;

            switch (type) {
                case 'user_list':
                    setUsers(payload);
                    break;
                case 'user_joined':
                    setUsers((prevUsers) => [...prevUsers, payload].sort());
                    break;
                case 'user_left':
                    setUsers((prevUsers) => prevUsers.filter(user => user !== payload));
                    break;
                default:
                    drawOnCanvas(type, payload);
            }
        };

        const ws = wsRef.current;
        return () => ws.close();
    }, [roomId, username]); // Dependencies are the props

    // --- UTILITY AND HELPER FUNCTIONS ---
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
    const drawOnCanvas = (type, payload) => {
        const context = contextRef.current;
        if (!context) return;
        const prev = {
            strokeStyle: context.strokeStyle,
            lineWidth: context.lineWidth,
            fillStyle: context.fillStyle,
            composite: context.globalCompositeOperation,
        };
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
            case 'clear':
                context.globalCompositeOperation = 'source-over';
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
                break;
            default:
                break;
        }
        context.strokeStyle = prev.strokeStyle;
        context.lineWidth = prev.lineWidth;
        context.fillStyle = prev.fillStyle;
        context.globalCompositeOperation = prev.composite;
    };
    const startDrawing = (event) => {
        const pos = getMousePos(canvasRef.current, event);
        setIsDrawing(true);
        startPos.current = pos;
        const ctx = contextRef.current;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    };
    const draw = (event) => {
        if (!isDrawing) return;
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
        if (activeTool === 'rectangle') {
            const rectPayload = {
                shape: 'rectangle',
                x: Math.min(startPos.current.x, endPos.x) / canvas.width,
                y: Math.min(startPos.current.y, endPos.y) / canvas.height,
                width: Math.abs(endPos.x - startPos.current.x) / canvas.width,
                height: Math.abs(endPos.y - startPos.current.y) / canvas.height,
                color: color,
            };
            drawOnCanvas('shape', rectPayload);
            sendWebSocketMessage('shape', rectPayload);
        }
        contextRef.current.closePath();
        contextRef.current.globalCompositeOperation = 'source-over';
    };
    const handleClear = () => {
        drawOnCanvas('clear', {});
        sendWebSocketMessage('clear', {});
    };
    const handleColorClick = () => setDisplayColorPicker(!displayColorPicker);
    const handleColorClose = () => setDisplayColorPicker(false);
    const handleColorChange = (newColor) => setColor(newColor.hex);

    return (
        <div className="whiteboard-layout">
            <div className="main-content">
                <h2>Whiteboard Room: {roomId}</h2>
                <div className="toolbar">
                    <button onClick={() => setActiveTool('brush')} className={activeTool === 'brush' ? 'active' : ''}>Brush</button>
                    <button onClick={() => setActiveTool('eraser')} className={activeTool === 'eraser' ? 'active' : ''}>Eraser</button>
                    <button onClick={() => setActiveTool('rectangle')} className={activeTool === 'rectangle' ? 'active' : ''}>Rectangle</button>
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
                    <input type="range" id="brushSize" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
                    <span>{brushSize}</span>
                    <button onClick={handleClear} className="clear-btn">Clear All</button>
                </div>
                <div className="canvas-container">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={finishDrawing}
                        onMouseOut={finishDrawing}
                    />
                </div>
            </div>
            <div className="sidebar">
                <h3>Users ({users.length})</h3>
                <ul className="user-list">
                    {users.map((user, index) => (
                        <li key={index} className={user === username ? 'current-user' : ''}>
                            {user} {user === username && "(You)"}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Whiteboard;