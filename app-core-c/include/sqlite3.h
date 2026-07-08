#ifndef SQLITE3_STUB_H
#define SQLITE3_STUB_H

/* 
 * WARNING: This is a minimal SQLite3 stub header to allow compilation of the
 * Flipper Bank core skeleton. Please replace this file and the corresponding
 * sqlite3.c with the official SQLite3 amalgamation source code from sqlite.org.
 */

#define SQLITE_OK           0   /* Successful result */
#define SQLITE_ERROR        1   /* Generic error */
#define SQLITE_ROW         100  /* sqlite3_step() has another row ready */
#define SQLITE_DONE        101  /* sqlite3_step() has finished executing */

#define SQLITE_TRANSIENT   ((void (*)(void*))-1)

typedef struct sqlite3 sqlite3;
typedef struct sqlite3_stmt sqlite3_stmt;

int sqlite3_open(const char *filename, sqlite3 **ppDb);
int sqlite3_close(sqlite3 *db);
int sqlite3_exec(
  sqlite3 *db,                               /* An open database */
  const char *sql,                           /* SQL to be evaluated */
  int (*callback)(void*,int,char**,char**),  /* Callback function */
  void *arg,                                 /* 1st argument to callback */
  char **errmsg                              /* Error msg written here */
);
int sqlite3_prepare_v2(
  sqlite3 *db,            /* Database handle */
  const char *zSql,       /* SQL statement, UTF-8 encoded */
  int nByte,              /* Maximum length of zSql in bytes. */
  sqlite3_stmt **ppStmt,  /* OUT: Statement handle */
  const char **pzTail     /* OUT: Pointer to unused portion of zSql */
);
int sqlite3_step(sqlite3_stmt *pStmt);
int sqlite3_finalize(sqlite3_stmt *pStmt);

const unsigned char *sqlite3_column_text(sqlite3_stmt *pStmt, int iCol);
double sqlite3_column_double(sqlite3_stmt *pStmt, int iCol);
int sqlite3_column_int(sqlite3_stmt *pStmt, int iCol);

int sqlite3_bind_text(sqlite3_stmt *pStmt, int idx, const char *val, int len, void (*destructor)(void*));
int sqlite3_bind_double(sqlite3_stmt *pStmt, int idx, double val);
int sqlite3_bind_int(sqlite3_stmt *pStmt, int idx, int val);

#endif /* SQLITE3_STUB_H */
