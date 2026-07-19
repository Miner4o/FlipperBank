'use strict';

// Global state variables
let currentAccount = null;
let pendingScanResolve = null;
let isSimulationMode = false;
let currentPin = '';

// DOM Elements
const pages = {
  lock: document.getElementById('lockPage'),
  login: document.getElementById('loginPage'),
  menu: document.getElementById('mainMenuPage'),
  balance: document.getElementById('balancePage'),
  payment: document.getElementById('paymentPage'),
  transaction: document.getElementById('transactionPage')
};

const topbar = {
  statusDot: document.querySelector('.status-dot'),
  statusText: document.getElementById('status-text'),
  winMin: document.getElementById('win-min'),
  winMax: document.getElementById('win-max'),
  winClose: document.getElementById('win-close')
};

// ==================== WINDOW CONTROLS ====================
topbar.winMin.addEventListener('click', () => window.api.win.minimize());
topbar.winMax.addEventListener('click', () => window.api.win.toggleMaximize());
topbar.winClose.addEventListener('click', () => window.api.win.close());

// Handle maximize icon toggle
window.api.win.onMaximized((isMax) => {
  const icoMax = topbar.winMax.querySelector('.ico-max');
  const icoRestore = topbar.winMax.querySelector('.ico-restore');
  if (isMax) {
    icoMax.setAttribute('hidden', 'true');
    icoRestore.removeAttribute('hidden');
  } else {
    icoRestore.setAttribute('hidden', 'true');
    icoMax.removeAttribute('hidden');
  }
});

// ==================== PLAYSTATION WAVE CANVAS ANIMATION ====================
const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
let dpr = window.devicePixelRatio || 1;
let width = window.innerWidth;
let height = window.innerHeight;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  
  width = rect.width;
  height = rect.height;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Fine float time increment for absolute smooth continuous flow (mimicking PS3/PS4)
let time = 0;

function animateWaves() {
  ctx.clearRect(0, 0, width, height);

  // Background base gradient (very soft white to light gray)
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(1, '#fafafa');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Micro-step increments for smooth 60fps ribbon drifts
  time += 0.005;

  // Draw Playstation ribbon waves
  // Wave 1 (Filled translucent ribbon)
  drawRibbon(time, 0.0014, height * 0.48, 75, 'rgba(255, 138, 0, 0.05)', 'rgba(255, 90, 0, 0.002)', true);
  
  // Wave 2 (Second filled translucent ribbon, out of phase)
  drawRibbon(time * 1.3 + 2.0, 0.0009, height * 0.54, 90, 'rgba(255, 170, 0, 0.04)', 'rgba(255, 138, 0, 0.001)', true);
  
  // Wave 3 (Thin vector lines for neon PlayStation ribbon glow)
  drawRibbon(time * 1.1, 0.0022, height * 0.44, 55, 'rgba(255, 138, 0, 0.12)', null, false, 2.5);
  drawRibbon(time * 0.8 + 1.5, 0.0010, height * 0.50, 110, 'rgba(255, 100, 0, 0.08)', null, false, 1.5);
  drawRibbon(time * 1.5 + 4.0, 0.0016, height * 0.56, 75, 'rgba(255, 210, 0, 0.15)', null, false, 1.0);

  requestAnimationFrame(animateWaves);
}

/**
 * Helper to draw a drifting sine/bezier wave
 */
