import React from 'react';

interface SidebarSchemaHeaderProps {
    tableCount: number;
}

export function SidebarSchemaHeader({ tableCount }: SidebarSchemaHeaderProps) {
    return (
        <div className="panel-header">
            <span className="icon">📂</span>
            <span className="title">Schema</span>
            <span style={{ marginLeft: 'auto' }} className="badge badge-cyan">{tableCount}</span>
        </div>
    );
}
