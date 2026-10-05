import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

export function Avatar({ className, ...props }) { return <AvatarPrimitive.Root className={cn('ui-avatar', className)} {...props} />; }
export function AvatarImage({ className, ...props }) { return <AvatarPrimitive.Image className={cn('ui-avatar-image', className)} {...props} />; }
export function AvatarFallback({ className, ...props }) { return <AvatarPrimitive.Fallback className={cn('ui-avatar-fallback', className)} {...props} />; }
