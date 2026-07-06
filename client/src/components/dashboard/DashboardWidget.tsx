import React from 'react';
import { cn } from '../../lib/utils';

interface WidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  colSpan?: string;
}

export function DashboardWidget({ children, colSpan = "col-span-12", className, ...props }: WidgetProps) {
  return (
    <div 
      className={cn(
        "bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm flex flex-col justify-between overflow-hidden relative transition-all duration-300 hover:border-gray-200", 
        colSpan, 
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
