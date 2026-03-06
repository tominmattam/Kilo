import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../store';
import { detectAndParse } from '../utils/parser';
import { classifier } from '../utils/classifier';
import { FileText, Trash2, UploadCloud, AlertCircle, Download, RefreshCw, Check, X, Info, Brain, Sparkles } from 'lucide-react';
import { DEFAULT_CATEGORIES, DEFAULT_BUDGETS } from '../constants';
import { Transaction } from '../types';

export const DataSources: React.FC = () => {
  const { data, updateData, setData } = useAppContext();
  const { transactions, files, file_meta, categories } = data;
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [aiStats, setAiStats] = useState({ vocabSize: 0, categories: 0, trainedOn: 0 });
  
  // Train AI on load and when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      classifier.train(transactions);
      setAiStats(classifier.getStats());
    }
  }, [transactions]);
  
  // Duplicate Review State
  const [reviewData, setReviewData] = useState<{
    newTransactions: Transaction[];
    duplicates: { newTxn: Transaction; existingTxn: Transaction }[];
    files: string[];
    meta: any;
  } | null>(null);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());

  const handleBackup = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fintrack_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        // Basic validation
        if (!parsed.transactions || !parsed.categories) {
          throw new Error('Invalid backup file format');
        }
        
        if (window.confirm('This will overwrite ALL current data with the backup. Are you sure?')) {
            setData(parsed);
            alert('Data restored successfully!');
        }
      } catch (err) {
        alert('Failed to restore data: ' + err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setErrors([]);
    
    const allNewRows: Transaction[] = [];
    const newFiles: string[] = [];
    const newFileMeta = { ...file_meta };
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (files.includes(file.name)) {
        setErrors(prev => [...prev, `'${file.name}' is already loaded. Delete it first to re-import.`]);
        continue;
      }
      
      const { rows, error } = await detectAndParse(file, data.custom_rules);
      
      if (error) {
        setErrors(prev => [...prev, `${file.name}: ${error}`]);
        continue;
      }
      
      if (rows.length === 0) {
        setErrors(prev => [...prev, `${file.name}: No valid transactions found.`]);
        continue;
      }
      
      // Apply AI Categorization if enabled
      if (autoCategorize) {
        rows.forEach(row => {
          if (row.category === 'Uncategorized') {
            const prediction = classifier.predict(row.description);
            // Only apply if we have a reasonable guess (vocab size check ensures we have some data)
            if (prediction.category !== 'Uncategorized' && aiStats.vocabSize > 10) {
               row.category = prediction.category;
               // Optional: Mark as AI guessed? 
               // row.notes = (row.notes || '') + ' [AI]';
            }
          }
        });
      }
      
      const fileDates: string[] = [];
      rows.forEach(r => {
        allNewRows.push(r);
        fileDates.push(r.date);
      });
      
      newFiles.push(file.name);
      newFileMeta[file.name] = {
        rows: rows.length,
        date_min: fileDates.sort()[0],
        date_max: fileDates.sort()[fileDates.length - 1],
        uploaded: new Date().toLocaleString(),
        size_kb: Math.round(file.size / 1024 * 10) / 10
      };
    }
    
    if (allNewRows.length > 0) {
      // Identify potential duplicates
      const duplicates: { newTxn: Transaction; existingTxn: Transaction }[] = [];
      const nonDuplicates: Transaction[] = [];
      
      allNewRows.forEach(newTxn => {
        const match = transactions.find(t => 
          t.date === newTxn.date && 
          t.amount === newTxn.amount && 
          t.description.toLowerCase() === newTxn.description.toLowerCase() &&
          !t.hidden
        );
        
        if (match) {
          duplicates.push({ newTxn, existingTxn: match });
        } else {
          nonDuplicates.push(newTxn);
        }
      });
      
      if (duplicates.length > 0) {
        setReviewData({
          newTransactions: nonDuplicates,
          duplicates,
          files: newFiles,
          meta: newFileMeta
        });
        // By default, don't select any duplicates to import
        setSelectedDuplicateIds(new Set());
      } else {
        commitImport(allNewRows, newFiles, newFileMeta);
      }
    }
  };

  const commitImport = (txns: Transaction[], newFiles: string[], newFileMeta: any) => {
    const newCategories = { ...categories };
    let categoriesUpdated = false;

    txns.forEach(txn => {
      if (txn.category && !newCategories[txn.category]) {
        newCategories[txn.category] = { icon: '📦', color: '#a1a1aa' };
        categoriesUpdated = true;
      }
    });

    updateData({
      transactions: [...transactions, ...txns],
      files: [...files, ...newFiles],
      file_meta: newFileMeta,
      ...(categoriesUpdated ? { categories: newCategories } : {})
    });
    
    setReviewData(null);
  };

  const handleConfirmReview = () => {
    if (!reviewData) return;
    
    const selectedDuplicates = reviewData.duplicates
      .filter(d => selectedDuplicateIds.has(d.newTxn.id))
      .map(d => d.newTxn);
      
    const finalTransactions = [...reviewData.newTransactions, ...selectedDuplicates];
    
    if (finalTransactions.length === 0) {
      setErrors(['No transactions selected for import.']);
      setReviewData(null);
      return;
    }
    
    commitImport(finalTransactions, reviewData.files, reviewData.meta);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDeleteFile = (fname: string) => {
    const newMeta = { ...file_meta };
    delete newMeta[fname];
    
    updateData({
      transactions: transactions.filter(t => t.filename !== fname),
      files: files.filter(f => f !== fname),
      file_meta: newMeta
    });
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete ALL data? This includes transactions, files, recurring rules, and custom categories. This cannot be undone.')) {
      updateData({
        transactions: [],
        files: [],
        file_meta: {},
        recurring: [],
        custom_rules: [],
        categories: { ...DEFAULT_CATEGORIES },
        budgets: { ...DEFAULT_BUDGETS },
        networth: { assets: [], liabilities: [] }
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end gap-4">
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">Data Sources</h1>
      </div>
      <p className="text-zinc-400 font-mono text-sm">Manage your imported files and understand what data is available.</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2 relative z-10">Total Transactions</div>
          <div className="text-3xl font-bold tracking-tight text-white font-display relative z-10">{transactions.length.toLocaleString()}</div>
        </div>
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2 relative z-10">Files Loaded</div>
          <div className="text-3xl font-bold tracking-tight text-white font-display relative z-10">{files.length}</div>
        </div>
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2 relative z-10">AI Knowledge</div>
          <div className="text-3xl font-bold tracking-tight text-white font-display relative z-10">{aiStats.trainedOn.toLocaleString()} <span className="text-sm font-normal text-zinc-500">txns</span></div>
        </div>
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2 relative z-10">Vocabulary</div>
          <div className="text-3xl font-bold tracking-tight text-white font-display relative z-10">{aiStats.vocabSize.toLocaleString()} <span className="text-sm font-normal text-zinc-500">words</span></div>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-semibold text-lg tracking-tight">📥 Upload New Files</h3>
            
            <button 
                onClick={() => setAutoCategorize(!autoCategorize)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${autoCategorize ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-[#252525] text-zinc-500 border-white/5'}`}
            >
                <Sparkles size={14} />
                Smart Categorization {autoCategorize ? 'On' : 'Off'}
            </button>
        </div>
        


        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging ? 'border-orange-500 bg-orange-500/5' : 'border-white/10 hover:border-black/20 dark:hover:border-white/20 hover:bg-white/[0.02]'
          }`}
        >
          <UploadCloud className="mx-auto text-zinc-400 dark:text-zinc-500 mb-3" size={32} />
          <p className="text-zinc-300 font-medium mb-1">Drag and drop files here</p>
          <p className="text-zinc-500 text-sm mb-4">or click to browse</p>
          <label className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-500/20">
            Browse Files
            <input
              type="file"
              multiple
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-lg tracking-tight mb-4">📂 Loaded Files</h3>
          {files.map(fname => {
            const meta = file_meta[fname] || {};
            const fileTxns = transactions.filter(t => t.filename === fname);
            const nExp = fileTxns.filter(t => t.type === 'expense').length;
            const nCred = fileTxns.filter(t => t.type === 'credit').length;
            const totalExp = fileTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            const accts = Array.from(new Set(fileTxns.map(t => t.account).filter(Boolean))).join(', ');
            const ext = fname.split('.').pop()?.toLowerCase() || '';

            return (
              <div key={fname} className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <FileText className="text-zinc-400" size={20} />
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">{fname}</span>
                    <span className="bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-white/5">{ext}</span>
                    {meta.size_kb && <span className="text-xs text-zinc-500">{meta.size_kb} KB</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    {meta.uploaded && <span className="text-xs text-zinc-500">Uploaded {meta.uploaded}</span>}
                    <button onClick={() => handleDeleteFile(fname)} className="text-zinc-500 hover:text-red-400 transition-colors p-1" title="Remove file">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4 relative z-10">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Transactions</div>
                    <div className="text-xl font-bold text-white font-display">{fileTxns.length}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Expenses</div>
                    <div className="text-xl font-bold text-red-500 dark:text-red-400 font-display">{nExp}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Credits</div>
                    <div className="text-xl font-bold text-emerald-500 dark:text-emerald-400 font-display">{nCred}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Total Spent</div>
                    <div className="text-xl font-bold text-zinc-700 dark:text-zinc-200 font-display">${totalExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Date Range</div>
                    <div className="text-sm font-semibold text-zinc-400 font-mono">
                      {meta.date_min?.substring(2, 7) || '—'} – {meta.date_max?.substring(2, 7) || '—'}
                    </div>
                  </div>
                </div>
                {accts && (
                  <div className="mt-4 text-xs text-zinc-500 font-mono relative z-10">Accounts: {accts}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Rules */}
      <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
        <h3 className="text-white font-semibold mb-6 text-lg tracking-tight">🧠 Smart Categorization Rules</h3>
        <p className="text-zinc-400 font-mono text-sm mb-4">
          These rules are learned when you rename transactions. They automatically categorize future imports.
        </p>
        
        {data.custom_rules.length === 0 ? (
          <div className="text-zinc-500 text-sm">No rules learned yet. Rename transactions to create rules.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.custom_rules.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#252525] border border-white/5 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Contains</div>
                  <div className="text-white font-mono text-sm truncate" title={rule.keyword}>{rule.keyword}</div>
                  <div className="text-xs text-zinc-400 mt-1">→ {categories[rule.category]?.icon} {rule.category}</div>
                </div>
                <button 
                  onClick={() => {
                    const newRules = [...data.custom_rules];
                    newRules.splice(idx, 1);
                    updateData({ custom_rules: newRules });
                  }}
                  className="text-zinc-500 hover:text-red-500 p-2 hover:bg-white/[0.02] rounded transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
        <h3 className="text-white font-semibold mb-6 text-lg tracking-tight">💾 Backup & Restore</h3>
        <p className="text-zinc-400 font-mono text-sm mb-4">
          Save a full backup of your data to your computer, or restore from a previous backup. 
          This is recommended if you use the app infrequently or want to move data between devices.
        </p>
        <div className="flex gap-4">
            <button 
                onClick={handleBackup}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
                <Download size={16} />
                Download Backup (JSON)
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 cursor-pointer">
                <RefreshCw size={16} />
                Restore Backup
                <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleRestore} 
                    className="hidden" 
                />
            </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
        <button onClick={handleClearAll} className="px-4 py-2 bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-colors">
          🗑 Clear All Data
        </button>

        <button
          onClick={() => {
            const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Original File'];
            const csvContent = [
              headers.join(','),
              ...transactions.map(t => [
                t.date,
                `"${t.description.replace(/"/g, '""')}"`,
                t.amount,
                t.type,
                t.category,
                t.account || '',
                t.filename || ''
              ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `finance_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
        >
          📥 Export to CSV
        </button>
      </div>

      {/* Duplicate Review Modal */}
      {reviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-orange-500/30 shadow-2xl shadow-orange-500/10">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-orange-500/5">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <AlertCircle className="text-orange-400" />
                  Duplicate Review
                </h2>
                <p className="text-zinc-400 text-sm mt-1">
                  We found {reviewData.duplicates.length} transactions that already exist in your history.
                </p>
              </div>
              <button 
                onClick={() => setReviewData(null)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Transactions with the same <span className="font-bold text-white">Date</span>, <span className="font-bold text-white">Amount</span>, and <span className="font-bold text-white">Description</span> are flagged as duplicates. 
                  Select the ones you want to import anyway, or leave them unchecked to skip.
                </p>
              </div>

              <div className="space-y-3">
                {reviewData.duplicates.map(({ newTxn, existingTxn }) => {
                  const isSelected = selectedDuplicateIds.has(newTxn.id);
                  return (
                    <div 
                      key={newTxn.id}
                      onClick={() => {
                        const next = new Set(selectedDuplicateIds);
                        if (isSelected) next.delete(newTxn.id);
                        else next.add(newTxn.id);
                        setSelectedDuplicateIds(next);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${
                        isSelected 
                          ? 'bg-orange-500/10 border-orange-500/50' 
                          : 'bg-[#252525] border-white/5 hover:border-black/10 dark:hover:border-white/20'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-orange-500 border-orange-500' : 'border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40'
                      }`}>
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>

                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Date</div>
                          <div className="text-sm font-mono text-zinc-600 dark:text-zinc-200">{newTxn.date}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Description</div>
                          <div className="text-sm text-white truncate font-medium" title={newTxn.description}>{newTxn.description}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Amount</div>
                          <div className={`text-sm font-bold ${newTxn.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {newTxn.type === 'expense' ? '-' : '+'}${newTxn.amount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-1 bg-[#252525] rounded-lg border border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                        Existing in: {existingTxn.filename || 'Manual'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-[#252525] flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                <span className="text-white font-bold">{reviewData.newTransactions.length}</span> unique transactions will be imported automatically.
                <br/>
                <span className="text-orange-600 dark:text-orange-400 font-bold">{selectedDuplicateIds.size}</span> duplicates selected to import.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setReviewData(null)}
                  className="px-6 py-2.5 bg-[#252525] hover:bg-white/[0.04] text-white rounded-xl font-semibold transition-colors border border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmReview}
                  className="px-8 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
                >
                  Import {reviewData.newTransactions.length + selectedDuplicateIds.size} Transactions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
