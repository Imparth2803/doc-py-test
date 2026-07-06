import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

interface ErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  onRetry?: () => void;
}

export function WidgetError({ message = "An error occurred loading this widget", onRetry, className, ...props }: ErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center w-full text-red-500", className)} {...props}>
      <AlertCircle className="w-8 h-8 mb-3" />
      <p className="text-sm font-semibold">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry} 
          className="mt-3 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
