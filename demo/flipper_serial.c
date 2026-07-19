#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void send_command_and_print_response(HANDLE hComm, const char* command) {
    char buffer[1024];
    DWORD bytesWritten, bytesRead;
    
    // Clear any leftover data in the receive buffer (e.g. from previous background commands)
    char junk;
    while (ReadFile(hComm, &junk, 1, &bytesRead, NULL) && bytesRead > 0) {}
    
    // Send command with \r (Carriage Return) as Flipper CLI expects
    snprintf(buffer, sizeof(buffer), "%s\r", command);
    
    if (!WriteFile(hComm, buffer, (DWORD)strlen(buffer), &bytesWritten, NULL)) {
        printf("Error writing to COM port.\n");
        return;
    }

    char responseBuf[8192] = {0};
    int responseLen = 0;
    
    // Read character by character until we see the prompt ">: "
    int timeouts_count = 0;
    while (1) {
        char ch;
        if (ReadFile(hComm, &ch, 1, &bytesRead, NULL)) {
            if (bytesRead > 0) {
                timeouts_count = 0; // Reset timeout on successful read
                if (responseLen < sizeof(responseBuf) - 1) {
                    responseBuf[responseLen++] = ch;
                    responseBuf[responseLen] = '\0';
                    
                    // Check if the end of our current buffer has the prompt
                    if (responseLen >= 3 && strcmp(&responseBuf[responseLen - 3], ">: ") == 0) {
                        responseBuf[responseLen - 3] = '\0'; // Remove the prompt
                        break;
                    }
                }
            } else {
                // ReadFile timed out (100ms)
                timeouts_count++;
                if (timeouts_count > 600) { // 60 seconds total wait
                    printf("\n[Error: Command timed out after 60 seconds of no data]\n");
                    break;
                }
            }
        } else {
            printf("\n[Error: Connection lost]\n");
            break;
        }
    }
    
    char* start = responseBuf;
    
    // The Flipper echoes the command back. Find exactly the echoed command and skip it.
    char* cmd_echo = strstr(start, command);
    if (cmd_echo != NULL) {
        start = cmd_echo + strlen(command);
        // Skip any immediate carriage returns or newlines following the echoed command
        while (*start == '\r' || *start == '\n') {
            start++;
        }
    }
    
    // Strip trailing empty lines before the prompt for clean output
    int len = (int)strlen(start);
    while (len > 0 && (start[len - 1] == '\r' || start[len - 1] == '\n')) {
        start[len - 1] = '\0';
        len--;
    }

    if (strlen(start) > 0) {
        printf("%s\n", start);
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage: %s <COM_PORT> [command]\n", argv[0]);
        printf("Example (interactive): %s COM3\n", argv[0]);
        printf("Example (single command): %s COM3 \"usb_nfc ping\"\n", argv[0]);
        return 1;
    }

    const char* portName = argv[1];
    char fullPortName[32];
    snprintf(fullPortName, sizeof(fullPortName), "\\\\.\\%s", portName);

    // Open the serial port
    HANDLE hComm = CreateFileA(
        fullPortName,
        GENERIC_READ | GENERIC_WRITE,
        0,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (hComm == INVALID_HANDLE_VALUE) {
        printf("Error opening %s. Make sure the Flipper is connected and the port is correct.\n", portName);
        return 1;
    }

    // Configure the serial port
    DCB dcbSerialParams = { 0 };
    dcbSerialParams.DCBlength = sizeof(dcbSerialParams);

    if (!GetCommState(hComm, &dcbSerialParams)) {
        printf("Error getting state\n");
        CloseHandle(hComm);
        return 1;
    }

    dcbSerialParams.BaudRate = CBR_115200;
    dcbSerialParams.ByteSize = 8;
    dcbSerialParams.StopBits = ONESTOPBIT;
    dcbSerialParams.Parity   = NOPARITY;
    dcbSerialParams.fDtrControl = DTR_CONTROL_ENABLE; 
    dcbSerialParams.fOutxCtsFlow = FALSE;
    dcbSerialParams.fRtsControl = RTS_CONTROL_DISABLE;

    if (!SetCommState(hComm, &dcbSerialParams)) {
        printf("Error setting state\n");
        CloseHandle(hComm);
        return 1;
    }

    // Set timeouts
    COMMTIMEOUTS timeouts = { 0 };
    timeouts.ReadIntervalTimeout         = 20;
    timeouts.ReadTotalTimeoutConstant    = 100;
    timeouts.ReadTotalTimeoutMultiplier  = 2;
    timeouts.WriteTotalTimeoutConstant   = 50;
    timeouts.WriteTotalTimeoutMultiplier = 10;
    
    if (!SetCommTimeouts(hComm, &timeouts)) {
        printf("Error setting timeouts\n");
        CloseHandle(hComm);
        return 1;
    }

    printf("Initializing connection to Flipper, please wait...\n");
    
    // Clear the receive buffer completely first
    char junk;
    DWORD bytesRead;
    while (ReadFile(hComm, &junk, 1, &bytesRead, NULL) && bytesRead > 0) {}

    // Send a carriage return to trigger a fresh prompt
    DWORD bytesWritten;
    WriteFile(hComm, "\r", 1, &bytesWritten, NULL);
    
    char syncBuf[4] = {0};
    int sync_timeouts = 0;
    
    // Read until we see the prompt to clear the buffer
    while (ReadFile(hComm, &junk, 1, &bytesRead, NULL)) {
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
            if (sync_timeouts > 30) { // 3 seconds total wait for banner
                break;
            }
        }
    }

    if (argc >= 3) {
        // Run a single command provided as an argument
        send_command_and_print_response(hComm, argv[2]);
    } else {
        // Interactive Menu Mode
        printf("Connected to Flipper on %s at 115200 baud.\n", portName);
        
        char choice[16];
        while (1) {
            printf("\n--- Flipper NFC Testing Menu ---\n");
            printf("1. Ping (usb_nfc ping)\n");
            printf("2. Scan for cards (usb_nfc scan)\n");
            printf("3. Get card info (usb_nfc info)\n");
            printf("4. Read card to file (usb_nfc read /ext/nfc/card_monkarda.nfc)\n");
            printf("5. Check NDEF (usb_nfc ndef)\n");
            printf("6. Write file to blank card (usb_nfc write /ext/nfc/card_monkarda.nfc)\n");
            printf("7. Write custom text to card (usb_nfc write text <text>)\n");
            printf("8. Dump saved card (storage read /ext/nfc/card_monkarda.nfc)\n");
            printf("9. Exit\n");
            printf("Select an option (1-9): ");
            
            if (fgets(choice, sizeof(choice), stdin) == NULL) {
                break;
            }
            
            int opt = atoi(choice);
            switch (opt) {
                case 1:
                    printf("\n[Executing: usb_nfc ping]\n");
                    send_command_and_print_response(hComm, "usb_nfc ping");
                    break;
                case 2:
                    printf("\n[Executing: usb_nfc scan]\n");
                    send_command_and_print_response(hComm, "usb_nfc scan");
                    break;
                case 3:
                    printf("\n[Executing: usb_nfc info]\n");
                    send_command_and_print_response(hComm, "usb_nfc info");
                    break;
                case 4:
                    printf("\n[Executing: usb_nfc read /ext/nfc/card_monkarda.nfc]\n");
                    send_command_and_print_response(hComm, "usb_nfc read /ext/nfc/card_monkarda.nfc");
                    break;
                case 5:
                    printf("\n[Executing: usb_nfc ndef]\n");
                    send_command_and_print_response(hComm, "usb_nfc ndef");
                    break;
                case 6:
                    printf("\n[Executing: usb_nfc write /ext/nfc/card_monkarda.nfc]\n");
                    send_command_and_print_response(hComm, "usb_nfc write /ext/nfc/card_monkarda.nfc");
                    break;
                case 7: {
                    char text_to_write[256];
                    printf("Enter text to write: ");
                    if (fgets(text_to_write, sizeof(text_to_write), stdin) != NULL) {
                        size_t l = strlen(text_to_write);
                        if (l > 0 && text_to_write[l - 1] == '\n') {
                            text_to_write[l - 1] = '\0';
                            l--;
                        }
                        if (l > 0 && text_to_write[l - 1] == '\r') {
                            text_to_write[l - 1] = '\0';
                        }
                        char full_cmd[512];
                        snprintf(full_cmd, sizeof(full_cmd), "usb_nfc write text %s", text_to_write);
                        printf("\n[Executing: %s]\n", full_cmd);
                        send_command_and_print_response(hComm, full_cmd);
                    }
                    break;
                }
                case 8:
                    printf("\n[Executing: storage read /ext/nfc/card_monkarda.nfc]\n");
                    send_command_and_print_response(hComm, "storage read /ext/nfc/card_monkarda.nfc");
                    break;
                case 9:
                    printf("Exiting.\n");
                    CloseHandle(hComm);
                    return 0;
                default:
                    printf("Invalid option. Please enter a number between 1 and 9.\n");
                    break;
            }
        }
    }

    CloseHandle(hComm);
    return 0;
}
