import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, RadioButtonGroup } from '../components'

import style from './Analysis.module.css'

import video from '../assets/file_example_MP4_1920_18MG.mp4' // For testing stages only

const API_BASE = 'http://127.0.0.1:8000' // For testing stages only

export default function Analysis() {
    const [models, setModels] = useState([])
    const[selectedValue, setSelectedValue] = useState('')
    const [status, setStatus] = useState('')
    const navigate = useNavigate()
    
    // Run once on page load, to get available models and set initial selection to the first model
    useEffect(() => {
        fetch(`${API_BASE}/api/models`) // TODO: Replace API_BASE with production URL
              .then((response) => response.json())
              .then((json) => {
                setModels(json.models)
                setSelectedValue(json.models[0])
              })
              .catch((error) => console.error('Error fetching data: ', error))
    }, [])
    
    // Radio button click handling function
    function radioGroupHandler(event) {
        setSelectedValue(event.target.value)
    }

    // Get status of processing task
    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${API_BASE}/api/status/123`) // TODO: Replace API_BASE with production url and 123 with real job ID
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
    }, [navigate])

    return (
        <>
          <h1>Analysis</h1>
          <div className={style.layout}>
            <video controls className={style.videoPlayer} src={video} />
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
              {status && <div>Stroke classification is: {status}</div>}
            </div>
          </div>
        </>

    )
}