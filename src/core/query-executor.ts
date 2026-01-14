import Database from "./database";

interface ParsedQuery {
  type:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE_TABLE"
    | "DROP_TABLE"
    | "CREATE_INDEX"
    | "DROP_INDEX"
    | "SHOW_INDEXES";
  tableName?: string;
  columns?: string[];
  values?: any[];
  data?: { [key: string]: any };
  where?: WhereClause;
  joins?: JoinClause[];
  indexName?: string;
  columnName?: string;
  unique?: boolean;
}

interface WhereClause {
  column: string;
  operator: string;
  value: any;
  logic?: "AND" | "OR";
  next?: WhereClause;
}

interface JoinClause {
  type: "INNER" | "LEFT" | "RIGHT";
  table: string;
  on: {
    leftColumn: string;
    rightColumn: string;
  };
}

export class QueryExecutor {
  constructor(private database: Database) {}

  /**
   * Main entry point - executes any SQL query
   */
  public execute(query: string): any {
    const parsedQuery = this.parseQuery(query);

    switch (parsedQuery.type) {
      case "SELECT":
        return this.executeSelect(parsedQuery);
      case "INSERT":
        return this.executeInsert(parsedQuery);
      case "UPDATE":
        return this.executeUpdate(parsedQuery);
      case "DELETE":
        return this.executeDelete(parsedQuery);
      case "CREATE_TABLE":
        return this.executeCreateTable(parsedQuery);
      case "DROP_TABLE":
        return this.executeDropTable(parsedQuery);
      case "CREATE_INDEX":
        return this.executeCreateIndex(parsedQuery);
      case "DROP_INDEX":
        return this.executeDropIndex(parsedQuery);
      case "SHOW_INDEXES":
        return this.executeShowIndexes(parsedQuery);
      default:
        throw new Error(`Unsupported query type: ${parsedQuery.type}`);
    }
  }

  /**
   * Parses SQL query string into structured object
   */
  private parseQuery(query: string): ParsedQuery {
    const trimmedQuery = query.trim().toUpperCase();

    if (trimmedQuery.startsWith("SELECT")) {
      return this.parseSelect(query);
    } else if (trimmedQuery.startsWith("INSERT")) {
      return this.parseInsert(query);
    } else if (trimmedQuery.startsWith("UPDATE")) {
      return this.parseUpdate(query);
    } else if (trimmedQuery.startsWith("DELETE")) {
      return this.parseDelete(query);
    } else if (trimmedQuery.startsWith("CREATE TABLE")) {
      return this.parseCreateTable(query);
    } else if (trimmedQuery.startsWith("DROP TABLE")) {
      return this.parseDropTable(query);
    } else if (trimmedQuery.startsWith("CREATE UNIQUE INDEX") || trimmedQuery.startsWith("CREATE INDEX")) {
      return this.parseCreateIndex(query);
    } else if (trimmedQuery.startsWith("DROP INDEX")) {
      return this.parseDropIndex(query);
    } else if (trimmedQuery.startsWith("SHOW INDEXES")) {
      return this.parseShowIndexes(query);
    } else {
      throw new Error("Unable to parse query");
    }
  }

  /**
   * Parse SELECT query
   * Example: SELECT * FROM users WHERE age > 25
   * Example: SELECT name, email FROM users
   */
  private parseSelect(query: string): ParsedQuery {
    const selectRegex = /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i;
    const match = query.match(selectRegex);

    if (!match) {
      throw new Error("Invalid SELECT syntax");
    }

    const columnsStr = match[1].trim();
    const tableName = match[2];
    const whereStr = match[3];

    return {
      type: "SELECT",
      tableName,
      columns:
        columnsStr === "*" ? [] : columnsStr.split(",").map((c) => c.trim()),
      where: whereStr ? this.parseWhere(whereStr) : undefined,
    };
  }

  /**
   * Parse INSERT query
   * Example: INSERT INTO users (name, age) VALUES ('Alice', 25)
   */
  private parseInsert(query: string): ParsedQuery {
    const insertRegex = /INSERT INTO\s+(\w+)\s*\((.+?)\)\s*VALUES\s*\((.+?)\)/i;
    const match = query.match(insertRegex);

    if (!match) {
      throw new Error("Invalid INSERT syntax");
    }

    const tableName = match[1];
    const columns = match[2].split(",").map((c) => c.trim());
    const valuesStr = match[3];

    // Parse values (handle strings, numbers, booleans)
    const values = this.parseValues(valuesStr);

    // Create data object
    const data: { [key: string]: any } = {};
    columns.forEach((col, index) => {
      data[col] = values[index];
    });

    return {
      type: "INSERT",
      tableName,
      columns,
      data,
    };
  }