function drawRibbon(t, freq, midY, amp, colorStart, colorEnd, isFilled, lineWidth = 1) {
  ctx.beginPath();
  
  if (isFilled) {
    ctx.moveTo(0, height);
    ctx.lineTo(0, midY);
  } else {
    ctx.lineWidth = lineWidth;
    ctx.moveTo(0, midY + Math.sin(t) * amp);
  }

  // Draw wave with fine line steps
  for (let x = 0; x <= width; x += 10) {
    const angle = x * freq + t;
    // Overlapping harmonics for natural floating ribbon motion
    const y = midY + Math.sin(angle) * amp + Math.cos(angle * 0.35 - t * 0.6) * (amp * 0.22);
    ctx.lineTo(x, y);
  }

  if (isFilled) {
    ctx.lineTo(width, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.fill();
  } else {
    ctx.strokeStyle = colorStart;
    ctx.stroke();
  }
}

// Start wave rendering loop
animateWaves();

// ==================== PAGE MANAGER ====================
function showPage(pageId) {
  Object.keys(pages).forEach(key => {
    if (key === pageId) {
      pages[key].classList.add('active');
    } else {
      pages[key].classList.remove('active');
    }
  });
}

// ==================== PASSCODE LOCK SCREEN CONTROLLER ====================
const pinDotsText = document.getElementById('pin-dots');

function updatePinDisplay() {
  const display = [];
  for (let i = 0; i < 4; i++) {
    if (i < currentPin.length) {
      display.push('*');
    } else {
      display.push('_');
    }
  }
  pinDotsText.textContent = display.join(' ');
}

// Initialize PIN display empty lines on load
updatePinDisplay();

// Keypad click handlers
document.querySelectorAll('.keypad-btn[data-val]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentPin.length < 4) {
      currentPin += btn.getAttribute('data-val');
      updatePinDisplay();
      // Auto-unlock if 4 digits are entered
      if (currentPin.length === 4) {
        setTimeout(verifyPasscode, 150);
      }
    }
  });
});

document.getElementById('keypad-clear').addEventListener('click', () => {
  currentPin = '';
  updatePinDisplay();
});

document.getElementById('keypad-enter').addEventListener('click', () => {
  verifyPasscode();
});

async function verifyPasscode() {
  if (currentPin === '1234') {
    // Unlocked successfully
    currentPin = '';
    updatePinDisplay();
    showPage('login');
  } else {
    await modalAlert("ACCESS DENIED: INCORRECT PASSCODE.", "SECURITY ERROR", "warning");
    currentPin = '';
    updatePinDisplay();
  }
}

// Support keyboard PIN entry
window.addEventListener('keydown', (e) => {
  // Only intercept on lockPage
  if (!pages.lock.classList.contains('active')) return;

  if (e.key >= '0' && e.key <= '9') {
    if (currentPin.length < 4) {
      currentPin += e.key;
      updatePinDisplay();
      if (currentPin.length === 4) {
        setTimeout(verifyPasscode, 150);
      }
    }
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    currentPin = '';
    updatePinDisplay();
  } else if (e.key === 'Enter') {
    verifyPasscode();
  }
});

// ==================== LOGIN ADMIN/USER SWITCHING ====================
// (Removed non-existent admin/user view toggling elements)


// ==================== CARD SCANNER SIMULATION MODAL ====================
const scannerModal = document.getElementById('scannerModal');
const manualCardInput = document.getElementById('manual-card-id-input');

function openScanModal() {
  scannerModal.classList.add('active');
  manualCardInput.value = '';
  return new Promise((resolve) => {
    pendingScanResolve = resolve;
  });
}

function closeScanModal(scannedCardId = null) {
  scannerModal.classList.remove('active');
  if (pendingScanResolve) {
    pendingScanResolve(scannedCardId);
    pendingScanResolve = null;
  }
}

// Handle clicking mock card buttons in simulation modal
document.querySelectorAll('.sim-scan-card-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cardId = btn.getAttribute('data-card');
    closeScanModal(cardId);
  });
});

// Handle submitting custom card ID manually
document.getElementById('manualScanSubmitBtn').addEventListener('click', () => {
  const val = manualCardInput.value.trim();
  if (val) {
    closeScanModal(val);
  }
});

// Allow Enter key inside manual input
manualCardInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = manualCardInput.value.trim();
    if (val) closeScanModal(val);
  }
});

// Cancel scanning
document.getElementById('cancelScanBtn').addEventListener('click', () => {
  closeScanModal(null);
});

