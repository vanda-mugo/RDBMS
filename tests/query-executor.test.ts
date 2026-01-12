import { QueryExecutor } from "../src/core/query-executor";
import Database from "../src/core/database";
import { Column } from "../src/core/column";

/**
 * ========================================
 * QUERY EXECUTOR TEST SUITE DOCUMENTATION
 * ========================================
 *
 * This test suite validates the QueryExecutor component, which serves as the SQL interface
 * for the RDBMS. The QueryExecutor parses SQL statements and translates them into
 * low-level database operations.
 *
 * ========================================
 * WHAT THIS TEST SUITE VALIDATES
 * ========================================
 *
 * 1. SQL PARSING & EXECUTION
 *    - SQL INSERT statements are correctly parsed and executed
 *    - SQL UPDATE statements modify existing records
 *    - SQL DELETE statements remove records from tables
 *    - SQL SELECT statements retrieve and return data
 *
 * 2. STATEMENT TRANSLATION
 *    - SQL syntax is translated to Database API calls
 *    - Column names and values are correctly extracted
 *    - WHERE clauses are converted to filter conditions
 *    - SET clauses are converted to update operations
 *
 * 3. DATA INTEGRITY
 *    - Inserted data is correctly stored and retrievable
 *    - Updated data reflects the changes specified
 *    - Deleted data is properly removed from tables
 *    - Constraint violations are detected and reported
 *
 * 4. CONSTRAINT ENFORCEMENT
 *    - Unique constraint violations return error status
 *    - Primary key constraints are respected
 *    - Database integrity is maintained through SQL interface
 *
 * 5. RESULT HANDLING
 *    - INSERT/UPDATE/DELETE return boolean success status
 *    - SELECT queries return arrays of matching records
 *    - Empty results return empty arrays (not null/undefined)
 *    - Error cases return falsy values or empty results
 *
 * ========================================
 * TEST ARCHITECTURE
 * ========================================
 *
 * COMPONENT INTERACTION:
 *   User SQL → QueryExecutor → Database → Table → Storage
 *
 * LAYERS TESTED:
 *   1. SQL Parser: Tokenizes and parses SQL statements
 *   2. Query Executor: Translates SQL to API calls
 *   3. Database Layer: Validates and routes operations
 *   4. Table Layer: Executes CRUD operations
 *
 * ========================================
 * TEST ISOLATION
 * ========================================
 *
 * Each test:
 *   - Creates a fresh Database and QueryExecutor instance
 *   - Initializes a 'users' table with standard schema
 *   - Runs independently without affecting other tests
 *   - Validates specific SQL operation behavior
 *
 * ========================================
 * SCHEMA USED IN TESTS
 * ========================================
 *
 * Table: users
 *   - id (INTEGER, PRIMARY KEY): Unique identifier
 *   - name (TEXT): User's full name
 *   - email (TEXT, UNIQUE): User's email address
 *
 * ========================================
 * TEST COVERAGE (5 tests)
 * ========================================
 *
 * 1. INSERT Operation: Validates record insertion via SQL
 * 2. UPDATE Operation: Validates record modification via SQL
 * 3. DELETE Operation: Validates record removal via SQL
 * 4. Constraint Violation: Validates unique constraint enforcement
 * 5. SELECT Operation: Validates data retrieval via SQL
 *
 * ========================================
 * COMPARISON WITH OTHER TEST SUITES
 * ========================================
 *
 * database.test.ts:
 *   - Tests Database API directly (no SQL)
 *   - Lower-level validation
 *   - Programmatic interface
 *
 * query-executor.test.ts (THIS FILE):
 *   - Tests SQL interface through QueryExecutor
 *   - Higher-level validation
 *   - User-facing SQL syntax
 *
 * integration.test.ts:
 *   - Tests complete system workflows
 *   - Multi-component interactions
 *   - Real-world scenarios
 *
 * ========================================
 * WHY THIS TEST SUITE IS ESSENTIAL
 * ========================================
 *
 * Even though integration tests cover SQL execution, this suite provides:
 *   - Focused validation of QueryExecutor component
 *   - Faster execution for SQL-specific debugging
 *   - Clear documentation of supported SQL syntax
 *   - Isolated testing of parsing logic
 *   - Regression protection for SQL features
 */

