import mysql.connector
import requests
import json
import time
import os
import logging
from datetime import datetime

CONFIG_FILE = "sync_agent_config.json"

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("sync_agent.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("SyncCore")

class SyncCore:
    def __init__(self):
        self.config = self.load_config()
        self.total_synced_count = 0

    def load_config(self):
        default = {
            "db_host": "10.2.1.159", "db_port": 3306, "db_name": "bc_cbc_db", "db_user": "root",
            "db_pass": "root_123", "emr_endpoint": "http://localhost:8000/api/laboratory/requests/sync_batch/",
            "sync_key": "emr_lab_sync_bridge_secure_9HqR2S9vXz4P5mN8", "interval": 30
        }
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f: 
                    return {**default, **json.load(f)}
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        return default

    def run_sync_logic(self):
        """
        No-Burden Delta Sync: 
        Only fetches records with ID higher than our last success.
        Processes in chunks of 5000 to keep memory usage low.
        """
        try:
            # 1. Get the last record we successfully synced
            last_id = self.config.get("last_synced_id", 0)
            batch_limit = 5000
            
            logger.info(f"Scanning for NEW records (Starting after ID: {last_id})...")
            
            conn = mysql.connector.connect(
                host=self.config["db_host"], port=self.config["db_port"],
                user=self.config["db_user"], password=self.config["db_pass"], 
                database=self.config["db_name"], connect_timeout=5
            )
            
            total_session_synced = 0
            while True:
                cursor = conn.cursor(dictionary=True)
                # The 'WHERE id > %s' is what prevents the 'burden'
                query = "SELECT * FROM cbc_results WHERE id > %s ORDER BY id ASC LIMIT %s"
                cursor.execute(query, (last_id, batch_limit))
                rows = cursor.fetchall()
                cursor.close()

                if not rows:
                    if total_session_synced == 0:
                        logger.info("Delta Scan: System is already up-to-date.")
                    else:
                        logger.info(f"Sync Complete. Total new records sent: {total_session_synced}")
                    break

                logger.info(f"Compressing {len(rows)} NEW records...")

                def json_serial(obj):
                    from datetime import datetime, date
                    if isinstance(obj, (datetime, date)): return obj.isoformat()
                    return str(obj)

                headers = {
                    "X-Machine-Sync-Key": self.config["sync_key"], 
                    "Content-Type": "application/json"
                }
                
                response = requests.post(
                    self.config["emr_endpoint"], 
                    data=json.dumps({"results": rows}, default=json_serial), 
                    headers=headers, timeout=30
                )

                if response.status_code in [200, 201, 202]:
                    # Batch was successful! Move the pointer forward
                    last_id = rows[-1]['id']
                    total_session_synced += len(rows)
                    self.total_synced_count += len(rows)
                    
                    # Remember this point so we never send these records again
                    self.update_watermark(last_id)
                    logger.info(f"[SUCCESS] Watermark moved to ID {last_id}")
                    
                    if len(rows) < batch_limit: break # End of backlog
                else:
                    logger.error(f"[HALTED] Cloud Bridge is busy. Will retry later.")
                    break

            conn.close()
            return total_session_synced

        except Exception as e:
            logger.error(f"[SYSTEM FAULT] {str(e)}")
        return -1

    def update_watermark(self, last_id):
        """Remembers the last ID so we don't send duplicates next time."""
        try:
            self.config["last_synced_id"] = last_id
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=4)
        except: pass

if __name__ == "__main__":
    # Test run
    core = SyncCore()
    core.run_sync_logic()
