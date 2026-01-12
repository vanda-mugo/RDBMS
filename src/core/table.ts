/**
 * Represents a table in a database with rows and columns.
 * Stores column definitions which is an array of Column objects.
 * Stores row data which is an array of objects.
 * enforces constraints (primary key, unique, data types)
 * provides CRUD methods (insert, select, update, delete)
 * manages indexes for the table
 */

import { Column } from "./column";

export class Table {
  private columns: Column[] = [];
  // Records are instances that follow the blueprint of the table's columns
  private records: any[] = [];

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
   */
  addColumn(
    name: string,
    type: string,
    isPrimary: boolean = false,
    isUnique: boolean = false
  ): void {
    if (this.columns.find((col) => col.name === name)) {
      throw new Error(`Column with name ${name} already exists`);
    }
    const column = new Column(name, type, isPrimary, isUnique);
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

    // Update all matching records
    this.records = this.records.map((record) => {
      if (condition(record)) {
        return { ...record, ...data };
      }
      return record;
    });
  }

  /**
   * Deletes records that match the condition
   * @param condition Function that returns true for records to delete
   */
  delete(condition: (record: any) => boolean): void {
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
   * Query records based on a condition function
   * @param condition A function that takes a record and returns true if it matches
   * @returns Array of records that match the condition
   */
  query(condition: (record: any) => boolean): any[] {
    return this.records.filter(condition);
  }
}