// ==================== CUSTOM GENERIC MODAL CONTROLLERS ====================
const ICON_MAP = {
  warning: '../../assets/warning.png',
  warning2: '../../assets/warning2.png',
  done: '../../assets/done.png',
  saved: '../../assets/saved.png',
  reading: '../../assets/reading.png',
  admin: '../../assets/admin.png'
};

function showModal({ title = '', body = '', input = null, fields = null, buttons = [], icon = '' }) {
  if (window.api && window.api.log) window.api.log("showModal called with title: " + title);
  return new Promise((resolve) => {
    const overlay = document.getElementById('customModalOverlay');
    const modalTitle = document.getElementById('customModalTitle');
    const modalBody = document.getElementById('customModalBody');
    const iconContainer = document.getElementById('customModalIconContainer');
    const iconImg = document.getElementById('customModalIcon');
    const inputWrap = document.getElementById('customModalInputWrap');
    const inputEl = document.getElementById('customModalInput');
    const dynamicContent = document.getElementById('customModalDynamicContent');
    const btnBox = document.getElementById('customModalButtons');

    // Title & Body
    modalTitle.textContent = title;
    modalBody.textContent = body;

    // Icon setup
    const iconPath = ICON_MAP[icon] || icon;
    if (iconPath) {
      iconImg.src = iconPath;
      iconContainer.style.display = 'flex';
    } else {
      iconContainer.style.display = 'none';
      iconImg.src = '';
    }

    // Input wrap
    if (input) {
      inputWrap.style.display = 'block';
      inputEl.type = input.type || 'text';
      inputEl.value = input.defaultValue || '';
      if (input.placeholder) {
        inputEl.placeholder = input.placeholder;
      } else {
        inputEl.placeholder = '';
      }
      setTimeout(() => inputEl.focus(), 50);
    } else {
      inputWrap.style.display = 'none';
    }

    // Dynamic fields content
    if (fields) {
      dynamicContent.style.display = 'block';
      dynamicContent.innerHTML = '';
      fields.forEach(f => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.style.marginBottom = '12px';
        fieldDiv.style.textAlign = 'left';

        const label = document.createElement('label');
        label.className = 'pixel-font';
        label.style.color = 'var(--flipper-orange)';
        label.style.fontSize = '16px';
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '6px';
        label.textContent = f.label;

        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';

        const inputField = document.createElement('input');
        inputField.id = f.id;
        inputField.className = 'pixel-input pixel-font';
        inputField.type = f.type || 'text';
        inputField.placeholder = f.placeholder || '';
        inputField.value = f.defaultValue || '';
        if (f.step) inputField.step = f.step;
        if (f.min) inputField.min = f.min;

        inputContainer.appendChild(inputField);
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(inputContainer);
        dynamicContent.appendChild(fieldDiv);
      });
      const firstInput = dynamicContent.querySelector('input');
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    } else {
      dynamicContent.style.display = 'none';
      dynamicContent.innerHTML = '';
    }

    // Cleanup and Resolve
    const close = (result) => {
      overlay.style.display = 'none';
      inputEl.onkeydown = null;
      resolve(result);
    };

    // Button generation
    btnBox.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.className = b.className || (b.value === false || b.value === null ? 'pixel-btn-secondary pixel-font' : 'pixel-btn-action pixel-font');
      el.textContent = b.label;
      el.onclick = () => {
        if (b.value === '$input') {
          if (fields) {
            const data = {};
            fields.forEach(f => {
              const elVal = document.getElementById(f.id);
              data[f.id] = elVal ? elVal.value : '';
            });
            close(data);
          } else {
            close(inputEl.value);
          }
        } else {
          close(b.value);
        }
      };
      btnBox.appendChild(el);
    });

    // Keyboard handlers
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        close(inputEl.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      }
    };

    // Make visible
    overlay.style.display = 'flex';
  });
}

const modalAlert = (body, title = 'ALERT', icon = 'warning') =>
  showModal({
    title,
    body,
    icon,
    buttons: [{ label: '[ OK ]', value: true }]
  });

