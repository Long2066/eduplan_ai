const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_DEV_URL = "http://localhost:3000";

function readPackagedConfig() {
  const configPath = app.isPackaged
    ? path.join(process.resourcesPath, "app-config.json")
    : path.join(__dirname, "app-config.json");

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function getAppUrl() {
  if (!app.isPackaged) {
    return process.env.EDUPLAN_APP_URL || DEFAULT_DEV_URL;
  }

  const config = readPackagedConfig();
  return process.env.EDUPLAN_APP_URL || config.appUrl || "";
}

function isAllowedNavigation(targetUrl, appUrl) {
  try {
    const target = new URL(targetUrl);
    const appOrigin = new URL(appUrl).origin;

    return target.origin === appOrigin;
  } catch {
    return false;
  }
}

function createWindow() {
  const appUrl = getAppUrl();
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "icon.png");

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "EduPlan AI",
    icon: iconPath,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (appUrl && isAllowedNavigation(url, appUrl)) {
      return { action: "allow" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!appUrl || !isAllowedNavigation(url, appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const loadPromise = appUrl
    ? win.loadURL(appUrl)
    : win.loadFile(path.join(__dirname, "offline.html"));

  loadPromise.catch(() => {
    win.loadFile(path.join(__dirname, "offline.html"));
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
