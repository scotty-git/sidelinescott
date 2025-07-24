# Python Classes: From Beginner to Real-World Implementation

## 🎯 Learning Objective
By the end of this lesson, you'll understand Python classes through a real-world example: our **EvaluationManager** system. We'll start simple and build up to the complex implementation you saw earlier.

---

## 1. What is a Class? (The Blueprint Concept)

Think of a class as a **blueprint** for creating objects. Just like a house blueprint defines what every house built from it will have (rooms, doors, windows), a class defines what every object created from it will have (data and functions).

### Simple Example: A Student Class

```python
class Student:
    def __init__(self, name, age):
        self.name = name  # Instance variable
        self.age = age    # Instance variable
    
    def introduce(self):  # Instance method
        return f"Hi, I'm {self.name} and I'm {self.age} years old"

# Creating objects (instances) from the class
student1 = Student("Alice", 20)
student2 = Student("Bob", 22)

print(student1.introduce())  # "Hi, I'm Alice and I'm 20 years old"
print(student2.introduce())  # "Hi, I'm Bob and I'm 22 years old"
```

**Key Terms:**
- **Class**: The blueprint (`Student`)
- **Instance/Object**: The actual thing created from the blueprint (`student1`, `student2`)
- **Instance Variables**: Data that belongs to each object (`self.name`, `self.age`)
- **Instance Methods**: Functions that belong to the class (`introduce`)

---

## 2. The Magic `__init__` Method (Constructor)

The `__init__` method is special - it's called automatically when you create a new object. Think of it as the "setup" function.

```python
class BankAccount:
    def __init__(self, owner, initial_balance=0):
        # This runs automatically when you create a BankAccount
        self.owner = owner
        self.balance = initial_balance
        print(f"Account created for {owner} with ${initial_balance}")
    
    def deposit(self, amount):
        self.balance += amount
        return f"Deposited ${amount}. New balance: ${self.balance}"

# When you do this, __init__ runs automatically
account = BankAccount("John", 1000)  # Prints: "Account created for John with $1000"
```

**Important**: 
- `self` refers to the specific instance being created
- `self.variable_name` creates instance variables
- `__init__` is called the "constructor"

---

## 3. Instance Variables vs Class Variables

```python
class Car:
    # Class variable - shared by ALL cars
    total_cars_made = 0
    
    def __init__(self, make, model):
        # Instance variables - unique to each car
        self.make = make
        self.model = model
        
        # Increment the class variable
        Car.total_cars_made += 1
    
    def description(self):
        return f"{self.make} {self.model}"

car1 = Car("Toyota", "Camry")
car2 = Car("Honda", "Civic")

print(Car.total_cars_made)  # 2 (shared by all)
print(car1.make)            # "Toyota" (unique to car1)
print(car2.make)            # "Honda" (unique to car2)
```

---

## 4. Now Let's Look at Our Real Example: EvaluationState

Here's a simplified version of our `EvaluationState` class:

```python
from uuid import UUID
from typing import List, Dict, Any
import time

class EvaluationState:
    def __init__(self, evaluation_id: UUID, window_size: int = 10):
        # Instance variables - each evaluation has its own
        self.evaluation_id = evaluation_id
        self.window_size = window_size
        self.cleaned_history = []  # Empty list to start
        self.created_at = time.time()
        
        print(f"Created evaluation state for {evaluation_id}")
    
    def add_turn(self, speaker: str, text: str):
        """Add a conversation turn to our history"""
        turn_data = {
            'speaker': speaker,
            'text': text,
            'timestamp': time.time()
        }
        self.cleaned_history.append(turn_data)
        print(f"Added turn from {speaker}: {text[:50]}...")
    
    def get_recent_history(self):
        """Get the last N turns (sliding window)"""
        return self.cleaned_history[-self.window_size:]
    
    def get_turn_count(self):
        """How many turns do we have?"""
        return len(self.cleaned_history)

# Usage example
from uuid import uuid4

# Create an evaluation state
eval_state = EvaluationState(uuid4(), window_size=3)

# Add some conversation turns
eval_state.add_turn("User", "Hello, I need help with my order")
eval_state.add_turn("Agent", "I'd be happy to help! What's your order number?")
eval_state.add_turn("User", "It's #12345")
eval_state.add_turn("Agent", "Let me look that up for you")

print(f"Total turns: {eval_state.get_turn_count()}")  # 4
print(f"Recent turns: {len(eval_state.get_recent_history())}")  # 3 (window size)
```

