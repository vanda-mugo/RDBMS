import * as fs from "fs";
import * as path from "path";
import Database from "./database";
import { Table } from "./table";
import { Column } from "./column";

interface SerializedDatabase {
  tables: {
    [tableName: string]: {
      columns: {
        name: string;
        dataType: string;
        isPrimaryKey: boolean;
        isUnique: boolean;
      }[];
      records: any[];
    };
  };
  metadata: {
    version: string;
    lastSaved: string;
  };
}

export class StorageEngine {
  private dataDir: string;
  private dbFilePath: string;
  private logFilePath: string;

  constructor(dataDir: string = "./data") {
    this.dataDir = dataDir;
    this.dbFilePath = path.join(dataDir, "database.json");
    this.logFilePath = path.join(dataDir, "transaction.log");

    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Ensures the data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Saves the entire database to disk
   * @param database The database instance to save
   */
  public saveDatabase(database: Database): void {
    try {
      const serialized = this.serializeDatabase(database);
      const jsonData = JSON.stringify(serialized, null, 2);

      // Write to file
      fs.writeFileSync(this.dbFilePath, jsonData, "utf8");
      console.log(`Database saved to ${this.dbFilePath}`);

      // Log the operation
      this.logOperation(
        "SAVE",
        `Database saved at ${new Date().toISOString()}`
      );
    } catch (error) {
      throw new Error(`Failed to save database: ${error}`);
    }
  }

  /**
   * Loads the database from disk
   * @param database The database instance to load data into
   */
  public loadDatabase(database: Database): void {
    try {
      if (!fs.existsSync(this.dbFilePath)) {
        console.log(
          "No existing database file found. Starting with empty database."
        );
        return;
      }

      const jsonData = fs.readFileSync(this.dbFilePath, "utf8");
      const serialized: SerializedDatabase = JSON.parse(jsonData);

      this.deserializeDatabase(database, serialized);
      console.log(`Database loaded from ${this.dbFilePath}`);

      // Log the operation
      this.logOperation(
        "LOAD",
        `Database loaded at ${new Date().toISOString()}`
      );
    } catch (error) {
      throw new Error(`Failed to load database: ${error}`);
    }
  }

  /**
   * Serializes the database to a JSON-compatible object
   */
  private serializeDatabase(database: Database): SerializedDatabase {
    const tables: any = {};
    const allTables = database.listTables();

    for (const tableName of allTables) {
      const table = database.getTable(tableName);

      if (table) {
        tables[tableName] = {
          columns: table.getColumns().map((col: Column) => ({
            name: col.name,
            dataType: col.dataType,
            isPrimaryKey: col.isPrimaryKey,
            isUnique: col.isUnique,
          })),
          records: table.selectAll(),
        };
      }
    }

    return {
      tables,
      metadata: {
        version: "1.0.0",
        lastSaved: new Date().toISOString(),
      },
    };
  }

  /**
   * Deserializes JSON data and rebuilds the database
   */
  private deserializeDatabase(
    database: Database,
    serialized: SerializedDatabase
  ): void {
    // Ensure database is connected
    if (!database["connected"]) {
      database.connect();
    }

    // Recreate tables
    for (const [tableName, tableData] of Object.entries(serialized.tables)) {
      // Create columns array
      const columns = tableData.columns.map(
        (col: any) =>
          new Column(col.name, col.dataType, col.isPrimaryKey, col.isUnique)
      );

      // Create table
      database.createTable(tableName, columns);

      // Insert records
      for (const record of tableData.records) {
        database.insert(tableName, record);
      }
    }
  }

  /**
   * Backs up the current database file
   */
  public backup(): string {
    try {
      if (!fs.existsSync(this.dbFilePath)) {
        throw new Error("No database file to backup");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(
        this.dataDir,
        `database-backup-${timestamp}.json`
      );

      fs.copyFileSync(this.dbFilePath, backupPath);
      console.log(`Backup created: ${backupPath}`);

      this.logOperation("BACKUP", `Backup created at ${backupPath}`);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Lists all available backup files
   */
  public listBackups(): string[] {
    try {
      if (!fs.existsSync(this.dataDir)) {
        return [];
      }

      const files = fs.readdirSync(this.dataDir);
      const backupFiles = files
        .filter(
          (file) =>
            file.startsWith("database-backup-") && file.endsWith(".json")
        )
        .sort()
        .reverse(); // Most recent first

      return backupFiles.map((file) => path.join(this.dataDir, file));
    } catch (error) {
      console.error(`Failed to list backups: ${error}`);
      return [];
    }
  }

  /**
   * Restores database from a backup file
   */
  public restoreFromBackup(backupPath: string, database: Database): void {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Read backup file
      const jsonData = fs.readFileSync(backupPath, "utf8");
      const serialized: SerializedDatabase = JSON.parse(jsonData);

      // Clear current database
      database.disconnect();
      database.connect();

      // Restore from backup
      this.deserializeDatabase(database, serialized);
      console.log(`Database restored from ${backupPath}`);

      this.logOperation("RESTORE", `Database restored from ${backupPath}`);
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error}`);
    }
  }

  /**
   * Logs an operation to the transaction log
   */
  private logOperation(operation: string, details: string): void {
    try {
      const logEntry = `[${new Date().toISOString()}] ${operation}: ${details}\n`;
      fs.appendFileSync(this.logFilePath, logEntry, "utf8");
    } catch (error) {
      console.error(`Failed to log operation: ${error}`);
    }
  }

  /**
   * Reads the transaction log
   */
  public getTransactionLog(): string[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return [];
      }

      const logContent = fs.readFileSync(this.logFilePath, "utf8");
      return logContent
        .split("\n")
        .filter((line: string) => line.trim() !== "");
    } catch (error) {
      throw new Error(`Failed to read transaction log: ${error}`);
    }
  }

  /**
   * Clears the transaction log
   */
  public clearLog(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath);
        console.log("Transaction log cleared");
      }
    } catch (error) {
      throw new Error(`Failed to clear log: ${error}`);
    }
  }

  /**
   * Exports database to a specific file
   */
  public exportToFile(database: Database, filePath: string): void {
    try {
      const serialized = this.serializeDatabase(database);
      const jsonData = JSON.stringify(serialized, null, 2);

      fs.writeFileSync(filePath, jsonData, "utf8");
      console.log(`Database exported to ${filePath}`);
    } catch (error) {
      throw new Error(`Failed to export database: ${error}`);
    }
  }

  /**
   * Imports database from a specific file
   */
  public importFromFile(database: Database, filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Import file not found: ${filePath}`);
      }

      const jsonData = fs.readFileSync(filePath, "utf8");
      const serialized: SerializedDatabase = JSON.parse(jsonData);

      this.deserializeDatabase(database, serialized);
      console.log(`Database imported from ${filePath}`);
    } catch (error) {
      throw new Error(`Failed to import database: ${error}`);
    }
  }

  /**
   * Gets the size of the database file in bytes
   */
  public getDatabaseSize(): number {
    try {
      if (!fs.existsSync(this.dbFilePath)) {
        return 0;
      }

      const stats = fs.statSync(this.dbFilePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Checks if a database file exists
   */
  public databaseExists(): boolean {
    return fs.existsSync(this.dbFilePath);
  }

  /**
   * Deletes the database file (use with caution!)
   */
  public deleteDatabase(): void {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        fs.unlinkSync(this.dbFilePath);
        console.log("Database file deleted");
      }

      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath);
        console.log("Transaction log deleted");
      }
    } catch (error) {
      throw new Error(`Failed to delete database: ${error}`);
    }
  }
}