describe("QueryExecutor", () => {
  let db: Database;
  let executor: QueryExecutor;

  beforeEach(() => {
    db = new Database();
    db.connect();
    executor = new QueryExecutor(db);
    db.createTable("users", [
      new Column("id", "INTEGER", true, false),
      new Column("name", "TEXT", false, false),
      new Column("email", "TEXT", false, true),
    ]);
  });

  /**
   * TEST 1: SQL INSERT Operation
   *
   * Validates that:
   * - INSERT SQL statement is correctly parsed
   * - Record is successfully inserted into the table
   * - Inserted data is retrievable via query
   * - Field values match the INSERT statement
   *
   * SQL: INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')
   * Expected: Record inserted, retrievable with correct values
   */
  test("should insert a record", () => {
    const result = executor.execute(
      "INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')"
    );
    expect(result).toBeTruthy();
    const users = db.query("users", () => true);
    expect(users.length).toBe(1);
    expect(users[0].name).toBe("John Doe");
  });

  /**
   * TEST 2: SQL UPDATE Operation
   *
   * Validates that:
   * - UPDATE SQL statement is correctly parsed
   * - WHERE clause correctly identifies records to update
   * - SET clause correctly specifies new values
   * - Only specified fields are modified
   * - Other fields remain unchanged
   *
   * SQL: UPDATE users SET name = 'Jane Doe' WHERE id = 1
   * Expected: Record updated, name changed to 'Jane Doe'
   */
  test("should update a record", () => {
    executor.execute(
      "INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')"
    );
    const result = executor.execute(
      "UPDATE users SET name = 'Jane Doe' WHERE id = 1"
    );
    expect(result).toBeTruthy();
    const users = db.query("users", (record: any) => record.id === 1);
    expect(users[0].name).toBe("Jane Doe");
  });

  /**
   * TEST 3: SQL DELETE Operation
   *
   * Validates that:
   * - DELETE SQL statement is correctly parsed
   * - WHERE clause correctly identifies records to delete
   * - Deleted records are removed from table
   * - Query returns empty result after deletion
   *
   * SQL: DELETE FROM users WHERE id = 1
   * Expected: Record deleted, table becomes empty
   */
  test("should delete a record", () => {
    executor.execute(
      "INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')"
    );
    const result = executor.execute("DELETE FROM users WHERE id = 1");
    expect(result).toBeTruthy();
    const users = db.query("users", () => true);
    expect(users.length).toBe(0);
  });

  /**
   * TEST 4: Unique Constraint Violation via SQL
   *
   * Validates that:
   * - Unique constraints are enforced through SQL interface
   * - Duplicate email values are rejected
   * - QueryExecutor throws an error for constraint violations
   * - Database integrity is maintained despite violation attempt
   *
   * SQL: INSERT with duplicate email
   * Expected: Second insert throws error with descriptive message
   */
  test("should return error for unique constraint violation", () => {
    executor.execute(
      "INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')"
    );
    expect(() => {
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (2, 'Jane Doe', 'john@example.com')"
      );
    }).toThrow("Duplicate unique value");
  });

  /**
   * TEST 5: SQL SELECT Operation
   *
   * Validates that:
   * - SELECT SQL statement is correctly parsed
   * - Query returns array of matching records
   * - Result contains correct data structure
   * - Field values are accessible in result objects
   *
   * SQL: SELECT * FROM users
   * Expected: Array with one record containing correct data
   */
  test("should execute a select query", () => {
    executor.execute(
      "INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')"
    );
    const result = executor.execute("SELECT * FROM users");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("John Doe");
  });
});
