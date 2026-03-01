import {
    ASTNode, CreateTableStmt, DropTableStmt, AlterTableStmt,
    CreateIndexStmt, DropIndexStmt, InsertStmt, UpdateStmt, DeleteStmt,
    SelectStmt, SqlLiteral, Expression, WhereClause, ColumnDefAST,
    Assignment, SelectColumn, OrderByClause, SqlType, AggregateExpr, JoinClause,
} from './ast';
import { Token, tokenize } from './lexer';

export class ParseError extends Error {
    constructor(msg: string, pos?: number) {
        super(pos !== undefined ? `Parse error at position ${pos}: ${msg}` : `Parse error: ${msg}`);
    }
}

const AGGREGATE_FNS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

export class SQLParser {
    private tokens: Token[] = [];
    private pos: number = 0;

    parse(sql: string): ASTNode {
        this.tokens = tokenize(sql.trim());
        this.pos = 0;
        return this.parseStatement();
    }

    private peek(): Token { return this.tokens[this.pos] ?? { type: 'EOF', value: '', pos: -1 }; }
    private advance(): Token { return this.tokens[this.pos++] ?? { type: 'EOF', value: '', pos: -1 }; }
    private check(type: string, value?: string): boolean {
        const t = this.peek();
        return t.type === type && (value === undefined || t.value.toUpperCase() === value.toUpperCase());
    }
    private eat(type: string, value?: string): Token {
        if (!this.check(type, value)) {
            const t = this.peek();
            throw new ParseError(`Expected ${value ?? type} but got '${t.value}'`, t.pos);
        }
        return this.advance();
    }
    private eatKeyword(kw: string): Token { return this.eat('KEYWORD', kw); }
    private peekKeyword(kw: string): boolean { return this.check('KEYWORD', kw); }

    private parseStatement(): ASTNode {
        const t = this.peek();
        if (t.type === 'KEYWORD') {
            switch (t.value.toUpperCase()) {
                case 'SELECT': return this.parseSelect();
                case 'INSERT': return this.parseInsert();
                case 'UPDATE': return this.parseUpdate();
                case 'DELETE': return this.parseDelete();
                case 'CREATE': return this.parseCreate();
                case 'DROP': return this.parseDrop();
                case 'ALTER': return this.parseAlter();
            }
        }
        throw new ParseError(`Unknown statement starting with '${t.value}'`, t.pos);
    }

    // ── SELECT ─────────────────────────────────────────────────────────────────
    private parseSelect(): SelectStmt {
        this.eatKeyword('SELECT');
        const columns = this.parseSelectColumns();

        this.eatKeyword('FROM');
        const from = this.parseIdentifier();
        let fromAlias: string | undefined;
        if (this.peek().type === 'IDENTIFIER' || (this.peek().type === 'KEYWORD' && !['JOIN', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'INNER', 'LEFT', 'RIGHT', 'CROSS'].includes(this.peek().value.toUpperCase()))) {
            if (!this.peekKeyword('ON') && !this.peekKeyword('AS')) {
                // bare alias
                fromAlias = this.advance().value;
            }
        }
        if (this.peekKeyword('AS')) { this.advance(); fromAlias = this.parseIdentifier(); }

        // Multiple JOINs
        const joins: JoinClause[] = [];
        while (this.peekKeyword('JOIN') || this.peekKeyword('INNER') || this.peekKeyword('LEFT') || this.peekKeyword('RIGHT') || this.peekKeyword('CROSS')) {
            let type: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS' = 'INNER';
            if (this.peekKeyword('LEFT')) { this.advance(); type = 'LEFT'; if (this.peekKeyword('OUTER')) this.advance(); }
            else if (this.peekKeyword('RIGHT')) { this.advance(); type = 'RIGHT'; }
            else if (this.peekKeyword('CROSS')) { this.advance(); type = 'CROSS'; }
            else if (this.peekKeyword('INNER')) { this.advance(); }
            this.eatKeyword('JOIN');
            const table = this.parseIdentifier();
            let alias: string | undefined;
            if (this.peekKeyword('AS')) { this.advance(); alias = this.parseIdentifier(); }
            else if (this.peek().type === 'IDENTIFIER') { alias = this.advance().value; }
            let on: WhereClause | undefined;
            if (this.peekKeyword('ON')) { this.advance(); on = this.parseExpression() as WhereClause; }
            joins.push({ table, alias, type, on });
        }

        let where: WhereClause | undefined;
        if (this.peekKeyword('WHERE')) { this.advance(); where = this.parseExpression() as WhereClause; }

        let groupBy: string[] | undefined;
        if (this.peekKeyword('GROUP')) {
            this.advance();
            this.eatKeyword('BY');
            groupBy = [];
            // Use parseQualifiedIdentifier so that table-qualified refs like u.name are captured in full
            do { groupBy.push(this.parseQualifiedIdentifier()); } while (this.check('COMMA') && this.advance() !== undefined);
        }

        let having: WhereClause | undefined;
        if (this.peekKeyword('HAVING')) { this.advance(); having = this.parseExpression() as WhereClause; }

        const orderBy: OrderByClause[] = [];
        if (this.peekKeyword('ORDER')) {
            this.advance();
            this.eatKeyword('BY');
            do {
                // ORDER BY can reference aggregate: COUNT(*), SUM(col), or alias
                let col: string;
                if ((this.peek().type === 'IDENTIFIER' || this.peek().type === 'KEYWORD') && AGGREGATE_FNS.has(this.peek().value.toUpperCase())) {
                    const expr = this.parseAggregate();
                    col = `${expr.fn}(${expr.col})`;
                } else {
                    // Use parseQualifiedIdentifier so ORDER BY table.col refs work
                    col = this.parseQualifiedIdentifier();
                }
                let dir: 'ASC' | 'DESC' = 'ASC';
                if (this.peekKeyword('ASC')) { this.advance(); }
                else if (this.peekKeyword('DESC')) { this.advance(); dir = 'DESC'; }
                orderBy.push({ column: col, direction: dir });
            } while (this.check('COMMA') && this.advance() !== undefined);
        }

        let limit: number | undefined;
        if (this.peekKeyword('LIMIT')) { this.advance(); limit = Number(this.eat('NUMBER').value); }

        return { kind: 'SELECT', columns, from, fromAlias, joins: joins.length ? joins : undefined, where, groupBy, having, orderBy: orderBy.length ? orderBy : undefined, limit };
    }

