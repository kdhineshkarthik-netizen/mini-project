const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'college_store.db');
const db = new sqlite3.Database(DB_PATH);

// Wrap sqlite3 methods in Promises for clean async/await usage
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper function to format local timestamp as YYYY-MM-DD HH:mm:ss
function getLocalDateTimeString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Database Initialization & Schema Definition
async function initDatabase() {
  try {
    // 1. Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT
      )
    `);

    // 2. Products / Inventory Table
    await run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5
      )
    `);

    // 3. Sales Invoice Master Table
    await run(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE NOT NULL,
        cashier_name TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        discount REAL NOT NULL,
        grand_total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    // 4. Sale Items Table
    await run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      )
    `);

    // 5. System Settings Table
    await run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // 6. Alert Notification Logs Table
    await run(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        product_name TEXT NOT NULL,
        stock_left INTEGER NOT NULL,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT
      )
    `);

    // Seed default admin and cashier users if empty
    const userCount = await get('SELECT COUNT(*) AS count FROM users');
    if (userCount.count === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const cashierHash = await bcrypt.hash('cashier123', 10);

      await run(`INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)`, [
        'admin', adminHash, 'admin', 'Store Admin', 'admin@college.edu'
      ]);
      await run(`INSERT INTO users (username, password_hash, role, name, email) VALUES (?, ?, ?, ?, ?)`, [
        'cashier', cashierHash, 'cashier', 'Campus Cashier', 'cashier@college.edu'
      ]);
      console.log('Seeded default users: admin (admin/admin123), cashier (cashier/cashier123)');
    }

    // Seed default inventory products if empty
    const prodCount = await get('SELECT COUNT(*) AS count FROM products');
    if (prodCount.count === 0) {
      const sampleProducts = [
        ['8901001', 'Spiral Notebook 200 Pages', 'Stationery', 75.00, 25, 5],
        ['8901002', 'Reynolds Blue Gel Pen (5-Pack)', 'Stationery', 50.00, 35, 5],
        ['8901003', 'Casio FX-991EX Scientific Calc', 'Electronics', 1295.00, 4, 3],
        ['8901004', 'Campus Lanyard & ID Holder', 'Accessories', 60.00, 3, 5],
        ['8901005', 'College Cotton Lab Coat (Size M)', 'Apparel', 450.00, 2, 5],
        ['8901006', 'A4 Printing Paper Bundle (500 sheets)', 'Stationery', 290.00, 18, 5],
        ['8901007', 'SanDisk 64GB USB 3.0 Pen Drive', 'Electronics', 550.00, 2, 5],
        ['8901008', 'Engineering Graph & Sheet Pack', 'Stationery', 45.00, 40, 10],
        ['8901009', 'Faber-Castell Highlighter Set', 'Stationery', 110.00, 12, 5],
        ['8901010', '3M Post-It Sticky Notes (3x3 inch)', 'Stationery', 35.00, 15, 5]
      ];

      for (const p of sampleProducts) {
        await run(`
          INSERT INTO products (barcode, name, category, price, stock_quantity, low_stock_threshold)
          VALUES (?, ?, ?, ?, ?, ?)
        `, p);
      }
      console.log('Seeded 10 campus store products into SQLite database');
    }

    // Seed default settings if empty
    const defaultSettings = {
      smtp_host: 'smtp.gmail.com',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      admin_email: 'storekeeper@college.edu',
      alert_channel: 'email'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }

    // Seed sample sales if empty
    const salesCount = await get('SELECT COUNT(*) AS count FROM sales');
    if (salesCount.count === 0) {
      const now = new Date();
      const formatDate = (offsetDays) => {
        const d = new Date(now.getTime() - offsetDays * 86400000);
        return getLocalDateTimeString(d);
      };

      const sampleSales = [
        {
          invoice_no: 'INV-0001',
          cashier_name: 'Campus Cashier',
          subtotal: 350.00,
          tax: 17.50,
          discount: 15.00,
          grand_total: 352.50,
          payment_method: 'UPI / QR Code',
          timestamp: formatDate(0),
          items: [
            { product_id: 1, product_name: 'Spiral Notebook 200 Pages', quantity: 2, unit_price: 75.00, total_price: 150.00 },
            { product_id: 2, product_name: 'Reynolds Blue Gel Pen (5-Pack)', quantity: 4, unit_price: 50.00, total_price: 200.00 }
          ]
        },
        {
          invoice_no: 'INV-0002',
          cashier_name: 'Store Admin',
          subtotal: 1295.00,
          tax: 64.75,
          discount: 50.00,
          grand_total: 1309.75,
          payment_method: 'Debit/Credit Card',
          timestamp: formatDate(1),
          items: [
            { product_id: 3, product_name: 'Casio FX-991EX Scientific Calc', quantity: 1, unit_price: 1295.00, total_price: 1295.00 }
          ]
        },
        {
          invoice_no: 'INV-0003',
          cashier_name: 'Campus Cashier',
          subtotal: 410.00,
          tax: 20.50,
          discount: 10.00,
          grand_total: 420.50,
          payment_method: 'Cash',
          timestamp: formatDate(2),
          items: [
            { product_id: 4, product_name: 'Campus Lanyard & ID Holder', quantity: 2, unit_price: 60.00, total_price: 120.00 },
            { product_id: 6, product_name: 'A4 Printing Paper Bundle (500 sheets)', quantity: 1, unit_price: 290.00, total_price: 290.00 }
          ]
        },
        {
          invoice_no: 'INV-0004',
          cashier_name: 'Campus Cashier',
          subtotal: 600.00,
          tax: 30.00,
          discount: 20.00,
          grand_total: 610.00,
          payment_method: 'Student Pass',
          timestamp: formatDate(4),
          items: [
            { product_id: 7, product_name: 'SanDisk 64GB USB 3.0 Pen Drive', quantity: 1, unit_price: 550.00, total_price: 550.00 },
            { product_id: 2, product_name: 'Reynolds Blue Gel Pen (5-Pack)', quantity: 1, unit_price: 50.00, total_price: 50.00 }
          ]
        },
        {
          invoice_no: 'INV-0005',
          cashier_name: 'Store Admin',
          subtotal: 560.00,
          tax: 28.00,
          discount: 0.00,
          grand_total: 588.00,
          payment_method: 'UPI / QR Code',
          timestamp: formatDate(6),
          items: [
            { product_id: 5, product_name: 'College Cotton Lab Coat (Size M)', quantity: 1, unit_price: 450.00, total_price: 450.00 },
            { product_id: 9, product_name: 'Faber-Castell Highlighter Set', quantity: 1, unit_price: 110.00, total_price: 110.00 }
          ]
        }
      ];

      for (const s of sampleSales) {
        const saleResult = await run(`
          INSERT INTO sales (invoice_no, cashier_name, subtotal, tax, discount, grand_total, payment_method, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [s.invoice_no, s.cashier_name, s.subtotal, s.tax, s.discount, s.grand_total, s.payment_method, s.timestamp]);

        const saleId = saleResult.lastID;
        for (const item of s.items) {
          await run(`
            INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, item.total_price]);
        }
      }
      console.log('Seeded 5 sample sales transactions into SQLite database');
    }
  } catch (err) {
    console.error('DB Init Error:', err);
  }
}

initDatabase().catch(err => console.error('DB Init Error:', err));

module.exports = {
  db,
  run,
  get,
  all,
  getLocalDateTimeString
};
