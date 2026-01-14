import Database from "../src/core/database";
import { Column } from "../src/core/column";
import { QueryExecutor } from "../src/core/query-executor";

describe("Index SQL Commands", () => {
  let database: Database;
  let queryExecutor: QueryExecutor;

  beforeEach(() => {
    database = new Database("test-db");
    database.connect();
    queryExecutor = new QueryExecutor(database);

    // Create a test table with some data
    database.createTable("products", [
      new Column("id", "number", true, false),
      new Column("name", "string", false, false),
      new Column("price", "number", false, false),
      new Column("category", "string", false, false),
    ]);

    database.insert("products", {
      id: 1,
      name: "Laptop",
      price: 1000,
      category: "Electronics",
    });
    database.insert("products", {
      id: 2,
      name: "Phone",
      price: 500,
      category: "Electronics",
    });
    database.insert("products", {
      id: 3,
      name: "Desk",
      price: 300,
      category: "Furniture",
    });
    database.insert("products", {
      id: 4,
      name: "Chair",
      price: 150,
      category: "Furniture",
    });
  });

  describe("CREATE INDEX", () => {
    it("should create an index using SQL command", () => {
      const result = queryExecutor.execute(
        "CREATE INDEX idx_price ON products(price)"
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("idx_price");
      expect(result.message).toContain("products.price");
    });

    it("should create index and be usable in queries", () => {
      // Create index
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");

      // Query should use the index
      const results = queryExecutor.execute(
        "SELECT * FROM products WHERE price = 500"
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Phone");
    });

    it("should throw error if table doesn't exist", () => {
      expect(() => {
        queryExecutor.execute("CREATE INDEX idx_test ON nonexistent(column)");
      }).toThrow("Table 'nonexistent' does not exist");
    });

    it("should throw error if column doesn't exist", () => {
      expect(() => {
        queryExecutor.execute("CREATE INDEX idx_test ON products(nonexistent)");
      }).toThrow("Column 'nonexistent' does not exist");
    });

    it("should throw error if index name already exists", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");

      expect(() => {
        queryExecutor.execute("CREATE INDEX idx_price ON products(category)");
      }).toThrow("Index 'idx_price' already exists");
    });

    it("should throw error for invalid CREATE INDEX syntax", () => {
      expect(() => {
        queryExecutor.execute("CREATE INDEX idx_test");
      }).toThrow("Invalid CREATE INDEX syntax");
    });

    it("should create multiple indexes on different columns", () => {
      const result1 = queryExecutor.execute(
        "CREATE INDEX idx_price ON products(price)"
      );
      const result2 = queryExecutor.execute(
        "CREATE INDEX idx_category ON products(category)"
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe("DROP INDEX", () => {
    beforeEach(() => {
      // Create some indexes
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      queryExecutor.execute("CREATE INDEX idx_category ON products(category)");
    });

    it("should drop an index using SQL command", () => {
      const result = queryExecutor.execute("DROP INDEX idx_price ON products");

      expect(result.success).toBe(true);
      expect(result.message).toContain("idx_price");
      expect(result.message).toContain("products");
    });

    it("should throw error if index doesn't exist", () => {
      expect(() => {
        queryExecutor.execute("DROP INDEX idx_nonexistent ON products");
      }).toThrow("Index 'idx_nonexistent' does not exist");
    });

    it("should throw error if table doesn't exist", () => {
      expect(() => {
        queryExecutor.execute("DROP INDEX idx_price ON nonexistent");
      }).toThrow("Table 'nonexistent' does not exist");
    });

    it("should throw error for invalid DROP INDEX syntax", () => {
      expect(() => {
        queryExecutor.execute("DROP INDEX idx_test");
      }).toThrow("Invalid DROP INDEX syntax");
    });

    it("should allow dropping and recreating an index", () => {
      queryExecutor.execute("DROP INDEX idx_price ON products");
      const result = queryExecutor.execute(
        "CREATE INDEX idx_price ON products(price)"
      );

      expect(result.success).toBe(true);
    });
  });

  describe("SHOW INDEXES", () => {
    it("should show empty list when no indexes exist", () => {
      const result = queryExecutor.execute("SHOW INDEXES");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should show all indexes across all tables", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      queryExecutor.execute("CREATE INDEX idx_category ON products(category)");

      const result = queryExecutor.execute("SHOW INDEXES");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      const priceIndex = result.find((idx: any) => idx.name === "idx_price");
      expect(priceIndex).toBeDefined();
      expect(priceIndex.table).toBe("products");
      expect(priceIndex.column).toBe("price");
      expect(priceIndex.type).toBe("HASH");

      const categoryIndex = result.find(
        (idx: any) => idx.name === "idx_category"
      );
      expect(categoryIndex).toBeDefined();
      expect(categoryIndex.table).toBe("products");
      expect(categoryIndex.column).toBe("category");
    });

    it("should show indexes for a specific table", () => {
      // Create another table
      database.createTable("users", [
        new Column("id", "number", true, false),
        new Column("age", "number", false, false),
      ]);

      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      queryExecutor.execute("CREATE INDEX idx_age ON users(age)");

      const result = queryExecutor.execute("SHOW INDEXES ON products");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("idx_price");
      expect(result[0].table).toBe("products");
    });

    it("should throw error if table doesn't exist in SHOW INDEXES ON", () => {
      expect(() => {
        queryExecutor.execute("SHOW INDEXES ON nonexistent");
      }).toThrow("Table 'nonexistent' does not exist");
    });

    it("should return empty array for table with no indexes", () => {
      database.createTable("users", [
        new Column("id", "number", true, false),
        new Column("age", "number", false, false),
      ]);

      const result = queryExecutor.execute("SHOW INDEXES ON users");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should show updated list after creating and dropping indexes", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      queryExecutor.execute("CREATE INDEX idx_category ON products(category)");

      let result = queryExecutor.execute("SHOW INDEXES");
      expect(result).toHaveLength(2);

      queryExecutor.execute("DROP INDEX idx_price ON products");

      result = queryExecutor.execute("SHOW INDEXES");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("idx_category");
    });
  });

  describe("Integration with Query Optimization", () => {
    it("should use index created via SQL in SELECT queries", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");

      // Verify index is being used by checking results
      const results = queryExecutor.execute(
        "SELECT * FROM products WHERE price >= 300"
      );

      expect(results).toHaveLength(3);
      expect(results.map((r: any) => r.name).sort()).toEqual([
        "Desk",
        "Laptop",
        "Phone",
      ]);
    });

    it("should continue to work after index is dropped", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");

      let results = queryExecutor.execute(
        "SELECT * FROM products WHERE price = 500"
      );
      expect(results).toHaveLength(1);

      // Drop index
      queryExecutor.execute("DROP INDEX idx_price ON products");

      // Query should still work (fall back to full scan)
      results = queryExecutor.execute(
        "SELECT * FROM products WHERE price = 500"
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Phone");
    });

    it("should maintain index when new records are inserted", () => {
      queryExecutor.execute("CREATE INDEX idx_category ON products(category)");

      // Insert new record
      database.insert("products", {
        id: 5,
        name: "Monitor",
        price: 400,
        category: "Electronics",
      });

      // Query should return all Electronics including the new one
      const results = queryExecutor.execute(
        "SELECT * FROM products WHERE category = Electronics"
      );

      expect(results).toHaveLength(3);
      expect(results.map((r: any) => r.name).sort()).toEqual([
        "Laptop",
        "Monitor",
        "Phone",
      ]);
    });
  });

  describe("Case Insensitivity", () => {
    it("should handle CREATE INDEX with different cases", () => {
      const result = queryExecutor.execute(
        "create index idx_price on products(price)"
      );
      expect(result.success).toBe(true);
    });

    it("should handle DROP INDEX with different cases", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      const result = queryExecutor.execute("drop index idx_price on products");
      expect(result.success).toBe(true);
    });

    it("should handle SHOW INDEXES with different cases", () => {
      queryExecutor.execute("CREATE INDEX idx_price ON products(price)");
      const result = queryExecutor.execute("show indexes");
      expect(result).toHaveLength(1);
    });
  });
});
