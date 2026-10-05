import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button--default",
      outline: "ui-button--outline",
      ghost: "ui-button--ghost",
    },
    size: { default: "ui-button--default-size", sm: "ui-button--sm", icon: "ui-button--icon", round: "ui-button--round", campaign: "ui-button--campaign" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
