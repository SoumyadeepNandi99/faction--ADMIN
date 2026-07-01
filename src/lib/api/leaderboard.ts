import { apiClient } from "@/lib/axios";

export interface TopPerformerUser {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    metric_value: number;
    metric_type: string;
}

export interface TopPerformersResponse {
    best_rating?: { user: any; metric_value: number; metric_type: string } | null;
    best_delta?: { user: any; metric_value: number; metric_type: string } | null;
    best_questions?: { user: any; metric_value: number; metric_type: string } | null;
}

export interface ArenaRankingUser {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    questions_solved: number;
}

export interface ArenaRankingResponse {
    users: ArenaRankingUser[];
    total: number;
    skip: number;
    limit: number;
    current_user_rank?: number | null;
}

export interface RatingRankingUser {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    current_rating: number;
    max_rating: number;
    title: string;
}

export interface RatingRankingResponse {
    users: RatingRankingUser[];
    total: number;
    skip: number;
    limit: number;
    current_user_rank?: number | null;
}

export const getTopPerformers = () =>
    apiClient.get<TopPerformersResponse>("/api/v1/leaderboard/top-performers").then(r => r.data);

export const getArenaRanking = (params?: { skip?: number; limit?: number; time_filter?: string; exam_type?: string }) =>
    apiClient.get<ArenaRankingResponse>("/api/v1/arena-ranking/", { params }).then(r => r.data);

export const getRatingRanking = (params?: { skip?: number; limit?: number; exam_type?: string }) =>
    apiClient.get<RatingRankingResponse>("/api/v1/rating-ranking/", { params }).then(r => r.data);

export const getStreakRanking = (params?: { skip?: number; limit?: number; exam_type?: string }) =>
    apiClient.get("/api/v1/streak-ranking/", { params }).then(r => r.data);

export const getContestRankingLatest = (params?: { skip?: number; limit?: number }) =>
    apiClient.get("/api/v1/contest-ranking/", { params }).then(r => r.data);
