import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getStatusBadgeVariant } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  status?: string;
}

function Badge({ className, variant, status, ...props }: BadgeProps) {
  const resolvedVariant = status ? getStatusBadgeVariant(status) : variant;
  return <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props} />;
}

export { Badge, badgeVariants };
