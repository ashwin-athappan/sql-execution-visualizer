# SQL Execution Visualizer 🚀

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://sql-execution-visualizer.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

A powerful, interactive web application designed to help developers and students understand how a database engine processes SQL queries step-by-step. Witness the magic of query execution pipelines, B+ Tree index structures, and live data transformations in real-time.

## ✨ Key Features

- **🔀 Real-time Execution Pipeline**: Visualize the logical execution order (FROM → JOIN → WHERE → ...) and see how data flows through each operator.
- **🌳 Interactive B+ Tree**: Watch your indexes grow, split, and balance as you insert data. Perfect for understanding internal database storage.
- **📊 Live Table Data**: Monitor raw table contents with real-time highlighting for inserts, updates, and deletes.
- **💻 Pro Code Editor**: Built-in Monaco editor (VS Code's engine) with SQL syntax highlighting and intelligent autocomplete.
- **🏗️ Custom SQL Engine**: Experience a hand-crafted SQL parser and executor built from scratch in TypeScript.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- npm, yarn, or pnpm

### Installation & Run

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashwin-athappan/sql-execution-visualizer.git
   cd sql-execution-visualizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Visit the app**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Tutorial

### 1. Create a Table 🏗️
Start by defining your schema. Define columns with data types and constraints.
```sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  name TEXT,
  age INT NOT NULL
);
```
*Tip: Every table needs a PRIMARY KEY to initialize the B+ Tree.*

### 2. Insert Data 📥
Add rows and watch the B+ Tree visualization. You'll see node traversals, splits, and rebalancing.
```sql
INSERT INTO users VALUES (1, 'Alice', 30);
INSERT INTO users VALUES (2, 'Bob', 25);
INSERT INTO users VALUES (3, 'Charlie', 35);
```
*Tip: Run one INSERT at a time to see each tree operation clearly.*

### 3. Query with Pipeline Flow 🔀
Run a query and switch to the **Pipeline Flow** tab to see data transformation.
```sql
SELECT * FROM users
WHERE age > 25
ORDER BY age ASC;
```
*Tip: Click "▶ Play" to auto-step through the execution stages.*

### 4. Explore Internal Structures 🌳
- **B+ Tree View**: See the internal index structure. Green highlights show the active traversal path.
- **Table Data View**: See raw contents. Rows glow green on insert, red on delete, and yellow on update.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘ + Enter` | Execute SQL query |
| `Tab` | Autocomplete / Insert spaces |
| `↑ / ↓` | Navigate autocomplete suggestions |
| `Escape` | Close autocomplete popup |

---

## 📚 Supported SQL

- **DDL**: `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `CREATE INDEX`, `DROP INDEX`
- **DML**: `INSERT INTO`, `UPDATE`, `DELETE FROM`
- **Queries**: 
  - `SELECT` (with *, columns, aliases)
  - `WHERE` (=, >, <, LIKE, AND, OR)
  - `JOIN` (INNER, LEFT)
  - `GROUP BY` + `HAVING`
  - `ORDER BY` (ASC/DESC)
  - `LIMIT`
  - Aggregates: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Visuals**: Custom CSS & SVG transitions

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
