// Adapted from: https://uploadcare.com/blog/how-to-upload-file-in-react/
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { Button } from '.'
import { API_BASE } from '../config'

import style from './SingleFileUploader.module.css'

const ACCEPTED_TYPES = [
    'video/mp4', 
    'video/x-msvideo', // .avi
    'video/x-matroska', // .mkv
    'video/quicktime', // .mov
    'video/webm',
]

const SingleFileUploader = () => {
    const [file, setFile] = useState(null)
    const [status, setStatus] = useState('initial')
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef(null)
    const navigate = useNavigate()
    
    const handleFileChange = (e) => {
        if (e.target.files) {
            const selectedFile = e.target.files[0]
            if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
                setStatus('invalid')
                setFile(null)
                return
            }
            setStatus('initial')
            setFile(selectedFile)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0]
            if (!ACCEPTED_TYPES.includes(droppedFile.type)) {
                setStatus('invalid')
                return
            }
            setStatus('initial')
            setFile(droppedFile)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setDragging(true)
    }

    const handleDragLeave = () => {
        setDragging(false)
    }
        
    const handleUpload = async () => {
        if (file) {
            setStatus('uploading')
            console.log('Uploading file...')
            
            const formData = new FormData()
            formData.append('file', file)

            try {
                const result = await fetch(`${API_BASE}/api/upload`, {
                    method: 'POST',
                    body: formData,
                })

            if (!result.ok) throw new Error(`Upload failed: ${result.status}`);
            
            const data = await result.json()

            console.log(data)
            setStatus('success')
            setTimeout(() => navigate("/analysis"), 1000)
            } catch (error) {
                console.error(error)
                setStatus('fail')
            }
        }

    }
    
    return (
    <>
      <div
      className={`${style.input_group} ${dragging ? style.dragging : ''}`} 
      onClick={() => inputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      >
        <Upload size={40} />
        <h2>Upload a video</h2>
        <p>Drag and drop or click to browse</p>
        <input
        ref={inputRef}
        id="upload"
        type="file"
        accept=".mp4,.avi,.mkv,.mov,.webm"
        onChange={handleFileChange}
        style={{ display: 'none'}}
        />
        {file && (
            <section>
                File details:
                <ul>
                    <li>Name: {file.name}</li>
                    <li>Type: {file.type}</li>
                    <li>Size: {file.size} bytes</li>
                </ul>
            </section>
        )}
      </div>
      <div className={style.confirm_details}>
        {file && (
            <Button 
            onClick={handleUpload}
            >Upload file</Button>
            )}
            <Result status={status} />
      </div>
    </>
  )
}

const Result = ({ status }) => {
    if (status === 'success') {
        return <p>✅ File uploaded successfully! Loading Analysis page...</p>
    } else if (status === 'invalid') {
        return <p>❌ Invalid file type. Please upload a video file (mp4, avi, mov, webm). </p>
    } else if (status === 'fail') {
        return <p>❌ File upload failed!</p>
    } else if (status === 'uploading') {
        return <p>⏳ Uploading selected file...</p>;
    } else {
        return null
  }
}

export default SingleFileUploader