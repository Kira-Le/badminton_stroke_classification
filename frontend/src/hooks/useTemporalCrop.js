import { useState, useEffect } from 'react'

export default function useTemporalCrop(videoRef) {
    const [duration, setDuration] = useState(0)
    const [startTime, setStartTime] = useState(0)
    const [endTime, setEndTime] = useState(0)

    // Get video duration once metadata is loaded
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        function handleMetadata() {
            setDuration(video.duration)
            setEndTime(video.duration)
        }

        video.addEventListener('loadedmetadata', handleMetadata)
        return () => video.removeEventListener('loadedmetadata', handleMetadata)
    }, [videoRef])

    function handleStartChange(e) {
        const value = Number(e.target.value)
        // Start cannot exceed end
        if (value >= endTime) return
        setStartTime(value)
        // Seek video to show the user where start is
        if (videoRef.current) videoRef.current.currentTime = value
    }

    function handleEndChange(e) {
        const value = Number(e.target.value)
        // End cannot be before start
        if (value <= startTime) return
        setEndTime(value)
        if (videoRef.current) videoRef.current.currentTime = value
    }

    // Format seconds as mm:ss for display
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0')
        const s = Math.floor(seconds % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    return {
        duration,
        startTime,
        endTime,
        handleStartChange,
        handleEndChange,
        formatTime,
    }
}