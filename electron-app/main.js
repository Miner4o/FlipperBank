'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

// Force crisp pixel snapping and disable subpixel antialiasing at the engine level
app.commandLine.appendSwitch('disable-font-subpixel-positioning');

let mainWindow = null;
let isSimulatedMode = false;
let dbLoaded = false;
let uartOpened = false;

// Mock database state path
const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');
let mockDatabase = {
  "FLIP_CARD_001": { card_id: "FLIP_CARD_001", holder_name: "John Doe", balance: 150.00, is_active: 1 },
  "FLIP_CARD_002": { card_id: "FLIP_CARD_002", holder_name: "Alice Smith", balance: 1420.50, is_active: 1 },
  "FLIP_CARD_003": { card_id: "FLIP_CARD_003", holder_name: "Bob Johnson", balance: 0.75, is_active: 1 },
  "FLIP_CARD_004": { card_id: "FLIP_CARD_004", holder_name: "Charlie Brown", balance: 999.00, is_active: 0 }
};

// Ensure mock DB file exists
function loadMockDatabase() {
  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      const data = fs.readFileSync(MOCK_DB_PATH, 'utf8');
      mockDatabase = JSON.parse(data);
    } else {
      saveMockDatabase();
    }
  } catch (err) {
    console.error("Error reading mock database:", err);
  }
}

function saveMockDatabase() {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(mockDatabase, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing mock database:", err);
  }
}

// C DLL bindings (will load if dependencies and DLL are present)
let ffi = null;
let ref = null;
let dll = null;
let AccountStruct = null;
let AccountPtr = null;

const DLL_PATHS = [
  path.join(__dirname, '..', 'app-core-c', 'bank_core.dll'),
  path.join(__dirname, 'bank_core.dll'),
  path.join(__dirname, 'bin', 'bank_core.dll')
];

function tryLoadDLL() {
  try {
    // Try importing dependencies
    ffi = require('ffi-napi');
    ref = require('ref-napi');
    const StructType = require('ref-struct-di')(ref);

    // Find if the DLL actually exists
    let dllPath = null;
    for (const p of DLL_PATHS) {
      if (fs.existsSync(p)) {
        dllPath = p;
        break;
      }
    }

    if (!dllPath) {
      console.warn("bank_core.dll not found in search paths. Starting in Simulated Mode.");
      isSimulatedMode = true;
      return;
    }

    console.log(`Found bank_core.dll at: ${dllPath}. Loading...`);

    // Define the Account structure (matching C: Account struct)
    AccountStruct = StructType({
      card_id: ref.types.charArray(64),
      holder_name: ref.types.charArray(128),
      balance: ref.types.double,
      is_active: ref.types.int
    });
    AccountPtr = ref.refType(AccountStruct);

    // Declare DLL function signatures
    dll = ffi.Library(dllPath, {
      'bank_core_init': ['int', ['string']],
      'bank_core_close': ['int', []],
      'bank_core_get_account': ['int', ['string', AccountPtr]],
      'bank_core_transaction': ['int', ['string', 'string', 'double']],
      'flipper_uart_open': ['int', ['string']],
      'flipper_uart_close': ['int', []],
      'flipper_uart_scan_card': ['int', [ref.refType(ref.types.char), 'int']]
    });

    console.log("Successfully bound to bank_core.dll!");
  } catch (e) {
    console.warn("Failed to load ffi-napi, ref-napi, or DLL. Starting in Simulated Mode.", e.message);
    isSimulatedMode = true;
  }
}

// Initialize DLL/Mock state
tryLoadDLL();
if (isSimulatedMode) {
  loadMockDatabase();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 640,
    minWidth: 600,
    minHeight: 460,
    frame: false, // Frameless design
    backgroundColor: '#ffffff',
    title: 'Flipper Bank Terminal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Handle window zoom shortcuts
  const wc = mainWindow.webContents;
  const clampZoom = (z) => Math.min(3, Math.max(0.5, z));
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control) return;
    if (input.key === '=' || input.key === '+') {
      wc.setZoomFactor(clampZoom(wc.getZoomFactor() + 0.1));
      event.preventDefault();
    } else if (input.key === '-') {
      wc.setZoomFactor(clampZoom(wc.getZoomFactor() - 0.1));
      event.preventDefault();
    } else if (input.key === '0') {
      wc.setZoomFactor(1.0);
      event.preventDefault();
    }
  });

  // Share maximize state with the renderer
  const sendMaximized = () => wc.send('win:maximized', mainWindow.isMaximized());
  mainWindow.on('maximize', sendMaximized);
  mainWindow.on('unmaximize', sendMaximized);
}

