/**
 * @deprecated This file is NOT USED in the current implementation.
 *
 * The RDBMS currently uses QueryExecutor (src/core/query-executor.ts) for SQL parsing,
 * which uses regex-based parsing instead of lexer/parser-based parsing.
 *
 * This Lexer was intended to tokenize SQL strings for the SQLParser,
 * but was never integrated into the main application.
 *
 * Status: DEPRECATED - Kept for reference only
 * Alternative: Use src/core/query-executor.ts for SQL parsing
 *
 * Only referenced in: src/parser/sql-parser.ts (which is also deprecated)
 */

export class Lexer {
  private input: string;
  private position: number;
  private currentChar: string | null;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.currentChar = this.input.charAt(this.position);
  }

  private advance(): void {
    this.position++;
    if (this.position >= this.input.length) {
      this.currentChar = null;
    } else {
      this.currentChar = this.input.charAt(this.position);
    }
  }

  private skipWhitespace(): void {
    while (this.currentChar !== null && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  public getNextToken(): string | null {
    while (this.currentChar !== null) {
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      if (/[a-zA-Z]/.test(this.currentChar)) {
        return this.identifier();
      }

      if (/\d/.test(this.currentChar)) {
        return this.number();
      }

      if (this.currentChar === "=") {
        this.advance();
        return "EQUALS";
      }

      if (this.currentChar === ";") {
        this.advance();
        return "SEMICOLON";
      }

      throw new Error(`Unexpected character: ${this.currentChar}`);
    }

    return null; // End of input
  }

  private identifier(): string {
    let result = "";
    while (this.currentChar !== null && /[a-zA-Z]/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return result;
  }

  private number(): string {
    let result = "";
    while (this.currentChar !== null && /\d/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return result;
  }
}
