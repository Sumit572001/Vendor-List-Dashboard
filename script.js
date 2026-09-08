// Firebase Compat SDK (no import statements needed)
const firebaseConfig = {
    apiKey: "AIzaSyCuuwp1acUFZBSW3c4u8fjyTeLCHvnGDgg",
    authDomain: "vendor-list-dashboard.firebaseapp.com",
    databaseURL: "https://vendor-list-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "vendor-list-dashboard",
    storageBucket: "vendor-list-dashboard.firebasestorage.app",
    messagingSenderId: "319292498066",
    appId: "1:319292498066:web:521736b4b0dfab4322464b"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const vendorsRef = db.ref('vendors');

const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const addContactBtn = document.getElementById('addContactBtn');
const modalOverlay = document.getElementById('modalOverlay');
const cancelBtn = document.getElementById('cancelBtn');
const addContactForm = document.getElementById('addContactForm');
const modalTitle = document.querySelector('.modal-header h2');

let vendors = [];
let editingId = null;
let customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');

// ── Add Custom Category Popup ──────────────────────────────────────────────
document.getElementById('addCustomCategoryBtn').addEventListener('click', () => {
    const popupOverlay = document.createElement('div');
    popupOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999; backdrop-filter: blur(4px);
    `;
    popupOverlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 2rem; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin: 0 0 0.5rem; font-size: 1.2rem; font-weight: 700; color: #1e293b;">➕ Add New Category</h3>
            <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.85rem;">Enter a name for the new contractor category.</p>
            <label style="font-size: 0.8rem; font-weight: 600; color: #374151; display: block; margin-bottom: 6px;">Category Name</label>
            <input id="newCategoryInput" type="text" placeholder="e.g. Civil Contractor" style="
                width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
                border-radius: 8px; font-size: 0.95rem; outline: none; box-sizing: border-box;">
            <div style="display: flex; gap: 10px; margin-top: 1.5rem; justify-content: flex-end;">
                <button id="cancelCategoryBtn" type="button" style="padding: 8px 20px; border: 1.5px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #64748b;">Cancel</button>
                <button id="saveCategoryBtn" type="button" style="padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Add Category</button>
            </div>
        </div>
    `;
    document.body.appendChild(popupOverlay);

    const input = document.getElementById('newCategoryInput');
    input.focus();

    document.getElementById('cancelCategoryBtn').addEventListener('click', () => popupOverlay.remove());
    popupOverlay.addEventListener('click', (e) => { if (e.target === popupOverlay) popupOverlay.remove(); });

    const saveCategory = () => {
        const newCatName = input.value.trim();
        if (!newCatName) { input.style.borderColor = '#ef4444'; return; }

        const categorySelect = document.getElementById('category');
        const exists = Array.from(categorySelect.options).some(opt => opt.value.toLowerCase() === newCatName.toLowerCase());
        if (exists) { input.style.borderColor = '#f59e0b'; input.value = ''; input.placeholder = 'Already exists!'; return; }

        const option = document.createElement('option');
        option.value = newCatName;
        option.textContent = newCatName + ' Contractor';
        categorySelect.appendChild(option);
        categorySelect.value = newCatName;

        customCategories.push(newCatName);
        localStorage.setItem('customCategories', JSON.stringify(customCategories));
        popupOverlay.remove();
    };

    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCategory(); });
});

// Restore saved custom categories on page load
const categorySelect = document.getElementById('category');
customCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat + ' Contractor';
    categorySelect.appendChild(option);
});

// ── Helpers ────────────────────────────────────────────────────────────────
const format = (val) => (!val || typeof val !== 'string' || val.trim() === '' || val === '-') ? '-' : val.trim();

// Show loading indicator initially
tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">⏳ Loading vendor data from Firebase...</td></tr>';