  /**
   * Parse UPDATE query
   * Example: UPDATE users SET age = 26 WHERE name = 'Alice'
   */
  private parseUpdate(query: string): ParsedQuery {
    const updateRegex = /UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i;
    const match = query.match(updateRegex);

    if (!match) {
      throw new Error("Invalid UPDATE syntax");
    }

    const tableName = match[1];
    const setStr = match[2];
    const whereStr = match[3];

    // Parse SET clause: "age = 26, name = 'Bob'"
    const data: { [key: string]: any } = {};
    const setPairs = setStr.split(",");

    for (const pair of setPairs) {
      const [column, valueStr] = pair.split("=").map((s) => s.trim());
      data[column] = this.parseValue(valueStr);
    }

    return {
      type: "UPDATE",
      tableName,
      data,
      where: whereStr ? this.parseWhere(whereStr) : undefined,
    };
  }

  /**
   * Parse DELETE query
   * Example: DELETE FROM users WHERE age < 18
   */
  private parseDelete(query: string): ParsedQuery {
    const deleteRegex = /DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i;
    const match = query.match(deleteRegex);

    if (!match) {
      throw new Error("Invalid DELETE syntax");
    }

    const tableName = match[1];
    const whereStr = match[2];

    return {
      type: "DELETE",
      tableName,
      where: whereStr ? this.parseWhere(whereStr) : undefined,
    };
  }

  /**
   * Parse CREATE TABLE query
   * Example: CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR, age INT)
   */
  private parseCreateTable(query: string): ParsedQuery {
    const createRegex = /CREATE TABLE\s+(\w+)\s*\((.+)\)/i;
    const match = query.match(createRegex);

    if (!match) {
      throw new Error("Invalid CREATE TABLE syntax");
    }

    const tableName = match[1];
    const columnsStr = match[2];

    return {
      type: "CREATE_TABLE",
      tableName,
      columns: columnsStr.split(",").map((c) => c.trim()),
    };
  }

  /**
   * Parse DROP TABLE query
   * Example: DROP TABLE users
   */
  private parseDropTable(query: string): ParsedQuery {
    const dropRegex = /DROP TABLE\s+(\w+)/i;
    const match = query.match(dropRegex);

    if (!match) {
      throw new Error("Invalid DROP TABLE syntax");
    }

    return {
      type: "DROP_TABLE",
      tableName: match[1],
    };
  }

  /**
   * Parse WHERE clause
   * Example: "age > 25" or "name = 'Alice' AND age > 18"
   */
  private parseWhere(whereStr: string): WhereClause {
    // Simple WHERE parsing (supports single condition for now)
    // age > 25 or name = 'Alice'
    // IMPORTANT: Match longer operators (>=, <=, !=) before shorter ones (>, <, =)
    const conditionRegex = /(\w+)\s*(>=|<=|!=|=|>|<)\s*(.+)/;
    const match = whereStr.trim().match(conditionRegex);

    if (!match) {
      throw new Error("Invalid WHERE clause");
    }

    const column = match[1];
    const operator = match[2];
    const valueStr = match[3].trim();

    return {
      column,
      operator,
      value: this.parseValue(valueStr),
    };
  }

  /**
   * Parse multiple values
   * Example: "'Alice', 25, true"
   */
  private parseValues(valuesStr: string): any[] {
    return valuesStr.split(",").map((v) => this.parseValue(v.trim()));
  }

  /**
   * Parse a single value (string, number, boolean, null)
   */
  private parseValue(valueStr: string): any {
    // String: 'Alice' or "Alice"
    if (
      (valueStr.startsWith("'") && valueStr.endsWith("'")) ||
      (valueStr.startsWith('"') && valueStr.endsWith('"'))
    ) {
      return valueStr.slice(1, -1);
    }

    // Boolean
    if (valueStr === "true" || valueStr === "TRUE") return true;
    if (valueStr === "false" || valueStr === "FALSE") return false;

    // Null
    if (valueStr === "null" || valueStr === "NULL") return null;

    // Number
    const num = Number(valueStr);
    if (!isNaN(num)) return num;

    // Default: treat as string
    return valueStr;
  }

