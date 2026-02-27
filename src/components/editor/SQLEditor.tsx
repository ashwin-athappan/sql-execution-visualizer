'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TableDef } from '@/engine/types';

interface Props {
    value: string;
    onChange: (val: string) => void;
    onExecute: () => void;
    isExecuting: boolean;
    error: string | null;
    schema: TableDef[];
}

const KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'ON',
    'UNIQUE', 'PRIMARY', 'KEY', 'NOT', 'NULL', 'AND', 'OR', 'LIKE', 'IS', 'ORDER',
    'BY', 'ASC', 'DESC', 'LIMIT', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS', 'IF', 'EXISTS',
    'RENAME', 'TO', 'INT', 'TEXT', 'VARCHAR', 'FLOAT', 'BOOLEAN', 'GROUP', 'HAVING',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'AS', 'OUTER',
];

function highlightSQL(sql: string): string {
    let result = '';
    let i = 0;
    const chars = sql;
    while (i < chars.length) {
        if (chars[i] === "'") {
            let str = "'";
            i++;
            while (i < chars.length && chars[i] !== "'") str += chars[i++];
            str += (chars[i] ?? '');
            i++;
            result += `<span style="color:#f9a875">${str}</span>`;
            continue;
        }
        if (/\d/.test(chars[i])) {
            let num = '';
            while (i < chars.length && /[\d.]/.test(chars[i])) num += chars[i++];
            result += `<span style="color:#79c0ff">${num}</span>`;
            continue;
        }
        if (/[a-zA-Z_]/.test(chars[i])) {
            let word = '';
            while (i < chars.length && /[\w]/.test(chars[i])) word += chars[i++];
            if (KEYWORDS.includes(word.toUpperCase())) {
                result += `<span style="color:#ff7b72;font-weight:600">${word}</span>`;
            } else {
                result += `<span style="color:#e2e8f0">${word}</span>`;
            }
            continue;
        }
        if (['=', '<', '>', '!', '*'].includes(chars[i])) {
            result += `<span style="color:#79c0ff">${chars[i++]}</span>`;
            continue;
        }
        if (['(', ')', ',', ';'].includes(chars[i])) {
            result += `<span style="color:#8b949e">${chars[i++]}</span>`;
            continue;
        }
        const c = chars[i++];
        if (c === '&') result += '&amp;';
        else if (c === '<') result += '&lt;';
        else if (c === '>') result += '&gt;';
        else result += c;
    }
    return result;
}

// Determine autocomplete context at current cursor position
function getCompletions(text: string, cursorPos: number, schema: TableDef[]): string[] {
    const before = text.slice(0, cursorPos);
    const wordMatch = before.match(/[\w.]+$/);
    const currentWord = wordMatch ? wordMatch[0].toLowerCase() : '';
    const upper = before.toUpperCase().trimEnd();

    const tableNames = schema.map(t => t.name);
    const allCols = schema.flatMap(t => t.columns.map(c => c.name));

    // After FROM / JOIN → suggest table names
    if (/\b(FROM|JOIN|INTO|UPDATE)\s+[\w]*$/i.test(before)) {
        return tableNames.filter(n => n.toLowerCase().startsWith(currentWord));
    }

    // After table.  → suggest columns of that table
    if (currentWord.includes('.')) {
        const [tbl] = currentWord.split('.');
        const colPart = currentWord.split('.')[1] ?? '';
        const tableDef = schema.find(t => t.name.toLowerCase() === tbl.toLowerCase());
        return tableDef ? tableDef.columns.map(c => `${tbl}.${c.name}`).filter(c => c.toLowerCase().startsWith(currentWord)) : [];
    }

    // After SELECT / WHERE → suggest columns + keywords
    if (/\b(SELECT|WHERE|HAVING|ON|SET|ORDER BY|GROUP BY)\s+[\w]*$/i.test(before)) {
        return [...allCols.filter(c => c.toLowerCase().startsWith(currentWord)), ...KEYWORDS.filter(k => k.toLowerCase().startsWith(currentWord) && !allCols.includes(k))].slice(0, 20);
    }

    // Default: keywords starting with current word
    const completions: string[] = [];
    if (currentWord.length >= 1) {
        completions.push(...tableNames.filter(n => n.toLowerCase().startsWith(currentWord)));
        completions.push(...KEYWORDS.filter(k => k.toLowerCase().startsWith(currentWord)));
        completions.push(...allCols.filter(c => c.toLowerCase().startsWith(currentWord) && !completions.includes(c)));
    }
    return completions.slice(0, 12);
}

const SAMPLE_QUERIES = [
    'CREATE TABLE users (id INT PRIMARY KEY, name TEXT, age INT NOT NULL)',
    'CREATE TABLE orders (id INT PRIMARY KEY, user_id INT, amount FLOAT, status TEXT)',
    "INSERT INTO users VALUES (1, 'Alice', 30)",
    "INSERT INTO orders VALUES (1, 1, 150.00, 'paid')",
    'SELECT * FROM users WHERE age > 27 ORDER BY age ASC',
    'SELECT u.name, SUM(o.amount) AS total FROM orders o JOIN users u ON o.user_id = u.id GROUP BY u.name',
    'SELECT status, COUNT(*) AS count, AVG(amount) AS avg_amount FROM orders GROUP BY status HAVING COUNT(*) > 1',
    'UPDATE users SET age = 31 WHERE id = 1',
    'DELETE FROM orders WHERE status = \'pending\'',
    'ALTER TABLE users ADD COLUMN email TEXT',
    'DROP TABLE orders',
];

