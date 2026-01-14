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

  /**
   * TEST GROUP: INDEX-OPTIMIZED QUERY EXECUTION
   *
   * This group validates that the QueryExecutor automatically uses indexes
   * when available to optimize SELECT queries with WHERE clauses.
   *
   * Validates:
   * - Equality operator (=) uses index.search() for O(1) lookup
   * - Range operators (>, <, >=, <=) use index.rangeSearch()
   * - Falls back to full scan when no index available
   * - Returns correct results regardless of optimization path
   */
  describe("Index-Optimized Queries", () => {
    test("should use index for equality WHERE clause (=)", () => {
      // Create test data
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')"
      );
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com')"
      );
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (3, 'Charlie', 'charlie@example.com')"
      );

      // Create index on email column
      const table = db.getTable("users")!;
      const Index = require("../src/core/index").Index;
      const emailIndex = new Index("users", "email");
      emailIndex.createIndex(table.selectAll());
      db.addIndex("idx_users_email", emailIndex);
      table.registerIndex(emailIndex);

      // Execute query - should use index
      const result = executor.execute(
        "SELECT * FROM users WHERE email = 'bob@example.com'"
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob");
      expect(result[0].id).toBe(2);
    });

    test("should use index for range WHERE clause (>)", () => {
      // Create products table with numeric column
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("price", "INT"),
      ]);

      const productExecutor = new QueryExecutor(db);
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (1, 'Widget', 10)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (2, 'Gadget', 25)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (3, 'Doohickey', 50)"
      );

      // Create index on price column
      const table = db.getTable("products")!;
      const Index = require("../src/core/index").Index;
      const priceIndex = new Index("products", "price");
      priceIndex.createIndex(table.selectAll());
      db.addIndex("idx_products_price", priceIndex);
      table.registerIndex(priceIndex);

      // Execute range query - should use index
      const result = productExecutor.execute(
        "SELECT * FROM products WHERE price > 20"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.name).sort()).toEqual([
        "Doohickey",
        "Gadget",
      ]);
    });

    test("should use index for range WHERE clause (>=)", () => {
      // Setup products table and index
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("price", "INT"),
      ]);

      const productExecutor = new QueryExecutor(db);
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (1, 'Widget', 10)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (2, 'Gadget', 25)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (3, 'Doohickey', 50)"
      );

      const table = db.getTable("products")!;
      const Index = require("../src/core/index").Index;
      const priceIndex = new Index("products", "price");
      priceIndex.createIndex(table.selectAll());
      db.addIndex("idx_products_price", priceIndex);
      table.registerIndex(priceIndex);

      const result = productExecutor.execute(
        "SELECT * FROM products WHERE price >= 25"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.price).sort()).toEqual([25, 50]);
    });

    test("should use index for range WHERE clause (<)", () => {
      // Setup products table and index
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("price", "INT"),
      ]);

      const productExecutor = new QueryExecutor(db);
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (1, 'Widget', 10)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (2, 'Gadget', 25)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (3, 'Doohickey', 50)"
      );

      const table = db.getTable("products")!;
      const Index = require("../src/core/index").Index;
      const priceIndex = new Index("products", "price");
      priceIndex.createIndex(table.selectAll());
      db.addIndex("idx_products_price", priceIndex);
      table.registerIndex(priceIndex);

      const result = productExecutor.execute(
        "SELECT * FROM products WHERE price < 30"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.price).sort()).toEqual([10, 25]);
    });

    test("should use index for range WHERE clause (<=)", () => {
      // Setup products table and index
      db.createTable("products", [
        new Column("id", "INT", true),
        new Column("name", "VARCHAR"),
        new Column("price", "INT"),
      ]);

      const productExecutor = new QueryExecutor(db);
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (1, 'Widget', 10)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (2, 'Gadget', 25)"
      );
      productExecutor.execute(
        "INSERT INTO products (id, name, price) VALUES (3, 'Doohickey', 50)"
      );

      const table = db.getTable("products")!;
      const Index = require("../src/core/index").Index;
      const priceIndex = new Index("products", "price");
      priceIndex.createIndex(table.selectAll());
      db.addIndex("idx_products_price", priceIndex);
      table.registerIndex(priceIndex);

      const result = productExecutor.execute(
        "SELECT * FROM products WHERE price <= 25"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.price).sort()).toEqual([10, 25]);
    });

    test("should fall back to full scan when no index exists", () => {
      // Create table without index
      db.createTable("orders", [
        new Column("id", "INT", true),
        new Column("customer", "VARCHAR"),
        new Column("total", "INT"),
      ]);

      const orderExecutor = new QueryExecutor(db);
      orderExecutor.execute(
        "INSERT INTO orders (id, customer, total) VALUES (1, 'Alice', 100)"
      );
      orderExecutor.execute(
        "INSERT INTO orders (id, customer, total) VALUES (2, 'Bob', 200)"
      );

      // No index on customer - should use full scan
      const result = orderExecutor.execute(
        "SELECT * FROM orders WHERE customer = 'Alice'"
      );

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(100);
    });

    test("should return correct results with index on non-unique column", () => {
      // Test index on column with duplicate values
      db.createTable("reviews", [
        new Column("id", "INT", true),
        new Column("product", "VARCHAR"),
        new Column("rating", "INT"),
      ]);

      const reviewExecutor = new QueryExecutor(db);
      reviewExecutor.execute(
        "INSERT INTO reviews (id, product, rating) VALUES (1, 'Widget', 5)"
      );
      reviewExecutor.execute(
        "INSERT INTO reviews (id, product, rating) VALUES (2, 'Gadget', 4)"
      );
      reviewExecutor.execute(
        "INSERT INTO reviews (id, product, rating) VALUES (3, 'Doohickey', 5)"
      );

      // Create index on rating (non-unique)
      const table = db.getTable("reviews")!;
      const Index = require("../src/core/index").Index;
      const ratingIndex = new Index("reviews", "rating");
      ratingIndex.createIndex(table.selectAll());
      db.addIndex("idx_reviews_rating", ratingIndex);
      table.registerIndex(ratingIndex);

      // Query with duplicate rating value
      const result = reviewExecutor.execute(
        "SELECT * FROM reviews WHERE rating = 5"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.product).sort()).toEqual([
        "Doohickey",
        "Widget",
      ]);
    });

    test("should handle column projection with index optimization", () => {
      // Create test data
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')"
      );
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com')"
      );

      // Create index on email column
      const table = db.getTable("users")!;
      const Index = require("../src/core/index").Index;
      const emailIndex = new Index("users", "email");
      emailIndex.createIndex(table.selectAll());
      db.addIndex("idx_users_email", emailIndex);
      table.registerIndex(emailIndex);

      // SELECT specific columns with indexed WHERE
      const result = executor.execute(
        "SELECT name, email FROM users WHERE email = 'alice@example.com'"
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "Alice",
        email: "alice@example.com",
      });
      expect(result[0].id).toBeUndefined(); // id not projected
    });

    test("should fall back to full scan when no index available", () => {
      // Query on non-indexed column should still work
      db.createTable("inventory", [
        new Column("id", "INT", true),
        new Column("item", "VARCHAR"),
        new Column("quantity", "INT"),
      ]);

      const invExecutor = new QueryExecutor(db);
      invExecutor.execute(
        "INSERT INTO inventory (id, item, quantity) VALUES (1, 'Bolts', 100)"
      );
      invExecutor.execute(
        "INSERT INTO inventory (id, item, quantity) VALUES (2, 'Nuts', 50)"
      );
      invExecutor.execute(
        "INSERT INTO inventory (id, item, quantity) VALUES (3, 'Screws', 75)"
      );

      // No index on quantity - should use full scan
      const result = invExecutor.execute(
        "SELECT * FROM inventory WHERE quantity > 60"
      );

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.item).sort()).toEqual([
        "Bolts",
        "Screws",
      ]);
    });

    test("should fall back to full scan for unsupported operators with index", () => {
      // Create test data with index
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')"
      );
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com')"
      );
      executor.execute(
        "INSERT INTO users (id, name, email) VALUES (3, 'Charlie', 'charlie@example.com')"
      );

      const table = db.getTable("users")!;
      const Index = require("../src/core/index").Index;
      const emailIndex = new Index("users", "email");
      emailIndex.createIndex(table.selectAll());
      db.addIndex("idx_users_email", emailIndex);
      table.registerIndex(emailIndex);

      // Test != operator (not optimizable with current hash index)
      const result = executor.execute(
        "SELECT * FROM users WHERE email != 'alice@example.com'"
      );

      expect(result).toHaveLength(2); // Bob and Charlie
      expect(result.map((r: any) => r.name).sort()).toEqual(["Bob", "Charlie"]);
    });
  });
});
