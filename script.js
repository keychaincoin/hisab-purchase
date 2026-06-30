/* ==========================================================================
   1. SUPABASE CONFIGURATION & STATE
   ========================================================================== */
// Pre-configured with your specific fresh anon key and exact project URL
const SUPABASE_URL = "https://r5ccI6IkpXVCJ9.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InI1Y2NJNklrcFhWQ0o5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzM5NjIsImV4cCI6MjA5ODQwOTk2Mn0.hLTZxOMJYyHx3i1ycobS2RUaCzaf7hP-s4SmkCLbO7s";

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let purchases = [];
let activeView = 'dashboard';
let chartMonthlyInstance = null;
let chartExpensesInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupTheme();
    setupFormEvents();
    setupTableFilters();
    
    // Fetch fresh data from the Cloud Database instantly on load
    await fetchPurchasesFromCloud();
}

// Fetch helper from Supabase Cloud
async function fetchPurchasesFromCloud() {
    try {
        const { data, error } = await _supabase
            .from('landed_purchases')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map database columns back to our frontend camelCase state framework
        purchases = data.map(p => ({
            id: p.id,
            title: p.title,
            supplier: p.supplier,
            invoice: p.invoice,
            date: p.date,
            productName: p.product_name,
            category: p.category,
            brand: p.brand,
            sku: p.sku,
            qty: p.qty,
            rate: parseFloat(p.rate),
            expenses: p.expenses,
            calculations: p.calculations
        }));

        renderApp();
    } catch (err) {
        console.error("Error fetching data from cloud:", err.message);
        showToast("Cloud fetch failed. Checking connection...");
    }
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
            
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`view-${target}`).classList.add('active');
            
            document.getElementById('page-title').textContent = item.textContent;
            
            activeView = target;
            renderApp();
        });
    });

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
    
    form.addEventListener('input', calculateLiveSummary);

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        savePurchase();
    });
}

function calculateLiveSummary() {
    const qty = parseFloat(document.getElementById('p-qty').value) || 0;
    const rate = parseFloat(document.getElementById('p-rate').value) || 0;
    const productCost = qty * rate;
    
    const hamali = parseFloat(document.getElementById('exp-hamali').value) || 0;
    const transport = parseFloat(document.getElementById('exp-transport').value) || 0;
    const roomTransport = parseFloat(document.getElementById('exp-room').value) || 0;
    
    let customExpensesTotal = 0;
    document.querySelectorAll('.custom-expense-row').forEach(row => {
        const amt = parseFloat(row.querySelector('.cust-amount').value) || 0;
        customExpensesTotal += amt;
    });

    const totalExpenses = hamali + transport + roomTransport + customExpensesTotal;
    const grandTotal = productCost + totalExpenses;
    const avgCost = qty > 0 ? (grandTotal / qty) : 0;

    document.getElementById('calc-prod-cost').textContent = `₹${productCost.toFixed(2)}`;
    document.getElementById('calc-total-exp').textContent = `₹${totalExpenses.toFixed(2)}`;
    document.getElementById('calc-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
    document.getElementById('calc-avg-cost').textContent = `₹${avgCost.toFixed(2)}`;

    return { productCost, totalExpenses, grandTotal, avgCost };
}

async function savePurchase() {
    const calcs = calculateLiveSummary();
    const form = document.getElementById('purchase-form');
    
    const customExpenses = [];
    document.querySelectorAll('.custom-expense-row').forEach(row => {
        customExpenses.push({
            title: row.querySelector('.cust-title').value,
            amount: parseFloat(row.querySelector('.cust-amount').value) || 0,
            reason: row.querySelector('.cust-reason').value
        });
    });

    const isEditMode = !!form.dataset.editId;
    const purchaseId = form.dataset.editId || 'p-' + Date.now();

    // Mapping fields to Supabase Table structure (snake_case columns)
    const dbPayload = {
        id: purchaseId,
        title: document.getElementById('p-title').value,
        supplier: document.getElementById('p-supplier').value,
        invoice: document.getElementById('p-invoice').value,
        date: document.getElementById('p-date').value,
        product_name: document.getElementById('p-prod-name').value,
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

    showToast('Saving to cloud database...');

    try {
        let error;
        if (isEditMode) {
            ({ error } = await _supabase.from('landed_purchases').update(dbPayload).eq('id', purchaseId));
        } else {
            ({ error } = await _supabase.from('landed_purchases').insert([dbPayload]));
        }

        if (error) throw error;

        showToast(isEditMode ? 'Cloud Record Updated!' : 'Saved to Cloud Securely!');
        
        // Reset Form
        if (isEditMode) delete form.dataset.editId;
        form.reset();
        document.getElementById('custom-expenses-container').innerHTML = '';
        calculateLiveSummary();

        // Refresh pipeline
        await fetchPurchasesFromCloud();
        document.querySelector('[data-target="purchase-history"]').click();

    } catch (err) {
        console.error(err);
        showToast('Database insertion failed!');
    }
}

/* ==========================================================================
   4. RENDER ENGINE & DISPATCHER
   ========================================================================== */
function renderApp() {
    renderDashboard();
    renderHistoryTable();
    renderInventoryTable();
    if (activeView === 'reports') renderReports();
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
    
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
        if(confirm('Are you absolutely sure you want to clear ALL cloud data? This cannot be undone.')){
            showToast('Purging database...');
            const { error } = await _supabase.from('landed_purchases').delete().neq('id', 'void');
            if(!error) {
                showToast('Cloud Database Wiped.');
                await fetchPurchasesFromCloud();
            }
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

    document.getElementById('purchase-form').dataset.editId = p.id;
    calculateLiveSummary();
    document.querySelector('[data-target="new-purchase"]').click();
};

window.duplicatePurchase = async function(id) {
    const p = purchases.find(p => p.id === id);
    if(!p) return;
    
    const clone = {
        id: 'p-' + Date.now(),
        title: p.title + ' (Copy)',
        supplier: p.supplier,
        invoice: p.invoice,
        date: p.date,
        product_name: p.productName,
        category: p.category,
        brand: p.brand,
        sku: p.sku,
        qty: p.qty,
        rate: p.rate,
        expenses: p.expenses,
        calculations: p.calculations
    };
    
    showToast('Duplicating on cloud...');
    const { error } = await _supabase.from('landed_purchases').insert([clone]);
    if(!error) {
        showToast('Record Duplicated!');
        await fetchPurchasesFromCloud();
    }
};

window.deletePurchase = async function(id) {
    if(confirm('Are you sure you want to delete this purchase ledger record from cloud?')) {
        showToast('Deleting...');
        const { error } = await _supabase.from('landed_purchases').delete().eq('id', id);
        if(!error) {
            showToast('Record permanently removed.');
            await fetchPurchasesFromCloud();
        }
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

    if (chartMonthlyInstance) chartMonthlyInstance.destroy();
    if (chartExpensesInstance) chartExpensesInstance.destroy();

    const monthlyData = {};
    purchases.forEach(p => {
        const month = p.date.substring(0, 7);
        monthlyData[month] = (monthlyData[month] || 0) + p.calculations.grandTotal;
    });

    let hamaliTotal = 0, transportTotal = 0, roomTotal = 0, customTotal = 0;
    purchases.forEach(p => {
        hamaliTotal += p.expenses.hamali;
        transportTotal += p.expenses.transport;
        roomTotal += p.expenses.roomTransport;
        p.expenses.custom.forEach(c => customTotal += c.amount);
    });

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
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
