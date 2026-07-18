#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <windows.h>
#include <time.h>
#include <string.h>
#include <math.h>
#include "flipper_bank.h"
#include "sqlite3.h"
static sqlite3* g_db = NULL;


int bank_init(const char* db_path){
    // Open SQLite database
    if (sqlite3_open(db_path, &g_db) != SQLITE_OK) {
        printf("Failed to open database: %s\n", db_path);
        return false;
    }
    
    // Create tables if they do not exist
    char* errmsg = NULL;
    const char* sql_accounts = 
        "CREATE TABLE IF NOT EXISTS accounts ("
        "    card_id TEXT PRIMARY KEY,"
        "    holder_name TEXT NOT NULL,"
        "    balance REAL NOT NULL DEFAULT 0.0,"
        "    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))"
        ");";
    sqlite3_exec(g_db, sql_accounts, NULL, NULL, &errmsg);
    
    const char* sql_transactions = 
        "CREATE TABLE IF NOT EXISTS transactions ("
        "    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "    from_card_id TEXT,"
        "    to_card_id TEXT,"
        "    amount REAL NOT NULL,"
        "    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,"
        "    FOREIGN KEY (from_card_id) REFERENCES accounts(card_id),"
        "    FOREIGN KEY (to_card_id) REFERENCES accounts(card_id)"
        ");";
    sqlite3_exec(g_db, sql_transactions, NULL, NULL, &errmsg);

    if (flipper_init() == true) {
        return true;
    }
    else {
        return false;
    }
    return 0;
}

int bank_read(const char* card_id, Account* out_account){
    if (!g_db || !card_id || !out_account) return 0;
    
    sqlite3_stmt* stmt = NULL;
    const char* sql = "SELECT card_id, holder_name, balance, is_active FROM accounts WHERE card_id = ?;";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL) != SQLITE_OK) {
        return 0;
    }
    
    sqlite3_bind_text(stmt, 1, card_id, -1, SQLITE_TRANSIENT);
    
    int result = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        const unsigned char* cid = sqlite3_column_text(stmt, 0);
        const unsigned char* name = sqlite3_column_text(stmt, 1);
        double bal = sqlite3_column_double(stmt, 2);
        int active = sqlite3_column_int(stmt, 3);
        
        if (cid) {
            snprintf(out_account->card_id, sizeof(out_account->card_id), "%s", (const char*)cid);
        } else {
            out_account->card_id[0] = '\0';
        }
        
        if (name) {
            snprintf(out_account->holder_name, sizeof(out_account->holder_name), "%s", (const char*)name);
        } else {
            out_account->holder_name[0] = '\0';
        }
        
        out_account->balance = bal;
        out_account->is_active = active;
        result = 1;
    }
    
    sqlite3_finalize(stmt);
    return result;
}

int bank_check_person(const char* card_id){
    return 0;
}

int bank_sqlite_add(Account* acc){
    return 0;
}

int bank_transaction(const char* from_card_id, const char* to_card_id, double amount){
    return 0;
}

int bank_create_person(const char* card_id, const char* name, double balance){
    return 0;
}

// --- Electron App FFI Wrappers ---

BANK_CORE_API int bank_core_init(const char* db_path) {
    return bank_init(db_path);
}

BANK_CORE_API int bank_core_close(void) {
    if (g_db) {
        sqlite3_close(g_db);
        g_db = NULL;
        return 1;
    }
    return 0;
}

BANK_CORE_API int bank_core_get_account(const char* card_id, Account* out_account) {
    return bank_read(card_id, out_account);
}

BANK_CORE_API int bank_core_transaction(const char* from_card_id, const char* to_card_id, double amount) {
    return bank_transaction(from_card_id, to_card_id, amount);
}