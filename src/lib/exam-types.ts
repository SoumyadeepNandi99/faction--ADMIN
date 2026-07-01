// Canonical exam-type values, matching backend TargetExam enum
// (app/models/user.py: JEE_ADVANCED, JEE_MAINS, NEET, OLYMPIAD, CBSE).
//
// Subjects are scoped by BOTH class_id and exam_type — the same subject name
// (e.g. "Physics") exists separately per exam track within a class. Always
// require a class + exam selection before fetching/listing subjects.

export type ExamType = "JEE_ADVANCED" | "JEE_MAINS" | "NEET" | "OLYMPIAD" | "CBSE";

export const EXAM_TYPE_OPTIONS: { label: string; value: ExamType }[] = [
    { label: "JEE Advanced", value: "JEE_ADVANCED" },
    { label: "JEE Mains", value: "JEE_MAINS" },
    { label: "NEET", value: "NEET" },
    { label: "Olympiad", value: "OLYMPIAD" },
    { label: "CBSE", value: "CBSE" },
];

const EXAM_LABELS: Record<string, string> = Object.fromEntries(
    EXAM_TYPE_OPTIONS.map(o => [o.value, o.label]),
);

export const formatExamType = (value?: string | null): string =>
    value ? (EXAM_LABELS[value] ?? value.replace(/_/g, " ")) : "";