// Electron Window lifecycle IPCs
ipcMain.on('win:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('win:toggleMaximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('win:close', () => {
  if (mainWindow) mainWindow.close();
});

// Database IPC Handlers
ipcMain.handle('db:init', async (event, dbPath) => {
  if (isSimulatedMode) {
    dbLoaded = true;
    return { ok: true, mode: 'simulated' };
  }

  try {
    const res = dll.bank_core_init(dbPath || "bank.db");
    if (res === 1) {
      dbLoaded = true;
      return { ok: true, mode: 'native' };
    }
    return { ok: false, error: 'DLL database initialization failed' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('db:getAccount', async (event, cardId) => {
  if (isSimulatedMode) {
    loadMockDatabase(); // Reload latest state
    const acc = mockDatabase[cardId];
    if (acc) {
      return { ok: true, account: { ...acc } };
    }
    return { ok: false, error: 'Account not found' };
  }

  try {
    // Allocate Account struct in memory
    const account = new AccountStruct();
    const res = dll.bank_core_get_account(cardId, account.ref());
    if (res === 1) {
      // Decode C-strings
      const id = account.card_id.toString().replace(/\u0000/g, '').trim();
      const name = account.holder_name.toString().replace(/\u0000/g, '').trim();
      return {
        ok: true,
        account: {
          card_id: id,
          holder_name: name,
          balance: account.balance,
          is_active: account.is_active
        }
      };
    }
    return { ok: false, error: 'Account not found in DLL database' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('db:transaction', async (event, fromCardId, toCardId, amount) => {
  if (isSimulatedMode) {
    loadMockDatabase();
    const fromAcc = mockDatabase[fromCardId];
    const toAcc = mockDatabase[toCardId];

    if (!fromAcc) return { ok: false, error: `Sender account (${fromCardId}) not found` };
    if (!toAcc) return { ok: false, error: `Receiver account (${toCardId}) not found` };
    if (fromAcc.is_active !== 1) return { ok: false, error: `Sender account is suspended` };
    if (toAcc.is_active !== 1) return { ok: false, error: `Receiver account is suspended` };
    if (fromAcc.balance < amount) return { ok: false, error: `Insufficient funds (Balance: $${fromAcc.balance.toFixed(2)})` };
    if (amount <= 0) return { ok: false, error: `Amount must be greater than zero` };

    fromAcc.balance -= amount;
    toAcc.balance += amount;
    saveMockDatabase();

    return { ok: true, transaction: { from: fromCardId, to: toCardId, amount } };
  }

  try {
    const res = dll.bank_core_transaction(fromCardId, toCardId, parseFloat(amount));
    if (res === 1) {
      return { ok: true };
    }
    return { ok: false, error: 'DLL Transaction failed (insufficient funds or database error)' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// UART IPC Handlers
ipcMain.handle('uart:open', async (event, portName) => {
  if (isSimulatedMode) {
    uartOpened = true;
    return { ok: true, mode: 'simulated' };
  }

  try {
    const res = dll.flipper_uart_open(portName || "COM3");
    if (res === 1) {
      uartOpened = true;
      return { ok: true, mode: 'native' };
    }
    return { ok: false, error: `Failed to open COM port ${portName}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('uart:close', async (event) => {
  if (isSimulatedMode) {
    uartOpened = false;
    return { ok: true };
  }

  try {
    const res = dll.flipper_uart_close();
    uartOpened = false;
    return { ok: res === 1 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('uart:scanCard', async (event) => {
  if (isSimulatedMode) {
    // In simulated mode, we let the frontend resolve simulation mock selection.
    // However, we still return OK to indicate we are ready.
    return { ok: true, mode: 'simulated' };
  }

  try {
    // Allocate a buffer of 64 bytes for output string
    const buf = Buffer.alloc(64);
    const res = dll.flipper_uart_scan_card(buf, 64);
    if (res === 1) {
      const cardId = ref.readCString(buf, 0);
      return { ok: true, card_id: cardId };
    }
    return { ok: false, error: 'Scan timed out or serial transmission error' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('uart:isSimulated', async (event) => {
  return isSimulatedMode;
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!isSimulatedMode && dll) {
      try {
        dll.bank_core_close();
      } catch (err) {
        console.error("Error closing dll:", err);
      }
    }
    app.quit();
  }
});
