const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("eduplanDesktop", {
  platform: process.platform,
});
