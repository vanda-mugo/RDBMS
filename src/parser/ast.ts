/**
 * @deprecated This file is NOT USED in the current implementation.
 *
 * The RDBMS currently uses QueryExecutor (src/core/query-executor.ts) for SQL parsing,
 * which uses regex-based parsing instead of AST-based parsing.
 *
 * This file was part of an initial design but has been superseded by a simpler approach.
 *
 * Status: DEPRECATED - Kept for reference only
 * Alternative: Use src/core/query-executor.ts for SQL parsing
 *
 * Related files also deprecated:
 * - src/parser/sql-parser.ts (only used in tests/parser.test.ts)
 * - src/parser/lexer.ts (if exists)
 * - tests/parser.test.ts (tests for unused code)
 */

export class ASTNode {
  constructor(public type: string) {}
}

export class SelectNode extends ASTNode {
  constructor(
    public columns: string[],
    public table: string,
    public where?: ExpressionNode
  ) {
    super("Select");
  }
}

export class InsertNode extends ASTNode {
  constructor(public table: string, public values: Record<string, any>) {
    super("Insert");
  }
}

export class UpdateNode extends ASTNode {
  constructor(
    public table: string,
    public values: Record<string, any>,
    public where?: ExpressionNode
  ) {
    super("Update");
  }
}

export class DeleteNode extends ASTNode {
  constructor(public table: string, public where?: ExpressionNode) {
    super("Delete");
  }
}

export class ExpressionNode extends ASTNode {
  constructor(
    public left: ASTNode,
    public operator: string,
    public right: ASTNode
  ) {
    super("Expression");
  }
}

export class ValueNode extends ASTNode {
  constructor(public value: any) {
    super("Value");
  }
}

export class IdentifierNode extends ASTNode {
  constructor(public name: string) {
    super("Identifier");
  }
}
