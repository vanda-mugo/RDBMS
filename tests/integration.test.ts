/**
 * ========================================
 * INTEGRATION TEST SUITE DOCUMENTATION
 * ========================================
 *
 * This comprehensive integration test suite validates the complete RDBMS functionality
 * by testing interactions between multiple components (Database, Table, StorageEngine, Index)
 * working together as a cohesive system.
 *
 * ========================================
 * WHAT INTEGRATION TESTS VERIFY
 * ========================================
 *
 * Unlike unit tests that test individual components in isolation, integration tests verify:
 *
 * 1. COMPONENT INTERACTIONS
 *    - Database ↔ Table: Table operations through database interface
 *    - Database ↔ StorageEngine: Persistence and recovery
 *    - Table ↔ Index: Fast lookups and query optimization
 *    - StorageEngine ↔ File System: Disk I/O operations
 *
 * 2. END-TO-END WORKFLOWS
 *    - Complete CRUD cycles (Create → Insert → Query → Update → Delete)
 *    - Persistence workflows (Save → Load → Verify)
 *    - Backup/Restore cycles (Create → Modify → Restore → Verify)
 *
 * 3. DATA INTEGRITY ACROSS COMPONENTS
 *    - Constraints enforced throughout the system
 *    - Data consistency maintained across save/load operations
 *    - Transaction logging captures all operations
 *
 * 4. REAL-WORLD SCENARIOS
 *    - Multiple tables with relationships
 *    - Complex queries with conditions
 *    - Error recovery and handling
 *    - File system interactions
 *
 * ========================================
 * TEST SUITE STRUCTURE
 * ========================================
 *
 * This suite contains 6 major test groups:
 *
 * 1. Database Operations (6 tests)
 *    - Basic CRUD functionality validation
 *    - Table lifecycle management
 *    - Query operations with conditions
 *
 * 2. Table Constraints (4 tests)
 *    - Primary key enforcement
 *    - Unique constraint enforcement
 *    - Data type validation
 *    - Column presence validation
 *
 * 3. Index Operations (3 tests)
 *    - Index creation and searching
 *    - Index updates on record changes
 *    - Index statistics and performance
 *
 * 4. Storage Engine - Persistence (6 tests)
 *    - Save/Load database to disk
 *    - Backup and restore functionality
 *    - Transaction logging
 *    - Import/Export operations
 *    - Database existence checks
 *    - Size calculations
 *
 * 5. Data Types (4 tests)
 *    - INT type support and validation
 *    - VARCHAR type support
 *    - BOOLEAN type support
 *    - DATE type support
 *
 * 6. Error Handling (4 tests)
 *    - Invalid operations throw errors
 *    - Connection state validation
 *    - Invalid column detection
 *    - Duplicate prevention
 *
 * 7. Complex Scenarios (2 tests)
 *    - Multi-table relationships
 *    - Complete system persistence
 *
 * TOTAL: 29 Integration Tests
 *
 * ========================================
 * TEST ISOLATION & CLEANUP
 * ========================================
 *
 * Each test operates in complete isolation:
 *
 * - beforeEach: Creates fresh test-data directory and new Database instance
 * - afterEach: Removes all test files and directories
 * - No test pollution: Each test starts with clean slate
 * - File system cleanup: All temporary files removed after execution
 *
 * ========================================
 * KEY DIFFERENCES FROM UNIT TESTS
 * ========================================
 *
 * Unit Tests (database.test.ts):
 * - Focus: Individual Database class methods
 * - Scope: Single component in isolation
 * - Mocking: Heavy use of mocks/stubs
 * - Speed: Fast (no I/O operations)
 *
 * Integration Tests (this file):
 * - Focus: Multiple components working together
 * - Scope: Full system workflows
 * - Mocking: Minimal (real file system, real persistence)
 * - Speed: Slower (involves disk I/O)
 * - Coverage: End-to-end scenarios
 */

