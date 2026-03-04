'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export function ThemeSwitcher() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            style={{
                position: 'relative',
                width: 44,
                height: 24,
                borderRadius: 99,
                border: `1px solid ${isDark ? 'var(--border-bright)' : 'rgba(0,0,0,0.15)'}`,
                background: isDark
                    ? 'linear-gradient(135deg, #1e2d47 0%, #0e1425 100%)'
                    : 'linear-gradient(135deg, #87CEEB 0%, #60B0E0 100%)',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isDark
                    ? 'inset 0 1px 3px rgba(0,0,0,0.4)'
                    : 'inset 0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden',
            }}
        >
            {/* Track stars (dark mode) */}
            <span style={{
                position: 'absolute',
                top: 5, left: 6,
                width: 2, height: 2,
                borderRadius: '50%',
                background: '#fff',
                opacity: isDark ? 0.6 : 0,
                transition: 'opacity 0.3s',
                boxShadow: '6px 3px 0 0 rgba(255,255,255,0.4), 3px 8px 0 0 rgba(255,255,255,0.3)',
            }} />

            {/* Track cloud (light mode) */}
            <span style={{
                position: 'absolute',
                top: 7, right: 8,
                fontSize: 8,
                opacity: isDark ? 0 : 0.7,
                transition: 'opacity 0.3s',
                lineHeight: 1,
            }}>☁️</span>

            {/* Thumb / icon */}
            <span
                style={{
                    position: 'absolute',
                    top: 2,
                    left: isDark ? 2 : 20,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDark
                        ? 'linear-gradient(135deg, #334155, #1e293b)'
                        : 'linear-gradient(135deg, #FFD700, #FFA500)',
                    boxShadow: isDark
                        ? '0 0 6px rgba(139, 92, 246, 0.4)'
                        : '0 0 8px rgba(255, 165, 0, 0.5)',
                }}
            >
                {isDark ? '🌙' : '☀️'}
            </span>
        </button>
    );
}
