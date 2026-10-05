import { cn } from '@/lib/utils';

export function Empty({ className, ...props }) { return <div className={cn('ui-empty', className)} {...props} />; }
export function EmptyHeader({ className, ...props }) { return <div className={cn('ui-empty-header', className)} {...props} />; }
export function EmptyTitle({ className, ...props }) { return <h2 className={cn('ui-empty-title', className)} {...props} />; }
export function EmptyDescription({ className, ...props }) { return <p className={cn('ui-empty-description', className)} {...props} />; }
export function EmptyContent({ className, ...props }) { return <div className={cn('ui-empty-content', className)} {...props} />; }
