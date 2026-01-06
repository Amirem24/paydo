// --- UTILS: PERSIAN NUMBERS & DATE ---
const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const persianMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function toPersianNum(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\d/g, x => farsiDigits[x]);
}

function cleanNumber(str) {
    if (!str) return 0;
    const persianMap = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
    let englishStr = str.toString().replace(/[۰-۹]/g, w => persianMap[w] || w);
    englishStr = englishStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
    return parseInt(englishStr) || 0;
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return '۰';
    const num = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return toPersianNum(num);
}

// Helper to parse "YYYY/MM/DD" string
function parsePersianDateStr(dateStr) {
    // Convert Persian digits to English just in case
    const cleanDate = dateStr.replace(/[۰-۹]/g, w => {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}[w]);
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
        return {
            year: parseInt(parts[0]),
            month: parseInt(parts[1]),
            day: parseInt(parts[2])
        };
    }
    return null;
}

// --- APP STATE ---
let state = {
    accounts: [
        { id: 1, name: 'کیف پول نقدی', type: 'cash', balance: 0 }
    ],
    transactions: [],
    currentTransType: 'expense'
};

// BUDGET STATE
let budgetState = {
    currentYear: 1403,
    currentMonth: 10, // Default Dey
    activeTab: 'expense'
};

const DB_NAME = 'paydo_data_v1';

