# Simple RDBMS

A lightweight relational database management system implemented in TypeScript with SQL support, persistent storage, and both command-line and web interfaces.

## Features

- SQL query execution (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE)
- Interactive REPL with command history
- Web-based management interface
- Persistent JSON-based storage
- Backup and restore functionality
- Multi-table support with indexing
- Transaction logging
- Primary key and unique constraints

## Installation

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- Git

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vanda-mugo/RDBMS.git
   cd RDBMS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   This will install all required packages including TypeScript, Express, Jest, and other dependencies defined in `package.json`.

3. **Build the project:**
   ```bash
   npm run build
   ```
   This compiles TypeScript files from `src/` into JavaScript in the `dist/` directory.

4. **Verify installation:**
   ```bash
   npm test
   ```
   Run the test suite to ensure everything is set up correctly.

The project will automatically create a `./data` directory on first run to store the database file and backups.

## Running the Application

### REPL Mode

Start the interactive command-line interface:

```bash
npm start repl
```

The REPL provides a command-line interface for direct database interaction with full SQL support and data management capabilities.

#### Available Commands

**SQL Commands:**

The REPL supports standard SQL operations with real-time execution:

```sql
-- Create tables with multiple columns and constraints
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR, email VARCHAR UNIQUE, age INT)
CREATE TABLE orders (order_id INT PRIMARY KEY, user_id INT, product VARCHAR, quantity INT)

-- Insert single or multiple records
INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@example.com', 30)
INSERT INTO orders (order_id, user_id, product, quantity) VALUES (1, 1, 'Laptop', 2)

-- Query with various filters and projections
SELECT * FROM users
SELECT name, email FROM users WHERE age > 25
SELECT * FROM users WHERE email = 'alice@example.com'
SELECT name FROM users WHERE age > 18 AND age < 65

-- Update records with conditional filtering
UPDATE users SET age = 31 WHERE id = 1
UPDATE users SET email = 'newemail@example.com' WHERE name = 'Alice'

-- Delete records based on conditions
DELETE FROM users WHERE age < 18
DELETE FROM orders WHERE quantity = 0

-- Drop tables when no longer needed
DROP TABLE users
DROP TABLE orders
```

**Key Capabilities:**
- Create unlimited tables with custom schemas
- Support for multiple data types (INT, VARCHAR, BOOLEAN, DATE)
- Primary key and unique constraint enforcement
- WHERE clause filtering with comparison operators (=, >, <, >=, <=)
- AND/OR logical operators in WHERE clauses
- Column projection (select specific columns)
- Automatic data type validation
- Real-time query results displayed in formatted tables

**Utility Commands:**
- `TABLES` - List all tables in the database with their schemas
- `SAVE` - Manually save database to disk (auto-saves after each operation)
- `BACKUP` - Create a timestamped backup file in `./data/`
- `BACKUPS` - Display all available backup files with timestamps
- `RESTORE <path>` - Restore database from a specific backup file
- `EXIT` - Exit REPL (automatically saves before closing)

**REPL Features:**
- Command history with arrow key navigation
- Multi-line SQL support
- Syntax error detection and helpful error messages
- Automatic persistence after every write operation
- Color-coded output for better readability
- Transaction logging for audit trails

### Web Application Mode

Start the web server:

```bash
npm start web
```

Access the application at `http://localhost:3000`

The web interface provides a visual, user-friendly way to manage your database with a modern, tabbed interface for different operations.

#### Web Interface Features

**Records Tab:**

Manage data in your tables with a complete CRUD interface:
- **View Records**: Browse all records in the selected table with a responsive data grid
- **Add Records**: Fill out a dynamically generated form based on table schema
  - Form fields automatically match column data types
  - Required field validation for primary keys
  - Real-time constraint validation (unique, primary key)
- **Edit Records**: Click edit button to modify existing records inline
  - Pre-populated forms with current values
  - Preserves data integrity during updates
- **Delete Records**: Remove individual records with confirmation
- **Switch Tables**: Dropdown selector to view different tables
- **Search/Filter**: (If implemented) Find specific records quickly
- **Pagination**: (If implemented) Handle large datasets efficiently

**Tables Tab:**

Complete table schema management:
- **Create Tables**: 
  - Define table name (case-insensitive)
  - Add multiple columns with individual configurations
  - Specify data types from dropdown (INT, VARCHAR, BOOLEAN, DATE)
  - Set primary key constraints (one per table)
  - Mark columns as unique to prevent duplicates
  - Add/remove columns dynamically before creation
- **View Schemas**: See complete table structure with all column definitions
- **Drop Tables**: Delete entire tables with confirmation dialog
- **Table List**: View all existing tables in sidebar
- **Schema Validation**: Automatic checks for valid table structures

**Statistics Tab:**

Database monitoring and backup management:
- **Database Statistics**:
  - Total number of tables
  - Record count per table
  - Total records across all tables
  - Database file size
  - Last modified timestamp
- **Backup Management**:
  - Create new backups with single click
  - View all available backups in chronological order
  - See backup file sizes and creation timestamps
  - Restore from any backup with confirmation dialog
  - Automatic success/failure notifications
- **Storage Information**:
  - Current data directory location
  - Available disk space (if implemented)
  - Transaction log status

**General Web Features:**
- **Responsive Design**: Works on desktop and mobile browsers
- **Real-time Updates**: Changes reflect immediately across all tabs
- **Error Handling**: User-friendly error messages for validation failures
- **Confirmation Dialogs**: Prevent accidental deletions or overwrites
- **Modern UI**: Clean, gradient-themed interface with intuitive navigation
- **Auto-refresh**: Table lists and statistics update after operations
- **RESTful API**: All operations backed by JSON API endpoints
- **Shared Storage**: Changes visible in REPL immediately and vice versa

### Running Tests

Execute the test suite:

```bash
npm test
```

Run specific test files:

```bash
npm test -- database.test.ts
npm test -- integration.test.ts
```

## Core Components

### Database (`src/core/database.ts`)
Central database manager that coordinates all operations. Maintains table registry, validates connections, and routes CRUD operations to appropriate tables. Implements case-insensitive table name handling.

### Table (`src/core/table.ts`)
Represents individual database tables. Manages column definitions, validates data types, enforces constraints (primary keys, unique values), and maintains in-memory record storage.

### Column (`src/core/column.ts`)
Defines table schema with column properties including name, data type (INT, VARCHAR, BOOLEAN, DATE), primary key status, and uniqueness constraints.

### Index (`src/core/index.ts`)
Implements B-tree-based indexing for faster query operations. Supports unique and non-unique indexes on any column to optimize WHERE clause filtering.

### QueryExecutor (`src/core/query-executor.ts`)
SQL parser and executor using regex-based pattern matching. Parses SQL strings into structured queries, validates syntax, and executes operations against the database. Handles SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, and DROP TABLE statements.

### StorageEngine (`src/core/storage-engine.ts`)
Handles database persistence to JSON files. Provides serialization/deserialization, backup creation, restore functionality, and transaction logging. Automatically ensures data directory exists and maintains file integrity.

## Data Persistence

Both REPL and Web Application share the same database stored in `./data/`:

- `database.json` - Main database file with all tables and records
- `transaction.log` - Operation history log
- `database-backup-*.json` - Timestamped backup files

All modifications are automatically saved to disk. The database is loaded on startup and persisted after every write operation.

## Architecture

```
User Input (SQL or Web Request)
         ↓
   QueryExecutor (Parse & Validate)
         ↓
   Database (Route Operation)
         ↓
   Table (Execute & Validate)
         ↓
   StorageEngine (Persist)
         ↓
   JSON File (./data/database.json)
```

## Data Types

Supported column types:
- `INT` - Integer numbers
- `VARCHAR` - Variable-length strings
- `BOOLEAN` - True/false values
- `DATE` - ISO date strings

## Constraints

- **PRIMARY KEY** - Unique identifier, no duplicates, required
- **UNIQUE** - No duplicate values allowed
- Automatic type validation on insert/update
- Case-insensitive table names

## Example Workflow

```bash
# Start REPL
npm start repl

# Create a table
RDBMS> CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR, price INT)

# Insert data
RDBMS> INSERT INTO products (id, name, price) VALUES (1, 'Laptop', 999)

# Query data
RDBMS> SELECT * FROM products WHERE price > 500

# Create backup
RDBMS> BACKUP

# View tables
RDBMS> TABLES

# Exit (auto-saves)
RDBMS> EXIT
```

## Configuration

Default settings:
- Web server port: 3000
- Data directory: `./data`
- Backup format: `database-backup-YYYY-MM-DDTHH-MM-SS-MMMZ.json`

## Additional Documentation

For detailed technical architecture and system design, see [ARCHITECTURE.md](ARCHITECTURE.md).

