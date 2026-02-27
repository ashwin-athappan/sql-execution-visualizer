// ─── AST Node Types ───────────────────────────────────────────────────────────

export type ASTNode =
    | CreateTableStmt
    | DropTableStmt
    | AlterTableStmt
    | CreateIndexStmt
    | DropIndexStmt
    | InsertStmt
    | UpdateStmt
    | DeleteStmt
    | SelectStmt;

export type SqlType = 'INT' | 'TEXT' | 'FLOAT' | 'BOOLEAN';

// ─── Column definitions ───────────────────────────────────────────────────────
export interface ColumnDefAST {
    name: string;
    type: SqlType;
    primaryKey: boolean;
    nullable: boolean;
}

// ─── DDL ─────────────────────────────────────────────────────────────────────
export interface CreateTableStmt {
    kind: 'CREATE_TABLE';
    table: string;
    columns: ColumnDefAST[];
}

export interface DropTableStmt {
    kind: 'DROP_TABLE';
    table: string;
    ifExists: boolean;
}

export type AlterAction =
    | { type: 'ADD_COLUMN'; column: ColumnDefAST }
    | { type: 'DROP_COLUMN'; column: string }
    | { type: 'RENAME_COLUMN'; from: string; to: string };

export interface AlterTableStmt {
    kind: 'ALTER_TABLE';
    table: string;
    action: AlterAction;
}

export interface CreateIndexStmt {
    kind: 'CREATE_INDEX';
    index: string;
    table: string;
    columns: string[];
    unique: boolean;
}

export interface DropIndexStmt {
    kind: 'DROP_INDEX';
    index: string;
}

// ─── DML ─────────────────────────────────────────────────────────────────────
export interface InsertStmt {
    kind: 'INSERT';
    table: string;
    columns?: string[];
    values: SqlLiteral[];
}

export interface UpdateStmt {
    kind: 'UPDATE';
    table: string;
    assignments: Assignment[];
    where?: WhereClause;
}

export interface DeleteStmt {
    kind: 'DELETE';
    table: string;
    where?: WhereClause;
}

export interface SelectStmt {
    kind: 'SELECT';
    columns: SelectColumn[];
    from: string;
    fromAlias?: string;
    joins?: JoinClause[];          // ← multiple JOINs now supported
    where?: WhereClause;
    groupBy?: string[];            // ← NEW
    having?: WhereClause;          // ← NEW
    orderBy?: OrderByClause[];
    limit?: number;
}

// ─── Expressions ─────────────────────────────────────────────────────────────
export type SqlLiteral = { kind: 'number'; value: number }
    | { kind: 'string'; value: string }
    | { kind: 'null' };

// Aggregate function call in SELECT or HAVING
export interface AggregateExpr {
    kind: 'aggregate';
    fn: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    col: string;       // '*' for COUNT(*)
    alias?: string;
}

export type SelectColumn =
    | { kind: 'star' }
    | { kind: 'column'; name: string; alias?: string }
    | AggregateExpr;

export interface Assignment {
    column: string;
    value: Expression;
}

export interface JoinClause {
    table: string;
    alias?: string;
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
    on?: WhereClause;  // optional for CROSS JOIN
}

export type WhereClause = BinaryExpr | UnaryExpr | ColumnRef | Literal | AggregateExpr;

export interface BinaryExpr {
    kind: 'binary';
    op: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'AND' | 'OR' | 'LIKE';
    left: Expression;
    right: Expression;
}

export interface UnaryExpr {
    kind: 'unary';
    op: 'NOT' | 'IS NULL' | 'IS NOT NULL';
    operand: Expression;
}

export interface ColumnRef {
    kind: 'column_ref';
    table?: string;
    column: string;
}

export interface Literal {
    kind: 'literal';
    value: string | number | null;
}

export type Expression = BinaryExpr | UnaryExpr | ColumnRef | Literal | AggregateExpr;

export interface OrderByClause {
    column: string;        // can be "COUNT(*)", alias, or column name
    direction: 'ASC' | 'DESC';
}