    private parseSelectColumns(): SelectColumn[] {
        const cols: SelectColumn[] = [];
        do {
            if (this.check('STAR')) { this.advance(); cols.push({ kind: 'star' }); continue; }
            // Aggregate function?
            if ((this.peek().type === 'IDENTIFIER' || this.peek().type === 'KEYWORD') && AGGREGATE_FNS.has(this.peek().value.toUpperCase())) {
                const agg = this.parseAggregate();
                if (this.peekKeyword('AS')) { this.advance(); agg.alias = this.parseIdentifier(); }
                cols.push(agg);
                continue;
            }
            const name = this.parseQualifiedIdentifier();
            let alias: string | undefined;
            if (this.peekKeyword('AS')) { this.advance(); alias = this.parseIdentifier(); }
            cols.push({ kind: 'column', name, alias });
        } while (this.check('COMMA') && this.advance() !== undefined);
        return cols;
    }

    private parseAggregate(): AggregateExpr {
        const fn = this.advance().value.toUpperCase() as AggregateExpr['fn'];
        this.eat('LPAREN');
        let col = '*';
        if (this.check('STAR')) { this.advance(); }
        else { col = this.parseQualifiedIdentifier(); }
        this.eat('RPAREN');
        return { kind: 'aggregate', fn, col };
    }

    // INSERT
    private parseInsert(): InsertStmt {
        this.eatKeyword('INSERT');
        this.eatKeyword('INTO');
        const table = this.parseIdentifier();

        let columns: string[] | undefined;
        if (this.check('LPAREN')) {
            const saved = this.pos;
            this.advance();
            if (this.peek().type === 'IDENTIFIER' || this.peek().type === 'KEYWORD') {
                const word = this.peek().value.toUpperCase();
                if (!['INT', 'TEXT', 'FLOAT', 'BOOLEAN', 'VARCHAR', 'INTEGER'].includes(word)) {
                    this.pos = saved;
                    this.eat('LPAREN');
                    columns = [];
                    do { columns.push(this.parseIdentifier()); } while (this.check('COMMA') && this.advance() !== undefined);
                    this.eat('RPAREN');
                } else { this.pos = saved; }
            } else { this.pos = saved; }
        }

        this.eatKeyword('VALUES');
        this.eat('LPAREN');
        const values: SqlLiteral[] = [];
        do { values.push(this.parseLiteral()); } while (this.check('COMMA') && this.advance() !== undefined);
        this.eat('RPAREN');
        return { kind: 'INSERT', table, columns, values };
    }

    private parseUpdate(): UpdateStmt {
        this.eatKeyword('UPDATE');
        const table = this.parseIdentifier();
        this.eatKeyword('SET');
        const assignments: Assignment[] = [];
        do {
            const column = this.parseIdentifier();
            this.eat('OPERATOR', '=');
            const value = this.parseExpression();
            assignments.push({ column, value });
        } while (this.check('COMMA') && this.advance() !== undefined);
        let where: WhereClause | undefined;
        if (this.peekKeyword('WHERE')) { this.advance(); where = this.parseExpression() as WhereClause; }
        return { kind: 'UPDATE', table, assignments, where };
    }

