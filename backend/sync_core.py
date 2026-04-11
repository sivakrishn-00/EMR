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
        try:
            logger.info(f"Scanning Local DB: {self.config.get('db_name')}...")
            
            conn = mysql.connector.connect(
                host=self.config["db_host"], port=self.config["db_port"],
                user=self.config["db_user"], password=self.config["db_pass"], 
                database=self.config["db_name"], connect_timeout=5
            )
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM cbc_results LIMIT 1000") 
            rows = cursor.fetchall()
            conn.close()

            if not rows:
                logger.info("Delta Scan: No new records found.")
                return 0

            logger.info(f"Data Compression: Prepared {len(rows)} records for transmission.")

            def json_serial(obj):
                from datetime import datetime, date
                if isinstance(obj, (datetime, date)): return obj.isoformat()
                return str(obj)

            headers = {
                "X-Machine-Sync-Key": self.config["sync_key"], 
                "Content-Type": "application/json"
            }
            
            start_t = time.time()
            response = requests.post(
                self.config["emr_endpoint"], 
                data=json.dumps({"results": rows}, default=json_serial), 
                headers=headers, timeout=15
            )
            latency = round((time.time() - start_t) * 1000, 2)

            if response.status_code in [200, 201, 202]:
                count = len(rows)
                self.total_synced_count += count
                logger.info(f"[SUCCESS] SYNCHRONIZED: {count} records in {latency}ms. Total: {self.total_synced_count}")
                return count
            else:
                logger.error(f"[BRIDGE ERROR] HTTP {response.status_code} - {response.text[:100]}")
                return -1

        except mysql.connector.Error as err:
            logger.error(f"[DB ERROR] CONNECTIVITY FAILURE: {err}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"[NETWORK WARN] EMR Endpoint Unreachable.")
        except Exception as e:
            logger.error(f"[SYSTEM FAULT] {str(e)}")
        return -1

if __name__ == "__main__":
    # Test run
    core = SyncCore()
    core.run_sync_logic()
