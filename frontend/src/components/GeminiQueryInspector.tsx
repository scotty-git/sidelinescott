import React, { useState, useEffect } from 'react';
import { X, Copy, Clock, Brain, Code, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api';

interface TurnData {
  turn_id: string;
  conversation_id: string;
  speaker: string;
  raw_text: string;
  cleaned_text: string;
  metadata: {
    confidence_score: string;
    cleaning_applied: boolean;
    cleaning_level: string;
    timing_breakdown?: {
      context_retrieval_ms: number;
      prompt_preparation_ms: number;
      gemini_api_ms: number;
      database_save_ms: number;
      prompt_logging_ms: number;
      total_ms: number;
    };
    corrections: Array<{
      original: string;
      corrected: string;
      confidence: string;
      reason: string;
    }>;
    context_detected: string;
    processing_time_ms: number;
    ai_model_used: string;
    gemini_prompt?: string;
    gemini_response?: string;
  };
  created_at: string;
}

interface GeminiQueryInspectorProps {
  conversationId: string;
  turnId: string;
  turnData?: TurnData;
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

interface GeminiDetails {
  turn_id: string;
  conversation_id: string;
  speaker: string;
  raw_text: string;
  cleaned_text: string;
  gemini_details: {
    prompt_sent: string | null;
    response_received: string | null;
    model_used: string;
    processing_time_ms: number;
    timing_breakdown: {
      context_retrieval_ms: number;
      prompt_preparation_ms: number;
      gemini_api_ms: number;
      database_save_ms: number;
      prompt_logging_ms: number;
      total_ms: number;
    };
    confidence_score: string;
    cleaning_level: string;
    corrections: Array<{
      original: string;
      corrected: string;
      confidence: string;
      reason: string;
    }>;
    context_detected: string;
  };
  created_at: string;
}

export const GeminiQueryInspector: React.FC<GeminiQueryInspectorProps> = ({
  conversationId,
  turnId,
  turnData,
  isOpen,
  onClose,
  darkMode
}) => {
  const [details, setDetails] = useState<GeminiDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Theme colors
  const theme = {
    bg: darkMode ? '#1a1a1a' : '#ffffff',
    bgSecondary: darkMode ? '#262626' : '#f9fafb',
    bgTertiary: darkMode ? '#303030' : '#f3f4f6',
    text: darkMode ? '#e5e5e5' : '#111827',
    textSecondary: darkMode ? '#a3a3a3' : '#6b7280',
    textMuted: darkMode ? '#737373' : '#9ca3af',
    border: darkMode ? '#404040' : '#e5e7eb',
    accent: '#3b82f6'
  };

  useEffect(() => {
    if (isOpen && conversationId && turnId) {
      if (turnData) {
        // Use the provided turn data directly - transform it to match GeminiDetails format
        console.log('[GeminiQueryInspector] Using provided turnData:', turnData);
        const transformedDetails: GeminiDetails = {
          turn_id: turnData.turn_id,
          conversation_id: turnData.conversation_id,
          speaker: turnData.speaker,
          raw_text: turnData.raw_text,
          cleaned_text: turnData.cleaned_text,
          gemini_details: {
            prompt_sent: turnData.metadata.gemini_prompt || null,
            response_received: turnData.metadata.gemini_response || null,
            model_used: turnData.metadata.ai_model_used,
            processing_time_ms: turnData.metadata.processing_time_ms,
            timing_breakdown: turnData.metadata.timing_breakdown || {
              context_retrieval_ms: 0,
              prompt_preparation_ms: 0,
              gemini_api_ms: 0,
              database_save_ms: 0,
              prompt_logging_ms: 0,
              total_ms: turnData.metadata.processing_time_ms
            },
            confidence_score: turnData.metadata.confidence_score,
            cleaning_level: turnData.metadata.cleaning_level,
            corrections: turnData.metadata.corrections,
            context_detected: turnData.metadata.context_detected
          },
          created_at: turnData.created_at
        };
        setDetails(transformedDetails);
        setLoading(false);
        setError(null);
      } else {
        // Fallback to API fetch if no turnData provided
        fetchGeminiDetails();
      }
    }
  }, [isOpen, conversationId, turnId, turnData]);

  const fetchGeminiDetails = async () => {
    console.log('[GeminiQueryInspector] Starting fetch for:', { conversationId, turnId });
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/api/v1/conversations/${conversationId}/turns/${turnId}/gemini-details`
      );
      console.log('[GeminiQueryInspector] Raw response:', response);
      
      // The API client returns the data directly, not wrapped in a .data property
      const data = response;
      console.log('[GeminiQueryInspector] Response data:', data);
      
      // Validate the response structure
      if (!data) {
        throw new Error('No data in response');
      }
      
      if (!data.gemini_details) {
        console.warn('[GeminiQueryInspector] Missing gemini_details in response:', data);
        throw new Error('Missing gemini_details in response');
      }
      
      console.log('[GeminiQueryInspector] Gemini details:', data.gemini_details);
      setDetails(data);
    } catch (err) {
      console.error('[GeminiQueryInspector] Failed to fetch Gemini details:', err);
      setError(`Failed to load Gemini query details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatJSON = (json: string | null) => {
    if (!json) return 'No data available';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const getTimingPercentage = (time: number, total: number) => {
    return ((time / total) * 100).toFixed(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Gemini Query Inspector
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading Gemini query details...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {details && !loading && (
            <div className="space-y-6">
              {/* Turn Info */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Turn Information
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Speaker:</span> {details.speaker}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Turn ID:</span> {details.turn_id}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(details.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Prompt Sent */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Prompt Sent to Gemini
                  </h3>
                  <button
                    onClick={() => copyToClipboard(details.gemini_details.prompt_sent || '', 'prompt')}
                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'prompt' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {details.gemini_details.prompt_sent || 'No prompt data available - this may be a Lumen turn or mock data'}
                </pre>
              </div>

              {/* Gemini Response */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Gemini Response
                  </h3>
                  <button
                    onClick={() => copyToClipboard(
                      formatJSON(details.gemini_details.response_received),
                      'response'
                    )}
                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'response' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {details.gemini_details.response_received ? 
                    formatJSON(details.gemini_details.response_received) : 
                    'No response data available - this may be a Lumen turn or mock data'
                  }
                </pre>
              </div>

              {/* Timing Breakdown */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" />
                  Latency Breakdown
                </h3>
                <div className="space-y-3">
                  {details.gemini_details.timing_breakdown && typeof details.gemini_details.timing_breakdown === 'object' && Object.keys(details.gemini_details.timing_breakdown).length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {Object.entries(details.gemini_details.timing_breakdown)
                          .filter(([key]) => key !== 'total_ms')
                          .map(([key, value]) => {
                            const percentage = getTimingPercentage(
                              value as number,
                              details.gemini_details.timing_breakdown.total_ms || 1
                            );
                            const label = key.replace(/_/g, ' ').replace(/ms$/, '');
                            const isGeminiApi = key === 'gemini_api_ms';
                            
                            return (
                              <div key={key} className="relative">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                    {label} {isGeminiApi && '⭐'}
                                  </span>
                                  <span className={`text-sm font-medium ${
                                    isGeminiApi 
                                      ? 'text-blue-600 dark:text-blue-400' 
                                      : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {value}ms ({percentage}%)
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      isGeminiApi ? 'bg-blue-500' : 'bg-gray-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Total Processing Time
                          </span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {details.gemini_details.timing_breakdown.total_ms || details.gemini_details.processing_time_ms || 'N/A'}ms
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                      No timing breakdown available - this may be a Lumen turn or mock data
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Metadata */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Processing Metadata
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Model:</span>{' '}
                      {details.gemini_details.model_used || 'N/A'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Confidence:</span>{' '}
                      <span className={`font-medium ${
                        details.gemini_details.confidence_score === 'HIGH' 
                          ? 'text-green-600 dark:text-green-400' 
                          : details.gemini_details.confidence_score === 'MEDIUM'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {details.gemini_details.confidence_score || 'N/A'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Cleaning Level:</span>{' '}
                      {details.gemini_details.cleaning_level || 'N/A'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Context:</span>{' '}
                      {details.gemini_details.context_detected || 'N/A'}
                    </p>
                  </div>
                </div>
                
                {details.gemini_details.corrections && Array.isArray(details.gemini_details.corrections) && details.gemini_details.corrections.length > 0 ? (
                  <div className="mt-4">
                    <p className="font-medium text-gray-900 dark:text-white mb-2">
                      Corrections Applied:
                    </p>
                    <div className="space-y-2">
                      {details.gemini_details.corrections.map((correction, idx) => (
                        <div key={idx} className="text-sm bg-white dark:bg-gray-800 p-2 rounded">
                          <p className="text-gray-600 dark:text-gray-400">
                            "<span className="line-through">{correction.original}</span>" → 
                            "<span className="text-green-600 dark:text-green-400">{correction.corrected}</span>"
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {correction.reason} (Confidence: {correction.confidence})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                      No corrections were applied to this turn
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};