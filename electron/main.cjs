'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });

let pool = null;

/** Cria o pool sob demanda. Falha alto se faltar configuração. */
function getPool() {
  if (pool) return pool;
  const { PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD } = process.env;
  if (!PG_HOST || !PG_DATABASE || !PG_USER) {
    throw new Error('PG_HOST, PG_DATABASE e PG_USER são obrigatórios no .env');
  }
  const { Pool } = require('pg');
  pool = new Pool({
    host: PG_HOST,
    port: Number(PG_PORT ?? 5432),
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

// Única porta de entrada a dados no modo local. Somente leitura nesta fatia.
ipcMain.handle('db:query', async (_event, sql, params) => {
  try {
    const result = await getPool().query(sql, params);
    return { ok: true, rows: result.rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0B1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Fora do pacote, carrega o servidor de desenvolvimento; empacotado, os
  // arquivos gerados. `app.isPackaged` é do próprio Electron — evita depender
  // de variável de ambiente com sintaxe específica de shell.
  const devServer =
    process.env.VITE_DEV_SERVER_URL ?? (app.isPackaged ? null : 'http://localhost:8080');

  if (devServer) window.loadURL(devServer);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
