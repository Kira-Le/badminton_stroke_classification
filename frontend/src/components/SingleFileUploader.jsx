// Adapted from: https://uploadcare.com/blog/how-to-upload-file-in-react/
import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '.'

import style from './SingleFileUploader.module.css'

const SingleFileUploader = ({ model = 'default', onUploadSuccess }) => {
    const [file, setFile] = useState(null)
    const [status, setStatus] = useState('initial')
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef(null)

    const handleFileChange = (e) => {
        if (e.target.files) {
            setStatus('initial')
            setFile(e.target.files[0])
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setStatus('initial')
            setFile(e.dataTransfer.files[0])
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

            const formData = new FormData()
            formData.append('file', file)

            try {
                const result = await fetch(`/api/upload?model=${encodeURIComponent(model)}`, {
                    method: 'POST',
                    body: formData,
                })

                if (!result.ok) throw new Error(`Upload failed: ${result.status}`)

                const data = await result.json()
                setStatus('success')
                if (onUploadSuccess) onUploadSuccess(data.job_id)
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
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none'}}
        />
        {file && (
            <section>
                File details:
                <ul>
                    <li>Name: {file.name}</li>
                    <li>Type: {file.type}</li>
                    <li>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</li>
                </ul>
            </section>
        )}
      </div>
      <div className={style.confirm_details}>
        {file && (
            <Button onClick={handleUpload}>Upload file</Button>
        )}
        <Result status={status} />
      </div>
    </>
  )
}

const Result = ({ status }) => {
    if (status === 'success') {
        return <p>✅ File uploaded successfully! Starting analysis...</p>
    } else if (status === 'fail') {
        return <p>❌ File upload failed!</p>
    } else if (status === 'uploading') {
        return <p>⏳ Uploading selected file...</p>
    } else {
        return null
    }
}

export default SingleFileUploader
