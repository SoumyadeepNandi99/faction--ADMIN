"use client";

import { Users, BookOpen, MessageSquare, Trophy, TrendingUp, RefreshCw } from "lucide-react";
import React from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/axios";
import Link from "next/link";
import { UserGrowthChart } from "@/components/dashboard/user-growth-chart";

interface Stats {
  userCount: number;
  questionCount: number;
  doubtCount: number;
  topPerformer: { user_name: string; metric_value: number } | null;
}

async function fetchDashboardStats(): Promise<Stats> {
  const [usersRes, questionsRes, doubtsRes, topRes] = await Promise.allSettled([
    apiClient.get("/api/v1/users/"),
    apiClient.get("/api/v1/questions/?limit=1"),
    apiClient.get("/api/v1/doubt-forum/posts?limit=1"),
    apiClient.get("/api/v1/leaderboard/top-performers"),
  ]);

  const users = usersRes.status === "fulfilled" ? usersRes.value.data : null;
  const questions = questionsRes.status === "fulfilled" ? questionsRes.value.data : { questions: [], total: 0 };
  const doubts = doubtsRes.status === "fulfilled" ? doubtsRes.value.data : { posts: [], total: 0 };
  const top = topRes.status === "fulfilled" ? topRes.value.data : null;

  console.log("Dashboard Stats - Users:", users);
  console.log("Dashboard Stats - Questions:", questions);
  console.log("Dashboard Stats - Doubts:", doubts);
  console.log("Dashboard Stats - Top Performer:", top);

  return {
    userCount: users?.total ?? users?.count ?? (Array.isArray(users) ? users.length : 0),
    questionCount: questions.total || (questions.questions?.length ?? 0),
    doubtCount: doubts.total || (doubts.posts?.length ?? 0),
    topPerformer: top?.best_questions?.user
      ? { user_name: top.best_questions.user.name || "—", metric_value: top.best_questions.metric_value }
      : null,
  };
}

export default function Home() {
  const { data: stats, error, isLoading: loading, mutate } = useSWR("dashboard-stats", fetchDashboardStats, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back, Admin</h1>
          <p className="text-muted-foreground">Here is the overview of the Faction Digital ecosystem today.</p>
        </div>

        {/* Total-users growth chart (investor-shareable) */}
        <UserGrowthChart />

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card p-6 flex flex-col gap-4">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 rounded mb-2" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-destructive/50" />
            <h3 className="text-lg font-bold text-foreground">Failed to Load Stats</h3>
            <p className="text-muted-foreground text-sm">Could not fetch dashboard data from the server.</p>
            <button onClick={() => mutate()}
              className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={stats?.userCount?.toLocaleString() || "—"}
              sub="Registered on platform"
              icon={<Users className="w-5 h-5 text-brand-400" />}
            />
            <StatCard
              title="Questions Banked"
              value={stats?.questionCount?.toLocaleString() || "—"}
              sub="In question bank"
              icon={<BookOpen className="w-5 h-5 text-accent-blue" />}
            />
            <StatCard
              title="Doubts Posted"
              value={stats?.doubtCount?.toLocaleString() || "—"}
              sub="In doubt forum"
              icon={<MessageSquare className="w-5 h-5 text-accent-pink" />}
            />
            <StatCard
              title="Top Performer"
              value={stats?.topPerformer?.user_name || "—"}
              sub={stats?.topPerformer ? `${stats.topPerformer.metric_value} questions solved` : "No data yet"}
              icon={<Trophy className="w-5 h-5 text-accent-purple" />}
            />
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Manage Users", href: "/users", desc: "View, search, and moderate accounts", color: "from-brand-600/20 to-brand-500/5" },
              { title: "Add Question", href: "/content/create", desc: "Author a new question to the question bank", color: "from-accent-blue/20 to-accent-blue/5" },
              { title: "Send Broadcast", href: "/broadcasts", desc: "Dispatch push notifications to students", color: "from-accent-purple/20 to-accent-purple/5" },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className={`glass-card p-6 flex flex-col gap-2 bg-linear-to-br ${item.color} group hover:scale-[1.02] transition-all`}>
                <div className="flex items-start justify-between">
                  <span className="text-foreground font-semibold group-hover:text-brand-500 transition-colors">{item.title}</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-brand-400 transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, sub, icon }: { title: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-2 relative overflow-hidden group">
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl group-hover:bg-brand-500/20 transition-colors" />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-medium text-sm">{title}</span>
        <div className="p-2 bg-foreground/5 rounded-lg border border-(--card-border)">{icon}</div>
      </div>
      <h2 className="text-2xl font-bold text-foreground tracking-tight truncate mt-1">{value}</h2>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
