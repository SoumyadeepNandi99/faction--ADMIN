import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
