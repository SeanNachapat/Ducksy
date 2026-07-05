const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, screen, shell, globalShortcut, Tray, Menu, nativeImage, session } = require("electron")
const path = require("path")
const fs = require("fs")
const serve = require("electron-serve").default
const db = require("./utils/db")
const { registerIpcHandlers, setMainWindow, setOnRecordingWindow } = require("./ipcHandlers")
const PROTOCOL_SCHEME = 'ducksy'
const SERVER_URL = 'http://localhost:8080'
const dotenv = require('dotenv')
dotenv.config()
const isProd = app.isPackaged
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('enable-transparent-visuals')
const loadURL = serve({ directory: 'out' });
async function safeLoadURL(win, url) {
      if (isProd) {
            if (win === mainWindow) {
                  await loadURL(win);
            } else {
                  await win.loadURL(url);
            }
      } else {
            let loaded = false;
            let attempts = 0;
            while (!loaded && attempts < 30) {
                  try {
                        await win.loadURL(url);
                        loaded = true;
                  } catch (err) {
                        attempts++;
                        console.log(`[Electron] Dev server at ${url} not ready (attempt ${attempts}/30). Retrying in 1s...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                  }
            }
            if (!loaded) {
                  throw new Error(`Failed to load ${url} after 30 attempts.`);
            }
      }
}
function getAppPath(page = '') {
      if (isProd) {
            if (page === '' || page === 'index' || page === 'index.html') {
                  const filePath = path.join(__dirname, 'out', 'index.html')
                  return filePath
            }
            const filePath = path.join(__dirname, 'out', page, 'index.html')
            return filePath
      }
      return null
}
let mainWindow
let onRecordingWindow
let selectionWindow
let initalized
let captureWindow
let deviceId
let tray = null
async function createOnRecordingWindow() {
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.show()
            onRecordingWindow.focus()
            return
      }
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth } = primaryDisplay.workAreaSize
      const width_f = 432 // 400px notch + 16px arch on each side
      const height_f = 40 // Start expanded static notch
      onRecordingWindow = new BrowserWindow({
            width: width_f,
            height: height_f,
            minWidth: width_f,
            minHeight: 40,
            backgroundColor: "#00000000",
            title: "",
            autoHideMenuBar: true,
            alwaysOnTop: true,
            frame: false,
            transparent: true,
            hasShadow: false,
            skipTaskbar: true,
            resizable: false,
            movable: false,
            thickFrame: false,
            titleBarStyle: 'hidden',
            minimizable: false,
            maximizable: false,
            webPreferences: {
                  preload: path.join(__dirname, "preload.js"),
                  nodeIntegration: false,
                  contextIsolation: true,
                  defaultFontFamily: "monospace"
            },
      })
      onRecordingWindow.setMenu(null)
      setOnRecordingWindow(onRecordingWindow)
      onRecordingWindow.setPosition(Math.floor((screenWidth - width_f) / 2), 0)
      onRecordingWindow.setAlwaysOnTop(true, "screen-saver")
      onRecordingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      await safeLoadURL(onRecordingWindow, isProd ? "app://-/onRecord" : "http://localhost:3000/onRecord")
      onRecordingWindow.on("page-title-updated", (e) => {
            e.preventDefault()
      })
      onRecordingWindow.on("blur", () => {
            if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
                  onRecordingWindow.setBackgroundColor("#00000000")
            }
      })
      onRecordingWindow.on("focus", () => {
            if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
                  onRecordingWindow.setBackgroundColor("#00000000")
            }
      })
      onRecordingWindow.on("show", () => {
            if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
                  onRecordingWindow.setBackgroundColor("#00000000")
            }
      })
      onRecordingWindow.on("closed", () => {
            onRecordingWindow = null
            setOnRecordingWindow(null)
      })
}
async function createSelectionWindow() {
      console.log("Create Page")
      if (selectionWindow && !selectionWindow.isDestroyed()) {
            return
      }
      const primaryDisplay = screen.getPrimaryDisplay()
      const { x, y, width, height } = primaryDisplay.bounds
      selectionWindow = new BrowserWindow({
            x,
            y,
            width,
            height,
            backgroundColor: "#00000000",
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            autoHideMenuBar: true,
            hasShadow: false,
            resizable: false,
            movable: false,
            show: false,
            fullscreen: process.platform !== 'darwin',
            simpleFullscreen: process.platform === 'darwin',
            webPreferences: {
                  preload: path.join(__dirname, "preload.js"),
                  nodeIntegration: false,
                  contextIsolation: true
            }
      })
      selectionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      await safeLoadURL(selectionWindow, isProd ? "app://-/magic-lens" : "http://localhost:3000/magic-lens")
      selectionWindow.on("closed", () => {
            selectionWindow = null
      })
}
function closeOnRecordingWindow() {
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.close()
            onRecordingWindow = null
      }
}
function createTray() {
      const iconPath = path.join(__dirname, "assets", "icon-32x32.png")
      const icon = nativeImage.createFromPath(iconPath)
      tray = new Tray(icon)
      const contextMenu = Menu.buildFromTemplate([
            {
                  label: "Show Dashboard",
                  click: () => {
                        if (mainWindow) {
                              mainWindow.show()
                              mainWindow.setSkipTaskbar(false)
                              mainWindow.focus()
                        }
                        closeOnRecordingWindow()
                        if (selectionWindow) selectionWindow.hide()
                  }
            },
            { type: "separator" },
            {
                  label: "Quit Ducksy",
                  click: () => {
                        app.quit()
                  }
            }
      ])
      tray.setToolTip("Ducksy")
      tray.setContextMenu(contextMenu)
      tray.on("click", () => {
            if (mainWindow) {
                  if (mainWindow.isVisible()) {
                        mainWindow.hide()
                  } else {
                        mainWindow.show()
                        mainWindow.setSkipTaskbar(false)
                        mainWindow.focus()
                  }
            }
      })
}
async function createWindow() {
      mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            backgroundColor: "#0a0a0a",
            titleBarStyle: "hiddenInset",
            trafficLightPosition: { x: 16, y: 16 },
            frame: process.platform === 'darwin',
            autoHideMenuBar: true,
            webPreferences: {
                  preload: path.join(__dirname, "preload.js"),
                  nodeIntegration: false,
                  contextIsolation: true,
                  defaultFontFamily: "monospace"
            },
      })
      setMainWindow(mainWindow);
      await safeLoadURL(mainWindow, isProd ? "app://-/index" : "http://localhost:3000")
      if (!isProd) {
            mainWindow.webContents.openDevTools()
      }
      mainWindow.webContents.on("did-finish-load", () => {
            mainWindow.webContents.send("app-ready")
      })
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("https:") || url.startsWith("http:")) {
                  shell.openExternal(url);
            }
            return { action: "deny" };
      });
}
if (process.defaultApp) {
      if (process.argv.length >= 2) {
            const success = app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])])
            console.log('Protocol registered (dev mode):', PROTOCOL_SCHEME, '- success:', success)
            console.log('Argv:', process.argv)
      }
} else {
      const success = app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
      console.log('Protocol registered (prod mode):', PROTOCOL_SCHEME, '- success:', success)
}
async function handleDeeplink(url) {
      console.log('Deeplink received:', url)
      try {
            const parsed = new URL(url)
            console.log('Parsed URL:', { protocol: parsed.protocol, host: parsed.host, pathname: parsed.pathname })
            if (parsed.protocol !== `${PROTOCOL_SCHEME}:`) {
                  console.log('Wrong protocol, ignoring')
                  return
            }
            if (parsed.host === 'auth' && parsed.pathname === '/callback') {
                  const provider = parsed.searchParams.get('provider')
                  const tokenId = parsed.searchParams.get('token_id')
                  console.log('OAuth callback:', { provider, tokenId })
                  if (provider && tokenId) {
                        console.log('Fetching token from server...')
                        const response = await fetch(`${SERVER_URL}/auth/token/${tokenId}`)
                        console.log('Server response status:', response.status)
                        if (response.ok) {
                              const tokenData = await response.json()
                              console.log('Token data received:', { hasAccessToken: !!tokenData.access_token })
                              await db.saveMcpCredential(
                                    provider,
                                    tokenData.access_token,
                                    tokenData.refresh_token || null,
                                    null,
                                    null,
                                    JSON.stringify(tokenData)
                              )
                              console.log('Credential saved to database')
                              if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.webContents.send('mcp-auth-success', { provider })
                                    mainWindow.show()
                                    mainWindow.focus()
                                    console.log('Sent mcp-auth-success event to renderer')
                              }
                        } else {
                              console.error('Server response not OK:', await response.text())
                        }
                  }
            }
      } catch (error) {
            console.error('Deeplink error:', error)
      }
}
let deferredDeeplinkUrl = null
app.on('open-url', (event, url) => {
      event.preventDefault()
      console.log('open-url event received:', url)
      if (app.isReady() && mainWindow) {
            handleDeeplink(url)
      } else {
            deferredDeeplinkUrl = url
            console.log('Deferred deeplink URL for later processing')
      }
})
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
      console.log('Second instance detected, waiting for deeplink URL...')
      app.on('open-url', async (event, url) => {
            event.preventDefault()
            console.log('Second instance received deeplink:', url)
            try {
                  const parsed = new URL(url)
                  if (parsed.host === 'auth' && parsed.pathname === '/callback') {
                        const provider = parsed.searchParams.get('provider')
                        const tokenId = parsed.searchParams.get('token_id')
                        console.log('Processing OAuth callback:', { provider, tokenId })
                        if (provider && tokenId) {
                              const response = await fetch(`${SERVER_URL}/auth/token/${tokenId}`)
                              if (response.ok) {
                                    const tokenData = await response.json()
                                    await db.saveMcpCredential(
                                          provider,
                                          tokenData.access_token,
                                          tokenData.refresh_token || null,
                                          null,
                                          null,
                                          JSON.stringify(tokenData)
                                    )
                                    console.log('Token saved successfully! You may need to refresh the settings page.')
                              }
                        }
                  }
            } catch (error) {
                  console.error('Error processing deeplink in second instance:', error)
            }
            setTimeout(() => app.quit(), 500)
      })
      setTimeout(() => {
            console.log('No deeplink URL received, quitting second instance')
            app.quit()
      }, 5000)
} else {
      app.on('second-instance', (event, commandLine) => {
            console.log('second-instance event, commandLine:', commandLine)
            const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`))
            if (url) handleDeeplink(url)
            if (mainWindow) {
                  if (mainWindow.isMinimized()) mainWindow.restore()
                  mainWindow.focus()
            }
      })
}
app.whenReady().then(async () => {
      session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const allowedPermissions = ["media", "mediaKeySystem", "display-capture", "fullscreen"]
            if (allowedPermissions.includes(permission)) {
                  console.log("[Permission] Granted:", permission)
                  callback(true)
            } else {
                  console.log("[Permission] Denied:", permission)
                  callback(false)
            }
      })
      session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                  // Grant access to the first screen found.
                  callback({ video: sources[0], audio: 'loopback' })
            }).catch((error) => {
                  console.error(error)
                  callback(null)
            })
      })
      session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
            const allowedPermissions = ["media", "mediaKeySystem", "display-capture", "fullscreen"]
            return allowedPermissions.includes(permission)
      })

      // Request microphone permission from OS before creating window (macOS)
      await requestMicrophonePermission()

      createWindow()
      registerIpcHandlers();
      createTray();
      globalShortcut.register('Alt+S', () => {
            console.log('Alt+S pressed - activating magic lens')
            ipcMain.emit('activate-magic-lens')
      })
      if (deferredDeeplinkUrl) {
            console.log('Processing deferred deeplink:', deferredDeeplinkUrl)
            handleDeeplink(deferredDeeplinkUrl)
            deferredDeeplinkUrl = null
      }
})
app.on("window-all-closed", () => {
      globalShortcut.unregisterAll()
      if (process.platform !== "darwin") {
            app.quit()
      }
})
app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
      }
})
async function checkPermissions() {
      const permissions = {
            microphone: "unknown",
            screen: "unknown",
      }
      if (process.platform === "darwin") {
            permissions.microphone = systemPreferences.getMediaAccessStatus("microphone")
            permissions.screen = systemPreferences.getMediaAccessStatus("screen")
      } else {
            permissions.microphone = "granted"
            permissions.screen = "granted"
      }
      return permissions
}
async function requestMicrophonePermission() {
      if (process.platform === "darwin") {
            const status = systemPreferences.getMediaAccessStatus("microphone")
            console.log("[Mic] Current permission status:", status)
            if (status === "not-determined") {
                  const granted = await systemPreferences.askForMediaAccess("microphone")
                  console.log("[Mic] Permission granted:", granted)
                  return granted ? "granted" : "denied"
            }
            return status
      }
      return "granted"
}
async function requestScreenPermission() {
      if (process.platform === "darwin") {
            const status = systemPreferences.getMediaAccessStatus("screen")
            if (status === "not-determined" || status === "denied") {
                  try {
                        await desktopCapturer.getSources({ types: ["screen", "window"] })
                  } catch (e) {
                        console.log("Screen permission request triggered")
                  }
                  return systemPreferences.getMediaAccessStatus("screen")
            }
            return status
      }
      return "granted"
}
function openSystemPreferences(type) {
      if (process.platform === "darwin") {
            if (type === "microphone") {
                  shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            } else if (type === "screen") {
                  shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            }
      }
}
ipcMain.on("record-audio", async (event, data) => {
      console.log("Record audio:", data.action)
      const { action } = data
      if (action === "start") {
            if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.hide()
            }
            await createOnRecordingWindow()
      }
})
ipcMain.on("realtime-time-record", (event, data) => {
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.webContents.send("update-record-time", data)
      }
})
ipcMain.on("recording-control", (event, data) => {
      console.log("Recording control:", data.action)
      if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("recording-control-update", data)
      }
      ipcMain.on("close-overlay", () => {
            closeOnRecordingWindow()
            if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.restore()
                  mainWindow.focus()
            }
      })
      if (data.action === "pause" && onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.webContents.send("recording-paused-state", { isPaused: true })
      }
      if (data.action === "resume" && onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.webContents.send("recording-paused-state", { isPaused: false })
      }
})
ipcMain.on("resize-recording-window", (event, { height }) => {
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            const { width } = onRecordingWindow.getBounds()
            onRecordingWindow.setSize(width, height)
            console.log(`Resized recording window to height: ${height}`)
      }
})
ipcMain.on("set-mic-device", (e, d) => {
      deviceId = d
      console.log("Mic changed to: ", d)
})
ipcMain.handle("set-mic-front", (e, d) => {
      return deviceId;
})
ipcMain.handle("isInitial", async (event, data) => {
      const status = await db.isAlreadyFile()
      await db.initializeDatabase()
      return status
})
ipcMain.on("step-changed", (event, data) => {
      console.log("Step changed:", data)
})
ipcMain.on("onboarding-complete", (event, data) => {
      console.log("Onboarding complete:", data)
})
ipcMain.on("request-permissions", async (event) => {
      console.log("Requesting permissions...")
      const micStatus = await requestMicrophonePermission()
      const screenStatus = await requestScreenPermission()
      const result = {
            microphone: micStatus,
            screen: screenStatus,
      }
      console.log("Permission results:", result)
      mainWindow.webContents.send("permissions-result", result)
})
ipcMain.handle("check-permissions", async () => {
      return await checkPermissions()
})
ipcMain.handle("request-microphone", async () => {
      return await requestMicrophonePermission()
})
ipcMain.handle("request-screen", async () => {
      return await requestScreenPermission()
})
ipcMain.handle("delete-db", async () => {
      console.log("Deleting database...")
      try {
            const result = await db.deleteDb();
            if (result.status === "success") {
                  setTimeout(() => {
                        app.exit();
                  }, 500);
                  return { success: true };
            }
            return { success: false, error: result.message };
      } catch (err) {
            console.error("Failed to delete db:", err);
            return { success: false, error: err.message };
      }
});
ipcMain.on("open-system-preferences", (event, type) => {
      openSystemPreferences(type)
})
ipcMain.on("activate-magic-lens", async () => {
      console.log("Activate Magic Lens")
      try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.hide()
            }
            if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
                  onRecordingWindow.hide()
            }
            console.log("Selection Window exists:", !!selectionWindow, selectionWindow ? !selectionWindow.isDestroyed() : "N/A")
            if (!selectionWindow || selectionWindow.isDestroyed()) {
                  console.log("Creating new selection window...")
                  await createSelectionWindow()
                  console.log("Selection window created, showing it...")
            } else {
                  console.log("Selection window already exists, updating bounds...")
                  const primaryDisplay = screen.getPrimaryDisplay()
                  const { x, y, width, height } = primaryDisplay.bounds
                  selectionWindow.setBounds({ x, y, width, height })
            }
            selectionWindow.show()
            selectionWindow.focus()
            console.log("Selection window should now be visible")
      } catch (e) {
            console.error("Error in activate-magic-lens:", e)
      }
})
ipcMain.on("selection-complete", (event, selection) => {
      console.log("Selection complete:", selection)
      if (selectionWindow && !selectionWindow.isDestroyed()) {
            selectionWindow.hide()
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("magic-lens-selection", selection)
      }
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            onRecordingWindow.show()
            onRecordingWindow.focus()
            onRecordingWindow.setAlwaysOnTop(true)
      } else {
            createOnRecordingWindow();
      }
})
ipcMain.on("open-overlay", async () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.hide()
      }
      if (!onRecordingWindow || onRecordingWindow.isDestroyed()) {
            await createOnRecordingWindow()
      } else {
            onRecordingWindow.show()
            onRecordingWindow.focus()
      }
})
ipcMain.on("close-overlay", () => {
      closeOnRecordingWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.setSkipTaskbar(false)
            mainWindow.focus()
      }
})
ipcMain.on("resize-recording-window", (event, { width, height }) => {
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            const primaryDisplay = screen.getPrimaryDisplay()
            const { width: screenWidth } = primaryDisplay.workAreaSize
            const currentBounds = onRecordingWindow.getBounds()
            const newWidth = width || currentBounds.width
            const newHeight = height || currentBounds.height
            const newX = Math.floor((screenWidth - newWidth) / 2)
            onRecordingWindow.setBounds({
                  x: newX,
                  y: 0,
                  width: newWidth,
                  height: newHeight
            }, true)
      }
})
ipcMain.on("set-ignore-mouse", (event, data) => {
      const ignore = data?.ignore ?? true
      if (onRecordingWindow && !onRecordingWindow.isDestroyed()) {
            if (ignore) {
                  onRecordingWindow.setIgnoreMouseEvents(true, { forward: true })
            } else {
                  onRecordingWindow.setIgnoreMouseEvents(false)
            }
      }
})
ipcMain.handle("request-sizeCache", async (event) => {
      var size = await db.getSizeOfdb()
      var maxCacheSize = 2 * 1024 * 1024 * 1024
      var percent = (size / maxCacheSize) * 100
      percent = percent.toFixed(2)
      size = size.toFixed(2)
      var status = {
            status: "",
            percent,
            size,
      }
      if (percent > 100) {
            status.status = "danger"
      } else if (percent >= 50 && percent <= 70) {
            status.status = "warning"
      } else {
            status.status = "emerald"
      }
      console.log(status)
      return status
})
ipcMain.handle("get-screen-sources", async () => {
      try {
            const sources = await desktopCapturer.getSources({
                  types: ["screen", "window"],
                  thumbnailSize: { width: 150, height: 150 },
            })
            console.log("Sources:", sources)
            return sources.map(source => ({
                  id: source.id,
                  name: source.name,
                  thumbnail: source.thumbnail.toDataURL(),
            }))
      } catch (e) {
            console.error("Failed to get screen sources:", e)
            return []
      }
})
ipcMain.on("app-minimize", () => {
      mainWindow?.minimize()
})
ipcMain.on("app-maximize", () => {
      if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize()
      } else {
            mainWindow?.maximize()
      }
})
ipcMain.on("app-close", () => {
      mainWindow?.close()
})
ipcMain.handle("get-settings", async () => {
      return {
            language: "en",
            theme: "dark",
      }
})
ipcMain.handle("save-settings", async (event, settings) => {
      console.log("Saving settings:", settings)
      return true
})
ipcMain.handle("get-system-info", async () => {
      return {
            platform: process.platform,
            arch: process.arch,
            version: app.getVersion(),
      }
})