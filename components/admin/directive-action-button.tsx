"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  resolveDirectiveActionHref,
  resolveDirectiveActionLabel,
} from "@/lib/directive-cta";
import type { CampaignDirective } from "@/lib/types";

interface DirectiveActionButtonProps {
  item: CampaignDirective;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  /**
   * Open destination in a new tab (needed inside the mandatory ack overlay,
   * where in-app Link navigation is hidden behind the gate).
   */
  openInNewTab?: boolean;
}

export function DirectiveActionButton({
  item,
  className,
  size = "default",
  variant = "default",
  openInNewTab = false,
}: DirectiveActionButtonProps) {
  const label = resolveDirectiveActionLabel({
    actionType: item.actionType,
    actionLabel: item.actionLabel,
    systemAction: item.systemAction,
  });
  const resolved = resolveDirectiveActionHref({
    actionType: item.actionType,
    actionUrl: item.actionUrl,
    systemAction: item.systemAction,
    campaignId: item.campaignId,
  });

  if (!label || !resolved) return null;

  if (resolved.external || openInNewTab) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <a href={resolved.href} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          {label}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href={resolved.href}>{label}</Link>
    </Button>
  );
}
