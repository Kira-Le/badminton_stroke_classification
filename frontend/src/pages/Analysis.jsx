import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Analysis() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const jobId = state?.jobId

    const [status, setStatus] = useState('queued')

    useEffect(() => {
        if (!jobId) {
            navigate('/')
            return
        }

        const interval = setInterval(() => {
            fetch(`/api/status/${jobId}`)
                .then((r) => r.json())
                .then((json) => {
                    setStatus(json.status)
                    if (json.status === 'complete') {
                        clearInterval(interval)
                        navigate('/results', { state: { jobId } })
                    } else if (json.status === 'failed') {
                        clearInterval(interval)
                    }
                })
                .catch((err) => console.error('Error polling status:', err))
        }, 2000)

        return () => clearInterval(interval)
    }, [jobId, navigate])

    if (!jobId) return null

    return (
        <>
          <h1>Analysis</h1>
          <p>Processing your video...</p>
          <div>Status: {status}</div>
        </>
    )
}
