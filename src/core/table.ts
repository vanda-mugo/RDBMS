/**
 * Represents a table in a database with rows and columns.
 * Stores column definitions which is an array of Column objects.
 * Stores row data which is an array of objects.
 * enforces constraints (primary key, unique, data types)
 * provides CRUD methods (insert, select, update, delete)
 * manages indexes for the table
 */

import { Column } from "./column";
import { Index } from "./index";

export class Table {
  private columns: Column[] = [];
  // Records are instances that follow the blueprint of the table's columns
  private records: any[] = [];
  // Indexes registered on this table - automatically maintained on data changes
  private indexes: Map<string, Index> = new Map();

  constructor(public name: string) {
    if (!name || name.trim().length === 0) {
      throw new Error("Table name cannot be empty");
    }
  }

  /**
   * Adds a column to the table columns array of columns each of type Column.
   * @param name The name of the column.
   * @param type The data type of the column.
   * @param isPrimary Whether the column is a primary key.
   * @param isUnique Whether the column is unique.
   * @param isForeignKey Whether the column is a foreign key.
   * @param foreignKeyReference The foreign key reference (table and column).
   */
  addColumn(
    name: string,
    type: string,
    isPrimary: boolean = false,
    isUnique: boolean = false,
    isForeignKey: boolean = false,
    foreignKeyReference?: {
      table: string;
      column: string;
    }
  ): void {
    if (this.columns.find((col) => col.name === name)) {
      throw new Error(`Column with name ${name} already exists`);
    }
    const column = new Column(
      name,
      type,
      isPrimary,
      isUnique,
      isForeignKey,
      foreignKeyReference
    );
    this.columns.push(column);
  }

  /**
   * Inserts a new record into the table.
   * @param record (this is in line with the columns available in the table and
   * must adhere to the defined schema)
   */
  insert(record: any): void {
    // Validate record against columns
    this.validateRecord(record);

    // Check constraints
    this.checkConstraints(record);

    this.records.push(record);

    // Update all registered indexes with the new record
    for (const index of this.indexes.values()) {
      index.addRecord(record);
    }
  }

  /**
   * Updates records that match the condition
   * @param data The data to update
   * @param condition Function that returns true for records to update
   */
  update(data: any, condition: (record: any) => boolean): void {
    // Validate partial record
    for (const key in data) {
      const column = this.columns.find((col) => col.name === key);
      if (!column) {
        throw new Error(`Column '${key}' does not exist`);
      }
      this.validateDataType(data[key], column.dataType, key);
    }

    // Update all matching records and maintain indexes
    this.records = this.records.map((record) => {
      if (condition(record)) {
        const oldRecord = { ...record };
        const updatedRecord = { ...record, ...data };

        // Update all registered indexes
        for (const index of this.indexes.values()) {
          index.updateRecord(oldRecord, updatedRecord);
        }

        return updatedRecord;
      }
      return record;
    });
  }

  /**
   * Deletes records that match the condition
   * @param condition Function that returns true for records to delete
   */
  delete(condition: (record: any) => boolean): void {
    // Update indexes before removing records
    const recordsToDelete = this.records.filter(condition);
    for (const record of recordsToDelete) {
      for (const index of this.indexes.values()) {
        index.removeRecord(record);
      }
    }

    this.records = this.records.filter((record) => !condition(record));
  }

  selectAll(): any[] {
    return this.records;
  }

  getColumns(): Column[] {
    return this.columns;
  }

  private validateRecord(record: any): void {
    // Check all record fields exist as columns
    for (const key in record) {
      const column = this.columns.find((col) => col.name === key);
      if (!column) {
        throw new Error(
          `Column '${key}' does not exist in table '${this.name}'`
        );
      }

      // Validate data type
      this.validateDataType(record[key], column.dataType, key);
    }

    // Check all columns are provided (if not nullable - you'd need to add nullable support)
    for (const column of this.columns) {
      if (!(column.name in record)) {
        throw new Error(`Missing value for column '${column.name}'`);
      }
    }
  }

