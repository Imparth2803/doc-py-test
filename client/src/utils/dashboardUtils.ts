import { Document } from '../types';
import { RECOMMENDED_DOCS } from '../constants';

export function sortRecentDocuments(documents: Document[]): Document[] {
  return [...documents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

export function countProcessingDocuments(documents: Document[]): Document[] {
  return documents.filter(d => d.status === 'PROCESSING' || d.status === 'DECRYPTED');
}

export function calculateCompletion(documents: Document[]): {
  completionRate: number;
  missingDocs: typeof RECOMMENDED_DOCS;
} {
  const isComplete = (docDef: typeof RECOMMENDED_DOCS[0]) => {
    return documents.some(d => {
      const nameText = (d.name || '').toLowerCase();
      const origText = (d.originalName || '').toLowerCase();
      const docTypeText = (d.docType || '').toLowerCase();
      const vaultCatText = (d.vaultCategory || '').toLowerCase();
      const tagsText = (d.tags || []).map(t => t.toLowerCase()).join(' ');

      const combinedText = `${nameText} ${origText} ${docTypeText} ${vaultCatText} ${tagsText}`;

      return docDef.tagsMatch.some(tm => {
        const lowerTm = tm.toLowerCase();
        return combinedText.includes(lowerTm);
      });
    });
  };

  const missingDocs = RECOMMENDED_DOCS.filter(d => !isComplete(d));
  const completionRate = RECOMMENDED_DOCS.length > 0 
    ? Math.round(((RECOMMENDED_DOCS.length - missingDocs.length) / RECOMMENDED_DOCS.length) * 100)
    : 0;

  return { completionRate, missingDocs };
}

export function filterSearch(documents: Document[], query: string): Document[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return documents.filter(d => 
    d.name.toLowerCase().includes(q) ||
    (d.docType && d.docType.toLowerCase().includes(q)) ||
    (d.tags && d.tags.some(t => t.toLowerCase().includes(q))) ||
    (d.entities && d.entities.some(e => e.toLowerCase().includes(q)))
  );
}

export function formatUploadTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ----------------------------------
// Phase 2 AI Analytics Utilities
// ----------------------------------

export interface AIInsight {
  type: string;
  message: string;
  count: number;
}

export function calculateAIInsights(documents: Document[]): AIInsight[] {
  const insights: AIInsight[] = [];
  if (documents.length === 0) return insights;

  // 1. OCR Failures
  const ocrFailures = documents.filter(d => 
    d.status === 'FAILED' && 
    (d.ocrConfidence === undefined || d.ocrConfidence < 0.2)
  ).length;
  if (ocrFailures > 0) {
    insights.push({ type: 'ocr-failure', message: `${ocrFailures} OCR failures`, count: ocrFailures });
  }

  // 2. AI Processing Failures
  const aiFailures = documents.filter(d => d.status === 'FAILED').length;
  if (aiFailures > 0) {
    insights.push({ type: 'ai-failure', message: `${aiFailures} processing failures`, count: aiFailures });
  }

  // 3. Low-Confidence Documents
  const lowConfidence = documents.filter(d => 
    d.ocrConfidence !== undefined && 
    d.ocrConfidence > 0 && 
    d.ocrConfidence < 0.8
  ).length;
  if (lowConfidence > 0) {
    insights.push({ type: 'low-confidence', message: `${lowConfidence} low-confidence documents`, count: lowConfidence });
  }

  // 4. Documents Without Summaries
  const noSummaries = documents.filter(d => 
    d.status === 'COMPLETED' && 
    (!d.metadata || !d.metadata.aiSummary)
  ).length;
  if (noSummaries > 0) {
    insights.push({ type: 'no-summary', message: `${noSummaries} documents without summaries`, count: noSummaries });
  }

  // 5. Documents Without Extracted Entities
  const noEntities = documents.filter(d => 
    d.status === 'COMPLETED' && 
    (!d.entities || d.entities.length === 0)
  ).length;
  if (noEntities > 0) {
    insights.push({ type: 'no-entities', message: `${noEntities} documents without entities`, count: noEntities });
  }

  // 6. Documents Without Preview
  const noPreview = documents.filter(d => !d.previewUrl).length;
  if (noPreview > 0) {
    insights.push({ type: 'no-preview', message: `${noPreview} documents without preview`, count: noPreview });
  }

  // 7. Documents Without Extracted Tables
  const noTables = documents.filter(d => 
    d.status === 'COMPLETED' && 
    (!d.tables || (Array.isArray(d.tables) ? d.tables.length === 0 : !d.tables.tables || d.tables.tables.length === 0))
  ).length;
  if (noTables > 0) {
    insights.push({ type: 'no-tables', message: `${noTables} documents with no tables`, count: noTables });
  }

  return insights;
}

export interface VaultAnalytics {
  documentsCount: number;
  foldersCount: number;
  categoriesCount: number;
  storageUsed: string;
  entitiesCount: number;
  tablesCount: number;
  summariesCount: number;
  aiUnitsUsed: number;
}

export function calculateVaultAnalytics(documents: Document[], aiUnitsUsed: number): VaultAnalytics {
  const folders = new Set(documents.map(d => d.folder).filter(Boolean));
  const categories = new Set(documents.map(d => d.vaultCategory).filter(Boolean));

  let totalBytes = 0;
  let totalEntities = 0;
  let totalTables = 0;
  let totalSummaries = 0;

  documents.forEach(d => {
    // 1. Storage bytes
    if (d.metadata?.fileSize) {
      totalBytes += Number(d.metadata.fileSize);
    } else {
      totalBytes += d.mimeType === 'application/pdf' ? 245000 : 120000;
    }

    // 2. Entities
    if (d.entities) {
      totalEntities += d.entities.length;
    }

    // 3. Tables
    if (d.tables) {
      if (Array.isArray(d.tables)) {
        totalTables += d.tables.length;
      } else if (d.tables.tables && Array.isArray(d.tables.tables)) {
        totalTables += d.tables.tables.length;
      }
    }

    // 4. Summaries
    if (d.metadata?.aiSummary || d.metadata?.summary) {
      totalSummaries++;
    }
  });

  // Format bytes
  let storageStr = '0 KB';
  if (totalBytes > 1024 * 1024 * 1024) {
    storageStr = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (totalBytes > 1024 * 1024) {
    storageStr = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else if (totalBytes > 1024) {
    storageStr = `${(totalBytes / 1024).toFixed(0)} KB`;
  }

  return {
    documentsCount: documents.length,
    foldersCount: folders.size,
    categoriesCount: categories.size > 0 ? categories.size : 1,
    storageUsed: storageStr,
    entitiesCount: totalEntities,
    tablesCount: totalTables,
    summariesCount: totalSummaries,
    aiUnitsUsed
  };
}

export interface EntityStat {
  name: string;
  count: number;
}

export interface EntityDashboardStats {
  people: EntityStat[];
  organisations: EntityStat[];
}

export function calculateEntityStats(documents: Document[]): EntityDashboardStats {
  const peopleCounts: Record<string, number> = {};
  const orgCounts: Record<string, number> = {};

  const orgKeywords = [
    'bank', 'ltd', 'corp', 'inc', 'university', 'tcs', 
    'services', 'llp', 'co.', 'company', 'office', 'school',
    'institute', 'limited', 'association', 'trust'
  ];

  documents.forEach(d => {
    if (d.entities) {
      d.entities.forEach(ent => {
        const entClean = ent.trim();
        if (!entClean || entClean.toLowerCase() === 'unknown') return;

        const isOrg = orgKeywords.some(keyword => entClean.toLowerCase().includes(keyword));
        if (isOrg) {
          orgCounts[entClean] = (orgCounts[entClean] || 0) + 1;
        } else {
          peopleCounts[entClean] = (peopleCounts[entClean] || 0) + 1;
        }
      });
    }
  });

  const mapToSortedArray = (counts: Record<string, number>): EntityStat[] => {
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  return {
    people: mapToSortedArray(peopleCounts),
    organisations: mapToSortedArray(orgCounts)
  };
}

export interface TableDashboardStats {
  tablesCount: number;
  documentsCount: number;
  sheetsCount: number;
  recentTables: { _id: string; name: string; sheets: number; date: string }[];
}

export function calculateTableStats(documents: Document[]): TableDashboardStats {
  let totalTables = 0;
  let docsWithTables = 0;
  const recentTables: TableDashboardStats['recentTables'] = [];

  documents.forEach(d => {
    let docTableCount = 0;
    if (d.tables) {
      if (Array.isArray(d.tables)) {
        docTableCount = d.tables.length;
      } else if (d.tables.tables && Array.isArray(d.tables.tables)) {
        docTableCount = d.tables.tables.length;
      }
    }

    if (docTableCount > 0) {
      totalTables += docTableCount;
      docsWithTables++;

      if (recentTables.length < 3) {
        recentTables.push({
          _id: d._id,
          name: d.name,
          sheets: docTableCount,
          date: formatUploadTime(d.date)
        });
      }
    }
  });

  return {
    tablesCount: totalTables,
    documentsCount: docsWithTables,
    sheetsCount: totalTables,
    recentTables
  };
}

export interface FolderDistribution {
  name: string;
  percentage: number;
  count: number;
}

export function calculateFolderDistribution(documents: Document[]): FolderDistribution[] {
  const distribution: Record<string, number> = {};
  let total = 0;

  documents.forEach(d => {
    const category = d.vaultCategory || 'Uploads';
    distribution[category] = (distribution[category] || 0) + 1;
    total++;
  });

  return Object.entries(distribution)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
}

export interface SystemHealth {
  ocrSuccessRate: number;
  aiSuccessRate: number;
  tableSuccessRate: number;
  previewRate: number;
  completed: number;
  processing: number;
  failed: number;
}

export function calculateSystemHealth(documents: Document[]): SystemHealth {
  const total = documents.length;
  if (total === 0) {
    return { ocrSuccessRate: 100, aiSuccessRate: 100, tableSuccessRate: 100, previewRate: 100, completed: 0, processing: 0, failed: 0 };
  }

  const completed = documents.filter(d => d.status === 'COMPLETED' || d.status === 'PARTIAL_SUCCESS').length;
  const processing = documents.filter(d => d.status === 'PROCESSING' || d.status === 'DECRYPTED' || d.status === 'UNLOCKING').length;
  const failed = documents.filter(d => d.status === 'FAILED').length;

  const ocrFailures = documents.filter(d => d.status === 'FAILED' && d.processingCheckpoint?.ocrCompleted === false).length;
  const aiFailures = documents.filter(d => d.status === 'FAILED' && d.processingCheckpoint?.aiCompleted === false).length;
  const tableFailures = documents.filter(d => d.status === 'FAILED' && d.processingCheckpoint?.tablesCompleted === false).length;
  const withPreview = documents.filter(d => d.previewUrl).length;

  return {
    ocrSuccessRate: Math.round(((total - ocrFailures) / total) * 100),
    aiSuccessRate: Math.round(((total - aiFailures) / total) * 100),
    tableSuccessRate: Math.round(((total - tableFailures) / total) * 100),
    previewRate: Math.round((withPreview / total) * 100),
    completed,
    processing,
    failed
  };
}

export interface DuplicateGroup {
  name: string;
  count: number;
  size?: string;
  docs: { _id: string; name: string; folder: string }[];
}

export function detectPotentialDuplicates(documents: Document[]): DuplicateGroup[] {
  const groups: Record<string, Document[]> = {};

  documents.forEach(d => {
    const key = d.name.toLowerCase().trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  return Object.entries(groups)
    .filter(([_, docs]) => docs.length > 1)
    .map(([name, docs]) => {
      let sizeStr = undefined;
      const firstDoc = docs[0];
      if (firstDoc.metadata?.fileSize) {
        const sizeBytes = Number(firstDoc.metadata.fileSize);
        sizeStr = sizeBytes > 1024 * 1024 
          ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${(sizeBytes / 1024).toFixed(0)} KB`;
      }
      return {
        name: firstDoc.name,
        count: docs.length,
        size: sizeStr,
        docs: docs.map(doc => ({ _id: doc._id, name: doc.name, folder: doc.folder }))
      };
    });
}
