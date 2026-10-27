import subprocess
import json


def get_running_processes():
    """Running Windows processes ki basic details return karta hai."""
    command = (
        "Get-Process | "
        "Select-Object ProcessName, Id, Path | "
        "ConvertTo-Json -Depth 3"
    )

    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                command
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=True
        )

        if not result.stdout.strip():
            return []

        processes = json.loads(result.stdout)

        if isinstance(processes, dict):
            processes = [processes]

        return [
            process
            for process in processes
            if process.get("ProcessName")
        ]

    except (subprocess.SubprocessError, OSError, json.JSONDecodeError) as error:
        print(f"Process inspection failed: {error}")
        return []


def inspect_processes(search_text):
    """Search text se matching running processes dikhata hai."""
    search_text = search_text.strip().casefold()

    if not search_text:
        print("Please provide an application name.")
        return

    matches = [
        process
        for process in get_running_processes()
        if search_text in process.get("ProcessName", "").casefold()
    ]

    if not matches:
        print(f"No matching running process found for: {search_text}")
        return

    for process in matches:
        print("-" * 40)
        print("Process:", process.get("ProcessName"))
        print("PID:", process.get("Id"))
        print("Path:", process.get("Path") or "Path unavailable")


if __name__ == "__main__":
    app_name = input("Application/process name to inspect: ")
    inspect_processes(app_name)