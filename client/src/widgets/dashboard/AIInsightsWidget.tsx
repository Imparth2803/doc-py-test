import React from 'react';
import { AlertCircle, ShieldAlert, Sparkles, FileWarning, EyeOff, Table } from 'lucide-react';
import { AIInsight } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface AIInsightsWidgetProps {
  insights: AIInsight[];
}

export function AIInsightsWidget({ insights }: AIInsightsWidgetProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'ocr-failure':
        return <FileWarning className="w-4 h-4 text-red-500" />;
      case 'ai-failure':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'low-confidence':
        return <ShieldAlert className="w-4 h-4 text-orange-500" />;
      case 'no-preview':
        return <EyeOff className="w-4 h-4 text-yellow-500" />;
      case 'no-tables':
        return <Table className="w-4 h-4 text-gray-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="Attention Required" 
        subtitle="AI insights and observations needing review"
        icon={<AlertCircle className="text-red-500 w-5 h-5" />}
      />
      <WidgetBody className="mt-2">
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl transition-all hover:bg-white hover:border-gray-200"
              >
                <div className="p-2 bg-white rounded-xl shadow-xs">
                  {getIcon(insight.type)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-snug">{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WidgetEmpty 
            message="No attention-required items. Your vault health is perfect!"
            icon={<CheckIcon className="w-10 h-10 text-green-500/20" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
