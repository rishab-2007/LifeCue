"use strict";

const $ = (id) => document.getElementById(id);

const startButton = $("start");
const stopButton = $("stop");
const durationSelect = $("duration");
const statusElement = $("status");
const remainingElement = $("remaining");
const timerCaption = $("timerCaption");
const statusDot = $("statusDot");
const messageElement = $("message");
const selectedCount = $("selectedCount");

const customDomainInput = $("customDomain");
const addDomainButton = $("addDomain");
const customSitesContainer = $("customSites");

const CUSTOM_SITES_KEY = "focusGuardCustomSites";

let refreshInProgress = false;
let lastMessage = "";
let customSites = [];

function normalizeDomain(value) {
    let domain = value.trim().toLowerCase();

    if (!domain) {
        return null;
    }

    try {
        if (!/^https?:\/\//i.test(domain)) {
            domain = "https://" + domain;
        }

        const parsed = new URL(domain);

        if (
            !["http:", "https:"].includes(parsed.protocol) ||
            !parsed.hostname.includes(".") ||
            parsed.username ||
            parsed.password ||
            parsed.port ||
            parsed.search ||
            parsed.hash ||
            (parsed.pathname !== "/" && parsed.pathname !== "")
        ) {
            return null;
        }

        domain = parsed.hostname.toLowerCase();

        if (
            domain.length > 253 ||
            !/^[a-z0-9.-]+$/.test(domain) ||
            domain.startsWith(".") ||
            domain.endsWith(".") ||
            domain.includes("..")
        ) {
            return null;
        }

        const labels = domain.split(".");

        if (
            labels.some(
                (label) =>
                    !label ||
                    label.length > 63 ||
                    label.startsWith("-") ||
                    label.endsWith("-")
            )
        ) {
            return null;
        }

        const finalLabel = labels[labels.length - 1];

        if (!/^[a-z]{2,63}$/.test(finalLabel)) {
            return null;
        }

        return domain;
    } catch {
        return null;
    }
}

function getSelectedDomains() {
    return [
        ...document.querySelectorAll(
            'input[type="checkbox"]:checked'
        )
    ].map((checkbox) => checkbox.value);
}

function updateSelectedCount() {
    const count = getSelectedDomains().length;

    selectedCount.textContent = `${count} selected`;

    startButton.disabled =
        count === 0 || durationSelect.disabled;
}

function formatRemainingTime(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return [
            hours,
            String(minutes).padStart(2, "0"),
            String(seconds).padStart(2, "0")
        ].join(":");
    }

    return [
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0")
    ].join(":");
}

function showError(error) {
    console.error("LifeCue Focus Guard:", error);

    messageElement.textContent =
        "Couldn't update the session. Please try again.";

    statusElement.textContent = "Status unavailable";
    remainingElement.textContent = "--:--";
    timerCaption.textContent = "Unable to check focus status";

    statusDot.classList.remove("active");

    startButton.disabled = false;
    stopButton.disabled = true;
}

async function loadCustomSites() {
    const result = await chrome.storage.local.get(CUSTOM_SITES_KEY);
    const savedSites = result[CUSTOM_SITES_KEY];

    customSites = Array.isArray(savedSites)
        ? [
            ...new Set(
                savedSites
                    .filter((site) => typeof site === "string")
                    .map((site) => normalizeDomain(site))
                    .filter(Boolean)
            )
        ]
        : [];

    renderCustomSites();
}

async function saveCustomSites() {
    await chrome.storage.local.set({
        [CUSTOM_SITES_KEY]: customSites
    });
}

function renderCustomSites() {
    customSitesContainer.replaceChildren();

    customSites.forEach((domain) => {
        const row = document.createElement("div");
        row.className = "custom-site-item";

        const label = document.createElement("label");
        label.className = "custom-site-domain";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = domain;
        checkbox.className = "custom-domain-checkbox";
        checkbox.checked = false;
        checkbox.disabled = durationSelect.disabled;
        checkbox.addEventListener("change", updateSelectedCount);

        const domainText = document.createElement("span");
        domainText.textContent = domain;

        label.append(checkbox, domainText);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.className = "remove-custom-site";
        removeButton.disabled = durationSelect.disabled;

        removeButton.addEventListener("click", async () => {
            if (durationSelect.disabled) {
                return;
            }

            customSites = customSites.filter(
                (site) => site !== domain
            );

            try {
                await saveCustomSites();
                renderCustomSites();
                updateSelectedCount();

                messageElement.textContent =
                    `${domain} removed from your custom websites.`;
            } catch (error) {
                console.error("Unable to remove custom website:", error);

                messageElement.textContent =
                    "Couldn't remove this website. Please try again.";
            }
        });

        row.append(label, removeButton);
        customSitesContainer.appendChild(row);
    });

    updateSelectedCount();
}

