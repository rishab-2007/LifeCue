const base = {
    active: false,
    endsAt: 0,
    domains: [],
    lastMessage: ""
};

async function state() {
    const result = await chrome.storage.local.get("focusGuard");

    return {
        ...base,
        ...(result.focusGuard || {})
    };
}

async function save(session) {
    await chrome.storage.local.set({
        focusGuard: session
    });
}

function match(hostname, domain) {
    return hostname === domain ||
        hostname.endsWith("." + domain);
}

// Redirect blocked tabs to their original websites.
async function redirectBlockedTabs() {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;

        try {
            const url = new URL(tab.url);

            if (
                url.protocol !== "chrome-extension:" ||
                !url.pathname.endsWith("/blocked.html")
            ) {
                continue;
            }

            const originalUrl = url.searchParams.get("url");

            if (!originalUrl) {
                console.warn(
                    "LifeCue: Original URL missing from blocked page."
                );
                continue;
            }

            const original = new URL(originalUrl);

            if (!["http:", "https:"].includes(original.protocol)) {
                continue;
            }

            await chrome.tabs.update(tab.id, {
                url: original.href
            });

        } catch (error) {
            console.error("LifeCue redirect error:", error);
        }
    }
}

// Release blocking when the timer expires.
async function expire() {
    const session = await state();

    if (!session.active || Date.now() < session.endsAt) {
        return;
    }

    await save({
        ...session,
        active: false,
        endsAt: 0,
        domains: [],
        lastMessage: "Timer ended. Blocking released automatically."
    });

    await chrome.alarms.clear("focusEnd");

    await redirectBlockedTabs();
}

// Check whether a website should be blocked.
async function check(tabId, url) {
    if (!url) return;

    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        return;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return;
    }

    const session = await state();

    if (!session.active) {
        return;
    }

    if (Date.now() >= session.endsAt) {
        await expire();
        return;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    if (session.domains.some(domain => match(hostname, domain))) {
        const blockedPage = chrome.runtime.getURL("blocked.html");

        const redirectUrl =
            blockedPage +
            "?url=" +
            encodeURIComponent(parsedUrl.href);

        // Redirect only when the tab is not already on the blocked page.
        if (!url.startsWith(blockedPage)) {
            await chrome.tabs.update(tabId, {
                url: redirectUrl
            }).catch(error => {
                console.error("LifeCue tab redirect error:", error);
            });
        }
    }
}

// Monitor browser tab navigation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || (changeInfo.status === "loading" && tab.url)) {
        check(tabId, changeInfo.url || tab.url).catch(console.error);
    }
});

// Monitor timer expiration.
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "focusEnd") {
        expire().catch(console.error);
    }
});

// Restore the timer after Chrome starts.
chrome.runtime.onStartup.addListener(() => {
    state()
        .then(async session => {
            if (!session.active) return;

            if (Date.now() >= session.endsAt) {
                await expire();
            } else {
                await chrome.alarms.create("focusEnd", {
                    when: session.endsAt
                });
            }
        })
        .catch(console.error);
});

