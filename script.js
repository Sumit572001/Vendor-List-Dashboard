import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCuuwp1acUFZBSW3c4u8fjyTeLCHvnGDgg",
  authDomain: "vendor-list-dashboard.firebaseapp.com",
  databaseURL: "https://vendor-list-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vendor-list-dashboard",
  storageBucket: "vendor-list-dashboard.firebasestorage.app",
  messagingSenderId: "319292498066",
  appId: "1:319292498066:web:521736b4b0dfab4322464b",
  measurementId: "G-089T0FGDBY"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const vendorsRef = ref(db, 'vendors');

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

// Add Custom Category Popup Logic
document.getElementById('addCustomCategoryBtn').addEventListener('click', () => {
    // Create popup overlay
    const popupOverlay = document.createElement('div');
    popupOverlay.id = 'categoryPopupOverlay';
    popupOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999; backdrop-filter: blur(4px);
    `;

    popupOverlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 2rem; width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideIn 0.2s ease;">
            <h3 style="margin: 0 0 0.5rem; font-size: 1.2rem; font-weight: 700; color: #1e293b;">➕ Add New Category</h3>
            <p style="margin: 0 0 1.5rem; color: #64748b; font-size: 0.85rem;">Enter a name for the new contractor category.</p>
            <label style="font-size: 0.8rem; font-weight: 600; color: #374151; display: block; margin-bottom: 6px;">Category Name</label>
            <input id="newCategoryInput" type="text" placeholder="e.g. Civil Contractor" style="
                width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
                border-radius: 8px; font-size: 0.95rem; outline: none; box-sizing: border-box;
                transition: border-color 0.2s;
            " autofocus>
            <div style="display: flex; gap: 10px; margin-top: 1.5rem; justify-content: flex-end;">
                <button id="cancelCategoryBtn" type="button" style="
                    padding: 8px 20px; border: 1.5px solid #e2e8f0; background: white;
                    border-radius: 8px; cursor: pointer; font-weight: 600; color: #64748b;
                    transition: all 0.2s;
                ">Cancel</button>
                <button id="saveCategoryBtn" type="button" style="
                    padding: 8px 20px; background: #2563eb; color: white; border: none;
                    border-radius: 8px; cursor: pointer; font-weight: 600;
                    transition: all 0.2s;
                ">Add Category</button>
            </div>
        </div>
    `;

    document.body.appendChild(popupOverlay);

    const input = document.getElementById('newCategoryInput');
    input.focus();
    input.addEventListener('focus', () => input.style.borderColor = '#2563eb');
    input.addEventListener('blur', () => input.style.borderColor = '#e2e8f0');

    // Close on Cancel
    document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
        popupOverlay.remove();
    });

    // Close on overlay click
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) popupOverlay.remove();
    });

    // Save Category
    const saveCategory = () => {
        const newCatName = input.value.trim();
        if (!newCatName) {
            input.style.borderColor = '#ef4444';
            input.placeholder = 'Please enter a category name!';
            return;
        }

        const categorySelect = document.getElementById('category');

        // Check if already exists
        const exists = Array.from(categorySelect.options).some(
            opt => opt.value.toLowerCase() === newCatName.toLowerCase()
        );
        if (exists) {
            input.style.borderColor = '#f59e0b';
            input.value = '';
            input.placeholder = 'This category already exists!';
            return;
        }

        // Add to dropdown
        const option = document.createElement('option');
        option.value = newCatName;
        option.textContent = newCatName + ' Contractor';
        categorySelect.appendChild(option);
        categorySelect.value = newCatName;

        // Save to localStorage so it persists
        customCategories.push(newCatName);
        localStorage.setItem('customCategories', JSON.stringify(customCategories));

        popupOverlay.remove();
    };

    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCategory(); });
});

// Restore custom categories on page load
const categorySelect = document.getElementById('category');
customCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat + ' Contractor';
    categorySelect.appendChild(option);
});

const format = (val) => (!val || typeof val !== 'string' || val.trim() === '' || val === '-') ? '-' : val.trim();

onValue(vendorsRef, (snapshot) => {
    const data = snapshot.val();
    vendors = [];
    if (data) {
        Object.keys(data).forEach(key => vendors.push({ id: key, ...data[key] }));
    }
    renderTable(vendors);
});

function renderTable(data) {
    tableBody.innerHTML = '';
    const mainCategories = ["HVAC", "LIFT", "Electrical", "Plumbing", "Stack Parking", "ELV", "Fire Fighting"];
    const grouped = data.reduce((acc, row) => {
        const cat = row.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(row);
        return acc;
    }, {});

    const allCategories = [...new Set([...mainCategories, ...Object.keys(grouped)])].filter(c => c !== 'General');
    let globalIndex = 1;

    allCategories.forEach(category => {
        const categoryData = grouped[category] || [];
        if (categoryData.length === 0 && searchInput.value !== '') return;
        
        const headerRow = document.createElement('tr');
        headerRow.className = 'category-header';
        headerRow.innerHTML = `<td colspan="8" style="padding: 1rem; text-align: left; background: #fee2e2; border-top: 2px solid var(--primary); color: #991b1b; font-weight: 800; border-bottom: 1px solid var(--primary);">${category.toUpperCase()} CONTRACTOR</td>`;
        tableBody.appendChild(headerRow);

        if (categoryData.length === 0) tableBody.appendChild(createEmptyRow());

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
                        <button class="action-btn edit-btn" onclick="window.editVendor('${item.id}')" title="Edit">✏️</button>
                        <button class="action-btn delete-btn" onclick="window.deleteVendor('${item.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    });

    document.querySelectorAll('.row-delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
                remove(ref(db, `vendors/${id}`));
            }
        };
    });
    
    if (data.length === 0 && searchInput.value !== '') {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">No vendors found matching your search.</td></tr>';
    }
}

function createEmptyRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align: center; color: #cbd5e1; font-style: italic; font-size: 0.8rem; padding: 0.5rem;">No entries in this category</td>`;
    return tr;
}

window.deleteVendor = (id) => {
    if (confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
        remove(ref(db, `vendors/${id}`));
    }
};

window.editVendor = (id) => {
    const vendor = vendors.find(v => v.id === id);
    if (!vendor) return;

    editingId = id;
    modalTitle.innerText = 'Edit Contact Details';
    document.getElementById('category').value = vendor.category;
    document.getElementById('contractorName').value = vendor.name === '-' ? '' : vendor.name;
    document.getElementById('concernPerson').value = vendor.person === '-' ? '' : vendor.person;
    document.getElementById('designation').value = vendor.designation === '-' ? '' : vendor.designation;
    document.getElementById('mailId').value = vendor.mail === '-' ? '' : vendor.mail;
    document.getElementById('contactNo').value = vendor.contact === '-' ? '' : vendor.contact;
    document.getElementById('dealers').value = vendor.dealers === '-' ? '' : vendor.dealers;

    modalOverlay.style.display = 'flex';
};

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = vendors.filter(item => 
        item.name?.toLowerCase().includes(term) ||
        item.person?.toLowerCase().includes(term) ||
        item.contact?.toLowerCase().includes(term)
    );
    renderTable(filtered);
});

addContactBtn.addEventListener('click', () => {
    editingId = null;
    modalTitle.innerText = 'Add New Contact';
    addContactForm.reset();
    modalOverlay.style.display = 'flex';
});

cancelBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    addContactForm.reset();
});

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
        set(ref(db, `vendors/${editingId}`), data).then(() => {
            modalOverlay.style.display = 'none';
        });
    } else {
        push(vendorsRef, data).then(() => {
            modalOverlay.style.display = 'none';
        });
    }
});