export function SQLEditor({ value, onChange, onExecute, isExecuting, error, schema }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    const [completions, setCompletions] = useState<string[]>([]);
    const [acIdx, setAcIdx] = useState(0);
    const [acVisible, setAcVisible] = useState(false);
    const [acAnchor, setAcAnchor] = useState({ top: 0, left: 0 });

    const syncScroll = () => {
        if (textareaRef.current && highlightRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const updateCompletions = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const items = getCompletions(value, pos, schema);
        if (items.length > 0) {
            // Estimate cursor pixel position for popup
            const lines = value.slice(0, pos).split('\n');
            const lineNum = lines.length;
            const charInLine = lines[lines.length - 1].length;
            const charW = 7.8, lineH = 21.4;
            setAcAnchor({ top: lineNum * lineH + 8, left: charInLine * charW + 12 });
            setCompletions(items);
            setAcIdx(0);
            setAcVisible(true);
        } else {
            setAcVisible(false);
        }
    }, [value, schema]);

    const applyCompletion = (item: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = value.slice(0, pos);
        const wordMatch = before.match(/[\w.]+$/);
        const wordLen = wordMatch ? wordMatch[0].length : 0;
        const after = value.slice(pos);
        const newValue = before.slice(0, before.length - wordLen) + item + after;
        onChange(newValue);
        setAcVisible(false);
        requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = pos - wordLen + item.length;
            ta.focus();
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (acVisible) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => Math.min(i + 1, completions.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(i => Math.max(i - 1, 0)); return; }
            if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applyCompletion(completions[acIdx]); return; }
            if (e.key === 'Escape') { setAcVisible(false); return; }
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onExecute(); return; }
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = textareaRef.current!;
            const start = ta.selectionStart;
            const next = value.slice(0, start) + '  ' + value.slice(ta.selectionEnd);
            onChange(next);
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
        }
    };

    useEffect(() => {
        if (!acVisible) return;
        setAcIdx(0);
    }, [completions]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flex: 1 }}>
                    SQL Editor <span style={{ opacity: 0.5 }}>· ⌘↵ to run · Tab for autocomplete</span>
                </span>
                <select
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                    value=""
                    onChange={e => { if (e.target.value) onChange(e.target.value); e.target.value = ''; }}
                >
                    <option value="">Examples…</option>
                    {SAMPLE_QUERIES.map((q, i) => <option key={i} value={q}>{q.slice(0, 55)}{q.length > 55 ? '…' : ''}</option>)}
                </select>
                <button className="btn btn-primary" style={{ padding: '5px 16px' }} onClick={onExecute} disabled={isExecuting || !value.trim()} id="execute-btn">
                    {isExecuting ? '⏳ Running…' : '▶ Run'}
                </button>
            </div>

            {/* Editor area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div ref={highlightRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)', pointerEvents: 'none', overflow: 'auto', zIndex: 1 }} dangerouslySetInnerHTML={{ __html: highlightSQL(value) + '\n' }} />
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={e => { onChange(e.target.value); updateCompletions(); }}
                    onKeyDown={handleKeyDown}
                    onScroll={syncScroll}
                    onClick={updateCompletions}
                    spellCheck={false}
                    id="sql-input"
                    placeholder="SELECT * FROM users WHERE age > 25…"
                    style={{ position: 'absolute', inset: 0, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.65, background: 'transparent', color: 'transparent', caretColor: 'var(--accent-cyan)', border: 'none', outline: 'none', resize: 'none', zIndex: 2, width: '100%', height: '100%' }}
                />

                {/* Autocomplete popup */}
                {acVisible && completions.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: acAnchor.top,
                        left: acAnchor.left,
                        zIndex: 10,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--accent-cyan)',
                        borderRadius: 8,
                        boxShadow: '0 8px 32px rgba(0,212,255,0.15)',
                        overflow: 'hidden',
                        minWidth: 180,
                        maxHeight: 220,
                        overflowY: 'auto',
                    }}>
                        {completions.map((item, i) => {
                            const isKw = KEYWORDS.includes(item.toUpperCase());
                            const isTable = schema.some(t => t.name === item);
                            const isCol = !isKw && !isTable;
                            return (
                                <div
                                    key={`${item}-${i}`}
                                    onMouseDown={e => { e.preventDefault(); applyCompletion(item); }}
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: 12,
                                        fontFamily: 'var(--font-mono)',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        background: i === acIdx ? 'rgba(0,212,255,0.12)' : 'transparent',
                                        color: i === acIdx ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        borderLeft: i === acIdx ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                    }}
                                >
                                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                                        {isKw ? '🔷' : isTable ? '🗄️' : '◦'}
                                    </span>
                                    <span>{item}</span>
                                    <span style={{ fontSize: 9, marginLeft: 'auto', opacity: 0.5 }}>
                                        {isKw ? 'keyword' : isTable ? 'table' : 'column'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {error && (
                <div style={{ padding: '6px 12px', fontSize: 11, flexShrink: 0, background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                    ⛔ {error}
                </div>
            )}
        </div>
    );
}
