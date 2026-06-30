/* ==========================================================================
   1. APP STATE & INITIALIZATION
   ========================================================================== */
let purchases = JSON.parse(localStorage.getItem('landed_purchases')) || [];
let activeView = 'dashboard';
let chartMonthlyInstance = null;
let chartExpensesInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    setupTheme();
    setupFormEvents();
    setupTableFilters();
    
    // Initial Render on Load - Syncs LocalStorage with UI instantly
    renderApp();
}

/* ==========================================================================
   2. NAVIGATION & THEME TOGGLE
   ========================================================================== */
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            
            // Toggle active menu class
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            // Switch views
            document.querySelectorAll('.view-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`view-${target}`).classList.add('active');
            
            // Header Title Update
            document.getElementById('page-title').textContent = item.textContent;
            
            activeView = target;
            renderApp(); // Re-render target specific features
        });
    });

    // Close Modal setup
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('details-modal').classList.remove('active');
    });
}

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    themeToggle.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

/* ==========================================================================
   3. PURCHASE FORM & LIVE CALCULATIONS
   ========================================================================== */
function setupFormEvents() {
    const form = document.getElementById('purchase-form');
    const addExpenseBtn = document.getElementById('btn-add-expense');
    
    // Live calculation triggers on input changes
    form.addEventListener('input', calculateLiveSummary);

    // Dynamic Expense Adder
    addExpenseBtn.addEventListener('click', () => {
        const container = document.getElementById('custom-expenses-container');
        const uniqueId = 'cust-' + Date.now();
        
        const row = document.createElement('div');
        row.className = 'custom-expense-row';
        row.id = uniqueId;
        row.innerHTML = `
            <div class="form-group" style="flex:2; margin-bottom:0;">
                <label>Custom Title</label>
                <input type="text" class="cust-title" placeholder="e.g., Toll Tax" required>
            </div>
            <div class="form-group" style="flex:1; margin-bottom:0;">
                <label>Amount (₹)</label>
                <input type="number" class="cust-amount expense-input" min="0" value="0" required>
            </div>
            <div class="form-group" style="flex:2; margin-bottom:0;">
                <label>Reason</label>
                <input type="text" class="cust-reason" placeholder="Highway Toll">
            </div>
            <button type="button" class="btn btn-danger btn-xs" onclick="document.getElementById('${uniqueId}').remove(); calculateLiveSummary();" style="height: 38px; margin-bottom: 2px;">X</button>
        `;
        container.appendChild(row);
    });

    // Handle form submit (Save Purchase)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        savePurchase();
    });
}

