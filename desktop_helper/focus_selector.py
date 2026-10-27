import tkinter as tk
from tkinter import ttk, messagebox
import time

from installed_apps import get_installed_apps


class LifeCueFocusSelector:

    def __init__(self, root):
        self.root = root
        self.root.title("LifeCue - Focus Mode")
        self.root.geometry("760x650")
        self.root.minsize(600, 500)

        self.apps = []
        self.app_vars = {}
        self.selected_apps = set()

        self.timer_running = False
        self.end_time = None
        self.session_duration = 25

        self.root.protocol("WM_DELETE_WINDOW", self.close_window)

        self.setup_ui()
        self.load_apps()

    def setup_ui(self):

        main = ttk.Frame(self.root, padding=18)
        main.pack(fill="both", expand=True)

        ttk.Label(
            main,
            text="LifeCue Focus Mode",
            font=("Segoe UI", 22, "bold")
        ).pack(anchor="w")

        ttk.Label(
            main,
            text="Choose distracting apps and set your focus duration."
        ).pack(anchor="w", pady=(2, 14))

        settings = ttk.Frame(main)
        settings.pack(fill="x", pady=(0, 12))

        ttk.Label(
            settings,
            text="Focus duration:"
        ).pack(side="left")

        self.duration_var = tk.StringVar(value="25")

        duration_box = ttk.Combobox(
            settings,
            textvariable=self.duration_var,
            values=["1", "5", "15", "25", "45", "60", "90"],
            width=8,
            state="readonly"
        )

        duration_box.pack(side="left", padx=8)

        ttk.Label(
            settings,
            text="minutes"
        ).pack(side="left")

        self.search_var = tk.StringVar()

        ttk.Label(
            main,
            text="Search applications:"
        ).pack(anchor="w")

        search_entry = ttk.Entry(
            main,
            textvariable=self.search_var
        )

        search_entry.pack(fill="x", pady=(4, 10))

        self.search_var.trace_add(
            "write",
            self.filter_apps
        )

        toolbar = ttk.Frame(main)
        toolbar.pack(fill="x", pady=(0, 8))

        ttk.Button(
            toolbar,
            text="Select All Visible",
            command=self.select_visible
        ).pack(side="left")

        ttk.Button(
            toolbar,
            text="Clear Selection",
            command=self.clear_selection
        ).pack(side="left", padx=8)

        self.app_count = ttk.Label(
            toolbar,
            text="Loading applications..."
        )

        self.app_count.pack(side="right")

        list_container = ttk.Frame(main)
        list_container.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(
            list_container,
            highlightthickness=0
        )

        scrollbar = ttk.Scrollbar(
            list_container,
            orient="vertical",
            command=self.canvas.yview
        )

        self.apps_frame = ttk.Frame(self.canvas)

        self.apps_window = self.canvas.create_window(
            (0, 0),
            window=self.apps_frame,
            anchor="nw"
        )

        self.canvas.configure(
            yscrollcommand=scrollbar.set
        )

        self.canvas.pack(
            side="left",
            fill="both",
            expand=True
        )

        scrollbar.pack(
            side="right",
            fill="y"
        )

        self.apps_frame.bind(
            "<Configure>",
            lambda event: self.canvas.configure(
                scrollregion=self.canvas.bbox("all")
            )
        )

        self.canvas.bind(
            "<Configure>",
            lambda event: self.canvas.itemconfigure(
                self.apps_window,
                width=event.width
            )
        )

        self.timer_label = ttk.Label(
            main,
            text="25:00",
            font=("Segoe UI", 30, "bold")
        )

        self.timer_label.pack(pady=(14, 4))

        self.status_label = ttk.Label(
            main,
            text="Ready to focus"
        )

        self.status_label.pack(pady=(0, 10))

        buttons = ttk.Frame(main)
        buttons.pack(fill="x")

        self.start_button = ttk.Button(
            buttons,
            text="Start Focus Session",
            command=self.start_timer
        )

        self.start_button.pack(side="left")

        self.stop_button = ttk.Button(
            buttons,
            text="Stop Focus Session",
            command=self.stop_timer,
            state="disabled"
        )

        self.stop_button.pack(side="left", padx=8)

        ttk.Label(
            main,
            text=(
                "App selection and timer are ready. "
                "Desktop app blocking will be integrated separately."
            ),
            wraplength=700
        ).pack(anchor="w", pady=(12, 0))

    def load_apps(self):

        try:
            self.apps = get_installed_apps()

            self.render_apps()

            if not self.apps:
                self.status_label.config(
                    text="No applications found. Check the scanner."
                )

        except Exception as error:

            messagebox.showerror(
                "Application Loading Error",
                f"Could not load applications:\n{error}"
            )

            self.status_label.config(
                text="Application loading failed."
            )

    def render_apps(self):

        # Existing checkbox values ko save karo.
        for name, var in self.app_vars.items():
            if var.get():
                self.selected_apps.add(name)
            else:
                self.selected_apps.discard(name)

        for widget in self.apps_frame.winfo_children():
            widget.destroy()

        self.app_vars.clear()

        query = self.search_var.get().strip().casefold()
        visible_count = 0

        for app in self.apps:

            name = app["name"]

            if query and query not in name.casefold():
                continue

            var = tk.BooleanVar(
                value=name in self.selected_apps
            )

            self.app_vars[name] = var

            row = ttk.Frame(
                self.apps_frame,
                padding=(5, 5)
            )

            row.pack(fill="x")

            checkbox = ttk.Checkbutton(
                row,
                text=name,
                variable=var,
                command=lambda app_name=name, v=var:
                    self.update_selection(app_name, v)
            )

            checkbox.pack(side="left", anchor="w")

            publisher = app.get(
                "publisher",
                "Unknown"
            )

            ttk.Label(
                row,
                text=publisher,
                width=28,
                anchor="e"
            ).pack(side="right")

            visible_count += 1

        self.app_count.config(
            text=(
                f"{visible_count} shown | "
                f"{len(self.selected_apps)} selected"
            )
        )

        self.canvas.yview_moveto(0)

    def update_selection(self, name, variable):

        if variable.get():
            self.selected_apps.add(name)
        else:
            self.selected_apps.discard(name)

        self.update_app_count()

    def update_app_count(self):

        visible_count = len(self.app_vars)

        self.app_count.config(
            text=(
                f"{visible_count} shown | "
                f"{len(self.selected_apps)} selected"
            )
        )

    def filter_apps(self, *_):

        self.render_apps()

    def select_visible(self):

        for name, var in self.app_vars.items():
            var.set(True)
            self.selected_apps.add(name)

        self.update_app_count()

    def clear_selection(self):

        for name, var in self.app_vars.items():
            var.set(False)
            self.selected_apps.discard(name)

        self.update_app_count()

    def start_timer(self):

        if self.timer_running:
            return

        selected = sorted(
            self.selected_apps,
            key=str.casefold
        )

        if not selected:

            messagebox.showwarning(
                "No Apps Selected",
                "Please select at least one application."
            )

            return

        try:
            minutes = int(self.duration_var.get())

        except ValueError:

            messagebox.showerror(
                "Invalid Duration",
                "Please select a valid duration."
            )

            return

        if not 1 <= minutes <= 180:

            messagebox.showerror(
                "Invalid Duration",
                "Choose a duration between 1 and 180 minutes."
            )

            return

        # Current session ke liye selected apps snapshot.
        self.session_apps = selected
        self.session_duration = minutes

        self.timer_running = True

        self.end_time = (
            time.monotonic() + minutes * 60
        )

        self.start_button.config(
            state="disabled"
        )

        self.stop_button.config(
            state="normal"
        )

        self.status_label.config(
            text=(
                f"Focus session running | "
                f"{len(self.session_apps)} apps selected"
            )
        )

        self.update_timer()

    def update_timer(self):

        if not self.timer_running:
            return

        remaining = max(
            0,
            int(self.end_time - time.monotonic())
        )

        minutes, seconds = divmod(
            remaining,
            60
        )

        self.timer_label.config(
            text=f"{minutes:02d}:{seconds:02d}"
        )

        if remaining <= 0:

            self.timer_running = False

            self.start_button.config(
                state="normal"
            )

            self.stop_button.config(
                state="disabled"
            )

            self.status_label.config(
                text="Focus session completed!"
            )

            self.timer_label.config(
                text="00:00"
            )

            messagebox.showinfo(
                "LifeCue Focus Mode",
                "Focus session completed. Great work!"
            )

            return

        self.root.after(
            250,
            self.update_timer
        )

    def stop_timer(self):

        if not self.timer_running:
            return

        self.timer_running = False

        self.start_button.config(
            state="normal"
        )

        self.stop_button.config(
            state="disabled"
        )

        self.status_label.config(
            text="Focus session stopped."
        )

        self.timer_label.config(
            text="00:00"
        )

    def close_window(self):

        self.timer_running = False
        self.root.destroy()


if __name__ == "__main__":

    root = tk.Tk()

    app = LifeCueFocusSelector(root)

    root.mainloop()