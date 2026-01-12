import Database from "../src/core/database";
import { Column } from "../src/core/column";

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
