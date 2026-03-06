import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, CustomRule } from '../types';
import { BASE_RULES } from '../constants';

const safeFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).trim().replace('$', '').replace(/,/g, '').replace(/ /g, '');
  const f = parseFloat(s);
  return isNaN(f) ? 0 : f;
};

const normDate = (s: string): string => {
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    const mo: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const monthStr = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
    return `${m[3]}-${mo[monthStr] || '01'}-${m[1].padStart(2, '0')}`;
  }
  return s;
};

export const categorize = (desc: string, customRules: CustomRule[] = []): string => {
  const d = desc.toUpperCase();
  for (const rule of customRules) {
    if (d.includes(rule.keyword.toUpperCase())) {
      return rule.category;
    }
  }
  for (const [keywords, cat] of BASE_RULES) {
    if (keywords.some(k => d.includes(k.toUpperCase()))) {
      return cat;
    }
  }
  return 'Uncategorized';
};

const parseCIBC = (text: string, filename: string, customRules: CustomRule[]): Transaction[] => {
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  const rows: Transaction[] = [];
  
  for (let i = 0; i < parsed.data.length; i++) {
    const parts = parsed.data[i] as string[];
    if (parts.length < 3) continue;
    
    const date = normDate(parts[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    
    const desc = (parts[1] || '').trim();
    const debit = parts.length > 2 ? safeFloat(parts[2]) : 0;
    const credit = parts.length > 3 ? safeFloat(parts[3]) : 0;
    
    const exp = debit > 0;
    const amt = exp ? debit : credit;
    const cat = exp ? categorize(desc, customRules) : (desc.toLowerCase().includes('payment') ? 'Credit Card Payment' : 'Paychecks');
    
    rows.push({
      id: `cibc-${uuidv4()}`,
      date,
      description: desc,
      amount: Math.round(amt * 100) / 100,
      type: exp ? 'expense' : 'credit',
      account: 'CIBC',
      category: cat,
      hidden: false,
      filename
    });
  }
  return rows;
};

const parseAmexActivity = (text: string, filename: string, customRules: CustomRule[]): Transaction[] => {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows: Transaction[] = [];
  
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    const keys = Object.keys(row);
    
    const dcol = keys.find(c => c.toLowerCase().includes('date') && !c.toLowerCase().includes('process')) || keys[0];
    const ncol = keys.find(c => c.toLowerCase().includes('description')) || keys.find(c => c.toLowerCase().includes('merchant')) || keys[1];
    const acol = keys.find(c => c.toLowerCase() === 'amount') || keys.find(c => c.toLowerCase().includes('amount')) || keys[2];
    
    if (!dcol || !ncol || !acol) continue;
    
    const date = normDate(row[dcol]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    
    const desc = (row[ncol] || '').trim();
    const amt = safeFloat(row[acol]);
    const exp = amt > 0;
    const cat = exp ? categorize(desc, customRules) : (desc.toLowerCase().includes('payment') ? 'Credit Card Payment' : 'Paychecks');
    
    rows.push({
      id: `amex-${uuidv4()}`,
      date,
      description: desc,
      amount: Math.round(Math.abs(amt) * 100) / 100,
      type: exp ? 'expense' : 'credit',
      account: 'Amex',
      category: cat,
      hidden: false,
      filename
    });
  }
  return rows;
};

const parseMonarch = (text: string, filename: string, customRules: CustomRule[]): Transaction[] => {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows: Transaction[] = [];
  
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    
    const date = normDate(row['Date']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    
    const desc = (row['Merchant'] || row['Description'] || row['Original Statement'] || '').trim();
    const amt = safeFloat(row['Amount']);
    
    // Monarch: Negative is expense, Positive is credit
    const isCredit = amt > 0;
    
    const monarchCat = (row['Category'] || '').trim();
    const cat = monarchCat || (isCredit ? 'Income' : categorize(desc, customRules));
    
    const account = (row['Account'] || 'Monarch').trim();
    const notes = (row['Notes'] || '').trim();
    const tagsStr = (row['Tags'] || '').trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
    
    rows.push({
      id: `monarch-${uuidv4()}`,
      date,
      description: desc,
      amount: Math.round(Math.abs(amt) * 100) / 100,
      type: isCredit ? 'credit' : 'expense',
      account,
      category: cat,
      notes: notes || undefined,
      tags: tags.length > 0 ? tags : undefined,
      hidden: false,
      filename
    });
  }
  return rows;
};

const processDataRows = (data: string[][], filename: string, customRules: CustomRule[]): Transaction[] => {
  // 1. Try to find a header row in the first 10 rows
  let headerRowIndex = -1;
  let bestScore = 0;
  let colMap = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, type: -1 };
  
  const keywords = {
    date: ['date', 'time', 'posted', 'trans'],
    desc: ['description', 'merchant', 'payee', 'detail', 'memo', 'narrative', 'particulars', 'name'],
    amount: ['amount', 'amt', 'value', 'total'],
    debit: ['debit', 'withdrawal', 'out', 'dr', 'expense'],
    credit: ['credit', 'deposit', 'in', 'cr', 'income'],
    type: ['type', 'd/c', 'cr/dr']
  };

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i].map(c => String(c).trim().toLowerCase());
    let score = 0;
    const currentMap = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, type: -1 };
    
    // Check for Date
    currentMap.date = row.findIndex(c => keywords.date.some(k => c.includes(k)) && !c.includes('process'));
    if (currentMap.date !== -1) score++;
    
    // Check for Description
    currentMap.desc = row.findIndex(c => keywords.desc.some(k => c.includes(k)));
    if (currentMap.desc !== -1) score++;
    
    // Check for Amount (or Debit/Credit)
    currentMap.amount = row.findIndex(c => keywords.amount.some(k => c === k || c.includes(k))); // Strict check first
    currentMap.debit = row.findIndex(c => keywords.debit.some(k => c === k || c.includes(k)));
    currentMap.credit = row.findIndex(c => keywords.credit.some(k => c === k || c.includes(k)));
    
    if (currentMap.amount !== -1 || (currentMap.debit !== -1 && currentMap.credit !== -1)) score++;
    
    // Bonus for Type
    currentMap.type = row.findIndex(c => keywords.type.some(k => c === k));
    
    if (score > bestScore && score >= 2) {
      bestScore = score;
      headerRowIndex = i;
      colMap = currentMap;
    }
  }

  // 2. If no header found, try to "sniff" columns based on data content
  if (headerRowIndex === -1) {
    // Look at the first 5 data rows to guess types
    const sampleRows = data.slice(0, 5);
    const colTypes: Record<number, { date: number, number: number, string: number }> = {};
    
    for (const row of sampleRows) {
      row.forEach((cell, idx) => {
        if (!colTypes[idx]) colTypes[idx] = { date: 0, number: 0, string: 0 };
        const val = String(cell).trim();
        if (!val) return;
        
        // Date check
        if (/^\d{4}-\d{2}-\d{2}$/.test(val) || 
            /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(val) ||
            /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(val)) {
          colTypes[idx].date++;
        }
        // Number check (allow currency symbols, commas, negatives)
        else if (/^-?\$?[\d,]+\.?\d*$/.test(val) || /^\$?-?[\d,]+\.?\d*$/.test(val)) {
          colTypes[idx].number++;
        }
        // String check (has letters)
        else if (/[a-zA-Z]/.test(val)) {
          colTypes[idx].string++;
        }
      });
    }
    
    // Assign columns based on scores
    let bestDateCol = -1;
    let maxDateScore = 0;
    let bestAmtCol = -1;
    let maxAmtScore = 0;
    
    Object.entries(colTypes).forEach(([idx, scores]) => {
      const i = parseInt(idx);
      if (scores.date > maxDateScore) {
        maxDateScore = scores.date;
        bestDateCol = i;
      }
      if (scores.number > maxAmtScore) {
        maxAmtScore = scores.number;
        bestAmtCol = i;
      }
    });
    
    // Description is likely the string column with most entries, or just the one that isn't date/amt
    let bestDescCol = -1;
    let maxDescScore = 0;
    Object.entries(colTypes).forEach(([idx, scores]) => {
      const i = parseInt(idx);
      if (i !== bestDateCol && i !== bestAmtCol && scores.string > maxDescScore) {
        maxDescScore = scores.string;
        bestDescCol = i;
      }
    });
    
    // Fallback defaults if sniffing failed completely
    if (bestDateCol === -1) bestDateCol = 0;
    if (bestDescCol === -1) bestDescCol = 1;
    if (bestAmtCol === -1) bestAmtCol = 2;
    
    colMap = { date: bestDateCol, desc: bestDescCol, amount: bestAmtCol, debit: -1, credit: -1, type: -1 };
    headerRowIndex = -1; // No header row to skip
  }

  const rows: Transaction[] = [];
  const startRow = headerRowIndex === -1 ? 0 : headerRowIndex + 1;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    // Safety check for bounds
    if (!row[colMap.date] && !row[colMap.amount] && !row[colMap.debit]) continue;
    
    let rawDate = row[colMap.date];
    let dateStr = normDate(String(rawDate || ''));
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    
    const desc = String(row[colMap.desc] || '').trim();
    
    let amt = 0;
    let type: 'expense' | 'credit' = 'expense';
    
    // Handle Debit/Credit columns
    if (colMap.debit !== -1 && colMap.credit !== -1) {
      const dr = safeFloat(row[colMap.debit]);
      const cr = safeFloat(row[colMap.credit]);
      if (dr > 0) {
        amt = dr;
        type = 'expense';
      } else if (cr > 0) {
        amt = cr;
        type = 'credit';
      } else {
        // Both 0 or missing
        continue;
      }
    } 
    // Handle Single Amount Column
    else if (colMap.amount !== -1) {
      const rawAmt = safeFloat(row[colMap.amount]);
      
      // Check for Type column
      if (colMap.type !== -1) {
        const typeVal = String(row[colMap.type] || '').toLowerCase();
        if (['dr', 'debit', 'out', 'withdrawal'].some(t => typeVal.includes(t))) {
          type = 'expense';
          amt = Math.abs(rawAmt);
        } else if (['cr', 'credit', 'in', 'deposit'].some(t => typeVal.includes(t))) {
          type = 'credit';
          amt = Math.abs(rawAmt);
        } else {
          // Default behavior if type is ambiguous
          type = rawAmt < 0 ? 'expense' : 'credit'; // Assume negative is expense (common)
          amt = Math.abs(rawAmt);
        }
      } else {
        // No type column. 
        // Heuristic: If we see negative numbers in the file, assume negative = expense.
        // If ALL numbers are positive, assume positive = expense (like credit card statements).
        // For this single row, we can't know global context easily without pre-scanning.
        // Let's assume standard: Negative = Expense.
        // BUT, if it's a credit card CSV, positive usually means charge (expense).
        // Let's use a simple heuristic: 
        // If it's a "Credit Card" looking file (often has 'card' in filename or desc), positive = expense.
        // Otherwise, negative = expense.
        // Actually, let's just stick to: Negative = Expense, Positive = Income.
        // Users can invert if needed (maybe add a toggle later).
        // For now, let's assume:
        // If rawAmt is negative -> Expense.
        // If rawAmt is positive -> Credit (Income).
        // Wait, for Credit Cards: -100 usually means payment (credit), 100 means purchase (expense).
        // For Bank Accounts: -100 usually means withdrawal (expense), 100 means deposit (credit).
        // This is conflicting.
        // Let's try to detect "Payment" in description.
        if (desc.toLowerCase().includes('payment') || desc.toLowerCase().includes('deposit')) {
             // Likely a credit/income
             type = 'credit';
             amt = Math.abs(rawAmt);
        } else {
             // Likely an expense
             type = 'expense';
             amt = Math.abs(rawAmt);
        }
        
        // Override based on sign if it's explicit
        if (rawAmt < 0) {
            // Usually expense in bank, but credit in CC?
            // Let's assume Bank standard: Negative = Out (Expense)
            type = 'expense';
        } else {
            // Positive = In (Credit) ??
            // Or Positive = Expense (CC)?
            // This is the hardest part of "Universal".
            // Let's default to: Positive = Expense (safer for CCs), Negative = Credit (Payment).
            // UNLESS we detected it's a bank file?
            // Let's stick to the previous generic logic:
            // const exp = amt > 0;
            // const cat = exp ? ...
            
            // Reverting to previous generic logic for single column:
            // "const exp = amt > 0;" -> Positive is Expense.
            type = rawAmt > 0 ? 'expense' : 'credit';
        }
      }
    }

    const cat = type === 'expense' ? categorize(desc, customRules) : (desc.toLowerCase().includes('payment') ? 'Credit Card Payment' : 'Income');

    rows.push({
      id: `imp-${uuidv4()}`,
      date: dateStr,
      description: desc,
      amount: Math.round(amt * 100) / 100,
      type,
      account: 'Imported',
      category: cat,
      hidden: false,
      filename
    });
  }
  
  return rows;
};

