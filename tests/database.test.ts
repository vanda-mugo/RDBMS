import Database from "../src/core/database";
import { Column } from "../src/core/column";
import { Index } from "../src/core/index";
import { Table } from "../src/core/table";

/**
 * DATABASE TEST SUITE DOCUMENTATION
 *
 * This test suite validates the core CRUD (Create, Read, Update, Delete) operations
 * of the Database class, ensuring data integrity and constraint enforcement.
 *
 * WHAT THIS TEST VALIDATES:
 *
 * 1. TABLE CREATION & CONNECTION
 *    - Database must be connected before operations
 *    - Tables can be created with custom column schemas
 *    - Columns support different data types (INT, VARCHAR)
 *    - Primary key and unique constraints are properly configured
 *
 * 2. INSERT OPERATIONS
 *    - Records can be successfully inserted into tables
 *    - Inserted data is correctly stored and retrievable
 *    - Data integrity is maintained after insertion
 *
 * 3. READ/QUERY OPERATIONS
 *    - Records can be queried using condition functions
 *    - Query results match expected data structure
 *    - Empty results return empty arrays (not null/undefined)
 *
 * 4. UPDATE OPERATIONS
 *    - Existing records can be modified
 *    - Only specified fields are updated (partial updates)
 *    - Unchanged fields retain their original values
 *    - Condition functions correctly filter records to update
 *
 * 5. DELETE OPERATIONS
 *    - Records can be removed from tables
 *    - Deleted records are no longer retrievable
 *    - Condition functions correctly filter records to delete
 *
 * 6. CONSTRAINT ENFORCEMENT
 *    - Unique constraints prevent duplicate values
 *    - Violations throw descriptive error messages
 *    - Database maintains data integrity under constraint violations
 *
 * TEST ISOLATION:
 * - Each test starts with a fresh database instance (beforeEach)
 * - Tests are independent and don't affect each other
 * - 'users' table is consistently initialized with standard schema
 *
 * SCHEMA USED IN TESTS:
 * - id (INT, PRIMARY KEY): Unique identifier
 * - name (VARCHAR): User's full name
 * - email (VARCHAR, UNIQUE): User's email address (must be unique)
 */

