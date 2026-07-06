import { Document } from '../types';
import { RECOMMENDED_DOCS } from '../constants';

export interface DashboardSearchState {
  query: string;
  results: Document[];
  isSearching: boolean;
}

export interface ProcessingSummary {
  processing: Document[];
  completedCount: number;
  failedCount: number;
}

export interface DashboardWidgetProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  colSpan?: string;
  className?: string;
}
