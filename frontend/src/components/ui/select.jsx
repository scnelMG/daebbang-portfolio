import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export function SelectTrigger({ className, children, ...props }) {
  return <SelectPrimitive.Trigger className={cn('ui-select-trigger', className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown aria-hidden="true" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}
export function SelectContent({ className, children, ...props }) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position="popper" sideOffset={6} className={cn('ui-select-content', className)} {...props}>
    <SelectPrimitive.ScrollUpButton className="ui-select-scroll"><ChevronUp /></SelectPrimitive.ScrollUpButton>
    <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    <SelectPrimitive.ScrollDownButton className="ui-select-scroll"><ChevronDown /></SelectPrimitive.ScrollDownButton>
  </SelectPrimitive.Content></SelectPrimitive.Portal>;
}
export function SelectItem({ className, children, ...props }) {
  return <SelectPrimitive.Item className={cn('ui-select-item', className)} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator><Check aria-hidden="true" /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>;
}
