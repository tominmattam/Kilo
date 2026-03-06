# Kilo - Local-First Personal Finance Tracker

Kilo is a privacy-focused, local-first personal finance application that helps you track expenses, manage budgets, and visualize your net worth without sending your data to the cloud.

![Kilo Dashboard](https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=2000)

## 🔒 Privacy First
Your financial data is yours. Kilo operates entirely on your local machine:
- **No Cloud Sync:** Data is stored in a local JSON file (`data/fintrack_data.json`) or your browser's LocalStorage.
- **No External Servers:** Your bank statements are parsed locally in your browser.
- **Open Source:** You can audit the code to verify no data leaves your device.

## ✨ Features
- **Universal Import:** Drag & drop CSV or Excel files from any bank. The smart parser automatically detects date, amount, and description columns.
- **AI Categorization:** Learns from your edits to automatically categorize future transactions.
- **Interactive Dashboard:** Visualize spending trends, net worth, and cash flow with Sankey diagrams.
- **Budgeting:** Set monthly budgets for categories and track your progress.
- **Recurring Bills:** Track subscriptions and upcoming bills.
- **Net Worth Tracking:** Manually track assets and liabilities to see your total net worth over time.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/kilo.git
   cd kilo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000` to start using Kilo.

## 🛠️ Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Recharts, Framer Motion
- **Backend (Local):** Express.js (serves the app and handles local file I/O)
- **Build Tool:** Vite

## 📂 Data Management
- **Backup:** You can download a full JSON backup of your data from the "Data Sources" page.
- **Restore:** Restore your data from a backup file at any time.
- **Reset:** A "Factory Reset" option is available if you want to clear all data and start fresh.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the PolyForm Noncommercial License 1.0.0 - see the [LICENSE](LICENSE) file for details.
