import { Routes, Route } from 'react-router-dom'
import { TranscriptCleanerPro } from './pages/TranscriptCleanerPro'
import { PromptEngineeringDashboard } from './pages/PromptEngineeringDashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<TranscriptCleanerPro />} />
      <Route path="/transcript" element={<TranscriptCleanerPro />} />
      <Route path="/prompt-engineering" element={<PromptEngineeringDashboard />} />
    </Routes>
  )
}

export default App
