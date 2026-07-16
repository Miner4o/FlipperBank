#ifndef FLIPPER_BANK_H
#define FLIPPER_BANK_H

#ifdef __cplusplus
extern "C" {
#endif

#include <windows.h>

#define BUILDING_BANK_CORE_DLL // Ensure it exports from DLL
#ifdef BUILDING_BANK_CORE_DLL
#define BANK_CORE_API __declspec(dllexport)
#else
#define BANK_CORE_API __declspec(dllimport)
#endif

// --- Data Structures ---
#pragma pack(push, 1)
typedef struct {
    char card_id[64];        // Unique hardware token/ID read from Flipper Zero
    char holder_name[128];   // Account owner name
    double balance;          // Account balance in standard currency
    int is_active;           // Boolean flag (1 = Active, 0 = Suspended)
} Account;
#pragma pack(pop)

// --- Bank Core Functions (SQLite Database) ---
BANK_CORE_API int bank_init(const char* db_path);
BANK_CORE_API int bank_read(const char* card_id, Account* out_account);
BANK_CORE_API int bank_check_person(const char* card_id);
BANK_CORE_API int bank_sqlite_add(Account* acc);
BANK_CORE_API int bank_transaction(const char* from_card_id, const char* to_card_id, double amount);
BANK_CORE_API int bank_create_person(const char* card_id, const char* name, double balance);

// --- Flipper Serial UART Functions ---
BANK_CORE_API HANDLE openSerialPort(const char* portName);
BANK_CORE_API const char* sendCommand(HANDLE hSerial, const char* command);
BANK_CORE_API void flipper_init(void);
BANK_CORE_API void flipper_ping(void);
BANK_CORE_API void flipper_dump(void);
BANK_CORE_API void flipper_info(void);
BANK_CORE_API void flipper_read(void);
BANK_CORE_API void closeSerialPort(HANDLE hSerial);

// --- AES Cryptography Functions ---
BANK_CORE_API int aes_encrypt(const char* input, char* output, const char* key);
BANK_CORE_API int aes_decrypt(const char* input, char* output, const char* key);

#ifdef __cplusplus
}
#endif

#endif // FLIPPER_BANK_H
