import type { SocialPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Globe, Share2 } from "lucide-react";
import type { ReactNode } from "react";

const platformMeta: Record<
  SocialPlatform,
  { label: string; className: string; iconClassName?: string }
> = {
  instagram: {
    label: "اینستاگرام",
    className: "bg-white text-foreground border border-border/60",
  },
  telegram: {
    label: "تلگرام",
    className: "bg-[#229ED9] text-white",
  },
  x: {
    label: "ایکس",
    className: "bg-black text-white",
  },
  youtube: {
    label: "یوتیوب",
    className: "bg-[#FF0000] text-white",
  },
  aparat: {
    label: "آپارات",
    className: "bg-white text-foreground border border-border/60",
  },
  linkedin: {
    label: "لینکدین",
    className: "bg-[#0A66C2] text-white",
  },
  rubika: {
    label: "روبیکا",
    className: "bg-white text-foreground border border-border/60",
  },
  eitaa: {
    label: "ایتا",
    className: "bg-white text-foreground border border-border/60",
  },
  soroush: {
    label: "سروش",
    className: "bg-white text-foreground border border-border/60",
  },
  bale: {
    label: "بله",
    className: "bg-white text-foreground border border-border/60",
  },
  other: {
    label: "سایر",
    className: "bg-muted text-foreground",
  },
};

const platformLogoSrc: Partial<Record<SocialPlatform, string>> = {
  instagram: "/images/social/instagram.svg",
  aparat: "/images/social/aparat.jpg",
  rubika: "/images/social/rubika.jpg",
  eitaa: "/images/social/eitaa.svg",
  soroush: "/images/social/soroush.jpg",
  bale: "/images/social/bale.svg",
};

function IconSvg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn("h-[55%] w-[55%]", className)}
    >
      {children}
    </svg>
  );
}

function PlatformBrandIcon({ platform }: { platform: SocialPlatform }) {
  const logoSrc = platformLogoSrc[platform];
  if (logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoSrc}
        alt=""
        className="h-[78%] w-[78%] object-contain"
        draggable={false}
      />
    );
  }

  switch (platform) {
    case "telegram":
      return (
        <IconSvg>
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </IconSvg>
      );
    case "x":
      return (
        <IconSvg>
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </IconSvg>
      );
    case "youtube":
      return (
        <IconSvg>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </IconSvg>
      );
    case "linkedin":
      return (
        <IconSvg>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </IconSvg>
      );
    case "other":
    default:
      return <Share2 className="h-[45%] w-[45%]" />;
  }
}

interface SocialPlatformIconProps {
  platform: SocialPlatform;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SocialPlatformIcon({ platform, className, size = "md" }: SocialPlatformIconProps) {
  const style = platformMeta[platform] ?? platformMeta.other;
  const sizeClass =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl overflow-hidden",
        sizeClass,
        style.className,
        className
      )}
      aria-hidden
    >
      <PlatformBrandIcon platform={platform in platformMeta ? platform : "other"} />
    </div>
  );
}

export function getSocialPlatformLabel(platform: SocialPlatform): string {
  return (platformMeta[platform] ?? platformMeta.other).label;
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
