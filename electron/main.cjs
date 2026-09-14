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

function mensagemDe(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Leitura. Somente leitura de verdade.
 *
 * A consulta roda dentro de uma transação READ ONLY, então é o próprio
 * PostgreSQL que recusa INSERT, UPDATE, DELETE e DDL. Antes disso o canal
 * aceitava escrita — o "somente leitura" era um comentário, não uma barreira,
 * e um teste confirmou que um INSERT passava.
 *
 * A alternativa seria inspecionar o texto do SQL, mas isso é adivinhação:
 * comentários, CTEs e `;` encadeado derrubam qualquer regra de texto. Deixar o
 * banco decidir não tem como ser contornado.
 */
ipcMain.handle('db:query', async (_event, sql, params) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return { ok: true, rows: redigirSegredos(result.rows) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, error: mensagemDe(error) };
  } finally {
    client.release();
  }
});

/**
 * Escrita. Canal separado, e sempre em transação.
 *
 * Recebe uma lista de comandos aplicados juntos: ou todos valem, ou nenhum. Um
 * único comando é o caso comum, mas a correção de uma NFC-e altera a nota e os
 * itens ao mesmo tempo — gravar metade disso é pior que não gravar.
 *
 * A separação em dois canais é o que torna a leitura auditável: qualquer código
 * que pretenda alterar dados precisa pedir por aqui, explicitamente.
 */
ipcMain.handle('db:execute', async (_event, statements) => {
  if (!Array.isArray(statements) || statements.length === 0) {
    return { ok: false, error: 'Nenhum comando para executar.' };
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const rowCounts = [];
    for (const statement of statements) {
      const result = await client.query(statement.sql, statement.params ?? []);
      rowCounts.push(result.rowCount ?? 0);
    }
    await client.query('COMMIT');
    return { ok: true, rowCounts };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, error: mensagemDe(error) };
  } finally {
    client.release();
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
