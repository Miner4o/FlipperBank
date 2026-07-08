#ifndef FLIPPER_UART_H
#define FLIPPER_UART_H

#ifdef __cplusplus
extern "C" {
#endif

// DLL export macro definition
#ifdef BUILDING_BANK_CORE_DLL
#define BANK_CORE_API __declspec(dllexport)
#else
#define BANK_CORE_API __declspec(dllimport)
#endif

/**
 * @brief Opens the UART connection to the Flipper Zero serial/COM port.
 *        Configures the baud rate to 115200, 8 data bits, no parity, 1 stop bit,
 *        and configures timeouts to prevent infinite blocking.
 * 
 * @param port_name The Windows serial port identifier (e.g. "COM3" or "\\\\.\\COM10").
 * @return 1 on successful open and configuration, 0 on failure.
 */
BANK_CORE_API int flipper_uart_open(const char* port_name);

/**
 * @brief Closes the active UART connection to the Flipper Zero.
 * 
 * @return 1 on success, 0 on failure or if no connection is active.
 */
BANK_CORE_API int flipper_uart_close(void);

/**
 * @brief Sends a command to the Flipper Zero and reads the response back.
 *        Implements synchronous read timeouts.
 * 
 * @param out_card_id Buffer to write the read card token/ID into.
 * @param max_len Maximum length of the out_card_id buffer.
 * @return 1 on success (card ID read successfully), 0 on timeout, disconnection, or failure.
 */
BANK_CORE_API int flipper_uart_scan_card(char* out_card_id, int max_len);

#ifdef __cplusplus
}
#endif

#endif // FLIPPER_UART_H
