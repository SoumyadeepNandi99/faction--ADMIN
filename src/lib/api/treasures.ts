import { apiClient } from "@/lib/axios";

export interface Treasure {
    id: string;
    chapter_id: string;
    subject_id: string;
    image_url: string;
    title?: string | null;
    description?: string | null;
    is_active: boolean;
    order: number;
    created_at: string;
    updated_at: string;
}

export interface TreasureListResponse {
    treasures: Treasure[];
    total: number;
    subject_id?: string | null;
    chapter_id?: string | null;
}

export const getTreasures = (params: { class_id?: string; subject_id?: string; chapter_id?: string; sort_order?: string }) =>
    apiClient.get<TreasureListResponse>("/api/v1/treasures/", { params }).then(r => r.data);

export const createTreasure = (data: {
    chapter_id: string;
    subject_id: string;
    mindmap_image: File;
    title?: string;
    description?: string;
    order?: number;
}) => {
    const fd = new FormData();
    fd.append("chapter_id", data.chapter_id);
    fd.append("subject_id", data.subject_id);
    fd.append("mindmap_image", data.mindmap_image);
    if (data.title) fd.append("title", data.title);
    if (data.description) fd.append("description", data.description);
    fd.append("order", String(data.order ?? 0));
    return apiClient
        .post<Treasure>("/api/v1/treasures/", fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

export const deleteTreasure = (id: string) => apiClient.delete(`/api/v1/treasures/${id}`);
