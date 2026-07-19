#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "flipper_bank.h"
#include "sqlite3.h"

static sqlite3* g_db = NULL;

int bank_init(const char* db_path){
    if (sqlite3_open(db_path, &g_db) != SQLITE_OK) return 0;
    
    sqlite3_exec(g_db, "CREATE TABLE IF NOT EXISTS accounts (card_id TEXT PRIMARY KEY, holder_name TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0.0, is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)));", NULL, NULL, NULL);
    sqlite3_exec(g_db, "CREATE TABLE IF NOT EXISTS transactions (transaction_id INTEGER PRIMARY KEY AUTOINCREMENT, from_card_id TEXT, to_card_id TEXT, amount REAL NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (from_card_id) REFERENCES accounts(card_id), FOREIGN KEY (to_card_id) REFERENCES accounts(card_id));", NULL, NULL, NULL);

    flipper_init();
    return 1;
}

int bank_read(const char* card_id, Account* out_account){
    if (!g_db || !card_id || !out_account) return 0;
    
    sqlite3_stmt* stmt = NULL;
    const char* sql = "SELECT card_id, holder_name, balance, is_active FROM accounts WHERE card_id = ?;";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL) != SQLITE_OK) return 0;
    
    sqlite3_bind_text(stmt, 1, card_id, -1, SQLITE_TRANSIENT);
    
    int result = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        snprintf(out_account->card_id, sizeof(out_account->card_id), "%s", (const char*)sqlite3_column_text(stmt, 0));
        snprintf(out_account->holder_name, sizeof(out_account->holder_name), "%s", (const char*)sqlite3_column_text(stmt, 1));
        out_account->balance = sqlite3_column_double(stmt, 2);
        out_account->is_active = sqlite3_column_int(stmt, 3);
        result = 1;
    }
    sqlite3_finalize(stmt);
    return result;
}

int bank_check_person(const char* card_id) {
    if (!g_db || !card_id) return 0;
    sqlite3_stmt* stmt = NULL;
    const char* sql = "SELECT COUNT(*) FROM accounts WHERE card_id = ?;";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL) != SQLITE_OK) return 0;
    
    sqlite3_bind_text(stmt, 1, card_id, -1, SQLITE_TRANSIENT);
    int exists = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        exists = sqlite3_column_int(stmt, 0) > 0;
    }
    sqlite3_finalize(stmt);
    return exists;
}

int bank_sqlite_add(Account* acc) {
    if (!g_db || !acc) return 0;
    sqlite3_stmt* stmt = NULL;
    const char* sql = "INSERT OR REPLACE INTO accounts (card_id, holder_name, balance, is_active) VALUES (?, ?, ?, ?);";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL) != SQLITE_OK) return 0;
    
    sqlite3_bind_text(stmt, 1, acc->card_id, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, acc->holder_name, -1, SQLITE_TRANSIENT);
    sqlite3_bind_double(stmt, 3, acc->balance);
    sqlite3_bind_int(stmt, 4, acc->is_active);
    
    int res = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return res;
}

int bank_transaction(const char* from_card_id, const char* to_card_id, double amount) {
    if (!g_db || !from_card_id || !to_card_id || amount <= 0) return 0;
    
    Account from_acc;
    if (!bank_read(from_card_id, &from_acc) || from_acc.is_active != 1 || from_acc.balance < amount) return 0;
    
    Account to_acc;
    if (!bank_read(to_card_id, &to_acc) || to_acc.is_active != 1) return 0;
    
    char* errmsg = NULL;
    if (sqlite3_exec(g_db, "BEGIN TRANSACTION;", NULL, NULL, &errmsg) != SQLITE_OK) {
        if (errmsg) sqlite3_free(errmsg);
        return 0;
    }
    
    sqlite3_stmt* stmt1 = NULL;
    const char* sql1 = "UPDATE accounts SET balance = balance - ? WHERE card_id = ?;";
    if (sqlite3_prepare_v2(g_db, sql1, -1, &stmt1, NULL) != SQLITE_OK) {
        sqlite3_exec(g_db, "ROLLBACK;", NULL, NULL, NULL);
        return 0;
    }
    sqlite3_bind_double(stmt1, 1, amount);
    sqlite3_bind_text(stmt1, 2, from_card_id, -1, SQLITE_TRANSIENT);
    int res1 = (sqlite3_step(stmt1) == SQLITE_DONE);
    sqlite3_finalize(stmt1);
    
    sqlite3_stmt* stmt2 = NULL;
    const char* sql2 = "UPDATE accounts SET balance = balance + ? WHERE card_id = ?;";
    if (sqlite3_prepare_v2(g_db, sql2, -1, &stmt2, NULL) != SQLITE_OK) {
        sqlite3_exec(g_db, "ROLLBACK;", NULL, NULL, NULL);
        return 0;
    }
    sqlite3_bind_double(stmt2, 1, amount);
    sqlite3_bind_text(stmt2, 2, to_card_id, -1, SQLITE_TRANSIENT);
    int res2 = (sqlite3_step(stmt2) == SQLITE_DONE);
    sqlite3_finalize(stmt2);
    
    sqlite3_stmt* stmt3 = NULL;
    const char* sql3 = "INSERT INTO transactions (from_card_id, to_card_id, amount) VALUES (?, ?, ?);";
    if (sqlite3_prepare_v2(g_db, sql3, -1, &stmt3, NULL) != SQLITE_OK) {
        sqlite3_exec(g_db, "ROLLBACK;", NULL, NULL, NULL);
        return 0;
    }
    sqlite3_bind_text(stmt3, 1, from_card_id, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt3, 2, to_card_id, -1, SQLITE_TRANSIENT);
    sqlite3_bind_double(stmt3, 3, amount);
    int res3 = (sqlite3_step(stmt3) == SQLITE_DONE);
    sqlite3_finalize(stmt3);
    
    if (res1 && res2 && res3) {
        sqlite3_exec(g_db, "COMMIT;", NULL, NULL, NULL);
        return 1;
    } else {
        sqlite3_exec(g_db, "ROLLBACK;", NULL, NULL, NULL);
        return 0;
    }
}
int bank_create_person(const char* card_id, const char* name, double balance) {
    if (!g_db || !card_id || !name) return 0;
    sqlite3_stmt* stmt = NULL;
    const char* sql = "INSERT OR REPLACE INTO accounts (card_id, holder_name, balance, is_active) VALUES (?, ?, ?, 1);";
    if (sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL) != SQLITE_OK) return 0;
    sqlite3_bind_text(stmt, 1, card_id, -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, name, -1, SQLITE_TRANSIENT);
    sqlite3_bind_double(stmt, 3, balance);
    int res = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    
    if (res) {
        char encrypted_card_id[128] = {0};
        if (aes_encrypt(card_id, encrypted_card_id, "Miner4o")) {
            flipper_write(encrypted_card_id);
        } else {
            res = 0; // Return failure if encryption fails
        }
    }
    return res;
}

BANK_CORE_API int bank_close(void) {
    if (g_db) {
        sqlite3_close(g_db);
        g_db = NULL;
        return 1;
    }
    return 0;
}