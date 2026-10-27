import subprocess
import json


def get_running_apps():
    """
    Windows par currently running processes ki list nikalta hai.
    Abhi ye sirf information collect karta hai; kisi process ko
    band ya terminate nahi karta.
    """
    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-Process | Select-Object ProcessName, Id | ConvertTo-Json"
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=True
        )

        if not result.stdout.strip():
            return []

        processes = json.loads(result.stdout)

        # Agar sirf ek process mila, to use list mein convert karo.
        if isinstance(processes, dict):
            processes = [processes]

        apps = []

        for process in processes:
            name = process.get("ProcessName", "")
            pid = process.get("Id")

            if name and pid is not None:
                apps.append({
                    "name": name,
                    "pid": pid
                })

        return sorted(
            apps,
            key=lambda app: app["name"].lower()
        )

    except subprocess.TimeoutExpired:
        print("Error: Apps detect karne mein timeout ho gaya.")
        return []

    except subprocess.CalledProcessError as error:
        print("PowerShell error:", error)
        return []

    except json.JSONDecodeError:
        print("Error: Process data ko read nahi kar paye.")
        return []

    except OSError as error:
        print("System error:", error)
        return []


def get_unique_running_apps():
    """
    Duplicate process names hata kar unique names ki list banata hai.
    Example: Chrome ke 10 processes hon, to Chrome ek hi baar dikhega.
    """
    apps = get_running_apps()

    unique_names = set()

    for app in apps:
        name = app["name"].strip()

        if name:
            unique_names.add(name)

    return sorted(unique_names, key=str.lower)


def display_running_apps():
    """Running processes aur unique names ko display karta hai."""

    all_processes = get_running_apps()
    unique_apps = sorted(
        {app["name"].strip() for app in all_processes if app["name"].strip()},
        key=str.lower
    )

    print("\n" + "=" * 45)
    print("       LIFECUE - FOCUS HELPER")
    print("=" * 45)

    print("\n--- UNIQUE RUNNING PROCESS NAMES ---\n")

    if not unique_apps:
        print("Koi running process detect nahi hua.")
    else:
        for index, app in enumerate(unique_apps, start=1):
            print(f"{index}. {app}")

    print("\n" + "-" * 45)
    print(f"Total running processes: {len(all_processes)}")
    print(f"Total unique process names: {len(unique_apps)}")
    print("-" * 45)

    print("\nNote:")
    print("Ye program sirf processes ki list dikhata hai.")
    print("Ye kisi application ya Windows process ko band nahi karta.")


if __name__ == "__main__":
    display_running_apps()