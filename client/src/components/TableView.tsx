import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  getDocumentTables, 
  getDocumentTableSheet, 
  getDownloadTablesUrl 
} from '../services/documentApi';
import { 
  ArrowLeft, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle, 
  Database, 
  TrendingUp, 
  Clock, 
  Layers,
  Search,
  CheckCircle2,
  FileText,
  Maximize2,
  Minimize2,
  Copy
} from 'lucide-react';

interface TableSheet {
  page: number;
  sheetName: string;
  rows: number;
  columns: number;
  confidence: number;
}

interface WorkbookMetadata {
  workbookPath: string | null;
  workbookName: string | null;
  sheetCount: number;
  totalTables: number;
  pagesWithTables: number[];
  extractedAt?: string;
  previewAvailable: boolean;
  tables: TableSheet[];
}

interface SheetData {
  success: boolean;
  metadata: {
    pdfName: string;
    pageNumber: number;
    tableNumber: number;
    engine: string;
    confidence: number;
    timestamp: string;
  };
  headers: string[];
  rows: any[][];
}

const getExcelColumnLabel = (index: number): string => {
  let label = '';
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
};

const getDisplayHeader = (hdr: string, index: number): string => {
  const trimmed = (hdr || '').trim();
  
  if (/^\d+$/.test(trimmed)) {
    return getExcelColumnLabel(Number(trimmed));
  }
  
  if (trimmed.startsWith('Column_')) {
    return trimmed.replace('Column_', 'Column ');
  }
  
  if (!trimmed) {
    return `Column ${getExcelColumnLabel(index)}`;
  }
  
  return trimmed;
};

interface TableViewProps {
  documentId: string | null;
}

