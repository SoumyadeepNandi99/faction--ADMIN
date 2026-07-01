"use client";

import { SWRConfig } from "swr";
import { apiClient } from "@/lib/axios";

export function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher: (url: string) => apiClient.get(url).then((res) => res.data),
                revalidateIfStale: false,
                revalidateOnFocus: false,
                revalidateOnReconnect: true,
                dedupingInterval: 120_000,
                errorRetryCount: 2,
                keepPreviousData: true,
            }}
        >
            {children}
        </SWRConfig>
    );
}
