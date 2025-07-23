import React, { useState, useEffect } from 'react';
import { X, Copy, Clock, Brain, Code, AlertCircle, Settings, Play } from 'lucide-react';
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
  function_calls?: Array<{
    function_name: string;
    parameters: Record<string, any>;
    result: any;
    success: boolean;
    confidence_score: string;
  }>;
  function_decision?: {
    reasoning: string;
    calls_count: number;
    processing_time_ms: number;
  };
  function_decision_gemini_call?: {
    prompt: string;
    response: string;
    model_config: Record<string, any>;
    timestamp: number;
    success: boolean;
  };
  created_at: string;
}

interface GeminiQueryInspectorProps {
  conversationId: string;
  turnId: string;
  turnData?: TurnData;
  isOpen: boolean;
  onClose: () => void;
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
  onClose
}) => {
  const [details, setDetails] = useState<GeminiDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cleaning' | 'functions'>('cleaning');

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
      const data = response as GeminiDetails;
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
    } catch (err: any) {
      console.error('[GeminiQueryInspector] Failed to fetch Gemini details:', err);
      setError(`Failed to load Gemini query details: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
              total_ms: 0
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

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err: any) {
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

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('cleaning')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cleaning'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Brain className="w-4 h-4 inline mr-2" />
            Cleaning
          </button>
          <button
            onClick={() => setActiveTab('functions')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'functions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Function Calling
            {turnData?.function_calls && turnData.function_calls.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                {turnData.function_calls.length}
              </span>
            )}
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

          {details && !loading && activeTab === 'cleaning' && (
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
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap break-words max-h-[400px]">
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
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap break-words max-h-[400px]">
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
                <div className="space-y-4">
                  {details.gemini_details.timing_breakdown && typeof details.gemini_details.timing_breakdown === 'object' && Object.keys(details.gemini_details.timing_breakdown).length > 0 ? (
                    <>
                      {/* Infrastructure & Setup */}
                      <div className="space-y-2 mb-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Infrastructure & Setup</h4>
                        {[
                          { key: 'context_retrieval_ms', label: 'Context Retrieval' },
                          { key: 'database_query_ms', label: 'Database Query' }, 
                          { key: 'settings_preparation_ms', label: 'Settings Preparation' },
                          { key: 'processing_decision_ms', label: 'Processing Decision' }
                        ].map(({ key, label }) => {
                          const value = (details.gemini_details.timing_breakdown as any)[key] || 0;
                          const percentage = getTimingPercentage(
                            value as number,
                            details.gemini_details.timing_breakdown.total_ms || 1
                          );
                          
                          return (
                            <div key={key} className="relative">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {label}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {value}ms ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-gray-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Detailed Cleaning Processing Breakdown */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cleaning Processing Details 
                          <span className="text-xs text-gray-500 ml-2">
                            ({(details.gemini_details.timing_breakdown as any).cleaning_processing_ms || 'N/A'}ms total)
                          </span>
                        </h4>
                        {[
                          { key: 'prompt_preparation_ms', label: 'Prompt Preparation', isGeminiApi: false, isPure: false },
                          { key: 'gemini_api_ms', label: 'Gemini API (Total)', isGeminiApi: true, isPure: false },
                          { key: 'gemini_network_ms', label: '└─ PURE Network Time', isGeminiApi: true, isPure: true },
                          { key: 'response_parsing_ms', label: '└─ Response Parsing', isGeminiApi: false, isPure: false },
                          { key: 'database_save_ms', label: 'Database Save', isGeminiApi: false, isPure: false },
                          { key: 'context_update_ms', label: 'Context Update', isGeminiApi: false, isPure: false }
                        ].map(({ key, label, isGeminiApi, isPure }) => {
                          const value = (details.gemini_details.timing_breakdown as any)[key] || 0;
                          const cleaningTotal = (details.gemini_details.timing_breakdown as any).cleaning_processing_ms || details.gemini_details.timing_breakdown.total_ms || 1;
                          const percentage = getTimingPercentage(value as number, cleaningTotal);
                          
                          return (
                            <div key={key} className="relative">
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm ${
                                  isPure ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {label} {isPure && '⚡'} {isGeminiApi && !isPure && '🌐'}
                                </span>
                                <span className={`text-sm font-medium ${
                                  isPure 
                                    ? 'text-green-600 dark:text-green-400 font-bold'
                                    : isGeminiApi 
                                    ? 'text-blue-600 dark:text-blue-400' 
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {value}ms ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    isPure ? 'bg-green-500' : isGeminiApi ? 'bg-blue-500' : 'bg-gray-500'
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
                            {details.gemini_details.timing_breakdown.total_ms || 'N/A'}ms
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

          {/* Function Calling Tab */}
          {details && !loading && activeTab === 'functions' && (
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

              {/* Function Decision Process */}
              {(() => {
                console.log('[GeminiQueryInspector] Function calling debug:', {
                  hasTurnData: !!turnData,
                  hasFunctionDecisionGeminiCall: !!turnData?.function_decision_gemini_call,
                  functionDecisionKeys: turnData?.function_decision_gemini_call ? Object.keys(turnData.function_decision_gemini_call) : null,
                  turnDataKeys: turnData ? Object.keys(turnData) : null
                });
                return turnData?.function_decision_gemini_call;
              })() ? (
                <>
                  {/* Function Decision Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Function Decision Prompt
                      </h3>
                      <button
                        onClick={() => copyToClipboard(turnData.function_decision_gemini_call?.prompt || '', 'function-prompt')}
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedSection === 'function-prompt' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap break-words max-h-[400px]">
                      {turnData.function_decision_gemini_call.prompt || 'No function decision prompt available'}
                    </pre>
                  </div>

                  {/* Gemini Function Response */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        Gemini Function Decision Response
                      </h3>
                      <button
                        onClick={() => copyToClipboard(
                          formatJSON(turnData.function_decision_gemini_call?.response || null),
                          'function-response'
                        )}
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedSection === 'function-response' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap break-words max-h-[400px]">
                      {turnData.function_decision_gemini_call.response ? 
                        formatJSON(turnData.function_decision_gemini_call.response) : 
                        'No function decision response available'
                      }
                    </pre>
                  </div>

                  {/* Available Functions (Tools) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Available Functions (Tools)
                      </h3>
                      <button
                        onClick={() => copyToClipboard(
                          formatJSON(JSON.stringify(turnData.function_decision_gemini_call?.model_config?.tools || [])),
                          'function-tools'
                        )}
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedSection === 'function-tools' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap break-words max-h-[400px]">
                      {turnData.function_decision_gemini_call?.model_config?.tools ? 
                        formatJSON(JSON.stringify(turnData.function_decision_gemini_call.model_config.tools, null, 2)) : 
                        'No tools configuration available'
                      }
                    </pre>
                  </div>

                  {/* Function Decision Timing */}
                  {turnData.function_decision && (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4" />
                        Function Decision Timing
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Total Execution Time:</span>{' '}
                              {turnData.function_decision.total_execution_time_ms || 0}ms
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Functions Called:</span>{' '}
                              {turnData.function_decision.functions_called || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Functions Failed:</span>{' '}
                              {turnData.function_decision.functions_failed || 0}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Decision Confidence:</span>{' '}
                              <span className={`font-medium ${
                                turnData.function_decision.confidence_score === 'HIGH' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : turnData.function_decision.confidence_score === 'MEDIUM'
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {turnData.function_decision.confidence_score || 'N/A'}
                              </span>
                            </p>
                          </div>
                        </div>
                        {turnData.function_decision.error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                            <p className="text-red-700 dark:text-red-300 text-sm">
                              <span className="font-medium">Error:</span> {turnData.function_decision.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <p className="text-yellow-700 dark:text-yellow-300">
                      No function decision data available for this turn. This may be a Lumen turn or a turn where no functions were called.
                    </p>
                  </div>
                </div>
              )}

              {/* Executed Functions */}
              {turnData?.function_calls && turnData.function_calls.length > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Play className="w-4 h-4" />
                    Executed Functions ({turnData.function_calls.length})
                  </h3>
                  <div className="space-y-4">
                    {turnData.function_calls.map((funcCall, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            {funcCall.function_name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              funcCall.success 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {funcCall.success ? 'Executed' : 'Failed'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              funcCall.confidence_score === 'HIGH' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : funcCall.confidence_score === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {funcCall.confidence_score}
                            </span>
                          </div>
                        </div>
                        
                        {/* Parameters */}
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parameters:</p>
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs whitespace-pre-wrap break-words">
                            {JSON.stringify(funcCall.parameters, null, 2)}
                          </pre>
                        </div>
                        
                        {/* Result */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Result:</p>
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs whitespace-pre-wrap break-words">
                            {funcCall.result ? JSON.stringify(funcCall.result, null, 2) : 'No result data'}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No functions were executed for this turn.
                    </p>
                  </div>
                </div>
              )}

              {/* Function Decision Metadata */}
              {turnData?.function_decision && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                    Function Decision Metadata
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Decision Reasoning:</span>{' '}
                      {turnData.function_decision.thought_process || 'N/A'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Functions Called:</span>{' '}
                      {turnData.function_decision.functions_called || 0}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Processing Time:</span>{' '}
                      {turnData.function_decision.total_execution_time_ms || 0}ms
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};