import Database from "./database";

interface ParsedQuery {
  type:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE_TABLE"
    | "DROP_TABLE";
  tableName?: string;
  columns?: string[];
  values?: any[];
  data?: { [key: string]: any };
  where?: WhereClause;
  joins?: JoinClause[];
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
    const conditionRegex = /(\w+)\s*(=|>|<|>=|<=|!=)\s*(.+)/;
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
   * Execute SELECT query
   */
  private executeSelect(parsedQuery: ParsedQuery): any[] {
    const { tableName, columns, where } = parsedQuery;

    if (!tableName) {
      throw new Error("Table name is required for SELECT");
    }

    // Get all records or filter by WHERE
    let results: any[];

    if (where) {
      results = this.database.query(tableName, (record: any) =>
        this.evaluateCondition(record, where)
      );
    } else {
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
}