// ── Firebase Realtime Listener ─────────────────────────────────────────────
vendorsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    vendors = [];
    if (data) {
        Object.keys(data).forEach(key => vendors.push({ id: key, ...data[key] }));
    }
    renderTable(vendors);
}, (error) => {
    console.error("Firebase Read Error:", error);
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;">
                <strong>⚠️ Firebase Permission Denied Error!</strong><br>
                <span style="font-size: 0.85rem; color: #991b1b;">
                    Firebase database rules are blocking read access.<br>
                    Please go to <strong>Firebase Console ➔ Realtime Database ➔ Rules tab</strong> and change rules to <code>".read": true, ".write": true</code>.
                </span>
            </td>
        </tr>
    `;
});

// ── Render Table ───────────────────────────────────────────────────────────
function renderTable(data) {
    tableBody.innerHTML = '';
    const mainCategories = ["HVAC", "LIFT", "Electrical", "Plumbing", "Stack Parking", "ELV", "Fire Fighting"];

    if (!data || data.length === 0) {
        if (searchInput.value.trim() !== '') {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">No vendors found matching your search.</td></tr>';
        } else {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">No vendors found in database. Click "+ Add Contact" to create one.</td></tr>';
        }
        return;
    }

    // Helper for category matching (case-insensitive)
    const normalizeCat = (cat) => {
        if (!cat || cat === '-') return 'General';
        const str = cat.trim();
        const foundMain = mainCategories.find(c => c.toLowerCase() === str.toLowerCase());
        if (foundMain) return foundMain;
        const foundCustom = customCategories.find(c => c.toLowerCase() === str.toLowerCase());
        if (foundCustom) return foundCustom;
        return str;
    };

    const grouped = {};
    data.forEach(item => {
        const catKey = normalizeCat(item.category);
        if (!grouped[catKey]) grouped[catKey] = [];
        grouped[catKey].push(item);
    });

    const dataCatKeys = data.map(v => normalizeCat(v.category)).filter(c => c && c !== 'General');
    const allCatKeys = [...new Set([...mainCategories, ...customCategories, ...dataCatKeys])].filter(c => c && c !== 'General');

    let globalIndex = 1;

    allCatKeys.forEach(category => {
        const categoryData = grouped[category] || [];
        // Hide empty category headers when user is searching
        if (categoryData.length === 0 && searchInput.value.trim() !== '') return;

        const headerRow = document.createElement('tr');
        headerRow.className = 'category-header';
        headerRow.innerHTML = `<td colspan="8" style="padding: 1rem; text-align: left; background: #fee2e2; border-top: 2px solid var(--primary); color: #991b1b; font-weight: 800; border-bottom: 1px solid var(--primary);">${category.toUpperCase()} CONTRACTOR</td>`;
        tableBody.appendChild(headerRow);

        if (categoryData.length === 0) { tableBody.appendChild(createEmptyRow()); return; }

        categoryData.forEach((item) => {
            const tr = document.createElement('tr');
            const dealersVal = format(item.dealers);
            tr.innerHTML = `
                <td style="text-align: center; font-weight: 600;">${globalIndex++}</td>
                <td style="font-weight: 500;">${format(item.name)}</td>
                <td>${format(item.person)}</td>
                <td>${format(item.designation)}</td>
                <td>${(item.mail && item.mail !== '-') ? `<a href="mailto:${item.mail}" style="color: var(--primary); text-decoration: none;">${item.mail}</a>` : '-'}</td>
                <td style="font-family: monospace; font-weight: 600;">${format(item.contact)}</td>
                <td>${dealersVal === '-' ? '-' : `<span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${dealersVal}</span>`}</td>
                <td>
                    <div class="action-btn-container">
                        <button class="action-btn edit-btn" onclick="editVendor('${item.id}')" title="Edit">✏️</button>
                        <button class="action-btn delete-btn" onclick="deleteVendor('${item.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    });
}

function createEmptyRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align: center; color: #cbd5e1; font-style: italic; font-size: 0.8rem; padding: 0.5rem;">No entries in this category</td>`;
    return tr;
}

// ── Row Actions ────────────────────────────────────────────────────────────
function deleteVendor(id) {
    if (confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
        db.ref('vendors/' + id).remove();
    }
}

function editVendor(id) {
    const vendor = vendors.find(v => v.id === id);
    if (!vendor) return;
    editingId = id;
    modalTitle.innerText = 'Edit Contact Details';
    document.getElementById('category').value = vendor.category || 'HVAC';
    document.getElementById('contractorName').value = vendor.name === '-' ? '' : (vendor.name || '');
    document.getElementById('concernPerson').value = vendor.person === '-' ? '' : (vendor.person || '');
    document.getElementById('designation').value = vendor.designation === '-' ? '' : (vendor.designation || '');
    document.getElementById('mailId').value = vendor.mail === '-' ? '' : (vendor.mail || '');
    document.getElementById('contactNo').value = vendor.contact === '-' ? '' : (vendor.contact || '');
    document.getElementById('dealers').value = vendor.dealers === '-' ? '' : (vendor.dealers || '');
    modalOverlay.style.display = 'flex';
}

// ── Search ─────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = vendors.filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.person || '').toLowerCase().includes(term) ||
        (item.contact || '').toLowerCase().includes(term) ||
        (item.mail || '').toLowerCase().includes(term)
    );
    renderTable(filtered);
});

// ── Modal Open / Close ─────────────────────────────────────────────────────
addContactBtn.addEventListener('click', () => {
    editingId = null;
    modalTitle.innerText = 'Add New Contact';
    addContactForm.reset();
    modalOverlay.style.display = 'flex';
});

cancelBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    addContactForm.reset();
    editingId = null;
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
        addContactForm.reset();
        editingId = null;
    }
});

// ── Form Submit (Add & Edit) ───────────────────────────────────────────────
addContactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        category: document.getElementById('category').value,
        name: document.getElementById('contractorName').value || '-',
        person: document.getElementById('concernPerson').value || '-',
        designation: document.getElementById('designation').value || '-',
        mail: document.getElementById('mailId').value || '-',
        contact: document.getElementById('contactNo').value || '-',
        dealers: document.getElementById('dealers').value || '-',
        lastUpdated: Date.now()
    };

    if (editingId) {
        db.ref('vendors/' + editingId).set(data).then(() => {
            modalOverlay.style.display = 'none';
            editingId = null;
        });
    } else {
        vendorsRef.push(data).then(() => {
            modalOverlay.style.display = 'none';
            addContactForm.reset();
        });
    }
});
