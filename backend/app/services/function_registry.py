"""
Function Registry - Defines available functions for the function caller

This module defines all available functions that can be called by the AI,
including their descriptions, parameters, and schemas.
"""

from typing import Dict, Any, List
import json


class FunctionRegistry:
    """Registry of available functions that can be called by the AI"""
    
    def __init__(self):
        # Define available functions with their schemas - exactly as specified
        self.functions = {
            "update_profile_field": {
                "description": "Updates a single, specific field in the prospect's company or contact profile. Use this ONLY when the user provides a direct correction or addition to a known fact about them.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "field_to_update": {
                            "type": "string",
                            "description": "The specific field that needs to be changed.",
                            "enum": ["user_name", "job_title", "company_name", "company_description", "company_size", "company_sector"]
                        },
                        "new_value": {
                            "type": "string",
                            "description": "The new and correct value for the field."
                        }
                    },
                    "required": ["field_to_update", "new_value"]
                }
            },
            "log_metric": {
                "description": "Logs a specific quantitative metric about the business. Use this when the user states a number related to their operations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "metric_name": {
                            "type": "string",
                            "description": "The name of the metric being provided.",
                            "enum": ["monthly_website_visitors", "monthly_inbound_calls", "monthly_form_submissions"]
                        },
                        "value_string": {
                            "type": "string",
                            "description": "The value the user provided, captured exactly as a string to handle ranges or estimates (e.g., '500', '50 to 100', 'in the hundreds')."
                        }
                    },
                    "required": ["metric_name", "value_string"]
                }
            },
            "record_business_insight": {
                "description": "Records a key qualitative insight, problem, goal, or motivation shared by the user. Use this to capture the 'why' behind their interest or the challenges they face.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "description": "The classification of the insight.",
                            "enum": ["CHALLENGE", "GOAL", "MOTIVATION", "STRENGTH"]
                        },
                        "insight_details": {
                            "type": "string",
                            "description": "The full user statement or summary of the insight."
                        }
                    },
                    "required": ["category", "insight_details"]
                }
            },
            "log_marketing_channels": {
                "description": "Logs the marketing or lead generation channels the user mentions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channels": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "A list of channels (e.g., ['PPC', 'Google', 'Checkatrade'])."
                        }
                    },
                    "required": ["channels"]
                }
            },
            "initiate_demo_creation": {
                "description": "Call this ONLY when the user gives explicit, positive, and unambiguous consent to create the demo, such as 'Yes, I'm ready' or 'Let's do it'.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    
    def get_functions_catalog(self) -> str:
        """Get the functions catalog formatted for the prompt"""
        catalog = []
        
        for func_name, func_spec in self.functions.items():
            catalog_entry = {
                "name": func_name,
                "description": func_spec["description"],
                "parameters": func_spec["parameters"]
            }
            catalog.append(catalog_entry)
        
        return json.dumps(catalog, indent=2)
    
    def get_function_spec(self, function_name: str) -> Dict[str, Any]:
        """Get the specification for a specific function"""
        return self.functions.get(function_name)
    
    def validate_function_call(self, function_name: str, parameters: Dict[str, Any]) -> tuple[bool, str]:
        """Validate that a function call has the correct parameters"""
        if function_name not in self.functions:
            return False, f"Unknown function: {function_name}"
        
        func_spec = self.functions[function_name]
        param_spec = func_spec["parameters"]
        
        # Check required parameters
        required_params = param_spec.get("required", [])
        for param in required_params:
            if param not in parameters:
                return False, f"Missing required parameter: {param}"
        
        # Validate parameter types and enums
        properties = param_spec.get("properties", {})
        for param_name, param_value in parameters.items():
            if param_name not in properties:
                return False, f"Unknown parameter: {param_name}"
            
            param_schema = properties[param_name]
            
            # Check enum values
            if "enum" in param_schema and param_value not in param_schema["enum"]:
                return False, f"Invalid value for {param_name}: {param_value}. Must be one of {param_schema['enum']}"
            
            # Basic type checking
            expected_type = param_schema.get("type")
            if expected_type == "string" and not isinstance(param_value, str):
                return False, f"Parameter {param_name} must be a string"
            elif expected_type == "boolean" and not isinstance(param_value, bool):
                return False, f"Parameter {param_name} must be a boolean"
            elif expected_type == "array" and not isinstance(param_value, list):
                return False, f"Parameter {param_name} must be an array"
        
        return True, "Valid"
    
    def get_available_function_names(self) -> List[str]:
        """Get list of all available function names"""
        return list(self.functions.keys())


# Singleton instance
function_registry = FunctionRegistry()