  /**
   * Execute SELECT query with index optimization
   *
   * OPTIMIZATION STRATEGY:
   * 1. If WHERE clause exists, check if an index is available for the column
   * 2. For equality (=) operator: Use index.search() - O(1) lookup
   * 3. For range operators (>, <, >=, <=): Use index.rangeSearch() if supported
   * 4. Fall back to full table scan if no index or unsupported operator
   */
  private executeSelect(parsedQuery: ParsedQuery): any[] {
    const { tableName, columns, where } = parsedQuery;

    if (!tableName) {
      throw new Error("Table name is required for SELECT");
    }

    // Get all records or filter by WHERE
    let results: any[];

    if (where) {
      // INDEX OPTIMIZATION: Try to use index for WHERE clause
      const index = this.database.getIndexForColumn(tableName, where.column);

      if (index && where.operator === "=") {
        //  INDEX PATH: O(1) hash lookup for equality
        results = index.search(where.value);

        // Note: index.search() returns matching records directly
        // No need for additional filtering
      } else if (
        index &&
        (where.operator === ">" ||
          where.operator === "<" ||
          where.operator === ">=" ||
          where.operator === "<=")
      ) {
        //  INDEX PATH: Range search (if index supports it)
        try {
          // NOTE: index.rangeSearch(min, max) uses INCLUSIVE bounds (min <= key <= max)
          // We need to adjust bounds for EXCLUSIVE operators (>, <)

          let min: any = undefined;
          let max: any = undefined;

          if (where.operator === ">=" || where.operator === ">") {
            min = where.value;
          }

          if (where.operator === "<=" || where.operator === "<") {
            max = where.value;
          }

          results = index.rangeSearch(min, max);

          // Post-filter for EXCLUSIVE operators (>, <)
          // rangeSearch is inclusive, so we need to exclude boundary values
          if (where.operator === ">" || where.operator === "<") {
            results = results.filter((record: any) =>
              this.evaluateCondition(record, where)
            );
          }
          // Note: >= and <= work directly since rangeSearch is inclusive
        } catch (error) {
          // If rangeSearch fails, fall back to full scan
          results = this.database.query(tableName, (record: any) =>
            this.evaluateCondition(record, where)
          );
        }
      } else {
        //  FULL SCAN PATH: No suitable index or unsupported operator
        results = this.database.query(tableName, (record: any) =>
          this.evaluateCondition(record, where)
        );
      }
    } else {
      // No WHERE clause: return all records
      results = this.database.query(tableName, () => true);
    }

    // Project columns (SELECT specific columns)
    if (columns && columns.length > 0) {
      results = results.map((record) => {
        const projected: any = {};
        columns.forEach((col) => {
          projected[col] = record[col];
        });
        return projected;
      });
    }

    return results;
  }

  /**
   * Execute INSERT query
   */
  private executeInsert(parsedQuery: ParsedQuery): string {
    const { tableName, data } = parsedQuery;

    if (!tableName || !data) {
      throw new Error("Table name and data are required for INSERT");
    }

    this.database.insert(tableName, data);
    return `1 row inserted into ${tableName}`;
  }

  /**
   * Execute UPDATE query
   */
  private executeUpdate(parsedQuery: ParsedQuery): string {
    const { tableName, data, where } = parsedQuery;

    if (!tableName || !data) {
      throw new Error("Table name and data are required for UPDATE");
    }

    if (where) {
      this.database.update(tableName, data, (record: any) =>
        this.evaluateCondition(record, where)
      );
    } else {
      // Update all records if no WHERE clause
      this.database.update(tableName, data, () => true);
    }

    return `Records updated in ${tableName}`;
  }

  /**
   * Execute DELETE query
   */
  private executeDelete(parsedQuery: ParsedQuery): string {
    const { tableName, where } = parsedQuery;

    if (!tableName) {
      throw new Error("Table name is required for DELETE");
    }

    if (where) {
      this.database.delete(tableName, (record: any) =>
        this.evaluateCondition(record, where)
      );
    } else {
      // Delete all records if no WHERE clause
      this.database.delete(tableName, () => true);
    }

    return `Records deleted from ${tableName}`;
  }

  /**
   * Execute CREATE TABLE query
   */
  private executeCreateTable(parsedQuery: ParsedQuery): string {
    const { tableName, columns } = parsedQuery;

    if (!tableName || !columns) {
      throw new Error("Table name and columns are required");
    }

    // Parse column definitions
    // Example: "id INT PRIMARY KEY, name VARCHAR, age INT"
    const columnObjs = columns.map((colDef) => {
      const parts = colDef.split(/\s+/);
      const name = parts[0];
      const type = parts[1];
      const isPrimary = colDef.includes("PRIMARY KEY");
      const isUnique = colDef.includes("UNIQUE");

      // Map to the Column interface expected by Database.createTable
      return {
        name,
        dataType: type,
        isPrimaryKey: isPrimary,
        isUnique,
      };
    });

    this.database.createTable(tableName, columnObjs);
    return `Table ${tableName} created`;
  }

  /**
   * Execute DROP TABLE query
   */
  private executeDropTable(parsedQuery: ParsedQuery): string {
    const { tableName } = parsedQuery;

    if (!tableName) {
      throw new Error("Table name is required for DROP TABLE");
    }

    // Some Database implementations may not declare dropTable on the type,
    // so cast to any to call the runtime method without a compile error.
    (this.database as any).dropTable(tableName);
    return `Table ${tableName} dropped`;
  }

