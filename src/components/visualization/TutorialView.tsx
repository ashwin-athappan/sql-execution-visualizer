'use client';

import React, { useState } from 'react';

interface TutorialStep {
    title: string;
    icon: string;
    description: string;
    image: string;
    sql?: string;
    tips?: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: 'Welcome to SQL Visualizer',
        icon: '👋',
        description:
            'SQL Visualizer helps you understand how a database engine processes your queries step by step. ' +
            'You\'ll see the query execution pipeline, B+ Tree index structure, and live table data — all in real-time.',
        image: '/assets/tutorial/images/01-overview.png',
        tips: [
            'The left sidebar shows your database schema',
            'The center panel visualizes query execution',
            'The right panel shows the execution plan steps',
            'The bottom section contains the SQL editor and query results',
        ],
    },
    {
        title: 'Step 1: Create a Table',
        icon: '🏗️',
        description:
            'Start by creating a table using a CREATE TABLE statement. Define columns with their data types and constraints. ' +
            'The table will appear in the schema sidebar on the left, and you\'ll see the B+ Tree being initialized.',
        image: '/assets/tutorial/images/02-create-table.png',
        sql: 'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name TEXT,\n  age INT NOT NULL\n);',
        tips: [
            'Every table needs a PRIMARY KEY column',
            'Supported types: INT, TEXT, VARCHAR, FLOAT, BOOLEAN',
            'The schema browser updates automatically',
        ],
    },
    {
        title: 'Step 2: Insert Data',
        icon: '📥',
        description:
            'Use INSERT statements to add rows. Watch the B+ Tree visualization as each key is inserted — ' +
            'you\'ll see node traversals, splits, and rebalancing in real-time.',
        image: '/assets/tutorial/images/03-insert-row.png',
        sql: "INSERT INTO users VALUES (1, 'Alice', 30);\nINSERT INTO users VALUES (2, 'Bob', 25);\nINSERT INTO users VALUES (3, 'Charlie', 35);",
        tips: [
            'Run one INSERT at a time to see each B+ Tree operation',
            'The execution plan shows node traversals and splits',
            'Use the animation controls to step through slowly',
        ],
    },
    {
        title: 'Step 3: Query with Pipeline Flow',
        icon: '🔀',
        description:
            'Run a SELECT query and switch to the Pipeline Flow tab to see the SQL logical execution order: ' +
            'FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. ' +
            'Each stage shows its input/output rows and how data transforms through the pipeline.',
        image: '/assets/tutorial/images/04-pipeline-flow.png',
        sql: 'SELECT * FROM users\nWHERE age > 25\nORDER BY age ASC;',
        tips: [
            'Click "▶ Play" to auto-step through the execution',
            'Each pipeline stage chip shows the row count',
            'The SQL annotation on the right highlights the active clause',
            'Use "▶ Auto Run" inside the stage detail to animate row-by-row evaluation',
        ],
    },
    {
        title: 'Explore: B+ Tree View',
        icon: '🌳',
        description:
            'The B+ Tree tab shows the internal index structure of your table. ' +
            'As you insert or delete rows, watch the tree grow, split nodes, and merge. ' +
            'Highlighted nodes show the current traversal path during execution.',
        image: '/assets/tutorial/images/05-btree-view.png',
        tips: [
            'The tree auto-balances (order-4 by default)',
            'Green highlights show the active traversal path',
            'Node splits are animated during INSERT operations',
            'Select different tables from the dropdown to view their trees',
        ],
    },
    {
        title: 'Explore: Table Data View',
        icon: '📋',
        description:
            'The Table Data tab shows the raw contents of your tables. ' +
            'During query execution, affected rows are highlighted — inserts glow green, deletes flash red, updates pulse yellow.',
        image: '/assets/tutorial/images/06-table-data.png',
        tips: [
            'Rows affected by the current step are highlighted',
            'Switch between tables using the dropdown in the tab bar',
            'The quick preview in the sidebar also shows a compact table view',
        ],
    },
];

const KEYBOARD_SHORTCUTS = [
    { keys: '⌘ + Enter', action: 'Execute SQL query' },
    { keys: 'Tab', action: 'Autocomplete / Insert spaces' },
    { keys: '↑ / ↓', action: 'Navigate autocomplete suggestions' },
    { keys: 'Escape', action: 'Close autocomplete popup' },
];

const SUPPORTED_SQL = [
    { category: 'DDL', commands: ['CREATE TABLE', 'DROP TABLE', 'ALTER TABLE (ADD/DROP/RENAME COLUMN)', 'CREATE INDEX', 'DROP INDEX'] },
    { category: 'DML', commands: ['INSERT INTO', 'UPDATE ... SET', 'DELETE FROM'] },
    { category: 'Queries', commands: ['SELECT (with *, columns, aliases)', 'WHERE (=, >, <, LIKE, AND, OR)', 'JOIN (INNER, LEFT)', 'GROUP BY + HAVING', 'ORDER BY (ASC/DESC)', 'LIMIT', 'Aggregate functions (COUNT, SUM, AVG, MIN, MAX)'] },
];

