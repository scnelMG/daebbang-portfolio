import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({ className, children, tabIndex = 0, ...props }) {
  return (
    <ScrollAreaPrimitive.Root className={cn("ui-scroll-area", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="ui-scroll-area__viewport" tabIndex={tabIndex} role="region" aria-label={props['aria-label']}>{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar className="ui-scroll-area__bar" orientation="vertical">
        <ScrollAreaPrimitive.Thumb className="ui-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
