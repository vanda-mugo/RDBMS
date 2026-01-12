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
    this.storage = new StorageEngine("./data");
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
    console.log("  TABLES - List all tables");
    console.log("  SAVE - Save database to disk");
    console.log("  BACKUP - Create backup");
    console.log("  BACKUPS - List available backups");
    console.log("  RESTORE <path> - Restore from backup");
    console.log("  EXIT - Exit REPL (auto-saves)");
    console.log("=====================================\n");
    this.prompt();
  }

  private prompt() {
    this.rl.question("RDBMS> ", (input) => {
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

      if (command === "SAVE") {
        this.storage.saveDatabase(this.db);
        console.log(
          `✓ Database saved (${this.storage.getDatabaseSize()} bytes)`
        );
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
