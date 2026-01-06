// --- UTILS: PERSIAN NUMBERS & DATE ---
const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

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

// Get Persian Month/Year from timestamp
function getPersianDateParts(timestamp) {
    const date = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.formatToParts(date);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return { year: parseInt(y), month: parseInt(m), day: parseInt(d) };
}

// Get Month Name
function getPersianMonthName(monthIndex) {
    const months = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
    return months[monthIndex - 1] || "";
}

// --- APP STATE ---
let state = {
    accounts: [
        { id: 1, name: 'کیف پول نقدی', type: 'cash', balance: 0 }
    ],
    transactions: [],
    currentTransType: 'expense',
    budgetMonthOffset: 0, // 0 = current month
    budgetType: 'expense' // 'expense' or 'income'
};

const DB_NAME = 'poolaki_data_v2'; // Keeping DB name same to preserve old data if any

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
    newBtn.addEventListener('click', () => { onYes(); closeModal('modal-confirm'); });
    document.getElementById('modal-confirm').style.display = 'flex';
}

function updateLoading(percent, text) {
    document.getElementById('loading-bar').style.width = percent + '%';
    if(text) document.getElementById('loading-text').innerText = text;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateLoading(10, 'در حال بارگذاری هسته Paydo...');
    setTimeout(() => {
        loadData();
        updateLoading(40, 'خواندن اطلاعات...');
        setupInputFormatters();
        document.getElementById('form-transaction').addEventListener('submit', saveTransaction);
        document.getElementById('form-account').addEventListener('submit', saveAccount);
        document.getElementById('transaction-search').addEventListener('input', filterTransactions);
        
        setTimeout(() => {
            renderDashboard();
            updateLoading(80, 'پردازش تراکنش‌ها...');
            setTimeout(() => {
                updateLoading(100, 'آماده‌سازی رابط کاربری...');
                setTimeout(() => {
                    document.getElementById('loading-screen').style.opacity = '0';
                    document.getElementById('app-container').style.opacity = '1';
                    setTimeout(() => document.getElementById('loading-screen').style.display = 'none', 500);
                }, 600);
            }, 400);
        }, 300);
    }, 300);
});

function loadData() {
    const saved = localStorage.getItem(DB_NAME);
    if (saved) {
        try { state = JSON.parse(saved); } 
        catch (e) { console.error('Data corruption'); showToast('خطا در خواندن اطلاعات', 'error'); }
    }
    // Ensure defaults
    if(typeof state.budgetMonthOffset === 'undefined') state.budgetMonthOffset = 0;
    if(typeof state.budgetType === 'undefined') state.budgetType = 'expense';
}

function saveData() {
    localStorage.setItem(DB_NAME, JSON.stringify(state));
    renderDashboard();
    renderHistory();
    renderAccountsList();
    if(document.getElementById('view-budget').classList.contains('active')) renderBudget();
}

function setupInputFormatters() {
    document.querySelectorAll('.money-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const rawVal = cleanNumber(e.target.value);
            e.target.value = (rawVal === 0 && e.target.value.trim() === '') ? '' : formatMoney(rawVal);
        });
    });
}

