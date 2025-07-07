import { Routes, Route } from 'react-router-dom'
import { TranscriptCleanerPro } from './pages/TranscriptCleanerPro'

function App() {
  return (
    <Routes>
      <Route path="/" element={<TranscriptCleanerPro />} />
      <Route path="/transcript" element={<TranscriptCleanerPro />} />
    </Routes>
  )
}

export default App
