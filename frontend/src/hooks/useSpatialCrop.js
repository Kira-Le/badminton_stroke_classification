import { X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function useSpatialCrop(videoRef) {
    const canvasRef = useRef(null)
    const [courtBox, setCourtBox] = useState(null) // {x, y, width, height } in video native resolution
    const [playerBox, setPlayerBox] = useState(null)
    const [activeMode, setActiveMode] = useState(null) // 'court' | 'player' | null
    const isDragging = useRef(false)
    const startPoint = useRef({ x: 0, y: 0 })

    // Keep canvas size in sync with rendered video size
    useEffect(() => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const resizeObserver = new ResizeObserver(() => {
            canvas.width = video.clientWidth
            canvas.height = video.clientHeight
            redrawBoxes(canvas)
        })
        resizeObserver.observe(video)
        return () => resizeObserver.disconnect()
    }, [videoRef])

    // Convert canvas pixel coords to video native resolution coords
    function toNativeCoords(canvas, video, x, y, width, height) {
        const scaleX = video.videoWidth / canvas.width
        const scaleY = video.videoHeight / canvas.height
        return {
            x: Math.round(Math.min(x, x + width) * scaleX),
            y: Math.round(Math.min(y, y + height) * scaleY),
            width: Math.round(Math.abs(width) * scaleX),
            height: Math.round(Math.abs(height) * scaleY),
        }
    }

    function toCanvasCoords(canvas, video, box) {
        const scaleX = canvas.width / video.videoWidth
        const scaleY = canvas.height / video.videoHeight
        return {
            x: box.x * scaleX,
            y: box.y * scaleY,
            width: box.width * scaleX,
            height: box.height * scaleY,
        }
    }

    function redrawBoxes(canvas) {
        const ctx = canvas.getContext('2d')
        const video = videoRef.current
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (courtBox) {
            const c = toCanvasCoords(canvas, video, courtBox)
            drawRect(ctx, c.x, c.y, c.width, c.height, '#00ff00', 'rgba(0,255,0,0.1)')
        }
        if (playerBox) {
            const p = toCanvasCoords(canvas, video, playerBox)
            drawRect(ctx, p.x, p.y, p.width, p.height, '#ff6600', 'rgba(255,102,0,0.1)')
        }
    }

    function drawRect(ctx, x, y, width, height, stroke, fill) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)
        ctx.fillStyle = fill
        ctx.fillRect(x, y, width, height)
    }

    function getCanvasPoint(e) {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        }
    }

    function handleMouseDown(e) {
        if (!activeMode) return
        isDragging.current = true
        startPoint.current = getCanvasPoint(e)
    }

    function handleMouseMove(e) {
        if (!isDragging.current || !activeMode) return
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const current = getCanvasPoint(e)
        const width = current.x - startPoint.current.x
        const height = current.y - startPoint.current.y
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        redrawBoxes(canvas)
        const colour = activeMode === 'court' ? '#00ff00' : '#ff6600'
        const fill = activeMode === 'court' ? 'rgba(0,255,0,0.1)' : 'rgba(255,102,0,0.1)'
        drawRect(ctx, startPoint.current.x, startPoint.current.y, width, height, colour, fill)
    }

    function handleMouseUp(e) {
        if (!isDragging.current || !activeMode) return
        isDragging.current = false
        const canvas = canvasRef.current
        const video = videoRef.current
        const current = getCanvasPoint(e)
        const width = current.x - startPoint.current.x
        const height = current.y - startPoint.current.y
        const nativeCoords = toNativeCoords(
            canvas, video,
            startPoint.current.x, startPoint.current.y,
            width, height
        )
        if (activeMode === 'court') {
            setCourtBox(nativeCoords)
        } else {
            setPlayerBox(nativeCoords)
        }
        setActiveMode(null) // Exit drawing mode after a box is drawn
    }
    
    function clearAll() {
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        setCourtBox(null)
        setPlayerBox(null)
        setActiveMode(null)
    }
    
    return {
        canvasRef,
        courtBox,
        playerBox,
        activeMode,
        setActiveMode,
        clearAll,
        canvasHandlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
        }
    }
}