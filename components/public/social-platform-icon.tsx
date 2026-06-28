import type { SocialPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Globe, Share2 } from "lucide-react";

const platformStyles: Record<
  SocialPlatform,
  { label: string; className: string; glyph: string }
> = {
  instagram: {
    label: "اینستاگرام",
    className: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
    glyph: "IG",
  },
  telegram: {
    label: "تلگرام",
    className: "bg-[#229ED9] text-white",
    glyph: "TG",
  },
  x: {
    label: "ایکس",
    className: "bg-black text-white",
    glyph: "X",
  },
  youtube: {
    label: "یوتیوب",
    className: "bg-[#FF0000] text-white",
    glyph: "YT",
  },
  aparat: {
    label: "آپارات",
    className: "bg-[#EA1D5D] text-white",
    glyph: "AP",
  },
  linkedin: {
    label: "لینکدین",
    className: "bg-[#0A66C2] text-white",
    glyph: "IN",
  },
  rubika: {
    label: "روبیکا",
    className: "bg-[#7B2FF7] text-white",
    glyph: "RB",
  },
  eitaa: {
    label: "ایتا",
    className: "bg-[#F58220] text-white",
    glyph: "ET",
  },
  bale: {
    label: "بله",
    className: "bg-[#21C063] text-white",
    glyph: "BL",
  },
  other: {
    label: "سایر",
    className: "bg-muted text-foreground",
    glyph: "••",
  },
};

interface SocialPlatformIconProps {
  platform: SocialPlatform;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SocialPlatformIcon({ platform, className, size = "md" }: SocialPlatformIconProps) {
  const style = platformStyles[platform];
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-bold",
        sizeClass,
        style.className,
        className
      )}
      aria-hidden
    >
      {platform === "other" ? <Share2 className="h-4 w-4" /> : style.glyph}
    </div>
  );
}

export function getSocialPlatformLabel(platform: SocialPlatform): string {
  return platformStyles[platform].label;
}

export function SocialPlatformFallbackIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground",
        className
      )}
    >
      <Globe className="h-4 w-4" />
    </div>
  );
}
