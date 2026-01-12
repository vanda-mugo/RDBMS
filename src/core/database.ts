import { Table } from "./table";
import { Column } from "./column";

/**
 * this is the container that holds all tables in the database
 * it provides methods to create, update, delete, and query tables
 * it manages the connection state to the database
 */
class Database {
  private tables: { [key: string]: Table } = {};
  private connected: boolean = false;

  constructor() {}

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  /**
   * Creates a new table in the database.
   * @param name The name of the table.
   * @param columns The columns of the table.
   */
  createTable(name: string, columns: Column[]) {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }

    // Normalize table name to lowercase for case-insensitive storage
    const normalizedName = name.toLowerCase();

    // Check if table already exists
    if (this.tables[normalizedName]) {
      throw new Error(`Table '${name}' already exists.`);
    }

    // Create table with the original name for display
    const table = new Table(name);

    // Add each column to the table
    for (const column of columns) {
      table.addColumn(
        column.name,
        column.dataType,
        column.isPrimaryKey,
        column.isUnique
      );
    }

    // Store the table using normalized name
    this.tables[normalizedName] = table;
  }

  /**
   * Inserts a new record into a table.
   * @param tableName The name of the table.
   * @param data The data to insert.
   */
  insert(tableName: string, data: { [key: string]: any }) {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }
    const normalizedName = tableName.toLowerCase();
    const table = this.tables[normalizedName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist.`);
    }
    table.insert(data);
  }

  /**
   * Updates existing records in a table.
   * @param tableName The name of the table.
   * @param data The updated data for the record.
   * @param condition A function that defines the condition for selecting records to update.
   */
  update(
    tableName: string,
    data: { [key: string]: any },
    condition: (record: any) => boolean
  ) {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }
    const normalizedName = tableName.toLowerCase();
    const table = this.tables[normalizedName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist.`);
    }
    table.update(data, condition);
  }

  /**
   *
   * @param tableName The name of the table within the database
   * @param condition A function that defines the condition for selecting records to delete.
   */
  delete(tableName: string, condition: (record: any) => boolean) {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }
    const normalizedName = tableName.toLowerCase();
    const table = this.tables[normalizedName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist.`);
    }
    table.delete(condition);
  }

  query(tableName: string, condition: (record: any) => boolean) {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }
    const normalizedName = tableName.toLowerCase();
    const table = this.tables[normalizedName];
    if (!table) {
      throw new Error(`Table ${tableName} does not exist.`);
    }
    return table.query(condition);
  }

  /**
   * Drops (deletes) a table from the database.
   * @param tableName The name of the table to drop.
   */
  dropTable(tableName: string): void {
    if (!this.connected) {
      throw new Error("Database not connected.");
    }
    const normalizedName = tableName.toLowerCase();
    if (!this.tables[normalizedName]) {
      throw new Error(`Table ${tableName} does not exist.`);
    }
    delete this.tables[normalizedName];
  }

  /**
   * Lists all table names in the database.
   * @returns Array of table names
   */
  listTables(): string[] {
    return Object.keys(this.tables);
  }

  /**
   * Gets a specific table by name.
   * @param tableName The name of the table to retrieve
   * @returns The table instance or undefined if not found
   */
  getTable(tableName: string): Table | undefined {
    const normalizedName = tableName.toLowerCase();
    return this.tables[normalizedName];
  }
}

export default Database;
