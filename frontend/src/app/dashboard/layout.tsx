import type { Metadata } from "next";
import AuthGuard from "@/components/dashboard/AuthGuard";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";

export const metadata: Metadata = {
  title: "Dashboard — LeadForGrow",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
