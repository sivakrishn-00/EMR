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
            # 1. Get the last records we successfully synced
            last_id = self.config.get("last_synced_id", 0)
            last_bc_id = self.config.get("last_synced_bc_id", 0)
            batch_limit = 5000
            
            logger.info(f"Scanning for NEW records (CBC after ID: {last_id}, BC after ID: {last_bc_id})...")
            
            conn = mysql.connector.connect(
                host=self.config["db_host"], port=self.config["db_port"],
                user=self.config["db_user"], password=self.config["db_pass"], 
                database=self.config["db_name"], connect_timeout=5
            )
            
            def json_serial(obj):
                from datetime import datetime, date
                if isinstance(obj, (datetime, date)): return obj.isoformat()
                return str(obj)

            headers = {
                "X-Machine-Sync-Key": self.config["sync_key"], 
                "Content-Type": "application/json"
            }

            cbc_synced = 0
            bc_synced = 0

            # --- SYNC CBC ---
            cursor = conn.cursor(dictionary=True)
            query = "SELECT * FROM cbc_results WHERE id > %s ORDER BY id ASC LIMIT %s"
            cursor.execute(query, (last_id, batch_limit))
            cbc_rows = cursor.fetchall()
            cursor.close()

            if cbc_rows:
                logger.info(f"Compressing {len(cbc_rows)} NEW CBC records...")
                response = requests.post(
                    self.config["emr_endpoint"], 
                    data=json.dumps({"results": cbc_rows}, default=json_serial), 
                    headers=headers, timeout=30
                )
                if response.status_code in [200, 201, 202]:
                    last_id = cbc_rows[-1]['id']
                    cbc_synced = len(cbc_rows)
                    self.update_watermark(last_id, "last_synced_id")
                    logger.info(f"[SUCCESS] CBC Watermark moved to ID {last_id}")
                else:
                    logger.error(f"[HALTED] CBC Cloud Bridge error: HTTP {response.status_code}")

            # --- SYNC BIOCHEMISTRY ---
            cursor = conn.cursor(dictionary=True)
            query = "SELECT * FROM bc_results WHERE id > %s ORDER BY id ASC LIMIT %s"
            cursor.execute(query, (last_bc_id, batch_limit))
            bc_rows = cursor.fetchall()
            cursor.close()

            if bc_rows:
                logger.info(f"Compressing {len(bc_rows)} NEW Biochemistry records...")
                response = requests.post(
                    self.config["emr_endpoint"], 
                    data=json.dumps({"results": bc_rows}, default=json_serial), 
                    headers=headers, timeout=30
                )
                if response.status_code in [200, 201, 202]:
                    last_bc_id = bc_rows[-1]['id']
                    bc_synced = len(bc_rows)
                    self.update_watermark(last_bc_id, "last_synced_bc_id")
                    logger.info(f"[SUCCESS] Biochemistry Watermark moved to ID {last_bc_id}")
                else:
                    logger.error(f"[HALTED] Biochemistry Cloud Bridge error: HTTP {response.status_code}")

            conn.close()
            total_session_synced = cbc_synced + bc_synced
            self.total_synced_count += total_session_synced
            return total_session_synced

        except Exception as e:
            logger.error(f"[SYSTEM FAULT] {str(e)}")
        return -1

    def update_watermark(self, last_id, key="last_synced_id"):
        """Remembers the last ID so we don't send duplicates next time."""
        try:
            self.config[key] = last_id
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=4)
        except: pass

if __name__ == "__main__":
    # Test run
    core = SyncCore()
    core.run_sync_logic()
