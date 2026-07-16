#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <windows.h>
#include <time.h>
#include <string.h>
#include <math.h>
#include "flipper_bank.h"
#include "sqlite3.h"

#pragma pack(push, 1)

// Account representation structure mapped into Electron FFI
typedef struct {
    char card_id[64];        // Unique hardware token/ID read from Flipper Zero
    char holder_name[128];   // Account owner name
    double balance;          // Account balance in standard currency
    int is_active;           // Boolean flag (1 = Active, 0 = Suspended)
} Account;

#pragma pack(pop)

int bank_init(const char* db_path){
    return 0;
}

int bank_read(const char* card_id, Account* out_account){
    return 0;
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