**What's happening here?**
- Each `EvaluationState` object has its own conversation history
- The `window_size` controls how much recent history to remember
- Methods like `add_turn()` modify the object's state
- Methods like `get_recent_history()` return data without changing anything

---

## 5. The Full EvaluationManager Class

Now let's understand the real `EvaluationManager` class. It's like a **manager** that keeps track of multiple `EvaluationState` objects:

```python
class EvaluationManager:
    def __init__(self):
        # Dictionary to store multiple evaluation states
        self.active_evaluations = {}  # UUID -> EvaluationState
        self.stopped_evaluations = {}  # UUID -> bool
        
        print("EvaluationManager created and ready!")
    
    def create_evaluation(self, conversation_id: UUID, name: str):
        """Create a new evaluation and store it"""
        evaluation_id = uuid4()
        
        # Create a new EvaluationState object
        eval_state = EvaluationState(evaluation_id)
        
        # Store it in our dictionary
        self.active_evaluations[evaluation_id] = eval_state
        
        print(f"Created evaluation '{name}' with ID {evaluation_id}")
        return evaluation_id
    
    def get_evaluation(self, evaluation_id: UUID):
        """Get an existing evaluation"""
        if evaluation_id in self.active_evaluations:
            return self.active_evaluations[evaluation_id]
        else:
            raise ValueError(f"Evaluation {evaluation_id} not found!")
    
    def stop_evaluation(self, evaluation_id: UUID):
        """Mark an evaluation as stopped"""
        self.stopped_evaluations[evaluation_id] = True
        print(f"Evaluation {evaluation_id} has been stopped")
    
    def is_evaluation_stopped(self, evaluation_id: UUID):
        """Check if an evaluation is stopped"""
        return self.stopped_evaluations.get(evaluation_id, False)

# Usage example
manager = EvaluationManager()

# Create two different evaluations
eval1_id = manager.create_evaluation(uuid4(), "Gentle Cleaning")
eval2_id = manager.create_evaluation(uuid4(), "Aggressive Cleaning")

# Get the evaluation objects
eval1 = manager.get_evaluation(eval1_id)
eval2 = manager.get_evaluation(eval2_id)

# Add different data to each
eval1.add_turn("User", "Hello there")
eval2.add_turn("User", "Yo what's up dude")

# They have separate histories!
print(f"Eval1 turns: {eval1.get_turn_count()}")  # 1
print(f"Eval2 turns: {eval2.get_turn_count()}")  # 1
```

---

## 6. Why Use Classes? The Benefits

### **Before Classes (procedural approach):**
```python
# Global variables - messy and hard to manage
evaluation_histories = {}
evaluation_settings = {}
stopped_evaluations = {}

def create_evaluation(eval_id, settings):
    evaluation_histories[eval_id] = []
    evaluation_settings[eval_id] = settings
    # Lots of separate functions managing separate data structures

def add_turn_to_evaluation(eval_id, speaker, text):
    if eval_id in evaluation_histories:
        evaluation_histories[eval_id].append({'speaker': speaker, 'text': text})
    # Error-prone and hard to maintain
```

### **With Classes (object-oriented approach):**
```python
# Clean, organized, and intuitive
class EvaluationState:
    def __init__(self, eval_id, settings):
        self.id = eval_id
        self.history = []
        self.settings = settings
    
    def add_turn(self, speaker, text):
        self.history.append({'speaker': speaker, 'text': text})
    
# Much cleaner to use
eval = EvaluationState(uuid4(), {'window_size': 10})
eval.add_turn("User", "Hello")
```

