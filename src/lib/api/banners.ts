import { apiClient } from "@/lib/axios";

export interface Banner {
    id: string;
    image_url: string;
    title?: string | null;
    is_active: boolean;
    order: number;
    created_at: string;
    updated_at: string;
}

export interface BannerListResponse {
    banners: Banner[];
    total: number;
}

export const getBanners = (params?: { active_only?: boolean }) =>
    apiClient.get<BannerListResponse>("/api/v1/banners/", { params }).then(r => r.data);

// POST /api/v1/banners/ — multipart image upload (server pushes to Cloudinary).
export const createBanner = (data: { image: File; title?: string; order?: number }) => {
    const fd = new FormData();
    fd.append("image", data.image);
    if (data.title) fd.append("title", data.title);
    fd.append("order", String(data.order ?? 0));
    return apiClient
        .post<Banner>("/api/v1/banners/", fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

// PATCH /api/v1/banners/{id} — update metadata (title, order, is_active) as JSON.
export const updateBanner = (
    id: string,
    data: { title?: string | null; order?: number; is_active?: boolean }
) => apiClient.patch<Banner>(`/api/v1/banners/${id}`, data).then(r => r.data);

// PATCH /api/v1/banners/{id}/image — replace the banner image.
export const updateBannerImage = (id: string, image: File) => {
    const fd = new FormData();
    fd.append("image", image);
    return apiClient
        .patch<Banner>(`/api/v1/banners/${id}/image`, fd, { headers: { "Content-Type": undefined } })
        .then(r => r.data);
};

export const deleteBanner = (id: string) => apiClient.delete(`/api/v1/banners/${id}`);
