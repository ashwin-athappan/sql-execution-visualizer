import React from 'react';

interface SidebarFooterProps {
    tableCount: number;
    indexCount: number;
    isRestored: boolean;
    onClearDb: () => void;
    onStartTour: () => void;
}

export function SidebarFooter({ tableCount, indexCount, isRestored, onClearDb, onStartTour }: SidebarFooterProps) {
    return (
        <div style={{
            padding: '8px 12px', borderTop: '1px solid var(--border)',
            flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
            {/* Tour trigger */}
            <button className="tour-trigger-btn" onClick={onStartTour}>
                🎓 Take a Tour
            </button>

            {/* Stats row */}
            <div style={{
                fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <span>
                    {isRestored ? '💾' : '⏳'}&nbsp;
                    {tableCount} table{tableCount !== 1 ? 's' : ''} · {indexCount} index{indexCount !== 1 ? 'es' : ''}
                </span>
                {tableCount > 0 && (
                    <button
                        onClick={onClearDb}
                        style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', borderRadius: 4, padding: '2px 7px',
                            fontSize: 9, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
                        }}
                        title="Clear all tables from storage"
                    >
                        Clear DB
                    </button>
                )}
            </div>
        </div>
    );
}
