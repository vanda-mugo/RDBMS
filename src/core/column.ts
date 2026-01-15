/**
 * Represents a column in a database table.
 * column name and data type (INT,VARCHAR, BOOLEAN)
 * PRIMARY KEY constraint
 * UNIQUE constraint
 * FOREIGN KEY constraint with reference to another table
 */
export class Column {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  foreignKeyReference?: {
    table: string;
    column: string;
  };

  constructor(
    name: string,
    dataType: string,
    isPrimaryKey: boolean = false,
    isUnique: boolean = false,
    isForeignKey: boolean = false,
    foreignKeyReference?: {
      table: string;
      column: string;
    }
  ) {
    this.name = name;
    this.dataType = dataType;
    this.isPrimaryKey = isPrimaryKey;
    this.isUnique = isUnique;
    this.isForeignKey = isForeignKey;
    this.foreignKeyReference = foreignKeyReference;

    // Validate foreign key reference
    if (isForeignKey && !foreignKeyReference) {
      throw new Error(
        `Foreign key column '${name}' must have a reference to another table`
      );
    }

    if (!isForeignKey && foreignKeyReference) {
      throw new Error(
        `Column '${name}' has a foreign key reference but is not marked as a foreign key`
      );
    }
  }

  /**
   * Gets the foreign key reference if this column is a foreign key
   */
  getForeignKeyReference(): { table: string; column: string } | undefined {
    return this.foreignKeyReference;
  }

  /**
   * Checks if this column is a foreign key
   */
  hasForeignKey(): boolean {
    return this.isForeignKey;
  }
}
