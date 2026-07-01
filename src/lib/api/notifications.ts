import { apiClient } from "@/lib/axios";

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    data?: string | null;
}

export interface NotificationListResponse {
    notifications: Notification[];
    total: number;
    skip: number;
    limit: number;
}

export const getNotifications = (params?: { skip?: number; limit?: number; unread_only?: boolean }) =>
    apiClient.get<NotificationListResponse>("/api/v1/notifications/", { params }).then(r => r.data);

export const getUnreadCount = () =>
    apiClient.get("/api/v1/notifications/unread-count").then(r => r.data);

export const adminBroadcast = (title: string, message: string, type = "announcement") =>
    apiClient.post("/api/v1/notifications/admin/broadcast", { title, message, type }).then(r => r.data);

export const adminSendToUsers = (userIds: string[], title: string, message: string, type = "info") =>
    apiClient.post("/api/v1/notifications/admin/send", { user_ids: userIds, title, message, type }).then(r => r.data);

export const markAllRead = () =>
    apiClient.patch("/api/v1/notifications/read-all");

export const deleteNotification = (id: string) =>
    apiClient.delete(`/api/v1/notifications/${id}`);