  /**
   * Evaluate a WHERE condition against a record
   */
  private evaluateCondition(record: any, condition: WhereClause): boolean {
    const { column, operator, value } = condition;
    const recordValue = record[column];

    switch (operator) {
      case "=":
        return recordValue == value;
      case "!=":
        return recordValue != value;
      case ">":
        return recordValue > value;
      case "<":
        return recordValue < value;
      case ">=":
        return recordValue >= value;
      case "<=":
        return recordValue <= value;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Parse CREATE INDEX query
   * Example: CREATE INDEX idx_name ON table_name(column_name)
   * Example: CREATE UNIQUE INDEX idx_name ON table_name(column_name)
   */
  private parseCreateIndex(query: string): ParsedQuery {
    const createIndexRegex =
      /CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(\s*(\w+)\s*\)/i;
    const match = query.match(createIndexRegex);

    if (!match) {
      throw new Error(
        "Invalid CREATE INDEX syntax. Expected: CREATE [UNIQUE] INDEX index_name ON table_name(column_name)"
      );
    }

    return {
      type: "CREATE_INDEX",
      indexName: match[2],
      tableName: match[3],
      columnName: match[4],
      unique: !!match[1], // True if UNIQUE keyword is present
    };
  }

  /**
   * Parse DROP INDEX query
   * Example: DROP INDEX idx_name ON table_name
   */
  private parseDropIndex(query: string): ParsedQuery {
    const dropIndexRegex = /DROP\s+INDEX\s+(\w+)\s+ON\s+(\w+)/i;
    const match = query.match(dropIndexRegex);

    if (!match) {
      throw new Error(
        "Invalid DROP INDEX syntax. Expected: DROP INDEX index_name ON table_name"
      );
    }

    return {
      type: "DROP_INDEX",
      indexName: match[1],
      tableName: match[2],
    };
  }

  /**
   * Parse SHOW INDEXES query
   * Example: SHOW INDEXES
   * Example: SHOW INDEXES ON table_name
   */
  private parseShowIndexes(query: string): ParsedQuery {
    const showIndexesRegex = /SHOW\s+INDEXES(?:\s+ON\s+(\w+))?/i;
    const match = query.match(showIndexesRegex);

    if (!match) {
      throw new Error("Invalid SHOW INDEXES syntax");
    }

    return {
      type: "SHOW_INDEXES",
      tableName: match[1], // Optional - can be undefined
    };
  }

  /**
   * Execute CREATE INDEX
   */
  private executeCreateIndex(parsedQuery: ParsedQuery): any {
    const { indexName, tableName, columnName, unique } = parsedQuery;

    if (!indexName || !tableName || !columnName) {
      throw new Error("Missing required fields for CREATE INDEX");
    }

    try {
      this.database.createIndex(tableName, columnName, indexName, unique || false);
      const uniqueText = unique ? "unique " : "";
      return {
        success: true,
        message: `${uniqueText}Index '${indexName}' created on ${tableName}.${columnName}`,
      };
    } catch (error: any) {
      throw new Error(`Failed to create index: ${error.message}`);
    }
  }

  /**
   * Execute DROP INDEX
   */
  private executeDropIndex(parsedQuery: ParsedQuery): any {
    const { indexName, tableName } = parsedQuery;

    if (!indexName || !tableName) {
      throw new Error("Missing required fields for DROP INDEX");
    }

    const table = this.database.getTable(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    try {
      // Drop from table (this calls index.dropIndex() and unregisters from table)
      table.dropIndex(indexName);

      // Also remove from database registry (skip dropIndex since table already did it)
      this.database.dropIndex(indexName, true);

      return {
        success: true,
        message: `Index '${indexName}' dropped from table '${tableName}'`,
      };
    } catch (error: any) {
      throw new Error(`Failed to drop index: ${error.message}`);
    }
  }

  /**
   * Execute SHOW INDEXES
   */
  private executeShowIndexes(parsedQuery: ParsedQuery): any {
    const { tableName } = parsedQuery;

    if (tableName) {
      // Show indexes for a specific table
      const table = this.database.getTable(tableName);
      if (!table) {
        throw new Error(`Table '${tableName}' does not exist`);
      }

      const indexes = table.getIndexes();
      return indexes.map((index) => ({
        table: tableName,
        name: index.getIndexName(),
        column: index.getColumnName(),
        type: index.getIndexType(),
        unique: index.isUnique(),
      }));
    } else {
      // Show all indexes across all tables
      const allIndexes: any[] = [];
      const tablesObj = this.database.getTables();

      // Convert object to array of tables
      for (const tableName in tablesObj) {
        const table = tablesObj[tableName];
        const indexes = table.getIndexes();
        for (const index of indexes) {
          allIndexes.push({
            table: table.name,
            name: index.getIndexName(),
            column: index.getColumnName(),
            type: index.getIndexType(),
            unique: index.isUnique(),
          });
        }
      }

      return allIndexes;
    }
  }
}
