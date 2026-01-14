import express, { Express, Request, Response } from "express";
import Database from "../../core/database";
import { Column } from "../../core/column";
import { StorageEngine } from "../../core/storage-engine";

// Use default database for web interface
const databaseName = "default";
const db = new Database(databaseName);
const storage = new StorageEngine("./data", databaseName);

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
      res.json(tableDetails);
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
}
