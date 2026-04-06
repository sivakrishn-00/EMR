import socket

def check_redis():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect(("127.0.0.1", 6379))
        print("Connected to 127.0.0.1:6379")
        s.close()
    except Exception as e:
        print(f"Failed to connect to 127.0.0.1:6379: {e}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("localhost", 6379))
        print("Connected to localhost:6379")
        s.close()
    except Exception as e:
        print(f"Failed to connect to localhost:6379: {e}")

if __name__ == "__main__":
    check_redis()
