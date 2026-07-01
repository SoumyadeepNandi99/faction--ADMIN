import { apiClient } from "@/lib/axios";

export interface UserProfile {
    id: string;
    name: string;
    phone_number: string;
    email?: string | null;
    role: "STUDENT" | "ADMIN";
    is_active: boolean;
    created_at: string;
    avatar_url?: string | null;
    class_id?: string | null;
    target_exams?: string[];
    school?: string | null;
    state?: string | null;
    city?: string | null;
    batch?: string | null;
}

export interface StreakResponse {
    current_streak: number;
    longest_streak: number;
    last_study_date?: string | null;
}

export interface UserRatingResponse {
    current_rating: number;
    max_rating: number;
    title: string;
}

export interface StudyStatsResponse {
    questions_solved: number;
    total_attempts: number;
    accuracy_rate: number;
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    current_study_streak: number;
    longest_study_streak: number;
}

export const listUsers = (params?: { q?: string; skip?: number; limit?: number }) =>
    apiClient.get<UserProfile[]>("/api/v1/users/", { params }).then(r => r.data);

export const getUserById = (id: string) =>
    apiClient.get<UserProfile>(`/api/v1/users/${id}`).then(r => r.data);

export const deleteUserByPhone = (phone: string) =>
    apiClient.delete(`/api/v1/users/delete/${phone}`);

export const getUserStreak = (userId: string) =>
    apiClient.get<StreakResponse>(`/api/v1/streaks/${userId}`).then(r => r.data);

export const getUserRating = (userId: string) =>
    apiClient.get<UserRatingResponse>(`/api/v1/users/${userId}/rating`).then(r => r.data);

export const getUserBadges = (userId: string) =>
    apiClient.get(`/api/v1/badges/user/${userId}`).then(r => r.data);

export const getUserSolvedCount = (userId: string) =>
    apiClient.get(`/api/v1/attempts/user/${userId}/solved-count`).then(r => r.data);
