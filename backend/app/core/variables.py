"""
5-Variable System Configuration for Pure Template Substitution
"""

# Supported variables for CleanerContext prompt templates
SUPPORTED_VARIABLES = {
    "raw_text": {
        "required": True,
        "source": "system",
        "description": "Current user input text to be cleaned"
    },
    "conversation_context": {
        "required": True,
        "source": "system", 
        "description": "Previous cleaned conversation turns for context"
    },
    "cleaning_level": {
        "required": True,
        "source": "system",
        "description": "Cleaning level: light, full, or auto"
    },
    "call_context": {
        "required": False,
        "source": "conversation",
        "description": "Business context from prequalification flow"
    },
    "additional_context": {
        "required": False,
        "source": "user",
        "description": "User-defined additional context for cleaning"
    }
}

def get_required_variables():
    """Get list of required variable names"""
    return [name for name, config in SUPPORTED_VARIABLES.items() if config["required"]]

def get_optional_variables():
    """Get list of optional variable names"""
    return [name for name, config in SUPPORTED_VARIABLES.items() if not config["required"]]

def is_supported_variable(variable_name: str) -> bool:
    """Check if a variable name is supported"""
    return variable_name in SUPPORTED_VARIABLES

def get_variable_info(variable_name: str) -> dict:
    """Get information about a specific variable"""
    return SUPPORTED_VARIABLES.get(variable_name, {})