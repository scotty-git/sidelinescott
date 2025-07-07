"""
Message Queue Manager for Week 3 Real-time Processing

Provides FIFO queue processing for turn cleaning jobs with performance monitoring
and reliability features.
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import UUID
import uuid
import logging

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from pydantic import BaseModel

logger = logging.getLogger(__name__)

class CleaningJob(BaseModel):
    """Cleaning job for the message queue"""
    job_id: str
    conversation_id: str
    turn_id: str
    speaker: str
    raw_text: str
    priority: int = 1  # 1=high (user), 2=low (lumen)
    created_at: datetime
    retry_count: int = 0
    max_retries: int = 3

class QueueMetrics(BaseModel):
    """Queue performance metrics"""
    total_jobs: int = 0
    processed_jobs: int = 0
    failed_jobs: int = 0
    avg_processing_time: float = 0.0
    max_processing_time: float = 0.0
    queue_length: int = 0
    worker_count: int = 0
    last_processed: Optional[datetime] = None

class InMemoryQueue:
    """In-memory fallback queue when Redis is not available"""
    
    def __init__(self):
        self.queue: List[CleaningJob] = []
        self.processing: Dict[str, CleaningJob] = {}
        self.lock = asyncio.Lock()
        logger.info("InMemoryQueue initialized as Redis fallback")
    
    async def enqueue(self, job: CleaningJob) -> None:
        async with self.lock:
            # Insert by priority (high priority first)
            inserted = False
            for i, existing_job in enumerate(self.queue):
                if job.priority < existing_job.priority:
                    self.queue.insert(i, job)
                    inserted = True
                    break
            
            if not inserted:
                self.queue.append(job)
    
    async def dequeue(self, timeout: float = 1.0) -> Optional[CleaningJob]:
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            async with self.lock:
                if self.queue:
                    job = self.queue.pop(0)
                    self.processing[job.job_id] = job
                    return job
            
            await asyncio.sleep(0.01)  # Small delay to prevent busy waiting
        
        return None
    
    async def ack(self, job_id: str) -> None:
        async with self.lock:
            self.processing.pop(job_id, None)
    
    async def nack(self, job_id: str) -> None:
        async with self.lock:
            job = self.processing.pop(job_id, None)
            if job and job.retry_count < job.max_retries:
                job.retry_count += 1
                await self.enqueue(job)
    
    async def get_length(self) -> int:
        async with self.lock:
            return len(self.queue)

class MessageQueueManager:
    """
    Week 3 Real-time Message Queue Manager
    
    Provides reliable FIFO processing for cleaning jobs with:
    - Priority handling (Lumen turns bypass, User turns full processing)
    - Performance monitoring and metrics
    - Error handling and retry logic
    - Graceful fallback to in-memory queue
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or "redis://localhost:6379"
        self.redis_client: Optional[redis.Redis] = None
        self.fallback_queue = InMemoryQueue()
        self.use_redis = False
        
        self.queue_name = "cleaning_jobs"
        self.processing_queue = "processing_jobs"
        
        # Metrics tracking
        self.metrics = QueueMetrics()
        self.processing_times: List[float] = []
        
        # Worker management
        self.workers: List[asyncio.Task] = []
        self.worker_count = 2  # Start with 2 workers
        self.is_running = False
        
        logger.info(f"MessageQueueManager initialized with Redis URL: {self.redis_url}")
    
    async def initialize(self) -> None:
        """Initialize Redis connection or fallback to in-memory queue"""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, using in-memory fallback queue")
            return
        
        try:
            self.redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            await self.redis_client.ping()
            self.use_redis = True
            logger.info("✅ Redis connection established")
            
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory fallback: {e}")
            self.redis_client = None
            self.use_redis = False
    
    async def enqueue_cleaning_job(
        self, 
        conversation_id: str,
        turn_id: str,
        speaker: str,
        raw_text: str
    ) -> CleaningJob:
        """
        Add cleaning job to queue with appropriate priority
        
        Target: <50ms enqueue time
        """
        start_time = time.time()
        
        # Create job with priority based on speaker
        priority = 2 if speaker.lower() in ['lumen', 'ai'] else 1  # Lumen = low priority
        
        job = CleaningJob(
            job_id=f"{conversation_id}_{turn_id}_{int(time.time() * 1000)}",
            conversation_id=conversation_id,
            turn_id=turn_id,
            speaker=speaker,
            raw_text=raw_text,
            priority=priority,
            created_at=datetime.utcnow()
        )
        
        try:
            if self.use_redis and self.redis_client:
                # Use Redis sorted set for priority queue
                score = priority + (time.time() / 1000000)  # Priority + timestamp for FIFO within priority
                await self.redis_client.zadd(self.queue_name, {job.json(): score})
            else:
                # Use in-memory fallback
                await self.fallback_queue.enqueue(job)
            
            self.metrics.total_jobs += 1
            enqueue_time = (time.time() - start_time) * 1000
            
            logger.info(f"[MessageQueue] Enqueued job {job.job_id} in {enqueue_time:.2f}ms")
            logger.info(f"   Speaker: {speaker} | Priority: {priority} | Text: {raw_text[:50]}...")
            
            # Performance warning
            if enqueue_time > 50:
                logger.warning(f"⚠️ Enqueue time exceeded target: {enqueue_time:.2f}ms > 50ms")
            
            return job
            
        except Exception as e:
            logger.error(f"Failed to enqueue job: {e}")
            raise
    
    async def start_workers(self, conversation_manager) -> None:
        """Start worker tasks for processing queue"""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info(f"Starting {self.worker_count} queue workers")
        
        for i in range(self.worker_count):
            worker = asyncio.create_task(
                self._worker_loop(f"worker-{i}", conversation_manager)
            )
            self.workers.append(worker)
    
    async def stop_workers(self) -> None:
        """Stop all worker tasks"""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping queue workers")
        
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
    
    async def _worker_loop(self, worker_name: str, conversation_manager) -> None:
        """Worker loop for processing cleaning jobs"""
        logger.info(f"[{worker_name}] Worker started")
        
        while self.is_running:
            try:
                # Get next job from queue
                job = await self._dequeue_job()
                
                if job:
                    await self._process_job(worker_name, job, conversation_manager)
                else:
                    # No jobs available, short sleep
                    await asyncio.sleep(0.1)
                    
            except asyncio.CancelledError:
                logger.info(f"[{worker_name}] Worker cancelled")
                break
            except Exception as e:
                logger.error(f"[{worker_name}] Worker error: {e}")
                await asyncio.sleep(1)  # Backoff on error
    
    async def _dequeue_job(self) -> Optional[CleaningJob]:
        """Dequeue next job from priority queue"""
        try:
            if self.use_redis and self.redis_client:
                # Get highest priority job (lowest score)
                result = await self.redis_client.bzpopmin(self.queue_name, timeout=1)
                
                if result:
                    queue_name, job_data, score = result
                    job = CleaningJob.parse_raw(job_data)
                    
                    # Move to processing queue
                    await self.redis_client.hset(
                        self.processing_queue, 
                        job.job_id, 
                        job.json()
                    )
                    
                    return job
            else:
                # Use in-memory fallback
                return await self.fallback_queue.dequeue(timeout=1.0)
                
        except Exception as e:
            logger.error(f"Error dequeuing job: {e}")
        
        return None
    
    async def _process_job(
        self, 
        worker_name: str, 
        job: CleaningJob, 
        conversation_manager
    ) -> None:
        """Process a cleaning job with performance tracking"""
        start_time = time.time()
        
        logger.info(f"[{worker_name}] Processing job {job.job_id}")
        logger.info(f"   Speaker: {job.speaker} | Priority: {job.priority}")
        
        try:
            # Import here to avoid circular import
            from sqlalchemy.orm import Session
            from ..core.database import get_db
            
            # Get database session - handle generator properly
            db_gen = get_db()
            db = next(db_gen)
            
            try:
                # Process turn using existing ConversationManager
                result = await conversation_manager.add_turn(
                    conversation_id=UUID(job.conversation_id),
                    speaker=job.speaker,
                    raw_text=job.raw_text,
                    db=db
                )
                
                processing_time = (time.time() - start_time) * 1000
                
                # Update metrics
                self.metrics.processed_jobs += 1
                self.metrics.last_processed = datetime.utcnow()
                self.processing_times.append(processing_time)
                
                # Keep only last 100 measurements
                if len(self.processing_times) > 100:
                    self.processing_times.pop(0)
                
                self.metrics.avg_processing_time = sum(self.processing_times) / len(self.processing_times)
                self.metrics.max_processing_time = max(
                    self.metrics.max_processing_time, 
                    processing_time
                )
                
                logger.info(f"[{worker_name}] ✅ Job completed in {processing_time:.2f}ms")
                logger.info(f"   Result: {result.metadata.cleaning_level} cleaning, {result.metadata.confidence_score} confidence")
                
                # Acknowledge job completion
                await self._ack_job(job.job_id)
                
                # Performance targets
                expected_time = 10 if job.speaker.lower() in ['lumen', 'ai'] else 500
                if processing_time > expected_time:
                    logger.warning(
                        f"⚠️ Processing time exceeded target: {processing_time:.2f}ms > {expected_time}ms"
                    )
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"[{worker_name}] ❌ Job failed: {e}")
            self.metrics.failed_jobs += 1
            
            # Handle retry or failure
            await self._nack_job(job.job_id, job)
    
    async def _ack_job(self, job_id: str) -> None:
        """Acknowledge successful job completion"""
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.hdel(self.processing_queue, job_id)
            else:
                await self.fallback_queue.ack(job_id)
        except Exception as e:
            logger.error(f"Error acknowledging job {job_id}: {e}")
    
    async def _nack_job(self, job_id: str, job: CleaningJob) -> None:
        """Handle job failure with retry logic"""
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.hdel(self.processing_queue, job_id)
                
                # Retry if under limit
                if job.retry_count < job.max_retries:
                    job.retry_count += 1
                    score = job.priority + (time.time() / 1000000)
                    await self.redis_client.zadd(self.queue_name, {job.json(): score})
                    logger.info(f"Retrying job {job_id} (attempt {job.retry_count})")
                else:
                    logger.error(f"Job {job_id} exceeded max retries, dropping")
            else:
                await self.fallback_queue.nack(job_id)
                
        except Exception as e:
            logger.error(f"Error handling job failure {job_id}: {e}")
    
    async def get_queue_length(self) -> int:
        """Get current queue length"""
        try:
            if self.use_redis and self.redis_client:
                return await self.redis_client.zcard(self.queue_name)
            else:
                return await self.fallback_queue.get_length()
        except Exception:
            return 0
    
    async def get_metrics(self) -> QueueMetrics:
        """Get current queue metrics"""
        self.metrics.queue_length = await self.get_queue_length()
        self.metrics.worker_count = len(self.workers)
        return self.metrics
    
    async def reset_metrics(self) -> None:
        """Reset queue metrics (useful for testing)"""
        self.metrics = QueueMetrics()
        self.processing_times = []
        logger.info("Queue metrics reset")
    
    async def cleanup(self) -> None:
        """Clean up resources"""
        await self.stop_workers()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("MessageQueueManager cleanup completed")

# Singleton instance for app-wide use
message_queue_manager = MessageQueueManager()