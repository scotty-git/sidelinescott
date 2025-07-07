import React, { useState } from 'react'

export function TranscriptCleanerSimple() {
  const [step, setStep] = useState(1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Clean modern header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎯 Lumen Transcript Cleaner
          </h1>
          <p className="text-gray-600 mt-2">
            Transform messy conversation transcripts into clean, professional text using AI
          </p>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                ${step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
              `}>
                {num}
              </div>
              <div className="ml-2 text-sm">
                {num === 1 && 'Upload'}
                {num === 2 && 'Parse'}
                {num === 3 && 'Clean'}
                {num === 4 && 'Export'}
              </div>
              {num < 4 && <div className="w-16 h-1 bg-gray-200 mx-4" />}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Upload Your Transcript</h2>
              <p className="text-gray-600 mb-8">
                Get started by uploading a conversation transcript or trying our example
              </p>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium"
                >
                  📁 Upload File
                </button>
                
                <div className="text-gray-400">or</div>
                
                <button 
                  onClick={() => setStep(2)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-medium"
                >
                  📝 Try Example
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Parse Transcript</h2>
              <p className="text-gray-600 mb-8">
                Analyzing conversation structure and detecting artifacts...
              </p>
              
              <button 
                onClick={() => setStep(3)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium"
              >
                🔍 Parse Transcript
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">AI Cleaning</h2>
              <p className="text-gray-600 mb-8">
                Processing with Gemini 2.5 Flash-Lite for intelligent cleaning...
              </p>
              
              <button 
                onClick={() => setStep(4)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium"
              >
                🤖 Start AI Cleaning
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Export Results</h2>
              <p className="text-gray-600 mb-8">
                Your cleaned transcript is ready for download!
              </p>
              
              <div className="space-y-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium">
                  📥 Download Cleaned Transcript
                </button>
                
                <div>
                  <button 
                    onClick={() => setStep(1)}
                    className="text-gray-500 hover:text-gray-700 underline"
                  >
                    Start New Cleaning
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="font-semibold mb-2">Lightning Fast</h3>
            <p className="text-gray-600 text-sm">
              Powered by Gemini 2.5 Flash-Lite for sub-second processing
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl mb-3">🎯</div>
            <h3 className="font-semibold mb-2">Smart Cleaning</h3>
            <p className="text-gray-600 text-sm">
              Removes noise, fixes errors, preserves meaning with AI precision
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl mb-3">🔒</div>
            <h3 className="font-semibold mb-2">Context Aware</h3>
            <p className="text-gray-600 text-sm">
              Uses conversation history for intelligent, stateful processing
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}