import { Flame, Snowflake, Sun } from "lucide-react";
import { Badge } from "@/components/ui/kit";
import type { LeadScore } from "@/lib/api";

const LOOK: Record<LeadScore, { tone: "red" | "yellow" | "blue"; label: string; Icon: typeof Flame }> = {
  hot: { tone: "red", label: "Hot", Icon: Flame },
  warm: { tone: "yellow", label: "Warm", Icon: Sun },
  cold: { tone: "blue", label: "Cold", Icon: Snowflake },
};

/** AI lead score chip; the reason (what the customer said) shows on hover. Renders nothing for unscored contacts. */
export default function LeadScoreBadge({ score, reason, className }: { score: LeadScore | null | undefined; reason?: string | null; className?: string }) {
  if (!score) return null;
  const { tone, label, Icon } = LOOK[score];
  return (
    <span title={reason ? `AI: ${reason}` : `AI lead score: ${label}`} className={className}>
      <Badge tone={tone}><Icon size={11} /> {label}</Badge>
    </span>
  );
}
