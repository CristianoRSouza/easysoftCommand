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
 * Padrões de nome que denunciam uma coluna de segredo.
 *
 * É uma regra, não uma lista. Três tentativas ensinaram por quê: primeiro a
 * proteção era por tabela e só cobria o emitente — o totem vazava. Virou lista
 * de colunas e cobriu os dois — o PIXnoPDV vazava. Lista é lista: sempre falta
 * uma, e quem acrescenta uma tabela nova não vai lembrar de vir aqui.
 *
 * Com padrão, uma coluna nova chamada `qualquer_coisa_token` já nasce coberta.
 */
const PADROES_SECRETOS = [/token/i, /secret/i, /password/i, /senha/i, /api_?key/i, /activation_code/i];

/**
 * Sufixos que podem passar apesar de casarem com os padrões.
 *
 * `*_encrypted` é o valor cifrado, e `*_set` / `*_kid` são metadados. O painel
 * precisa deles para dizer se a integração está configurada — e nenhum revela
 * o segredo.
 */
const SUFIXOS_PERMITIDOS = [/_encrypted$/i, /_set$/i, /_kid$/i, /_prefix$/i];

function ehColunaSecreta(nome) {
  if (SUFIXOS_PERMITIDOS.some((sufixo) => sufixo.test(nome))) return false;
  return PADROES_SECRETOS.some((padrao) => padrao.test(nome));
}

/**
 * Rede de proteção.
 *
 * Os repositórios listam as colunas uma a uma e nunca pedem segredo — não pedir
 * é mais forte que apagar depois. Mas `db:query` recebe SQL arbitrário, e basta
 * um `SELECT *` futuro para vazar. A redação aqui é o que garante a invariante
 * mesmo quando alguém esquecer.
 */
function redigirSegredos(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  // As linhas de um resultado têm as mesmas colunas: decidir uma vez basta.
  const primeira = rows.find((row) => row && typeof row === 'object');
  if (!primeira) return rows;

  const aRemover = Object.keys(primeira).filter(ehColunaSecreta);
  if (aRemover.length === 0) return rows;

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const copia = { ...row };
    for (const coluna of aRemover) delete copia[coluna];
    return copia;
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
