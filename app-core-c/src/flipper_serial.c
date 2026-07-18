#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <windows.h>
#include <time.h>
#include <string.h>
#include <stdbool.h>
#include <math.h>
#include "flipper_bank.h"

#define logger printf

static char globalResponse[8192];
static HANDLE g_hSerial = NULL;

HANDLE openSerialPort(const char* portName) {
    HANDLE hSerial = CreateFileA(portName, GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (hSerial == INVALID_HANDLE_VALUE) return NULL;

    DCB dcb = { .DCBlength = sizeof(DCB) };
    if (GetCommState(hSerial, &dcb)) {
        dcb.BaudRate = CBR_115200;
        dcb.ByteSize = 8;
        dcb.StopBits = ONESTOPBIT;
        dcb.Parity = NOPARITY;
        dcb.fOutxCtsFlow = FALSE;
        dcb.fRtsControl = RTS_CONTROL_DISABLE;
        dcb.fDtrControl = DTR_CONTROL_ENABLE;
        SetCommState(hSerial, &dcb);
    }

    COMMTIMEOUTS timeouts = { 50, 200, 10, 50, 10 };
    SetCommTimeouts(hSerial, &timeouts);
    EscapeCommFunction(hSerial, SETDTR);
    PurgeComm(hSerial, PURGE_RXCLEAR | PURGE_TXCLEAR);

    return hSerial;
}

const char* sendCommand(HANDLE hSerial, const char* command) {
    if (!hSerial || hSerial == INVALID_HANDLE_VALUE) return "ERROR: Invalid Handle";

    // Clear any leftover data in the receive buffer
    char junk;
    DWORD bytesRead;
    while (ReadFile(hSerial, &junk, 1, &bytesRead, NULL) && bytesRead > 0) {}

    char buffer[1024];
    snprintf(buffer, sizeof(buffer), "%s\r", command);
    
    DWORD written;
    if (!WriteFile(hSerial, buffer, (DWORD)strlen(buffer), &written, NULL)) {
        return "ERROR: Write failed";
    }
    
    memset(globalResponse, 0, sizeof(globalResponse));
    int responseLen = 0;
    int timeouts_count = 0;
    
    while (1) {
        char ch;
        if (ReadFile(hSerial, &ch, 1, &bytesRead, NULL)) {
            if (bytesRead > 0) {
                timeouts_count = 0;
                if (responseLen < (int)sizeof(globalResponse) - 1) {
                    globalResponse[responseLen++] = ch;
                    globalResponse[responseLen] = '\0';
                    
                    // Check if the end of our current buffer has the prompt
                    if (responseLen >= 3 && strcmp(&globalResponse[responseLen - 3], ">: ") == 0) {
                        globalResponse[responseLen - 3] = '\0'; // Remove prompt
                        break;
                    }
                }
            } else {
                // ReadFile timed out (100ms)
                timeouts_count++;
                if (timeouts_count > 60) { // 6 seconds total wait max
                    break;
                }
            }
        } else {
            break;
        }
    }
    
    // Clean formatting for Windows
    for (int i = 0; i < responseLen; i++) {
        if (globalResponse[i] == '\r') globalResponse[i] = '\n';
    }
    
    // Strip command echo at the start
    char* cmd_echo = strstr(globalResponse, command);
    if (cmd_echo != NULL) {
        char* start = cmd_echo + strlen(command);
        while (*start == '\r' || *start == '\n') {
            start++;
        }
        memmove(globalResponse, start, strlen(start) + 1);
    }
    
    return globalResponse;
}

static char globalCardUID[64] = {0};

bool flipper_init(void){
    if (g_hSerial == NULL || g_hSerial == INVALID_HANDLE_VALUE) {
        logger("Serial port not open yet. Proceeding initialization.\n");
        return true;
    }
    sendCommand(g_hSerial, "usb_nfc ping");
    if (strstr(globalResponse, "PONG") != NULL) {
        logger("Flipper initialized successfully.\n");
        return true;
    } else {
        logger("Flipper not responding to ping.\n");
        return false;
    }
}

void flipper_ping(void){
    while(1) {
        sendCommand(g_hSerial, "usb_nfc ping");
        if (strstr(globalResponse, "PONG") == NULL) {
            logger("Flipper not responding to ping.\n");
        } else {
            logger("Flipper is alive.\n");
        }
        Sleep(1000);
    }
}

const char* flipper_read_card(void){
    sendCommand(g_hSerial, "usb_nfc scan");
    if (strstr(globalResponse, "No card detected") != NULL) {
        logger("No card detected.\n");
        return "";
    } else {
        logger("Card detected.\n");
    }
    sendCommand(g_hSerial, "usb_nfc info");
    
    char* uid_loc = NULL;
    for (int i = 0; globalResponse[i] != '\0'; i++) {
        if ((globalResponse[i] == 'u' || globalResponse[i] == 'U') &&
            (globalResponse[i+1] == 'i' || globalResponse[i+1] == 'I') &&
            (globalResponse[i+2] == 'd' || globalResponse[i+2] == 'D')) {
            uid_loc = &globalResponse[i];
            break;
        }
    }
    
    if (uid_loc != NULL) {
        char* src = uid_loc + 3;
        while (*src == ' ' || *src == ':' || *src == '\t') {
            src++;
        }
        int idx = 0;
        while (*src != '\0' && *src != '\r' && *src != '\n' && idx < 63) {
            globalCardUID[idx] = *src;
            idx++;
            src++;
        }
        globalCardUID[idx] = '\0';
        
        while (idx > 0 && globalCardUID[idx - 1] == ' ') {
            globalCardUID[idx - 1] = '\0';
            idx--;
        }
        
        logger("Card UID: %s\n", globalCardUID);
        return globalCardUID;
    } else {
        logger("Failed to get card info.\n");
        return "";
    }
}

const char* flipper_dump(void){
    sendCommand(g_hSerial, "storage read /ext/nfc/card.nfc");
    return globalResponse;
}

const char* flipper_info(void){
    sendCommand(g_hSerial, "usb_nfc info");
    return globalResponse;
}

const char* flipper_read(void){
    sendCommand(g_hSerial, "usb_nfc read /ext/nfc/card.nfc");
    return globalResponse;
}

BANK_CORE_API int flipper_uart_open(const char* portName) {
    if (g_hSerial && g_hSerial != INVALID_HANDLE_VALUE) {
        closeSerialPort(g_hSerial);
    }
    
    char fullPortName[64];
    if (strncmp(portName, "\\\\.\\", 4) == 0) {
        snprintf(fullPortName, sizeof(fullPortName), "%s", portName);
    } else {
        snprintf(fullPortName, sizeof(fullPortName), "\\\\.\\%s", portName);
    }
    
    g_hSerial = openSerialPort(fullPortName);
    if (g_hSerial == NULL || g_hSerial == INVALID_HANDLE_VALUE) {
        logger("Failed to open serial port %s\n", portName);
        return 0;
    }
    
    logger("Serial port %s opened successfully\n", portName);
    
    // Clear and sync prompt
    DWORD bytesWritten;
    WriteFile(g_hSerial, "\r", 1, &bytesWritten, NULL);
    
    char junk;
    DWORD bytesRead;
    char syncBuf[4] = {0};
    int sync_timeouts = 0;
    while (ReadFile(g_hSerial, &junk, 1, &bytesRead, NULL)) {
        if (bytesRead > 0) {
            sync_timeouts = 0;
            syncBuf[0] = syncBuf[1];
            syncBuf[1] = syncBuf[2];
            syncBuf[2] = junk;
            syncBuf[3] = '\0';
            if (strcmp(syncBuf, ">: ") == 0) {
                break;
            }
        } else {
            sync_timeouts++;
            if (sync_timeouts > 30) {
                break;
            }
        }
    }
    
    return 1;
}

BANK_CORE_API int flipper_uart_close(void) {
    if (g_hSerial && g_hSerial != INVALID_HANDLE_VALUE) {
        closeSerialPort(g_hSerial);
        return 1;
    }
    return 0;
}

BANK_CORE_API int flipper_uart_scan_card(char* out_card_id, int max_len) {
    if (!g_hSerial || g_hSerial == INVALID_HANDLE_VALUE) {
        return 0;
    }
    const char* uid = flipper_read_card();
    if (uid && strlen(uid) > 0) {
        snprintf(out_card_id, max_len, "%s", uid);
        return 1;
    }
    return 0;
}

void closeSerialPort(HANDLE hSerial) {
    if (hSerial != NULL && hSerial != INVALID_HANDLE_VALUE) {
        logger("closeSerialPort called.\n");
        CloseHandle(hSerial);
        if (hSerial == g_hSerial) {
            g_hSerial = NULL;
        }
    }
}
