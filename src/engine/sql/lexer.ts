export type TokenType =
    | 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING' | 'OPERATOR'
    | 'LPAREN' | 'RPAREN' | 'COMMA' | 'SEMICOLON' | 'DOT' | 'STAR' | 'EOF';

export interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

const KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
    'INDEX', 'ON', 'UNIQUE', 'PRIMARY', 'KEY', 'NOT', 'NULL', 'DEFAULT',
    'AND', 'OR', 'LIKE', 'IS', 'IN', 'ORDER', 'BY', 'ASC', 'DESC',
    'LIMIT', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS',
    'INT', 'INTEGER', 'TEXT', 'VARCHAR', 'FLOAT', 'REAL', 'DOUBLE',
    'NUMERIC', 'DECIMAL', 'BOOLEAN', 'BOOL',
    'IF', 'EXISTS', 'RENAME', 'TO', 'CONSTRAINT', 'REFERENCES',
    'AS', 'DISTINCT', 'GROUP', 'HAVING',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
]);

export function tokenize(sql: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < sql.length) {
        // skip whitespace
        if (/\s/.test(sql[i])) { i++; continue; }

        // line comment
        if (sql[i] === '-' && sql[i + 1] === '-') {
            while (i < sql.length && sql[i] !== '\n') i++;
            continue;
        }

        const start = i;

        // String literal
        if (sql[i] === "'") {
            i++;
            let str = '';
            while (i < sql.length && sql[i] !== "'") {
                if (sql[i] === '\\') i++;
                str += sql[i++];
            }
            i++; // closing quote
            tokens.push({ type: 'STRING', value: str, pos: start });
            continue;
        }

        // Number
        if (/\d/.test(sql[i]) || (sql[i] === '-' && /\d/.test(sql[i + 1]))) {
            let num = sql[i] === '-' ? '-' : '';
            if (sql[i] === '-') i++;
            while (i < sql.length && /[\d.]/.test(sql[i])) num += sql[i++];
            tokens.push({ type: 'NUMBER', value: num, pos: start });
            continue;
        }

        // Identifier or keyword
        if (/[a-zA-Z_]/.test(sql[i])) {
            let word = '';
            while (i < sql.length && /[\w]/.test(sql[i])) word += sql[i++];
            const upper = word.toUpperCase();
            tokens.push({ type: KEYWORDS.has(upper) ? 'KEYWORD' : 'IDENTIFIER', value: upper === word ? upper : word, pos: start });
            continue;
        }

        // Operators >=, <=, !=, =, <, >
        if (['<', '>', '!', '='].includes(sql[i])) {
            let op = sql[i++];
            if (i < sql.length && sql[i] === '=') op += sql[i++];
            tokens.push({ type: 'OPERATOR', value: op, pos: start });
            continue;
        }

        // Single-char tokens
        const single: Record<string, TokenType> = {
            '(': 'LPAREN', ')': 'RPAREN', ',': 'COMMA', ';': 'SEMICOLON',
            '.': 'DOT', '*': 'STAR',
        };
        if (single[sql[i]]) {
            tokens.push({ type: single[sql[i]], value: sql[i], pos: start });
            i++;
            continue;
        }

        // Skip unknown chars
        i++;
    }

    tokens.push({ type: 'EOF', value: '', pos: i });
    return tokens;
}
