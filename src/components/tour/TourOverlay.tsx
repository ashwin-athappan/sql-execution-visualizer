'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TourStep } from './tourSteps';

interface TourOverlayProps {
    step: TourStep;
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
}

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const PADDING = 8;

function getTargetRect(selector: string): Rect | null {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
    };
}

interface TooltipPos {
    top: number;
    left: number;
    transformOrigin: string;
}

function computeTooltipPos(
    target: Rect,
    placement: TourStep['placement'],
    tooltipWidth: number,
    tooltipHeight: number,
): TooltipPos {
    const GAP = 16;
    let top = 0;
    let left = 0;
    let transformOrigin = 'top left';

    switch (placement) {
        case 'bottom':
            top = target.top + target.height + GAP;
            left = target.left + target.width / 2 - tooltipWidth / 2;
            transformOrigin = 'top center';
            break;
        case 'top':
            top = target.top - tooltipHeight - GAP;
            left = target.left + target.width / 2 - tooltipWidth / 2;
            transformOrigin = 'bottom center';
            break;
        case 'right':
            top = target.top + target.height / 2 - tooltipHeight / 2;
            left = target.left + target.width + GAP;
            transformOrigin = 'center left';
            break;
        case 'left':
            top = target.top + target.height / 2 - tooltipHeight / 2;
            left = target.left - tooltipWidth - GAP;
            transformOrigin = 'center right';
            break;
    }

    // Viewport clamping
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 12) left = 12;
    if (left + tooltipWidth > vw - 12) left = vw - tooltipWidth - 12;
    if (top < 12) top = 12;
    if (top + tooltipHeight > vh - 12) top = vh - tooltipHeight - 12;

    return { top, left, transformOrigin };
}

export function TourOverlay({
    step,
    currentStep,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
}: TourOverlayProps) {
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0, transformOrigin: 'top center' });
    const [animating, setAnimating] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const measure = useCallback(() => {
        const rect = getTargetRect(step.targetSelector);
        setTargetRect(rect);

        if (rect && tooltipRef.current) {
            const tw = tooltipRef.current.offsetWidth;
            const th = tooltipRef.current.offsetHeight;
            setTooltipPos(computeTooltipPos(rect, step.placement, tw, th));
        }
    }, [step]);

    // Measure on mount + step change
    useEffect(() => {
        setAnimating(true);
        // Wait a tick so the tooltip DOM is available
        const raf = requestAnimationFrame(() => {
            measure();
            // End animation after transition
            setTimeout(() => setAnimating(false), 50);
        });
        return () => cancelAnimationFrame(raf);
    }, [measure]);

    // Re-measure on resize
    useEffect(() => {
        const handler = () => measure();
        window.addEventListener('resize', handler);
        window.addEventListener('scroll', handler, true);
        return () => {
            window.removeEventListener('resize', handler);
            window.removeEventListener('scroll', handler, true);
        };
    }, [measure]);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onSkip();
            if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onNext, onPrev, onSkip]);

    const isLast = currentStep === totalSteps - 1;
    const isFirst = currentStep === 0;

    return (
        <div className="tour-overlay" aria-modal="true" role="dialog" aria-label="Guided tour">
            {/* Spotlight cutout */}
            {targetRect && (
                <div
                    className="tour-spotlight"
                    style={{
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                    }}
                />
            )}

            {/* Click backdrop to dismiss */}
            <div className="tour-backdrop" onClick={onSkip} />

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`tour-tooltip ${animating ? 'tour-tooltip-enter' : ''}`}
                style={{
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    transformOrigin: tooltipPos.transformOrigin,
                }}
            >
                {/* Header */}
                <div className="tour-tooltip-header">
                    <span className="tour-tooltip-icon">{step.icon}</span>
                    <span className="tour-tooltip-title">{step.title}</span>
                    <span className="tour-tooltip-badge">{currentStep + 1} / {totalSteps}</span>
                </div>

                {/* Description */}
                <p className="tour-tooltip-desc">{step.description}</p>

                {/* Step dots */}
                <div className="tour-dots">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <span
                            key={i}
                            className={`tour-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                        />
                    ))}
                </div>

                {/* Actions */}
                <div className="tour-tooltip-actions">
                    <button className="tour-skip-btn" onClick={onSkip}>
                        Skip Tour
                    </button>
                    <div style={{ flex: 1 }} />
                    {!isFirst && (
                        <button className="btn btn-ghost tour-nav-btn" onClick={onPrev}>
                            ← Back
                        </button>
                    )}
                    <button className="btn btn-primary tour-nav-btn" onClick={onNext}>
                        {isLast ? '✓ Finish' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
