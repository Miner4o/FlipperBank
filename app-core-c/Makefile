# Flipper Bank Core DLL Makefile
# Target: Windows DLL compilation (uses MinGW GCC)

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c99 -Iinclude -DBUILDING_BANK_CORE_DLL
LDFLAGS = -shared
LDLIBS = -lkernel32 -lpthread

TARGET = bank_core.dll
SRCS = src/flipper_serial.c src/bank_core.c src/aes_crypt.c src/sqlite3.c
OBJS = $(SRCS:.c=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(LDFLAGS) -o $@ $^ $(LDLIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	del /Q /F src\*.o $(TARGET) 2>NUL || rm -f src/*.o $(TARGET)
