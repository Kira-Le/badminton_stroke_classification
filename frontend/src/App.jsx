import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import { Home, Analysis, Results, Models } from './pages'

function App() {

  return (
    <>
      <Header/>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="results" element={<Results />} />
          <Route path="models" element={<Models />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default App
