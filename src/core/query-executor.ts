import Database from "./database";
import { Column } from "./column";

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
    } else if (
      trimmedQuery.startsWith("CREATE UNIQUE INDEX") ||
      trimmedQuery.startsWith("CREATE INDEX")
    ) {
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
    // Updated regex to capture JOIN clauses
    // Pattern: SELECT columns FROM table [JOIN ...] [WHERE ...]
    const selectRegex =
      /SELECT\s+(.+?)\s+FROM\s+(\w+)((?:\s+(?:INNER|LEFT|RIGHT)\s+JOIN\s+.+?)*?)(?:\s+WHERE\s+(.+))?$/i;
    const match = query.match(selectRegex);

    if (!match) {
      throw new Error("Invalid SELECT syntax");
    }

    const columnsStr = match[1].trim();
    const tableName = match[2];
    const joinsStr = match[3] ? match[3].trim() : "";
    const whereStr = match[4];

    // Parse JOIN clauses if present
    const joins = joinsStr ? this.parseJoins(joinsStr) : undefined;

    return {
      type: "SELECT",
      tableName,
      columns:
        columnsStr === "*" ? [] : columnsStr.split(",").map((c) => c.trim()),
      where: whereStr ? this.parseWhere(whereStr) : undefined,
      joins,
    };
  }

  /**
   * Parse JOIN clauses
   * Example: "INNER JOIN orders ON users.id = orders.user_id LEFT JOIN products ON orders.product_id = products.id"
   */
  private parseJoins(joinsStr: string): JoinClause[] {
    const joins: JoinClause[] = [];

    // Pattern: (INNER|LEFT|RIGHT) JOIN table_name ON left_table.column = right_table.column
    const joinRegex =
      /(INNER|LEFT|RIGHT)\s+JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;

    let match;
    while ((match = joinRegex.exec(joinsStr)) !== null) {
      const joinType = match[1].toUpperCase() as "INNER" | "LEFT" | "RIGHT";
      const joinTable = match[2];
      const leftTable = match[3];
      const leftColumn = match[4];
      const rightTable = match[5];
      const rightColumn = match[6];

      joins.push({
        type: joinType,
        table: joinTable,
        on: {
          leftColumn: `${leftTable}.${leftColumn}`,
          rightColumn: `${rightTable}.${rightColumn}`,
        },
      });
    }

    if (joins.length === 0) {
      throw new Error("Invalid JOIN syntax");
    }

    return joins;
  }

  /**
   * Parse INSERT query
   * Example: INSERT INTO users (name, age) VALUES ('Alice', 25)
   * Example: INSERT INTO users VALUES (1, 'Alice', 25) -- without column names
   */
  private parseInsert(query: string): ParsedQuery {
    // Try with column names first
    const insertWithColumnsRegex =
      /INSERT INTO\s+(\w+)\s*\((.+?)\)\s*VALUES\s*\((.+?)\)/i;
    let match = query.match(insertWithColumnsRegex);

    let tableName: string;
    let columns: string[];
    let valuesStr: string;

    if (match) {
      // With column names: INSERT INTO users (id, name) VALUES (1, 'Alice')
      tableName = match[1];
      columns = match[2].split(",").map((c) => c.trim());
      valuesStr = match[3];
    } else {
      // Try without column names: INSERT INTO users VALUES (1, 'Alice')
      const insertWithoutColumnsRegex =
        /INSERT INTO\s+(\w+)\s*VALUES\s*\((.+?)\)/i;
      match = query.match(insertWithoutColumnsRegex);

      if (!match) {
        throw new Error("Invalid INSERT syntax");
      }

      tableName = match[1];
      valuesStr = match[2];

      // Get table columns in order
      const table = this.database.getTable(tableName);
      if (!table) {
        throw new Error(`Table ${tableName} does not exist`);
      }
      columns = table.getColumns().map((col) => col.name);
    }

    // Parse values (handle strings, numbers, booleans, NULL)
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
    const { tableName, columns, where, joins } = parsedQuery;

    if (!tableName) {
      throw new Error("Table name is required for SELECT");
    }

    // Handle JOIN queries
    if (joins && joins.length > 0) {
      return this.executeJoin(tableName, joins, columns, where);
    }

    // Get all records or filter by WHERE (non-JOIN query)
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
   * Execute JOIN query using nested loop join algorithm
   * Supports INNER, LEFT, and RIGHT joins
   */
  private executeJoin(
    baseTableName: string,
    joins: JoinClause[],
    columns?: string[],
    where?: WhereClause
  ): any[] {
    // Start with the base table
    let results: any[] = this.database.query(baseTableName, () => true);

    // Qualify base table columns with table name
    results = results.map((record) =>
      this.qualifyColumns(record, baseTableName)
    );

    // Apply each JOIN sequentially
    for (const join of joins) {
      results = this.applyJoin(results, join);
    }

    // Apply WHERE clause after all joins (if present)
    if (where) {
      results = results.filter((record) =>
        this.evaluateJoinCondition(record, where)
      );
    }

    // Project columns if specified
    if (columns && columns.length > 0 && columns[0] !== "*") {
      results = results.map((record) => {
        const projected: any = {};
        columns.forEach((col) => {
          // Handle both qualified (table.column) and unqualified column names
          if (col.includes(".")) {
            projected[col] = record[col];
          } else {
            // Find the column in the record (could be from any joined table)
            const matchingKey = Object.keys(record).find((key) =>
              key.endsWith(`.${col}`)
            );
            if (matchingKey) {
              projected[col] = record[matchingKey];
            }
          }
        });
        return projected;
      });
    }

    return results;
  }

  /**
   * Apply a single JOIN operation
   * Uses nested loop join algorithm: O(n * m)
   * Optimized with index lookup when available: O(n) with O(1) lookups
   */
  private applyJoin(leftRecords: any[], join: JoinClause): any[] {
    const results: any[] = [];
    const rightTableName = join.table;
    const rightRecords = this.database.query(rightTableName, () => true);

    // Qualify right table columns
    const qualifiedRightRecords = rightRecords.map((record) =>
      this.qualifyColumns(record, rightTableName)
    );

    // Extract table and column names from join condition
    const [leftTable, leftCol] = join.on.leftColumn.split(".");
    const [rightTable, rightCol] = join.on.rightColumn.split(".");

    // Get right table column names for creating null records
    const rightTableObj = this.database.getTable(rightTableName);
    const rightTableColumns = rightTableObj
      ? rightTableObj.getColumns().map((col) => `${rightTableName}.${col.name}`)
      : [];

    // 🚀 INDEX OPTIMIZATION: Check if right table has index on join column
    const rightColumnUnqualified = rightCol;
    const rightIndex = this.database.getIndexForColumn(
      rightTableName,
      rightColumnUnqualified
    );

    if (rightIndex && (join.type === "INNER" || join.type === "LEFT")) {
      // 🎯 OPTIMIZED PATH: Use index for O(1) lookups instead of O(m) scan
      // Performance: O(n) instead of O(n * m)

      for (const leftRecord of leftRecords) {
        const leftValue = leftRecord[join.on.leftColumn];

        if (leftValue === null || leftValue === undefined) {
          // NULL values don't match in joins
          if (join.type === "LEFT") {
            const nullRightRecord: any = {};
            rightTableColumns.forEach((col) => {
              nullRightRecord[col] = null;
            });
            results.push({ ...leftRecord, ...nullRightRecord });
          }
          continue;
        }

        // INDEX LOOKUP: O(1) hash lookup
        const matchingRightRecords = rightIndex.search(leftValue);

        if (matchingRightRecords.length > 0) {
          // Found matches via index
          for (const rightRecord of matchingRightRecords) {
            const qualifiedRight = this.qualifyColumns(
              rightRecord,
              rightTableName
            );
            results.push({ ...leftRecord, ...qualifiedRight });
          }
        } else {
          // No match found
          if (join.type === "LEFT") {
            const nullRightRecord: any = {};
            rightTableColumns.forEach((col) => {
              nullRightRecord[col] = null;
            });
            results.push({ ...leftRecord, ...nullRightRecord });
          }
        }
      }
    } else {
      // STANDARD PATH: Nested loop join (no index available or RIGHT JOIN)
      for (const leftRecord of leftRecords) {
        let matched = false;

        for (const rightRecord of qualifiedRightRecords) {
          // Check if join condition is satisfied
          const leftValue = leftRecord[join.on.leftColumn];
          const rightValue = rightRecord[join.on.rightColumn];

          if (leftValue === rightValue) {
            // Merge records
            results.push({ ...leftRecord, ...rightRecord });
            matched = true;
          }
        }

        // Handle LEFT JOIN: include unmatched left records with null right values
        if (join.type === "LEFT" && !matched) {
          const nullRightRecord: any = {};
          // Add null values for all right table columns
          rightTableColumns.forEach((col) => {
            nullRightRecord[col] = null;
          });
          results.push({ ...leftRecord, ...nullRightRecord });
        }
      }

      // Handle RIGHT JOIN: include unmatched right records with null left values
      if (join.type === "RIGHT") {
        for (const rightRecord of qualifiedRightRecords) {
          const rightValue = rightRecord[join.on.rightColumn];
          const matched = leftRecords.some(
            (leftRecord) => leftRecord[join.on.leftColumn] === rightValue
          );

          if (!matched) {
            const nullLeftRecord: any = {};
            // Add null values for all left table columns
            leftRecords.length > 0 &&
              Object.keys(leftRecords[0]).forEach((key) => {
                nullLeftRecord[key] = null;
              });
            results.push({ ...nullLeftRecord, ...rightRecord });
          }
        }
      }
    }

    return results;
  }

  /**
   * Qualify column names with table name
   * Converts { id: 1, name: 'Alice' } to { 'users.id': 1, 'users.name': 'Alice' }
   */
  private qualifyColumns(record: any, tableName: string): any {
    const qualified: any = {};
    Object.keys(record).forEach((key) => {
      // Don't double-qualify if already qualified
      if (!key.includes(".")) {
        qualified[`${tableName}.${key}`] = record[key];
      } else {
        qualified[key] = record[key];
      }
    });
    return qualified;
  }

  /**
   * Evaluate WHERE condition for joined records (with qualified column names)
   */
  private evaluateJoinCondition(record: any, where: WhereClause): boolean {
    // Handle qualified column names (table.column)
    const columnValue = where.column.includes(".")
      ? record[where.column]
      : Object.keys(record).find((key) => key.endsWith(`.${where.column}`))
      ? record[
          Object.keys(record).find((key) => key.endsWith(`.${where.column}`))!
        ]
      : record[where.column];

    let result: boolean;

    switch (where.operator) {
      case "=":
        result = columnValue == where.value;
        break;
      case "!=":
        result = columnValue != where.value;
        break;
      case ">":
        result = columnValue > where.value;
        break;
      case "<":
        result = columnValue < where.value;
        break;
      case ">=":
        result = columnValue >= where.value;
        break;
      case "<=":
        result = columnValue <= where.value;
        break;
      default:
        throw new Error(`Unsupported operator: ${where.operator}`);
    }

    // Handle chained conditions (AND/OR)
    if (where.next) {
      const nextResult = this.evaluateJoinCondition(record, where.next);
      if (where.logic === "AND") {
        return result && nextResult;
      } else if (where.logic === "OR") {
        return result || nextResult;
      }
    }

    return result;
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
    // Example: "user_id INT FOREIGN KEY REFERENCES users(id)"
    const columnObjs = columns.map((colDef) => {
      const parts = colDef.split(/\s+/);
      const name = parts[0];
      const type = parts[1];
      const isPrimary = colDef.includes("PRIMARY KEY");
      const isUnique =
        colDef.includes("UNIQUE") && !colDef.includes("PRIMARY KEY");

      // Check for FOREIGN KEY constraint
      // Pattern: FOREIGN KEY REFERENCES table_name(column_name)
      const fkMatch = colDef.match(
        /FOREIGN\s+KEY\s+REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i
      );
      const isForeignKey = !!fkMatch;
      const foreignKeyReference = fkMatch
        ? {
            table: fkMatch[1],
            column: fkMatch[2],
          }
        : undefined;

      // Create Column instance
      return new Column(
        name,
        type,
        isPrimary,
        isUnique,
        isForeignKey,
        foreignKeyReference
      );
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
      this.database.createIndex(
        tableName,
        columnName,
        indexName,
        unique || false
      );
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
