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
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

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

function verifyPasscode() {
  if (currentPin === '1234') {
    // Unlocked successfully
    currentPin = '';
    updatePinDisplay();
    showPage('login');
  } else {
    alert("ACCESS DENIED: INCORRECT PASSCODE.");
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
const toggleAdminBtn = document.getElementById('toggleAdminBtn');
const toggleUserBtn = document.getElementById('toggleUserBtn');
const adminLoginView = document.getElementById('admin-login-view');
const userLoginView = document.getElementById('user-login-view');

toggleAdminBtn.addEventListener('click', () => {
  toggleAdminBtn.classList.add('active');
  toggleUserBtn.classList.remove('active');
  adminLoginView.style.display = 'flex';
  userLoginView.style.display = 'none';
});

toggleUserBtn.addEventListener('click', () => {
  toggleUserBtn.classList.add('active');
  toggleAdminBtn.classList.remove('active');
  userLoginView.style.display = 'flex';
  adminLoginView.style.display = 'none';
});

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

// ==================== HARDWARE COMM & SCAN LOGIC ====================
async function scanHardwareCard() {
  if (isSimulationMode) {
    // Open the mock overlay select dialog
    return await openScanModal();
  } else {
    // Call C DLL serial ping
    // We open a basic feedback overlay to let user know serial is querying
    const promptModal = document.getElementById('scannerModal');
    promptModal.classList.add('active');
    
    // Hide simulator options during native scan
    promptModal.querySelector('.modal-buttons').style.display = 'none';
    promptModal.querySelector('.modal-divider').style.display = 'none';
    promptModal.querySelector('.manual-scan-label').style.display = 'none';
    promptModal.querySelector('.input-group').style.display = 'none';
    promptModal.querySelector('.modal-pulse').textContent = "QUERYING SERIAL COM PORT...";

    try {
      const res = await window.api.uart.scanCard();
      promptModal.classList.remove('active');
      
      // Restore layout for future
      promptModal.querySelector('.modal-buttons').style.display = 'flex';
      promptModal.querySelector('.modal-divider').style.display = 'block';
      promptModal.querySelector('.manual-scan-label').style.display = 'block';
      promptModal.querySelector('.input-group').style.display = 'flex';
      promptModal.querySelector('.modal-pulse').textContent = "WAVE FLIPPER ZERO NEAR THE RFID READER";

      if (res.ok) {
        return res.card_id;
      } else {
        alert("Scan Failed: " + res.error);
        return null;
      }
    } catch (err) {
      promptModal.classList.remove('active');
      alert("Error scanning card: " + err.message);
      return null;
    }
  }
}

// ==================== APP INITS & CONNECTION STATE ====================
async function initializeApp() {
  // Check if we are running in simulated or native mode
  isSimulationMode = await window.api.uart.isSimulated();
  
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

// Initialize on boot
initializeApp();

// ==================== LOGIN CONTROLLER ====================
// Admin (NFC Card scan)
document.getElementById('loginBtn').addEventListener('click', async () => {
  const cardId = await scanHardwareCard();
  if (!cardId) return; // User cancelled or error occurred

  const res = await window.api.db.getAccount(cardId);
  if (res.ok) {
    const acc = res.account;
    if (acc.is_active !== 1) {
      alert(`Access Denied: Account associated with card [${cardId}] is suspended.`);
      return;
    }
    
    // Login successful
    currentAccount = acc;
    document.getElementById('user-display-name').textContent = acc.holder_name;
    document.getElementById('user-display-card').textContent = acc.card_id;
    
    showPage('menu');
  } else {
    alert(`Authentication Error: Card ID [${cardId}] was not recognized by the bank core.`);
  }
});

// User (Email & Password credentials manual login)
document.getElementById('submitUserLoginBtn').addEventListener('click', async () => {
  const emailInput = document.getElementById('login-email-input').value.trim();
  const passwordInput = document.getElementById('login-password-input').value;

  if (!emailInput || !passwordInput) {
    alert("Please enter both email and password.");
    return;
  }

  // Validate credentials in simulated mode (mock login values)
  if (emailInput === 'user@flipper.com' && passwordInput === 'password123') {
    // Fetch card account associated with John Doe FLIP_CARD_001
    const res = await window.api.db.getAccount('FLIP_CARD_001');
    if (res.ok) {
      currentAccount = res.account;
      document.getElementById('user-display-name').textContent = currentAccount.holder_name;
      document.getElementById('user-display-card').textContent = currentAccount.card_id;
      
      // Clean form fields
      document.getElementById('login-email-input').value = '';
      document.getElementById('login-password-input').value = '';
      
      showPage('menu');
    } else {
      alert("Failed to load user account associated with profile.");
    }
  } else {
    alert("AUTHENTICATION FAILED: Invalid email or password.");
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
    alert("Could not load fresh account balance details.");
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
    alert("Please enter a valid payment amount.");
    return;
  }

  if (currentAccount.balance < amount) {
    alert(`Insufficient funds! Your balance is $${currentAccount.balance.toFixed(2)}`);
    return;
  }

  // Scan card to confirm payment
  const scannedCardId = await scanHardwareCard();
  if (!scannedCardId) return;

  if (scannedCardId !== currentAccount.card_id) {
    alert(`Card mismatch! Swiped card does not match the active session card.`);
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
    alert(`Payment Error: ${res.error || 'The core bank transaction was rejected.'}`);
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