export function TutorialView() {
    const [activeStep, setActiveStep] = useState(0);
    const step = TUTORIAL_STEPS[activeStep];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Step Navigation ─────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: 4, padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto', flexShrink: 0,
                scrollbarWidth: 'none',
            }}>
                {TUTORIAL_STEPS.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveStep(i)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: activeStep === i ? 700 : 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            border: activeStep === i ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
                            background: activeStep === i ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)',
                            color: activeStep === i ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {s.icon} {s.title}
                    </button>
                ))}
            </div>

            {/* ── Scrollable Content ──────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>

                    {/* Title */}
                    <h2 style={{
                        fontSize: 22, fontWeight: 700, margin: '0 0 6px 0',
                        color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <span style={{ fontSize: 28 }}>{step.icon}</span>
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p style={{
                        fontSize: 13, lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                        margin: '0 0 16px 0',
                    }}>
                        {step.description}
                    </p>

                    {/* Screenshot */}
                    <div style={{
                        borderRadius: 12, overflow: 'hidden',
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                        marginBottom: 20,
                    }}>
                        <img
                            src={step.image}
                            alt={step.title}
                            style={{ width: '100%', display: 'block' }}
                        />
                    </div>

                    {/* SQL Example */}
                    {step.sql && (
                        <div style={{ marginBottom: 20 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: 'var(--accent-cyan)',
                                marginBottom: 6,
                            }}>
                                💡 Try this SQL
                            </div>
                            <pre style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '12px 16px',
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-primary)',
                                margin: 0,
                                lineHeight: 1.6,
                                overflowX: 'auto',
                            }}>
                                {step.sql}
                            </pre>
                        </div>
                    )}

                    {/* Tips */}
                    {step.tips && (
                        <div style={{
                            background: 'rgba(0,212,255,0.04)',
                            border: '1px solid rgba(0,212,255,0.15)',
                            borderRadius: 10,
                            padding: '12px 16px',
                            marginBottom: 20,
                        }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: 'var(--accent-cyan)',
                                marginBottom: 8,
                            }}>
                                ✨ Tips
                            </div>
                            <ul style={{
                                margin: 0, paddingLeft: 18,
                                listStyleType: '\'→  \'',
                                display: 'flex', flexDirection: 'column', gap: 4,
                            }}>
                                {step.tips.map((tip, i) => (
                                    <li key={i} style={{
                                        fontSize: 12, color: 'var(--text-secondary)',
                                        lineHeight: 1.5, paddingLeft: 4,
                                    }}>
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <button
                            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                            disabled={activeStep === 0}
                            style={{
                                padding: '8px 18px', borderRadius: 8,
                                fontSize: 12, fontWeight: 600,
                                background: activeStep === 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                                color: activeStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                                border: '1px solid var(--border)',
                                cursor: activeStep === 0 ? 'default' : 'pointer',
                            }}
                        >
                            ← Previous
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {activeStep + 1} / {TUTORIAL_STEPS.length}
                        </span>
                        <button
                            onClick={() => setActiveStep(Math.min(TUTORIAL_STEPS.length - 1, activeStep + 1))}
                            disabled={activeStep === TUTORIAL_STEPS.length - 1}
                            style={{
                                padding: '8px 18px', borderRadius: 8,
                                fontSize: 12, fontWeight: 600,
                                background: activeStep === TUTORIAL_STEPS.length - 1 ? 'var(--bg-elevated)' : 'rgba(0,212,255,0.12)',
                                color: activeStep === TUTORIAL_STEPS.length - 1 ? 'var(--text-muted)' : 'var(--accent-cyan)',
                                border: '1px solid ' + (activeStep === TUTORIAL_STEPS.length - 1 ? 'var(--border)' : 'var(--accent-cyan)'),
                                cursor: activeStep === TUTORIAL_STEPS.length - 1 ? 'default' : 'pointer',
                            }}
                        >
                            Next →
                        </button>
                    </div>

                    {/* ── Reference Section (shown on last step or always at bottom) ── */}
                    {activeStep === TUTORIAL_STEPS.length - 1 && (
                        <>
                            {/* Keyboard Shortcuts */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                                    ⌨️ Keyboard Shortcuts
                                </h3>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'auto 1fr',
                                    gap: '6px 16px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    padding: '12px 16px',
                                }}>
                                    {KEYBOARD_SHORTCUTS.map((s, i) => (
                                        <React.Fragment key={i}>
                                            <code style={{
                                                fontSize: 11, fontFamily: 'var(--font-mono)',
                                                background: 'var(--bg-surface)',
                                                padding: '2px 8px', borderRadius: 4,
                                                color: 'var(--accent-cyan)',
                                                border: '1px solid var(--border)',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {s.keys}
                                            </code>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                                {s.action}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Supported SQL */}
                            <div style={{ marginBottom: 32 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                                    📚 Supported SQL
                                </h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {SUPPORTED_SQL.map(cat => (
                                        <div key={cat.category} style={{
                                            flex: '1 1 200px',
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                        }}>
                                            <div style={{
                                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.08em', color: 'var(--accent-cyan)',
                                                marginBottom: 8,
                                            }}>
                                                {cat.category}
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {cat.commands.map((cmd, i) => (
                                                    <li key={i} style={{
                                                        fontSize: 11, color: 'var(--text-secondary)',
                                                        fontFamily: 'var(--font-mono)',
                                                    }}>
                                                        {cmd}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
