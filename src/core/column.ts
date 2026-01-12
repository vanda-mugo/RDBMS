/**
 * Represents a column in a database table.
 * column name and data type (INT,VARCHAR, BOOLEAN)
 * PRIMARY KEY constraint
 * UNIQUE constraint
 */
export class Column {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isUnique: boolean;

  constructor(
    name: string,
    dataType: string,
    isPrimaryKey: boolean = false,
    isUnique: boolean = false
  ) {
    this.name = name;
    this.dataType = dataType;
    this.isPrimaryKey = isPrimaryKey;
    this.isUnique = isUnique;
  }
}