    private parseDelete(): DeleteStmt {
        this.eatKeyword('DELETE');
        this.eatKeyword('FROM');
        const table = this.parseIdentifier();
        let where: WhereClause | undefined;
        if (this.peekKeyword('WHERE')) { this.advance(); where = this.parseExpression() as WhereClause; }
        return { kind: 'DELETE', table, where };
    }

    private parseCreate(): ASTNode {
        this.eatKeyword('CREATE');
        if (this.peekKeyword('TABLE')) return this.parseCreateTable();
        if (this.peekKeyword('UNIQUE') || this.peekKeyword('INDEX')) return this.parseCreateIndex();
        throw new ParseError(`Expected TABLE or INDEX after CREATE`);
    }

    private parseCreateTable(): CreateTableStmt {
        this.eatKeyword('TABLE');
        const table = this.parseIdentifier();
        this.eat('LPAREN');
        const columns: ColumnDefAST[] = [];
        do {
            if (this.peekKeyword('PRIMARY') || this.peekKeyword('UNIQUE') || this.peekKeyword('INDEX') || this.peekKeyword('CONSTRAINT')) {
                while (!this.check('COMMA') && !this.check('RPAREN') && !this.check('EOF')) this.advance();
                continue;
            }
            columns.push(this.parseColumnDef());
        } while (this.check('COMMA') && this.advance() !== undefined);
        this.eat('RPAREN');
        return { kind: 'CREATE_TABLE', table, columns };
    }

    private parseColumnDef(): ColumnDefAST {
        const name = this.parseIdentifier();
        const typeTok = this.advance();
        let type: SqlType = 'TEXT';
        switch (typeTok.value.toUpperCase()) {
            case 'INT': case 'INTEGER': type = 'INT'; break;
            case 'FLOAT': case 'REAL': case 'DOUBLE': case 'NUMERIC': case 'DECIMAL': type = 'FLOAT'; break;
            case 'BOOLEAN': case 'BOOL': type = 'BOOLEAN'; break;
            default: type = 'TEXT';
        }
        if (this.check('LPAREN')) { this.advance(); while (!this.check('RPAREN') && !this.check('EOF')) this.advance(); this.advance(); }
        let primaryKey = false, nullable = true;
        while (!this.check('COMMA') && !this.check('RPAREN') && !this.check('EOF')) {
            const kw = this.peek().value.toUpperCase();
            if (kw === 'PRIMARY') { this.advance(); this.eatKeyword('KEY'); primaryKey = true; nullable = false; }
            else if (kw === 'NOT') { this.advance(); this.eatKeyword('NULL'); nullable = false; }
            else if (kw === 'NULL') { this.advance(); nullable = true; }
            else if (kw === 'UNIQUE' || kw === 'AUTO_INCREMENT' || kw === 'AUTOINCREMENT') { this.advance(); }
            else if (kw === 'DEFAULT') { this.advance(); this.advance(); }
            else break;
        }
        return { name, type, primaryKey, nullable };
    }

    private parseCreateIndex(): CreateIndexStmt {
        let unique = false;
        if (this.peekKeyword('UNIQUE')) { this.advance(); unique = true; }
        this.eatKeyword('INDEX');
        const index = this.parseIdentifier();
        this.eatKeyword('ON');
        const table = this.parseIdentifier();
        this.eat('LPAREN');
        const columns: string[] = [];
        do { columns.push(this.parseIdentifier()); } while (this.check('COMMA') && this.advance() !== undefined);
        this.eat('RPAREN');
        return { kind: 'CREATE_INDEX', index, table, columns, unique };
    }

    private parseDrop(): ASTNode {
        this.eatKeyword('DROP');
        if (this.peekKeyword('TABLE')) {
            this.advance();
            let ifExists = false;
            if (this.peekKeyword('IF')) { this.advance(); this.eatKeyword('EXISTS'); ifExists = true; }
            return { kind: 'DROP_TABLE', table: this.parseIdentifier(), ifExists };
        }
        if (this.peekKeyword('INDEX')) { this.advance(); return { kind: 'DROP_INDEX', index: this.parseIdentifier() }; }
        throw new ParseError('Expected TABLE or INDEX after DROP');
    }

