/**
 * Represents an index on a table for faster lookups.
 *
 * WHY: Indexes provide O(1) lookup instead of O(n) full table scans.
 * For queries like "SELECT * FROM users WHERE age = 25", an index on 'age'
 * can find matching records instantly instead of checking every row.
 *
 * METADATA ADDED:
 * - name: Unique identifier for this index (e.g., "idx_user_age")
 *   Reason: Allows users to create/drop indexes by name via SQL/API
 * - type: Index implementation type (currently "HASH")
 *   Reason: Future-proof for adding B-Tree, Full-Text, etc.
 * - unique: Whether index enforces uniqueness
 *   Reason: Support UNIQUE indexes for constraint enforcement
 */
export class Index {
  private name: string;
  private tableName: string;
  private columnName: string; // single column
  private indexMap: Map<any, any[]> = new Map(); // map of column value to array of row IDs
  private isCreated: boolean;
  private type: "HASH" = "HASH"; // Current implementation is hash-based
  private unique: boolean;

  constructor(
    tableName: string,
    columnName: string,
    name?: string,
    unique: boolean = false
  ) {
    this.tableName = tableName;
    this.columnName = columnName;
    // Auto-generate name if not provided: "idx_tablename_columnname"
    this.name = name || `idx_${tableName}_${columnName}`;
    this.unique = unique;
    this.isCreated = false;
    this.indexMap = new Map();
  }

  /**
   * creates an index by building the index map from the table records
   * @param records The records from the table to index
   * the concept with this index is that it is being grouped by the column value of the named column
   *
   * WHY UNIQUE CHECK: If this is a unique index, enforce that no duplicate values exist.
   * Prevents creating a unique index on a column that already has duplicates.
   */
  public createIndex(records: any[]) {
    if (this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} already exists in table ${this.tableName}`
      );
    }

    // clear the existing index data
    this.indexMap.clear();

    //build the index
    for (const record of records) {
      // check if the column exists in the record
      if (!(this.columnName in record)) {
        throw new Error(
          `Column ${this.columnName} does not exist in table ${this.tableName}`
        );
      }
      const key = record[this.columnName];

      if (key === undefined || key === null) {
        continue;
      }

      if (this.unique && this.indexMap.has(key)) {
        throw new Error(
          `Cannot create unique index '${this.name}': duplicate value '${key}' found in column '${this.columnName}'`
        );
      }

      if (!this.indexMap.has(key)) {
        this.indexMap.set(key, []);
      }
      // we could store the record.id but in our case we choose to store the full record
      // ours is in memory storage
      // in this case it allows for more flexibility when retrieving the data
      // for production grade pushing record.id would work better
      this.indexMap.get(key)?.push(record);
    }
    this.isCreated = true;
  }

  /**
   * Drops index by clearing the index map
   */
  public dropIndex() {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    this.indexMap.clear();
    this.isCreated = false;
    console.log(
      `Dropped index on ${this.columnName} in table ${this.tableName}`
    );
  }

  /**
   * Searches for a value in the indexed column.
   * @param value The value to search for.
   */
  public search(value: any): any[] {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    return this.indexMap.get(value) || [];
  }

  /**
   * Gets the index map on the indexed column.
   */
  public getIndexMap(): Map<any, any[]> {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    return this.indexMap;
  }

  /**
   * Adds a record to the index.
   * @param record The record to add.
   *
   * WHY UNIQUE CHECK: If this is a unique index, prevent adding a record
   * with a duplicate value. This enforces uniqueness constraint at insert time.
   */
  public addRecord(record: any): void {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    const key = record[this.columnName];
    if (key === undefined || key === null) {
      return;
    }

    if (this.unique && this.indexMap.has(key)) {
      throw new Error(
        `Unique index '${this.name}' violation: value '${key}' already exists in column '${this.columnName}'`
      );
    }

    if (!this.indexMap.has(key)) {
      this.indexMap.set(key, []);
    }
    this.indexMap.get(key)?.push(record);
  }

  /**
   * Removes a record from the index.
   * @param record The record to remove.
   * @returns
   */
  public removeRecord(record: any): void {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    const key = record[this.columnName];
    if (key === undefined || key === null) {
      return;
    }

    const records = this.indexMap.get(key);
    if (!records) {
      return;
    }

    // Find matching record by comparing all properties
    const index = records.findIndex(
      (r: any) => JSON.stringify(r) === JSON.stringify(record)
    );

    if (index !== -1) {
      records.splice(index, 1);
    }

    if (records.length === 0) {
      this.indexMap.delete(key);
    }
  }

  public updateRecord(oldRecord: any, newRecord: any): void {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }
    const oldKey = oldRecord[this.columnName];
    const newKey = newRecord[this.columnName];

    if (oldKey === newKey) {
      return;
    }

    this.removeRecord(oldRecord);
    this.addRecord(newRecord);
  }

  /**
   * get statistics about the index
   */

  public getStats(): { totalRecords: number; uniqueKeys: number } {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.columnName} does not exist in table ${this.tableName}`
      );
    }

    const totalRecords = Array.from(this.indexMap.values()).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    const uniqueKeys = this.indexMap.size;

    return { totalRecords, uniqueKeys };
  }

  /**
   * Checks if the index is created
   */
  public isIndexCreated(): boolean {
    return this.isCreated;
  }

  /**
   * Gets the column name this index is on
   */
  public getColumnName(): string {
    return this.columnName;
  }

  /**
   * Gets the table name this index belongs to
   */
  public getTableName(): string {
    return this.tableName;
  }

  /**
   * Gets the index name
   * WHY: Allows users to reference indexes by name for DROP/SHOW commands
   */
  public getIndexName(): string {
    return this.name;
  }

  /**
   * Gets the index type (HASH, BTREE, etc.)
   * WHY: Future-proofing for different index implementations
   */
  public getIndexType(): string {
    return this.type;
  }

  /**
   * Checks if this is a unique index
   * WHY: Allows query optimizer to use this info for constraint enforcement
   */
  public isUnique(): boolean {
    return this.unique;
  }

  /**
   * Range search - finds all records with values between min and max
   * @param min Minimum value (inclusive), or undefined for no lower bound
   * @param max Maximum value (inclusive), or undefined for no upper bound
   */
  public rangeSearch(min: any, max: any): any[] {
    if (!this.isCreated) {
      throw new Error(
        `Index on ${this.tableName}.${this.columnName} has not been created`
      );
    }

    const results: any[] = [];

    for (const [key, records] of this.indexMap.entries()) {
      // Handle undefined bounds: undefined min means no lower bound, undefined max means no upper bound
      const meetsMin = min === undefined || key >= min;
      const meetsMax = max === undefined || key <= max;

      if (meetsMin && meetsMax) {
        results.push(...records);
      }
    }

    return results;
  }

  /**
   * Serializes index metadata for persistence
   *
   * WHY: Returns only metadata (not the indexMap data) because:
   * - Index data can be rebuilt from table records on load
   * - Storing index data would duplicate all records (waste space)
   * - This ensures index stays synchronized with table data
   *
   * @returns Index metadata object for saving to disk
   */
  public serialize(): {
    name: string;
    columnName: string;
    type: string;
    unique: boolean;
  } {
    return {
      name: this.name,
      columnName: this.columnName,
      type: this.type,
      unique: this.unique,
    };
  }
}
