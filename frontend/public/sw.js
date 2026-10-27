self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "A task reminder is due." }; }
  const title = data.title || "LifeCue reminder";
  const options = {
    body: data.body || "A task is due.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/tasks", taskId: data.taskId || null },
    tag: data.taskId ? `lifecue-${data.taskId}` : "lifecue-reminder",
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/tasks", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) { await client.focus(); client.navigate(target); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