**Benefits:**
1. **Organization**: Related data and functions are grouped together
2. **Encapsulation**: Each object manages its own data
3. **Reusability**: Create multiple instances easily
4. **Maintainability**: Changes to the class affect all instances

---

## 7. Advanced Concepts in Our EvaluationManager

### **Type Hints** (the `: Dict[UUID, EvaluationState]` stuff)
```python
from typing import Dict, List, Optional
from uuid import UUID

class EvaluationManager:
    def __init__(self):
        # Type hints tell us what kind of data to expect
        self.active_evaluations: Dict[UUID, EvaluationState] = {}
        self.performance_metrics: Dict[str, List[float]] = {}
    
    def get_evaluation(self, evaluation_id: UUID) -> Optional[EvaluationState]:
        # Returns either an EvaluationState or None
        return self.active_evaluations.get(evaluation_id)
```

### **Complex Data Structures**
```python
# Our real class uses nested dictionaries and lists
self.performance_metrics = {
    'lumen_processing_times': [],        # List of numbers
    'user_processing_times': [],         # List of numbers  
    'total_turns_processed': 0,          # Single number
    'average_context_size': []           # List of numbers
}
```

### **Method Naming Conventions**
```python
class EvaluationState:
    def get_cleaned_sliding_window(self):    # Public method
        return self._get_window_data()       # Calls private method
    
    def _get_window_data(self):              # Private method (starts with _)
        # Internal implementation details
        pass
```

---

## 8. Practice Exercises

### **Exercise 1: Simple Class**
Create a `ConversationTurn` class that:
- Takes `speaker`, `text`, and `timestamp` in `__init__`
- Has a method `get_summary()` that returns the first 50 characters
- Has a method `is_from_user()` that returns True if speaker is "User"

```python
# Your solution here
class ConversationTurn:
    def __init__(self, speaker, text, timestamp):
        # Fill this in
        pass
    
    def get_summary(self):
        # Fill this in
        pass
    
    def is_from_user(self):
        # Fill this in
        pass
```

### **Exercise 2: Manager Class**
Create a `ConversationManager` class that:
- Stores a list of `ConversationTurn` objects
- Has an `add_turn()` method
- Has a `get_user_turns()` method that returns only user turns
- Has a `get_turn_count()` method

---

## 9. Key Takeaways

1. **Classes are blueprints** for creating objects
2. **`__init__`** is the constructor that sets up new objects
3. **`self`** refers to the specific instance
4. **Instance variables** (`self.variable`) belong to individual objects
5. **Methods** are functions that belong to the class
6. **Classes help organize code** by grouping related data and functions

### **In Our EvaluationManager:**
- `EvaluationState` class = blueprint for managing one conversation's cleaning process
- `EvaluationManager` class = blueprint for managing multiple evaluation states
- Each evaluation gets its own memory space and history
- Methods provide clean interfaces for interacting with the data

---

## 10. Next Steps

1. **Practice**: Try the exercises above
2. **Read the real code**: Look at `/backend/app/services/evaluation_manager.py` with fresh eyes
3. **Experiment**: Create your own simple classes
4. **Learn about inheritance**: How classes can extend other classes
5. **Explore composition**: How classes can contain other classes (like our manager containing multiple states)

Remember: Classes are just a way to organize your code and data. Start simple, and complexity will make sense as you need it!

---

## 📚 Quick Reference

```python
# Class definition
class ClassName:
    def __init__(self, parameter):          # Constructor
        self.instance_var = parameter       # Instance variable
    
    def method_name(self):                  # Instance method
        return self.instance_var
    
    def _private_method(self):              # Private method (convention)
        pass

# Creating and using objects
obj = ClassName("value")                    # Create instance
result = obj.method_name()                  # Call method
print(obj.instance_var)                     # Access instance variable
```

Good luck with your Python class journey! 🐍✨