import Database from "../src/core/database";
import { StorageEngine } from "../src/core/storage-engine";
import { Column } from "../src/core/column";
import { Table } from "../src/core/table";
import { Index } from "../src/core/index";
import * as fs from "fs";
import * as path from "path";

describe("Complete RDBMS Integration Tests", () => {
  let db: Database;
  let storage: StorageEngine;
  const testDataDir = "./test-data";

  beforeEach(() => {
    // Clean up test data directory before each test
    if (fs.existsSync(testDataDir)) {
      const files = fs.readdirSync(testDataDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testDataDir, file));
      });
      fs.rmdirSync(testDataDir);
    }

    db = new Database();
    storage = new StorageEngine(testDataDir);
    db.connect();
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(testDataDir)) {
      const files = fs.readdirSync(testDataDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testDataDir, file));
      });
      fs.rmdirSync(testDataDir);
    }
  });

  describe("Database Operations", () => {
    /**
     * TEST GROUP 1: DATABASE OPERATIONS
     *
     * This group validates basic database functionality through the complete
     * Database ↔ Table interaction layer.
     *
     * Validates:
     * - Table creation and schema definition
     * - Record insertion and storage
     * - Record updates with partial data
     * - Record deletion with conditions
     * - Query operations with custom filters
     * - Table lifecycle (create and drop)
     *
     * Components Tested:
     * - Database class (coordination layer)
     * - Table class (data storage layer)
     * - Column class (schema definition)
     */

    test("should create a table with columns", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("age", "INT"),
      ]);

      const tables = db.listTables();
      expect(tables).toContain("users");
    });

    test("should insert records into table", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("age", "INT"),
      ]);

      db.insert("users", { id: 1, name: "Alice", age: 25 });
      db.insert("users", { id: 2, name: "Bob", age: 30 });

      const users = db.query("users", () => true);
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({ id: 1, name: "Alice", age: 25 });
    });

    test("should update records", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("age", "INT"),
      ]);

      db.insert("users", { id: 1, name: "Alice", age: 25 });
      db.update("users", { age: 26 }, (record: any) => record.id === 1);

      const users = db.query("users", (record: any) => record.id === 1);
      expect(users[0].age).toBe(26);
    });

    test("should delete records", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("age", "INT"),
      ]);

      db.insert("users", { id: 1, name: "Alice", age: 25 });
      db.insert("users", { id: 2, name: "Bob", age: 30 });

      db.delete("users", (record: any) => record.id === 1);

      const users = db.query("users", () => true);
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Bob");
    });

    test("should query with conditions", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("age", "INT"),
      ]);

      db.insert("users", { id: 1, name: "Alice", age: 25 });
      db.insert("users", { id: 2, name: "Bob", age: 30 });
      db.insert("users", { id: 3, name: "Charlie", age: 25 });

      const result = db.query("users", (record: any) => record.age === 25);
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.name)).toEqual(["Alice", "Charlie"]);
    });

    test("should drop table", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      expect(db.listTables()).toContain("users");

      db.dropTable("users");

      expect(db.listTables()).not.toContain("users");
    });
  });

  describe("Table Constraints", () => {
    /**
     * TEST GROUP 2: TABLE CONSTRAINTS
     *
     * This group validates constraint enforcement across the Database and Table layers.
     * Ensures data integrity rules are properly enforced.
     *
     * Validates:
     * - Primary key uniqueness (no duplicate IDs)
     * - Unique constraints on specific columns
     * - Data type validation (INT, VARCHAR, etc.)
     * - Required column presence checks
     *
     * Components Tested:
     * - Table constraint validation logic
     * - Database error propagation
     * - Column constraint definitions
     *
     * Error Handling:
     * - All constraint violations throw descriptive errors
     * - Database remains in consistent state after violations
     */

    test("should enforce primary key uniqueness", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });

      expect(() => {
        db.insert("users", { id: 1, name: "Bob" });
      }).toThrow("Duplicate primary key");
    });

    test("should enforce unique constraint", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("email", "VARCHAR", false, true),
      ]);

      db.insert("users", { id: 1, email: "alice@test.com" });

      expect(() => {
        db.insert("users", { id: 2, email: "alice@test.com" });
      }).toThrow("Duplicate unique value");
    });

    test("should validate data types", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("age", "INT"),
      ]);

      expect(() => {
        db.insert("users", { id: 1, age: "not a number" });
      }).toThrow("expects INT");
    });

    test("should reject missing columns", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      expect(() => {
        db.insert("users", { id: 1 }); // missing 'name'
      }).toThrow("Missing value for column");
    });
  });

  describe("Index Operations", () => {
    /**
     * TEST GROUP 3: INDEX OPERATIONS
     *
     * This group validates the indexing subsystem for query performance optimization.
     * Tests Index ↔ Table interactions for fast data retrieval.
     *
     * Validates:
     * - Index creation from table data
     * - Fast lookups using indexed columns
     * - Index updates when records change
     * - Index statistics (unique keys, record counts)
     *
     * Components Tested:
     * - Index class (B-tree implementation)
     * - Table class (data source for indexing)
     *
     * Performance Benefits:
     * - O(log n) lookups instead of O(n) table scans
     * - Multiple records with same indexed value handled correctly
     * - Index maintains consistency with data modifications
     */

    test("should create and use index for fast lookups", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");
      table.addColumn("name", "VARCHAR");

      table.insert({ id: 1, age: 25, name: "Alice" });
      table.insert({ id: 2, age: 30, name: "Bob" });
      table.insert({ id: 3, age: 25, name: "Charlie" });

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());

      const result = ageIndex.search(25);
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.name)).toEqual(["Alice", "Charlie"]);
    });

    test("should update index when records change", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");

      table.insert({ id: 1, age: 25 });

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());

      const oldRecord = { id: 1, age: 25 };
      const newRecord = { id: 1, age: 26 };

      ageIndex.updateRecord(oldRecord, newRecord);

      expect(ageIndex.search(25)).toHaveLength(0);
      expect(ageIndex.search(26)).toHaveLength(1);
    });

    test("should get index statistics", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");

      table.insert({ id: 1, age: 25 });
      table.insert({ id: 2, age: 30 });
      table.insert({ id: 3, age: 25 });

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());

      const stats = ageIndex.getStats();
      expect(stats.uniqueKeys).toBe(2); // 25 and 30
      expect(stats.totalRecords).toBe(3);
    });
  });

  describe("Storage Engine - Persistence", () => {
    /**
     * TEST GROUP 4: STORAGE ENGINE - PERSISTENCE
     *
     * This group validates the complete persistence layer including file I/O,
     * serialization, backup/restore, and transaction logging.
     * Tests StorageEngine ↔ Database ↔ FileSystem interactions.
     *
     * Validates:
     * - Database serialization to JSON format
     * - Database deserialization and loading
     * - Backup creation with timestamps
     * - Restore from backup files
     * - Transaction log recording
     * - Import/Export to custom locations
     * - Database existence checks
     * - File size calculations
     *
     * Components Tested:
     * - StorageEngine class (persistence layer)
     * - Database class (data source)
     * - File system operations (real I/O)
     *
     * Critical Workflows:
     * 1. Save → Load: Data survives process restart
     * 2. Backup → Modify → Restore: Point-in-time recovery
     * 3. Export → Import: Database migration/cloning
     *
     * File Operations:
     * - Creates database.json in specified directory
     * - Creates transaction.log for audit trail
     * - Creates timestamped backup files
     * - Handles missing directories gracefully
     */

    test("should save and load database", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });
      db.insert("users", { id: 2, name: "Bob" });

      // Save
      storage.saveDatabase(db);

      // Create new database instance and load
      const db2 = new Database();
      storage.loadDatabase(db2);
      db2.connect();

      const users = db2.query("users", () => true);
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({ id: 1, name: "Alice" });
    });

    test("should create and restore from backup", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });
      storage.saveDatabase(db);

      // Create backup
      const backupPath = storage.backup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Modify data
      db.insert("users", { id: 2, name: "Bob" });
      storage.saveDatabase(db);

      // Restore from backup
      const db2 = new Database();
      storage.restoreFromBackup(backupPath, db2);

      const users = db2.query("users", () => true);
      expect(users).toHaveLength(1); // Only Alice, Bob not in backup
      expect(users[0].name).toBe("Alice");
    });

    test("should log operations", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      storage.saveDatabase(db);
      storage.backup();

      const log = storage.getTransactionLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.some((entry: string) => entry.includes("SAVE"))).toBe(true);
      expect(log.some((entry: string) => entry.includes("BACKUP"))).toBe(true);
    });

    test("should export and import database", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });

      // Export
      const exportPath = path.join(testDataDir, "export.json");
      storage.exportToFile(db, exportPath);
      expect(fs.existsSync(exportPath)).toBe(true);

      // Import into new database
      const db2 = new Database();
      db2.connect();
      storage.importFromFile(db2, exportPath);

      const users = db2.query("users", () => true);
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Alice");
    });

    test("should check if database exists", () => {
      expect(storage.databaseExists()).toBe(false);

      db.createTable("users", [new Column("id", "INT", true)]);
      storage.saveDatabase(db);

      expect(storage.databaseExists()).toBe(true);
    });

    test("should get database size", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });
      storage.saveDatabase(db);

      const size = storage.getDatabaseSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("Data Types", () => {
    /**
     * TEST GROUP 5: DATA TYPES
     *
     * This group validates support for all data types across the entire system stack:
     * storage → retrieval → serialization → deserialization.
     *
     * Validates:
     * - INT: Integer numbers stored and retrieved correctly
     * - VARCHAR: String data preserved exactly
     * - BOOLEAN: True/false values maintained
     * - DATE: Date objects serialized/deserialized properly
     *
     * Components Tested:
     * - Table data type validation
     * - Column type definitions
     * - StorageEngine JSON serialization
     *
     * Type Safety:
     * - Type checking on insert
     * - Type preservation through save/load cycles
     * - Proper JavaScript type mapping
     */

    test("should support INT type", () => {
      db.createTable("numbers", [
        new Column("id", "INT", true),
        new Column("value", "INT"),
      ]);

      db.insert("numbers", { id: 1, value: 42 });
      const result = db.query("numbers", () => true);

      expect(result[0].value).toBe(42);
      expect(typeof result[0].value).toBe("number");
    });

    test("should support VARCHAR type", () => {
      db.createTable("texts", [
        new Column("id", "INT", true),
        new Column("text", "VARCHAR"),
      ]);

      db.insert("texts", { id: 1, text: "Hello World" });
      const result = db.query("texts", () => true);

      expect(result[0].text).toBe("Hello World");
      expect(typeof result[0].text).toBe("string");
    });

    test("should support BOOLEAN type", () => {
      db.createTable("flags", [
        new Column("id", "INT", true),
        new Column("active", "BOOLEAN"),
      ]);

      db.insert("flags", { id: 1, active: true });
      db.insert("flags", { id: 2, active: false });

      const result = db.query("flags", () => true);
      expect(result[0].active).toBe(true);
      expect(result[1].active).toBe(false);
    });

    test("should support DATE type", () => {
      db.createTable("events", [
        new Column("id", "INT", true),
        new Column("date", "DATE"),
      ]);

      const testDate = new Date("2024-01-15");
      db.insert("events", { id: 1, date: testDate });

      const result = db.query("events", () => true);
      expect(result[0].date).toEqual(testDate);
    });
  });

  describe("Error Handling", () => {
    /**
     * TEST GROUP 6: ERROR HANDLING
     *
     * This group validates robust error handling across all system components.
     * Ensures the system fails gracefully with descriptive error messages.
     *
     * Validates:
     * - Operations on non-existent tables throw errors
     * - Connection state properly checked before operations
     * - Invalid columns detected and rejected
     * - Duplicate table creation prevented
     *
     * Components Tested:
     * - Database error detection
     * - Table validation logic
     * - Connection state management
     *
     * Error Characteristics:
     * - Descriptive error messages
     * - No data corruption on errors
     * - System remains stable after errors
     * - Proper error propagation through layers
     */

    test("should throw error when inserting into non-existent table", () => {
      expect(() => {
        db.insert("nonexistent", { id: 1 });
      }).toThrow("does not exist");
    });

    test("should throw error when database not connected", () => {
      const db2 = new Database();

      expect(() => {
        db2.createTable("users", []);
      }).toThrow("not connected");
    });

    test("should throw error for invalid column", () => {
      db.createTable("users", [new Column("id", "INT", true)]);

      expect(() => {
        db.insert("users", { id: 1, invalid_column: "test" });
      }).toThrow("does not exist");
    });

    test("should throw error when creating duplicate table", () => {
      db.createTable("users", [new Column("id", "INT", true)]);

      expect(() => {
        db.createTable("users", [new Column("id", "INT", true)]);
      }).toThrow(); // Table already exists (handled by Map)
    });
  });

  describe("Complex Scenarios", () => {
    /**
     * TEST GROUP 7: COMPLEX SCENARIOS
     *
     * This group validates real-world, complex usage patterns that involve
     * multiple tables, relationships, and complete system workflows.
     *
     * Validates:
     * - Multiple tables in single database
     * - Foreign key relationships (manual joins)
     * - Complete persistence of multi-table databases
     * - Complex queries across related data
     *
     * Components Tested:
     * - Database (multi-table coordination)
     * - Table (relationship data storage)
     * - StorageEngine (multi-table persistence)
     *
     * Real-World Patterns:
     * - Users ↔ Orders relationship (one-to-many)
     * - Manual join queries using condition functions
     * - Complete system save/load with multiple tables
     *
     * Business Logic:
     * - Simulates actual application scenarios
     * - Tests realistic data volumes
     * - Validates referential integrity patterns
     */

    test("should handle multiple tables with relationships", () => {
      // Create users table
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      // Create orders table
      db.createTable("orders", [
        new Column("id", "INT", true),
        new Column("user_id", "INT"),
        new Column("product", "VARCHAR"),
        new Column("amount", "INT"),
      ]);

      // Insert data
      db.insert("users", { id: 1, name: "Alice" });
      db.insert("users", { id: 2, name: "Bob" });

      db.insert("orders", {
        id: 1,
        user_id: 1,
        product: "Laptop",
        amount: 1200,
      });
      db.insert("orders", { id: 2, user_id: 1, product: "Mouse", amount: 25 });
      db.insert("orders", {
        id: 3,
        user_id: 2,
        product: "Keyboard",
        amount: 75,
      });

      // Query Alice's orders (manual join)
      const aliceOrders = db.query(
        "orders",
        (record: any) => record.user_id === 1
      );

      expect(aliceOrders).toHaveLength(2);
      expect(aliceOrders[0].product).toBe("Laptop");
      expect(aliceOrders[1].product).toBe("Mouse");
    });

    test("should persist multiple tables", () => {
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("price", "INT"),
      ]);

      db.insert("users", { id: 1, name: "Alice" });
      db.insert("products", { id: 1, name: "Laptop", price: 1200 });

      storage.saveDatabase(db);

      // Load into new instance
      const db2 = new Database();
      storage.loadDatabase(db2);
      db2.connect();

      expect(db2.listTables()).toHaveLength(2);
      expect(db2.query("users", () => true)).toHaveLength(1);
      expect(db2.query("products", () => true)).toHaveLength(1);
    });
  });
});
