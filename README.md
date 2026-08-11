# 🎓 Full-Stack College Store Billing & Inventory System

A complete full-stack web application built using **Node.js (Express)**, **SQLite**, **HTML5/CSS3 (Glassmorphic UI)**, and **Nodemailer SMTP Integration** for low-stock email alerts.

---

## 🌟 Key System Modules & Features

### 1. 🔑 Role-Based Access Control (RBAC) & JWT Security
- **Admin Role**: Full access to Inventory Management (CRUD), User Management, SMTP Gateway Configuration, and Sales Alert Logs.
- **Cashier Role**: Access restricted to POS Billing Console, Barcode Scanner simulator, and Printable Receipts.

### 2. 💳 POS Billing & Receipt Writer
- **Barcode Simulator**: Type/scan item barcodes (e.g. `8901001`) to automatically add items to cart.
- **Real-Time Total Engine**: Automatically tallies item line totals, GST Tax (5%), discount amounts, and Grand Total.
- **Printable Receipts**: Uses custom `@media print` CSS rules and `window.print()` to generate downloadable or physical paper bill receipts.

### 3. 📦 Real-Time Inventory Management Dashboard
- **Stock Status Badges**: Visual status indicators (`🟢 Normal`, `⚠️ LOW STOCK`, `🔴 Out of Stock`).
- **Automated Stock Deduction**: Deducts stock quantities inside a database transaction whenever an invoice is finalized.
- **CRUD Operations**: Add, Edit, Delete products, and Restock inventory counts.

### 4. ✉️ Nodemailer Low-Stock Email Worker
- **Background Worker**: Periodically monitors product stock counts against defined `low_stock_threshold`.
- **Nodemailer SMTP Integration**: Dispatches automated email notifications directly to the storekeeper's email address.
- **Alert Cooldown Engine**: Prevents spamming email alerts for the same item within a 30-minute window.

---

## 📂 Database Schema (`college_store.db`)

* **`users`**: `id`, `username`, `password_hash`, `role` (`admin`/`cashier`), `name`, `email`
* **`products`**: `id`, `barcode`, `name`, `category`, `price`, `stock_quantity`, `low_stock_threshold`
* **`sales`**: `id`, `invoice_no`, `cashier_name`, `subtotal`, `tax`, `discount`, `grand_total`, `payment_method`, `timestamp`
* **`sale_items`**: `id`, `sale_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`
* **`settings`**: `key`, `value` *(SMTP host, port, user, pass, admin_email)*
* **`alert_logs`**: `id`, `timestamp`, `product_name`, `stock_left`, `channel`, `recipient`, `status`, `detail`

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies
Open terminal/command prompt in the project directory:
```bash
npm install
```

### Step 2: Start the Node.js Express Server
```bash
npm start
```
The server will run on `http://localhost:3000`.

### Step 3: Access the Web Portal
Open `http://localhost:3000` in any web browser.

#### Demo Credentials:
- **Store Admin**: Username: `admin` | Password: `admin123`
- **Campus Cashier**: Username: `cashier` | Password: `cashier123`

---

## ⚙️ Nodemailer Email Alert Setup

1. Log in as **Admin**.
2. Click **⚙️ Alert Settings** in the top navigation bar.
3. Enter your **SMTP Host**, **SMTP Port**, **Sender Email / App Password**, and **Admin Notification Email**.
4. Click **📩 Send Live Test Email** to verify instant email dispatch.
5. Click **Save Settings**.