export const TableView: React.FC<TableViewProps> = ({ documentId }) => {
  const { goToArchive, documents } = useApp();
  const doc = documents.find(d => d._id === documentId);
  const docName = doc?.name || 'Document';

  // State
  const [wbMeta, setWbMeta] = useState<WorkbookMetadata | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [sheetData, setSheetData] = useState<any | null>(null);
  
  // Loading & Error States
  const [loadingWb, setLoadingWb] = useState<boolean>(true);
  const [loadingSheet, setLoadingSheet] = useState<boolean>(false);
  const [wbError, setWbError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  
  // Search & Filter
  const [cellFilter, setCellFilter] = useState<string>('');

  // Copy to clipboard helper
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Copy sheet to clipboard helper (TSV format)
  const [copiedSheetStatus, setCopiedSheetStatus] = useState<boolean>(false);
  const handleCopySheet = () => {
    if (!sheetData) return;
    
    let tsvContent = '';
    
    if (sheetData.regionType === 'KEY_VALUE') {
      const headerRow = ['Key', 'Value'].join('\t');
      const fieldsToCopy = (sheetData.fields || []).filter((field: any) => 
        cellFilter ? (
          field.label.toLowerCase().includes(cellFilter.toLowerCase()) || 
          field.value.toLowerCase().includes(cellFilter.toLowerCase())
        ) : true
      );
      
      const dataRows = fieldsToCopy
        .map((field: any) => {
          const label = String(field.label || '').replace(/\r?\n/g, ' ');
          const value = String(field.value || '').replace(/\r?\n/g, ' ');
          return `${label}\t${value}`;
        })
        .join('\n');
        
      tsvContent = `${headerRow}\n${dataRows}`;
    } else {
      const headerRow = sheetData.headers
        .map((hdr: string, idx: number) => getDisplayHeader(hdr, idx))
        .join('\t');
      
      const rowsToCopy = filteredRows || [];
      
      const dataRows = rowsToCopy
        .map((row: any[]) => 
          row.map(cell => String(cell !== null && cell !== undefined ? cell : '').replace(/\r?\n/g, ' ')).join('\t')
        )
        .join('\n');
        
      tsvContent = `${headerRow}\n${dataRows}`;
    }
    
    navigator.clipboard.writeText(tsvContent)
      .then(() => {
        setCopiedSheetStatus(true);
        setTimeout(() => setCopiedSheetStatus(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy sheet: ', err);
      });
  };

  // Layout View Mode (Maximize/Minimize)
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // 1. Fetch Workbook Metadata on Mount
  useEffect(() => {
    if (!documentId) {
      setWbError('No document selected.');
      setLoadingWb(false);
      return;
    }

    const loadWorkbookMetadata = async () => {
      setLoadingWb(true);
      setWbError(null);
      try {
        const meta = await getDocumentTables(documentId);
        setWbMeta(meta);
        
        if (meta.tables && meta.tables.length > 0) {
          // Select first sheet automatically
          const firstSheet = meta.tables[0].sheetName;
          setSelectedSheet(firstSheet);
        } else {
          setWbError('No tables were detected in this document.');
        }
      } catch (err: any) {
        console.error(err);
        setWbError(err.message || 'Workbook unavailable or not yet processed.');
      } finally {
        setLoadingWb(false);
      }
    };

    loadWorkbookMetadata();
  }, [documentId]);

  // 2. Fetch Sheet Data when selectedSheet changes
  useEffect(() => {
    if (!documentId || !selectedSheet) return;

    const loadSheetData = async () => {
      setLoadingSheet(true);
      setSheetError(null);
      setCellFilter(''); // Reset table search
      try {
        const data = await getDocumentTableSheet(documentId, selectedSheet);
        setSheetData(data);
      } catch (err: any) {
        console.error(err);
        setSheetError(err.message || 'Worksheet failed to load.');
      } finally {
        setLoadingSheet(false);
      }
    };

    loadSheetData();
  }, [documentId, selectedSheet]);

  // Helper: Format confidence value
  const getConfidenceBadge = (conf: number) => {
    const percentage = Math.round(conf * 100);
    let color = 'bg-red-50 text-red-700 border-red-100';
    if (conf >= 0.90) color = 'bg-emerald-50 text-emerald-700 border-emerald-100';
    else if (conf >= 0.70) color = 'bg-amber-50 text-amber-700 border-amber-100';
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
        {percentage}% Confidence
      </span>
    );
  };

  // Filter rows based on search
  const filteredRows = sheetData?.rows.filter(row => 
    row.some(cell => 
      String(cell).toLowerCase().includes(cellFilter.toLowerCase())
    )
  ) || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* 1. Header Toolbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={goToArchive}
            className="p-2 hover:bg-slate-150 rounded-xl transition-all active:scale-95 group text-slate-600 hover:text-slate-900 border border-slate-200"
            title="Back to Archive"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Table Extraction Viewer</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 max-w-md md:max-w-xl truncate mt-0.5">{docName}</h1>
          </div>
        </div>

        {wbMeta && wbMeta.previewAvailable && (
          <div className="flex items-center gap-2">
            <a
              href={getDownloadTablesUrl(documentId || '')}
              download
              className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-slate-950/10 active:scale-95 border border-slate-850"
            >
              <Download size={14} />
              <span>Download Workbook</span>
            </a>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 shrink-0"
              title={isMaximized ? "Show Sidebar" : "Hide Sidebar"}
            >
              {isMaximized ? (
                <>
                  <Minimize2 size={14} />
                  <span>Minimize View</span>
                </>
              ) : (
                <>
                  <Maximize2 size={14} />
                  <span>Maximize View</span>
                </>
              )}
            </button>
          </div>
        )}
      </header>

      {/* 2. Main Content Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Loading entire workbook */}
        {loadingWb && (
          <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-slate-950" size={32} />
            <p className="text-sm font-semibold text-slate-600">Loading workbook...</p>
          </div>
        )}

        {/* Workbook Error View */}
        {wbError && !loadingWb && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 m-6 rounded-3xl shadow-sm max-w-xl mx-auto my-20">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Extraction Error</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">{wbError}</p>
            <button 
              onClick={goToArchive}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-all"
            >
              Return to Documents List
            </button>
          </div>
        )}

        {wbMeta && !wbError && (
          <>
            {/* 2.1 Sidebar (Worksheet List) */}
            {!isMaximized && (
              <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto max-h-[25vh] md:max-h-full">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Available Worksheets</span>
                  <span className="text-xs font-medium text-slate-500 block mt-0.5">Select a table to preview</span>
                </div>
                <div className="p-2 space-y-1">
                  {wbMeta.tables.map((table) => {
                    const isActive = selectedSheet === table.sheetName;
                    return (
                      <button
                        key={table.sheetName}
                        onClick={() => setSelectedSheet(table.sheetName)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                          isActive 
                            ? 'bg-slate-950 text-white font-bold shadow-md shadow-slate-950/15' 
                            : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileSpreadsheet size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                          <span className="text-xs font-semibold truncate">{table.sheetName.replace(/_/g, ' ')}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          P. {table.page}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            {/* 2.2 Main Preview Panel */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
              
              {/* Table search toolbar */}
              {sheetData && !loadingSheet && (
                <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sheet View</span>
                    <span className="text-sm font-bold text-slate-950">{selectedSheet?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="relative max-w-xs w-full">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search this table..."
                      value={cellFilter}
                      onChange={(e) => setCellFilter(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 relative overflow-auto bg-slate-100 p-6 min-h-[300px]">
                
                {/* Loader for sheet */}
                {loadingSheet && (
                  <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="animate-spin text-slate-900" size={24} />
                    <p className="text-xs font-semibold text-slate-600">Loading worksheet cells...</p>
                  </div>
                )}

                {/* Sheet loading error */}
                {sheetError && !loadingSheet && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-100 z-10">
                    <AlertCircle size={36} className="text-red-500 mb-2" />
                    <h3 className="text-sm font-bold text-slate-900">Worksheet Loading Failed</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">{sheetError}</p>
                  </div>
                )}

                {/* Sheet Content Render */}
                {sheetData && !loadingSheet && !sheetError && (
                  sheetData.regionType === 'KEY_VALUE' ? (
                    // Property Grid View (KEY_VALUE Layout)
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto max-h-[60vh] md:max-h-[65vh]">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Key-Value Summary Details</span>
                      </div>
                      <div className="space-y-4">
                        {(sheetData.fields || []).length > 0 ? (
                          (sheetData.fields || []).map((field: any, idx: number) => {
                            const isMatch = cellFilter ? 
                              (field.label.toLowerCase().includes(cellFilter.toLowerCase()) || 
                               field.value.toLowerCase().includes(cellFilter.toLowerCase())) : true;
                            if (!isMatch) return null;
                            
                            const keyId = `${field.label}-${idx}`;
                            return (
                              <div 
                                key={idx} 
                                className="group flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-slate-50 gap-2 hover:bg-slate-50/50 px-2 rounded-xl transition-all"
                              >
                                <div className="w-full sm:w-1/3 shrink-0">
                                  <span className="text-xs font-bold text-slate-500 block truncate" title={field.label}>
                                    {field.label}
                                  </span>
                                </div>
                                <div className="flex-1 flex items-start justify-between gap-4 min-w-0">
                                  <span className="text-xs font-medium text-slate-900 break-words leading-relaxed whitespace-pre-wrap">
                                    {field.value || <span className="text-slate-300 italic">(empty)</span>}
                                  </span>
                                  {field.value && (
                                    <button
                                      onClick={() => handleCopy(field.value, keyId)}
                                      className="px-2 py-0.5 hover:bg-slate-100 rounded-md transition-all active:scale-95 text-slate-400 hover:text-slate-600 shrink-0 border border-slate-200 text-[10px] font-semibold"
                                      title="Copy Value"
                                    >
                                      {copiedField === keyId ? (
                                        <span className="text-emerald-600 font-bold">Copied</span>
                                      ) : (
                                        <span>Copy</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center text-xs text-slate-400 italic py-8">
                            No key-value fields extracted in this region.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Spreadsheet Grid View (TABLE Layout)
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-full">
                      
                      {/* The Spreadsheet Grid */}
                      <div className="flex-1 overflow-auto max-h-[60vh] md:max-h-[65vh]">
                        <table className="w-full text-left border-collapse table-auto">
                          <thead>
                            <tr className="border-b border-slate-200">
                              {sheetData.headers.map((hdr: string, i: number) => (
                                <th 
                                  key={i} 
                                  className="sticky top-0 bg-slate-950 text-white px-4 py-3 text-xs font-bold tracking-wider z-20 border-r border-slate-800 shadow-sm"
                                >
                                  {getDisplayHeader(hdr, i)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.length > 0 ? (
                              filteredRows.map((row, rIdx) => (
                                <tr 
                                  key={rIdx} 
                                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                    rIdx % 2 === 0 ? 'bg-slate-50/20' : 'bg-white'
                                  }`}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td 
                                      key={cIdx} 
                                      className="px-4 py-3 text-xs text-slate-700 border-r border-slate-100 align-middle max-w-sm truncate"
                                      title={String(cell)}
                                    >
                                      {cell !== '' ? (
                                        String(cell)
                                      ) : (
                                        <span className="text-slate-300 italic">(blank)</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td 
                                  colSpan={sheetData.headers.length || 1} 
                                  className="p-8 text-center text-xs text-slate-400 italic bg-white"
                                >
                                  {cellFilter ? 'No cells match your search criteria.' : 'This table has no rows.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}

                {/* Copy Sheet Button */}
                {sheetData && !loadingSheet && !sheetError && (
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleCopySheet}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm shrink-0"
                      title="Copy Sheet to Clipboard"
                    >
                      {copiedSheetStatus ? (
                        <>
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Sheet</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* 2.3 Bottom Inspector / Metadata Panel */}
              {sheetData && !loadingSheet && (
                <footer className="bg-white border-t border-slate-200 p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 shrink-0 shadow-inner">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Created On</span>
                    <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                      {new Date(sheetData.metadata.timestamp).toLocaleDateString()} {new Date(sheetData.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Page</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      Page {sheetData.metadata.pageNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Region Type</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {sheetData.regionType || 'TABLE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Rows</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {sheetData.rows.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Columns</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      {sheetData.headers.length}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">PDF Source</span>
                    <span className="text-xs font-bold text-slate-900 truncate block mt-0.5" title={sheetData.metadata.pdfName}>
                      {sheetData.metadata.pdfName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Table Index</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">
                      Table {sheetData.metadata.tableNumber}
                    </span>
                  </div>
                </footer>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
};
