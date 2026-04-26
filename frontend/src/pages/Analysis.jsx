import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, RadioButtonGroup } from '../components'

import style from './Analysis.module.css'

import video from '../assets/file_example_MP4_1920_18MG.mp4'

const API_BASE = 'http://127.0.0.1:8000'

export default function Analysis() {
    const [models, setModels] = useState([])
    const [status, setStatus] = useState('')
    const navigate = useNavigate()
    
    // Run once on page load, to get available models
    useEffect(() => {
        fetch(`${API_BASE}/api/models`)
              .then((response) => response.json())
              .then((json) => setModels(json.models))
              .catch((error) => console.error('Error fetching data: ', error))
    }, [])

    // Radio Button Group set up 
    const[selectedValue, setSelectedValue] = useState('')

    useEffect(() => {
        if (models.length > 0) {
            setSelectedValue(models[0])
        }
    }, [models])

    function radioGroupHandler(event) {
        setSelectedValue(event.target.value)
    }

    // Get status of processing task
    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${API_BASE}/api/status/123`)
              .then((response) => response.json())
              .then((json) => {
                setStatus(json.status)
                console.log(json.status)
                if (json.status === "complete") {
                    clearInterval(interval) // stop polling
                    navigate("/results")
                }
              })
              .catch((error) => console.error('Error fetching data: ', error))
        }, 2000)
        return () => clearInterval(interval)
    }, [])

    return (
        <>
          <h1>Analysis</h1>
          <div className={style.layout}>
            <div className={style.video_player}>
              <video controls width="100%" className={style.videoPlayer} src={video}></video>
            </div>
            <div className={style.input_group}>
              <Button>Identify court</Button>
              <Button>Identify target player</Button>
              {models.length === 0
              ? <p>Loading models...</p>
              : <RadioButtonGroup
              label="Choose classification model: "
              options={models}
              onChange={radioGroupHandler}
              name="model-selection"
              />
              }
              <Button>Classify stroke</Button>
              <div>Stroke classification is: {status}</div>
            </div>
          </div>
        </>

    )
}