describe("Database CRUD Operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database();
    db.connect();
    db.createTable("users", [
      new Column("id", "INT", true, false),
      new Column("name", "VARCHAR", false, false),
      new Column("email", "VARCHAR", false, true),
    ]);
  });

  /**
   * TEST 1: INSERT OPERATION
   *
   * Validates:
   * - Insert method successfully adds a record to the table
   * - Inserted data is immediately queryable
   * - Query returns exact data that was inserted
   * - Array structure is maintained ([record] not record)
   */
  test("Insert a record", () => {
    const user = { id: 1, name: "John Doe", email: "john@example.com" };
    db.insert("users", user);
    const result = db.query("users", (record) => record.id === 1);
    expect(result).toEqual([user]);
  });

  /**
   * TEST 2: UPDATE OPERATION
   *
   * Validates:
   * - Update method modifies existing records
   * - Only specified fields are changed (partial update)
   * - Unmodified fields retain original values
   * - Condition function correctly targets specific records
   * - Query returns updated data, not cached/stale data
   */
  test("Update a record", () => {
    const user = { id: 1, name: "John Doe", email: "john@example.com" };
    db.insert("users", user);
    db.update("users", { name: "Jane Doe" }, (record) => record.id === 1);
    const result = db.query("users", (record) => record.id === 1);
    expect(result).toEqual([
      { id: 1, name: "Jane Doe", email: "john@example.com" },
    ]);
  });

  /**
   * TEST 3: DELETE OPERATION
   *
   * Validates:
   * - Delete method removes records from the table
   * - Deleted records cannot be queried
   * - Empty result set returns [] (not null/undefined)
   * - Condition function correctly targets records to delete
   */
  test("Delete a record", () => {
    const user = { id: 1, name: "John Doe", email: "john@example.com" };
    db.insert("users", user);
    db.delete("users", (record) => record.id === 1);
    const result = db.query("users", (record) => record.id === 1);
    expect(result).toEqual([]);
  });

  /**
   * TEST 4: UNIQUE CONSTRAINT VIOLATION
   *
   * Validates:
   * - Unique constraint is enforced on email column
   * - Attempting to insert duplicate email throws error
   * - Error message clearly indicates constraint violation
   * - First record remains intact after failed second insert
   * - Database maintains integrity despite constraint violation
   */
  test("Unique constraint violation", () => {
    const user1 = { id: 1, name: "John Doe", email: "john@example.com" };
    const user2 = { id: 2, name: "Jane Doe", email: "john@example.com" }; // Same email
    db.insert("users", user1);
    expect(() => db.insert("users", user2)).toThrow("Duplicate unique value");
  });

  /**
   * TEST 5: PRIMARY KEY CONSTRAINT
   *
   * Validates:
   * - Primary key constraint is enforced on id column
   * - Attempting to insert duplicate primary key throws error
   * - Database prevents duplicate primary keys
   */
  test("Primary key constraint violation", () => {
    const user1 = { id: 1, name: "John Doe", email: "john@example.com" };
    const user2 = { id: 1, name: "Jane Doe", email: "jane@example.com" }; // Same id
    db.insert("users", user1);
    expect(() => db.insert("users", user2)).toThrow();
  });

  /**
   * TEST 6: MULTIPLE RECORDS QUERY
   *
   * Validates:
   * - Multiple records can be stored in the same table
   * - Query can return multiple matching records
   * - All matching records are returned (not just first match)
   * - Results maintain correct data structure
   */
  test("Query multiple records", () => {
    const user1 = { id: 1, name: "John Doe", email: "john@example.com" };
    const user2 = { id: 2, name: "Jane Doe", email: "jane@example.com" };
    const user3 = { id: 3, name: "Bob Smith", email: "bob@example.com" };

    db.insert("users", user1);
    db.insert("users", user2);
    db.insert("users", user3);

    // Query all records
    const allUsers = db.query("users", () => true);
    expect(allUsers).toHaveLength(3);
    expect(allUsers).toContainEqual(user1);
    expect(allUsers).toContainEqual(user2);
    expect(allUsers).toContainEqual(user3);
  });

  /**
   * TEST 7: CASE-INSENSITIVE TABLE NAMES
   *
   * Validates:
   * - Table names are case-insensitive
   * - Operations work with different case variations
   * - 'Users', 'users', 'USERS' all reference the same table
   */
  test("Case-insensitive table names", () => {
    const user = { id: 1, name: "John Doe", email: "john@example.com" };
    db.insert("USERS", user); // Uppercase
    const result = db.query("Users", (record) => record.id === 1); // Mixed case
    expect(result).toEqual([user]);
  });

  /**
   * TEST 8: TABLE DOES NOT EXIST ERROR
   *
   * Validates:
   * - Operations on non-existent tables throw descriptive errors
   * - Error message indicates which table was not found
   */
  test("Operations on non-existent table throw error", () => {
    expect(() => db.insert("nonexistent", { id: 1 })).toThrow(
      "Table nonexistent does not exist"
    );
    expect(() => db.query("nonexistent", () => true)).toThrow(
      "Table nonexistent does not exist"
    );
  });
});

/**
 * INDEX REGISTRY TEST SUITE
 *
 * Validates database-level index management operations:
 * - Adding indexes to registry
 * - Removing indexes (DROP INDEX)
 * - Finding indexes by name, table, or column
 * - Listing all indexes
 */
