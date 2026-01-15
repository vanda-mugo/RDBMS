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
    console.log("\n Index Management:");
    console.log("  CREATE INDEX idx_age ON users(age) - Create an index");
    console.log("  DROP INDEX idx_age ON users - Remove an index");
    console.log("  SHOW INDEXES - List all indexes");
    console.log("  SHOW INDEXES ON users - List indexes for a table");
    console.log("\n⚡ Table Commands:");
    console.log("  TABLES - List all tables in current database");
    console.log("  DESCRIBE users / DESC users - Show table schema");
    console.log("  SHOW CREATE TABLE users - Show SQL to recreate table");
    console.log("  COUNT users - Get record count");
    console.log("  TRUNCATE users - Delete all records (keep structure)");
    console.log("  RENAME TABLE old TO new - Rename a table");
    console.log("  COPY TABLE source TO target - Duplicate a table");
    console.log("  ANALYZE users - Show table statistics");
    console.log("  SHOW FOREIGN KEYS - List all foreign key relationships");
    console.log("  SHOW FOREIGN KEYS ON users - Show foreign keys for table");
    console.log("\n⚡ Quick Commands:");
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

      // DESCRIBE / DESC command
      if (command.startsWith("DESCRIBE ") || command.startsWith("DESC ")) {
        const tableName = input
          .substring(command.startsWith("DESCRIBE ") ? 9 : 5)
          .trim();
        if (!tableName) {
          console.log(" Please specify a table name: DESCRIBE <table>");
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const columns = table.getColumns();
          const recordCount = table.selectAll().length;

          console.log(`\nTable: ${tableName}`);
          console.log(`Records: ${recordCount}`);
          console.log(`\nColumns:`);
          console.log(
            "┌─────────────────┬──────────┬────────┬────────┬─────────────┬──────────────────────────┐"
          );
          console.log(
            "│ Column          │ Type     │ PK     │ Unique │ Foreign Key │ References               │"
          );
          console.log(
            "├─────────────────┼──────────┼────────┼────────┼─────────────┼──────────────────────────┤"
          );

          columns.forEach((col) => {
            const name = col.name.padEnd(15).substring(0, 15);
            const type = col.dataType.padEnd(8).substring(0, 8);
            const pk = (col.isPrimaryKey ? "Yes" : "No").padEnd(6);
            const unique = (col.isUnique ? "Yes" : "No").padEnd(6);
            const fk = (col.isForeignKey ? "Yes" : "No").padEnd(11);
            const ref = col.foreignKeyReference
              ? `${col.foreignKeyReference.table}.${col.foreignKeyReference.column}`
                  .padEnd(24)
                  .substring(0, 24)
              : "".padEnd(24);
            console.log(
              `│ ${name} │ ${type} │ ${pk} │ ${unique} │ ${fk} │ ${ref} │`
            );
          });

          console.log(
            "└─────────────────┴──────────┴────────┴────────┴─────────────┴──────────────────────────┘"
          );
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // SHOW CREATE TABLE command
      if (command.startsWith("SHOW CREATE TABLE ")) {
        const tableName = input.substring(18).trim();
        if (!tableName) {
          console.log(
            " Please specify a table name: SHOW CREATE TABLE <table>"
          );
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const columns = table.getColumns();
          const columnDefs = columns
            .map((col) => {
              let def = `${col.name} ${col.dataType}`;
              if (col.isPrimaryKey) def += " PRIMARY KEY";
              if (col.isUnique) def += " UNIQUE";
              if (col.isForeignKey && col.foreignKeyReference) {
                def += ` FOREIGN KEY REFERENCES ${col.foreignKeyReference.table}(${col.foreignKeyReference.column})`;
              }
              return def;
            })
            .join(", ");

          console.log(`\nCREATE TABLE ${tableName} (${columnDefs})`);
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // COUNT command
      if (command.startsWith("COUNT ")) {
        const tableName = input.substring(6).trim();
        if (!tableName) {
          console.log(" Please specify a table name: COUNT <table>");
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const count = table.selectAll().length;
          console.log(`Table '${tableName}' has ${count} record(s)`);
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // TRUNCATE command
      if (command.startsWith("TRUNCATE ")) {
        const tableName = input.substring(9).trim();
        if (!tableName) {
          console.log(" Please specify a table name: TRUNCATE <table>");
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const count = table.selectAll().length;
          this.db.delete(tableName, () => true); // Delete all records
          this.storage.saveDatabase(this.db);

          console.log(
            `✓ Table '${tableName}' truncated (${count} record(s) deleted)`
          );
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // RENAME TABLE command
      if (command.startsWith("RENAME TABLE ")) {
        const match = input.match(/RENAME TABLE (\w+) TO (\w+)/i);
        if (!match) {
          console.log(" Syntax: RENAME TABLE <old_name> TO <new_name>");
          this.prompt();
          return;
        }

        const [, oldName, newName] = match;

        try {
          const table = this.db.getTable(oldName);
          if (!table) {
            console.log(` Table '${oldName}' does not exist`);
            this.prompt();
            return;
          }

          if (this.db.getTable(newName)) {
            console.log(` Table '${newName}' already exists`);
            this.prompt();
            return;
          }

          // Get all data and schema
          const columns = table.getColumns();
          const records = table.selectAll();

          // Create new table with same schema
          this.db.createTable(newName, columns);

          // Copy data
          records.forEach((record) => {
            this.db.insert(newName, record);
          });

          // Drop old table
          this.db.dropTable(oldName);
          this.storage.saveDatabase(this.db);

          console.log(`✓ Table renamed from '${oldName}' to '${newName}'`);
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // COPY TABLE command
      if (command.startsWith("COPY TABLE ")) {
        const match = input.match(/COPY TABLE (\w+) TO (\w+)/i);
        if (!match) {
          console.log(" Syntax: COPY TABLE <source> TO <target>");
          this.prompt();
          return;
        }

        const [, sourceName, targetName] = match;

        try {
          const sourceTable = this.db.getTable(sourceName);
          if (!sourceTable) {
            console.log(` Table '${sourceName}' does not exist`);
            this.prompt();
            return;
          }

          if (this.db.getTable(targetName)) {
            console.log(` Table '${targetName}' already exists`);
            this.prompt();
            return;
          }

          // Get all data and schema
          const columns = sourceTable.getColumns();
          const records = sourceTable.selectAll();

          // Create new table with same schema
          this.db.createTable(targetName, columns);

          // Copy data
          records.forEach((record) => {
            this.db.insert(targetName, record);
          });

          this.storage.saveDatabase(this.db);

          console.log(
            `✓ Table '${sourceName}' copied to '${targetName}' (${records.length} records)`
          );
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // ANALYZE command
      if (command.startsWith("ANALYZE ")) {
        const tableName = input.substring(8).trim();
        if (!tableName) {
          console.log(" Please specify a table name: ANALYZE <table>");
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const records = table.selectAll();
          const columns = table.getColumns();

          console.log(`\nTable Analysis: ${tableName}`);
          console.log(`Total Records: ${records.length}`);
          console.log(`Total Columns: ${columns.length}`);

          // Analyze each column
          console.log(`\nColumn Statistics:`);
          columns.forEach((col) => {
            const values = records.map((r) => r[col.name]);
            const nullCount = values.filter(
              (v) => v === null || v === undefined
            ).length;
            const uniqueCount = new Set(values).size;

            console.log(`\n  ${col.name} (${col.dataType}):`);
            console.log(`    - Null values: ${nullCount}`);
            console.log(`    - Unique values: ${uniqueCount}`);
            console.log(
              `    - Fill rate: ${(
                ((records.length - nullCount) / records.length) *
                100
              ).toFixed(1)}%`
            );

            if (col.dataType === "INT" && records.length > 0) {
              const numValues = values.filter(
                (v) => typeof v === "number"
              ) as number[];
              if (numValues.length > 0) {
                const min = Math.min(...numValues);
                const max = Math.max(...numValues);
                const avg = (
                  numValues.reduce((a, b) => a + b, 0) / numValues.length
                ).toFixed(2);
                console.log(`    - Min: ${min}, Max: ${max}, Avg: ${avg}`);
              }
            }
          });

          // Show indexes
          const indexes = this.db.getIndexes(tableName);
          if (indexes.length > 0) {
            console.log(`\nIndexes: ${indexes.length}`);
            indexes.forEach((idx) => {
              console.log(
                `  - ${idx.getIndexName()} on ${idx.getColumnName()} (${idx.getIndexType()})${
                  idx.isUnique() ? " UNIQUE" : ""
                }`
              );
            });
          } else {
            console.log(`\nIndexes: None`);
          }
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // SHOW FOREIGN KEYS command
      if (command === "SHOW FOREIGN KEYS") {
        try {
          const tables = this.db.listTables();
          const foreignKeys: Array<{
            table: string;
            column: string;
            refTable: string;
            refColumn: string;
          }> = [];

          tables.forEach((tableName) => {
            const table = this.db.getTable(tableName);
            if (table) {
              const columns = table.getColumns();
              columns.forEach((col) => {
                if (col.isForeignKey && col.foreignKeyReference) {
                  foreignKeys.push({
                    table: tableName,
                    column: col.name,
                    refTable: col.foreignKeyReference.table,
                    refColumn: col.foreignKeyReference.column,
                  });
                }
              });
            }
          });

          if (foreignKeys.length === 0) {
            console.log("No foreign keys found");
          } else {
            console.log(`\nForeign Keys (${foreignKeys.length}):`);
            console.log(
              "┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐"
            );
            console.log(
              "│ Table           │ Column          │ Ref Table       │ Ref Column      │"
            );
            console.log(
              "├─────────────────┼─────────────────┼─────────────────┼─────────────────┤"
            );

            foreignKeys.forEach((fk) => {
              const table = fk.table.padEnd(15).substring(0, 15);
              const column = fk.column.padEnd(15).substring(0, 15);
              const refTable = fk.refTable.padEnd(15).substring(0, 15);
              const refColumn = fk.refColumn.padEnd(15).substring(0, 15);
              console.log(
                `│ ${table} │ ${column} │ ${refTable} │ ${refColumn} │`
              );
            });

            console.log(
              "└─────────────────┴─────────────────┴─────────────────┴─────────────────┘"
            );
          }
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
        this.prompt();
        return;
      }

      // SHOW FOREIGN KEYS ON command
      if (command.startsWith("SHOW FOREIGN KEYS ON ")) {
        const tableName = input.substring(21).trim();
        if (!tableName) {
          console.log(
            " Please specify a table name: SHOW FOREIGN KEYS ON <table>"
          );
          this.prompt();
          return;
        }

        try {
          const table = this.db.getTable(tableName);
          if (!table) {
            console.log(` Table '${tableName}' does not exist`);
            this.prompt();
            return;
          }

          const columns = table.getColumns();
          const foreignKeys = columns.filter(
            (col) => col.isForeignKey && col.foreignKeyReference
          );

          if (foreignKeys.length === 0) {
            console.log(`Table '${tableName}' has no foreign keys`);
          } else {
            console.log(
              `\nForeign Keys in '${tableName}' (${foreignKeys.length}):`
            );
            foreignKeys.forEach((col) => {
              console.log(
                `  ${col.name} → ${col.foreignKeyReference!.table}.${
                  col.foreignKeyReference!.column
                }`
              );
            });
          }
        } catch (error: any) {
          console.log(` Error: ${error.message}`);
        }
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
            // SELECT query or SHOW INDEXES result
            console.log(`Found ${result.length} record(s):`);
            if (result.length > 0) {
              console.table(result);
            }
          } else if (result && typeof result === "object" && result.success) {
            // CREATE INDEX or DROP INDEX result
            console.log(` ${result.message}`);
          } else {
            // Other query result (string message)
            console.log(result);
          }

          // Auto-save after data modifications and index operations
          if (
            command.startsWith("INSERT") ||
            command.startsWith("UPDATE") ||
            command.startsWith("DELETE") ||
            command.startsWith("CREATE TABLE") ||
            command.startsWith("DROP TABLE") ||
            command.startsWith("CREATE INDEX") ||
            command.startsWith("DROP INDEX")
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
      "CREATE INDEX",
      "DROP INDEX",
      "SHOW INDEXES",
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