// --- VIEW LOGIC ---
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${viewName === 'budget' ? 'history' : viewName}`);
    if(navItem) navItem.classList.add('active'); // Budget uses 'Reports' nav item active state

    if(viewName === 'dashboard') renderDashboard();
    if(viewName === 'history') renderHistory();
    if(viewName === 'accounts') renderAccountsList();
    if(viewName === 'budget') renderBudget();
    if(viewName === 'settings') calculateStorage();
}

// --- BUDGET & CHART LOGIC (NEW) ---
window.changeBudgetMonth = function(dir) {
    state.budgetMonthOffset += dir;
    renderBudget();
}

window.setBudgetTab = function(type) {
    state.budgetType = type;
    document.getElementById('tab-budget-expense').classList.toggle('active', type === 'expense');
    document.getElementById('tab-budget-income').classList.toggle('active', type === 'income');
    renderBudget();
}

function renderBudget() {
    // 1. Determine Target Persian Month/Year
    const now = new Date();
    // Approximate month shift logic using JS Date
    // Note: This shifts gregorian months, but we filter by Persian afterwards. 
    // Ideally we shift persian months, but for simplicity:
    const targetDate = new Date(now.getFullYear(), now.getMonth() + state.budgetMonthOffset, 15);
    const targetParts = getPersianDateParts(targetDate.getTime());
    const targetYear = targetParts.year;
    const targetMonth = targetParts.month;

    // Update Header Label
    document.getElementById('budget-month-label').innerText = `${getPersianMonthName(targetMonth)} ${toPersianNum(targetYear)}`;

    // 2. Filter Transactions
    const filtered = state.transactions.filter(t => {
        if (t.type !== state.budgetType) return false;
        const pDate = getPersianDateParts(t.timestamp || Date.now());
        return pDate.year === targetYear && pDate.month === targetMonth;
    });

    // 3. Aggregate Total
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('budget-total-amount').innerHTML = `${formatMoney(total)} <span style="font-size:16px; font-weight:400">تومان</span>`;
    document.getElementById('budget-total-label').innerText = state.budgetType === 'expense' ? 'مجموع هزینه ماه' : 'مجموع درآمد ماه';

    // 4. Render Chart (Daily aggregation)
    const daysInMonth = (targetMonth <= 6) ? 31 : (targetMonth === 12 ? 29 : 30); // Simple leap year ignore for UI
    const dailySums = new Array(daysInMonth + 1).fill(0);
    
    filtered.forEach(t => {
        const pDate = getPersianDateParts(t.timestamp || Date.now());
        if(pDate.day <= daysInMonth) dailySums[pDate.day] += t.amount;
    });

    const maxVal = Math.max(...dailySums) || 1; // Avoid divide by zero
    const chartContainer = document.getElementById('chart-bars-area');
    chartContainer.innerHTML = '';

    for (let day = 1; day <= daysInMonth; day++) {
        const amount = dailySums[day];
        const heightPercent = (amount / maxVal) * 100;
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar' + (amount === 0 ? ' empty' : '');
        bar.style.height = heightPercent + '%';
        
        // Touch/Click interaction
        const handleInteraction = (e) => {
            // Remove active from others
            document.querySelectorAll('.chart-bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            
            // Show Tooltip
            const tooltip = document.getElementById('chart-tooltip');
            tooltip.innerHTML = `${toPersianNum(day)} ${getPersianMonthName(targetMonth)}<br><b>${formatMoney(amount)} تومان</b>`;
            tooltip.style.opacity = '1';
            
            // Position
            const rect = bar.getBoundingClientRect();
            const containerRect = chartContainer.parentElement.getBoundingClientRect();
            const left = rect.left - containerRect.left + (rect.width / 2);
            tooltip.style.left = left + 'px';
            tooltip.style.top = (rect.top - containerRect.top) + 'px';
        };

        bar.addEventListener('click', handleInteraction);
        // For mobile drag feeling, we'd need complex touch events. Click/Tap is enough for now.
        
        chartContainer.appendChild(bar);
    }

    // Hide tooltip when clicking elsewhere
    document.addEventListener('click', (e) => {
        if(!e.target.closest('.chart-bar')) {
            document.getElementById('chart-tooltip').style.opacity = '0';
            document.querySelectorAll('.chart-bar').forEach(b => b.classList.remove('active'));
        }
    });

    // 5. Render Categories (Sorted by amount)
    const catMap = {};
    filtered.forEach(t => {
        const tags = (t.tags && t.tags.length > 0) ? t.tags : ['#سایر'];
        tags.forEach(tag => {
            catMap[tag] = (catMap[tag] || 0) + t.amount;
        });
    });

    // Convert map to array and sort
    const catList = Object.keys(catMap).map(key => ({ tag: key, amount: catMap[key] }));
    catList.sort((a, b) => b.amount - a.amount);

    const listContainer = document.getElementById('budget-categories-list');
    listContainer.innerHTML = '';
    
    if(catList.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.4); padding:20px;">داده‌ای برای نمایش وجود ندارد</div>';
    } else {
        const maxCat = catList[0].amount;
        catList.forEach(c => {
            const percent = ((c.amount / total) * 100).toFixed(0);
            const barWidth = ((c.amount / maxCat) * 100) + '%';
            
            const div = document.createElement('div');
            div.className = 'cat-row';
            div.innerHTML = `
                <div class="cat-header">
                    <div class="cat-name">
                        <i class="material-icons" style="font-size:16px; opacity:0.7">label</i>
                        ${c.tag}
                    </div>
                    <div class="cat-amount">
                        ${formatMoney(c.amount)} <span style="font-weight:400; font-size:10px;">تومان</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="cat-progress-bg">
                        <div class="cat-progress-fill" style="width: ${barWidth}"></div>
                    </div>
                    <div style="font-size:11px; width:25px; text-align:left;">%${toPersianNum(percent)}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
}


