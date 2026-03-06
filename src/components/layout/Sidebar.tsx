'use client';

import React from 'react';
import { SchemaBrowser } from '@/components/schema/SchemaBrowser';
import { SidebarLogo } from './sidebar/SidebarLogo';
import { SidebarSchemaHeader } from './sidebar/SidebarSchemaHeader';
import { SidebarQuickPreview } from './sidebar/SidebarQuickPreview';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { TableDef, Row } from '@/engine/types';

interface SidebarProps {
    schemaTables: TableDef[];
    focusedTable: string | null;
    isRestored: boolean;
    tableData: { rows: Row[]; columns: string[]; pkColumn: string | undefined };
    onSelectTable: (name: string) => void;
    onClearDb: () => void;
}

export function Sidebar({
    schemaTables,
    focusedTable,
    isRestored,
    tableData,
    onSelectTable,
    onClearDb,
}: SidebarProps) {
    const totalIndexes = schemaTables.reduce((a, t) => a + t.indexes.length, 0);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            overflow: 'hidden',
            height: '100%',
        }}>
            <SidebarLogo />
            <SidebarSchemaHeader tableCount={schemaTables.length} />

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <SchemaBrowser
                    tables={schemaTables}
                    focusedTable={focusedTable}
                    onSelectTable={onSelectTable}
                />
            </div>

            <SidebarQuickPreview
                focusedTable={focusedTable}
                tableData={tableData}
            />

            <SidebarFooter
                tableCount={schemaTables.length}
                indexCount={totalIndexes}
                isRestored={isRestored}
                onClearDb={onClearDb}
            />
        </div>
    );
}
