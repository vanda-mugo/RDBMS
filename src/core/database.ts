import { Table } from "./table";
import { Column } from "./column";
import { Index } from "./index";

/**
 * this is the container that holds all tables in the database
 * it provides methods to create, update, delete, and query tables
 * it manages the connection state to the database
 *
 * INDEX REGISTRY:
 * Manages all indexes in the database. Indexes are stored by name for
 * easy lookup during CREATE/DROP INDEX operations and by table+column
 * for query optimization.
 */
class Database {
  private tables: { [key: string]: Table } = {};
  private connected: boolean = false;
  private databaseName: string = "default";

  /**
   * Index registry: Maps index name -> Index object
   * WHY: Allows DROP INDEX by name, SHOW INDEXES commands
   */
  private indexes: Map<string, Index> = new Map();

  constructor(databaseName: string = "default") {
    this.databaseName = databaseName;
  }

  /**
   * Get the current database name
   */
  public getDatabaseName(): string {
    return this.databaseName;
  }

  /**
   * Set the database name (used when switching databases)
   */
  public setDatabaseName(name: string): void {
    this.databaseName = name;
  }

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
        column.isUnique,
        column.isForeignKey,
        column.foreignKeyReference
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

    // Validate foreign key constraints before inserting
    table.validateForeignKeys(data, (refTableName: string) =>
      this.getTable(refTableName)
    );

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

    // Validate foreign key constraints for the updated data
    // We need to check each record that will be updated
    const recordsToUpdate = table.query(condition);
    for (const record of recordsToUpdate) {
      const updatedRecord = { ...record, ...data };
      table.validateForeignKeys(updatedRecord, (refTableName: string) =>
        this.getTable(refTableName)
      );
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

  /**
   * INDEX REGISTRY METHODS
   * These methods manage the lifecycle and lookup of indexes
   */

  /**
   * Creates an index on a table column
   *
   * This is a high-level API that:
   * 1. Creates an Index instance
   * 2. Builds the index from existing table data
   * 3. Registers it with both the table and database
   *
   * Used by: QueryExecutor (CREATE INDEX command), application code
   *
   * @param tableName Name of the table to index
   * @param columnName Name of the column to index
   * @param indexName Unique name for the index
   * @param unique Whether the index enforces uniqueness (default: false)
   * @throws Error if table doesn't exist, index already exists, or column doesn't exist
   */
  public createIndex(
    tableName: string,
    columnName: string,
    indexName: string,
    unique: boolean = false
  ): void {
    const normalizedTable = tableName.toLowerCase();
    const table = this.tables[normalizedTable];

    if (!table) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // Check if index name already exists
    if (this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' already exists`);
    }

    // Check if column exists
    const columns = table.getColumns();
    const column = columns.find((col) => col.name === columnName);
    if (!column) {
      throw new Error(
        `Column '${columnName}' does not exist in table '${tableName}'`
      );
    }

    // Create the index
    const index = new Index(tableName, columnName, indexName, unique);

    // Build the index from existing data
    const records = table.selectAll();
    index.createIndex(records);

    // Register with table (for automatic maintenance)
    table.registerIndex(index);

    // Register with database (for global lookup)
    this.indexes.set(indexName, index);
  }

  /**
   * Adds an index to the database registry
   *
   * NOTE: This is a programmatic API, NOT a SQL command handler.
   * SQL CREATE INDEX support requires QueryExecutor integration (Step 7).
   *
   * CURRENT USE CASES:
   * - Programmatic index creation in application code
   * - Index restoration during database load (StorageEngine)
   * - Test code
   *
   * FUTURE: Will be called by QueryExecutor when CREATE INDEX is implemented
   *
   * @param indexName Unique name for the index (e.g., "idx_users_age")
   * @param index The Index instance to register
   * @throws Error if index name already exists
   */
  public addIndex(indexName: string, index: Index): void {
    if (this.indexes.has(indexName)) {
      throw new Error(`Index '${indexName}' already exists`);
    }
    this.indexes.set(indexName, index);
  }

  /**
   * Removes an index from the database registry
   *
   * NOTE: This is a programmatic API, NOT a SQL command handler.
   * SQL DROP INDEX support requires QueryExecutor integration (Step 7).
   *
   * @param indexName Name of the index to drop
   * @param skipIndexDrop If true, only removes from registry without calling index.dropIndex()
   * @throws Error if index doesn't exist
   */
  public dropIndex(indexName: string, skipIndexDrop: boolean = false): void {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index '${indexName}' does not exist`);
    }

    // Drop the index (clears data) unless skipIndexDrop is true
    if (!skipIndexDrop && index.isIndexCreated()) {
      index.dropIndex();
    }

    // Remove from registry
    this.indexes.delete(indexName);
  }

  /**
   * Gets a specific index by name
   *
   * WHY: Allows direct access to index for operations
   *
   * @param indexName Name of the index
   * @returns The Index instance or undefined
   */
  public getIndex(indexName: string): Index | undefined {
    return this.indexes.get(indexName);
  }

  /**
   * Gets all indexes, optionally filtered by table name
   *
   * WHY: Implements SHOW INDEXES ON table_name
   *
   * @param tableName Optional table name to filter by
   * @returns Array of Index instances
   */
  public getIndexes(tableName?: string): Index[] {
    const allIndexes = Array.from(this.indexes.values());

    if (tableName) {
      const normalizedName = tableName.toLowerCase();
      return allIndexes.filter(
        (idx) => idx.getTableName().toLowerCase() === normalizedName
      );
    }

    return allIndexes;
  }

  /**
   * Finds an index for a specific table column
   *
   * WHY: Query optimizer uses this to find suitable indexes for WHERE clauses
   * Example: SELECT * FROM users WHERE age = 25
   *          -> Look for index on users.age -> Use it for O(1) lookup
   *
   * @param tableName Table to search in
   * @param columnName Column to find index for
   * @returns First matching Index or undefined
   */
  public getIndexForColumn(
    tableName: string,
    columnName: string
  ): Index | undefined {
    const normalizedTable = tableName.toLowerCase();
    const normalizedColumn = columnName.toLowerCase();

    return Array.from(this.indexes.values()).find(
      (idx) =>
        idx.getTableName().toLowerCase() === normalizedTable &&
        idx.getColumnName().toLowerCase() === normalizedColumn
    );
  }

  /**
   * Gets all index names in the database
   *
   * WHY: For listing and validation purposes
   *
   * @returns Array of index names
   */
  public listIndexNames(): string[] {
    return Array.from(this.indexes.keys());
  }

  /**
   * Checks if an index exists by name
   *
   * WHY: Validation before CREATE/DROP operations
   *
   * @param indexName Name to check
   * @returns true if index exists
   */
  public hasIndex(indexName: string): boolean {
    return this.indexes.has(indexName);
  }

  /**
   * Gets the Map of all indexes (for internal use like serialization)
   *
   * WHY: StorageEngine needs access to serialize indexes to disk
   *
   * @returns The internal indexes Map
   */
  public getTables() {
    return this.tables;
  }

  /**
   * Gets the indexes Map (for serialization)
   *
   * @returns Map of index name -> Index instance
   */
  public getIndexesMap(): Map<string, Index> {
    return this.indexes;
  }
}

export default Database;
