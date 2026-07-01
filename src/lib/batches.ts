export interface Batch {
    id: string;
    batch_name: string;
    class_id: string;
    target_exam: 'JEE_ADVANCED' | 'JEE_MAINS' | 'NEET' | 'OLYMPIAD' | 'CBSE';
    created_at: string;
    updated_at: string;
}

export const TARGET_EXAM_OPTIONS = [
    { label: 'JEE Advanced', value: 'JEE_ADVANCED' },
    { label: 'JEE Mains', value: 'JEE_MAINS' },
    { label: 'NEET', value: 'NEET' },
    { label: 'Olympiad', value: 'OLYMPIAD' },
    { label: 'CBSE', value: 'CBSE' },
] as const;
