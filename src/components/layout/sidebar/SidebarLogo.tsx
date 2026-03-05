import React from 'react';
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher';

export function SidebarLogo() {
    return (
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                    src="/logo.svg"
                    alt="SQL Visualizer"
                    style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }}
                />
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        SQL Visualizer
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>B+Tree Engine · v2</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <ThemeSwitcher />
                </div>
            </div>
        </div>
    );
}