const parseExcelFile = async (file: File, customRules: CustomRule[]): Promise<{ rows: Transaction[], error: string | null }> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { rows: [], error: `Could not read '${file.name}'. Try saving as CSV.` };
    }
    
    const json: string[][] = [];
    worksheet.eachRow((row) => {
      // ExcelJS rows are 1-indexed, but we just want values
      // row.values is [undefined, val1, val2...] because of 1-indexing
      const rowValues = (row.values as any[]).slice(1).map(v => {
          if (v instanceof Date) return v.toISOString().split('T')[0];
          if (v && typeof v === 'object' && 'result' in v) return String((v as any).result); // Formula result
          return String(v || '');
      });
      json.push(rowValues);
    });
    
    if (json.length === 0) {
      return { rows: [], error: `Could not read '${file.name}'. Try saving as CSV.` };
    }
    
    const rows = processDataRows(json, file.name, customRules);
    return { rows, error: null };
  } catch (err: any) {
    return { rows: [], error: `Could not read: ${err.message}` };
  }
};

const parseUniversalCSV = (text: string, filename: string, customRules: CustomRule[]): Transaction[] => {
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  if (parsed.data.length === 0) return [];
  
  const data = parsed.data as string[][];
  return processDataRows(data, filename, customRules);
};

const parseCustomFormat = (text: string, filename: string, customRules: CustomRule[]): Transaction[] => {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows: Transaction[] = [];
  
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    
    const date = normDate(row['Date']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    
    const desc = (row['Description'] || '').trim();
    const typeOfTrans = (row['Type of Trans'] || '').trim().toLowerCase();
    const amt = safeFloat(row['Amount']);
    
    const isExpense = typeOfTrans === 'debit';
    const cat = isExpense ? categorize(desc, customRules) : (desc.toLowerCase().includes('payment') ? 'Credit Card Payment' : 'Income');
    
    rows.push({
      id: `custom-${uuidv4()}`,
      date,
      description: desc,
      amount: Math.round(Math.abs(amt) * 100) / 100,
      type: isExpense ? 'expense' : 'credit',
      account: 'Bank',
      category: cat,
      hidden: false,
      filename
    });
  }
  return rows;
};

