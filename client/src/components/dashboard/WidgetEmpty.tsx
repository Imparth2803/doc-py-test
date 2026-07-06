import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  icon?: React.ReactNode;
}

export function WidgetEmpty({ message = "No data available", icon, className, ...props }: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center w-full", className)} {...props}>
      {icon && <div className="text-gray-300 mb-3">{icon}</div>}
      <p className="text-sm text-gray-400 font-medium">{message}</p>
    </div>
  );
}
