const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electron", {
      send: (channel, data) => {
            const validChannels = [
                  "step-changed",
                  "onboarding-complete",
                  "app-minimize",
                  "app-maximize",
                  "app-close",
                  "request-permissions",
                  "open-system-preferences",
                  "record-audio",
                  "realtime-time-record",
                  "recording-control",
                  "open-overlay",
                  "close-overlay",
                  "activate-magic-lens",
                  "selection-complete",
                  "resize-recording-window",
                  "set-mic-device",
                  "set-ignore-mouse"
            ]
            if (validChannels.includes(channel)) {
                  ipcRenderer.send(channel, data)
            }
      },

      receive: (channel, callback) => {
            const validChannels = [
                  "app-ready",
                  "update-available",
                  "language-changed",
                  "permissions-result",
                  "update-record-time",
                  "recording-control-update",
                  "recording-paused-state",
                  "recording-saved",
                  "transcription-updated",
                  "magic-lens-selection",
                  "mcp-auth-success",
            ]
            if (validChannels.includes(channel)) {
                  ipcRenderer.on(channel, (event, ...args) => callback(...args))
            }
      },

      removeListener: (channel, callback) => {
            ipcRenderer.removeListener(channel, callback)
      },

      removeAllListeners: (channel) => {
            ipcRenderer.removeAllListeners(channel)
      },

      invoke: async (channel, data) => {
            const validChannels = [
                  "get-settings",
                  "save-settings",
                  "get-system-info",
                  "check-permissions",
                  "request-microphone",
                  "request-screen",
                  "get-screen-sources",
                  "save-image-file",
                  "isInitial",
                  "request-sizeCache",
                  "save-audio-file",
                  "save-image-file",
                  "get-session-logs",
                  "get-session",
                  "delete-session",
                  "update-transcription",
                  "get-all-files",
                  "get-db-size",
                  "set-gemini-api-key",
                  "delete-db",
                  "retry-transcription",
                  "chat-session",
                  "set-mic-front",
                  "get-latest-file",
                  "read-file-as-base64",
                  "get-system-metrics",
                  "retry-transcription",
                  "mcp-get-status",
                  "mcp-open-google-auth",
                  "mcp-open-notion-auth",
                  "mcp-disconnect",
                  "calendar-create-event",
                  "calendar-dismiss-event",
                  "search-everything"
            ]
            if (validChannels.includes(channel)) {
                  return await ipcRenderer.invoke(channel, data)
            }
            return null
      },

      getMicrophoneDevices: async () => {
            try {
                  await navigator.mediaDevices.getUserMedia({ audio: true })
                  const devices = await navigator.mediaDevices.enumerateDevices()
                  return devices
                        .filter(device => device.kind === "audioinput")
                        .map(device => ({
                              deviceId: device.deviceId,
                              label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
                              kind: device.kind,
                              groupId: device.groupId
                        }))
            } catch (error) {
                  return []
            }
      },
})