// Handle popup messages.
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        (async () => {

            // Test Native Messaging connection.
            if (message.type === "NATIVE_PING") {
                let port;
                let responded = false;

                try {
                    port = chrome.runtime.connectNative(
                        "com.lifecue.focus_guard"
                    );

                    port.onMessage.addListener(response => {
                        if (responded) return;

                        responded = true;
                        sendResponse(response);
                        port.disconnect();
                    });

                    port.onDisconnect.addListener(() => {
                        const errorMessage =
                            chrome.runtime.lastError?.message;

                        console.error(
                            "LifeCue Native Host disconnected:",
                            errorMessage || "No error message"
                        );

                        if (!responded) {
                            responded = true;

                            sendResponse({
                                ok: false,
                                error: errorMessage ||
                                    "Native host disconnected."
                            });
                        }
                    });

                    port.postMessage({
                        action: "PING"
                    });

                } catch (error) {
                    if (!responded) {
                        responded = true;

                        sendResponse({
                            ok: false,
                            error: error.message
                        });
                    }
                }

                return;
            }

            // Get current focus session.
            if (message.type === "GET_STATE") {
                await expire();
                sendResponse(await state());
                return;
            }

            // Start a focus session.
            if (message.type === "START_SESSION") {
                const minutes = Number(message.durationMinutes);

                const domains = [
                    ...new Set(
                        (message.domains || [])
                            .filter(domain =>
                                typeof domain === "string" &&
                                /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(
                                    domain.trim()
                                )
                            )
                            .map(domain => domain.trim().toLowerCase())
                    )
                ];

                if (
                    !Number.isInteger(minutes) ||
                    minutes < 1 ||
                    minutes > 180 ||
                    domains.length === 0
                ) {
                    sendResponse({
                        ok: false,
                        error:
                            "Choose a valid duration and at least one site."
                    });

                    return;
                }

                const session = {
                    active: true,
                    endsAt: Date.now() + minutes * 60000,
                    domains,
                    lastMessage: ""
                };

                await save(session);

                await chrome.alarms.create("focusEnd", {
                    when: session.endsAt
                });

                const tabs = await chrome.tabs.query({});

                for (const tab of tabs) {
                    if (tab.id && tab.url) {
                        await check(tab.id, tab.url);
                    }
                }

                sendResponse({ ok: true });
                return;
            }

            // End the session early.
            if (message.type === "STOP_SESSION") {
                const session = await state();

                await save({
                    ...session,
                    active: false,
                    endsAt: 0,
                    domains: [],
                    lastMessage: "Session ended. Blocking released."
                });

                await chrome.alarms.clear("focusEnd");

                await redirectBlockedTabs();

                sendResponse({ ok: true });
                return;
            }

        })().catch(error => {
            console.error("LifeCue background error:", error);

            sendResponse({
                ok: false,
                error: error.message
            });
        });

        return true;
    }
);
// Allow the LifeCue website to communicate with this extension.
chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        (async () => {
            // Accept requests only from the local LifeCue development website.
            const senderUrl = sender.url
                ? new URL(sender.url)
                : null;

            const allowedOrigins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173"
            ];

            if (
                !senderUrl ||
                !allowedOrigins.includes(senderUrl.origin)
            ) {
                sendResponse({
                    ok: false,
                    error: "Website origin is not allowed."
                });
                return;
            }
            // Return shared website settings to the LifeCue website.
if (message.type === "GET_SETTINGS") {
    const result = await chrome.storage.local.get([
        "focusGuardSelectedDomains",
        "focusGuardCustomSites"
    ]);

    sendResponse({
        ok: true,
        selectedDomains: result.focusGuardSelectedDomains || [],
        customSites: result.focusGuardCustomSites || []
    });

    return;
}

// Save shared website settings from the LifeCue website.
if (message.type === "SAVE_SETTINGS") {
    const selectedDomains = Array.isArray(message.selectedDomains)
        ? [...new Set(
            message.selectedDomains
                .filter(domain => typeof domain === "string")
                .map(domain => domain.trim().toLowerCase())
                .filter(domain =>
                    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)
                )
        )]
        : [];

    const customSites = Array.isArray(message.customSites)
        ? [...new Set(
            message.customSites
                .filter(domain => typeof domain === "string")
                .map(domain => domain.trim().toLowerCase())
                .filter(domain =>
                    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)
                )
        )]
        : [];

    await chrome.storage.local.set({
        focusGuardSelectedDomains: selectedDomains,
        focusGuardCustomSites: customSites
    });

    sendResponse({
        ok: true,
        selectedDomains,
        customSites
    });

    return;
}

            // Return the current focus session.
            if (message.type === "GET_STATE") {
                await expire();

                sendResponse({
                    ok: true,
                    session: await state()
                });
                return;
            }

            // Start a focus session from LifeCue.
            if (message.type === "START_SESSION") {
                const minutes = Number(message.durationMinutes);

                const domains = [
                    ...new Set(
                        (Array.isArray(message.domains)
                            ? message.domains
                            : []
                        )
                            .filter(
                                domain => typeof domain === "string"
                            )
                            .map(
                                domain => domain.trim().toLowerCase()
                            )
                            .filter(
                                domain =>
                                    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(
                                        domain
                                    ) &&
                                    domain.split(".").every(
                                        label =>
                                            label.length > 0 &&
                                            label.length <= 63 &&
                                            !label.startsWith("-") &&
                                            !label.endsWith("-")
                                    )
                            )
                    )
                ];

                if (
                    !Number.isInteger(minutes) ||
                    minutes < 1 ||
                    minutes > 180 ||
                    domains.length === 0
                ) {
                    sendResponse({
                        ok: false,
                        error: "Choose a duration from 1 to 180 minutes and at least one valid website."
                    });
                    return;
                }

                const session = {
                    active: true,
                    endsAt: Date.now() + minutes * 60000,
                    domains,
                    lastMessage: ""
                };

                await save(session);

                await chrome.alarms.create("focusEnd", {
                    when: session.endsAt
                });

                const tabs = await chrome.tabs.query({});

                for (const tab of tabs) {
                    if (tab.id && tab.url) {
                        await check(tab.id, tab.url);
                    }
                }

                sendResponse({
                    ok: true,
                    session
                });
                return;
            }

            // Stop a focus session from LifeCue.
            if (message.type === "STOP_SESSION") {
                const session = await state();

                await save({
                    ...session,
                    active: false,
                    endsAt: 0,
                    domains: [],
                    lastMessage: "Session ended. Blocking released."
                });

                await chrome.alarms.clear("focusEnd");
                await redirectBlockedTabs();

                sendResponse({ ok: true });
                return;
            }

            sendResponse({
                ok: false,
                error: "Unsupported LifeCue request."
            });
        })().catch(error => {
            console.error(
                "LifeCue external message error:",
                error
            );

            sendResponse({
                ok: false,
                error: error.message ||
                    "Extension request failed."
            });
        })

        return true;
    }
);