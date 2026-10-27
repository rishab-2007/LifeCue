import subprocess
import json


def get_installed_apps():
    """
    Windows registry se installed desktop applications ki list nikalta hai.
    Ye sirf list read karta hai; apps ko modify ya uninstall nahi karta.
    """

    powershell_script = r"""
    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )

    $apps = foreach ($path in $paths) {
        Get-ItemProperty $path -ErrorAction SilentlyContinue |
        Where-Object {
            $_.DisplayName -and
            $_.SystemComponent -ne 1
        } |
        Select-Object DisplayName, DisplayVersion, Publisher
    }

    $apps | ConvertTo-Json -Depth 3
    """

    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                powershell_script
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=True
        )

        if not result.stdout.strip():
            return []

        data = json.loads(result.stdout)

        if isinstance(data, dict):
            data = [data]

        # Same app ki duplicate entries hatao.
        unique_apps = {}

        for app in data:
            name = (app.get("DisplayName") or "").strip()

            if not name:
                continue

            key = name.casefold()

            if key not in unique_apps:
                unique_apps[key] = {
                    "name": name,
                    "version": app.get("DisplayVersion") or "Unknown",
                    "publisher": app.get("Publisher") or "Unknown"
                }

        return sorted(
            unique_apps.values(),
            key=lambda app: app["name"].casefold()
        )

    except subprocess.TimeoutExpired:
        print("Error: Apps scan karne mein time lag gaya.")
        return []

    except subprocess.CalledProcessError as error:
        print("PowerShell error:", error.stderr)
        return []

    except json.JSONDecodeError:
        print("Error: Apps ki list read nahi ho paayi.")
        return []

    except OSError as error:
        print("System error:", error)
        return []


def display_installed_apps():
    apps = get_installed_apps()

    print("\n" + "=" * 65)
    print("           LIFECUE - INSTALLED APPS SCANNER")
    print("=" * 65)

    if not apps:
        print("\nKoi application detect nahi hui.")
        print("Ya registry scan mein problem aayi.")
        return

    for index, app in enumerate(apps, start=1):
        print(f"\n{index}. {app['name']}")
        print(f"   Version:   {app['version']}")
        print(f"   Publisher: {app['publisher']}")

    print("\n" + "=" * 65)
    print(f"Total unique applications found: {len(apps)}")
    print("=" * 65)

    print("\nNote: Ye registry-based scanner hai.")
    print("Kuch Microsoft Store apps ya portable apps miss ho sakti hain.")
    print("Is program se koi application band ya uninstall nahi hoti.")


if __name__ == "__main__":
    display_installed_apps()