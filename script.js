// --- UTILS: PERSIAN NUMBERS ---
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

// --- APP STATE ---
let state = {
    accounts: [
        { id: 1, name: 'کیف پول نقدی', type: 'cash', balance: 0 }
    ],
    transactions: [],
    currentTransType: 'expense'
};

const DB_NAME = 'poolaki_data_v2';

// --- UI UTILS: TOAST & CONFIRM ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'info';
    if(type === 'success') icon = 'check_circle';
    if(type === 'error') icon = 'error_outline';
    
    toast.innerHTML = `<i class="material-icons" style="color:${type==='error'?'#ff5252':'#00e676'}">${icon}</i> ${message}`;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
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
    // Remove old listeners to prevent stacking
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    
    newBtn.addEventListener('click', () => {
        onYes();
        closeModal('modal-confirm');
    });
    
    document.getElementById('modal-confirm').style.display = 'flex';
}

// --- LOADING SYSTEM ---
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

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Stage 1: Init
    updateLoading(10, 'در حال بارگذاری هسته برنامه...');
    
    setTimeout(() => {
        loadData();
        updateLoading(40, 'خواندن اطلاعات...');
        
        setupInputFormatters();
        
        document.getElementById('form-transaction').addEventListener('submit', saveTransaction);
        document.getElementById('form-account').addEventListener('submit', saveAccount);
        document.getElementById('transaction-search').addEventListener('input', filterTransactions);
        
        setTimeout(() => {
            // Stage 2: Render
            renderDashboard();
            updateLoading(80, 'پردازش تراکنش‌ها...');
            
            // Finish
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
            showToast('خطا در خواندن اطلاعات ذخیره شده', 'error');
        }
    }
}

function saveData() {
    localStorage.setItem(DB_NAME, JSON.stringify(state));
    renderDashboard();
    renderHistory();
    renderAccountsList();
}

function setupInputFormatters() {
    const moneyInputs = document.querySelectorAll('.money-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const rawVal = cleanNumber(e.target.value);
            if (rawVal === 0 && e.target.value.trim() === '') {
                 e.target.value = '';
            } else {
                 e.target.value = formatMoney(rawVal);
            }
        });
    });
}

