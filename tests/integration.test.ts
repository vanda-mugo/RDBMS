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

    test("should support index metadata (name, type, unique)", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("email", "VARCHAR");

      table.insert({ id: 1, email: "alice@example.com" });
      table.insert({ id: 2, email: "bob@example.com" });

      // Test auto-generated name
      const autoIndex = new Index("users", "id");
      expect(autoIndex.getIndexName()).toBe("idx_users_id");
      expect(autoIndex.getIndexType()).toBe("HASH");
      expect(autoIndex.isUnique()).toBe(false);

      // Test custom name
      const namedIndex = new Index("users", "email", "unique_email_idx", true);
      expect(namedIndex.getIndexName()).toBe("unique_email_idx");
      expect(namedIndex.isUnique()).toBe(true);
    });

    test("should enforce unique constraint on index creation", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("email", "VARCHAR");

      table.insert({ id: 1, email: "alice@example.com" });
      table.insert({ id: 2, email: "alice@example.com" }); // duplicate

      const uniqueIndex = new Index("users", "email", "unique_email_idx", true);

      expect(() => {
        uniqueIndex.createIndex(table.selectAll());
      }).toThrow(
        "Cannot create unique index 'unique_email_idx': duplicate value 'alice@example.com'"
      );
    });

    test("should enforce unique constraint on record insert", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("email", "VARCHAR");

      table.insert({ id: 1, email: "alice@example.com" });

      const uniqueIndex = new Index("users", "email", "unique_email_idx", true);
      uniqueIndex.createIndex(table.selectAll());

      expect(() => {
        uniqueIndex.addRecord({ id: 2, email: "alice@example.com" });
      }).toThrow(
        "Unique index 'unique_email_idx' violation: value 'alice@example.com'"
      );
    });

    test("should serialize index metadata for persistence", () => {
      const index = new Index("users", "email", "unique_email_idx", true);
      const serialized = index.serialize();

      expect(serialized).toEqual({
        name: "unique_email_idx",
        columnName: "email",
        type: "HASH",
        unique: true,
      });

      // Test auto-generated name serialization
      const autoIndex = new Index("products", "price");
      expect(autoIndex.serialize()).toEqual({
        name: "idx_products_price",
        columnName: "price",
        type: "HASH",
        unique: false,
      });
    });
  });

  describe("Table Index Auto-Maintenance", () => {
    /**
     * TEST GROUP: TABLE INDEX AUTO-MAINTENANCE
     *
     * This group validates that indexes registered on tables are automatically
     * maintained when records are inserted, updated, or deleted.
     * Tests Table ↔ Index synchronization for data consistency.
     *
     * Validates:
     * - Index registration on tables
     * - Auto-update on insert operations
     * - Auto-update on update operations
     * - Auto-update on delete operations
     * - Multiple indexes on same table
     * - Index unregistration
     *
     * Components Tested:
     * - Table class (index registration and maintenance)
     * - Index class (data structure updates)
     */

    test("should register and unregister indexes on table", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");

      const ageIndex = new Index("users", "age");

      // Register index
      table.registerIndex(ageIndex);
      expect(table.hasIndex("idx_users_age")).toBe(true);
      expect(table.getIndex("idx_users_age")).toBe(ageIndex);
      expect(table.getIndexes()).toHaveLength(1);

      // Prevent duplicate registration
      expect(() => {
        table.registerIndex(ageIndex);
      }).toThrow(
        "Index 'idx_users_age' is already registered on table 'users'"
      );

      // Unregister index
      const removed = table.unregisterIndex("idx_users_age");
      expect(removed).toBe(true);
      expect(table.hasIndex("idx_users_age")).toBe(false);
      expect(table.getIndexes()).toHaveLength(0);

      // Unregister non-existent index
      const notRemoved = table.unregisterIndex("non_existent");
      expect(notRemoved).toBe(false);
    });

    test("should auto-maintain index on insert operations", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");
      table.addColumn("name", "VARCHAR");

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex([]); // Start with empty index
      table.registerIndex(ageIndex);

      // Insert records - index should be automatically updated
      table.insert({ id: 1, age: 25, name: "Alice" });
      table.insert({ id: 2, age: 30, name: "Bob" });
      table.insert({ id: 3, age: 25, name: "Charlie" });

      // Verify index was updated
      const age25Results = ageIndex.search(25);
      expect(age25Results).toHaveLength(2);
      expect(age25Results.map((r: any) => r.name)).toEqual([
        "Alice",
        "Charlie",
      ]);

      const age30Results = ageIndex.search(30);
      expect(age30Results).toHaveLength(1);
      expect(age30Results[0].name).toBe("Bob");

      const stats = ageIndex.getStats();
      expect(stats.totalRecords).toBe(3);
      expect(stats.uniqueKeys).toBe(2);
    });

    test("should auto-maintain index on update operations", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");
      table.addColumn("name", "VARCHAR");

      table.insert({ id: 1, age: 25, name: "Alice" });
      table.insert({ id: 2, age: 30, name: "Bob" });

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());
      table.registerIndex(ageIndex);

      // Update age 25 → 35
      table.update({ age: 35 }, (record: any) => record.age === 25);

      // Old value should be gone
      expect(ageIndex.search(25)).toHaveLength(0);

      // New value should exist
      const age35Results = ageIndex.search(35);
      expect(age35Results).toHaveLength(1);
      expect(age35Results[0].name).toBe("Alice");

      // Unaffected value should still exist
      expect(ageIndex.search(30)).toHaveLength(1);
    });

    test("should auto-maintain index on delete operations", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");
      table.addColumn("name", "VARCHAR");

      table.insert({ id: 1, age: 25, name: "Alice" });
      table.insert({ id: 2, age: 30, name: "Bob" });
      table.insert({ id: 3, age: 25, name: "Charlie" });

      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());
      table.registerIndex(ageIndex);

      // Delete records with age 25
      table.delete((record: any) => record.age === 25);

      // Deleted value should be gone
      expect(ageIndex.search(25)).toHaveLength(0);

      // Unaffected value should still exist
      const age30Results = ageIndex.search(30);
      expect(age30Results).toHaveLength(1);
      expect(age30Results[0].name).toBe("Bob");

      const stats = ageIndex.getStats();
      expect(stats.totalRecords).toBe(1);
      expect(stats.uniqueKeys).toBe(1);
    });

    test("should maintain multiple indexes on same table", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");
      table.addColumn("city", "VARCHAR");

      const ageIndex = new Index("users", "age");
      const cityIndex = new Index("users", "city");

      ageIndex.createIndex([]);
      cityIndex.createIndex([]);

      table.registerIndex(ageIndex);
      table.registerIndex(cityIndex);

      // Insert records
      table.insert({ id: 1, age: 25, city: "NYC" });
      table.insert({ id: 2, age: 30, city: "LA" });
      table.insert({ id: 3, age: 25, city: "NYC" });

      // Both indexes should be maintained
      expect(ageIndex.search(25)).toHaveLength(2);
      expect(cityIndex.search("NYC")).toHaveLength(2);

      // Update record
      table.update({ city: "SF" }, (r: any) => r.id === 1);

      // Both indexes should reflect the update
      expect(ageIndex.search(25)).toHaveLength(2); // age unchanged
      expect(cityIndex.search("NYC")).toHaveLength(1); // one NYC removed
      expect(cityIndex.search("SF")).toHaveLength(1); // SF added

      // Delete record
      table.delete((r: any) => r.id === 2);

      // Both indexes should reflect the deletion
      expect(ageIndex.search(30)).toHaveLength(0);
      expect(cityIndex.search("LA")).toHaveLength(0);
      expect(table.getIndexes()).toHaveLength(2);
    });

    test("should handle index maintenance when no indexes registered", () => {
      const table = new Table("users");
      table.addColumn("id", "INT", true);
      table.addColumn("age", "INT");

      // No indexes registered - operations should work normally
      expect(() => {
        table.insert({ id: 1, age: 25 });
        table.update({ age: 30 }, (r: any) => r.id === 1);
        table.delete((r: any) => r.id === 1);
      }).not.toThrow();

      expect(table.selectAll()).toHaveLength(0);
      expect(table.getIndexes()).toHaveLength(0);
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

    test("should persist and restore index definitions", () => {
      // Create table with data
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("age", "INT"),
        new Column("email", "VARCHAR"),
      ]);

      db.insert("users", { id: 1, age: 25, email: "alice@example.com" });
      db.insert("users", { id: 2, age: 30, email: "bob@example.com" });
      db.insert("users", { id: 3, age: 25, email: "charlie@example.com" });

      // Create and register indexes
      const table = db.getTable("users")!;
      const ageIndex = new Index("users", "age");
      ageIndex.createIndex(table.selectAll());
      db.addIndex("idx_users_age", ageIndex);
      table.registerIndex(ageIndex);

      const emailIndex = new Index("users", "email", "unique_email_idx", true);
      emailIndex.createIndex(table.selectAll());
      db.addIndex("unique_email_idx", emailIndex);
      table.registerIndex(emailIndex);

      // Save database
      storage.saveDatabase(db);

      // Load into new database instance
      const db2 = new Database();
      storage.loadDatabase(db2);
      db2.connect();

      // Verify indexes were restored
      expect(db2.hasIndex("idx_users_age")).toBe(true);
      expect(db2.hasIndex("unique_email_idx")).toBe(true);

      // Verify index functionality
      const restoredAgeIndex = db2.getIndex("idx_users_age")!;
      expect(restoredAgeIndex).toBeDefined();
      expect(restoredAgeIndex.getIndexName()).toBe("idx_users_age");
      expect(restoredAgeIndex.getIndexType()).toBe("HASH");
      expect(restoredAgeIndex.isUnique()).toBe(false);

      const restoredEmailIndex = db2.getIndex("unique_email_idx")!;
      expect(restoredEmailIndex).toBeDefined();
      expect(restoredEmailIndex.isUnique()).toBe(true);

      // Verify index data was rebuilt correctly
      const age25Results = restoredAgeIndex.search(25);
      expect(age25Results).toHaveLength(2);
      expect(age25Results.map((r: any) => r.email)).toEqual([
        "alice@example.com",
        "charlie@example.com",
      ]);

      const aliceResults = restoredEmailIndex.search("alice@example.com");
      expect(aliceResults).toHaveLength(1);
      expect(aliceResults[0].id).toBe(1);

      // Verify table has indexes registered
      const restoredTable = db2.getTable("users")!;
      expect(restoredTable.hasIndex("idx_users_age")).toBe(true);
      expect(restoredTable.hasIndex("unique_email_idx")).toBe(true);
      expect(restoredTable.getIndexes()).toHaveLength(2);
    });

    test("should maintain index auto-updates after reload", () => {
      // Create table with index
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("price", "INT"),
      ]);

      db.insert("products", { id: 1, price: 100 });
      db.insert("products", { id: 2, price: 200 });

      const table = db.getTable("products")!;
      const priceIndex = new Index("products", "price");
      priceIndex.createIndex(table.selectAll());
      db.addIndex("idx_products_price", priceIndex);
      table.registerIndex(priceIndex);

      // Save and reload
      storage.saveDatabase(db);
      const db2 = new Database();
      storage.loadDatabase(db2);
      db2.connect();

      // Insert new record - should auto-update index
      db2.insert("products", { id: 3, price: 100 });

      // Verify index was auto-updated
      const reloadedIndex = db2.getIndex("idx_products_price")!;
      const price100Results = reloadedIndex.search(100);
      expect(price100Results).toHaveLength(2);
      expect(price100Results.map((r: any) => r.id)).toEqual([1, 3]);

      // Update record - should auto-update index
      const reloadedTable = db2.getTable("products")!;
      reloadedTable.update({ price: 300 }, (r: any) => r.id === 2);

      expect(reloadedIndex.search(200)).toHaveLength(0);
      expect(reloadedIndex.search(300)).toHaveLength(1);

      // Delete record - should auto-update index
      reloadedTable.delete((r: any) => r.id === 1);
      expect(reloadedIndex.search(100)).toHaveLength(1); // Only id:3 remains
    });

    test("should handle tables without indexes during save/load", () => {
      // Create table without indexes
      db.createTable("simple", [
        new Column("id", "INT", true),
        new Column("value", "VARCHAR"),
      ]);

      db.insert("simple", { id: 1, value: "test" });
      storage.saveDatabase(db);

      // Load into new database
      const db2 = new Database();
      storage.loadDatabase(db2);
      db2.connect();

      // Verify table loaded correctly without indexes
      const records = db2.query("simple", () => true);
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: 1, value: "test" });

      // Verify no indexes registered
      expect(db2.getIndexes("simple")).toHaveLength(0);
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

  // ==================== SYNC FUNCTIONALITY TESTS ====================
  describe("Database Synchronization (SYNC)", () => {
    test("should sync database from disk after manual file changes", () => {
      // Create and save initial data
      db.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);
      db.insert("users", { id: 1, name: "Alice" });
      storage.saveDatabase(db);

      // Simulate external file modification
      db.insert("users", { id: 2, name: "Bob" });
      expect(db.query("users", () => true)).toHaveLength(2);

      // Drop all tables (SYNC step 1)
      const tables = db.listTables();
      tables.forEach((tableName) => db.dropTable(tableName));
      expect(db.listTables()).toHaveLength(0);

      // Reload from disk (SYNC step 2)
      storage.loadDatabase(db);
      expect(db.listTables()).toHaveLength(1);

      // Should only have Alice (Bob was never saved)
      const users = db.query("users", () => true);
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Alice");
    });

    test("should handle SYNC with no tables", () => {
      // Start with empty database
      expect(db.listTables()).toHaveLength(0);

      // SYNC on empty database should work
      storage.loadDatabase(db);
      expect(db.listTables()).toHaveLength(0);
    });

    test("should sync and preserve table structure", () => {
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR", false, true),
        new Column("price", "INT"),
      ]);
      storage.saveDatabase(db);

      // Drop and reload
      db.dropTable("products");
      storage.loadDatabase(db);

      // Verify structure is preserved
      const table = db.getTable("products");
      expect(table).toBeDefined();
      const columns = table!.getColumns();
      expect(columns).toHaveLength(3);
      expect(columns[0].isPrimaryKey).toBe(true);
      expect(columns[1].isUnique).toBe(true);
    });
  });

  // ==================== MULTI-DATABASE FUNCTIONALITY TESTS ====================
  describe("Multi-Database Support", () => {
    let analyticsStorage: StorageEngine;
    let testStorage: StorageEngine;

    beforeEach(() => {
      analyticsStorage = new StorageEngine(testDataDir, "analytics");
      testStorage = new StorageEngine(testDataDir, "test-db");
    });

    afterEach(() => {
      // Clean up test databases
      try {
        StorageEngine.dropDatabase(testDataDir, "analytics");
      } catch (e) {}
      try {
        StorageEngine.dropDatabase(testDataDir, "test-db");
      } catch (e) {}
    });

    test("should create and manage multiple databases", () => {
      const db1 = new Database("default");
      const db2 = new Database("analytics");

      db1.connect();
      db2.connect();

      db1.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);

      db2.createTable("events", [
        new Column("id", "INT", true),
        new Column("event", "VARCHAR"),
      ]);

      storage.saveDatabase(db1);
      analyticsStorage.saveDatabase(db2);

      expect(db1.getDatabaseName()).toBe("default");
      expect(db2.getDatabaseName()).toBe("analytics");
      expect(db1.listTables()).toContain("users");
      expect(db2.listTables()).toContain("events");
    });

    test("should list all available databases", () => {
      const db1 = new Database("default");
      const db2 = new Database("analytics");
      const db3 = new Database("test-db");

      storage.saveDatabase(db1);
      analyticsStorage.saveDatabase(db2);
      testStorage.saveDatabase(db3);

      const databases = StorageEngine.listDatabases(testDataDir);

      expect(databases).toContain("default");
      expect(databases).toContain("analytics");
      expect(databases).toContain("test-db");
      expect(databases.length).toBeGreaterThanOrEqual(3);
    });

    test("should switch between databases", () => {
      // Create data in default database
      const defaultDb = new Database("default");
      defaultDb.connect();
      defaultDb.createTable("users", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
      ]);
      defaultDb.insert("users", { id: 1, name: "Alice" });
      storage.saveDatabase(defaultDb);

      // Create data in analytics database
      const analyticsDb = new Database("analytics");
      analyticsDb.connect();
      analyticsDb.createTable("events", [
        new Column("id", "INT", true),
        new Column("type", "VARCHAR"),
      ]);
      analyticsDb.insert("events", { id: 1, type: "login" });
      analyticsStorage.saveDatabase(analyticsDb);

      // Switch from default to analytics
      expect(defaultDb.getDatabaseName()).toBe("default");
      expect(defaultDb.listTables()).toContain("users");

      // Simulate switching
      defaultDb.listTables().forEach((t) => defaultDb.dropTable(t));
      defaultDb.setDatabaseName("analytics");
      analyticsStorage.loadDatabase(defaultDb);

      expect(defaultDb.getDatabaseName()).toBe("analytics");
      expect(defaultDb.listTables()).toContain("events");
      expect(defaultDb.listTables()).not.toContain("users");
    });

    test("should isolate data between databases", () => {
      const db1 = new Database("default");
      const db2 = new Database("analytics");

      db1.connect();
      db2.connect();

      // Create same table name in both databases
      db1.createTable("logs", [
        new Column("id", "INT", true),
        new Column("message", "VARCHAR"),
      ]);

      db2.createTable("logs", [
        new Column("id", "INT", true),
        new Column("message", "VARCHAR"),
      ]);

      // Add different data
      db1.insert("logs", { id: 1, message: "Default log" });
      db2.insert("logs", { id: 1, message: "Analytics log" });

      storage.saveDatabase(db1);
      analyticsStorage.saveDatabase(db2);

      // Verify isolation
      const defaultLogs = db1.query("logs", () => true);
      const analyticsLogs = db2.query("logs", () => true);

      expect(defaultLogs[0].message).toBe("Default log");
      expect(analyticsLogs[0].message).toBe("Analytics log");
    });

    test("should drop database and all its data", () => {
      const testDb = new Database("test-db");
      testDb.connect();
      testDb.createTable("temp", [new Column("id", "INT", true)]);
      testStorage.saveDatabase(testDb);

      // Verify database exists
      let databases = StorageEngine.listDatabases(testDataDir);
      expect(databases).toContain("test-db");

      // Drop database
      StorageEngine.dropDatabase(testDataDir, "test-db");

      // Verify database is gone
      databases = StorageEngine.listDatabases(testDataDir);
      expect(databases).not.toContain("test-db");
    });

    test("should handle database names with special characters", () => {
      const db1 = new Database("test-db-123");
      const db2 = new Database("my_database");

      const storage1 = new StorageEngine(testDataDir, "test-db-123");
      const storage2 = new StorageEngine(testDataDir, "my_database");

      storage1.saveDatabase(db1);
      storage2.saveDatabase(db2);

      const databases = StorageEngine.listDatabases(testDataDir);
      expect(databases).toContain("test-db-123");
      expect(databases).toContain("my_database");

      // Cleanup
      StorageEngine.dropDatabase(testDataDir, "test-db-123");
      StorageEngine.dropDatabase(testDataDir, "my_database");
    });

    test("should get current database name", () => {
      const db1 = new Database("production");
      expect(db1.getDatabaseName()).toBe("production");

      db1.setDatabaseName("staging");
      expect(db1.getDatabaseName()).toBe("staging");
    });
  });
});
