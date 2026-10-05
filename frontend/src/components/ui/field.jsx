import { cn } from '@/lib/utils';

// shadcn Field composition, adapted to this project's CSS-based primitives.
export function FieldGroup({ className, ...props }) { return <div className={cn('ui-field-group', className)} {...props} />; }
export function Field({ className, ...props }) { return <div role="group" className={cn('ui-field', className)} {...props} />; }
export function FieldLabel({ className, ...props }) { return <label className={cn('ui-field-label', className)} {...props} />; }
export function FieldDescription({ className, ...props }) { return <p className={cn('ui-field-description', className)} {...props} />; }
export function FieldError({ children, ...props }) { return children ? <p role="alert" className="ui-field-error" {...props}>{children}</p> : null; }
export function FieldSet(props) { return <fieldset className="ui-field-set" {...props} />; }
export function FieldLegend(props) { return <legend className="ui-field-label" {...props} />; }
