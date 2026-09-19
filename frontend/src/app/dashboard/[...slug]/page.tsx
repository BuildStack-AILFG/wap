import { Construction } from "lucide-react";
import { findNavItemByHref } from "@/components/dashboard/navConfig";

export default async function DashboardComingSoonPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const href = `/dashboard/${slug.join("/")}`;
  const item = findNavItemByHref(href);
  const title = item?.label ?? "This page";
  const Icon = item?.icon ?? Construction;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "#00926B26", color: "#00926B" }}>
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[20px] font-bold text-white">{title} is coming soon</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/50">
        This part of the dashboard is on the roadmap and isn&apos;t built yet. The nav item is
        here so you can see the full shape of the product as it comes together.
      </p>
    </div>
  );
}
