import { create } from 'zustand';
import { MiniDatabase } from '@/engine/database';
import { ExecutionStep, Row, ExecutionResult } from '@/engine/types';
import { TableDef } from '@/engine/types';

interface DbState {
    db: MiniDatabase;
    // Execution
    steps: ExecutionStep[];
    currentStepIndex: number;
    isPlaying: boolean;
    speed: number;   // ms per step
    // Results
    resultRows: Row[];
    resultColumns: string[];
    rowsAffected: number;
    error: string | null;
    // Schema snapshot (updated after each query)
    schemaTables: TableDef[];
    // Currently focused table
    focusedTable: string | null;
    // Loading
    isExecuting: boolean;
    // Last SQL
    lastSql: string;
}

interface DbActions {
    executeQuery: (sql: string) => Promise<void>;
    stepForward: () => void;
    stepBackward: () => void;
    play: () => void;
    pause: () => void;
    reset: () => void;
    setSpeed: (ms: number) => void;
    setFocusedTable: (name: string | null) => void;
    setCurrentStepIndex: (idx: number) => void;
}

type DbStore = DbState & DbActions;

const INITIAL_DB = new MiniDatabase();

export const useDbStore = create<DbStore>((set, get) => ({
    db: INITIAL_DB,
    steps: [],
    currentStepIndex: -1,
    isPlaying: false,
    speed: 800,
    resultRows: [],
    resultColumns: [],
    rowsAffected: 0,
    error: null,
    schemaTables: [],
    focusedTable: null,
    isExecuting: false,
    lastSql: '',

    executeQuery: async (sql: string) => {
        set({ isExecuting: true, error: null, lastSql: sql });
        const { db } = get();
        const result: ExecutionResult = await db.execute(sql);

        const tables = db.getSchema().listTables();

        set({
            steps: result.steps,
            currentStepIndex: result.steps.length > 0 ? 0 : -1,
            resultRows: result.resultRows,
            resultColumns: result.resultColumns,
            rowsAffected: result.rowsAffected,
            error: result.error ?? null,
            schemaTables: tables,
            isExecuting: false,
            isPlaying: false,
            focusedTable: result.steps[0]?.tableName ?? (tables[0]?.name ?? null),
        });
    },

    stepForward: () => {
        const { currentStepIndex, steps } = get();
        if (currentStepIndex < steps.length - 1) {
            set({ currentStepIndex: currentStepIndex + 1 });
        }
    },

    stepBackward: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
            set({ currentStepIndex: currentStepIndex - 1 });
        }
    },

    play: () => {
        if (get().isPlaying) return;
        set({ isPlaying: true });

        const tick = () => {
            const { isPlaying, currentStepIndex, steps, speed } = get();
            if (!isPlaying) return;
            if (currentStepIndex >= steps.length - 1) {
                set({ isPlaying: false });
                return;
            }
            set({ currentStepIndex: currentStepIndex + 1 });
            setTimeout(tick, speed);
        };
        setTimeout(tick, get().speed);
    },

    pause: () => set({ isPlaying: false }),

    reset: () => {
        set({ currentStepIndex: get().steps.length > 0 ? 0 : -1, isPlaying: false });
    },

    setSpeed: (ms: number) => set({ speed: ms }),

    setFocusedTable: (name: string | null) => set({ focusedTable: name }),

    setCurrentStepIndex: (idx: number) => set({ currentStepIndex: idx }),
}));
