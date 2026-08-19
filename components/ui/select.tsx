import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { announceExclusiveDropdown, EXCLUSIVE_DROPDOWN_EVENT } from "@/lib/exclusive-dropdown";
import { cn } from "@/lib/utils";

type SelectRootProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & {
  /** Radix Select supports this at runtime; types in this version omit it. */
  modal?: boolean;
};

function Select({
  modal = false,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: SelectRootProps) {
  const id = React.useId();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next) announceExclusiveDropdown(id);
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [id, isControlled, onOpenChange]
  );

  React.useEffect(() => {
    if (!open) return;
    const onOther = (event: Event) => {
      const otherId = (event as CustomEvent<string>).detail;
      if (otherId === id) return;
      handleOpenChange(false);
    };
    window.addEventListener(EXCLUSIVE_DROPDOWN_EVENT, onOther);
    return () => window.removeEventListener(EXCLUSIVE_DROPDOWN_EVENT, onOther);
  }, [open, id, handleOpenChange]);

  return (
    <SelectPrimitive.Root
      {...({ modal, open, onOpenChange: handleOpenChange, ...props } as React.ComponentPropsWithoutRef<
        typeof SelectPrimitive.Root
      >)}
    />
  );
}

const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-[200] max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      collisionPadding={8}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-[min(18rem,var(--radix-select-content-available-height))] overflow-y-auto p-1",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-start border-b border-border/70 py-2.5 pr-9 pl-3 text-sm outline-none last:border-b-0 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2.5 top-3 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText className="whitespace-normal break-words text-right text-[13px] font-medium leading-relaxed">
      {children}
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
