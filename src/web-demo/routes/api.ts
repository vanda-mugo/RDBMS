import express, { Express, Request, Response } from "express";
import Database from "../../core/database";
import { Column } from "../../core/column";
import { StorageEngine } from "../../core/storage-engine";
import { QueryExecutor } from "../../core/query-executor";

// Use default database for web interface
let currentDatabaseName = "default";
let db = new Database(currentDatabaseName);
let storage = new StorageEngine("./data", currentDatabaseName);
let queryExecutor = new QueryExecutor(db);

// Concurrency flag for sync operations
let isSyncing = false;

// Load existing data from disk
console.log(" Loading database from disk...");
try {
  storage.loadDatabase(db);
  console.log(" Database loaded successfully");
  const tables = db.listTables();
  console.log(` Loaded ${tables.length} table(s): ${tables.join(", ")}`);
} catch (error) {
  console.log("Starting with fresh database");
}

db.connect();

// Initialize with a sample table (only if not loaded from disk)
try {
  if (!db.listTables().includes("users")) {
    console.log("Creating default 'users' table...");
    db.createTable("users", [
      new Column("id", "INT", true, false),
      new Column("name", "VARCHAR", false, false),
      new Column("email", "VARCHAR", false, true),
      new Column("age", "INT", false, false),
    ]);
    storage.saveDatabase(db);
    console.log(" Default table created");
  } else {
    const table = db.getTable("users");
    const recordCount = table?.selectAll().length || 0;
    console.log(` Table 'users' already exists with ${recordCount} records`);
  }
} catch (error) {
  console.log("Table initialization error:", (error as Error).message);
}