// --- UI UTILS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'info';
    if(type === 'success') icon = 'check_circle';
    if(type === 'error') icon = 'error_outline';
    toast.innerHTML = `<i class="material-icons" style="color:${type==='error'?'#ff5252':'#00e676'}">${icon}</i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, message, onYes) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    const yesBtn = document.getElementById('btn-confirm-yes');
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    newBtn.addEventListener('click', () => {
        onYes();
        closeModal('modal-confirm');
    });
    document.getElementById('modal-confirm').style.display = 'flex';
}

function updateLoading(percent, text) {
    document.getElementById('loading-bar').style.width = percent + '%';
    if(text) document.getElementById('loading-text').innerText = text;
}

function finishLoading() {
    updateLoading(100, 'آماده‌سازی رابط کاربری...');
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        document.getElementById('app-container').style.opacity = '1';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 500);
    }, 600);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    updateLoading(10, 'در حال بارگذاری هسته برنامه...');
    setTimeout(() => {
        loadData();
        
        // Set current Persian Date for Budget
        const todayStr = new Date().toLocaleDateString('fa-IR');
        const pDate = parsePersianDateStr(todayStr);
        if(pDate) {
            budgetState.currentYear = pDate.year;
            budgetState.currentMonth = pDate.month;
        }

        updateLoading(40, 'خواندن اطلاعات...');
        setupInputFormatters();
        
        document.getElementById('form-transaction').addEventListener('submit', saveTransaction);
        document.getElementById('form-account').addEventListener('submit', saveAccount);
        document.getElementById('transaction-search').addEventListener('input', filterTransactions);
        
        setTimeout(() => {
            renderDashboard();
            updateLoading(80, 'پردازش تراکنش‌ها...');
            setTimeout(finishLoading, 400);
        }, 300);
    }, 300);
});

function loadData() {
    const saved = localStorage.getItem(DB_NAME);
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error('Data corruption detected');
            // Try to load old poolaki data if exists
            const oldData = localStorage.getItem('poolaki_data_v2');
            if (oldData) {
                 state = JSON.parse(oldData);
                 saveData(); // Save to new DB name
            }
        }
    }
}

function saveData() {
    localStorage.setItem(DB_NAME, JSON.stringify(state));
    renderDashboard();
    renderHistory();
    renderAccountsList();
    if(document.getElementById('view-budget').classList.contains('active')) {
        renderBudgetView();
    }
}

function setupInputFormatters() {
    const moneyInputs = document.querySelectorAll('.money-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const rawVal = cleanNumber(e.target.value);
            if (rawVal === 0 && e.target.value.trim() === '') e.target.value = '';
            else e.target.value = formatMoney(rawVal);
        });
    });
}

// --- BUDGET & CHART LOGIC ---

window.changeBudgetMonth = function(delta) {
    let m = budgetState.currentMonth + delta;
    let y = budgetState.currentYear;
    
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    
    budgetState.currentMonth = m;
    budgetState.currentYear = y;
    renderBudgetView();
}

window.setBudgetTab = function(type) {
    budgetState.activeTab = type;
    document.querySelectorAll('.budget-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + type).classList.add('active');
    renderBudgetView();
}

function renderBudgetView() {
    // 1. Update Month Header
    const monthName = persianMonths[budgetState.currentMonth - 1];
    document.getElementById('budget-current-month').innerText = `${monthName} ${toPersianNum(budgetState.currentYear)}`;
    
    // 2. Filter Transactions
    const filteredTrans = state.transactions.filter(t => {
        if (t.type !== budgetState.activeTab) return false;
        const d = parsePersianDateStr(t.date); // Assumes saved as '1403/10/05'
        if (!d) return false;
        return d.year === budgetState.currentYear && d.month === budgetState.currentMonth;
    });

    // 3. Aggregate Data by Day
    const daysInMonth = (budgetState.currentMonth <= 6) ? 31 : (budgetState.currentMonth === 12 ? 29 : 30); // Simple leap year ignore for now
    const dailySums = new Array(daysInMonth + 1).fill(0);
    let totalSum = 0;

    filteredTrans.forEach(t => {
        const d = parsePersianDateStr(t.date);
        if (d && d.day <= daysInMonth) {
            dailySums[d.day] += parseInt(t.amount);
            totalSum += parseInt(t.amount);
        }
    });

    // 4. Update Header Stats
    document.getElementById('chart-total-amount').innerText = `${formatMoney(totalSum)} ریال`;
    document.getElementById('chart-subtitle').innerText = budgetState.activeTab === 'expense' ? 'مجموع هزینه ماه' : 'مجموع درآمد ماه';

    // 5. Render Chart
    const chartContainer = document.getElementById('chart-bars-container');
    chartContainer.innerHTML = '';
    const maxVal = Math.max(...dailySums, 1); // Avoid div by zero

    for (let i = 1; i <= daysInMonth; i++) {
        const val = dailySums[i];
        const heightPercent = (val / maxVal) * 100;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        if (budgetState.activeTab === 'expense') bar.classList.add('expense-bar');
        
        // Minimum height for visibility if 0
        bar.style.height = (val === 0) ? '4px' : `${Math.max(heightPercent, 4)}%`;
        if (val === 0) bar.style.opacity = '0.3';

        // Touch Interaction
        bar.onclick = (e) => {
            // Reset others
            document.querySelectorAll('.chart-bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            
            // Show info
            const dayText = `${i} ${monthName}`;
            const amountText = formatMoney(val);
            document.getElementById('selected-day-info').innerText = `${dayText}: ${amountText} تومان`;
        };

        wrapper.appendChild(bar);
        chartContainer.appendChild(wrapper);
    }
    
    // Clear info
    document.getElementById('selected-day-info').innerText = '';

    // 6. Render Categories
    renderBudgetCategories(filteredTrans, totalSum);
}

function renderBudgetCategories(transactions, totalSum) {
    const list = document.getElementById('budget-categories-list');
    list.innerHTML = '';
    
    if (transactions.length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.5; font-size:12px; margin-top:20px;">داده‌ای یافت نشد</div>';
        return;
    }

    const tagMap = {};
    transactions.forEach(t => {
        const tags = (t.tags && t.tags.length > 0) ? t.tags : ['#سایر'];
        tags.forEach(tag => {
            // Simple split if multiple tags, just count full amount for each tag (or split? let's duplicate for now as is common)
            // Or better: take first tag as primary category
            const primaryTag = tags[0];
            tagMap[primaryTag] = (tagMap[primaryTag] || 0) + parseInt(t.amount);
        });
    });

    // Convert to array and sort
    const sortedTags = Object.keys(tagMap).map(key => ({
        tag: key,
        amount: tagMap[key]
    })).sort((a,b) => b.amount - a.amount);

    sortedTags.forEach(item => {
        const percent = totalSum > 0 ? Math.round((item.amount / totalSum) * 100) : 0;
        
        const row = document.createElement('div');
        row.className = 'cat-row';
        row.innerHTML = `
            <div class="cat-info">
                <div class="cat-name-group">
                    <i class="material-icons cat-icon">label_outline</i>
                    <span>${item.tag.replace('#','')}</span>
                </div>
                <div>
                    <span style="font-weight:700; margin-left:10px;">${formatMoney(item.amount)} ریال</span>
                    <span style="opacity:0.7; font-size:11px;">${toPersianNum(percent)}٪</span>
                </div>
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width:${percent}%"></div>
            </div>
        `;
        list.appendChild(row);
    });
}

// --- STANDARD VIEWS ---
function renderDashboard() {
    const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    document.getElementById('total-balance').innerHTML = `${formatMoney(total)} <span class="currency">تومان</span>`;
    
    const accountsContainer = document.getElementById('accounts-container');
    accountsContainer.innerHTML = '';
    
    if (state.accounts.length === 0) accountsContainer.innerHTML = '<div style="color:white; opacity:0.7; padding:10px;">حسابی وجود ندارد</div>';

    state.accounts.forEach(acc => {
        const icon = acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card';
        const el = document.createElement('div');
        el.className = 'account-card';
        el.innerHTML = `
            <div class="account-icon"><i class="material-icons">${icon}</i></div>
            <div class="account-name">${acc.name}</div>
            <div class="account-balance">${formatMoney(acc.balance)}</div>
        `;
        accountsContainer.appendChild(el);
    });

    const recentContainer = document.getElementById('recent-transactions');
    recentContainer.innerHTML = '';
    const recent = [...state.transactions].sort((a,b) => b.id - a.id).slice(0, 5);
    
    if (recent.length === 0) recentContainer.innerHTML = '<div class="empty-state"><i class="material-icons">receipt</i><br>تراکنشی ثبت نشده</div>';
    else recent.forEach(t => recentContainer.appendChild(createTransactionEl(t)));
}

function renderHistory(filterText = '') {
    const container = document.getElementById('all-transactions');
    container.innerHTML = '';
    const all = [...state.transactions].sort((a,b) => b.id - a.id);
    const filtered = all.filter(t => 
        t.title.includes(filterText) || 
        t.amount.toString().includes(filterText) ||
        toPersianNum(t.amount).includes(filterText) ||
        (t.tags && t.tags.some(tag => tag.includes(filterText)))
    );
    if (filtered.length === 0) container.innerHTML = '<div class="empty-state"><i class="material-icons">search_off</i><br>تراکنشی یافت نشد</div>';
    else filtered.forEach(t => container.appendChild(createTransactionEl(t)));
}

function createTransactionEl(t) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    let icon = 'help_outline', iconClass = '', amountColorClass = '', sign = '';

    if (t.type === 'expense') { icon = 'trending_down'; iconClass = 'bg-expense'; amountColorClass = 'expense'; sign = '-'; }
    else if (t.type === 'income') { icon = 'trending_up'; iconClass = 'bg-income'; amountColorClass = 'income'; sign = '+'; }
    else { icon = 'swap_horiz'; iconClass = 'bg-transfer'; amountColorClass = 'transfer'; sign = ''; }

    const tagsHtml = (t.tags || []).join(' ');

    div.innerHTML = `
        <div class="trans-icon-box ${iconClass}"><i class="material-icons">${icon}</i></div>
        <div class="trans-details">
            <div class="trans-title">${t.title}</div>
            <div class="trans-meta">
                <i class="material-icons" style="font-size:12px">account_balance_wallet</i>
                ${getAccountName(t.accountId)} 
                <span style="margin: 0 5px">•</span> ${toPersianNum(t.date)}
            </div>
            ${tagsHtml ? `<div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:4px;">${tagsHtml}</div>` : ''}
        </div>
        <div class="trans-amount ${amountColorClass}">${sign}${formatMoney(t.amount)}</div>
    `;
    return div;
}

function renderAccountsList() {
    const container = document.getElementById('accounts-list-full');
    container.innerHTML = '';
    state.accounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = 'account-manage-item';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="account-icon" style="background:rgba(255,255,255,0.1)">
                    <i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i>
                </div>
                <div>
                    <div style="font-weight:700">${acc.name}</div>
                    <div style="font-size:12px; color:rgba(255,255,255,0.6)">موجودی: ${formatMoney(acc.balance)}</div>
                </div>
            </div>
            <div class="account-actions"><i class="material-icons" onclick="deleteAccount(${acc.id})">delete</i></div>
        `;
        container.appendChild(div);
    });
}

