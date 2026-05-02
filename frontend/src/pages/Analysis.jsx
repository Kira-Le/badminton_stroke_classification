import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, RadioButtonGroup } from '../components'
import { useSpatialCrop, useTemporalCrop} from '../hooks'
import { API_BASE } from '../config'

import style from './Analysis.module.css'

import video from '../assets/file_example_MP4_1920_18MG.mp4' // For testing stages only

export default function Analysis() {
    const [models, setModels] = useState([])
    const[selectedValue, setSelectedValue] = useState('')
    const [status, setStatus] = useState('')
    const navigate = useNavigate()
    const videoRef = useRef(null)

    const { canvasRef, courtBox, playerBox, activeMode, startCourtMode, startPlayerMode, clearAll, canvasHandlers } = useSpatialCrop(videoRef)
    const { duration, startTime, endTime, handleStartChange, handleEndChange, formatTime } = useTemporalCrop(videoRef)
    
    // Run once on page load, to get available models and set initial selection to the first model
    useEffect(() => {
        fetch(`${API_BASE}/api/models`)
              .then((response) => response.json())
              .then((json) => {
                const modelNames = json.models.map((model) => model.name)
                setModels(modelNames)
                setSelectedValue(modelNames[0])
              })
              .catch((error) => console.error('Error fetching data: ', error))
    }, [])
    
    // Radio button click handling function
    function radioGroupHandler(event) {
        setSelectedValue(event.target.value)
    }

    // Get status of processing task
   /* useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${API_BASE}/api/status/123`)
              .then((response) => response.json())
              .then((json) => {
                setStatus(json.status)
                if (json.status === "complete") {
                    clearInterval(interval) // stop polling
                    navigate("/results")
                }
              })
              .catch((error) => console.error('Error fetching data: ', error))
        }, 2000)
        return () => clearInterval(interval)
    }, [navigate])*/

    function handleClassify() {
        const cropParams = {
            model: selectedValue,
            temporalCrop: { startTime, endTime },
            spatialCrop: { courtBox, playerBox },
        }
        console.log('Sending crop params:', cropParams)
        //TODO: Send cropParams to backend with job request
    }

    return (
        <>
          <h1>Analysis</h1>
          <div className={style.layout}>

            <div className={style.videoSection}>
                <div className={style.videoWrapper}>
                    <video
                    ref={videoRef}
                    controls
                    className={style.videoPlayer}
                    src={video}
                    />
                    <canvas
                    ref={canvasRef}
                    className={style.canvas}
                    style={{ pointerEvents: activeMode ? 'all': 'none' }}
                    {...canvasHandlers}
                    />
                </div>

                <div className={style.temporalCrop}>
                    <div className={style.timeLabels}>
                        <span>Start: {formatTime(startTime)}</span>
                        <span>End: {formatTime(endTime)}</span>
                    </div>
                    <div className={style.sliders}>
                        <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={startTime}
                        onChange={handleStartChange}
                        className={style.slider}
                        />
                        <input
                        type="range"
                        min={0}
                        max={duration}
                        step={0.1}
                        value={endTime}
                        onChange={handleEndChange}
                        className={style.slider}
                        />
                    </div>
                </div>
            </div>

            <div className={style.input_group}>
              <Button
              onClick={startCourtMode}
              variant={activeMode === 'court' ? 'active' : undefined}
              >
                {courtBox ? 'Redraw court' : 'Identify court'}
              </Button>
              
              <Button
              onClick={startPlayerMode}
              variant={activeMode === 'player' ? 'active' : undefined}
              >
                {playerBox ? 'Redraw player' : 'Identify target'}
              </Button>
              
              {activeMode && (
                <p className={style.drawingHint}>
                    {activeMode === 'court'
                      ? 'Draw a box around the court area'
                      : 'Draw a box around the target player'}
                </p>
              )}

              {courtBox && <p className={style.cropInfo}>Court selected: {courtBox.width}x{courtBox.height}px</p>}
              {playerBox && <p className={style.cropInfo}>Player selected: {playerBox.width}x{playerBox.height}px</p>}

              {models.length === 0
              ? <p>Loading models...</p>
              : <RadioButtonGroup
              label="Choose classification model: "
              options={models}
              onChange={radioGroupHandler}
              name="model-selection"
              />
              }
              <Button onClick={handleClassify}>Classify stroke</Button>
              <Button onClick={clearAll}>Clear all crops</Button>
              
              {status && <div>Stroke classification is: {status}</div>}
            </div>
          </div>
        </>

    )
}