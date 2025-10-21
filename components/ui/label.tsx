import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...props },
  ref
) {
  return <label ref={ref} className={cn('text-sm font-medium text-slate-700', className)} {...props} />;
});

Label.displayName = 'Label';

export { Label };