// --- CUSTOM SELECT LOGIC ---
window.openAccountSelect = function(inputId, title) {
    const listContainer = document.getElementById('selection-list');
    listContainer.innerHTML = '';
    
    document.getElementById('selection-title').innerText = title;
    
    state.accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = `
            <i class="material-icons">${acc.type === 'cash' ? 'account_balance_wallet' : 'credit_card'}</i>
            <div>
                <div style="font-weight:500">${acc.name}</div>
                <div style="font-size:11px; color:rgba(255,255,255,0.5)">${formatMoney(acc.balance)} تومان</div>
            </div>
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
    
    const types = [
        {val: 'card', name: 'کارت بانکی', icon: 'credit_card'},
        {val: 'cash', name: 'کیف پول نقدی', icon: 'account_balance_wallet'}
    ];
    
    types.forEach(t => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.innerHTML = `
            <i class="material-icons">${t.icon}</i>
            <div>${t.name}</div>
        `;
        item.onclick = () => {
            document.getElementById('acc-type').value = t.val;
            document.getElementById('trigger-acc-type').innerText = t.name;
            closeModal('modal-selection');
        };
        listContainer.appendChild(item);
    });
    
    document.getElementById('modal-selection').style.display = 'flex';
}

// --- RENDERING ---
function renderDashboard() {
    const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    document.getElementById('total-balance').innerHTML = `${formatMoney(total)} <span class="currency">تومان</span>`;

    const accountsContainer = document.getElementById('accounts-container');
    accountsContainer.innerHTML = '';
    
    if (state.accounts.length === 0) {
         accountsContainer.innerHTML = '<div style="color:white; opacity:0.7; padding:10px;">حسابی وجود ندارد</div>';
    }

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
    
    if (recent.length === 0) {
        recentContainer.innerHTML = '<div class="empty-state"><i class="material-icons">receipt</i><br>تراکنشی ثبت نشده</div>';
    } else {
        recent.forEach(t => recentContainer.appendChild(createTransactionEl(t)));
    }
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

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="material-icons">search_off</i><br>تراکنشی یافت نشد</div>';
    } else {
        filtered.forEach(t => container.appendChild(createTransactionEl(t)));
    }
}

function createTransactionEl(t) {
    const div = document.createElement('div');
    div.className = 'transaction-item';
    
    let iconClass = '';
    let icon = 'help_outline';
    let amountColorClass = '';
    let sign = '';

    if (t.type === 'expense') {
        icon = 'trending_down';
        iconClass = 'bg-expense';
        amountColorClass = 'expense';
        sign = '-';
    } else if (t.type === 'income') {
        icon = 'trending_up';
        iconClass = 'bg-income';
        amountColorClass = 'income';
        sign = '+';
    } else {
        icon = 'swap_horiz';
        iconClass = 'bg-transfer';
        amountColorClass = 'transfer';
        sign = '';
    }

    const tagsHtml = (t.tags || []).join(' ');

    div.innerHTML = `
        <div class="trans-icon-box ${iconClass}">
            <i class="material-icons">${icon}</i>
        </div>
        <div class="trans-details">
            <div class="trans-title">${t.title}</div>
            <div class="trans-meta">
                <i class="material-icons" style="font-size:12px">account_balance_wallet</i>
                ${getAccountName(t.accountId)} 
                ${t.targetAccountId ? `<i class="material-icons" style="font-size:12px; margin-right:5px">arrow_back</i> ${getAccountName(t.targetAccountId)}` : ''}
                <span style="margin: 0 5px">•</span> ${toPersianNum(t.date)}
            </div>
            ${tagsHtml ? `<div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:4px;">${tagsHtml}</div>` : ''}
        </div>
        <div class="trans-amount ${amountColorClass}">
            ${sign}${formatMoney(t.amount)}
        </div>
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
            <div class="account-actions">
                <i class="material-icons" onclick="deleteAccount(${acc.id})">delete</i>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- CATEGORIES LOGIC ---
window.openCategoriesModal = function() {
    renderCategoriesList();
    document.getElementById('modal-categories').style.display = 'flex';
}

function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    container.innerHTML = '';
    
    const tagCounts = {};
    state.transactions.forEach(t => {
        const currentTags = t.tags || [];
        currentTags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    
    const tags = Object.keys(tagCounts).sort();
    
    if (tags.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="material-icons">label_off</i><br>دسته بندی وجود ندارد</div>';
        return;
    }

    tags.forEach(tag => {
        const count = tagCounts[tag];
        const div = document.createElement('div');
        div.className = 'account-manage-item';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="account-icon" style="background:rgba(255,255,255,0.1)">
                    <i class="material-icons">label</i>
                </div>
                <div>
                    <div style="font-weight:700">${tag}</div>
                    <div style="font-size:12px; color:rgba(255,255,255,0.6)">${toPersianNum(count)} تراکنش</div>
                </div>
            </div>
            <div class="account-actions">
                <i class="material-icons" onclick="deleteTag('${tag}')">delete</i>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deleteTag = function(tag) {
    showConfirm('حذف دسته‌بندی', `آیا از حذف دسته بندی ${tag} مطمئن هستید؟ تراکنش‌ها باقی می‌مانند اما تگ حذف می‌شود.`, () => {
        let modified = false;
        state.transactions.forEach(t => {
            if (t.tags && t.tags.includes(tag)) {
                t.tags = t.tags.filter(x => x !== tag);
                if (t.tags.length === 0) t.tags = ['#سایر'];
                modified = true;
            }
        });
        
        if (modified) {
            saveData();
            renderCategoriesList();
            showToast('دسته‌بندی با موفقیت حذف شد', 'success');
        }
    });
}

function getAccountName(id) {
    const acc = state.accounts.find(a => a.id == id);
    return acc ? acc.name : 'حذف شده';
}

// --- SETTINGS FEATURES ---

// 1. Calculate Storage
function calculateStorage() {
    let total = 0;
    for (let x in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
            total += (localStorage[x].length + x.length) * 2;
        }
    }
    const kb = (total / 1024).toFixed(2);
    document.getElementById('storage-usage').innerText = `فضای اشغال شده: ${toPersianNum(kb)} کیلوبایت`;
}

// 2. Reset Data
window.resetAppData = function() {
    showConfirm('حذف کل اطلاعات', 'آیا مطمئن هستید؟ تمام اطلاعات (حساب‌ها و تراکنش‌ها) پاک خواهند شد و قابل بازگشت نیستند.', () => {
        localStorage.removeItem(DB_NAME);
        location.reload();
    });
}

// 3. Backup Data
window.backupData = function() {
    const dataStr = localStorage.getItem(DB_NAME);
    if (!dataStr) {
        showToast('هیچ داده‌ای برای بکاپ وجود ندارد', 'error');
        return;
    }
    
    const dataObj = JSON.parse(dataStr);
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], {type : 'application/json'});
    
    // Create Date String for Filename
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
    const fileName = `Poolaki_Backup_${dateStr}.json`;
    
    // Create download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('فایل پشتیبان دانلود شد', 'success');
}

// 4. Restore Data
window.restoreData = function(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const parsedData = JSON.parse(content);
            
            // Simple Validation
            if (!parsedData.accounts || !parsedData.transactions) {
                throw new Error('فرمت فایل نامعتبر است');
            }

            showConfirm('بازیابی اطلاعات', 'آیا مطمئن هستید؟ با تایید این عملیات، اطلاعات فعلی حذف و اطلاعات فایل جایگزین می‌شود.', () => {
                localStorage.setItem(DB_NAME, JSON.stringify(parsedData));
                showToast('اطلاعات با موفقیت بازیابی شد', 'success');
                setTimeout(() => location.reload(), 1000);
            });

        } catch (err) {
            showToast('خطا در خواندن فایل بکاپ', 'error');
        } finally {
            input.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
}

// 5. Update App
window.checkForUpdate = function() {
    showConfirm('بروزرسانی', 'آیا می‌خواهید نسخه جدید را بررسی و دریافت کنید؟ برنامه مجدداً بارگذاری می‌شود.', () => {
        if ('caches' in window) {
            caches.keys().then(function(names) {
                return Promise.all(names.map(function(name) {
                    return caches.delete(name);
                }));
            }).then(function() {
                if ('serviceWorker' in navigator) {
                     navigator.serviceWorker.getRegistrations().then(function(registrations) {
                        for(let registration of registrations) {
                            registration.unregister();
                        }
                        window.location.reload(true);
                    });
                } else {
                     window.location.reload(true);
                }
            });
        } else {
            window.location.reload(true);
        }
    });
}

// --- ACTIONS ---

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${viewName}`);
    if(navItem) navItem.classList.add('active');

    if(viewName === 'dashboard') renderDashboard();
    if(viewName === 'history') renderHistory();
    if(viewName === 'accounts') renderAccountsList();
    if(viewName === 'settings') calculateStorage();
}

window.setTransType = function(type) {
    state.currentTransType = type;
    document.querySelectorAll('.type-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`opt-${type}`).classList.add('selected');

    const targetGroup = document.getElementById('target-account-group');
    if (type === 'transfer') {
        targetGroup.style.display = 'block';
    } else {
        targetGroup.style.display = 'none';
    }
}

function saveTransaction(e) {
    e.preventDefault();
    const amount = cleanNumber(document.getElementById('trans-amount').value);
    const title = document.getElementById('trans-title').value;
    const accId = parseInt(document.getElementById('trans-account').value);
    const targetId = parseInt(document.getElementById('trans-target-account').value);
    
    // Handle Tags
    const tagsInput = document.getElementById('trans-tags').value;
    let tags = [];
    if (tagsInput && tagsInput.trim().length > 0) {
        tags = tagsInput.trim().split(/[\s,]+/) 
            .slice(0, 3) 
            .map(t => t.startsWith('#') ? t : '#' + t);
    }
    if (tags.length === 0) tags = ['#سایر'];

    if (!amount || !title) {
        showToast('لطفا مبلغ و عنوان را وارد کنید', 'error');
        return;
    }
    if (!accId) {
        showToast('لطفا حساب مبدا را انتخاب کنید', 'error');
        return;
    }

    if (state.currentTransType === 'transfer' && !targetId) {
        showToast('لطفا حساب مقصد را انتخاب کنید', 'error');
        return;
    }

    if (state.currentTransType === 'transfer' && accId === targetId) {
        showToast('حساب مبدا و مقصد نمی‌تواند یکسان باشد', 'error');
        return;
    }

    const srcAcc = state.accounts.find(a => a.id === accId);
    
    if (state.currentTransType === 'expense') {
        srcAcc.balance -= amount;
    } else if (state.currentTransType === 'income') {
        srcAcc.balance += amount;
    } else if (state.currentTransType === 'transfer') {
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
    
    // Reset Custom Selects UI
    document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...';
    document.getElementById('trans-account').value = '';
    document.getElementById('trigger-trans-target-account').innerText = 'انتخاب کنید...';
    document.getElementById('trans-target-account').value = '';
    
    document.getElementById('trans-amount').value = ''; 
    showToast('تراکنش با موفقیت ثبت شد', 'success');
}

function saveAccount(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const balance = cleanNumber(document.getElementById('acc-balance').value);
    const type = document.getElementById('acc-type').value;

    const newAcc = {
        id: Date.now(),
        name: name,
        type: type,
        balance: balance
    };

    state.accounts.push(newAcc);
    saveData();
    closeModal('modal-account');
    document.getElementById('form-account').reset();
    
    // Reset Select
    document.getElementById('trigger-acc-type').innerText = 'کارت بانکی';
    document.getElementById('acc-type').value = 'card';
    
    showToast('حساب جدید ایجاد شد', 'success');
}

window.deleteAccount = function(id) {
    if(state.accounts.length <= 1) {
        showToast('نمی‌توانید آخرین حساب را حذف کنید', 'error');
        return;
    }
    showConfirm('حذف حساب', 'آیا از حذف این حساب مطمئن هستید؟ تراکنش‌های مرتبط باقی می‌مانند.', () => {
        state.accounts = state.accounts.filter(a => a.id !== id);
        saveData();
        showToast('حساب با موفقیت حذف شد', 'success');
    });
}

window.filterTransactions = function() {
    const val = document.getElementById('transaction-search').value;
    renderHistory(val);
}

window.openAddTransactionModal = function() {
    // Reset Selects if empty
    if(!document.getElementById('trans-account').value) {
        document.getElementById('trigger-trans-account').innerText = 'انتخاب کنید...';
    }
    document.getElementById('modal-transaction').style.display = 'flex';
}

window.openAddAccountModal = function() {
    document.getElementById('modal-account').style.display = 'flex';
}

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
}
