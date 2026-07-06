import React from 'react';
import { cn } from '../../lib/utils';

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export function WidgetHeader({ title, subtitle, icon, actions, className, ...props }: HeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6 pb-2 border-b border-gray-50", className)} {...props}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-600 shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-bold text-gray-900 leading-snug">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
