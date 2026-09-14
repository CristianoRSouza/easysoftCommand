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

/**
 * Colunas de segredo que nunca podem chegar ao renderer.
 *
 * No banco elas existem em duas formas: cifrada (`*_encrypted`, o que o
 * Sync-Service grava) e em claro (herança do formato antigo). A versão em claro
 * não serve ao painel e não deve sair do processo principal.
 *
 * A lista é de COLUNAS, não de tabelas, e é conferida em toda consulta. Filtrar
 * por tabela obriga a lembrar de cada uma que guarda segredo — e esquecer uma é
 * fácil: o emitente estava protegido, o totem não estava, e os dois guardam
 * token da Aditum em claro.
 */
const COLUNAS_SECRETAS = [
  'aditum_tef_partner_token',
  'aditum_tef_activation_code',
  'aditum_partner_token',
  'aditum_activation_code',
  'apikey_easyerp',
  'nfce_service_api_key',
  'tef_http_api_key',
  'pix_http_api_key',
  'certificate_password',
];

/**
 * Rede de proteção.
 *
 * Os repositórios listam as colunas uma a uma e nunca pedem estas — não pedir é
 * mais forte que apagar depois. Mas `db:query` recebe SQL arbitrário, e basta
 * um `SELECT *` futuro para o segredo vazar. A redação aqui é o que garante a
 * invariante mesmo quando alguém esquecer.
 *
 * As variantes `*_encrypted` passam de propósito: são cifradas, e o painel
 * precisa delas para saber se a integração está configurada.
 */
function redigirSegredos(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    let copia = null;
    for (const coluna of COLUNAS_SECRETAS) {
      if (coluna in row) {
        copia = copia ?? { ...row };
        delete copia[coluna];
      }
    }
    return copia ?? row;
  });
}

// Única porta de entrada a dados no modo local. Somente leitura nesta fatia.
ipcMain.handle('db:query', async (_event, sql, params) => {
  try {
    const result = await getPool().query(sql, params);
    return { ok: true, rows: redigirSegredos(result.rows) };
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
