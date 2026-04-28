import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Results() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const jobId = state?.jobId

    const [results, setResults] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!jobId) {
            navigate('/')
            return
        }

        fetch(`/api/results/${jobId}`)
            .then((r) => {
                if (!r.ok) throw new Error(`Failed to fetch results: ${r.status}`)
                return r.json()
            })
            .then((json) => setResults(json))
            .catch((err) => {
                console.error(err)
                setError('Failed to load results.')
            })
    }, [jobId, navigate])

    if (!jobId) return null
    if (error) return <div>{error}</div>
    if (!results) return <div>Loading results...</div>

    return (
        <>
          <h2>Results</h2>
          <h3>Rally Summary</h3>
          <p>Total Strokes: {results.rally_summary?.total_strokes}</p>
          <p>Rally Length: {results.rally_summary?.rally_length_seconds} seconds</p>

          <h3>Strokes</h3>
          {results.strokes?.map((stroke, index) => (
            <div key={index}>
                <p>Timestamp: {stroke.timestamp_sec}s</p>
                <p>Type: {stroke.stroke_type}</p>
                <p>Confidence: {stroke.confidence}</p>
            </div>
          ))}
        </>
    )
}
