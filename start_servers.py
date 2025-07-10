#!/usr/bin/env python3
"""
Start both frontend and backend servers for the Lumen Transcript Cleaner.

This script starts:
1. Backend FastAPI server (Python) on http://127.0.0.1:8000
2. Frontend React dev server (npm) on http://127.0.0.1:6173

Usage:
    python start_servers.py
    
To stop: Press Ctrl+C


Legacy path (Good for debugging):
cd backend && source venv/bin/activate && uvicorn app.main:app --reload
cd frontend && npm run dev
"""


import subprocess
import sys
import os
import time
import signal
from pathlib import Path

class ServerManager:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.project_root = Path(__file__).parent
        
    def check_prerequisites(self):
        """Check if required directories and files exist."""
        backend_dir = self.project_root / "backend"
        frontend_dir = self.project_root / "frontend"
        venv_dir = backend_dir / "venv"
        
        if not backend_dir.exists():
            print("❌ Backend directory not found!")
            return False
            
        if not frontend_dir.exists():
            print("❌ Frontend directory not found!")
            return False
            
        if not venv_dir.exists():
            print("❌ Python virtual environment not found in backend/venv!")
            print("   Run: cd backend && python -m venv venv")
            return False
            
        if not (frontend_dir / "package.json").exists():
            print("❌ Frontend package.json not found!")
            return False
            
        return True
    
    def start_backend(self):
        """Start the FastAPI backend server."""
        print("🐍 Starting backend server...")
        
        backend_dir = self.project_root / "backend"
        venv_python = backend_dir / "venv" / "bin" / "python"
        
        # Check if we're on Windows
        if os.name == 'nt':
            venv_python = backend_dir / "venv" / "Scripts" / "python.exe"
        
        try:
            self.backend_process = subprocess.Popen(
                [str(venv_python), "main.py"],
                cwd=str(backend_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            print("✅ Backend server starting...")
            return True
        except Exception as e:
            print(f"❌ Failed to start backend: {e}")
            return False
    
    def start_frontend(self):
        """Start the React frontend dev server."""
        print("⚛️  Starting frontend server...")
        
        frontend_dir = self.project_root / "frontend"
        
        try:
            self.frontend_process = subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=str(frontend_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            print("✅ Frontend server starting...")
            return True
        except Exception as e:
            print(f"❌ Failed to start frontend: {e}")
            return False
    
    def wait_for_servers(self):
        """Wait for servers to start and show their output."""
        print("\n🚀 Servers starting up...")
        print("📝 Server logs:")
        print("-" * 50)
        
        try:
            # Show initial output from both servers
            for _ in range(10):  # Show first 10 lines of output
                if self.backend_process and self.backend_process.poll() is None:
                    try:
                        line = self.backend_process.stdout.readline()
                        if line:
                            print(f"[BACKEND] {line.strip()}")
                    except:
                        pass
                
                if self.frontend_process and self.frontend_process.poll() is None:
                    try:
                        line = self.frontend_process.stdout.readline()
                        if line:
                            print(f"[FRONTEND] {line.strip()}")
                    except:
                        pass
                
                time.sleep(0.5)
            
            print("-" * 50)
            print("🌐 Server URLs:")
            print("   Backend:  http://127.0.0.1:8000")
            print("   Frontend: http://127.0.0.1:6173")
            print("   API Docs: http://127.0.0.1:8000/docs")
            print("\n💡 Press Ctrl+C to stop both servers")
            
            # Keep running until interrupted
            while True:
                # Check if processes are still running
                if self.backend_process and self.backend_process.poll() is not None:
                    print("❌ Backend process stopped unexpectedly")
                    break
                if self.frontend_process and self.frontend_process.poll() is not None:
                    print("❌ Frontend process stopped unexpectedly")
                    break
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping servers...")
            self.stop_servers()
    
    def stop_servers(self):
        """Stop both servers gracefully."""
        if self.backend_process:
            print("🐍 Stopping backend server...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
        
        if self.frontend_process:
            print("⚛️  Stopping frontend server...")
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.frontend_process.kill()
        
        print("✅ All servers stopped")
    
    def run(self):
        """Main method to start and manage servers."""
        print("🚀 Lumen Transcript Cleaner - Server Startup")
        print("=" * 50)
        
        if not self.check_prerequisites():
            sys.exit(1)
        
        # Start backend
        if not self.start_backend():
            sys.exit(1)
        
        # Wait a moment for backend to start
        time.sleep(2)
        
        # Start frontend
        if not self.start_frontend():
            self.stop_servers()
            sys.exit(1)
        
        # Wait and monitor
        self.wait_for_servers()

def main():
    """Entry point."""
    server_manager = ServerManager()
    
    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print("\n🛑 Received interrupt signal...")
        server_manager.stop_servers()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        server_manager.run()
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        server_manager.stop_servers()
        sys.exit(1)

if __name__ == "__main__":
    main()
