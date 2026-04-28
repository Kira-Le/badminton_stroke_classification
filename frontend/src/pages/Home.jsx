import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, SearchBar, SingleFileUploader, RadioButtonGroup } from '../components'

import style from './Home.module.css'

export default function Home() {
    const [showUploader, setShowUploader] = useState(false)
    const [models, setModels] = useState([])
    const [selectedModel, setSelectedModel] = useState('default')
    const navigate = useNavigate()

    useEffect(() => {
        fetch('/api/models')
            .then((r) => r.json())
            .then((json) => {
                if (json.models && json.models.length > 0) {
                    const names = json.models.map((m) => m.name)
                    setModels(names)
                    setSelectedModel(names[0])
                }
            })
            .catch((err) => console.error('Failed to fetch models:', err))
    }, [])

    function handleUploadSuccess(jobId) {
        navigate('/analysis', { state: { jobId, model: selectedModel } })
    }

    return (
        <>
          <div className={style.intro_box}>
            <h1>Welcome to Badminton Stroke Classifier</h1>
            <h2>Browse videos or upload a video to begin</h2>
            <Button onClick={() => setShowUploader(!showUploader)}>Upload Video</Button>
          </div>
          {showUploader && (
            <div className={style.upload_box}>
                {models.length > 0 && (
                    <RadioButtonGroup
                        label="Select a model: "
                        options={models}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        name="model-selection"
                    />
                )}
                <SingleFileUploader
                    model={selectedModel}
                    onUploadSuccess={handleUploadSuccess}
                />
            </div>
          )}
          <SearchBar/>
          <div className={style.browse_box}>
            {/* TODO: Add video thumbnails here */}
          </div>
        </>
    )
}
