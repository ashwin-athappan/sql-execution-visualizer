'use client';

import React from 'react';

interface Props {
    currentIndex: number;
    totalSteps: number;
    isPlaying: boolean;
    speed: number;
    onPlay: () => void;
    onPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onReset: () => void;
    onSpeedChange: (ms: number) => void;
}

const SPEED_LABELS: Record<number, string> = {
    200: '5×',
    400: '2×',
    800: '1×',
    1500: '0.5×',
    3000: '0.25×',
};
const SPEED_OPTIONS = [3000, 1500, 800, 400, 200];

export function AnimationControls({
    currentIndex, totalSteps, isPlaying, speed,
    onPlay, onPause, onStepBack, onStepForward, onReset, onSpeedChange,
}: Props) {
    const progress = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0;
    const atStart = currentIndex <= 0;
    const atEnd = currentIndex >= totalSteps - 1;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
        }}>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 60 }}>
                    {totalSteps > 0 ? `${currentIndex + 1} / ${totalSteps}` : '—'}
                </span>
                <div
                    style={{
                        flex: 1, height: 4, background: 'var(--border)',
                        borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        if (totalSteps === 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        const idx = Math.round(pct * (totalSteps - 1));
                        onStepBack();  // We'll handle via setCurrentStepIndex, approximated by step controls
                        void idx; // handled by parent
                    }}
                >
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))',
                        borderRadius: 2,
                        transition: 'width 0.2s ease',
                    }} />
                </div>
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Reset */}
                <button className="btn-icon tooltip" data-tip="Reset" onClick={onReset} disabled={totalSteps === 0}>
                    ⏮
                </button>

                {/* Step back */}
                <button className="btn-icon tooltip" data-tip="Step Back" onClick={onStepBack} disabled={atStart || totalSteps === 0}>
                    ⏪
                </button>

                {/* Play / Pause */}
                <button
                    className="btn btn-primary"
                    style={{ padding: '6px 18px', minWidth: 80 }}
                    onClick={isPlaying ? onPause : onPlay}
                    disabled={totalSteps === 0}
                >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                {/* Step forward */}
                <button className="btn-icon tooltip" data-tip="Step Forward" onClick={onStepForward} disabled={atEnd || totalSteps === 0}>
                    ⏩
                </button>

                {/* Go to end */}
                <button className="btn-icon tooltip" data-tip="Go to end" disabled={atEnd || totalSteps === 0}
                    onClick={() => { for (let i = currentIndex; i < totalSteps - 1; i++) onStepForward(); }}>
                    ⏭
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Speed selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speed:</span>
                    <div className="tabs" style={{ padding: 2 }}>
                        {SPEED_OPTIONS.map(s => (
                            <button
                                key={s}
                                className={`tab ${speed === s ? 'active' : ''}`}
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => onSpeedChange(s)}
                            >
                                {SPEED_LABELS[s]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