// --- REST OF THE APP FUNCTIONS (UNCHANGED BUT INCLUDED) ---
// Note: Keeping existing logic for Transactions/Accounts/Settings

window.openAccountSelect = function(inputId, title) {
    const listContainer = document.getElementById('selection-list');
    listContainer.innerHTML = '';
    document.getElementById('selection-title').innerText = title;
    state.accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = `
            <i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i>
            <div><div style="font-weight:500">${acc.name}</div><div style="font-size:11px; color:rgba(255,255,255,0.5)">${formatMoney(acc.balance)} تومان</div></div>`;
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
    [{val: 'card', name: 'کارت بانکی', icon: 'credit_card'}, {val: 'cash', name: 'کیف پول نقدی', icon: 'account_balance_wallet'}].forEach(t => {
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

function renderDashboard() {
    const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    document.getElementById('total-balance').innerHTML = `${formatMoney(total)} <span class="currency">تومان</span>`;
    const accountsContainer = document.getElementById('accounts-container');
    accountsContainer.innerHTML = '';
    if (state.accounts.length === 0) accountsContainer.innerHTML = '<div style="color:white; opacity:0.7; padding:10px;">حسابی وجود ندارد</div>';
    state.accounts.forEach(acc => {
        const el = document.createElement('div');
        el.className = 'account-card';
        el.innerHTML = `<div class="account-icon"><i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i></div><div class="account-name">${acc.name}</div><div class="account-balance">${formatMoney(acc.balance)}</div>`;
        accountsContainer.appendChild(el);
    });
    const recentContainer = document.getElementById('recent-transactions');
    recentContainer.innerHTML = '';
    const recent = [...state.transactions].sort((a,b) => b.timestamp - a.timestamp).slice(0, 5);
    if (recent.length === 0) recentContainer.innerHTML = '<div class="empty-state"><i class="material-icons">receipt</i><br>تراکنشی ثبت نشده</div>';
    else recent.forEach(t => recentContainer.appendChild(createTransactionEl(t)));
}

function renderHistory(filterText = '') {
    const container = document.getElementById('all-transactions');
    container.innerHTML = '';
    const all = [...state.transactions].sort((a,b) => b.timestamp - a.timestamp);
    const filtered = all.filter(t => t.title.includes(filterText) || t.amount.toString().includes(filterText) || toPersianNum(t.amount).includes(filterText) || (t.tags && t.tags.some(tag => tag.includes(filterText))));
    if (filtered.length === 0) container.innerHTML = '<div class="empty-state"><i class="material-icons">search_off</i><br>تراکنشی یافت نشد</div>';
    else filtered.forEach(t => container.appendChild(createTransactionEl(t)));
}

function createTransactionEl(t) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    let iconClass = '', icon = 'help_outline', amountColorClass = '', sign = '';
    if (t.type === 'expense') { icon = 'trending_down'; iconClass = 'bg-expense'; amountColorClass = 'expense'; sign = '-'; } 
    else if (t.type === 'income') { icon = 'trending_up'; iconClass = 'bg-income'; amountColorClass = 'income'; sign = '+'; } 
    else { icon = 'swap_horiz'; iconClass = 'bg-transfer'; amountColorClass = 'transfer'; sign = ''; }
    const tagsHtml = (t.tags || []).join(' ');
    div.innerHTML = `
        <div class="trans-icon-box ${iconClass}"><i class="material-icons">${icon}</i></div>
        <div class="trans-details">
            <div class="trans-title">${t.title}</div>
            <div class="trans-meta"><i class="material-icons" style="font-size:12px">account_balance_wallet</i> ${getAccountName(t.accountId)} ${t.targetAccountId ? `<i class="material-icons" style="font-size:12px; margin-right:5px">arrow_back</i> ${getAccountName(t.targetAccountId)}` : ''} <span style="margin: 0 5px">•</span> ${toPersianNum(t.date)}</div>
            ${tagsHtml ? `<div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:4px;">${tagsHtml}</div>` : ''}
        </div>
        <div class="trans-amount ${amountColorClass}">${sign}${formatMoney(t.amount)}</div>`;
    return div;
}

function renderAccountsList() {
    const container = document.getElementById('accounts-list-full');
    container.innerHTML = '';
    state.accounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = 'account-manage-item';
        div.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><div class="account-icon" style="background:rgba(255,255,255,0.1)"><i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i></div><div><div style="font-weight:700">${acc.name}</div><div style="font-size:12px; color:rgba(255,255,255,0.6)">موجودی: ${formatMoney(acc.balance)}</div></div></div><div class="account-actions"><i class="material-icons" onclick="deleteAccount(${acc.id})">delete</i></div>`;
        container.appendChild(div);
    });
}

