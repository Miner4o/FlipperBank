'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe, minimal context bridge exposing window controls and Flipper Bank API
contextBridge.exposeInMainWorld('api', {
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
    close: () => ipcRenderer.send('win:close'),
    onMaximized: (cb) => {
      const subscription = (_e, isMax) => cb(isMax);
      ipcRenderer.on('win:maximized', subscription);
      return () => ipcRenderer.removeListener('win:maximized', subscription);
    }
  },
  db: {
    init: (dbPath) => ipcRenderer.invoke('db:init', dbPath),
    getAccount: (cardId) => ipcRenderer.invoke('db:getAccount', cardId),
    transaction: (fromCardId, toCardId, amount) => ipcRenderer.invoke('db:transaction', fromCardId, toCardId, amount),
  },
  uart: {
    open: (portName) => ipcRenderer.invoke('uart:open', portName),
    close: () => ipcRenderer.invoke('uart:close'),
    scanCard: () => ipcRenderer.invoke('uart:scanCard'),
    isSimulated: () => ipcRenderer.invoke('uart:isSimulated'),
  }
});
