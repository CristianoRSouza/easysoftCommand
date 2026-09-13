'use strict';

// Superfície mínima exposta ao renderer. Só cresce quando um módulo novo
// precisar — nunca "por precaução".
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
});
