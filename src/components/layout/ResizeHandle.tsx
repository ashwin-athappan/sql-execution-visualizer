'use client';

import React from 'react';

interface ResizeHandleProps {
    direction: 'horizontal' | 'vertical';
    onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * A thin draggable bar rendered between panels.
 * • horizontal: renders a vertical bar (between left/right panels)
 * • vertical:   renders a horizontal bar  (between top/bottom panels)
 */
export function ResizeHandle({ direction, onMouseDown }: ResizeHandleProps) {
    const isHorizontal = direction === 'horizontal';

    return (
        <div
            className={`resize-handle ${isHorizontal ? 'resize-handle-h' : 'resize-handle-v'}`}
            onMouseDown={onMouseDown}
        />
    );
}