async function addCustomSite() {
    if (!customDomainInput || !addDomainButton) {
        return;
    }

    if (durationSelect.disabled) {
        messageElement.textContent =
            "End the current focus session before editing websites.";
        return;
    }

    const domain = normalizeDomain(customDomainInput.value);

    if (!domain) {
        messageElement.textContent =
            "Enter a valid domain, such as pinterest.com.";
        customDomainInput.focus();
        return;
    }

    const alreadyPredefined = [
        ...document.querySelectorAll(
            'input[type="checkbox"]:not(.custom-domain-checkbox)'
        )
    ].some(
        (checkbox) => checkbox.value.toLowerCase() === domain
    );

    if (alreadyPredefined || customSites.includes(domain)) {
        messageElement.textContent =
            "This website has already been added.";
        return;
    }

    customSites.push(domain);
    customSites.sort();

    try {
        await saveCustomSites();

        customDomainInput.value = "";
        renderCustomSites();

        messageElement.textContent =
            `${domain} added. Select it to block during your next session.`;

        customDomainInput.focus();
    } catch (error) {
        customSites = customSites.filter(
            (site) => site !== domain
        );

        renderCustomSites();

        console.error("Unable to save custom website:", error);

        messageElement.textContent =
            "Couldn't save this website. Please try again.";
    }
}

async function refresh() {
    if (refreshInProgress) {
        return;
    }

    refreshInProgress = true;

    try {
        const session = await chrome.runtime.sendMessage({
            type: "GET_STATE"
        });

        if (
            !session ||
            typeof session.active !== "boolean" ||
            typeof session.endsAt !== "number"
        ) {
            throw new Error("Invalid session state.");
        }

        const active =
            session.active &&
            session.endsAt > Date.now();

        statusElement.textContent = active
            ? "Focus session active"
            : "Ready for your next session";

        statusDot.classList.toggle("active", active);

        remainingElement.textContent = active
            ? formatRemainingTime(session.endsAt - Date.now())
            : "00:00";

        timerCaption.textContent = active
            ? "Time remaining in your focus session"
            : "Choose a duration to get started";

        durationSelect.disabled = active;

        document.querySelectorAll(
            'input[type="checkbox"]'
        ).forEach((checkbox) => {
            checkbox.disabled = active;
        });

        if (customDomainInput) {
            customDomainInput.disabled = active;
        }

        if (addDomainButton) {
            addDomainButton.disabled = active;
        }

        document.querySelectorAll(
            ".remove-custom-site"
        ).forEach((button) => {
            button.disabled = active;
        });

        startButton.disabled =
            active || getSelectedDomains().length === 0;

        stopButton.disabled = !active;

        if (session.lastMessage) {
            lastMessage = session.lastMessage;
        }

        if (lastMessage) {
            messageElement.textContent = lastMessage;
        }
    } catch (error) {
        showError(error);
    } finally {
        refreshInProgress = false;
    }
}

startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    messageElement.textContent = "Starting your focus session...";

    try {
        const domains = getSelectedDomains();

        if (domains.length === 0) {
            messageElement.textContent =
                "Select at least one website to block.";
            return;
        }

        const response = await chrome.runtime.sendMessage({
            type: "START_SESSION",
            durationMinutes: Number(durationSelect.value),
            domains
        });

        if (!response || !response.ok) {
            throw new Error(
                response?.error || "Unable to start the session."
            );
        }

        lastMessage = "Focus session started. Stay on track!";
        messageElement.textContent = lastMessage;

        await refresh();
    } catch (error) {
        messageElement.textContent =
            error.message || "Unable to start the session.";

        await refresh();
    }
});

stopButton.addEventListener("click", async () => {
    stopButton.disabled = true;
    messageElement.textContent = "Ending your focus session...";

    try {
        const response = await chrome.runtime.sendMessage({
            type: "STOP_SESSION"
        });

        if (!response || !response.ok) {
            throw new Error(
                response?.error || "Unable to end the session."
            );
        }

        lastMessage = "Session ended. Blocking has been released.";
        messageElement.textContent = lastMessage;

        await refresh();
    } catch (error) {
        messageElement.textContent =
            error.message || "Unable to end the session.";

        await refresh();
    }
});

if (addDomainButton) {
    addDomainButton.addEventListener("click", addCustomSite);
}

if (customDomainInput) {
    customDomainInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addCustomSite();
        }
    });
}

document.querySelectorAll(
    'input[type="checkbox"]:not(.custom-domain-checkbox)'
).forEach((checkbox) => {
    checkbox.addEventListener("change", updateSelectedCount);
});

async function initialize() {
    try {
        await loadCustomSites();
    } catch (error) {
        console.error("Unable to load custom websites:", error);

        messageElement.textContent =
            "Couldn't load saved custom websites.";
    }

    await refresh();
}

initialize();

setInterval(refresh, 1000);