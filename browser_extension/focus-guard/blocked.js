// Update the focus session status and countdown timer.
async function update() {
    const timer = document.getElementById("timer");
    const message = document.getElementById("msg");

    try {
        // Get the current focus session from the background script.
        const session = await chrome.runtime.sendMessage({
            type: "GET_STATE"
        });

        // Handle a missing session response.
        if (!session) {
            timer.textContent = "Status unavailable";
            message.textContent = "Please try checking the session again.";
            return;
        }

        // Check whether the session has ended.
        if (!session.active || session.endsAt <= Date.now()) {
            timer.textContent = "Session ended";
            message.textContent = "You can open the site again.";
            return;
        }

        // Calculate the remaining time.
        const remainingSeconds = Math.ceil(
            (session.endsAt - Date.now()) / 1000
        );

        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;

        // Display the countdown as MM:SS.
        timer.textContent =
            `${minutes}:${String(seconds).padStart(2, "0")}`;

        message.textContent =
            "This site is blocked during your focus session.";

    } catch (error) {
        console.error("LifeCue timer error:", error);

        timer.textContent = "Unable to load timer";
        message.textContent =
            "Please reload the page and try again.";
    }
}

// Refresh the status when the user clicks the button.
document.getElementById("refresh").addEventListener("click", update);

// Update the timer immediately.
update();

// Refresh the countdown every second.
setInterval(update, 1000);