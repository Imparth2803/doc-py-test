import React from 'react';
import { cn } from '../../lib/utils';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DashboardGrid({ children, className, ...props }: GridProps) {
  return (
    <div 
      className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full", className)} 
      {...props}
    >
      {children}
    </div>
  );
}
