import redis
import json
import time

def view_latest_dump():
    try:
        r = redis.Redis(host='localhost', port=6379, db=1)
        print("--- EMR Lab Sync Monitor ---")
        print("Checking for latest sync data in Redis...")
        
        while True:
            data = r.get("EMR_LATEST_SYNC_DUMP")
            if data:
                parsed = json.loads(data)
                print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] NEW DATA DETECTED:")
                print(json.dumps(parsed, indent=4))
                print("\n" + "="*50)
                # Clear after showing once if you want, or just wait for update
                # r.delete("EMR_LATEST_SYNC_DUMP")
            else:
                print(".", end="", flush=True)
            
            time.sleep(2)
    except Exception as e:
        print(f"\nError: {e}")
        print("Make sure Redis is running (docker run -p 6379:6379 -d redis)")

if __name__ == "__main__":
    view_latest_dump()
