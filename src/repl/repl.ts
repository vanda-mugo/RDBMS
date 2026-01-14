import * as readline from "readline";
import Database from "../core/database";
import { Column } from "../core/column";
import { StorageEngine } from "../core/storage-engine";
import { QueryExecutor } from "../core/query-executor";

export class REPL {
  private db: Database;
  private rl: readline.Interface;
  private storage: StorageEngine;
  private queryExecutor: QueryExecutor;

  constructor(database: Database) {
    this.db = database;
    // Use the database's name for storage
    const databaseName = this.db.getDatabaseName();
    this.storage = new StorageEngine("./data", databaseName);
    this.queryExecutor = new QueryExecutor(database);

    // Load existing data from disk
    console.log(" Loading database from disk...");
    try {
      this.storage.loadDatabase(this.db);
      console.log("✓ Database loaded successfully\n");
    } catch (error) {
      console.log("Starting with fresh database\n");
    }

    this.db.connect();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  public start() {
    console.log("=====================================");
    console.log("Welcome to Simple RDBMS REPL");
    console.log("=====================================");
    console.log(`Current Database: ${this.db.getDatabaseName()}`);
    console.log("Mode: SQL + Simple Commands");
    console.log("\n SQL Commands (full SQL syntax):");
    console.log("  SELECT * FROM users");
    console.log("  SELECT name, age FROM users WHERE age > 25");
    console.log("  INSERT INTO users (id, name, age) VALUES (1, 'Alice', 30)");
    console.log("  UPDATE users SET age = 31 WHERE id = 1");
    console.log("  DELETE FROM users WHERE age < 18");
    console.log("  CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)");
    console.log("  DROP TABLE users");
    console.log("\n⚡ Quick Commands:");
    console.log("  TABLES - List all tables in current database");
    console.log("  SAVE - Save database to disk");
    console.log("  SYNC - Reload database from disk");
    console.log("  BACKUP - Create backup");
    console.log("  BACKUPS - List available backups");
    console.log("  RESTORE <path> - Restore from backup");
    console.log("\n  Database Commands:");
    console.log("  SHOW DATABASES - List all databases");
    console.log("  CURRENT DATABASE - Show current database name");
    console.log("  USE DATABASE <name> - Switch to another database");
    console.log("  CREATE DATABASE <name> - Create new database");
    console.log("  DROP DATABASE <name> - Delete a database");
    console.log("\n  EXIT - Exit REPL (auto-saves)");
    console.log("=====================================\n");
    this.prompt();
  }

  private prompt() {
    this.rl.question(`RDBMS[${this.db.getDatabaseName()}]> `, (input) => {
      this.handleInput(input.trim());
    });
  }

  private handleInput(input: string) {
    if (!input) {
      this.prompt();
      return;
    }

    try {
      const command = input.toUpperCase();

      if (command === "EXIT" || command === "QUIT") {
        console.log("\n Saving database before exit...");
        this.storage.saveDatabase(this.db);
        console.log("✓ Database saved successfully");
        console.log("Goodbye!");
        this.stop();
        process.exit(0);
        return;
      }

      if (command === "TABLES") {
        const tables = this.db.listTables();
        console.log(
          "Tables:",
          tables.length === 0 ? "No tables found" : tables.join(", ")
        );
        this.prompt();
        return;
      }

      // Database management commands
      if (command === "SHOW DATABASES") {
        try {
          const databases = StorageEngine.listDatabases();
          if (databases.length === 0) {
            console.log("No databases found");
          } else {
            console.log(`\nAvailable databases (${databases.length}):`);
            databases.forEach((dbName) => {
              const current =
                dbName === this.db.getDatabaseName() ? " (current)" : "";
              console.log(`  • ${dbName}${current}`);
            });
            console.log("\nTo switch: USE DATABASE <name>");
          }
        } catch (error: any) {
          console.log(` Error listing databases: ${error.message}`);
        }
        this.prompt();
        return;
      }

      if (command === "CURRENT DATABASE") {
        console.log(`Current database: ${this.db.getDatabaseName()}`);
        this.prompt();
        return;
      }

      if (command.startsWith("USE DATABASE ")) {
        const newDbName = input.substring(13).trim();
        if (!newDbName) {
          console.log(" Please specify a database name: USE DATABASE <name>");
          this.prompt();
          return;
        }

        try {
          // Check if database exists
          const databases = StorageEngine.listDatabases();
          if (!databases.includes(newDbName)) {
            console.log(` Database '${newDbName}' does not exist`);
            console.log(`  Available databases: ${databases.join(", ")}`);
            this.prompt();
            return;
          }

          // Save current database before switching
          console.log(
            ` Saving current database '${this.db.getDatabaseName()}'...`
          );
          this.storage.saveDatabase(this.db);

          // Drop all current tables from memory
          const currentTables = this.db.listTables();
          currentTables.forEach((tableName) => {
            try {
              this.db.dropTable(tableName);
            } catch (err) {
              // Ignore drop errors
            }
          });

          // Switch to new database
          this.db.setDatabaseName(newDbName);
          this.storage = new StorageEngine("./data", newDbName);

          // Load the new database
          console.log(` Loading database '${newDbName}'...`);
          this.storage.loadDatabase(this.db);

          const tables = this.db.listTables();
          console.log(
            `✓ Switched to database '${newDbName}' (${tables.length} table(s))`
          );
        } catch (error: any) {
          console.log(`✗ Error switching database: ${error.message}`);
        }
        this.prompt();
        return;
      }

      if (command.startsWith("CREATE DATABASE ")) {
        const newDbName = input.substring(16).trim();
        if (!newDbName) {
          console.log(
            " Please specify a database name: CREATE DATABASE <name>"
          );
          this.prompt();
          return;
        }

        // Validate database name (alphanumeric, underscores, hyphens)
        if (!/^[a-zA-Z0-9_-]+$/.test(newDbName)) {
          console.log(
            " Database name can only contain letters, numbers, underscores, and hyphens"
          );
          this.prompt();
          return;
        }

        try {
          // Check if database already exists
          const databases = StorageEngine.listDatabases();
          if (databases.includes(newDbName)) {
            console.log(` Database '${newDbName}' already exists`);
            this.prompt();
            return;
          }

          // Create new storage engine (this will create the directory)
          const newStorage = new StorageEngine("./data", newDbName);

          // Create an empty database and save it
          const newDb = new Database(newDbName);
          newDb.connect();
          newStorage.saveDatabase(newDb);

          console.log(`✓ Database '${newDbName}' created successfully`);
          console.log(`  To switch: USE DATABASE ${newDbName}`);
        } catch (error: any) {
          console.log(` Error creating database: ${error.message}`);
        }
        this.prompt();
        return;
      }

      if (command.startsWith("DROP DATABASE ")) {
        const dbNameToDrop = input.substring(14).trim();
        if (!dbNameToDrop) {
          console.log(" Please specify a database name: DROP DATABASE <name>");
          this.prompt();
          return;
        }

        // Prevent dropping current database
        if (dbNameToDrop === this.db.getDatabaseName()) {
          console.log(` Cannot drop current database '${dbNameToDrop}'`);
          console.log(
            "  Switch to another database first with: USE DATABASE <name>"
          );
          this.prompt();
          return;
        }

        try {
          // Check if database exists
          const databases = StorageEngine.listDatabases();
          if (!databases.includes(dbNameToDrop)) {
            console.log(` Database '${dbNameToDrop}' does not exist`);
            this.prompt();
            return;
          }

          // Drop the database using StorageEngine
          StorageEngine.dropDatabase("./data", dbNameToDrop);
          console.log(`✓ Database '${dbNameToDrop}' dropped successfully`);
        } catch (error: any) {
          console.log(` Error dropping database: ${error.message}`);
        }
        this.prompt();
        return;
      }

      if (command === "SAVE") {
        this.storage.saveDatabase(this.db);
        console.log(
          `✓ Database saved (${this.storage.getDatabaseSize()} bytes)`
        );
        this.prompt();
        return;
      }

      if (command === "SYNC") {
        console.log(" Syncing database from disk...");
        try {
          // Drop all existing tables
          const existingTables = this.db.listTables();
          existingTables.forEach((tableName) => {
            try {
              this.db.dropTable(tableName);
            } catch (err) {
              // Ignore drop errors
            }
          });

          // Reload from disk
          this.storage.loadDatabase(this.db);

          // Show result
          const tables = this.db.listTables();
          console.log(
            `✓ Database synced - loaded ${tables.length} table(s)${
              tables.length > 0 ? ": " + tables.join(", ") : ""
            }`
          );
        } catch (error: any) {
          console.log(` Sync failed: ${error.message}`);
        }
        this.prompt();
        return;
      }

      if (command === "BACKUP") {
        const backupPath = this.storage.backup();
        console.log(`✓ Backup created: ${backupPath}`);
        this.prompt();
        return;
      }

      if (command === "BACKUPS") {
        const backups = this.storage.listBackups();
        if (backups.length === 0) {
          console.log("No backups found");
        } else {
          console.log(`\nAvailable backups (${backups.length}):`);
          backups.forEach((backup, index) => {
            const fileName = backup.split("/").pop();
            console.log(`  ${index + 1}. ${fileName}`);
          });
          console.log("\nTo restore: RESTORE <path>");
        }
        this.prompt();
        return;
      }

      if (command.startsWith("RESTORE ")) {
        const backupPath = input.substring(8).trim();
        try {
          this.storage.restoreFromBackup(backupPath, this.db);
          console.log(`✓ Database restored from: ${backupPath}`);
          console.log("✓ All data has been replaced with backup data");

          // Save the restored database
          this.storage.saveDatabase(this.db);
        } catch (error) {
          console.log(`✗ Restore failed: ${(error as Error).message}`);
        }
        this.prompt();
        return;
      }

      // Try to execute as SQL using QueryExecutor
      if (this.looksLikeSQL(input)) {
        try {
          const result = this.queryExecutor.execute(input);

          if (Array.isArray(result)) {
            // SELECT query result
            console.log(`Found ${result.length} record(s):`);
            if (result.length > 0) {
              console.table(result);
            }
          } else {
            // Other query result (string message)
            console.log(result);
          }

          // Auto-save after data modifications
          if (
            command.startsWith("INSERT") ||
            command.startsWith("UPDATE") ||
            command.startsWith("DELETE") ||
            command.startsWith("CREATE") ||
            command.startsWith("DROP")
          ) {
            this.storage.saveDatabase(this.db);
            console.log(" Changes saved to disk");
          }

          this.prompt();
          return;
        } catch (sqlError: any) {
          console.error("SQL Error:", sqlError.message);
          this.prompt();
          return;
        }
      }

      console.log("Unknown command. Try SQL syntax or type EXIT to quit.");
      this.prompt();
    } catch (error: any) {
      console.error("Error:", error.message);
      this.prompt();
    }
  }

  /**
   * Check if input looks like SQL
   */
  private looksLikeSQL(input: string): boolean {
    const sqlKeywords = [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "CREATE TABLE",
      "DROP TABLE",
      "FROM",
      "WHERE",
    ];
    const upperInput = input.toUpperCase();
    return sqlKeywords.some((keyword) => upperInput.includes(keyword));
  }

  public stop() {
    this.rl.close();
  }
}
