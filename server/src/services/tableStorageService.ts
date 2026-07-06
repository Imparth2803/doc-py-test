import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { getAbsoluteStoragePath } from '../utils/storagePathUtils';

export interface ITableSheetMetadata {
  page: number;
  sheetName: string;
  regionType: 'TABLE' | 'KEY_VALUE';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  rows: number;
  columns: number;
  confidence: number;
  engine: string;
  readingOrder?: number;
  rawText?: string;
}

export interface IConsolidatedTables {
  workbookPath: string | null;
  workbookName: string | null;
  sheetCount: number;
  totalTables: number;
  pagesWithTables: number[];
  extractedAt?: Date | string;
  previewAvailable: boolean;
  tables: ITableSheetMetadata[];
}

/**
 * Normalizes the database table data (handling both legacy array format and new consolidated format)
 * to return a consistent metadata structure.
 */
export function getNormalizedTablesInfo(document: any): IConsolidatedTables {
  if (!document || !document.tables) {
    return {
      workbookPath: null,
      workbookName: null,
      sheetCount: 0,
      totalTables: 0,
      pagesWithTables: [],
      previewAvailable: false,
      tables: []
    };
  }

  // Check if it is the legacy array format
  if (Array.isArray(document.tables)) {
    const legacyArray = document.tables;
    const pages = Array.from(new Set(legacyArray.map((t: any) => t.pageNumber || 1))).sort((a: any, b: any) => a - b) as number[];
    
    return {
      workbookPath: legacyArray[0]?.excelPath ? path.dirname(legacyArray[0].excelPath) : null,
      workbookName: document.originalName ? `${document.originalName.replace(/\.[^/.]+$/, "")}_Tables.xlsx` : "Tables.xlsx",
      sheetCount: legacyArray.length,
      totalTables: legacyArray.length,
      pagesWithTables: pages,
      extractedAt: document.createdAt || document.updatedAt,
      previewAvailable: legacyArray.length > 0,
      tables: legacyArray.map((t: any) => ({
        page: t.pageNumber || 1,
        sheetName: t.tableId || `Page_${t.pageNumber || 1}_Table`,
        regionType: 'TABLE' as const,
        boundingBox: null,
        rows: t.rowCount || 0,
        columns: t.columnCount || 0,
        confidence: t.confidence || 1.0,
        engine: t.engine || 'camelot',
        readingOrder: 1,
        rawText: ''
      }))
    };
  }

  // It is already in the new format
  return {
    workbookPath: document.tables.workbookPath || null,
    workbookName: document.tables.workbookName || null,
    sheetCount: document.tables.sheetCount || 0,
    totalTables: document.tables.totalTables || 0,
    pagesWithTables: document.tables.pagesWithTables || [],
    extractedAt: document.tables.extractedAt || document.createdAt,
    previewAvailable: document.tables.previewAvailable || false,
    tables: (document.tables.tables || []).map((t: any) => ({
      page: t.page || 1,
      sheetName: t.sheetName || 'Sheet',
      regionType: (t.regionType || 'TABLE') as 'TABLE' | 'KEY_VALUE',
      boundingBox: t.boundingBox || null,
      rows: t.rows || 0,
      columns: t.columns || 0,
      confidence: t.confidence || 1.0,
      engine: t.engine || 'camelot',
      readingOrder: t.readingOrder || 0,
      rawText: t.rawText || '',
      grid_items: t.grid_items || [],
      table_metadata: t.table_metadata || {},
      layoutConfidence: t.layoutConfidence !== undefined ? t.layoutConfidence : 1.0,
      extractionConfidence: t.extractionConfidence !== undefined ? t.extractionConfidence : 1.0,
      extractionEngine: t.extractionEngine || t.engine || 'camelot',
      layoutEvidence: t.layoutEvidence || { tableEvidence: 1.0, keyValueEvidence: 0.0, reasons: [] }
    }))
  };
}

/**
 * Reads a sheet from a consolidated workbook on disk and parses it into JSON, separating the metadata block from table grid cells.
 */
