import { Button, SearchBar, SingleFileUploader} from '../components'

import style from './Home.module.css'

export default function Home() {

    return (
        <>
          <div class={style.intro_box}>
            <h1>Welcome to Badminton Stroke Classifier</h1>
            <h2>Browse videos or upload a video to begin</h2>
            <Button>Upload Video</Button>
          </div>
          <div class={style.upload_box}>
            <p>File Upload:</p>
            <SingleFileUploader/>
          </div>
          <SearchBar/>
          <div class={style.browse_box}>

          </div>
          
         </>
    )
}