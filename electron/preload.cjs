'use strict';

// Superfície mínima exposta ao renderer. Só cresce quando um módulo novo
// precisar — nunca "por precaução".
//
// Leitura e escrita são canais separados de propósito: `query` roda em
// transação READ ONLY e o banco recusa alteração; quem precisa gravar chama
// `execute` explicitamente. Assim dá para auditar quem escreve procurando por
// uma palavra só.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  execute: (statements) => ipcRenderer.invoke('db:execute', statements),
});
