'use client';

import { useState, useCallback, useEffect } from 'react';
import { TOUR_STEPS } from '@/components/tour/tourSteps';

const STORAGE_KEY = 'sql-viz-tour-completed';

export function useTour() {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    // Auto-start on first visit (after mount so we can read localStorage)
    useEffect(() => {
        try {
            const completed = localStorage.getItem(STORAGE_KEY);
            if (!completed) {
                // Small delay so the layout has rendered and targets are measurable
                const timer = setTimeout(() => setIsActive(true), 600);
                return () => clearTimeout(timer);
            }
        } catch {
            // localStorage unavailable — don't auto-start
        }
    }, []);

    const totalSteps = TOUR_STEPS.length;

    const next = useCallback(() => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(s => s + 1);
        } else {
            // Reached the end
            setIsActive(false);
            setCurrentStep(0);
            try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
        }
    }, [currentStep, totalSteps]);

    const prev = useCallback(() => {
        setCurrentStep(s => Math.max(0, s - 1));
    }, []);

    const skip = useCallback(() => {
        setIsActive(false);
        setCurrentStep(0);
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
    }, []);

    const startTour = useCallback(() => {
        setCurrentStep(0);
        setIsActive(true);
    }, []);

    return {
        isActive,
        currentStep,
        totalSteps,
        step: TOUR_STEPS[currentStep],
        next,
        prev,
        skip,
        startTour,
    };
}
