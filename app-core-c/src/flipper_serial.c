#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <windows.h>
#include <time.h>
#include <string.h>
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

    PurgeComm(hSerial, PURGE_RXCLEAR);
    
    char buffer[1024];
    snprintf(buffer, sizeof(buffer), "%s\r", command);
    
    DWORD written, read;
    WriteFile(hSerial, buffer, strlen(buffer), &written, NULL);
    
    Sleep(200); // Allow hardware to process
    
    memset(globalResponse, 0, sizeof(globalResponse));
    ReadFile(hSerial, globalResponse, sizeof(globalResponse) - 1, &read, NULL);
    
    // Clean formatting for Windows
    for (DWORD i = 0; i < read; i++) {
        if (globalResponse[i] == '\r') globalResponse[i] = '\n';
    }
    
    // Strip CLI prompt
    char* prompt = strstr(globalResponse, ">: ");
    if (prompt) *prompt = '\0';
    
    return globalResponse;
}

void flipper_init(void){
    sendCommand(g_hSerial, "ping");
    if (strstr(globalResponse, "PONG") == NULL) {
        logger("Flipper not responding to ping.\n");
    } else {
        logger("Flipper initialized successfully.\n");
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

void flipper_read_card(void){
    char uid[32];
    sendCommand(g_hSerial, "usb_nfc scan");
    if (strstr(globalResponse, "No card detected") != NULL) {
        logger("No card detected.\n");
    } else {
        logger("Card detected.\n");
    }
    sendCommand(g_hSerial, "usb_nfc info");
    if (strstr(globalResponse, "UID ") != NULL) {
        strcpy(uid, strstr(globalResponse, "UID ") + 4);
        logger("Card UID: %s\n", uid);
    } else {
        logger("Failed to get card info.\n");
    }
}

void flipper_dump(void){
    sendCommand(g_hSerial, "storage read /ext/nfc/card.nfc");
    return globalResponse;
}

void flipper_info(void){
    sendCommand(g_hSerial, "usb_nfc info");
    return globalResponse;
}

void flipper_read(void){
    sendCommand(g_hSerial, "usb_nfc read /ext/nfc/card.nfc");
    return globalResponse;
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
