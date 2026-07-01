import { apiClient } from "@/lib/axios";

export interface Note {
    id: string;
    chapter_id: string;
    subject_id: string;
    file_name: string;
    file_id: string;
    web_view_link: string;
    web_content_link?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface NotesListResponse {
    notes: Note[];
    total: number;
    class_id: string;
    subject_id?: string | null;
    chapter_id?: string | null;
}

export const getNotes = (params: { class_id: string; subject_id?: string; chapter_id?: string; sort_order?: string }) =>
    apiClient.get<NotesListResponse>("/api/v1/notes/", { params }).then(r => r.data);

export const uploadNote = (data: { chapter_id: string; subject_id: string; pdf_file: File }) => {
    const fd = new FormData();
    fd.append("chapter_id", data.chapter_id);
    fd.append("subject_id", data.subject_id);
    fd.append("pdf_file", data.pdf_file);
    return apiClient
        .post<Note>("/api/v1/notes/", fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

export const deleteNote = (id: string) => apiClient.delete(`/api/v1/notes/${id}`);