function calculateLiveSummary() {
    const qty = parseFloat(document.getElementById('p-qty').value) || 0;
    const rate = parseFloat(document.getElementById('p-rate').value) || 0;

    // Base Product Cost
    const productCost = qty * rate;
    
    // Core Expenses
    const hamali = parseFloat(document.getElementById('exp-hamali').value) || 0;
    const transport = parseFloat(document.getElementById('exp-transport').value) || 0;
    const roomTransport = parseFloat(document.getElementById('exp-room').value) || 0;
    
    // Custom Expenses
    let customExpensesTotal = 0;
    document.querySelectorAll('.custom-expense-row').forEach(row => {
        const amt = parseFloat(row.querySelector('.cust-amount').value) || 0;
        customExpensesTotal += amt;
    });

    const totalExpenses = hamali + transport + roomTransport + customExpensesTotal;
    const grandTotal = productCost + totalExpenses;
    const avgCost = qty > 0 ? (grandTotal / qty) : 0;

    // DOM Updates
    document.getElementById('calc-prod-cost').textContent = `₹${productCost.toFixed(2)}`;
    document.getElementById('calc-total-exp').textContent = `₹${totalExpenses.toFixed(2)}`;
    document.getElementById('calc-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
    document.getElementById('calc-avg-cost').textContent = `₹${avgCost.toFixed(2)}`;

    return { productCost, totalExpenses, grandTotal, avgCost };
}

function savePurchase() {
    const calcs = calculateLiveSummary();
    const form = document.getElementById('purchase-form');
    
    // Parse Custom Expenses
    const customExpenses = [];
    document.querySelectorAll('.custom-expense-row').forEach(row => {
        customExpenses.push({
            title: row.querySelector('.cust-title').value,
            amount: parseFloat(row.querySelector('.cust-amount').value) || 0,
            reason: row.querySelector('.cust-reason').value
        });
    });

    const purchaseId = form.dataset.editId || 'p-' + Date.now();

    const purchaseData = {
        id: purchaseId,
        title: document.getElementById('p-title').value,
        supplier: document.getElementById('p-supplier').value,
        invoice: document.getElementById('p-invoice').value,
        date: document.getElementById('p-date').value,
        productName: document.getElementById('p-prod-name').value,
        category: document.getElementById('p-category').value || 'Unassigned',
        brand: document.getElementById('p-brand').value || 'Generic',
        sku: document.getElementById('p-sku').value || 'N/A',
        qty: parseInt(document.getElementById('p-qty').value) || 0,
        rate: parseFloat(document.getElementById('p-rate').value) || 0,
        expenses: {
            hamali: parseFloat(document.getElementById('exp-hamali').value) || 0,
            transport: parseFloat(document.getElementById('exp-transport').value) || 0,
            roomTransport: parseFloat(document.getElementById('exp-room').value) || 0,
            custom: customExpenses
        },
        calculations: calcs
    };

    if (form.dataset.editId) {
        // Edit mode
        purchases = purchases.map(p => p.id === purchaseId ? purchaseData : p);
        delete form.dataset.editId;
        showToast('Purchase updated successfully!');
    } else {
        // New mode
        purchases.push(purchaseData);
        showToast('Purchase saved locally!');
    }

    localStorage.setItem('landed_purchases', JSON.stringify(purchases));
    form.reset();
    document.getElementById('custom-expenses-container').innerHTML = '';
    calculateLiveSummary();
    
    // Redirect to history view programmatically
    document.querySelector('[data-target="purchase-history"]').click();
}

/* ==========================================================================
   4. RENDER ENGINE & DISPATCHER
   ========================================================================== */
function renderApp() {
    renderDashboard();
    renderHistoryTable();
    renderInventoryTable();
    if (activeView === 'reports') renderReports();
    
    // Sync Supplier filter options across History view
    syncSupplierFilters();
}

function renderDashboard() {
    const totalInventoryValue = purchases.reduce((acc, curr) => acc + curr.calculations.grandTotal, 0);
    const totalExpenses = purchases.reduce((acc, curr) => acc + curr.calculations.totalExpenses, 0);
    
    document.getElementById('dash-total-value').textContent = `₹${totalInventoryValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('dash-total-purchases').textContent = purchases.length;
    document.getElementById('dash-total-expenses').textContent = `₹${totalExpenses.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
}

/* ==========================================================================
   5. PURCHASE HISTORY ENGINE (CRUD)
   ========================================================================== */
function setupTableFilters() {
    document.getElementById('history-search').addEventListener('input', renderHistoryTable);
    document.getElementById('history-filter-supplier').addEventListener('change', renderHistoryTable);
    document.getElementById('inventory-search').addEventListener('input', renderInventoryTable);
    
    // Global data wipe via Settings
    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if(confirm('Are you absolutely sure you want to clear ALL inventory data? This cannot be undone.')){
            localStorage.removeItem('landed_purchases');
            purchases = [];
            showToast('All app data wiped.');
            renderApp();
        }
    });
}

function syncSupplierFilters() {
    const select = document.getElementById('history-filter-supplier');
    if(!select) return;
    const currentVal = select.value;
    const uniqueSuppliers = [...new Set(purchases.map(p => p.supplier))];
    
    select.innerHTML = '<option value="">All Suppliers</option>';
    uniqueSuppliers.forEach(sup => {
        select.innerHTML += `<option value="${sup}">${sup}</option>`;
    });
    select.value = currentVal;
}

function renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    if(!tbody) return;
    const search = document.getElementById('history-search').value.toLowerCase();
    const supplierFilter = document.getElementById('history-filter-supplier').value;

    tbody.innerHTML = '';

    const filtered = purchases.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(search) || p.productName.toLowerCase().includes(search);
        const matchesSupplier = supplierFilter === '' || p.supplier === supplierFilter;
        return matchesSearch && matchesSupplier;
    });

    filtered.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.date}</td>
            <td><strong>${p.title}</strong></td>
            <td>${p.supplier}</td>
            <td>${p.productName}</td>
            <td>${p.qty}</td>
            <td>₹${p.calculations.productCost.toFixed(2)}</td>
            <td>₹${p.calculations.grandTotal.toFixed(2)}</td>
            <td><strong>₹${p.calculations.avgCost.toFixed(2)}</strong></td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-xs" onclick="viewPurchaseDetails('${p.id}')">View</button>
                <button class="btn btn-primary btn-xs" onclick="editPurchase('${p.id}')">Edit</button>
                <button class="btn btn-secondary btn-xs" onclick="duplicatePurchase('${p.id}')">Dup</button>
                <button class="btn btn-danger btn-xs" onclick="deletePurchase('${p.id}')">Del</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/* CRUD Action Routing Functions */
