// Test script to verify template selector integration
console.log('Testing template selector integration...');

// Test 1: Check if frontend is accessible
fetch('http://127.0.0.1:6174/')
  .then(response => {
    console.log('✅ Frontend accessible:', response.status);
    return response.text();
  })
  .then(html => {
    if (html.includes('Lumen Transcript Cleaner')) {
      console.log('✅ Frontend loads correctly');
    } else {
      console.log('❌ Frontend content issue');
    }
  })
  .catch(err => console.log('❌ Frontend error:', err.message));

// Test 2: Check if backend API works
fetch('http://127.0.0.1:8000/api/v1/prompt-engineering/templates')
  .then(response => response.json())
  .then(templates => {
    console.log('✅ Backend API works, templates found:', templates.length);
    console.log('Templates:', templates.map(t => t.name));
  })
  .catch(err => console.log('❌ Backend API error:', err.message));