export function setRoutes(app: Express) {
  // Serve static files
  app.use(express.static("src/web-demo/public"));

  // ==================== DATABASE MANAGEMENT ====================

  // Get all databases
  app.get("/api/databases", (req: Request, res: Response) => {
    try {
      const databases = StorageEngine.listDatabases();
      const databaseList = databases.map((dbName) => ({
        name: dbName,
        current: dbName === currentDatabaseName,
      }));

      res.json({
        databases: databaseList,
        currentDatabase: currentDatabaseName,
        count: databases.length,
      });
    } catch (error) {
      console.error("Error listing databases:", error);
      res.status(500).json({
        error: "Failed to list databases",
        message: (error as Error).message,
      });
    }
  });

  // Get current database info
  app.get("/api/databases/current", (req: Request, res: Response) => {
    try {
      const tables = db.listTables();
      const tableCount = tables.length;

      let totalRecords = 0;
      tables.forEach((tableName) => {
        const table = db.getTable(tableName);
        if (table) {
          totalRecords += table.selectAll().length;
        }
      });

      res.json({
        name: currentDatabaseName,
        tables: tables,
        tableCount: tableCount,
        totalRecords: totalRecords,
      });
    } catch (error) {
      console.error("Error getting current database info:", error);
      res.status(500).json({
        error: "Failed to get database info",
        message: (error as Error).message,
      });
    }
  });

  // Create a new database
  app.post("/api/databases", (req: Request, res: Response) => {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Database name is required",
        });
      }

      // Validate database name
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({
          error:
            "Database name can only contain letters, numbers, underscores, and hyphens",
        });
      }

      // Check if database already exists
      const databases = StorageEngine.listDatabases();
      if (databases.includes(name)) {
        return res.status(409).json({
          error: `Database '${name}' already exists`,
        });
      }

      // Create new database
      const newStorage = new StorageEngine("./data", name);
      const newDb = new Database(name);
      newDb.connect();
      newStorage.saveDatabase(newDb);

      res.status(201).json({
        message: `Database '${name}' created successfully`,
        name: name,
      });
    } catch (error) {
      console.error("Error creating database:", error);
      res.status(500).json({
        error: "Failed to create database",
        message: (error as Error).message,
      });
    }
  });

  // Switch to a different database
  app.post("/api/databases/:name/use", (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      // Check if database exists
      const databases = StorageEngine.listDatabases();
      if (!databases.includes(name)) {
        return res.status(404).json({
          error: `Database '${name}' does not exist`,
          availableDatabases: databases,
        });
      }

      // Save current database before switching
      console.log(` Saving current database '${currentDatabaseName}'...`);
      storage.saveDatabase(db);

      // Drop all current tables from memory
      const currentTables = db.listTables();
      currentTables.forEach((tableName) => {
        try {
          db.dropTable(tableName);
        } catch (err) {
          // Ignore drop errors
        }
      });

      // Switch to new database
      currentDatabaseName = name;
      db.setDatabaseName(name);
      storage = new StorageEngine("./data", name);
      queryExecutor = new QueryExecutor(db); // Update query executor

      // Load the new database
      console.log(` Loading database '${name}'...`);
      storage.loadDatabase(db);

      const tables = db.listTables();
      res.json({
        message: `Switched to database '${name}'`,
        database: name,
        tablesLoaded: tables.length,
        tables: tables,
      });
    } catch (error) {
      console.error("Error switching database:", error);
      res.status(500).json({
        error: "Failed to switch database",
        message: (error as Error).message,
      });
    }
  });

  // Delete a database
  app.delete("/api/databases/:name", (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      // Prevent deleting current database
      if (name === currentDatabaseName) {
        return res.status(400).json({
          error: `Cannot drop current database '${name}'`,
          message: "Switch to another database first",
        });
      }

      // Check if database exists
      const databases = StorageEngine.listDatabases();
      if (!databases.includes(name)) {
        return res.status(404).json({
          error: `Database '${name}' does not exist`,
        });
      }

      // Drop the database
      StorageEngine.dropDatabase("./data", name);

      res.json({
        message: `Database '${name}' dropped successfully`,
        name: name,
      });
    } catch (error) {
      console.error("Error dropping database:", error);
      res.status(500).json({
        error: "Failed to drop database",
        message: (error as Error).message,
      });
    }
  });

  // ==================== TABLE MANAGEMENT ====================

  // Get all tables
  app.get("/api/tables", (req: Request, res: Response) => {
    try {
      const tables = db.listTables();
      const tableDetails = tables.map((tableName) => {
        const table = db.getTable(tableName);
        const columns = table?.getColumns() || [];
        const recordCount = table?.selectAll().length || 0;
        return {
          name: tableName,
          columns: columns.map((col) => ({
            name: col.name,
            dataType: col.dataType,
            isPrimaryKey: col.isPrimaryKey,
            isUnique: col.isUnique,
          })),
          recordCount,
        };
      });
      res.json({
        currentDatabase: currentDatabaseName,
        tables: tableDetails,
        tableCount: tables.length,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create a new table
  app.post("/api/tables", (req: Request, res: Response) => {
    try {
      const { tableName, columns } = req.body;

      if (!tableName || !columns || !Array.isArray(columns)) {
        return res.status(400).json({
          error:
            "Invalid request. Required: tableName (string) and columns (array)",
        });
      }

      // Check if table already exists (case-insensitive)
      const existingTables = db.listTables();
      const tableExists = existingTables.some(
        (t) => t.toLowerCase() === tableName.toLowerCase()
      );

      if (tableExists) {
        return res
          .status(400)
          .json({ error: `Table '${tableName}' already exists` });
      }

      // Create columns
      const columnObjects = columns.map(
        (col: any) =>
          new Column(
            col.name,
            col.dataType || "VARCHAR",
            col.isPrimaryKey || false,
            col.isUnique || false
          )
      );

      db.createTable(tableName, columnObjects);
      storage.saveDatabase(db);

      res.status(201).json({
        message: `Table '${tableName}' created successfully`,
        tableName,
        columns: columnObjects.map((col) => ({
          name: col.name,
          type: col.dataType,
          isPrimaryKey: col.isPrimaryKey,
          isUnique: col.isUnique,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Drop a table
  app.delete("/api/tables/:tableName", (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;

      if (!db.listTables().includes(tableName)) {
        return res
          .status(404)
          .json({ error: `Table '${tableName}' does not exist` });
      }

      db.dropTable(tableName);
      storage.saveDatabase(db);

      res.json({ message: `Table '${tableName}' dropped successfully` });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ==================== RECORD MANAGEMENT ====================

  // Get all records from a specific table
  app.get("/api/tables/:tableName/records", (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;

      if (!db.listTables().includes(tableName)) {
        return res
          .status(404)
          .json({ error: `Table '${tableName}' does not exist` });
      }

      const records = db.query(tableName, () => true);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create a new record in a specific table
  app.post("/api/tables/:tableName/records", (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const data = req.body;

      if (!db.listTables().includes(tableName)) {
        return res
          .status(404)
          .json({ error: `Table '${tableName}' does not exist` });
      }

      db.insert(tableName, data);
      storage.saveDatabase(db);

      res.status(201).json({ message: "Record created successfully", data });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update records in a specific table
  app.put("/api/tables/:tableName/records", (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const { data, condition } = req.body;

      if (!db.listTables().includes(tableName)) {
        return res
          .status(404)
          .json({ error: `Table '${tableName}' does not exist` });
      }

      if (!data || !condition) {
        return res.status(400).json({
          error:
            "Invalid request. Required: data (object) and condition (object)",
        });
      }

      // Create condition function from object
      // Example: { column: "id", operator: "=", value: 1 }
      const conditionFn = (record: any) => {
        const { column, operator, value } = condition;
        switch (operator) {
          case "=":
            return record[column] == value;
          case "!=":
            return record[column] != value;
          case ">":
            return record[column] > value;
          case "<":
            return record[column] < value;
          case ">=":
            return record[column] >= value;
          case "<=":
            return record[column] <= value;
          default:
            return false;
        }
      };

      db.update(tableName, data, conditionFn);
      storage.saveDatabase(db);

      res.json({ message: "Records updated successfully" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete records from a specific table
  app.delete(
    "/api/tables/:tableName/records",
    (req: Request, res: Response) => {
      try {
        const { tableName } = req.params;
        const { condition } = req.body;

        if (!db.listTables().includes(tableName)) {
          return res
            .status(404)
            .json({ error: `Table '${tableName}' does not exist` });
        }

        if (!condition) {
          return res.status(400).json({
            error: "Invalid request. Required: condition (object)",
          });
        }

        // Create condition function from object
        const conditionFn = (record: any) => {
          const { column, operator, value } = condition;
          switch (operator) {
            case "=":
              return record[column] == value;
            case "!=":
              return record[column] != value;
            case ">":
              return record[column] > value;
            case "<":
              return record[column] < value;
            case ">=":
              return record[column] >= value;
            case "<=":
              return record[column] <= value;
            default:
              return false;
          }
        };

        db.delete(tableName, conditionFn);
        storage.saveDatabase(db);

        res.json({ message: "Records deleted successfully" });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    }
  );

  // ==================== LEGACY ROUTES (for backward compatibility) ====================

  // These routes now delegate to the table-specific routes
  app.post("/api/records", (req: Request, res: Response) => {
    req.params.tableName = "users";
    return app._router.handle(
      { ...req, method: "POST", url: "/api/tables/users/records" },
      res,
      () => {}
    );
  });

  app.get("/api/records", (req: Request, res: Response) => {
    try {
      const records = db.query("users", () => true);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/records/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;

      db.update("users", data, (record) => record.id === id);
      storage.saveDatabase(db);

      res.json({ message: "Record updated successfully" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/records/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      db.delete("users", (record) => record.id === id);
      storage.saveDatabase(db);

      res.json({ message: "Record deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ==================== DATABASE MANAGEMENT ====================

  // Get database statistics
  app.get("/api/stats", (req: Request, res: Response) => {
    try {
      const tables = db.listTables();
      const stats = {
        currentDatabase: currentDatabaseName,
        totalTables: tables.length,
        tables: tables.map((tableName) => {
          const table = db.getTable(tableName);
          return {
            name: tableName,
            recordCount: table?.selectAll().length || 0,
            columnCount: table?.getColumns().length || 0,
          };
        }),
        databaseSize: storage.getDatabaseSize(),
        databaseExists: storage.databaseExists(),
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Create backup
  app.post("/api/backup", (req: Request, res: Response) => {
    try {
      const backupPath = storage.backup();
      res.json({ message: "Backup created successfully", backupPath });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // List available backups
  app.get("/api/backups", (req: Request, res: Response) => {
    try {
      const backups = storage.listBackups();
      const backupDetails = backups.map((backupPath) => {
        const fileName = backupPath.split("/").pop() || backupPath;
        const stats = require("fs").statSync(backupPath);
        return {
          path: backupPath,
          fileName,
          size: stats.size,
          created: stats.mtime,
        };
      });
      res.json(backupDetails);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Restore from backup
  app.post("/api/restore", (req: Request, res: Response) => {
    try {
      const { backupPath } = req.body;

      if (!backupPath) {
        return res.status(400).json({ error: "Backup path is required" });
      }

      storage.restoreFromBackup(backupPath, db);
      storage.saveDatabase(db);

      res.json({
        message: "Database restored successfully",
        restoredFrom: backupPath,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Sync database from disk
  app.post("/api/sync", (req: Request, res: Response) => {
    if (isSyncing) {
      return res.status(409).json({ error: "Sync already in progress" });
    }

    isSyncing = true;

    try {
      console.log(" Syncing database from disk...");

      // Drop all existing tables
      const existingTables = db.listTables();
      existingTables.forEach((tableName) => {
        try {
          db.dropTable(tableName);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`Could not drop table '${tableName}':`, message);
        }
      });

      // Reload from disk
      storage.loadDatabase(db);

      const tables = db.listTables();
      console.log(`✓ Database synced - loaded ${tables.length} table(s)`);

      res.json({
        message: "Database synced successfully",
        tablesLoaded: tables.length,
        tables: tables,
      });
    } catch (error) {
      console.error("✗ Sync failed:", error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      isSyncing = false;
    }
  });

  // ==================== INDEX MANAGEMENT ====================

  // Get all indexes or indexes for a specific table
  app.get("/api/indexes", (req: Request, res: Response) => {
    try {
      const { table } = req.query;
      let result;

      if (table && typeof table === "string") {
        // Get indexes for specific table
        result = queryExecutor.execute(`SHOW INDEXES ON ${table}`);
      } else {
        // Get all indexes
        result = queryExecutor.execute("SHOW INDEXES");
      }

      res.json({
        indexes: result,
        count: result.length,
        table: table || "all",
      });
    } catch (error) {
      console.error("Error getting indexes:", error);
      res.status(500).json({
        error: "Failed to get indexes",
        message: (error as Error).message,
      });
    }
  });

  // Create an index
  app.post("/api/indexes", (req: Request, res: Response) => {
    try {
      const { indexName, tableName, columnName, unique } = req.body;

      if (!indexName || !tableName || !columnName) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["indexName", "tableName", "columnName"],
        });
      }

      // Execute CREATE INDEX command with optional UNIQUE keyword
      const uniqueKeyword = unique ? "UNIQUE " : "";
      const sql = `CREATE ${uniqueKeyword}INDEX ${indexName} ON ${tableName}(${columnName})`;
      const result = queryExecutor.execute(sql);

      // Save database after creating index
      storage.saveDatabase(db);

      res.json({
        success: true,
        message: result.message,
        index: {
          name: indexName,
          table: tableName,
          column: columnName,
          unique: unique || false,
        },
      });
    } catch (error) {
      console.error("Error creating index:", error);
      res.status(500).json({
        error: "Failed to create index",
        message: (error as Error).message,
      });
    }
  });

  // Drop an index
  app.delete("/api/indexes/:indexName", (req: Request, res: Response) => {
    try {
      const { indexName } = req.params;
      const { tableName } = req.body;

      if (!tableName) {
        return res.status(400).json({
          error: "Missing required field: tableName",
        });
      }

      // Execute DROP INDEX command
      const sql = `DROP INDEX ${indexName} ON ${tableName}`;
      const result = queryExecutor.execute(sql);

      // Save database after dropping index
      storage.saveDatabase(db);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("Error dropping index:", error);
      res.status(500).json({
        error: "Failed to drop index",
        message: (error as Error).message,
      });
    }
  });

  // Execute arbitrary SQL (including index commands)
  app.post("/api/sql", (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
        });
      }

      // Execute SQL using QueryExecutor
      const result = queryExecutor.execute(query);

      // Auto-save after data modifications and index operations
      const upperQuery = query.trim().toUpperCase();
      if (
        upperQuery.startsWith("INSERT") ||
        upperQuery.startsWith("UPDATE") ||
        upperQuery.startsWith("DELETE") ||
        upperQuery.startsWith("CREATE") ||
        upperQuery.startsWith("DROP")
      ) {
        storage.saveDatabase(db);
      }

      res.json({
        success: true,
        result: result,
        query: query,
      });
    } catch (error) {
      console.error("SQL execution error:", error);
      res.status(500).json({
        error: "SQL execution failed",
        message: (error as Error).message,
        query: req.body.query,
      });
    }
  });
}