export function parseExcelSheet(
  workbookAbsPath: string,
  sheetName: string,
  document: any,
  tableMeta?: ITableSheetMetadata
) {
  if (!fs.existsSync(workbookAbsPath)) {
    throw new Error(`Workbook not found on disk at: ${workbookAbsPath}`);
  }

  const workbook = XLSX.readFile(workbookAbsPath);
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found in workbook.`);
  }

  // Parse to raw rows (array of arrays)
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  let metadata = {
    pdfName: document.originalName,
    pageNumber: tableMeta ? tableMeta.page : 1,
    regionType: tableMeta ? tableMeta.regionType || 'TABLE' : 'TABLE',
    boundingBox: tableMeta ? tableMeta.boundingBox : null,
    engine: 'camelot',
    confidence: tableMeta ? tableMeta.confidence : 1.0,
    timestamp: document.createdAt ? new Date(document.createdAt).toISOString() : new Date().toISOString()
  };
  
  let headers: string[] = [];
  let rows: any[][] = [];

  // Check if first row is the 'Metadata' marker and parse dynamically based on layout count
  if (rawData.length >= 8 && (rawData[0]?.[0] === 'Metadata' || rawData[1]?.[0] === 'PDF Name')) {
    const isNewFormat = rawData[3]?.[0] === 'Region Type';
    
    if (isNewFormat) {
      // 8-row metadata block (region-based hybrid format)
      metadata = {
        pdfName: String(rawData[1]?.[1] || metadata.pdfName),
        pageNumber: Number(rawData[2]?.[1] || metadata.pageNumber),
        regionType: String(rawData[3]?.[1] || metadata.regionType) as 'TABLE' | 'KEY_VALUE',
        boundingBox: rawData[4]?.[1] ? parseBoundingBoxStr(String(rawData[4]?.[1])) : metadata.boundingBox,
        engine: String(rawData[5]?.[1] || metadata.engine),
        confidence: Number(rawData[6]?.[1] || metadata.confidence),
        timestamp: String(rawData[7]?.[1] || metadata.timestamp)
      };

      headers = rawData[9]?.map((h: any) => h !== undefined && h !== null ? String(h) : '') || [];
      rows = rawData.slice(10).map(row => row.map(val => val !== undefined && val !== null ? val : ''));
    } else {
      // 7-row metadata block (first-draft page-based format)
      metadata = {
        pdfName: String(rawData[1]?.[1] || metadata.pdfName),
        pageNumber: Number(rawData[2]?.[1] || metadata.pageNumber),
        regionType: 'TABLE' as const,
        boundingBox: null,
        engine: String(rawData[4]?.[1] || metadata.engine),
        confidence: Number(rawData[5]?.[1] || metadata.confidence),
        timestamp: String(rawData[6]?.[1] || metadata.timestamp)
      };

      headers = rawData[8]?.map((h: any) => h !== undefined && h !== null ? String(h) : '') || [];
      rows = rawData.slice(9).map(row => row.map(val => val !== undefined && val !== null ? val : ''));
    }
  } else {
    // Fallback: raw table structure without metadata headers (legacy documents)
    headers = rawData[0]?.map((h: any) => h !== undefined && h !== null ? String(h) : '') || [];
    rows = rawData.slice(1).map(row => row.map(val => val !== undefined && val !== null ? val : ''));
  }

  // Parse key-value structure representation specifically for the controller response
  let fields: { label: string; value: string }[] | undefined = undefined;
  if (metadata.regionType === 'KEY_VALUE') {
    fields = rows.map(row => ({
      label: String(row[0] || '').trim(),
      value: String(row[1] || '').trim()
    })).filter(f => f.label);
  }

  return {
    regionType: metadata.regionType,
    boundingBox: metadata.boundingBox,
    metadata,
    headers,
    rows,
    fields
  };
}

// Bounding box string parsing helper
function parseBoundingBoxStr(str: string) {
  try {
    const parts = str.split(',').map(Number);
    if (parts.length === 4) {
      return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3]
      };
    }
  } catch (e) {
    console.error('Failed to parse bounding box string:', str);
  }
  return null;
}

/**
 * For legacy documents: combines multiple loose Excel files into a single in-memory workbook 
 * and writes it to a consolidated path so it can be served/downloaded as a unified file.
 */
export async function getOrGenerateLegacyWorkbook(document: any): Promise<string> {
  if (!Array.isArray(document.tables) || document.tables.length === 0) {
    throw new Error("No legacy tables found for this document.");
  }

  const documentId = document._id.toString();
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  const docTableDir = path.join(uploadsDir, 'tables', documentId);
  
  if (!fs.existsSync(docTableDir)) {
    fs.mkdirSync(docTableDir, { recursive: true });
  }

  const workbookName = `${documentId}_Tables.xlsx`;
  const workbookAbsPath = path.join(docTableDir, workbookName);

  if (fs.existsSync(workbookAbsPath)) {
    return workbookAbsPath;
  }

  const consolidatedBook = XLSX.utils.book_new();

  for (let i = 0; i < document.tables.length; i++) {
    const t = document.tables[i];
    const sheetFileAbsPath = getAbsoluteStoragePath(t.excelPath);
    
    if (fs.existsSync(sheetFileAbsPath)) {
      const sheetWorkbook = XLSX.readFile(sheetFileAbsPath);
      const firstSheetName = sheetWorkbook.SheetNames[0];
      const sheetData = sheetWorkbook.Sheets[firstSheetName];
      
      const sheetName = t.tableId ? t.tableId.substring(t.tableId.lastIndexOf('_') + 1) : `Sheet_${i+1}`;
      const finalSheetName = `Page_${t.pageNumber || 1}_t${i}_${sheetName}`.substring(0, 30);
      
      XLSX.utils.book_append_sheet(consolidatedBook, sheetData, finalSheetName);
    }
  }

  XLSX.writeFile(consolidatedBook, workbookAbsPath);
  return workbookAbsPath;
}
