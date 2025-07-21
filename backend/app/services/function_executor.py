"""
Function Executor - Executes functions against mock customer data

This service handles the actual execution of functions called by the AI,
modifying the MirroredMockCustomer data and tracking state changes.
"""

import time
import json
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.mock_customer import MirroredMockCustomer
from app.services.function_registry import function_registry

logger = logging.getLogger(__name__)


class FunctionExecutor:
    """Executes functions against mock customer data with state tracking"""
    
    def __init__(self):
        self.function_registry = function_registry
        
        # Track execution metrics
        self.execution_metrics = {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'execution_times': []
        }
        
        print("[FunctionExecutor] Initialized function executor")
    
    async def execute_function(
        self,
        function_name: str,
        parameters: Dict[str, Any],
        mirrored_customer: MirroredMockCustomer,
        db: Session,
        persist_to_db: bool = True
    ) -> Dict[str, Any]:
        """Execute a function and return the result with state changes"""
        start_time = time.time()
        
        print(f"[FunctionExecutor] 🔧 Executing function: {function_name}")
        print(f"[FunctionExecutor] 📋 Parameters: {parameters}")
        
        try:
            # Validate function call
            is_valid, validation_msg = self.function_registry.validate_function_call(function_name, parameters)
            if not is_valid:
                print(f"[FunctionExecutor] ❌ Validation failed: {validation_msg}")
                return {
                    'success': False,
                    'error': f"Validation failed: {validation_msg}",
                    'execution_time_ms': round((time.time() - start_time) * 1000, 2)
                }
            
            # Capture before state
            before_state = self._capture_customer_state(mirrored_customer)
            
            # Execute the specific function
            if function_name == "update_profile_field":
                result = await self._execute_update_profile_field(parameters, mirrored_customer, db, persist_to_db)
            elif function_name == "log_metric":
                result = await self._execute_log_metric(parameters, mirrored_customer, db, persist_to_db)
            elif function_name == "record_business_insight":
                result = await self._execute_record_business_insight(parameters, mirrored_customer, db, persist_to_db)
            elif function_name == "log_marketing_channels":
                result = await self._execute_log_marketing_channels(parameters, mirrored_customer, db, persist_to_db)
            elif function_name == "initiate_demo_creation":
                result = await self._execute_initiate_demo_creation(parameters, mirrored_customer, db, persist_to_db)
            else:
                raise ValueError(f"Unknown function: {function_name}")
            
            # Capture after state
            after_state = self._capture_customer_state(mirrored_customer)
            
            # Calculate execution time
            execution_time = round((time.time() - start_time) * 1000, 2)
            
            # Update metrics
            self.execution_metrics['total_executions'] += 1
            self.execution_metrics['successful_executions'] += 1
            self.execution_metrics['execution_times'].append(execution_time)
            
            print(f"[FunctionExecutor] ✅ Function executed successfully in {execution_time}ms")
            
            return {
                'success': True,
                'result': result,
                'before_state': before_state,
                'after_state': after_state,
                'execution_time_ms': execution_time,
                'changes_made': self._detect_changes(before_state, after_state)
            }
            
        except Exception as e:
            execution_time = round((time.time() - start_time) * 1000, 2)
            self.execution_metrics['total_executions'] += 1
            self.execution_metrics['failed_executions'] += 1
            
            logger.error(f"Function execution failed: {e}")
            print(f"[FunctionExecutor] ❌ Function execution failed: {e}")
            
            return {
                'success': False,
                'error': str(e),
                'execution_time_ms': execution_time
            }
    
    async def _execute_update_profile_field(
        self, 
        parameters: Dict[str, Any], 
        customer: MirroredMockCustomer, 
        db: Session
    ) -> Dict[str, Any]:
        """Execute update_profile_field function"""
        field_to_update = parameters["field_to_update"]
        new_value = parameters["new_value"]
        
        print(f"[FunctionExecutor] 📝 Updating {field_to_update} to: {new_value}")
        
        # Get old value for tracking
        old_value = getattr(customer, field_to_update)
        
        # Update the field
        setattr(customer, field_to_update, new_value)
        
        # Save changes to database
        db.commit()
        db.refresh(customer)
        
        return {
            'field_updated': field_to_update,
            'old_value': old_value,
            'new_value': new_value,
            'message': f"Updated {field_to_update} from '{old_value}' to '{new_value}'"
        }
    
    async def _execute_log_metric(
        self, 
        parameters: Dict[str, Any], 
        customer: MirroredMockCustomer, 
        db: Session
    ) -> Dict[str, Any]:
        """Execute log_metric function"""
        metric_name = parameters["metric_name"]
        value_string = parameters["value_string"]
        
        print(f"[FunctionExecutor] 📊 Logging metric {metric_name}: {value_string}")
        
        # Initialize business_insights if None
        if customer.business_insights is None:
            customer.business_insights = {}
        
        # Add metric to business insights
        if "metrics" not in customer.business_insights:
            customer.business_insights["metrics"] = {}
        
        customer.business_insights["metrics"][metric_name] = value_string
        
        # Mark the object as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(customer, "business_insights")
        
        # Save changes
        db.commit()
        db.refresh(customer)
        
        return {
            'metric_logged': metric_name,
            'value': value_string,
            'message': f"Logged {metric_name}: {value_string}"
        }
    
    async def _execute_record_business_insight(
        self, 
        parameters: Dict[str, Any], 
        customer: MirroredMockCustomer, 
        db: Session
    ) -> Dict[str, Any]:
        """Execute record_business_insight function"""
        category = parameters["category"]
        insight_details = parameters["insight_details"]
        
        print(f"[FunctionExecutor] 💡 Recording {category} insight: {insight_details}")
        
        # Initialize business_insights if None
        if customer.business_insights is None:
            customer.business_insights = {}
        
        # Add insight to business insights
        if "insights" not in customer.business_insights:
            customer.business_insights["insights"] = []
        
        insight_entry = {
            'category': category,
            'details': insight_details,
            'timestamp': time.time()
        }
        
        customer.business_insights["insights"].append(insight_entry)
        
        # Mark the object as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(customer, "business_insights")
        
        # Save changes
        db.commit()
        db.refresh(customer)
        
        return {
            'insight_recorded': True,
            'category': category,
            'details': insight_details,
            'message': f"Recorded {category} insight"
        }
    
    async def _execute_log_marketing_channels(
        self, 
        parameters: Dict[str, Any], 
        customer: MirroredMockCustomer, 
        db: Session
    ) -> Dict[str, Any]:
        """Execute log_marketing_channels function"""
        channels = parameters["channels"]
        
        print(f"[FunctionExecutor] 📢 Logging marketing channels: {channels}")
        
        # Initialize business_insights if None
        if customer.business_insights is None:
            customer.business_insights = {}
        
        # Add channels to business insights
        if "marketing_channels" not in customer.business_insights:
            customer.business_insights["marketing_channels"] = []
        
        # Add new channels (avoid duplicates)
        existing_channels = set(customer.business_insights["marketing_channels"])
        new_channels = [ch for ch in channels if ch not in existing_channels]
        
        customer.business_insights["marketing_channels"].extend(new_channels)
        
        # Mark the object as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(customer, "business_insights")
        
        # Save changes
        db.commit()
        db.refresh(customer)
        
        return {
            'channels_logged': new_channels,
            'total_channels': len(customer.business_insights["marketing_channels"]),
            'message': f"Logged {len(new_channels)} new marketing channels"
        }
    
    async def _execute_initiate_demo_creation(
        self, 
        parameters: Dict[str, Any], 
        customer: MirroredMockCustomer, 
        db: Session
    ) -> Dict[str, Any]:
        """Execute initiate_demo_creation function"""
        print(f"[FunctionExecutor] 🚀 Initiating demo creation")
        
        # Initialize business_insights if None
        if customer.business_insights is None:
            customer.business_insights = {}
        
        # Mark demo creation initiated
        customer.business_insights["demo_creation_initiated"] = {
            'timestamp': time.time(),
            'status': 'initiated'
        }
        
        # Mark the object as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(customer, "business_insights")
        
        # Save changes only if persist_to_db is True
        if persist_to_db:
            db.commit()
            db.refresh(customer)
        
        return {
            'demo_initiated': True,
            'timestamp': time.time(),
            'message': "Demo creation has been initiated"
        }
    
    def _capture_customer_state(self, customer: MirroredMockCustomer) -> Dict[str, Any]:
        """Capture the current state of the customer for before/after comparison"""
        return {
            'user_name': customer.user_name,
            'job_title': customer.job_title,
            'company_name': customer.company_name,
            'company_description': customer.company_description,
            'company_size': customer.company_size,
            'company_sector': customer.company_sector,
            'business_insights': customer.business_insights or {},
            'timestamp': time.time()
        }
    
    def _detect_changes(self, before_state: Dict[str, Any], after_state: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect what changes were made between before and after states"""
        changes = []
        
        # Check profile fields
        profile_fields = ['user_name', 'job_title', 'company_name', 'company_description', 'company_size', 'company_sector']
        
        for field in profile_fields:
            if before_state.get(field) != after_state.get(field):
                changes.append({
                    'type': 'profile_field_update',
                    'field': field,
                    'old_value': before_state.get(field),
                    'new_value': after_state.get(field)
                })
        
        # Check business insights changes
        before_insights = before_state.get('business_insights', {})
        after_insights = after_state.get('business_insights', {})
        
        if before_insights != after_insights:
            changes.append({
                'type': 'business_insights_update',
                'before': before_insights,
                'after': after_insights
            })
        
        return changes
    
    def get_execution_metrics(self) -> Dict[str, Any]:
        """Get execution metrics for monitoring"""
        metrics = self.execution_metrics.copy()
        
        if metrics['execution_times']:
            metrics['avg_execution_time'] = round(sum(metrics['execution_times']) / len(metrics['execution_times']), 2)
            metrics['max_execution_time'] = round(max(metrics['execution_times']), 2)
            metrics['min_execution_time'] = round(min(metrics['execution_times']), 2)
        else:
            metrics['avg_execution_time'] = 0
            metrics['max_execution_time'] = 0
            metrics['min_execution_time'] = 0
        
        return metrics