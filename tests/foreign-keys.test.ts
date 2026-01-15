import Database from "../src/core/database";
import { Column } from "../src/core/column";
import { QueryExecutor } from "../src/core/query-executor";

describe("Foreign Key Constraints", () => {
  let database: Database;
  let queryExecutor: QueryExecutor;

  beforeEach(() => {
    database = new Database("test_db");
    database.connect(); // Connect the database
    queryExecutor = new QueryExecutor(database);
  });

  describe("Column Foreign Key Definition", () => {
    test("should create column with foreign key", () => {
      const column = new Column("user_id", "INT", false, false, true, {
        table: "users",
        column: "id",
      });

      expect(column.isForeignKey).toBe(true);
      expect(column.hasForeignKey()).toBe(true);
      expect(column.getForeignKeyReference()).toEqual({
        table: "users",
        column: "id",
      });
    });

    test("should throw error if foreign key is true but reference is missing", () => {
      expect(() => {
        new Column("user_id", "INT", false, false, true, undefined);
      }).toThrow(
        "Foreign key column 'user_id' must have a reference to another table"
      );
    });

    test("should throw error if reference is provided but foreign key is false", () => {
      expect(() => {
        new Column("user_id", "INT", false, false, false, {
          table: "users",
          column: "id",
        });
      }).toThrow(
        "Column 'user_id' has a foreign key reference but is not marked as a foreign key"
      );
    });

    test("should create regular column without foreign key", () => {
      const column = new Column(
        "name",
        "VARCHAR",
        false,
        false,
        false,
        undefined
      );

      expect(column.isForeignKey).toBe(false);
      expect(column.hasForeignKey()).toBe(false);
      expect(column.getForeignKeyReference()).toBeUndefined();
    });
  });

  describe("CREATE TABLE with Foreign Keys", () => {
    test("should create table with foreign key using SQL", () => {
      // Create parent table
      queryExecutor.execute(
        "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
      );

      // Create child table with foreign key
      const result = queryExecutor.execute(
        "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id))"
      );

      expect(result).toBe("Table orders created");

      const ordersTable = database.getTable("orders");
      expect(ordersTable).toBeDefined();

      const columns = ordersTable!.getColumns();
      const userIdColumn = columns.find(
        (col: Column) => col.name === "user_id"
      );
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn!.isForeignKey).toBe(true);
      expect(userIdColumn!.getForeignKeyReference()).toEqual({
        table: "users",
        column: "id",
      });
    });

    test("should create table with multiple foreign keys", () => {
      queryExecutor.execute(
        "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
      );
      queryExecutor.execute(
        "CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR)"
      );

      queryExecutor.execute(
        "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), product_id INT FOREIGN KEY REFERENCES products(id))"
      );

      const ordersTable = database.getTable("orders");
      expect(ordersTable).toBeDefined();

      const columns = ordersTable!.getColumns();
      const userIdColumn = columns.find(
        (col: Column) => col.name === "user_id"
      );
      const productIdColumn = columns.find(
        (col: Column) => col.name === "product_id"
      );

      expect(userIdColumn!.isForeignKey).toBe(true);
      expect(productIdColumn!.isForeignKey).toBe(true);
    });
  });

  describe("Foreign Key Validation on INSERT", () => {
    beforeEach(() => {
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
    });

    test("should insert record with valid foreign key", () => {
      const result = queryExecutor.execute(
        "INSERT INTO orders VALUES (1, 1, 100)"
      );

      expect(result).toBe("1 row inserted into orders");

      const orders = database.query("orders", () => true);
      expect(orders).toHaveLength(1);
      expect(orders[0].user_id).toBe(1);
    });

    test("should throw error when inserting invalid foreign key", () => {
      expect(() => {
        queryExecutor.execute("INSERT INTO orders VALUES (1, 999, 100)");
      }).toThrow(
        "Foreign key constraint violation on column 'user_id': Value '999' does not exist in users.id"
      );
    });

    test("should allow NULL foreign key value", () => {
      const result = queryExecutor.execute(
        "INSERT INTO orders VALUES (1, NULL, 100)"
      );

      expect(result).toBe("1 row inserted into orders");

      const orders = database.query("orders", () => true);
      expect(orders[0].user_id).toBeNull();
    });

    test("should throw error when referenced table does not exist", () => {
      queryExecutor.execute(
        "CREATE TABLE reviews (id INT PRIMARY KEY, product_id INT FOREIGN KEY REFERENCES products(id))"
      );

      expect(() => {
        queryExecutor.execute("INSERT INTO reviews VALUES (1, 1)");
      }).toThrow(
        "Foreign key constraint violation: Referenced table 'products' does not exist"
      );
    });

    test("should validate multiple foreign keys", () => {
      queryExecutor.execute(
        "CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR)"
      );
      queryExecutor.execute("INSERT INTO products VALUES (1, 'Widget')");

      queryExecutor.execute(
        "CREATE TABLE order_items (id INT PRIMARY KEY, order_id INT FOREIGN KEY REFERENCES orders(id), product_id INT FOREIGN KEY REFERENCES products(id))"
      );

      // First create the order
      queryExecutor.execute("INSERT INTO orders VALUES (1, 1, 100)");

      // Valid insert
      const result = queryExecutor.execute(
        "INSERT INTO order_items VALUES (1, 1, 1)"
      );
      expect(result).toBe("1 row inserted into order_items");

      // Invalid product_id
      expect(() => {
        queryExecutor.execute("INSERT INTO order_items VALUES (2, 1, 999)");
      }).toThrow("Foreign key constraint violation on column 'product_id'");
    });
  });

  describe("Foreign Key Validation on UPDATE", () => {
    beforeEach(() => {
      queryExecutor.execute(
        "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)"
      );
      queryExecutor.execute("INSERT INTO users VALUES (1, 'Alice')");
      queryExecutor.execute("INSERT INTO users VALUES (2, 'Bob')");

      queryExecutor.execute(
        "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), amount INT)"
      );
      queryExecutor.execute("INSERT INTO orders VALUES (1, 1, 100)");
    });

    test("should update record with valid foreign key", () => {
      const result = queryExecutor.execute(
        "UPDATE orders SET user_id = 2 WHERE id = 1"
      );

      expect(result).toBe("Records updated in orders");

      const orders = database.query("orders", (record: any) => record.id === 1);
      expect(orders[0].user_id).toBe(2);
    });

    test("should throw error when updating to invalid foreign key", () => {
      expect(() => {
        queryExecutor.execute("UPDATE orders SET user_id = 999 WHERE id = 1");
      }).toThrow(
        "Foreign key constraint violation on column 'user_id': Value '999' does not exist in users.id"
      );
    });

    test("should allow updating foreign key to NULL", () => {
      const result = queryExecutor.execute(
        "UPDATE orders SET user_id = NULL WHERE id = 1"
      );

      expect(result).toBe("Records updated in orders");

      const orders = database.query("orders", (record: any) => record.id === 1);
      expect(orders[0].user_id).toBeNull();
    });

    test("should validate foreign key when updating multiple columns", () => {
      const result = queryExecutor.execute(
        "UPDATE orders SET user_id = 2, amount = 200 WHERE id = 1"
      );

      expect(result).toBe("Records updated in orders");

      const orders = database.query("orders", (record: any) => record.id === 1);
      expect(orders[0].user_id).toBe(2);
      expect(orders[0].amount).toBe(200);
    });
  });

  describe("Complex Foreign Key Scenarios", () => {
    test("should handle cascading foreign keys", () => {
      // Create three-level hierarchy
      queryExecutor.execute(
        "CREATE TABLE countries (id INT PRIMARY KEY, name VARCHAR)"
      );
      queryExecutor.execute("INSERT INTO countries VALUES (1, 'USA')");

      queryExecutor.execute(
        "CREATE TABLE states (id INT PRIMARY KEY, name VARCHAR, country_id INT FOREIGN KEY REFERENCES countries(id))"
      );
      queryExecutor.execute("INSERT INTO states VALUES (1, 'California', 1)");

      queryExecutor.execute(
        "CREATE TABLE cities (id INT PRIMARY KEY, name VARCHAR, state_id INT FOREIGN KEY REFERENCES states(id))"
      );

      const result = queryExecutor.execute(
        "INSERT INTO cities VALUES (1, 'Los Angeles', 1)"
      );

      expect(result).toBe("1 row inserted into cities");
    });

    test("should handle self-referencing foreign key", () => {
      queryExecutor.execute(
        "CREATE TABLE employees (id INT PRIMARY KEY, name VARCHAR, manager_id INT FOREIGN KEY REFERENCES employees(id))"
      );

      // Insert root employee (manager_id is NULL)
      queryExecutor.execute("INSERT INTO employees VALUES (1, 'CEO', NULL)");

      // Insert employee with manager
      const result = queryExecutor.execute(
        "INSERT INTO employees VALUES (2, 'Manager', 1)"
      );

      expect(result).toBe("1 row inserted into employees");

      // Try to insert with invalid manager
      expect(() => {
        queryExecutor.execute(
          "INSERT INTO employees VALUES (3, 'Employee', 999)"
        );
      }).toThrow("Foreign key constraint violation");
    });

    test("should handle composite scenarios with mixed constraints", () => {
      queryExecutor.execute(
        "CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR UNIQUE)"
      );
      queryExecutor.execute("INSERT INTO users VALUES (1, 'alice@test.com')");

      queryExecutor.execute(
        "CREATE TABLE posts (id INT PRIMARY KEY, user_id INT FOREIGN KEY REFERENCES users(id), title VARCHAR UNIQUE)"
      );

      // Valid insert
      queryExecutor.execute("INSERT INTO posts VALUES (1, 1, 'First Post')");

      // Duplicate title (UNIQUE constraint)
      expect(() => {
        queryExecutor.execute("INSERT INTO posts VALUES (2, 1, 'First Post')");
      }).toThrow("Duplicate unique value");

      // Invalid foreign key
      expect(() => {
        queryExecutor.execute(
          "INSERT INTO posts VALUES (3, 999, 'Another Post')"
        );
      }).toThrow("Foreign key constraint violation");
    });
  });
});
