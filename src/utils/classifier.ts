import { Transaction } from '../types';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'inc', 'ltd', 'llc', 'corp', 'corporation', 'co', 'company', 'limited', 'payment', 'purchase',
  'transaction', 'transfer', 'withdrawal', 'deposit', 'check', 'cheque', 'pos', 'debit', 'credit',
  'card', 'bank', 'mobile', 'online', 'authorized', 'preauthorized', 'recur', 'recurring', 'bill',
  'pay', 'fee', 'charge', 'invoice', 'ref', 'reference', 'id', 'no', 'number', 'date', 'time',
  'amount', 'total', 'subtotal', 'tax', 'hst', 'gst', 'pst', 'vat', 'sales', 'service', 'services'
]);

export class TransactionClassifier {
  wordCounts: Map<string, Map<string, number>>; // Category -> Word -> Count
  categoryCounts: Map<string, number>; // Category -> Count
  totalTransactions: number;
  vocabulary: Set<string>;

  constructor() {
    this.wordCounts = new Map();
    this.categoryCounts = new Map();
    this.totalTransactions = 0;
    this.vocabulary = new Set();
  }

  train(transactions: Transaction[]) {
    // Reset
    this.wordCounts.clear();
    this.categoryCounts.clear();
    this.totalTransactions = 0;
    this.vocabulary.clear();

    transactions.forEach(t => {
      if (!t.category || t.category === 'Uncategorized' || t.category === 'Transfer' || t.category === 'Credit Card Payment') return;

      this.totalTransactions++;
      const cat = t.category;
      const tokens = this.tokenize(t.description);

      // Update category count
      this.categoryCounts.set(cat, (this.categoryCounts.get(cat) || 0) + 1);

      // Update word counts
      if (!this.wordCounts.has(cat)) {
        this.wordCounts.set(cat, new Map());
      }
      const catWords = this.wordCounts.get(cat)!;

      tokens.forEach(token => {
        this.vocabulary.add(token);
        catWords.set(token, (catWords.get(token) || 0) + 1);
      });
    });
  }

  predict(description: string): { category: string; confidence: number; debug?: string } {
    const tokens = this.tokenize(description);
    if (tokens.length === 0) {
        return { category: 'Uncategorized', confidence: 0 };
    }

    let maxScore = -Infinity;
    let bestCat = 'Uncategorized';
    
    // Calculate score for each category
    for (const cat of this.categoryCounts.keys()) {
      const catCount = this.categoryCounts.get(cat)!;
      const catWords = this.wordCounts.get(cat)!;
      const totalWordsInCat = Array.from(catWords.values()).reduce((a, b) => a + b, 0);
      
      // P(Category)
      // We use log probabilities to avoid underflow
      let score = Math.log(catCount / this.totalTransactions);

      // P(Word | Category)
      tokens.forEach(token => {
        const wordCount = catWords.get(token) || 0;
        // Laplace smoothing: (count + 1) / (total_words_in_cat + vocab_size)
        const prob = (wordCount + 1) / (totalWordsInCat + this.vocabulary.size);
        score += Math.log(prob);
      });

      if (score > maxScore) {
        maxScore = score;
        bestCat = cat;
      }
    }

    // Normalize confidence to 0-1 range (very roughly)
    // This is tricky with log probs, so we'll just return the raw log score for now
    // or we can softmax it if we really need a percentage, but raw comparison is enough
    
    return { category: bestCat, confidence: maxScore };
  }

  tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }
  
  getStats() {
      return {
          vocabSize: this.vocabulary.size,
          categories: this.categoryCounts.size,
          trainedOn: this.totalTransactions
      };
  }
}

export const classifier = new TransactionClassifier();
