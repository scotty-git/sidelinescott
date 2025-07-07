from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class CreateConversationRequest(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ConversationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str  # 'active' | 'paused' | 'completed'
    turns_count: int
    created_at: str
    updated_at: str
    metadata: Dict[str, Any]

class ListConversationsResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
    page: int
    per_page: int

class ParseTranscriptRequest(BaseModel):
    raw_transcript: str

class ParsedTurnResponse(BaseModel):
    speaker: str
    raw_text: str
    turn_index: int
    original_speaker_label: str
    vt_tags: List[str]
    has_noise: bool
    has_foreign_text: bool

class TranscriptStatsResponse(BaseModel):
    total_turns: int
    user_turns: int
    lumen_turns: int
    turns_with_noise: int
    turns_with_foreign_text: int
    avg_turn_length_chars: float
    longest_turn_chars: int
    shortest_turn_chars: int
    vt_tag_counts: Dict[str, int]

class ParseTranscriptResponse(BaseModel):
    parsed_turns: List[ParsedTurnResponse]
    stats: TranscriptStatsResponse