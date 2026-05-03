import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, SearchBar, SingleFileUploader} from '../components'

import style from './Home.module.css'

export default function Home() {
  const [showUploader, setShowUploader] = useState(false)
  const navigate = useNavigate()

    return (
        <>
          <div className={style.intro_box}>
            <h1>Welcome to Badminton Stroke Classifier</h1>
            <h2>Browse videos or upload a video to begin</h2>
            <div className={style.button_container}>
              <Button onClick={() => setShowUploader(!showUploader)}>Upload Video</Button>
              <Button onClick={() => navigate('/models')}>About the Models</Button>
            </div>
          </div>
          {showUploader && <div className={style.upload_box}>
            <SingleFileUploader/>
            </div>
            }
          <SearchBar/>
          <div className={style.browse_box}>
            {/* TODO: Add video thumbnails here */}
          </div>
          
         </>
    )
}