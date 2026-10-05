import React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("ui-input", className)} {...props} />
));
Input.displayName = "Input";
