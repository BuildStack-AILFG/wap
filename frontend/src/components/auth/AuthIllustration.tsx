import {
  BarChart3,
  Megaphone,
  Target,
  Mail,
  Bot,
  Filter,
  Smartphone,
  MessageCircle,
  CheckCircle2,
  Users,
  TrendingUp,
  Clock,
  ThumbsUp,
  Send,
  Star,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Badge = {
  Icon: LucideIcon;
  top: string;
  left: string;
  size: number;
  rotate: number;
  variant?: "solid";
};

const badges: Badge[] = [
  { Icon: BarChart3, top: "3%", left: "40%", size: 56, rotate: -6 },
  { Icon: Megaphone, top: "8%", left: "66%", size: 58, rotate: 10, variant: "solid" },
  { Icon: Target, top: "2%", left: "16%", size: 48, rotate: 6 },
  { Icon: Mail, top: "22%", left: "3%", size: 56, rotate: -8 },
  { Icon: Bot, top: "16%", left: "88%", size: 62, rotate: 6, variant: "solid" },
  { Icon: Filter, top: "40%", left: "0%", size: 50, rotate: 10 },
  { Icon: Smartphone, top: "38%", left: "94%", size: 54, rotate: -8 },
  { Icon: MessageCircle, top: "58%", left: "2%", size: 54, rotate: -6, variant: "solid" },
  { Icon: CheckCircle2, top: "54%", left: "92%", size: 58, rotate: 4, variant: "solid" },
  { Icon: Users, top: "72%", left: "10%", size: 54, rotate: 6 },
  { Icon: TrendingUp, top: "70%", left: "86%", size: 50, rotate: -6 },
  { Icon: Clock, top: "88%", left: "26%", size: 46, rotate: 8 },
  { Icon: ThumbsUp, top: "90%", left: "68%", size: 50, rotate: -8 },
  { Icon: Send, top: "98%", left: "46%", size: 52, rotate: -12 },
];

const accents = [
  { Icon: Star, top: "13%", left: "50%", size: 18 },
  { Icon: Sparkles, top: "64%", left: "50%", size: 20 },
  { Icon: Zap, top: "46%", left: "14%", size: 18 },
];

export default function AuthIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[540px] select-none">
      <div className="absolute inset-[8%] rounded-full border-2 border-dashed border-white/10" />
      <div className="absolute inset-[20%] rounded-full border-2 border-dashed border-white/[0.06]" />

      {badges.map(({ Icon, top, left, size, rotate, variant }, i) => (
        <div
          key={i}
          className={`absolute grid place-items-center rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.4)] ${
            variant === "solid"
              ? "bg-brand text-white"
              : "border-2 border-white/10 bg-white/[0.04] text-brand backdrop-blur-xl"
          }`}
          style={{
            top,
            left,
            width: size,
            height: size,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          }}
        >
          <Icon className="h-[46%] w-[46%]" strokeWidth={2} />
        </div>
      ))}

      {accents.map(({ Icon, top, left, size }, i) => (
        <Icon
          key={i}
          className="absolute text-brand"
          style={{ top, left, width: size, height: size, transform: "translate(-50%, -50%)" }}
          strokeWidth={2.5}
        />
      ))}

      <div className="absolute left-1/2 top-1/2 w-[94%] -translate-x-1/2 -translate-y-1/2 text-center">
        <p
          className="font-sans font-extrabold leading-[0.95] tracking-tight text-white"
          style={{ fontSize: "clamp(2rem, 6.4vw, 3.75rem)", wordBreak: "break-word" }}
        >
          LeadForGrow
        </p>
      </div>
    </div>
  );
}
