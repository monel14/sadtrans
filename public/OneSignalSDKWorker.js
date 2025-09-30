// OneSignal Service Worker - Enhanced Configuration with Error Handling
// This service worker is designed to work with Vite development server

try {
  // Import the OneSignal SDK service worker
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
  console.log("OneSignal SDK service worker loaded successfully");
} catch (error) {
  console.error("Failed to load OneSignal SDK service worker:", error);

  // Fallback behavior - basic service worker without OneSignal
  self.addEventListener("install", function (event) {
    console.log("Service Worker installing without OneSignal");
    self.skipWaiting();
  });

  self.addEventListener("activate", function (event) {
    console.log("Service Worker activating without OneSignal");
    event.waitUntil(self.clients.claim());
  });

  // Handle push events with fallback
  self.addEventListener("push", function (event) {
    console.log("Push event received but OneSignal SDK not available");

    if (event.data) {
      try {
        const payload = event.data.json();
        const options = {
          body: payload.body || "You have a new notification",
          icon: payload.icon || "/favicon.ico",
          badge: payload.badge || "/favicon.ico",
          data: payload.data || {},
        };

        event.waitUntil(
          self.registration.showNotification(
            payload.title || "Notification",
            options,
          ),
        );
      } catch (err) {
        console.error("Error handling push event:", err);
      }
    }
  });
}

// Message handling - moved to initial evaluation to avoid warning
if (typeof self !== "undefined") {
  self.addEventListener("message", function (event) {
    try {
      // Let OneSignal handle its own messages first
      if (event.data && event.data.onesignal) {
        // OneSignal will handle this
        return;
      }

      // Handle custom application messages
      if (event.data && event.data.type) {
        switch (event.data.type) {
          case "SKIP_WAITING":
            self.skipWaiting();
            break;
          case "GET_VERSION":
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                type: "VERSION",
                version: "1.0.0",
              });
            }
            break;
          default:
            console.log("Unknown message type:", event.data.type);
        }
      }
    } catch (error) {
      console.error("Error handling message in service worker:", error);
    }
  });
}

// Handle notification clicks
self.addEventListener("notificationclick", function (event) {
  try {
    console.log("Notification click received:", event);

    event.notification.close();

    // Get the URL from notification data or default
    const urlToOpen = event.notification.data?.url || "/";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(function (clientList) {
          // Check if there's already a window/tab open with the target URL
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(urlToOpen) && "focus" in client) {
              return client.focus();
            }
          }

          // If no window/tab is open, open a new one
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        }),
    );
  } catch (error) {
    console.error("Error handling notification click:", error);
  }
});

// Error handling for unhandled errors in the service worker
self.addEventListener("error", function (event) {
  console.error("Service Worker error:", event.error);
});

// Handle unhandled promise rejections
self.addEventListener("unhandledrejection", function (event) {
  console.error("Service Worker unhandled promise rejection:", event.reason);
  event.preventDefault();
});

console.log("Service Worker loaded and configured");
