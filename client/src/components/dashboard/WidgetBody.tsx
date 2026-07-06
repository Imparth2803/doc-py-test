import React from 'react';
import { cn } from '../../lib/utils';

interface BodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function WidgetBody({ children, className, ...props }: BodyProps) {
  return (
    <div className={cn("flex-1 w-full", className)} {...props}>
      {children}
    </div>
  );
}
