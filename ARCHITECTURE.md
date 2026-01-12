# Complete RDBMS Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Application                         │
│  (Web App, REPL, Scripts)                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    Query Executor                            │
│  • Parses SQL strings                                        │
│  • Validates syntax                                          │
│  • Translates to method calls                                │
│  • Handles SELECT, INSERT, UPDATE, DELETE, CREATE TABLE     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│  • Container for tables                                      │
│  • Manages connections                                       │
│  • Routes operations to tables                               │
│  • Methods: createTable, insert, update, delete, query      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                       Table                                  │
│  • Stores column definitions (schema)                        │
│  • Stores records (data)                                     │
│  • Enforces constraints                                      │
│  • Validates data types                                      │
│  • Methods: insert, update, delete, query, selectAll        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      Column                                  │
│  • Defines column metadata                                   │
│  • name, dataType (INT, VARCHAR, BOOLEAN, DATE)             │
│  • isPrimaryKey, isUnique flags                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       Index                                  │
│  • Maps column values to records                             │
│  • Provides O(1) lookups                                     │
│  • Methods: createIndex, search, addRecord, updateRecord    │
└─────────────────────────────────────────────────────────────┘

                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Storage Engine                             │
│  • Serializes database to JSON                               │
│  • Writes to disk (./data/database.json)                    │
│  • Loads from disk on startup                                │
│  • Methods: saveDatabase, loadDatabase, backup, restore     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    File System                               │
│  ./data/database.json       (main database)                 │
│  ./data/transaction.log     (operation log)                 │
│  ./data/database-backup-*   (timestamped backups)           │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: INSERT Operation

```
1. User Input
   ↓
   "INSERT INTO users (id, name) VALUES (1, 'Alice')"

2. Query Executor
   ↓
   Parses → { type: 'INSERT', tableName: 'users', data: { id: 1, name: 'Alice' } }

3. Database
   ↓
   db.insert('users', { id: 1, name: 'Alice' })

4. Table
   ↓
   • Validates columns exist
   • Validates data types (id is INT, name is VARCHAR)
   • Checks constraints (primary key unique, etc.)
   • Adds to records array

5. Index (if exists)
   ↓
   index.addRecord({ id: 1, name: 'Alice' })

6. Storage Engine (periodically)
   ↓
   storage.saveDatabase(db)
   → Writes to ./data/database.json
```

## Data Flow: SELECT with WHERE

```
1. User Input
   ↓
   "SELECT * FROM users WHERE age > 25"

2. Query Executor
   ↓
   Parses → { type: 'SELECT', tableName: 'users', where: { column: 'age', operator: '>', value: 25 } }

3. Database
   ↓
   db.query('users', (record) => record.age > 25)

4. Table
   ↓
   • Filters records using condition function
   • Returns matching records

5. Index (optional optimization)
   ↓
   index.rangeSearch(25, Infinity)
   → Returns records directly (faster)

6. Result
   ↓
   [{ id: 2, name: 'Bob', age: 30 }, { id: 4, name: 'Diana', age: 35 }]
```

## Component Relationships

```
Column ──┐
         │
         ├──> Table ──┐
         │            │
Index ───┘            ├──> Database ──> Storage Engine ──> Disk
                      │
Query Executor ───────┘
```

## Memory vs Disk

### In Memory (Fast Operations)
```
┌─────────────────────────────────────┐
│          RAM (Volatile)              │
│                                      │
│  Database {                          │
│    tables: {                         │
│      users: Table {                  │
│        columns: [Column, Column]     │
│        records: [                    │
│          { id: 1, name: 'Alice' },   │
│          { id: 2, name: 'Bob' }      │
│        ]                             │
│      }                               │
│    }                                 │
│  }                                   │
└─────────────────────────────────────┘
         ↓ (saveDatabase)
┌─────────────────────────────────────┐
│        Disk (Persistent)             │
│                                      │
│  ./data/database.json                │
│  {                                   │
│    "tables": {                       │
│      "users": {                      │
│        "columns": [...],             │
│        "records": [...]              │
│      }                               │
│    }                                 │
│  }                                   │
└─────────────────────────────────────┘
```

## Complete Example Workflow

```typescript
// ========== STARTUP ==========
const db = new Database();
const storage = new StorageEngine('./data');

// Load persisted data
storage.loadDatabase(db);
// → Reads ./data/database.json
// → Recreates all tables and records in memory

db.connect();

// ========== OPERATIONS ==========
// Create table (if first run)
db.createTable('users', [
  new Column('id', 'INT', true),
  new Column('name', 'VARCHAR')
]);

// Insert (happens in memory)
db.insert('users', { id: 1, name: 'Alice' });

// Create index for fast queries
const ageIndex = new Index('users', 'age');
ageIndex.createIndex(table.selectAll());

// Query with index
const results = ageIndex.search(25); // O(1) lookup

// ========== PERSISTENCE ==========
// Save to disk (periodically or on exit)
storage.saveDatabase(db);
// → Serializes entire database
// → Writes to ./data/database.json
// → Logs operation to transaction.log

// Create backup before risky operation
storage.backup();
// → Creates ./data/database-backup-2024-01-15T10-30-00.json

// ========== SHUTDOWN ==========
process.on('exit', () => {
  storage.saveDatabase(db);
});

// ========== NEXT STARTUP ==========
// Everything restored automatically!
storage.loadDatabase(db);
// → All tables, columns, and records back in memory
```

## File Structure on Disk

```
simple-rdbms-1/
├── src/
│   ├── core/
│   │   ├── column.ts          # Column metadata
│   │   ├── table.ts           # Table with records
│   │   ├── database.ts        # Database container
│   │   ├── index.ts           # Fast lookups
│   │   ├── query-executor.ts  # SQL parser
│   │   └── storage-engine.ts  # Persistence ✨
│   ├── parser/
│   │   ├── lexer.ts           # Tokenizer
│   │   ├── sql-parser.ts      # Parser
│   │   └── ast.ts             # AST types
│   ├── repl/
│   │   └── repl.ts            # Interactive CLI
│   └── web-demo/
│       ├── server.ts          # HTTP server
│       └── routes/api.ts      # REST endpoints
│
├── data/                       # Created at runtime
│   ├── database.json          # Main database file
│   ├── transaction.log        # Operation log
│   └── database-backup-*.json # Backups
│
└── examples/
    └── storage-engine-demo.ts # Demo script
```

## Performance Characteristics

| Operation | Without Index | With Index | Storage Engine |
|-----------|--------------|------------|----------------|
| Insert    | O(1)         | O(1)       | O(n) - only when saving |
| Select All| O(n)         | O(n)       | O(n) - only when loading |
| Select WHERE | O(n)      | O(1)       | - |
| Update    | O(n)         | O(log n)   | O(n) - only when saving |
| Delete    | O(n)         | O(log n)   | O(n) - only when saving |
| Save      | -            | -          | O(n) - serialize all |
| Load      | -            | -          | O(n) - deserialize all |

## Summary

This architecture provides:
-  **In-memory speed** for queries and updates
-  **Persistent storage** for data survival
-  **SQL interface** via Query Executor
-  **Indexing** for fast lookups
-  **ACID-like properties** (via backups)
-  **Clean separation of concerns**

Each component has a single, well-defined responsibility! 