window.openCategoriesModal = function() {
    const container = document.getElementById('categories-list');
    container.innerHTML = '';
    const tagCounts = {};
    state.transactions.forEach(t => (t.tags || []).forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1));
    const tags = Object.keys(tagCounts).sort();
    if (tags.length === 0) container.innerHTML = '<div class="empty-state"><i class="material-icons">label_off</i><br>دسته بندی وجود ندارد</div>';
    else tags.forEach(tag => {
        const div = document.createElement('div');
        div.className = 'account-manage-item';
        div.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><div class="account-icon" style="background:rgba(255,255,255,0.1)"><i class="material-icons">label</i></div><div><div style="font-weight:700">${tag}</div><div style="font-size:12px; color:rgba(255,255,255,0.6)">${toPersianNum(tagCounts[tag])} تراکنش</div></div></div><div class="account-actions"><i class="material-icons" onclick="deleteTag('${tag}')">delete</i></div>`;
        container.appendChild(div);
    });
    document.getElementById('modal-categories').style.display = 'flex';
}

window.deleteTag = function(tag) {
    showConfirm('حذف دسته‌بندی', `آیا از حذف ${tag} مطمئن هستید؟ تراکنش‌ها باقی می‌مانند.`, () => {
        let modified = false;
        state.transactions.forEach(t => { if (t.tags && t.tags.includes(tag)) { t.tags = t.tags.filter(x => x !== tag); if (t.tags.length === 0) t.tags = ['#سایر']; modified = true; } });
        if (modified) { saveData(); window.openCategoriesModal(); showToast('دسته‌بندی حذف شد', 'success'); }
    });
}

function getAccountName(id) { const acc = state.accounts.find(a => a.id == id); return acc ? acc.name : 'حذف شده'; }
function calculateStorage() { let total = 0; for (let x in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, x)) total += (localStorage[x].length + x.length) * 2; } document.getElementById('storage-usage').innerText = `فضای اشغال شده: ${toPersianNum((total / 1024).toFixed(2))} کیلوبایت`; }
window.resetAppData = function() { showConfirm('حذف کل اطلاعات', 'آیا مطمئن هستید؟', () => { localStorage.removeItem(DB_NAME); location.reload(); }); }
window.backupData = function() {
    const dataStr = localStorage.getItem(DB_NAME);
    if (!dataStr) { showToast('هیچ داده‌ای نیست', 'error'); return; }
    const blob = new Blob([JSON.stringify(JSON.parse(dataStr), null, 2)], {type : 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Paydo_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('دانلود شد', 'success');
}
window.restoreData = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed.accounts || !parsed.transactions) throw new Error();
            showConfirm('بازیابی', 'اطلاعات فعلی جایگزین می‌شود.', () => { localStorage.setItem(DB_NAME, JSON.stringify(parsed)); showToast('بازیابی شد', 'success'); setTimeout(() => location.reload(), 1000); });
        } catch { showToast('فایل نامعتبر', 'error'); } finally { input.value = ''; }
    };
    reader.readAsText(file);
}
window.checkForUpdate = function() { showConfirm('بروزرسانی', 'نسخه جدید دریافت شود؟', () => window.location.reload(true)); }

window.setTransType = function(type) {
    state.currentTransType = type;
    document.querySelectorAll('.type-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`opt-${type}`).classList.add('selected');
    document.getElementById('target-account-group').style.display = type === 'transfer' ? 'block' : 'none';
}

function saveTransaction(e) {
    e.preventDefault();
    const amount = cleanNumber(document.getElementById('trans-amount').value);
    const title = document.getElementById('trans-title').value;
    const accId = parseInt(document.getElementById('trans-account').value);
    const targetId = parseInt(document.getElementById('trans-target-account').value);
    const tagsInput = document.getElementById('trans-tags').value;
    let tags = (tagsInput && tagsInput.trim().length > 0) ? tagsInput.trim().split(/[\s,]+/).slice(0, 3).map(t => t.startsWith('#') ? t : '#' + t) : ['#سایر'];

    if (!amount || !title) { showToast('مبلغ و عنوان الزامی است', 'error'); return; }
    if (!accId) { showToast('حساب مبدا را انتخاب کنید', 'error'); return; }
    if (state.currentTransType === 'transfer' && !targetId) { showToast('حساب مقصد را انتخاب کنید', 'error'); return; }
    if (state.currentTransType === 'transfer' && accId === targetId) { showToast('مبدا و مقصد نمی‌تواند یکی باشد', 'error'); return; }

    const srcAcc = state.accounts.find(a => a.id === accId);
    if (state.currentTransType === 'expense') srcAcc.balance -= amount;
    else if (state.currentTransType === 'income') srcAcc.balance += amount;
    else if (state.currentTransType === 'transfer') { srcAcc.balance -= amount; const destAcc = state.accounts.find(a => a.id === targetId); if(destAcc) destAcc.balance += amount; }

    state.transactions.unshift({
        id: Date.now(),
        type: state.currentTransType,
        amount: amount,
        title: title,
        tags: tags,
        accountId: accId,
        targetAccountId: state.currentTransType === 'transfer' ? targetId : null,
        date: new Date().toLocaleDateString('fa-IR'),
        timestamp: Date.now()
    });
    saveData();
    closeModal('modal-transaction');
    document.getElementById('form-transaction').reset();
    document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...';
    document.getElementById('trans-account').value = '';
    document.getElementById('trigger-trans-target-account').innerText = 'انتخاب کنید...';
    document.getElementById('trans-target-account').value = '';
    document.getElementById('trans-amount').value = ''; 
    showToast('ثبت شد', 'success');
}

function saveAccount(e) {
    e.preventDefault();
    state.accounts.push({ id: Date.now(), name: document.getElementById('acc-name').value, type: document.getElementById('acc-type').value, balance: cleanNumber(document.getElementById('acc-balance').value) });
    saveData();
    closeModal('modal-account');
    document.getElementById('form-account').reset();
    document.getElementById('trigger-acc-type').innerText = 'کارت بانکی';
    showToast('حساب ایجاد شد', 'success');
}

window.deleteAccount = function(id) {
    if(state.accounts.length <= 1) { showToast('حداقل یک حساب لازم است', 'error'); return; }
    showConfirm('حذف حساب', 'مطمئنید؟', () => { state.accounts = state.accounts.filter(a => a.id !== id); saveData(); showToast('حذف شد', 'success'); });
}

window.filterTransactions = function() { renderHistory(document.getElementById('transaction-search').value); }
window.openAddTransactionModal = function() { if(!document.getElementById('trans-account').value) document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...'; document.getElementById('modal-transaction').style.display = 'flex'; }
window.openAddAccountModal = function() { document.getElementById('modal-account').style.display = 'flex'; }
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }
