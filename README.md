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
- `SYNC` - Reload database from disk to synchronize with changes made in other interfaces
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
- **Database Synchronization**:
  - Click "Sync Database" button to reload data from disk
  - Synchronizes with changes made via REPL or external modifications
  - Available in Records, Tables, and Statistics tabs
  - Refreshes all views automatically after sync
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

## Database Synchronization

The SYNC feature enables seamless coordination between REPL and Web interfaces:

**Use Cases:**
- **Multi-Interface Workflow**: Make changes in the web interface, sync in REPL to see updates
- **External Modifications**: Manually edit `database.json`, sync to reload changes
- **Concurrent Sessions**: Synchronize when running both REPL and web server simultaneously
- **Fresh Start**: Reload database state after restore or backup operations

**How to Sync:**

**In REPL:**
```bash
RDBMS> SYNC
 Syncing database from disk...
 Database synced - loaded 6 table(s): users, products, orders, customers, inventory, logs
```

**In Web Interface:**
- Click "Sync Database" button in Records, Tables, or Statistics tab
- All views refresh automatically after successful sync
- Status messages confirm sync completion

**Technical Details:**
- Clears in-memory database state
- Reloads fresh data from `./data/database.json`
- Maintains data consistency across interfaces
- Safe concurrent operation with built-in locking

## Multi-Database Management

The system supports managing multiple independent databases, each with its own isolated tables, records, and storage. This feature enables organizing data into logical units (e.g., separate databases for production, development, testing, or different projects).

## Indexing

The system provides robust indexing capabilities to dramatically improve query performance. Indexes create optimized data structures that enable fast lookups, particularly for WHERE clause filtering.

### What Are Indexes?

An index is a data structure that improves the speed of data retrieval operations on a table at the cost of additional storage space and slower write operations. Think of it like a book's index - instead of reading every page to find a topic, you look it up in the index and jump directly to the relevant pages.

**Performance Impact:**
- **Without Index**: Query scans every record (O(n) - linear time)
- **With Index**: Direct lookup or range scan (O(1) for equality, O(k) for ranges where k = matching records)

**Example:**
```sql
-- Without index on 'price': Scans 100,000 records
SELECT * FROM products WHERE price = 299

-- With index on 'price': Direct hash lookup, finds record instantly
CREATE INDEX idx_price ON products(price)
SELECT * FROM products WHERE price = 299  -- 100,000x faster!


### Database Storage Structure

Each database is stored in its own subdirectory under `./data/`:

```
data/
├── default/                    # Default database (created automatically)
│   ├── database.json          # Main database file
│   └── transaction.log        # Operation history
├── production/                 # Custom database: production
│   ├── database.json
│   └── transaction.log
├── development/                # Custom database: development
│   ├── database.json
│   └── transaction.log
└── analytics/                  # Custom database: analytics
    ├── database.json
    └── transaction.log
```

**Note:** For backward compatibility, if `./data/database.json` exists (old format), it will be automatically migrated to `./data/default/database.json` on first run.

### Managing Databases via REPL

The REPL provides four commands for database management:

#### 1. **SHOW DATABASES** - List All Databases

View all available databases with their storage locations:

```bash
RDBMS> SHOW DATABASES
Available databases:
  • default (./data/default) [CURRENT]
  • production (./data/production)
  • development (./data/development)
  • analytics (./data/analytics)
```

The `[CURRENT]` indicator shows which database you're currently using.

#### 2. **CREATE DATABASE** - Create New Database

Create a new isolated database:

```bash
RDBMS> CREATE DATABASE testing
✓ Database 'testing' created at ./data/testing
```

**Features:**
- Automatically creates directory structure
- Initializes empty database with transaction log
- Database name must be valid (alphanumeric, hyphens, underscores)
- Cannot create duplicate databases

#### 3. **USE DATABASE** - Switch Active Database

Switch to a different database context:

```bash
RDBMS> USE DATABASE production
Saving current database 'default'...
✓ Database saved to ./data/default/database.json
Loading database 'production'...
✓ Database loaded from ./data/production/database.json
✓ Switched to database 'production'
Loaded 3 table(s): users, orders, products
```

**Behavior:**
- Automatically saves current database before switching
- Loads target database from disk
- All subsequent commands operate on the new database
- Table lists and operations are completely isolated

#### 4. **DROP DATABASE** - Delete Database

Remove a database and all its data:

```bash
RDBMS> DROP DATABASE testing
  Are you sure you want to delete database 'testing' and all its data? (yes/no): yes
✓ Database 'testing' deleted
```

**Safety Features:**
- Requires explicit confirmation (type "yes")
- Cannot drop the currently active database (switch first)
- Cannot drop the 'default' database (system protection)
- Permanently deletes all tables and records

### Managing Databases via Web Interface

The web interface provides a visual database management system accessible at `http://localhost:3000`.

#### Database Selector

Located in the top-right corner of the interface:

- **Current Database Dropdown**: Shows active database name
- **Switch Database**: Click dropdown and select different database
- **Visual Indicator**: Current database highlighted in the dropdown
- **Auto-Refresh**: All tabs refresh when database changes

#### Database Management Panel

Click "Manage Databases" button to open the management interface:

**Create New Database:**
1. Click "+ Create New Database" button
2. Enter database name in modal dialog
3. Click "Create" - new database appears in the list
4. Success notification confirms creation

**View Database List:**
- Card-based layout showing all databases
- Each card displays:
  - Database name
  - Storage path (e.g., `./data/production`)
  - Current database badge (if active)
  - Action buttons (Switch, Delete)

**Switch Database:**
1. Find target database in the list
2. Click "Switch" button
3. System automatically:
   - Saves current database
   - Loads target database
   - Refreshes all tabs (Records, Tables, Statistics)
   - Updates database selector

**Delete Database:**
1. Click "Delete" button on database card
2. Confirm deletion in dialog (cannot delete current database)
3. Database removed from list and storage deleted

**Visual Features:**
- Clean card-based UI with gradient styling
- Current database highlighted with badge
- Disabled delete button for active database
- Real-time status messages
- Modal dialogs for create/confirm operations

### Managing Databases via API

For programmatic access, the system exposes RESTful endpoints:

#### GET /api/databases
List all available databases:

```bash
curl http://localhost:3000/api/databases
```

**Response:**
```json
{
  "databases": ["default", "production", "development", "analytics"],
  "current": "default"
}
```

#### POST /api/databases
Create a new database:

```bash
curl -X POST http://localhost:3000/api/databases \
  -H "Content-Type: application/json" \
  -d '{"name": "testing"}'
```

**Response:**
```json
{
  "message": "Database 'testing' created",
  "path": "./data/testing"
}
```

#### POST /api/databases/switch
Switch to a different database:

```bash
curl -X POST http://localhost:3000/api/databases/switch \
  -H "Content-Type: application/json" \
  -d '{"name": "production"}'
```

**Response:**
```json
{
  "message": "Switched to database 'production'",
  "database": "production"
}
```

#### DELETE /api/databases/:name
Delete a database:

```bash
curl -X DELETE http://localhost:3000/api/databases/testing
```

**Response:**
```json
{
  "message": "Database 'testing' deleted"
}
```

**API Validation:**
- All endpoints validate database names
- Cannot delete current or default database
- Returns appropriate HTTP status codes (200, 400, 404, 500)
- JSON error messages for failures

### Use Cases for Multi-Database

**1. Environment Separation:**
```bash
# Development work
RDBMS> CREATE DATABASE development
RDBMS> USE DATABASE development
# ... work on features ...

# Production deployment
RDBMS> CREATE DATABASE production
RDBMS> USE DATABASE production
# ... production data ...
```

**2. Project Organization:**
```bash
# Different projects in same system
RDBMS> CREATE DATABASE project_alpha
RDBMS> CREATE DATABASE project_beta
RDBMS> USE DATABASE project_alpha
```

**3. Testing & Quality Assurance:**
```bash
# Create isolated test database
RDBMS> CREATE DATABASE test_suite
RDBMS> USE DATABASE test_suite
# ... run tests ...
RDBMS> DROP DATABASE test_suite
```

**4. Data Analytics:**
```bash
# Separate analytics database
RDBMS> CREATE DATABASE analytics
RDBMS> USE DATABASE analytics
CREATE TABLE metrics (...)
INSERT INTO metrics ...
```

### Database Isolation

Each database maintains complete isolation:

- **Tables**: Separate table registries (no name conflicts)
- **Records**: Independent data storage
- **Backups**: Database-specific backup files
- **Transactions**: Separate transaction logs
- **Schema**: Different table structures allowed

**Example of Isolation:**
```bash
# Database 'app1' has 'users' table
RDBMS> USE DATABASE app1
RDBMS> CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)

# Database 'app2' can have different 'users' table
RDBMS> USE DATABASE app2
RDBMS> CREATE TABLE users (user_id INT PRIMARY KEY, email VARCHAR, age INT)
# No conflict - completely isolated
```

### Best Practices

**Naming Conventions:**
- Use descriptive names: `production`, `development`, `staging`
- Allowed characters: letters, numbers, hyphens, underscores
- Avoid special characters or spaces
- Keep names short and meaningful

**Workflow Recommendations:**
1. **Always have a 'default' database** - It's created automatically and protected from deletion
2. **Create environment-specific databases** - Separate dev/test/prod data
3. **Use SHOW DATABASES frequently** - Know which database you're in
4. **Save before switching** - System auto-saves, but manual SAVE is safe
5. **Backup before DROP** - Create backup if you might need the data later
6. **Test in isolated databases** - Use temporary databases for experiments

**Safety Guidelines:**
- Cannot drop current database (switch first)
- Cannot drop 'default' database (system protection)
- DROP DATABASE requires confirmation
- Web interface disables delete for current database
- All operations logged to transaction.log

### Technical Implementation

**Storage Engine Multi-Database Support:**
- Static methods in `StorageEngine` class
- `listDatabases()` - Scans `./data/` directory
- `createDatabase(name)` - Creates directory structure
- `dropDatabase(name)` - Removes database directory
- Backward compatibility with old single-file format

**Database Class Extensions:**
- `getDatabaseName()` - Returns current database name
- `setDatabaseName(name)` - Updates database identifier
- Auto-saves current database before loading new one
- Maintains database context in memory

**REPL Command Handlers:**
- Pattern matching for database commands
- Input validation and error handling
- User-friendly confirmation prompts
- Colored output for better UX

**Web Interface Components:**
- Database selector dropdown (persistent across all tabs)
- Database management modal (create/view/delete)
- API integration for all database operations
- Real-time UI updates on database changes

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

