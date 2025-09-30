// OneSignal SDK Updater Worker - Enhanced with Error Handling
// This worker handles OneSignal SDK updates and provides fallback behavior

try {
  // Import the OneSignal SDK updater worker
  importScripts(
    "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKUpdaterWorker.js",
  );
  console.log("OneSignal SDK updater worker loaded successfully");
} catch (error) {
  console.error("Failed to load OneSignal SDK updater worker:", error);

  // Fallback implementation for updater worker
  self.addEventListener("install", function (event) {
    console.log("OneSignal updater worker installing (fallback mode)");
    self.skipWaiting();
  });

  self.addEventListener("activate", function (event) {
    console.log("OneSignal updater worker activating (fallback mode)");
    event.waitUntil(self.clients.claim());
  });
}

// Enhanced message handling for updater worker
self.addEventListener("message", function (event) {
  try {
    console.log("OneSignal updater worker received message:", event.data);

    // Handle update-related messages
    if (event.data && event.data.type) {
      switch (event.data.type) {
        case "SKIP_WAITING":
          self.skipWaiting();
          break;
        case "UPDATE_AVAILABLE":
          console.log("OneSignal SDK update available");
          break;
        case "UPDATE_CHECK":
          // Respond with update status
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: "UPDATE_STATUS",
              available: false, // Fallback: no updates available
            });
          }
          break;
        default:
          console.log(
            "Unknown message type in updater worker:",
            event.data.type,
          );
      }
    }
  } catch (error) {
    console.error("Error handling message in updater worker:", error);
  }
});

// Error handling
self.addEventListener("error", function (event) {
  console.error("OneSignal updater worker error:", event.error);
});

self.addEventListener("unhandledrejection", function (event) {
  console.error(
    "OneSignal updater worker unhandled promise rejection:",
    event.reason,
  );
  event.preventDefault();
});

console.log("OneSignal SDK updater worker loaded and configured");
