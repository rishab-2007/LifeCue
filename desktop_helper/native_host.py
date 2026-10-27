import json
import struct
import sys


def read_message():
    # Read the message length (4 bytes)
    raw_length = sys.stdin.buffer.read(4)

    if not raw_length:
        return None

    if len(raw_length) != 4:
        return None

    message_length = struct.unpack("<I", raw_length)[0]

    # Read the actual JSON message
    message = sys.stdin.buffer.read(message_length)

    if len(message) != message_length:
        return None

    return json.loads(message.decode("utf-8"))


def send_message(message):
    # Convert the response into JSON bytes
    encoded = json.dumps(message).encode("utf-8")

    # Send the length followed by the message
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def main():
    while True:
        try:
            message = read_message()

            if message is None:
                break

            action = message.get("action")

            if action == "PING":
                send_message({
                    "ok": True,
                    "message": "LifeCue Native Host is connected"
                })

            elif action == "START_SESSION":
                duration = message.get("durationMinutes")
                domains = message.get("domains", [])

                send_message({
                    "ok": True,
                    "action": "START_SESSION",
                    "durationMinutes": duration,
                    "domains": domains,
                    "message": "Request received"
                })

            elif action == "STOP_SESSION":
                send_message({
                    "ok": True,
                    "action": "STOP_SESSION",
                    "message": "Stop request received"
                })

            else:
                send_message({
                    "ok": False,
                    "message": "Unknown action"
                })

        except (json.JSONDecodeError, ValueError) as error:
            send_message({
                "ok": False,
                "message": str(error)
            })


if __name__ == "__main__":
    main()