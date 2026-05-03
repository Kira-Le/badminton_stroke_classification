import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { API_BASE } from '../config'

import style from './Results.module.css'

export default function Results() {
    const [results, setResults] = useState(null)
    const location = useLocation()
    const { jobId, videoUrl } = location.state || {}
    
    // Run once on page load, to get available results
    useEffect(() => {
        fetch(`${API_BASE}/api/results/${jobId}`)
              .then((response) => response.json())
              .then((json) => setResults(json))
              .catch((error) => console.error('Error fetching data: ', error))
    }, [jobId])

    if (!results) return <div>Loading results...</div>
    
    return (
        <div className={style.page}>
          <h1>Results</h1>
          <div className={style.layout}>
            <div className={style.left}>
                <video
                src={videoUrl}
                controls
                className={style.video}
                />
                <div className={style.summary}>
                    <div className={style.summaryItem}>
                        <span className={style.summaryLabel}>Total strokes</span>
                        <span className={style.summaryValue}>{results.rally_summary.total_strokes}</span>
                    </div>
                    <div className={style.summaryItem}>
                        <span className={style.summaryLabel}>Rally length</span>
                        <span className={style.summaryValue}>{results.rally_summary.rally_length_seconds}s</span>
                    </div>
                </div>
                <div className={style.heatmapPlaceholder}>
                    <span>Heatmap coming soon</span>
                </div>
            </div>
            <div className={style.right}>
                <h2>Stroke Classification</h2>
                <table className={style.table}>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Stroke</th>
                            <th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.strokes.map((stroke, index) => (
                            <tr key={index} className={style.row}>
                                <td>{stroke.timestamp_sec}s</td>
                                <td className={style.strokeType}>{stroke.stroke_type}</td>
                                <td>
                                    <div className={style.confidenceBar}>
                                        <div
                                        className={style.confidenceFill}
                                        style={{ width: `${stroke.confidence * 100}%` }}
                                        />
                                        <span className={style.confidenceLabel}>
                                            {Math.round(stroke.confidence * 100)}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>  
                </table>
            </div>
        </div>
    </div>
    )
}