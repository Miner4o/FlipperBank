#ifndef BANK_CORE_H
#define BANK_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

// DLL export macro definition
#ifdef BUILDING_BANK_CORE_DLL
#define BANK_CORE_API __declspec(dllexport)
#else
#define BANK_CORE_API __declspec(dllimport)
#endif

// Ensure structure packing is consistent for FFI matching
#pragma pack(push, 1)

typedef struct {
    char card_id[64];        // Unique token read from Flipper Zero card emulator
    char holder_name[128];   // Owner name
    double balance;          // Current account balance
    int is_active;           // Status flag: 1 = active, 0 = inactive/disabled
} Account;

#pragma pack(pop)

/**
 * @brief Initializes the bank database by opening a connection to SQLite3.
 *        Creates the required tables ('accounts', 'transactions') if they do not exist.
 * 
 * @param db_path Path to the SQLite database file (e.g. "bank.db").
 * @return 1 on successful initialization, 0 on failure.
 */
BANK_CORE_API int bank_core_init(const char* db_path);

/**
 * @brief Closes the database connection and frees resources.
 * 
 * @return 1 on success, 0 on failure.
 */
BANK_CORE_API int bank_core_close(void);

/**
 * @brief Retrieves account data for a given card ID from the database.
 * 
 * @param card_id The card ID to lookup.
 * @param out_account Struct pointer where account details will be copied.
 * @return 1 if found, 0 if not found or on query error.
 */
BANK_CORE_API int bank_core_get_account(const char* card_id, Account* out_account);

/**
 * @brief Executes a monetary transfer from one account to another in an ACID transaction.
 *        Performs logic checks (e.g. active accounts, sufficient balance) and logs
 *        the transaction history to the database.
 * 
 * @param from_card_id Source account card ID.
 * @param to_card_id Destination account card ID.
 * @param amount The double-precision decimal currency amount.
 * @return 1 on success, 0 on failure (e.g., insufficient funds, DB locking).
 */
BANK_CORE_API int bank_core_transaction(const char* from_card_id, const char* to_card_id, double amount);

#ifdef __cplusplus
}
#endif

#endif // BANK_CORE_H
