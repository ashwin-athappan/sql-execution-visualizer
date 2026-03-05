import { SchemaManager } from '../schema';
import { TableStorage } from '../storage';
import { ExecutionStep, PipelineStage } from '../types';

export type StepEmitter = (step: Omit<ExecutionStep, 'id'>) => ExecutionStep;

/**
 * ExecutionContext provides required dependencies (schema, storages)
 * and execution state (steps, pipeline stages, step ID) to the strategies.
 * 
 * DESIGN PATTERN: Context Object Pattern
 * Extracts commonly passed parameters and execution tracking state into a single object.
 */
export class ExecutionContext {
    public steps: ExecutionStep[] = [];
    public pipelineStages: PipelineStage[] = [];
    private stepId = 0;

    constructor(
        public schema: SchemaManager,
        public storages: Map<string, TableStorage>
    ) { }

    public reset(): void {
        this.steps = [];
        this.pipelineStages = [];
        this.stepId = 0;
    }

    public getStorage(tableName: string): TableStorage {
        const normName = tableName.toLowerCase();
        const s = this.storages.get(normName);
        if (!s) throw new Error(`No storage for table '${normName}'`);
        return s;
    }

    public emit: StepEmitter = (step: Omit<ExecutionStep, 'id'>): ExecutionStep => {
        const full: ExecutionStep = { id: this.stepId++, ...step } as ExecutionStep;
        this.steps.push(full);
        return full;
    };
}
