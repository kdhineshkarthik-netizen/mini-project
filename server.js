const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const https = require('https');
const querystring = require('querystring');
const nodemailer = require('nodemailer');
const { run, get, all, getLocalDateTimeString } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'btech_college_store_secret_key_2026';

// Alert Cooldown Cache (productId -> timestamp)
const alertCooldowns = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Main Staff POS & Inventory System
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Student Mobile Live Stock Portal (No login required)
app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// AUTHENTICATION & RBAC MIDDLEWARE
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access privilege required' });
  }
  next();
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// PUBLIC STUDENT MOBILE APP API ENDPOINTS
// ==========================================
app.get('/api/public/products', async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = 'SELECT id, barcode, name, category, price, stock_quantity, low_stock_threshold FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (barcode LIKE ? OR name LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name ASC';
    const products = await all(sql, params);

    const formattedProducts = products.map(p => {
      let status = 'IN_STOCK';
      if (p.stock_quantity <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (p.stock_quantity <= (p.low_stock_threshold || 5)) {
        status = 'LOW_STOCK';
      }
      return {
        ...p,
        stock_status: status
      };
    });

    res.json(formattedProducts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/categories', async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT category FROM products ORDER BY category ASC');
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/store-info', async (req, res) => {
  try {
    const totalItemsRow = await get('SELECT COUNT(*) as count FROM products');
    const outOfStockRow = await get('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= 0');
    const lowStockRow = await get('SELECT COUNT(*) as count FROM products WHERE stock_quantity > 0 AND stock_quantity <= low_stock_threshold');
    
    res.json({
      storeName: 'A.V.C. College Cooperative Store',
      operatingHours: '8:30 AM - 5:30 PM (Mon-Sat)',
      announcement: '📢 Live Stock Updates for Campus Students. Check stock availability on your phone before visiting the store!',
      totalProducts: totalItemsRow ? totalItemsRow.count : 0,
      outOfStockCount: outOfStockRow ? outOfStockRow.count : 0,
      lowStockCount: lowStockRow ? lowStockRow.count : 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// INVENTORY / PRODUCTS ROUTES (CRUD)
// ==========================================
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (barcode LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name ASC';
    const products = await all(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/categories', authenticateToken, async (req, res) => {
  try {
    const rows = await all('SELECT DISTINCT category FROM products ORDER BY category ASC');
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { barcode, name, category, price, stock_quantity, low_stock_threshold } = req.body;

    if (!barcode || !name || !category || price == null || stock_quantity == null) {
      return res.status(400).json({ error: 'Missing required product fields' });
    }

    const formattedPrice = Math.round(parseFloat(price) * 100) / 100;

    const result = await run(
      `INSERT INTO products (barcode, name, category, price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [barcode, name, category, formattedPrice, stock_quantity, low_stock_threshold || 5]
    );

    triggerLowStockCheck();
    res.status(201).json({ id: result.lastID, message: 'Product added successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Product barcode already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { barcode, name, category, price, stock_quantity, low_stock_threshold } = req.body;
    const { id } = req.params;

    const formattedPrice = Math.round(parseFloat(price) * 100) / 100;

    await run(
      `UPDATE products
       SET barcode = ?, name = ?, category = ?, price = ?, stock_quantity = ?, low_stock_threshold = ?
       WHERE id = ?`,
      [barcode, name, category, formattedPrice, stock_quantity, low_stock_threshold, id]
    );

    triggerLowStockCheck();
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/:id/restock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { added_quantity } = req.body;

    if (!added_quantity || isNaN(added_quantity)) {
      return res.status(400).json({ error: 'Valid added_quantity required' });
    }

    await run(`UPDATE products SET stock_quantity = MAX(0, stock_quantity + ?) WHERE id = ?`, [
      added_quantity, id
    ]);

    triggerLowStockCheck();
    res.json({ message: 'Stock restocked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POS BILLING & CHECKOUT API
// ==========================================
app.post('/api/pos/checkout', authenticateToken, async (req, res) => {
  try {
    const { items, tax_rate = 5, discount = 0, payment_method = 'Cash' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items cannot be empty' });
    }

    // Verify stock availability for each item first
    for (const item of items) {
      const prod = await get('SELECT stock_quantity, name FROM products WHERE id = ?', [item.id]);
      if (!prod || prod.stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for '${item.name || (prod ? prod.name : item.id)}'. Available: ${prod ? prod.stock_quantity : 0}`
        });
      }
    }

    // Calculate subtotal & grand total
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.quantity;
    }
    const tax = (subtotal * tax_rate) / 100.0;
    const grand_total = Math.max(0, subtotal + tax - discount);

    const lastSale = await get('SELECT MAX(id) AS maxId FROM sales');
    const nextSeq = (lastSale && lastSale.maxId ? lastSale.maxId : 0) + 1;
    const invoice_no = `INV-${String(nextSeq).padStart(4, '0')}`;
    const timestamp = getLocalDateTimeString();

    // Insert Sales Master Record
    const saleResult = await run(
      `INSERT INTO sales (invoice_no, cashier_name, subtotal, tax, discount, grand_total, payment_method, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_no, req.user.name, subtotal, tax, discount, grand_total, payment_method, timestamp]
    );

    const sale_id = saleResult.lastID;

    // Deduct stock and insert line items
    for (const item of items) {
      const line_total = item.price * item.quantity;
      await run(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.id, item.name, item.quantity, item.price, line_total]
      );

      await run(
        `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
        [item.quantity, item.id]
      );
    }

    // Trigger asynchronous background low-stock monitor
    triggerLowStockCheck();

    res.status(201).json({
      message: 'Checkout processed successfully',
      invoice_no,
      timestamp,
      subtotal,
      tax,
      discount,
      grand_total,
      payment_method,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SALES REPORTS & ANALYTICS ROUTES
// ==========================================
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { timeRange, paymentMethod } = req.query;
    let whereConditions = [];
    let params = [];

    // Time filter logic
    if (timeRange === 'today') {
      whereConditions.push("date(timestamp) = date('now', 'localtime')");
    } else if (timeRange === 'week') {
      whereConditions.push("datetime(timestamp) >= datetime('now', 'localtime', '-7 days')");
    } else if (timeRange === 'month') {
      whereConditions.push("datetime(timestamp) >= datetime('now', 'localtime', '-30 days')");
    }

    if (paymentMethod && paymentMethod !== 'All') {
      whereConditions.push("payment_method = ?");
      params.push(paymentMethod);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 1. All Sales Transactions
    const sales = await all(`SELECT * FROM sales ${whereClause} ORDER BY id DESC`, params);

    // 2. Summary KPI Metrics
    const kpis = {
      totalRevenue: sales.reduce((acc, s) => acc + s.grand_total, 0),
      totalTransactions: sales.length,
      averageOrderValue: sales.length > 0 ? (sales.reduce((acc, s) => acc + s.grand_total, 0) / sales.length) : 0,
      totalTax: sales.reduce((acc, s) => acc + s.tax, 0)
    };

    // 3. Payment Method Distribution
    const paymentBreakdown = {};
    sales.forEach(s => {
      paymentBreakdown[s.payment_method] = (paymentBreakdown[s.payment_method] || 0) + s.grand_total;
    });

    // 4. Top Selling Products
    let topProductsQuery = `
      SELECT si.product_name, SUM(si.quantity) as total_qty, SUM(si.total_price) as total_sales
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      ${whereClause}
      GROUP BY si.product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `;
    const topProducts = await all(topProductsQuery, params);

    // 5. Daily Revenue Trend Query
    let dailyTrendQuery = `
      SELECT date(timestamp) as date_str, SUM(grand_total) as daily_revenue, COUNT(id) as tx_count
      FROM sales
      ${whereClause}
      GROUP BY date(timestamp)
      ORDER BY date_str ASC
    `;
    const dailyTrend = await all(dailyTrendQuery, params);

    // 6. Category Performance Breakdown Query
    let categoryBreakdownQuery = `
      SELECT p.category, SUM(si.quantity) as total_qty, SUM(si.total_price) as total_sales
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      ${whereClause}
      GROUP BY p.category
      ORDER BY total_sales DESC
    `;
    const categoryBreakdown = await all(categoryBreakdownQuery, params);

    // 7. Items breakdown per sale
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      const items = await all('SELECT product_name, quantity, unit_price, total_price FROM sale_items WHERE sale_id = ?', [sale.id]);
      const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);
      return { ...sale, items, totalItemCount };
    }));

    res.json({
      kpis,
      paymentBreakdown,
      topProducts,
      dailyTrend,
      categoryBreakdown,
      sales: salesWithItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales/:invoiceNo', authenticateToken, async (req, res) => {
  try {
    const sale = await get('SELECT * FROM sales WHERE invoice_no = ?', [req.params.invoiceNo]);
    if (!sale) return res.status(404).json({ error: 'Invoice not found' });

    const items = await all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    res.json({ ...sale, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SETTINGS & ALERT LOGS ROUTES
// ==========================================
app.get('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await all('SELECT * FROM alert_logs ORDER BY id DESC LIMIT 50');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/test-alert', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, admin_email } = req.body;

    if (!smtp_user || !smtp_pass || !admin_email) {
      return res.status(400).json({ error: 'Please provide SMTP Username, Password, and Admin Email for testing' });
    }

    const result = await sendNodemailerEmail(
      smtp_host || 'smtp.gmail.com',
      smtp_port || 587,
      smtp_user,
      smtp_pass,
      admin_email,
      'Test Inventory Item',
      2,
      10
    );

    if (result.success) {
      await logAlert('System Test Item', 2, 'Nodemailer Email', admin_email, 'SUCCESS', result.detail);
      res.json({ message: 'Test email dispatched successfully via Nodemailer!', detail: result.detail });
    } else {
      await logAlert('System Test Item', 2, 'Nodemailer Email', admin_email, 'FAILED', result.detail);
      res.status(400).json({ error: 'Failed to send Test Email via Nodemailer', detail: result.detail });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NODEMAILER LOW-STOCK ALERT ENGINE
// ==========================================
async function logAlert(product_name, stock_left, channel, recipient, status, detail = '') {
  const timestamp = getLocalDateTimeString();
  await run(
    `INSERT INTO alert_logs (timestamp, product_name, stock_left, channel, recipient, status, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [timestamp, product_name, stock_left, channel, recipient, status, detail]
  );
}

async function sendNodemailerEmail(smtpHost, smtpPort, smtpUser, smtpPass, adminEmail, productName, stockLeft, threshold) {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: parseInt(smtpPort) || 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Campus Store System" <${smtpUser || 'no-reply@college.edu'}>`,
      to: adminEmail,
      subject: `🚨 LOW STOCK ALERT: ${productName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ef4444; border-radius: 8px;">
          <h2 style="color: #dc2626;">URGENT COLLEGE STORE ALERT</h2>
          <p>The following product has fallen below the defined low-stock threshold:</p>
          <ul>
            <li><b>Product Name:</b> ${productName}</li>
            <li><b>Current Stock:</b> <span style="color: #dc2626; font-weight: bold;">${stockLeft} units</span></li>
            <li><b>Low Stock Threshold:</b> ${threshold} units</li>
          </ul>
          <p>Please log in to the Campus Store Inventory Management System to restock immediately.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, detail: `MsgId: ${info.messageId}` };
  } catch (err) {
    return { success: false, detail: err.message };
  }
}

async function checkLowStockAndAlert() {
  try {
    const lowStockProducts = await all('SELECT * FROM products WHERE stock_quantity <= low_stock_threshold');
    if (lowStockProducts.length === 0) return;

    const rows = await all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);

    const now = Date.now();
    const adminEmail = settings.admin_email;

    for (const prod of lowStockProducts) {
      // 30-minute alert cooldown per product
      const lastAlertTime = alertCooldowns.get(prod.id);
      if (lastAlertTime && (now - lastAlertTime) < 1800000) {
        continue;
      }

      // Nodemailer Email dispatch
      if (settings.smtp_user && settings.smtp_pass && adminEmail) {
        const emailRes = await sendNodemailerEmail(
          settings.smtp_host, settings.smtp_port, settings.smtp_user, settings.smtp_pass,
          adminEmail, prod.name, prod.stock_quantity, prod.low_stock_threshold
        );
        await logAlert(prod.name, prod.stock_quantity, 'Nodemailer Email', adminEmail, emailRes.success ? 'SUCCESS' : 'FAILED', emailRes.detail);
        alertCooldowns.set(prod.id, now);
      }
    }
  } catch (err) {
    console.error('Low stock monitor worker error:', err);
  }
}

function triggerLowStockCheck() {
  setTimeout(checkLowStockAndAlert, 500);
}

// Background Periodic Worker (Checks every 60 seconds)
setInterval(checkLowStockAndAlert, 60000);

// Start Server
const server = app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` A.V.C.C.E  Store POS & Inventory Management Server Running!`);
  console.log(` Application URL to use system: http://localhost:${PORT}`);
  console.log(` Credentials: Admin (admin/admin123) | Cashier (cashier/cashier123)`);
  console.log(`===================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process!`);
  } else {
    console.error(`❌ Server startup error:`, err);
  }
});
