#include <stdio.h>
#include <stdlib.h>
#include <windows.h>
#include <string.h>
#include <stdbool.h>
#include "flipper_bank.h"

#define logger printf
static char globalResponse[8192];
static HANDLE g_hSerial = NULL;
static char globalCardUID[64] = {0};

HANDLE openSerialPort(const char* portName) {
    HANDLE hSerial = CreateFileA(portName, GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (hSerial == INVALID_HANDLE_VALUE) return NULL;
    g_hSerial = hSerial;

    DCB dcb = { .DCBlength = sizeof(DCB) };
    if (GetCommState(hSerial, &dcb)) {
        dcb.BaudRate = CBR_115200; dcb.ByteSize = 8; dcb.StopBits = ONESTOPBIT; dcb.Parity = NOPARITY;
        dcb.fOutxCtsFlow = FALSE; dcb.fRtsControl = RTS_CONTROL_DISABLE; dcb.fDtrControl = DTR_CONTROL_ENABLE;
        SetCommState(hSerial, &dcb);
    }

    COMMTIMEOUTS timeouts = { 50, 200, 10, 50, 10 };
    SetCommTimeouts(hSerial, &timeouts);
    EscapeCommFunction(hSerial, SETDTR);
    PurgeComm(hSerial, PURGE_RXCLEAR | PURGE_TXCLEAR);

    DWORD written, read;
    WriteFile(hSerial, "\r", 1, &written, NULL);
    char junk, sync[4] = {0};
    int attempts = 0;
    while (ReadFile(hSerial, &junk, 1, &read, NULL) && read > 0 && ++attempts < 100) {
        memmove(sync, sync + 1, 2);
        sync[2] = junk;
        if (strcmp(sync, ">: ") == 0) break;
    }
    return hSerial;
}

const char* sendCommand(HANDLE hSerial, const char* command) {
    if (!hSerial || hSerial == INVALID_HANDLE_VALUE) return "ERROR: Invalid Handle";

    char junk;
    DWORD bytesRead, written;
    int purge_attempts = 0;
    while (ReadFile(hSerial, &junk, 1, &bytesRead, NULL) && bytesRead > 0 && ++purge_attempts < 1000);

    char buffer[1024];
    snprintf(buffer, sizeof(buffer), "%s\r", command);
    WriteFile(hSerial, buffer, (DWORD)strlen(buffer), &written, NULL);
    
    memset(globalResponse, 0, sizeof(globalResponse));
    int len = 0, timeouts = 0;
    while (len < (int)sizeof(globalResponse) - 1) {
        char ch;
        if (ReadFile(hSerial, &ch, 1, &bytesRead, NULL) && bytesRead > 0) {
            timeouts = 0;
            if (ch == '\r') ch = '\n';
            globalResponse[len++] = ch;
            globalResponse[len] = '\0';
            if (len >= 3 && strcmp(&globalResponse[len - 3], ">: ") == 0) {
                globalResponse[len - 3] = '\0';
                break;
            }
        } else {
            if (++timeouts > 50) break;
        }
    }

    char* echo = strstr(globalResponse, command);
    if (echo) {
        char* start = echo + strlen(command);
        while (*start == '\r' || *start == '\n') start++;
        memmove(globalResponse, start, strlen(start) + 1);
    }
    return globalResponse;
}

bool flipper_init(void){
    if (g_hSerial == NULL || g_hSerial == INVALID_HANDLE_VALUE) return true;
    sendCommand(g_hSerial, "usb_nfc ping");
    return strstr(globalResponse, "PONG") != NULL || strstr(globalResponse, "pong") != NULL;
}

void flipper_ping(void){
    while(1) {
        sendCommand(g_hSerial, "usb_nfc ping");
        Sleep(1000);
    }
}

const char* flipper_read_card(void){
    sendCommand(g_hSerial, "usb_nfc scan");
    if (strstr(globalResponse, "No card") != NULL || strstr(globalResponse, "No tag") != NULL || strstr(globalResponse, "fail") != NULL) return "";
    
    // Attempt to read NDEF record first
    sendCommand(g_hSerial, "usb_nfc ndef");
    char hex_str[256] = {0};
    
    // Search for "Text:" or "Payload:" label in the response
    char* text_loc = strstr(globalResponse, "Text:");
    if (!text_loc) text_loc = strstr(globalResponse, "text:");
    if (!text_loc) text_loc = strstr(globalResponse, "Payload:");
    if (!text_loc) text_loc = strstr(globalResponse, "payload:");
    
    if (text_loc) {
        char* p = strchr(text_loc, ':') + 1;
        while (*p == ' ' || *p == '\t') p++;
        int idx = 0;
        while (idx < 255 && ((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || (*p >= 'A' && *p <= 'F'))) {
            hex_str[idx++] = *p++;
        }
        hex_str[idx] = '\0';
    } else {
        // Fallback: search for any hexadecimal sequence of length >= 32
        char* p = globalResponse;
        while (*p) {
            int len = 0;
            char* start = p;
            while ((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || (*p >= 'A' && *p <= 'F')) {
                len++;
                p++;
            }
            if (len >= 32 && len < 256) {
                strncpy(hex_str, start, len);
                hex_str[len] = '\0';
                break;
            }
            if (*p) p++;
        }
    }
    
    if (strlen(hex_str) >= 32) {
        char decrypted_card_id[128] = {0};
        if (aes_decrypt(hex_str, decrypted_card_id, "Miner4o")) {
            // Trim any whitespace/newlines from decrypted ID
            int len = (int)strlen(decrypted_card_id);
            while (len > 0 && (decrypted_card_id[len-1] == ' ' || decrypted_card_id[len-1] == '\t' || decrypted_card_id[len-1] == '\r' || decrypted_card_id[len-1] == '\n')) {
                decrypted_card_id[--len] = '\0';
            }
            strcpy(globalCardUID, decrypted_card_id);
            return globalCardUID;
        }
    }
    
    // Fallback: read physical card UID
    sendCommand(g_hSerial, "usb_nfc info");
    char* uid_loc = strstr(globalResponse, "UID");
    if (uid_loc != NULL) {
        uid_loc += 3;
        while (*uid_loc == ':' || *uid_loc == ' ' || *uid_loc == '\t') {
            uid_loc++;
        }
        strcpy(globalCardUID, uid_loc);
        char* end = strpbrk(globalCardUID, "\r\n");
        if (end) *end = '\0';
        int len = strlen(globalCardUID);
        while (len > 0 && (globalCardUID[len-1] == ' ' || globalCardUID[len-1] == '\t' || globalCardUID[len-1] == '\r' || globalCardUID[len-1] == '\n')) {
            globalCardUID[--len] = '\0';
        }
        return globalCardUID;
    }
    return "";
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

const char* flipper_write(const char* data){
    char command[1024];
    snprintf(command, sizeof(command), "usb_nfc write text %s", data);
    sendCommand(g_hSerial, command);
    return globalResponse;
}

void closeSerialPort(HANDLE hSerial) {
    if (hSerial != NULL && hSerial != INVALID_HANDLE_VALUE) {
        CloseHandle(hSerial);
        if (hSerial == g_hSerial) g_hSerial = NULL;
    }
}
