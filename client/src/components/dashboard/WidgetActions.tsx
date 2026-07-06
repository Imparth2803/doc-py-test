import React from 'react';
import { cn } from '../../lib/utils';

interface ActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function WidgetActions({ children, className, ...props }: ActionsProps) {
  return (
    <div className={cn("mt-6 flex flex-wrap items-center gap-3 w-full", className)} {...props}>
      {children}
    </div>
  );
}