const modalConfirm = (body, title = 'CONFIRMATION', icon = 'warning') =>
  showModal({
    title,
    body,
    icon,
    buttons: [
      { label: '[ YES ]', value: true },
      { label: '[ NO ]', value: false }
    ]
  });

const modalPrompt = (body, title = 'PROMPT', type = 'text', defaultValue = '', icon = 'reading') =>
  showModal({
    title,
    body,
    icon,
    input: { type, defaultValue },
    buttons: [
      { label: '[ OK ]', value: '$input' },
      { label: '[ CANCEL ]', value: null }
    ]
  });

// ==================== HARDWARE COMM & SCAN LOGIC ====================
async function scanHardwareCard() {
  if (isSimulationMode) {
    // Open the mock overlay select dialog
    return await openScanModal();
  } else {
    // Show the custom modal message box using the reading.png icon
    let cancelScan = false;
    
    const modalPromise = showModal({
      title: "SCAN NFC CARD",
      body: "WAVE FLIPPER ZERO NEAR THE RFID READER\n\nQuerying serial COM port...",
      icon: "reading",
      buttons: [
        { label: "[ CANCEL ]", value: null }
      ]
    }).then(result => {
      cancelScan = true;
      return null;
    });

    const scanPromise = (async () => {
      try {
        const res = await window.api.uart.scanCard();
        if (cancelScan) return null;
        
        // Close the modal
        document.getElementById('customModalOverlay').style.display = 'none';
        
        if (res.ok) {
          return res.card_id;
        } else {
          await modalAlert("Scan Failed: " + res.error, "SCAN ERROR", "warning");
          return null;
        }
      } catch (err) {
        if (cancelScan) return null;
        document.getElementById('customModalOverlay').style.display = 'none';
        await modalAlert("Error scanning card: " + err.message, "SCAN ERROR", "warning");
        return null;
      }
    })();

    return await Promise.race([modalPromise, scanPromise]);
  }
}

// ==================== APP INITS & CONNECTION STATE ====================
async function initializeApp() {
  // Check if we are running in simulated or native mode
  isSimulationMode = await window.api.uart.isSimulated();
  
  // Set pointer cursors
  document.getElementById('simulated-badge').style.cursor = 'pointer';
  document.getElementById('connection-status').style.cursor = 'pointer';
  
  if (isSimulationMode) {
    document.getElementById('simulated-badge').style.display = 'block';
    
    // Initialize mock database and UART
    await window.api.db.init("");
    const uartRes = await window.api.uart.open("MOCK_COM");
    
    if (uartRes.ok) {
      const connStatus = document.getElementById('connection-status');
      connStatus.className = 'status-online';
      topbar.statusText.textContent = "SIMULATED";
    }
  } else {
    // Attempt standard initialization of SQLite Database & UART Serial COM3
    const dbRes = await window.api.db.init("bank.db");
    const uartRes = await window.api.uart.open("COM3");
    
    const connStatus = document.getElementById('connection-status');
    if (dbRes.ok && uartRes.ok) {
      connStatus.className = 'status-online';
      topbar.statusText.textContent = "ONLINE (COM3)";
    } else {
      connStatus.className = 'status-offline';
      topbar.statusText.textContent = "COM ERROR";
      console.error("Native Init Error: DB:", dbRes, "UART:", uartRes);
    }
  }
}