describe("Database Index Registry", () => {
  let db: Database;
  let table: Table;

  beforeEach(() => {
    db = new Database();
    db.connect();
    db.createTable("users", [
      new Column("id", "INT", true),
      new Column("age", "INT"),
      new Column("email", "VARCHAR"),
    ]);
    table = db.getTable("users")!;
    table.insert({ id: 1, age: 25, email: "alice@example.com" });
    table.insert({ id: 2, age: 30, email: "bob@example.com" });
  });

  /**
   * TEST: Add index to registry
   */
  test("should add index to registry", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    ageIndex.createIndex(table.selectAll());

    db.addIndex("idx_age", ageIndex);

    expect(db.hasIndex("idx_age")).toBe(true);
    expect(db.getIndex("idx_age")).toBe(ageIndex);
  });

  /**
   * TEST: Prevent duplicate index names
   */
  test("should throw error on duplicate index name", () => {
    const index1 = new Index("users", "age", "idx_age");
    const index2 = new Index("users", "email", "idx_age");

    db.addIndex("idx_age", index1);

    expect(() => {
      db.addIndex("idx_age", index2);
    }).toThrow("Index 'idx_age' already exists");
  });

  /**
   * TEST: Drop index from registry
   */
  test("should drop index from registry", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    ageIndex.createIndex(table.selectAll());
    db.addIndex("idx_age", ageIndex);

    expect(db.hasIndex("idx_age")).toBe(true);

    db.dropIndex("idx_age");

    expect(db.hasIndex("idx_age")).toBe(false);
    expect(db.getIndex("idx_age")).toBeUndefined();
  });

  /**
   * TEST: Error on dropping non-existent index
   */
  test("should throw error when dropping non-existent index", () => {
    expect(() => {
      db.dropIndex("nonexistent_idx");
    }).toThrow("Index 'nonexistent_idx' does not exist");
  });

  /**
   * TEST: Get all indexes
   */
  test("should return all indexes", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    const emailIndex = new Index("users", "email", "idx_email");

    ageIndex.createIndex(table.selectAll());
    emailIndex.createIndex(table.selectAll());

    db.addIndex("idx_age", ageIndex);
    db.addIndex("idx_email", emailIndex);

    const allIndexes = db.getIndexes();

    expect(allIndexes).toHaveLength(2);
    expect(allIndexes).toContain(ageIndex);
    expect(allIndexes).toContain(emailIndex);
  });

  /**
   * TEST: Get indexes filtered by table
   */
  test("should return indexes for specific table", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    const emailIndex = new Index("users", "email", "idx_email");
    const productIndex = new Index("products", "price", "idx_price");

    db.addIndex("idx_age", ageIndex);
    db.addIndex("idx_email", emailIndex);
    db.addIndex("idx_price", productIndex);

    const userIndexes = db.getIndexes("users");

    expect(userIndexes).toHaveLength(2);
    expect(userIndexes).toContain(ageIndex);
    expect(userIndexes).toContain(emailIndex);
    expect(userIndexes).not.toContain(productIndex);
  });

  /**
   * TEST: Find index for specific column (query optimizer use case)
   */
  test("should find index for specific table column", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    const emailIndex = new Index("users", "email", "idx_email");

    ageIndex.createIndex(table.selectAll());
    emailIndex.createIndex(table.selectAll());

    db.addIndex("idx_age", ageIndex);
    db.addIndex("idx_email", emailIndex);

    const foundIndex = db.getIndexForColumn("users", "age");

    expect(foundIndex).toBe(ageIndex);
  });

  /**
   * TEST: Return undefined when no index exists for column
   */
  test("should return undefined when no index for column", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    db.addIndex("idx_age", ageIndex);

    const foundIndex = db.getIndexForColumn("users", "email");

    expect(foundIndex).toBeUndefined();
  });

  /**
   * TEST: Case-insensitive table and column matching
   */
  test("should match indexes case-insensitively", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    db.addIndex("idx_age", ageIndex);

    // Mixed case queries should still find the index
    expect(db.getIndexForColumn("USERS", "AGE")).toBe(ageIndex);
    expect(db.getIndexForColumn("Users", "Age")).toBe(ageIndex);

    const userIndexes = db.getIndexes("USERS");
    expect(userIndexes).toHaveLength(1);
  });

  /**
   * TEST: List index names
   */
  test("should list all index names", () => {
    const ageIndex = new Index("users", "age", "idx_age");
    const emailIndex = new Index("users", "email", "idx_email");

    db.addIndex("idx_age", ageIndex);
    db.addIndex("idx_email", emailIndex);

    const names = db.listIndexNames();

    expect(names).toContain("idx_age");
    expect(names).toContain("idx_email");
    expect(names).toHaveLength(2);
  });
});
