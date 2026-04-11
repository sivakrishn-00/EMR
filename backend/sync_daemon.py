import time
import signal
import sys
from sync_core import SyncCore, logger

class SyncDaemon:
    def __init__(self):
        self.core = SyncCore()
        self.running = True
        
        # Handle termination signals
        signal.signal(signal.SIGINT, self.stop)
        signal.signal(signal.SIGTERM, self.stop)

    def stop(self, signum, frame):
        logger.info("Termination signal received. Shutting down...")
        self.running = False

    def run(self):
        interval = self.core.config.get("interval", 30)
        logger.info(f"EMR Sync Service Started. Interval: {interval}s")
        
        while self.running:
            try:
                # Reload config every loop in case it changes
                self.core.config = self.core.load_config()
                interval = self.core.config.get("interval", 30)
                
                self.core.run_sync_logic()
            except Exception as e:
                logger.error(f"Unexpected error in loop: {e}")
            
            # Sleep in small increments to respond to signals faster
            for _ in range(interval):
                if not self.running:
                    break
                time.sleep(1)

if __name__ == "__main__":
    daemon = SyncDaemon()
    daemon.run()
