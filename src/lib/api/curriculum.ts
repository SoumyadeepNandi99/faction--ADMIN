import { apiClient } from "@/lib/axios";

// --- Types ---
export interface ClassItem { id: string; name: string; }
export interface ClassListResponse { classes: ClassItem[]; total: number; }
export interface ClassWithSubjectsResponse { id: string; name: string; subjects: SubjectItem[]; }

export interface SubjectItem { id: string; name: string; class_id: string; exam_type?: string; }
export interface SubjectListResponse { subjects: SubjectItem[]; total: number; }

export interface ChapterItem { id: string; name: string; subject_id: string; }
export interface ChapterListResponse { chapters: ChapterItem[]; total: number; }

export interface TopicItem { id: string; name: string; chapter_id: string; }
export interface TopicListResponse { topics: TopicItem[]; total: number; }

// --- Classes ---
export const getClasses = () => apiClient.get<ClassListResponse>("/api/v1/class/").then(r => r.data);
export const createClass = (name: string) => apiClient.post<ClassItem>("/api/v1/class/", { name }).then(r => r.data);
export const deleteClass = (id: string) => apiClient.delete(`/api/v1/class/${id}`);
export const getClassWithSubjects = (classId: string) =>
    apiClient.get<ClassWithSubjectsResponse>(`/api/v1/class/${classId}/subjects`).then(r => r.data);

// --- Subjects ---
export const getSubjects = (classId?: string, examType?: string) =>
    apiClient.get<SubjectListResponse>("/api/v1/subjects/", {
        params: { class_id: classId, exam_type: examType }
    }).then(r => r.data);
export const createSubject = (name: string, classId: string, examType?: string) =>
    apiClient.post<SubjectItem>("/api/v1/subjects/", { name, class_id: classId, exam_type: examType }).then(r => r.data);
export const deleteSubject = (id: string) => apiClient.delete(`/api/v1/subjects/${id}`);
export const getSubjectWithChapters = (subjectId: string) =>
    apiClient.get(`/api/v1/subjects/${subjectId}/chapters`).then(r => r.data);

// --- Chapters ---
export const getChapters = (subjectId?: string) =>
    apiClient.get<ChapterListResponse>("/api/v1/chapters/", { params: { subject_id: subjectId } }).then(r => r.data);
export const createChapter = (name: string, subjectId: string) =>
    apiClient.post<ChapterItem>("/api/v1/chapters/", { name, subject_id: subjectId }).then(r => r.data);
export const deleteChapter = (id: string) => apiClient.delete(`/api/v1/chapters/${id}`);

// --- Topics ---
export const getTopics = (chapterId?: string) =>
    apiClient.get<TopicListResponse>("/api/v1/topics/", { params: { chapter_id: chapterId } }).then(r => r.data);
export const createTopic = (name: string, chapterId: string) =>
    apiClient.post<TopicItem>("/api/v1/topics/", { name, chapter_id: chapterId }).then(r => r.data);
export const deleteTopic = (id: string) => apiClient.delete(`/api/v1/topics/${id}`);
