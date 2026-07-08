# 🐬 Flipper Bank

A minimalist, high-performance desktop banking terminal simulation that interfaces with a **Flipper Zero** over UART to read and validate physical NFC cards. 

This project demonstrates a robust 3-tier architecture combining a modern web-tech frontend, desktop automation, and a secure, lightning-fast native **pure C** core.

---

## 🏗️ Architecture & Tech Stack

The system is completely modular and follows strict separation of concerns:

- **Frontend & App Shell:** `Electron` (Node.js + HTML/CSS/JS) utilizing IPC (Inter-Process Communication) and context-isolated scripts for a secure UI.
- **Native Bridge:** `node-ffi-napi` to invoke raw C functions directly from the JavaScript runtime.
- **Backend Core:** Pure `C (C99)` compiled into a dynamic link library (`bank_core.dll`).
- **Hardware Interface:** `Win32 API` (`CreateFile`, `ReadFile`, `WriteFile`) for low-level serial communication over USB-UART CDC.
- **Data Persistence:** Embedded `SQLite3` database compiled natively into the C core via the amalgamation distribution.

---

## 📂 Project Structure

```text
flipper-bank/
├── app-core-c/         # Pure C core, SQLite3 & Win32 UART driver
│   ├── include/        # C Header files (.h)
│   └── src/            # Core business logic & SQLite implementation (.c)
└── electron-app/       # Desktop application & UI wrapper (Node.js/Electron)
    ├── bin/            # Location of the compiled bank_core.dll
    └── src/            # 2D Flat/Pixel style banking interface