export const detectAndParse = async (file: File, customRules: CustomRule[]): Promise<{ rows: Transaction[], error: string | null }> => {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'xls' || ext === 'xlsx') {
    return parseExcelFile(file, customRules);
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.trim().split('\n')[0] || '';
      
      try {
        if (firstLine.toLowerCase().includes('merchant') && firstLine.toLowerCase().includes('category') && firstLine.toLowerCase().includes('original statement')) {
          resolve({ rows: parseMonarch(text, file.name, customRules), error: null });
        } else if (firstLine.toLowerCase().includes('filter') && firstLine.toLowerCase().includes('sub-descript') && firstLine.toLowerCase().includes('type of trans')) {
          resolve({ rows: parseCustomFormat(text, file.name, customRules), error: null });
        } else if (/^\d{4}-\d{2}-\d{2}/.test(firstLine)) {
          resolve({ rows: parseCIBC(text, file.name, customRules), error: null });
        } else if (firstLine.toLowerCase().includes('reference') && firstLine.toLowerCase().includes('date')) {
          resolve({ rows: parseAmexActivity(text, file.name, customRules), error: null });
        } else {
          resolve({ rows: parseUniversalCSV(text, file.name, customRules), error: null });
        }
      } catch (err: any) {
        resolve({ rows: [], error: err.message });
      }
    };
    reader.readAsText(file);
  });
};
