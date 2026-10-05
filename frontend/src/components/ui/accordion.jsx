import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;
export function AccordionItem({ className, ...props }) {
  return <AccordionPrimitive.Item className={cn('ui-accordion-item', className)} {...props} />;
}
export function AccordionTrigger({ className, children, ...props }) {
  return <AccordionPrimitive.Header className="ui-accordion-heading"><AccordionPrimitive.Trigger className={cn('ui-accordion-trigger', className)} {...props}>
    {children}<span className="ui-accordion-indicator" aria-hidden="true"><Plus className="when-closed" /><Minus className="when-open" /></span>
  </AccordionPrimitive.Trigger></AccordionPrimitive.Header>;
}
export function AccordionContent({ className, children, ...props }) {
  return <AccordionPrimitive.Content className="ui-accordion-content" {...props}><div className={cn('ui-accordion-inner', className)}>{children}</div></AccordionPrimitive.Content>;
}