function getAccountName(id) {
    const acc = state.accounts.find(a => a.id == id);
    return acc ? acc.name : 'حذف شده';
}

// --- SELECTORS ---
window.openAccountSelect = function(inputId, title) {
    const listContainer = document.getElementById('selection-list');
    listContainer.innerHTML = '';
    document.getElementById('selection-title').innerText = title;
    state.accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = `
            <i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i>
            <div><div style="font-weight:500">${acc.name}</div><div style="font-size:11px; color:rgba(255,255,255,0.5)">${formatMoney(acc.balance)} تومان</div></div>
        `;
        item.onclick = () => {
            document.getElementById(inputId).value = acc.id;
            document.getElementById('trigger-' + inputId).innerText = acc.name;
            document.getElementById('trigger-' + inputId).style.color = '#fff';
            closeModal('modal-selection');
        };
        listContainer.appendChild(item);
    });
    document.getElementById('modal-selection').style.display = 'flex';
}

window.openTypeSelect = function() {
    const listContainer = document.getElementById('selection-list');
    listContainer.innerHTML = '';
    document.getElementById('selection-title').innerText = 'نوع حساب';
    [{val: 'card', name: 'کارت بانکی', icon: 'credit_card'}, {val: 'cash', name: 'کیف پول نقدی', icon: 'account_balance_wallet'}]
    .forEach(t => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = `<i class="material-icons">${t.icon}</i><div>${t.name}</div>`;
        item.onclick = () => {
            document.getElementById('acc-type').value = t.val;
            document.getElementById('trigger-acc-type').innerText = t.name;
            closeModal('modal-selection');
        };
        listContainer.appendChild(item);
    });
    document.getElementById('modal-selection').style.display = 'flex';
}

