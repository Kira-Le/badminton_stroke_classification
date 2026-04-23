import { useState } from 'react'
import { Button, SearchBar, SingleFileUploader} from '../components'

import style from './Home.module.css'

export default function Home() {
  const [showUploader, setShowUploader] = useState(false)

    return (
        <>
          <div className={style.intro_box}>
            <h1>Welcome to Badminton Stroke Classifier</h1>
            <h2>Browse videos or upload a video to begin</h2>
            <Button onClick={() => setShowUploader(!showUploader)}>Upload Video</Button>
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