window.viewPurchaseDetails = function(id) {
    const p = purchases.find(p => p.id === id);
    if(!p) return;

    let customExpHTML = '';
    p.expenses.custom.forEach(ce => {
        customExpHTML += `<tr><td>${ce.title} (Custom)</td><td>₹${ce.amount.toFixed(2)}</td><td>${ce.reason}</td></tr>`;
    });

    const body = document.getElementById('modal-details-body');
    body.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
            <div><strong>Supplier:</strong> ${p.supplier}</div>
            <div><strong>Invoice ID:</strong> ${p.invoice || 'N/A'}</div>
            <div><strong>Date:</strong> ${p.date}</div>
            <div><strong>SKU Tracking:</strong> ${p.sku}</div>
        </div>
        <table style="margin-bottom:1.5rem;">
            <thead><tr><th>Component</th><th>Costing Breakdown</th><th>Notes / Details</th></tr></thead>
            <tbody>
                <tr><td>Product Base Cost</td><td>₹${p.calculations.productCost.toFixed(2)}</td><td>${p.qty} Units @ ₹${p.rate}/pc</td></tr>
                <tr><td>Hamali charges</td><td>₹${p.expenses.hamali.toFixed(2)}</td><td>Direct Expense</td></tr>
                <tr><td>Main Transport</td><td>₹${p.expenses.transport.toFixed(2)}</td><td>Direct Expense</td></tr>
                <tr><td>Local Room Freight</td><td>₹${p.expenses.roomTransport.toFixed(2)}</td><td>Direct Expense</td></tr>
                ${customExpHTML}
            </tbody>
        </table>
        <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius);">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;"><strong>Grand Landed Value:</strong> <span>₹${p.calculations.grandTotal.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:1.2rem; color:var(--primary-color);"><strong>Final Landed Cost/Piece:</strong> <span>₹${p.calculations.avgCost.toFixed(2)}</span></div>
        </div>
    `;
    
    document.getElementById('modal-title').textContent = p.title;
    document.getElementById('details-modal').classList.add('active');
};

window.editPurchase = function(id) {
    const p = purchases.find(p => p.id === id);
    if(!p) return;

    // Load simple fields
    document.getElementById('p-title').value = p.title;
    document.getElementById('p-supplier').value = p.supplier;
    document.getElementById('p-invoice').value = p.invoice;
    document.getElementById('p-date').value = p.date;
    document.getElementById('p-prod-name').value = p.productName;
    document.getElementById('p-category').value = p.category;
    document.getElementById('p-brand').value = p.brand;
    document.getElementById('p-sku').value = p.sku;
    document.getElementById('p-qty').value = p.qty;
    document.getElementById('p-rate').value = p.rate;
    
    document.getElementById('exp-hamali').value = p.expenses.hamali;
    document.getElementById('exp-transport').value = p.expenses.transport;
    document.getElementById('exp-room').value = p.expenses.roomTransport;

    // Reconstruct Custom Expenses Rows
    const container = document.getElementById('custom-expenses-container');
    container.innerHTML = '';
    p.expenses.custom.forEach(ce => {
        const uniqueId = 'cust-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const row = document.createElement('div');
        row.className = 'custom-expense-row';
        row.id = uniqueId;
        row.innerHTML = `
            <div class="form-group" style="flex:2; margin-bottom:0;">
                <input type="text" class="cust-title" value="${ce.title}" required>
            </div>
            <div class="form-group" style="flex:1; margin-bottom:0;">
                <input type="number" class="cust-amount expense-input" value="${ce.amount}" required>
            </div>
            <div class="form-group" style="flex:2; margin-bottom:0;">
                <input type="text" class="cust-reason" value="${ce.reason}">
            </div>
            <button type="button" class="btn btn-danger btn-xs" onclick="document.getElementById('${uniqueId}').remove(); calculateLiveSummary();" style="height:38px;">X</button>
        `;
        container.appendChild(row);
    });

    // Set Edit State Flag Anchor
    document.getElementById('purchase-form').dataset.editId = p.id;
    calculateLiveSummary();

    // Navigate to Entry View form window
    document.querySelector('[data-target="new-purchase"]').click();
};

window.duplicatePurchase = function(id) {
    const p = purchases.find(p => p.id === id);
    if(!p) return;
    
    const clone = JSON.parse(JSON.stringify(p));
    clone.id = 'p-' + Date.now();
    clone.title += ' (Copy)';
    
    purchases.push(clone);
    localStorage.setItem('landed_purchases', JSON.stringify(purchases));
    showToast('Record duplicated locally!');
    renderApp();
};

window.deletePurchase = function(id) {
    if(confirm('Are you sure you want to delete this purchase ledger record?')) {
        purchases = purchases.filter(p => p.id !== id);
        localStorage.setItem('landed_purchases', JSON.stringify(purchases));
        showToast('Record permanently removed.');
        renderApp();
    }
};

/* ==========================================================================
   6. INVENTORY CONSOLIDATION
   ========================================================================== */
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    if(!tbody) return;
    const search = document.getElementById('inventory-search').value.toLowerCase();
    tbody.innerHTML = '';

    // Aggregate inventory groups by product variant map
    const inventoryMap = {};

    purchases.forEach(p => {
        const key = p.productName.toLowerCase().trim();
        if(!inventoryMap[key]) {
            inventoryMap[key] = {
                name: p.productName,
                totalQty: 0,
                totalValue: 0
            };
        }
        inventoryMap[key].totalQty += p.qty;
        inventoryMap[key].totalValue += p.calculations.grandTotal;
    });

    Object.values(inventoryMap).forEach(item => {
        if(search && !item.name.toLowerCase().includes(search)) return;

        const calculatedAvg = item.totalQty > 0 ? (item.totalValue / item.totalQty) : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.totalQty} units</td>
            <td>₹${calculatedAvg.toFixed(2)}</td>
            <td><strong>₹${item.totalValue.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

/* ==========================================================================
   7. ANALYTICS ENGINE (CHART.JS INTERFACE)
   ========================================================================== */
function renderReports() {
    const monthlyCtx = document.getElementById('chart-monthly').getContext('2d');
    const expenseCtx = document.getElementById('chart-expenses').getContext('2d');

    // Clean up instances to reload fresh datasets on canvas toggles
    if (chartMonthlyInstance) chartMonthlyInstance.destroy();
    if (chartExpensesInstance) chartExpensesInstance.destroy();

    // Data Aggregation logic (Monthly)
    const monthlyData = {};
    purchases.forEach(p => {
        const month = p.date.substring(0, 7); // Format: YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + p.calculations.grandTotal;
    });

    // Expense Aggregation data logic
    let hamaliTotal = 0, transportTotal = 0, roomTotal = 0, customTotal = 0;
    purchases.forEach(p => {
        hamaliTotal += p.expenses.hamali;
        transportTotal += p.expenses.transport;
        roomTotal += p.expenses.roomTransport;
        p.expenses.custom.forEach(c => customTotal += c.amount);
    });

    // Chart 1: Monthly Costing Trend Line
    chartMonthlyInstance = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData).sort(),
            datasets: [{
                label: 'Procurement Investment (₹)',
                data: Object.values(monthlyData),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { responsive: true }
    });

    // Chart 2: Structural Operational Overhead Distribution Pie
    chartExpensesInstance = new Chart(expenseCtx, {
        type: 'doughnut',
        data: {
            labels: ['Hamali', 'Transport', 'Room Transport', 'Custom Expenses'],
            datasets: [{
                data: [hamaliTotal, transportTotal, roomTotal, customTotal],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6366f1']
            }]
        },
        options: { responsive: true }
    });
}

/* ==========================================================================
   8. NOTIFICATION ENGINE (TOASTS)
   ========================================================================== */
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto purge toast DOM element after anim completions
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