// --- ACTIONS & NAV ---
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // If budget, highlight report nav
    const navTarget = viewName === 'budget' ? 'history' : viewName;
    const navItem = document.getElementById(`nav-${navTarget}`);
    if(navItem) navItem.classList.add('active');

    if(viewName === 'dashboard') renderDashboard();
    if(viewName === 'history') renderHistory();
    if(viewName === 'budget') renderBudgetView();
    if(viewName === 'accounts') renderAccountsList();
    if(viewName === 'settings') {
        // storage calc
        let total = 0;
        for (let x in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, x)) total += (localStorage[x].length + x.length) * 2; }
        document.getElementById('storage-usage').innerText = `فضای اشغال شده: ${toPersianNum((total / 1024).toFixed(2))} کیلوبایت`;
    }
}

window.setTransType = function(type) {
    state.currentTransType = type;
    document.querySelectorAll('.type-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`opt-${type}`).classList.add('selected');
    const targetGroup = document.getElementById('target-account-group');
    targetGroup.style.display = (type === 'transfer') ? 'block' : 'none';
}

function saveTransaction(e) {
    e.preventDefault();
    const amount = cleanNumber(document.getElementById('trans-amount').value);
    const title = document.getElementById('trans-title').value;
    const accId = parseInt(document.getElementById('trans-account').value);
    const targetId = parseInt(document.getElementById('trans-target-account').value);
    const tagsInput = document.getElementById('trans-tags').value;
    let tags = (tagsInput && tagsInput.trim().length > 0) ? tagsInput.trim().split(/[\s,]+/).slice(0,3).map(t => t.startsWith('#')?t:'#'+t) : ['#سایر'];

    if (!amount || !title) { showToast('لطفا مبلغ و عنوان را وارد کنید', 'error'); return; }
    if (!accId) { showToast('لطفا حساب مبدا را انتخاب کنید', 'error'); return; }
    if (state.currentTransType === 'transfer' && (!targetId || accId === targetId)) { showToast('حساب مقصد نامعتبر است', 'error'); return; }

    const srcAcc = state.accounts.find(a => a.id === accId);
    if (state.currentTransType === 'expense') srcAcc.balance -= amount;
    else if (state.currentTransType === 'income') srcAcc.balance += amount;
    else {
        srcAcc.balance -= amount;
        const destAcc = state.accounts.find(a => a.id === targetId);
        if(destAcc) destAcc.balance += amount;
    }

    const newTrans = {
        id: Date.now(),
        type: state.currentTransType,
        amount: amount,
        title: title,
        tags: tags,
        accountId: accId,
        targetAccountId: state.currentTransType === 'transfer' ? targetId : null,
        date: new Date().toLocaleDateString('fa-IR'),
        timestamp: Date.now()
    };

    state.transactions.unshift(newTrans);
    saveData();
    closeModal('modal-transaction');
    document.getElementById('form-transaction').reset();
    document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...';
    document.getElementById('trans-account').value = '';
    showToast('تراکنش با موفقیت ثبت شد', 'success');
}

function saveAccount(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const balance = cleanNumber(document.getElementById('acc-balance').value);
    const type = document.getElementById('acc-type').value;
    state.accounts.push({ id: Date.now(), name: name, type: type, balance: balance });
    saveData();
    closeModal('modal-account');
    document.getElementById('form-account').reset();
    showToast('حساب جدید ایجاد شد', 'success');
}

window.deleteAccount = function(id) {
    if(state.accounts.length <= 1) { showToast('نمی‌توانید آخرین حساب را حذف کنید', 'error'); return; }
    showConfirm('حذف حساب', 'آیا از حذف این حساب مطمئن هستید؟', () => {
        state.accounts = state.accounts.filter(a => a.id !== id);
        saveData();
        showToast('حساب حذف شد', 'success');
    });
}

window.filterTransactions = function() { renderHistory(document.getElementById('transaction-search').value); }
window.openAddTransactionModal = function() { 
    if(!document.getElementById('trans-account').value) document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...';
    document.getElementById('modal-transaction').style.display = 'flex'; 
}
window.openAddAccountModal = function() { document.getElementById('modal-account').style.display = 'flex'; }
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }
window.resetAppData = function() { showConfirm('حذف کل اطلاعات', 'آیا مطمئن هستید؟', () => { localStorage.removeItem(DB_NAME); location.reload(); }); }
window.backupData = function() {
    const dataStr = localStorage.getItem(DB_NAME);
    if (!dataStr) { showToast('هیچ داده‌ای وجود ندارد', 'error'); return; }
    const blob = new Blob([JSON.stringify(JSON.parse(dataStr), null, 2)], {type : 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Paydo_Backup_${new Date().toLocaleDateString('fa-IR').replace(/\//g,'-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.restoreData = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (!parsedData.accounts || !parsedData.transactions) throw new Error();
            showConfirm('بازیابی', 'اطلاعات فعلی حذف و جایگزین می‌شوند. ادامه می‌دهید؟', () => {
                localStorage.setItem(DB_NAME, JSON.stringify(parsedData));
                location.reload();
            });
        } catch (err) { showToast('فایل نامعتبر است', 'error'); }
        input.value = '';
    };
    reader.readAsText(file);
}
window.checkForUpdate = function() { showConfirm('بروزرسانی', 'برنامه مجدداً بارگذاری می‌شود.', () => location.reload(true)); }

// CATEGORIES LOGIC
window.openCategoriesModal = function() {
    const container = document.getElementById('categories-list');
    container.innerHTML = '';
    const tagCounts = {};
    state.transactions.forEach(t => (t.tags || []).forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1));
    const tags = Object.keys(tagCounts).sort();
    if (tags.length === 0) container.innerHTML = '<div class="empty-state">دسته بندی وجود ندارد</div>';
    else {
        tags.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'account-manage-item';
            div.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div class="account-icon"><i class="material-icons">label</i></div><div><div style="font-weight:700">${tag}</div><div style="font-size:12px;opacity:0.6">${toPersianNum(tagCounts[tag])} تراکنش</div></div></div><div class="account-actions"><i class="material-icons" onclick="deleteTag('${tag}')">delete</i></div>`;
            container.appendChild(div);
        });
    }
    document.getElementById('modal-categories').style.display = 'flex';
}
window.deleteTag = function(tag) {
    showConfirm('حذف تگ', `تگ ${tag} حذف شود؟`, () => {
        state.transactions.forEach(t => { if(t.tags && t.tags.includes(tag)) { t.tags = t.tags.filter(x => x!==tag); if(t.tags.length===0) t.tags=['#سایر']; }});
        saveData();
        openCategoriesModal();
        showToast('حذف شد', 'success');
    });
}
