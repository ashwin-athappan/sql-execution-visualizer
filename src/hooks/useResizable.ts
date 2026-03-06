'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical';

interface UseResizableOptions {
    /** Initial size in pixels */
    initialSize: number;
    /** Minimum allowed size in pixels */
    minSize?: number;
    /** Maximum allowed size in pixels */
    maxSize?: number;
    /** Direction of resizing */
    direction: ResizeDirection;
    /**
     * Whether increasing mouse position should increase or decrease the size.
     * - `false` (default): dragging right/down increases size (left/top edge handle)
     * - `true`: dragging right/down decreases size (right/bottom edge handle)
     */
    reverse?: boolean;
}

export function useResizable({
    initialSize,
    minSize = 100,
    maxSize = 800,
    direction,
    reverse = false,
}: UseResizableOptions) {
    const [size, setSize] = useState(initialSize);
    const isDragging = useRef(false);
    const startPos = useRef(0);
    const startSize = useRef(0);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
        startSize.current = size;

        // Add a class to body to change cursor globally during drag
        document.body.classList.add(
            direction === 'horizontal' ? 'resize-col' : 'resize-row'
        );
    }, [direction, size]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - startPos.current;
            const newSize = reverse
                ? startSize.current - delta
                : startSize.current + delta;
            setSize(Math.max(minSize, Math.min(maxSize, newSize)));
        };

        const onMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            document.body.classList.remove('resize-col', 'resize-row');
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [direction, minSize, maxSize, reverse]);

    return { size, onMouseDown };
}