async function promptComPortSelection() {
  if (window.api && window.api.log) window.api.log("promptComPortSelection called!");
  const selectedPort = await showModal({
    title: "SELECT COM PORT",
    body: "Choose the serial port to establish native communication with your Flipper Zero, or choose MOCK_COM to run in Simulated Mode.",
    icon: "reading",
    buttons: [
      { label: "[ COM1 ]", value: "COM1" },
      { label: "[ COM2 ]", value: "COM2" },
      { label: "[ COM3 ]", value: "COM3" },
      { label: "[ COM4 ]", value: "COM4" },
      { label: "[ MOCK_COM ]", value: "MOCK_COM" },
      { label: "[ CANCEL ]", value: null }
    ]
  });

  if (!selectedPort) return;

  const connStatus = document.getElementById('connection-status');
  connStatus.className = 'status-offline';
  topbar.statusText.textContent = "CONNECTING...";

  try {
    const uartRes = await window.api.uart.open(selectedPort);
    if (uartRes.ok) {
      if (selectedPort === "MOCK_COM" || uartRes.mode === 'simulated') {
        isSimulationMode = true;
        document.getElementById('simulated-badge').style.display = 'block';
        connStatus.className = 'status-online';
        topbar.statusText.textContent = "SIMULATED";
        await modalAlert("Switched to Simulated Mode successfully.", "CONNECTED", "done");
      } else {
        // Native mode
        const dbRes = await window.api.db.init("bank.db");
        if (dbRes.ok) {
          isSimulationMode = false;
          document.getElementById('simulated-badge').style.display = 'none';
          connStatus.className = 'status-online';
          topbar.statusText.textContent = `ONLINE (${selectedPort})`;
          await modalAlert(`Connected to Flipper Zero on ${selectedPort} successfully!`, "CONNECTED", "done");
        } else {
          connStatus.className = 'status-offline';
          topbar.statusText.textContent = "DB ERROR";
          await modalAlert("Connected to COM port but failed to initialize SQLite database.", "CONNECTION ERROR", "warning2");
        }
      }
    } else {
      connStatus.className = 'status-offline';
      topbar.statusText.textContent = "COM ERROR";
      await modalAlert(`Failed to connect to port ${selectedPort}.`, "CONNECTION ERROR", "warning2");
    }
  } catch (err) {
    connStatus.className = 'status-offline';
    topbar.statusText.textContent = "ERROR";
    await modalAlert(`Error opening COM port: ${err.message}`, "CONNECTION ERROR", "warning2");
  }
}

document.getElementById('simulated-badge').addEventListener('click', () => {
  if (window.api && window.api.log) window.api.log("simulated-badge clicked!");
  promptComPortSelection();
});
document.getElementById('connection-status').addEventListener('click', () => {
  if (window.api && window.api.log) window.api.log("connection-status clicked!");
  promptComPortSelection();
});

// Initialize on boot
initializeApp();

// ==================== LOGIN CONTROLLER ====================
// Scan NFC Card Login / Register
document.getElementById('loginBtn').addEventListener('click', async () => {
  const cardId = await scanHardwareCard();
  if (!cardId) return; // User cancelled or error occurred

  // Check if account exists
  const checkRes = await window.api.db.checkPerson(cardId);
  if (checkRes.ok && checkRes.exists) {
    // Read the account
    const res = await window.api.db.getAccount(cardId);
    if (res.ok) {
      const acc = res.account;
      if (acc.is_active !== 1) {
        await modalAlert(`Access Denied: Account associated with card [${cardId}] is suspended.`, "ACCESS DENIED", "warning2");
        return;
      }
      
      // Login successful
      currentAccount = acc;
      document.getElementById('user-display-name').textContent = acc.holder_name;
      document.getElementById('user-display-card').textContent = acc.card_id;
      
      await showModal({
        title: "ACCESS GRANTED",
        body: `Welcome, ${acc.holder_name}.\nAccess to Flipper Bank terminal is unlocked.`,
        icon: "admin",
        buttons: [{ label: "[ ENTER TERMINAL ]", value: true }]
      });
      
      showPage('menu');
    } else {
      await modalAlert(`Error loading account details: ${res.error}`, "LOAD ERROR", "warning2");
    }
  } else {
    // Unrecognized card (empty card) -> Show registration form!
    const regResult = await showModal({
      title: "UNREGISTERED CARD DETECTED",
      body: `Card ID [${cardId}] is not in the database.\nWould you like to register it now?`,
      icon: "reading",
      fields: [
        { id: 'reg-name', label: 'HOLDER NAME:', type: 'text', placeholder: 'Enter full name' },
        { id: 'reg-balance', label: 'INITIAL DEPOSIT ($):', type: 'number', placeholder: '0.00', step: '0.01', min: '0', defaultValue: '100.00' }
      ],
      buttons: [
        { label: "[ REGISTER ]", value: "$input" },
        { label: "[ CANCEL ]", value: null }
      ]
    });

    if (regResult) {
      const name = regResult['reg-name'] ? regResult['reg-name'].trim() : '';
      const balance = parseFloat(regResult['reg-balance'] || '0');

      if (!name) {
        await modalAlert("Holder Name cannot be empty.", "REGISTRATION ERROR", "warning");
        return;
      }
      if (isNaN(balance) || balance < 0) {
        await modalAlert("Initial Deposit must be a valid non-negative number.", "REGISTRATION ERROR", "warning");
        return;
      }

      // Create person
      const createRes = await window.api.db.createPerson(cardId, name, balance);
      if (createRes.ok) {
        // Read new account
        const res = await window.api.db.getAccount(cardId);
        if (res.ok) {
          currentAccount = res.account;
          document.getElementById('user-display-name').textContent = currentAccount.holder_name;
          document.getElementById('user-display-card').textContent = currentAccount.card_id;
          
          await modalAlert(`Account registered successfully for ${name}!`, "REGISTRATION COMPLETE", "done");
          showPage('menu');
        } else {
          await modalAlert("Account registered but failed to reload details.", "LOAD ERROR", "warning");
        }
      } else {
        await modalAlert(`Registration Failed: ${createRes.error || 'Check Flipper write state.'}`, "REGISTRATION ERROR", "warning2");
      }
    }
  }
});