    private parseAlter(): AlterTableStmt {
        this.eatKeyword('ALTER');
        this.eatKeyword('TABLE');
        const table = this.parseIdentifier();
        if (this.peekKeyword('ADD')) {
            this.advance();
            if (this.peekKeyword('COLUMN')) this.advance();
            return { kind: 'ALTER_TABLE', table, action: { type: 'ADD_COLUMN', column: this.parseColumnDef() } };
        }
        if (this.peekKeyword('DROP')) {
            this.advance();
            if (this.peekKeyword('COLUMN')) this.advance();
            return { kind: 'ALTER_TABLE', table, action: { type: 'DROP_COLUMN', column: this.parseIdentifier() } };
        }
        if (this.peekKeyword('RENAME')) {
            this.advance();
            if (this.peekKeyword('COLUMN')) this.advance();
            const from = this.parseIdentifier();
            this.eatKeyword('TO');
            return { kind: 'ALTER_TABLE', table, action: { type: 'RENAME_COLUMN', from, to: this.parseIdentifier() } };
        }
        throw new ParseError(`Unsupported ALTER TABLE action`);
    }

    // ── Expressions ────────────────────────────────────────────────────────────
    private parseExpression(): Expression { return this.parseOr(); }

    private parseOr(): Expression {
        let left = this.parseAnd();
        while (this.peekKeyword('OR')) { this.advance(); left = { kind: 'binary', op: 'OR', left, right: this.parseAnd() }; }
        return left;
    }

    private parseAnd(): Expression {
        let left = this.parseComparison();
        while (this.peekKeyword('AND')) { this.advance(); left = { kind: 'binary', op: 'AND', left, right: this.parseComparison() }; }
        return left;
    }

    private parseComparison(): Expression {
        if (this.peekKeyword('NOT')) { this.advance(); return { kind: 'unary', op: 'NOT', operand: this.parsePrimary() }; }
        const left = this.parsePrimary();
        const t = this.peek();
        if (t.type === 'OPERATOR') { const op = this.advance().value as '=' | '!=' | '<' | '>' | '<=' | '>='; return { kind: 'binary', op, left, right: this.parsePrimary() }; }
        if (this.peekKeyword('LIKE')) { this.advance(); return { kind: 'binary', op: 'LIKE', left, right: this.parsePrimary() }; }
        if (this.peekKeyword('IS')) {
            this.advance();
            if (this.peekKeyword('NOT')) { this.advance(); this.eatKeyword('NULL'); return { kind: 'unary', op: 'IS NOT NULL', operand: left }; }
            this.eatKeyword('NULL');
            return { kind: 'unary', op: 'IS NULL', operand: left };
        }
        return left;
    }

    private parsePrimary(): Expression {
        const t = this.peek();
        if (t.type === 'NUMBER') { this.advance(); return { kind: 'literal', value: Number(t.value) }; }
        if (t.type === 'STRING') { this.advance(); return { kind: 'literal', value: t.value }; }
        if (this.peekKeyword('NULL')) { this.advance(); return { kind: 'literal', value: null }; }
        if (t.type === 'LPAREN') { this.advance(); const expr = this.parseExpression(); this.eat('RPAREN'); return expr; }
        // Aggregate in expression (e.g. HAVING SUM(amount) > 100)
        if ((t.type === 'IDENTIFIER' || t.type === 'KEYWORD') && AGGREGATE_FNS.has(t.value.toUpperCase())) {
            return this.parseAggregate();
        }
        if (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') {
            const name = this.advance().value;
            if (this.check('DOT')) { this.advance(); return { kind: 'column_ref', table: name, column: this.advance().value }; }
            return { kind: 'column_ref', column: name };
        }
        throw new ParseError(`Unexpected token '${t.value}'`, t.pos);
    }

    private parseLiteral(): SqlLiteral {
        const t = this.peek();
        if (t.type === 'NUMBER') { this.advance(); return { kind: 'number', value: Number(t.value) }; }
        if (t.type === 'STRING') { this.advance(); return { kind: 'string', value: t.value }; }
        if (this.peekKeyword('NULL')) { this.advance(); return { kind: 'null' }; }
        if (t.type === 'OPERATOR' && t.value === '-') { this.advance(); return { kind: 'number', value: -Number(this.eat('NUMBER').value) }; }
        throw new ParseError(`Expected literal, got '${t.value}'`, t.pos);
    }

    private parseIdentifier(): string {
        const t = this.peek();
        if (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') { this.advance(); return t.value; }
        throw new ParseError(`Expected identifier, got '${t.value}'`, t.pos);
    }

    // table.column or just column
    private parseQualifiedIdentifier(): string {
        const name = this.parseIdentifier();
        if (this.check('DOT')) { this.advance(); return `${name}.${this.parseIdentifier()}`; }
        return name;
    }
}
