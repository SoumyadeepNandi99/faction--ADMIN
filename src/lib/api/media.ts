import { apiClient } from "@/lib/axios";

export interface YouTubeVideo {
    id: string;
    youtube_url: string;
    youtube_video_id?: string | null;
    title?: string | null;
    description?: string | null;
    thumbnail?: string | null;
    duration?: number | null;
    chapter_id: string;
    subject_id: string;
    created_at?: string;
}

export interface YouTubeVideoListResponse { videos: YouTubeVideo[]; total: number; }

export interface Badge {
    id: string;
    name: string;
    description: string;
    category: "streak" | "practice_arena";
    icon_url?: string | null;
    inactive_icon_url?: string | null;
    requirement_value?: number | null;
    requirement_description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    is_earned?: boolean;
    progress?: number;
}

export interface BadgeListResponse { badges: Badge[]; total: number; }

// YouTube Videos
export const getVideos = (params?: { subject_id?: string; chapter_id?: string }) =>
    apiClient.get<YouTubeVideoListResponse>("/api/v1/youtube-videos/", { params }).then(r => r.data);

export const createVideo = (data: { youtube_url: string; chapter_id: string; subject_id: string }) =>
    apiClient.post<YouTubeVideo>("/api/v1/youtube-videos/", data).then(r => r.data);

export const updateVideo = (id: string, data: Partial<YouTubeVideo>) =>
    apiClient.put<YouTubeVideo>(`/api/v1/youtube-videos/${id}`, data).then(r => r.data);

export const deleteVideo = (id: string) =>
    apiClient.delete(`/api/v1/youtube-videos/${id}`);

// Badges
export interface CreateBadgeInput {
    name: string;
    description: string;
    category: Badge["category"];
    icon_image: File;                    // active icon — required by backend
    inactive_icon_image?: File | null;   // grey/inactive icon — optional
    requirement_description: string;
    requirement_value?: number | null;
    is_active?: boolean;
}

export const getBadges = () =>
    apiClient.get<BadgeListResponse>("/api/v1/badges/").then(r => r.data);

// POST /api/v1/badges/ — multipart upload (server pushes images to Cloudinary).
// Setting Content-Type to undefined lets the browser add the multipart boundary.
export const createBadge = (data: CreateBadgeInput) => {
    const fd = new FormData();
    fd.append("name", data.name);
    fd.append("description", data.description);
    fd.append("category", data.category);
    fd.append("icon_image", data.icon_image);
    if (data.inactive_icon_image) fd.append("inactive_icon_image", data.inactive_icon_image);
    fd.append("requirement_description", data.requirement_description);
    if (data.requirement_value != null) fd.append("requirement_value", String(data.requirement_value));
    if (data.is_active != null) fd.append("is_active", String(data.is_active));
    return apiClient
        .post<Badge>("/api/v1/badges/", fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

export interface UpdateBadgeInput {
    name?: string;
    description?: string;
    category?: Badge["category"];
    requirement_value?: number | null;
    requirement_description?: string;
}

// PATCH /api/v1/badges/{id} — update badge metadata (JSON). Icons are handled by the
// dedicated icon endpoints; only the fields sent here are changed.
export const updateBadge = (id: string, data: UpdateBadgeInput) =>
    apiClient.patch<Badge>(`/api/v1/badges/${id}`, data).then(r => r.data);

// PATCH /api/v1/badges/{id}/icon — replaces the active (main) icon of an existing badge.
export const uploadBadgeActiveIcon = (id: string, file: File) => {
    const fd = new FormData();
    fd.append("icon_image", file);
    return apiClient
        .patch<Badge>(`/api/v1/badges/${id}/icon`, fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

// PATCH /api/v1/badges/{id}/inactive-icon — replaces the inactive (grey) icon of an existing badge.
export const uploadBadgeInactiveIcon = (id: string, file: File) => {
    const fd = new FormData();
    fd.append("inactive_icon_image", file);
    return apiClient
        .patch<Badge>(`/api/v1/badges/${id}/inactive-icon`, fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

export const deleteBadge = (id: string) =>
    apiClient.delete(`/api/v1/badges/${id}`);

// POST /api/v1/badges/flush-cache — clears all badge caches (base + per-user). Admin utility (204).
export const flushBadgeCache = () =>
    apiClient.post("/api/v1/badges/flush-cache").then(r => r.data);

export const getUserBadges = (userId: string) =>
    apiClient.get<BadgeListResponse>(`/api/v1/badges/user/${userId}`).then(r => r.data);
