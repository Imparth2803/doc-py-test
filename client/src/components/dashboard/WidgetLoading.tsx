import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export function WidgetLoading({ message = "Loading widget...", className, ...props }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center w-full", className)} {...props}>
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
      <p className="text-sm text-gray-400 font-medium">{message}</p>
    </div>
  );
}
