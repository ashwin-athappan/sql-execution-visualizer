export interface TourStep {
    targetSelector: string;
    title: string;
    description: string;
    placement: 'top' | 'bottom' | 'left' | 'right';
    icon: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcutKey = isMac ? '⌘' : 'Ctrl';

export const TOUR_STEPS: TourStep[] = [
    {
        targetSelector: '[data-tour="editor"]',
        title: 'The SQL Editor',
        description:
            `Write or paste SQL here. Use the "Examples…" dropdown for sample queries to get started quickly. Autocomplete kicks in as you type — just press Tab to accept a suggestion.`,
        placement: 'top',
        icon: '✏️',
    },
    {
        targetSelector: '[data-tour="controls"]',
        title: 'Run Your Query',
        description:
            `Hit the ▶ Run button or press ${shortcutKey} + Enter to execute your SQL. Results appear instantly in the panel to the right.`,
        placement: 'top',
        icon: '🚀',
    },
    {
        targetSelector: '[data-tour="visualization"]',
        title: 'Explore the Results',
        description:
            'Switch between Pipeline Flow, B+ Tree, and Table Data tabs to see how your query is processed step by step. The Execution Plan panel on the right shows each operation.',
        placement: 'bottom',
        icon: '🔍',
    },
];