// Logout action
document.getElementById('logoutBtn').addEventListener('click', () => {
  currentAccount = null;
  showPage('login');
});

// ==================== BACK BUTTON CONTROLLER ====================
document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Refresh user's balance account details when going back to main menu
    refreshAccountState().then(() => {
      showPage('menu');
    });
  });
});

async function refreshAccountState() {
  if (!currentAccount) return;
  const res = await window.api.db.getAccount(currentAccount.card_id);
  if (res.ok) {
    currentAccount = res.account;
    document.getElementById('user-display-name').textContent = currentAccount.holder_name;
    document.getElementById('user-display-card').textContent = currentAccount.card_id;
  }
}

// ==================== BALANCE CONTROLLER ====================
document.getElementById('menuBalanceBtn').addEventListener('click', async () => {
  if (!currentAccount) return;
  
  // Query fresh status from DB
  const res = await window.api.db.getAccount(currentAccount.card_id);
  if (res.ok) {
    const acc = res.account;
    currentAccount = acc;
    
    document.getElementById('balance-holder').textContent = acc.holder_name;
    document.getElementById('balance-card').textContent = acc.card_id;
    document.getElementById('balance-status').textContent = acc.is_active === 1 ? "ACTIVE" : "SUSPENDED";
    document.getElementById('balance-status').className = acc.is_active === 1 ? "pixel-font info-val text-green" : "pixel-font info-val text-red";
    document.getElementById('balance-amount').textContent = `$${acc.balance.toFixed(2)}`;
    
    showPage('balance');
  } else {
    await modalAlert("Could not load fresh account balance details.", "BALANCE ERROR", "warning");
  }
});

// ==================== PAYMENT CONTROLLER ====================
const paymentAmountInput = document.getElementById('payment-amount-input');
const triggerPaymentBtn = document.getElementById('triggerPaymentBtn');
const paymentSuccessCard = document.getElementById('payment-success-card');

document.getElementById('menuPaymentBtn').addEventListener('click', () => {
  paymentAmountInput.value = '';
  paymentSuccessCard.style.display = 'none';
  showPage('payment');
});

