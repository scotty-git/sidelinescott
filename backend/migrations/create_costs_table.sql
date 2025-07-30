-- Migration: Create costs table for API cost tracking
-- Date: 2025-01-25
-- Description: Add comprehensive cost tracking for all Gemini API calls

CREATE TABLE IF NOT EXISTS costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    
    -- Cleaning API costs (always present)
    cleaning_input_tokens INTEGER DEFAULT 0 NOT NULL,
    cleaning_output_tokens INTEGER DEFAULT 0 NOT NULL,
    cleaning_cost_usd DECIMAL(10,6) DEFAULT 0.0 NOT NULL,
    
    -- Function decision API costs (present for user turns, 0 for Lumen turns)
    function_input_tokens INTEGER DEFAULT 0 NOT NULL,
    function_output_tokens INTEGER DEFAULT 0 NOT NULL,
    function_cost_usd DECIMAL(10,6) DEFAULT 0.0 NOT NULL,
    
    -- Totals
    total_tokens INTEGER DEFAULT 0 NOT NULL,
    total_cost_usd DECIMAL(10,6) DEFAULT 0.0 NOT NULL,
    
    -- Metadata
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Unique constraint: one cost record per turn per evaluation
    CONSTRAINT unique_turn_evaluation_cost UNIQUE (turn_id, evaluation_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_costs_evaluation_id ON costs(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_costs_turn_id ON costs(turn_id);
CREATE INDEX IF NOT EXISTS idx_costs_created_at ON costs(created_at);
CREATE INDEX IF NOT EXISTS idx_costs_total_cost ON costs(total_cost_usd);

-- Comments
COMMENT ON TABLE costs IS 'Tracks API costs for each turn within an evaluation';
COMMENT ON COLUMN costs.cleaning_input_tokens IS 'Input tokens used for cleaning API call';
COMMENT ON COLUMN costs.cleaning_output_tokens IS 'Output tokens used for cleaning API call';
COMMENT ON COLUMN costs.function_input_tokens IS 'Input tokens used for function decision API call';
COMMENT ON COLUMN costs.function_output_tokens IS 'Output tokens used for function decision API call';
COMMENT ON COLUMN costs.total_cost_usd IS 'Total cost in USD for all API calls for this turn';