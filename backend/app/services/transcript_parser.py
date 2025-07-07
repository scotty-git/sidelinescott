"""
Transcript Parser - Parses raw conversation transcripts into structured turns

Handles the specific format from example scripts:
- AI/User labels followed by content
- VT tags (##VT_ENGAGING_HELPFUL##) 
- Noise markers (<noise>)
- Foreign language text and other artifacts
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ParsedTurn:
    """Represents a single turn in the conversation"""
    speaker: str  # "User" or "Lumen" (normalized)
    raw_text: str
    turn_index: int
    original_speaker_label: str  # "AI", "User", etc. from raw text
    vt_tags: List[str]  # Extracted VT emotion/behavior tags
    has_noise: bool
    has_foreign_text: bool

class TranscriptParser:
    """Parses raw conversation transcripts into structured turn data"""
    
    def __init__(self):
        # Pattern to match VT tags like ##VT_ENGAGING_HELPFUL##
        self.vt_tag_pattern = re.compile(r'##VT_[A-Z_]+##')
        
        # Pattern to match noise markers
        self.noise_pattern = re.compile(r'<noise>')
        
        # Pattern to detect likely foreign text (non-ASCII characters)
        self.foreign_text_pattern = re.compile(r'[^\x00-\x7F]+')
        
        # Common speaker labels and their normalization
        self.speaker_mappings = {
            'AI': 'Lumen',
            'Assistant': 'Lumen', 
            'Lumen': 'Lumen',
            'User': 'User',
            'Human': 'User',
            'Customer': 'User'
        }
    
    def parse_transcript(self, raw_transcript: str) -> List[ParsedTurn]:
        """
        Parse a raw transcript into structured turns
        
        Args:
            raw_transcript: Raw text from transcript file
            
        Returns:
            List of ParsedTurn objects
        """
        logger.info(f"Parsing transcript of {len(raw_transcript)} characters")
        
        # Split into lines and clean up
        lines = [line.strip() for line in raw_transcript.split('\n') if line.strip()]
        
        turns = []
        current_speaker = None
        current_content = []
        turn_index = 0
        
        for line in lines:
            # Check if this line is a speaker label
            if self._is_speaker_line(line):
                # Save previous turn if we have content
                if current_speaker and current_content:
                    turn_text = ' '.join(current_content).strip()
                    if turn_text:  # Only add non-empty turns
                        parsed_turn = self._create_parsed_turn(
                            current_speaker, turn_text, turn_index
                        )
                        turns.append(parsed_turn)
                        turn_index += 1
                
                # Start new turn
                current_speaker = self._normalize_speaker(line)
                current_content = []
            else:
                # This is content for the current speaker
                if current_speaker and line:
                    current_content.append(line)
        
        # Don't forget the last turn
        if current_speaker and current_content:
            turn_text = ' '.join(current_content).strip()
            if turn_text:
                parsed_turn = self._create_parsed_turn(
                    current_speaker, turn_text, turn_index
                )
                turns.append(parsed_turn)
        
        logger.info(f"Parsed {len(turns)} turns from transcript")
        
        # Log summary
        user_turns = sum(1 for turn in turns if turn.speaker == 'User')
        lumen_turns = sum(1 for turn in turns if turn.speaker == 'Lumen')
        logger.info(f"Turn breakdown: {user_turns} User, {lumen_turns} Lumen")
        
        return turns
    
    def _is_speaker_line(self, line: str) -> bool:
        """Check if a line represents a speaker label"""
        # Remove whitespace and check if it's a known speaker
        clean_line = line.strip()
        return clean_line in self.speaker_mappings
    
    def _normalize_speaker(self, speaker_line: str) -> str:
        """Normalize speaker labels to 'User' or 'Lumen'"""
        clean_speaker = speaker_line.strip()
        return self.speaker_mappings.get(clean_speaker, 'User')  # Default to User if unknown
    
    def _create_parsed_turn(self, speaker: str, content: str, turn_index: int) -> ParsedTurn:
        """Create a ParsedTurn object with extracted metadata"""
        
        # Extract VT tags
        vt_tags = self.vt_tag_pattern.findall(content)
        
        # Clean content by removing VT tags
        cleaned_content = self.vt_tag_pattern.sub('', content)
        
        # Check for noise markers
        has_noise = bool(self.noise_pattern.search(cleaned_content))
        
        # Remove noise markers from content
        cleaned_content = self.noise_pattern.sub('', cleaned_content)
        
        # Check for foreign text
        has_foreign_text = bool(self.foreign_text_pattern.search(cleaned_content))
        
        # Clean up extra whitespace
        cleaned_content = re.sub(r'\s+', ' ', cleaned_content).strip()
        
        # Remove excessive dots/ellipses
        cleaned_content = re.sub(r'\.{3,}', '...', cleaned_content)
        cleaned_content = re.sub(r'…{2,}', '...', cleaned_content)
        
        logger.debug(f"Turn {turn_index} ({speaker}): {len(vt_tags)} VT tags, "
                    f"noise={has_noise}, foreign={has_foreign_text}")
        
        return ParsedTurn(
            speaker=speaker,
            raw_text=cleaned_content,
            turn_index=turn_index,
            original_speaker_label=speaker,  # We already normalized it
            vt_tags=vt_tags,
            has_noise=has_noise,
            has_foreign_text=has_foreign_text
        )
    
    def get_parsing_stats(self, turns: List[ParsedTurn]) -> Dict[str, Any]:
        """Get statistics about the parsed transcript"""
        if not turns:
            return {}
        
        total_turns = len(turns)
        user_turns = sum(1 for turn in turns if turn.speaker == 'User')
        lumen_turns = sum(1 for turn in turns if turn.speaker == 'Lumen')
        
        vt_tag_counts = {}
        noise_turns = 0
        foreign_text_turns = 0
        
        for turn in turns:
            if turn.has_noise:
                noise_turns += 1
            if turn.has_foreign_text:
                foreign_text_turns += 1
            
            for tag in turn.vt_tags:
                vt_tag_counts[tag] = vt_tag_counts.get(tag, 0) + 1
        
        avg_turn_length = sum(len(turn.raw_text) for turn in turns) / total_turns
        
        return {
            'total_turns': total_turns,
            'user_turns': user_turns,
            'lumen_turns': lumen_turns,
            'turns_with_noise': noise_turns,
            'turns_with_foreign_text': foreign_text_turns,
            'vt_tag_counts': vt_tag_counts,
            'avg_turn_length_chars': round(avg_turn_length, 1),
            'longest_turn_chars': max(len(turn.raw_text) for turn in turns),
            'shortest_turn_chars': min(len(turn.raw_text) for turn in turns)
        }