triggerPaymentBtn.addEventListener('click', async () => {
  if (!currentAccount) return;
  
  const amount = parseFloat(paymentAmountInput.value);
  if (isNaN(amount) || amount <= 0) {
    await modalAlert("Please enter a valid payment amount.", "VALIDATION ERROR", "warning");
    return;
  }

  if (currentAccount.balance < amount) {
    await modalAlert(`Insufficient funds! Your balance is $${currentAccount.balance.toFixed(2)}`, "INSUFFICIENT FUNDS", "warning2");
    return;
  }

  // Scan card to confirm payment
  const scannedCardId = await scanHardwareCard();
  if (!scannedCardId) return;

  if (scannedCardId !== currentAccount.card_id) {
    await modalAlert(`Card mismatch! Swiped card does not match the active session card.`, "CARD MISMATCH", "warning2");
    return;
  }

  // Process transaction to a mock merchant account (FLIP_CARD_002)
  const res = await window.api.db.transaction(currentAccount.card_id, "FLIP_CARD_002", amount); 
  if (res.ok) {
    // Fetch fresh account details to display balance
    const accRes = await window.api.db.getAccount(currentAccount.card_id);
    if (accRes.ok) {
      currentAccount = accRes.account;
    }
    
    document.getElementById('receipt-charged').textContent = `$${amount.toFixed(2)}`;
    document.getElementById('receipt-new-balance').textContent = `$${currentAccount.balance.toFixed(2)}`;
    paymentSuccessCard.style.display = 'block';
  } else {
    await modalAlert(`Payment Error: ${res.error || 'The core bank transaction was rejected.'}`, "PAYMENT ERROR", "warning");
  }
});

// ==================== TRANSACTION CONTROLLER ====================
const txReceiverInput = document.getElementById('tx-receiver-input');
const txAmountInput = document.getElementById('tx-amount-input');
const txLog = document.getElementById('tx-log');
const triggerTransferBtn = document.getElementById('triggerTransferBtn');

document.getElementById('menuTransactionBtn').addEventListener('click', () => {
  txReceiverInput.value = '';
  txAmountInput.value = '';
  txLog.innerHTML = `<div class="log-line text-dim">&gt; Terminal ready for transaction.</div>`;
  showPage('transaction');
});

// Auto-scan receiver Card ID
document.getElementById('txScanReceiverBtn').addEventListener('click', async () => {
  const scannedCardId = await scanHardwareCard();
  if (scannedCardId) {
    txReceiverInput.value = scannedCardId;
    appendLog(`Card scanned. Receiver ID set to: ${scannedCardId}`);
  }
});

triggerTransferBtn.addEventListener('click', async () => {
  if (!currentAccount) return;
  
  const receiverId = txReceiverInput.value.trim();
  const amount = parseFloat(txAmountInput.value);

  if (!receiverId) {
    appendLog("ERROR: Please specify a receiver Card ID.", true);
    return;
  }
  
  if (receiverId === currentAccount.card_id) {
    appendLog("ERROR: Cannot transfer funds to the same logged-in account.", true);
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    appendLog("ERROR: Please enter a valid transfer amount.", true);
    return;
  }

  appendLog(`&gt; Sending request: Transfer $${amount.toFixed(2)} to ${receiverId}...`);

  // Execute transaction via IPC
  const res = await window.api.db.transaction(currentAccount.card_id, receiverId, amount);
  if (res.ok) {
    // Refresh sender account balance
    const accRes = await window.api.db.getAccount(currentAccount.card_id);
    if (accRes.ok) {
      currentAccount = accRes.account;
    }
    
    appendLog(`SUCCESS: Transferred $${amount.toFixed(2)} to account ${receiverId}.`, false);
    appendLog(`&gt; New Account Balance: $${currentAccount.balance.toFixed(2)}`);
    
    // Clear inputs
    txReceiverInput.value = '';
    txAmountInput.value = '';
  } else {
    appendLog(`ERROR: Transfer rejected (${res.error || 'database core error'})`, true);
  }
});

function appendLog(message, isError = false) {
  const div = document.createElement('div');
  div.className = isError ? 'log-line error' : 'log-line';
  div.innerHTML = message;
  txLog.appendChild(div);
  txLog.scrollTop = txLog.scrollHeight;
}
