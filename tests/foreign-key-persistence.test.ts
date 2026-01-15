import Database from "../src/core/database";
import { QueryExecutor } from "../src/core/query-executor";
import { StorageEngine } from "../src/core/storage-engine";
import * as fs from "fs";
import * as path from "path";

describe("Foreign Key Persistence", () => {
  const testDataPath = "./test-fk-persistence";
  let database: Database;
  let queryExecutor: QueryExecutor;
  let storageEngine: StorageEngine;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    }

    database = new Database();
    database.connect();
    queryExecutor = new QueryExecutor(database);
    storageEngine = new StorageEngine(testDataPath);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    }
  });

  test("should persist foreign key constraints across save/load", () => {
    // Create parent table
    queryExecutor.execute(
      "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
    );
    queryExecutor.execute("INSERT INTO users VALUES (1, 'Alice')");
    queryExecutor.execute("INSERT INTO users VALUES (2, 'Bob')");

    // Create child table with foreign key
    queryExecutor.execute(
      "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), amount INT)"
    );

    // Insert valid record
    queryExecutor.execute("INSERT INTO orders VALUES (1, 1, 100)");

    // Save database to disk
    storageEngine.saveDatabase(database);

    // Create a NEW database instance and load from disk
    const newDatabase = new Database();
    newDatabase.connect();
    storageEngine.loadDatabase(newDatabase);

    // Check that table structure was restored
    const tables = newDatabase.listTables();
    expect(tables).toContain("users");
    expect(tables).toContain("orders");

    // Check that data was restored
    const users = newDatabase.query("users", () => true);
    expect(users).toHaveLength(2);

    const orders = newDatabase.query("orders", () => true);
    expect(orders).toHaveLength(1);

    // THE CRITICAL TEST: Foreign key constraint should still be enforced
    // Try to insert a record with invalid foreign key
    expect(() => {
      newDatabase.insert("orders", { id: 2, user_id: 999, amount: 200 });
    }).toThrow(
      "Foreign key constraint violation on column 'user_id': Value '999' does not exist in users.id"
    );

    // Valid foreign key should still work
    expect(() => {
      newDatabase.insert("orders", { id: 3, user_id: 2, amount: 300 });
    }).not.toThrow();
  });

  test("should persist multiple foreign keys", () => {
    // Create multiple parent tables
    queryExecutor.execute(
      "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
    );
    queryExecutor.execute(
      "CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR)"
    );

    queryExecutor.execute("INSERT INTO users VALUES (1, 'Alice')");
    queryExecutor.execute("INSERT INTO products VALUES (100, 'Laptop')");

    // Create child table with multiple foreign keys
    queryExecutor.execute(
      "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), product_id INT FOREIGN KEY REFERENCES products(id), quantity INT)"
    );

    queryExecutor.execute("INSERT INTO orders VALUES (1, 1, 100, 2)");

    // Save and reload
    storageEngine.saveDatabase(database);
    const newDatabase = new Database();
    newDatabase.connect();
    storageEngine.loadDatabase(newDatabase);

    // Both foreign keys should be validated
    expect(() => {
      newDatabase.insert("orders", {
        id: 2,
        user_id: 999,
        product_id: 100,
        quantity: 1,
      });
    }).toThrow("Foreign key constraint violation on column 'user_id'");

    expect(() => {
      newDatabase.insert("orders", {
        id: 2,
        user_id: 1,
        product_id: 999,
        quantity: 1,
      });
    }).toThrow("Foreign key constraint violation on column 'product_id'");
  });

  test("should verify foreign key metadata in JSON file", () => {
    // Create tables with foreign key
    queryExecutor.execute(
      "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
    );
    queryExecutor.execute(
      "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), amount INT)"
    );

    // Save database
    storageEngine.saveDatabase(database);

    // Read the JSON file directly
    const dbFilePath = path.join(testDataPath, "database.json");
    const jsonContent = fs.readFileSync(dbFilePath, "utf8");
    const dbData = JSON.parse(jsonContent);

    // Verify foreign key metadata is saved
    const ordersColumns = dbData.tables.orders.columns;
    const userIdColumn = ordersColumns.find(
      (col: any) => col.name === "user_id"
    );

    expect(userIdColumn).toBeDefined();
    expect(userIdColumn.isForeignKey).toBe(true);
    expect(userIdColumn.foreignKeyReference).toBeDefined();
    expect(userIdColumn.foreignKeyReference.table).toBe("users");
    expect(userIdColumn.foreignKeyReference.column).toBe("id");
  });

  test("should handle foreign keys across SYNC operations", () => {
    // Create tables with foreign key
    queryExecutor.execute(
      "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
    );
    queryExecutor.execute("INSERT INTO users VALUES (1, 'Alice')");
    queryExecutor.execute(
      "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), amount INT)"
    );

    // Save to disk
    storageEngine.saveDatabase(database);

    // Manually modify database in memory (simulating REPL changes)
    queryExecutor.execute("INSERT INTO users VALUES (2, 'Bob')");

    // SYNC: reload from disk
    storageEngine.loadDatabase(database);

    // After SYNC, only Alice should exist (Bob was not saved)
    const users = database.query("users", () => true);
    expect(users).toHaveLength(1);

    // Foreign key constraint should STILL be enforced
    expect(() => {
      database.insert("orders", { id: 1, user_id: 999, amount: 100 });
    }).toThrow("Foreign key constraint violation");

    // Valid insert should work
    expect(() => {
      database.insert("orders", { id: 1, user_id: 1, amount: 100 });
    }).not.toThrow();
  });
});