  /**validates the data type of a records in line with what is expected in a column  */
  private validateDataType(
    value: any,
    expectedType: string,
    columnName: string
  ): void {
    // Allow NULL values for all columns (nullable by default)
    if (value === null || value === undefined) {
      return;
    }

    switch (expectedType.toLowerCase()) {
      case "int":
        if (!Number.isInteger(value)) {
          throw new Error(
            `Column '${columnName}' expects INT, got ${typeof value}`
          );
        }
        break;
      case "varchar":
        if (typeof value !== "string") {
          throw new Error(
            `Column '${columnName}' expects VARCHAR, got ${typeof value}`
          );
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new Error(
            `Column '${columnName}' expects BOOLEAN, got ${typeof value}`
          );
        }
        break;
      case "date":
        if (!(value instanceof Date)) {
          // Try to parse if it's a string
          if (typeof value === "string") {
            const parsed = new Date(value);
            if (isNaN(parsed.getTime())) {
              throw new Error(
                `Column '${columnName}' expects DATE, got invalid date string`
              );
            }
          } else {
            throw new Error(
              `Column '${columnName}' expects DATE, got ${typeof value}`
            );
          }
        }
        break;
    }
  }

  private checkConstraints(record: any): void {
    for (const column of this.columns) {
      const value = record[column.name];

      // Check PRIMARY KEY uniqueness
      if (column.isPrimaryKey) {
        const exists = this.records.some((r) => r[column.name] === value);
        if (exists) {
          throw new Error(
            `Duplicate primary key value '${value}' for column '${column.name}'`
          );
        }
      }

      // Check UNIQUE constraint
      if (column.isUnique) {
        const exists = this.records.some((r) => r[column.name] === value);
        if (exists) {
          throw new Error(
            `Duplicate unique value '${value}' for column '${column.name}'`
          );
        }
      }
    }
  }

  /**
   * Validates foreign key constraints for a record
   * This method should be called from Database class which has access to all tables
   * @param record The record to validate
   * @param getTableCallback Callback function to get a table by name from the database
   */
  public validateForeignKeys(
    record: any,
    getTableCallback: (tableName: string) => Table | undefined
  ): void {
    for (const column of this.columns) {
      if (column.isForeignKey && column.foreignKeyReference) {
        const value = record[column.name];

        // NULL values are allowed for foreign keys (optional relationships)
        if (value === null || value === undefined) {
          continue;
        }

        const refTableName = column.foreignKeyReference.table;
        const refColumnName = column.foreignKeyReference.column;

        // Get referenced table
        const refTable = getTableCallback(refTableName);

        if (!refTable) {
          throw new Error(
            `Foreign key constraint violation: Referenced table '${refTableName}' does not exist`
          );
        }

        // Check if the value exists in the referenced table's column
        const exists = refTable
          .selectAll()
          .some((r) => r[refColumnName] === value);

        if (!exists) {
          throw new Error(
            `Foreign key constraint violation on column '${column.name}': ` +
              `Value '${value}' does not exist in ${refTableName}.${refColumnName}`
          );
        }
      }
    }
  }

  /**
   * Query records based on a condition function
   * @param condition A function that takes a record and returns true if it matches
   * @returns Array of records that match the condition
   */
  query(condition: (record: any) => boolean): any[] {
    return this.records.filter(condition);
  }

  /**
   * Registers an index on this table.
   * The index will be automatically maintained when records are inserted, updated, or deleted.
   * @param index The index to register
   * @throws Error if an index with the same name already exists
   */
  registerIndex(index: Index): void {
    const indexName = index.getIndexName();
    if (this.indexes.has(indexName)) {
      throw new Error(
        `Index '${indexName}' is already registered on table '${this.name}'`
      );
    }
    this.indexes.set(indexName, index);
  }

  /**
   * Unregisters an index from this table.
   * The index will no longer be maintained when records change.
   * @param indexName The name of the index to unregister
   * @returns true if the index was found and removed, false otherwise
   */
  unregisterIndex(indexName: string): boolean {
    return this.indexes.delete(indexName);
  }

  /**
   * Drops an index from this table
   * This is a high-level API that:
   * 1. Drops the index data
   * 2. Unregisters it from the table
   *
   * @param indexName The name of the index to drop
   * @throws Error if the index doesn't exist
   */
  dropIndex(indexName: string): void {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(
        `Index '${indexName}' does not exist on table '${this.name}'`
      );
    }

    // Drop the index data
    index.dropIndex();

    // Unregister from table
    this.unregisterIndex(indexName);
  }

  /**
   * Gets all indexes registered on this table.
   * @returns Array of indexes
   */
  getIndexes(): Index[] {
    return Array.from(this.indexes.values());
  }

  /**
   * Gets an index by name.
   * @param indexName The name of the index
   * @returns The index if found, undefined otherwise
   */
  getIndex(indexName: string): Index | undefined {
    return this.indexes.get(indexName);
  }

  /**
   * Checks if an index with the given name is registered on this table.
   * @param indexName The name of the index
   * @returns true if the index exists, false otherwise
   */
  hasIndex(indexName: string): boolean {
    return this.indexes.has(indexName);
  }
}
