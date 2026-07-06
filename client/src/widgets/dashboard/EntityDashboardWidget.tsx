import React from 'react';
import { Users, User, Building } from 'lucide-react';
import { EntityDashboardStats } from '../../utils/dashboardUtils';
import { DashboardWidget } from '../../components/dashboard/DashboardWidget';
import { WidgetHeader } from '../../components/dashboard/WidgetHeader';
import { WidgetBody } from '../../components/dashboard/WidgetBody';
import { WidgetEmpty } from '../../components/dashboard/WidgetEmpty';

interface EntityDashboardWidgetProps {
  entityStats: EntityDashboardStats;
  onViewAllEntities: (entityName?: string) => void;
}

export function EntityDashboardWidget({ 
  entityStats, 
  onViewAllEntities 
}: EntityDashboardWidgetProps) {
  const hasEntities = entityStats.people.length > 0 || entityStats.organisations.length > 0;

  return (
    <DashboardWidget className="p-6 w-full h-full">
      <WidgetHeader 
        title="GLiNER Entities" 
        subtitle="Top extracted entities sorted by occurrence frequency"
        icon={<Users className="text-orange-500 w-5 h-5" />}
        actions={
          <button 
            onClick={() => onViewAllEntities()}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline uppercase tracking-wider"
          >
            Manage Entities
          </button>
        }
      />
      <WidgetBody className="mt-2">
        {hasEntities ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top People */}
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
                <User className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Top People</h4>
              </div>
              <div className="space-y-2">
                {entityStats.people.length > 0 ? entityStats.people.map((p, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onViewAllEntities(p.name)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white border border-gray-100 hover:border-gray-200 transition-all cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-gray-900 truncate pr-2 group-hover:text-blue-600 transition-colors">{p.name}</span>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{p.count} docs</span>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 text-center py-4">No people entities found.</p>
                )}
              </div>
            </div>

            {/* Top Organisations */}
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
                <Building className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Top Organisations</h4>
              </div>
              <div className="space-y-2">
                {entityStats.organisations.length > 0 ? entityStats.organisations.map((org, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onViewAllEntities(org.name)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white border border-gray-100 hover:border-gray-200 transition-all cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-gray-900 truncate pr-2 group-hover:text-purple-600 transition-colors">{org.name}</span>
                    <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">{org.count} docs</span>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 text-center py-4">No organisations found.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <WidgetEmpty 
            message="No extracted entities available. Document mapping is pending."
            icon={<Users className="w-10 h-10 text-gray-200" />}
          />
        )}
      </WidgetBody>
    </DashboardWidget>
  );
}
