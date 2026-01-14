let currentTable = 'users';
let tables = [];
let currentTableSchema = [];

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    refreshTables();
    loadStats();
});

// ==================== TAB MANAGEMENT ====================

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');

    // Load data for the tab
    if (tabName === 'records') {
        loadRecords();
    } else if (tabName === 'tables') {
        loadTablesList();
    } else if (tabName === 'stats') {
        loadStats();
    }
}

// ==================== TABLE MANAGEMENT ====================

async function refreshTables() {
    try {
        const response = await fetch('/api/tables');
        tables = await response.json();

        const select = document.getElementById('table-select');
        select.innerHTML = tables.length > 0
            ? tables.map(t => `<option value="${t.name}">${t.name} (${t.recordCount} records)</option>`).join('')
            : '<option value="">No tables available</option>';

        if (tables.length > 0) {
            currentTable = tables[0].name;
            loadRecords();
        }
    } catch (error) {
        showMessage('Error loading tables: ' + error.message, 'error');
    }
}

async function loadTablesList() {
    try {
        const response = await fetch('/api/tables');
        tables = await response.json();

        const container = document.getElementById('tables-list');
        
        if (tables.length === 0) {
            container.innerHTML = '<p>No tables created yet.</p>';
            return;
        }

        container.innerHTML = tables.map(table => `
            <div class="table-card">
                <div class="table-card-header">
                    <h3>${table.name}</h3>
                    <button onclick="dropTable('${table.name}')" class="btn-danger btn-sm">Drop</button>
                </div>
                <div class="table-card-body">
                    <p><strong>Records:</strong> ${table.recordCount}</p>
                    <p><strong>Columns:</strong></p>
                    <ul>
                        ${table.columns.map(col => `
                            <li>
                                ${col.name} (${col.dataType})
                                ${col.isPrimaryKey ? '<span class="badge">PK</span>' : ''}
                                ${col.isUnique ? '<span class="badge">UNIQUE</span>' : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showMessage('Error loading tables list: ' + error.message, 'error');
    }
}

async function createTable(event) {
    event.preventDefault();

    const tableName = document.getElementById('new-table-name').value.trim();
    const columnDefs = document.querySelectorAll('.column-def');

    const columns = Array.from(columnDefs).map(def => ({
        name: def.querySelector('.col-name').value.trim(),
        dataType: def.querySelector('.col-type').value,
        isPrimaryKey: def.querySelector('.col-primary').checked,
        isUnique: def.querySelector('.col-unique').checked
    }));

    if (!tableName || columns.length === 0) {
        showMessage('Please provide table name and at least one column', 'error');
        return;
    }

    try {
        const response = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableName, columns })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage(`Table '${tableName}' created successfully!`, 'success');
        document.getElementById('create-table-form').reset();
        document.getElementById('columns-container').innerHTML = `
            <div class="column-def">
                <input type="text" placeholder="Column name" class="col-name" required>
                <select class="col-type">
                    <option value="INT">INT</option>
                    <option value="VARCHAR">VARCHAR</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="DATE">DATE</option>
                </select>
                <label><input type="checkbox" class="col-primary"> Primary Key</label>
                <label><input type="checkbox" class="col-unique"> Unique</label>
            </div>
        `;
        
        await refreshTables();
        await loadTablesList();
    } catch (error) {
        showMessage('Error creating table: ' + error.message, 'error');
    }
}

async function dropTable(tableName) {
    if (!confirm(`Are you sure you want to drop table '${tableName}'? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/tables/${tableName}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage(`Table '${tableName}' dropped successfully!`, 'success');
        await refreshTables();
        await loadTablesList();
    } catch (error) {
        showMessage('Error dropping table: ' + error.message, 'error');
    }
}

function addColumnDef() {
    const container = document.getElementById('columns-container');
    const newDef = document.createElement('div');
    newDef.className = 'column-def';
    newDef.innerHTML = `
        <input type="text" placeholder="Column name" class="col-name" required>
        <select class="col-type">
            <option value="INT">INT</option>
            <option value="VARCHAR">VARCHAR</option>
            <option value="BOOLEAN">BOOLEAN</option>
            <option value="DATE">DATE</option>
        </select>
        <label><input type="checkbox" class="col-primary"> Primary Key</label>
        <label><input type="checkbox" class="col-unique"> Unique</label>
        <button type="button" onclick="this.parentElement.remove()" class="btn-danger btn-sm">Remove</button>
    `;
    container.appendChild(newDef);
}

// ==================== RECORD MANAGEMENT ====================

async function loadRecords() {
    const select = document.getElementById('table-select');
    currentTable = select.value;

    if (!currentTable) {
        return;
    }

    try {
        // Get table schema
        const tablesResponse = await fetch('/api/tables');
        const allTables = await tablesResponse.json();
        const tableInfo = allTables.find(t => t.name === currentTable);
        
        if (!tableInfo) {
            showMessage('Table not found', 'error');
            return;
        }

        currentTableSchema = tableInfo.columns;

        // Generate add record form
        generateAddRecordForm(tableInfo.columns);

        // Load records
        const response = await fetch(`/api/tables/${currentTable}/records`);
        const records = await response.json();

        displayRecords(records, tableInfo.columns);
    } catch (error) {
        showMessage('Error loading records: ' + error.message, 'error');
    }
}

function generateAddRecordForm(columns) {
    const container = document.getElementById('add-record-form');
    
    container.innerHTML = `
        <form id="add-form" onsubmit="addRecord(event)">
            ${columns.map(col => `
                <div class="form-group">
                    <label for="add-${col.name}">
                        ${col.name} (${col.dataType})
                        ${col.isPrimaryKey ? '<span class="badge">PK</span>' : ''}
                        ${col.isUnique ? '<span class="badge">UNIQUE</span>' : ''}
                    </label>
                    <input 
                        type="${getInputType(col.dataType)}" 
                        id="add-${col.name}" 
                        name="${col.name}"
                        ${col.isPrimaryKey ? 'required' : ''}
                        placeholder="Enter ${col.name}"
                    >
                </div>
            `).join('')}
            <button type="submit" class="btn-primary">Add Record</button>
        </form>
    `;
}

function getInputType(dataType) {
    if (!dataType || typeof dataType !== 'string') {
        return 'text';
    }
    switch (dataType.toUpperCase()) {
        case 'INT': return 'number';
        case 'BOOLEAN': return 'checkbox';
        case 'DATE': return 'date';
        default: return 'text';
    }
}

function displayRecords(records, columns) {
    const thead = document.getElementById('records-thead');
    const tbody = document.getElementById('records-tbody');

    if (records.length === 0) {
        thead.innerHTML = '<tr><th>No records found</th></tr>';
        tbody.innerHTML = '<tr><td>Add your first record above</td></tr>';
        return;
    }

    // Table header
    thead.innerHTML = `
        <tr>
            ${columns.map(col => `<th>${col.name}</th>`).join('')}
            <th>Actions</th>
        </tr>
    `;

    // Table body
    tbody.innerHTML = records.map(record => `
        <tr>
            ${columns.map(col => `<td>${formatValue(record[col.name], col.dataType)}</td>`).join('')}
            <td class="actions">
                <button onclick='editRecord(${JSON.stringify(record)})' class="btn-secondary btn-sm">Edit</button>
                <button onclick='deleteRecord(${JSON.stringify(record)})' class="btn-danger btn-sm">Delete</button>
            </td>
        </tr>
    `).join('');
}

function formatValue(value, dataType) {
    if (value === null || value === undefined) return '<em>null</em>';
    if (dataType === 'BOOLEAN') return value ? 'Yes' : 'No';
    if (dataType === 'DATE') return new Date(value).toLocaleDateString();
    return value;
}

async function addRecord(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {};
    
    currentTableSchema.forEach(col => {
        const value = formData.get(col.name);
        
        if (col.dataType === 'INT') {
            const num = parseInt(value, 10);
            data[col.name] = isNaN(num) ? null : num;
        } else if (col.dataType === 'BOOLEAN') {
            data[col.name] = value === 'on';
        } else if (col.dataType === 'DATE') {
            data[col.name] = value ? new Date(value).toISOString() : null;
        } else {
            data[col.name] = value || null;
        }
    });

    try {
        const response = await fetch(`/api/tables/${currentTable}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage('Record added successfully!', 'success');
        event.target.reset();
        loadRecords();
    } catch (error) {
        showMessage('Error adding record: ' + error.message, 'error');
    }
}

async function editRecord(record) {
    const primaryKeyCol = currentTableSchema.find(col => col.isPrimaryKey);
    
    if (!primaryKeyCol) {
        showMessage('Cannot edit: No primary key defined', 'error');
        return;
    }

    const newValues = {};
    let hasChanges = false;

    for (const col of currentTableSchema) {
        if (col.isPrimaryKey) continue;

        const currentValue = record[col.name];
        const newValue = prompt(`Edit ${col.name} (${col.dataType}):`, currentValue);
        
        if (newValue !== null && newValue !== currentValue) {
            hasChanges = true;
            if (col.dataType === 'INT') {
                const num = parseInt(newValue, 10);
                newValues[col.name] = isNaN(num) ? null : num;
            } else if (col.dataType === 'BOOLEAN') {
                newValues[col.name] = newValue === 'true' || newValue === '1';
            } else if (col.dataType === 'DATE') {
                newValues[col.name] = newValue ? new Date(newValue).toISOString() : null;
            } else {
                newValues[col.name] = newValue || null;
            }
        }
    }

    if (!hasChanges) {
        showMessage('No changes made', 'info');
        return;
    }

    try {
        const response = await fetch(`/api/tables/${currentTable}/records`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: newValues,
                condition: {
                    column: primaryKeyCol.name,
                    operator: '=',
                    value: record[primaryKeyCol.name]
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage('Record updated successfully!', 'success');
        loadRecords();
    } catch (error) {
        showMessage('Error updating record: ' + error.message, 'error');
    }
}

async function deleteRecord(record) {
    const primaryKeyCol = currentTableSchema.find(col => col.isPrimaryKey);
    
    if (!primaryKeyCol) {
        showMessage('Cannot delete: No primary key defined', 'error');
        return;
    }

    const recordId = record[primaryKeyCol.name];
    
    if (!confirm(`Delete record with ${primaryKeyCol.name} = ${recordId}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/tables/${currentTable}/records`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                condition: {
                    column: primaryKeyCol.name,
                    operator: '=',
                    value: recordId
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage('Record deleted successfully!', 'success');
        loadRecords();
    } catch (error) {
        showMessage('Error deleting record: ' + error.message, 'error');
    }
}

// ==================== STATISTICS ====================

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        const container = document.getElementById('stats-content');
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Tables</h3>
                    <div class="stat-value">${stats.totalTables}</div>
                </div>
                <div class="stat-card">
                    <h3>Database Size</h3>
                    <div class="stat-value">${formatBytes(stats.databaseSize)}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Records</h3>
                    <div class="stat-value">${stats.tables.reduce((sum, t) => sum + t.recordCount, 0)}</div>
                </div>
            </div>

            <h3>Table Details</h3>
            <div class="table-stats">
                ${stats.tables.map(table => `
                    <div class="table-stat">
                        <strong>${table.name}</strong>
                        <span>${table.recordCount} records, ${table.columnCount} columns</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        showMessage('Error loading statistics: ' + error.message, 'error');
    }
}

function refreshStats() {
    loadStats();
    showMessage('Statistics refreshed', 'success');
}

async function syncDatabase() {
    const syncButtons = [
        document.getElementById('sync-btn'),
        document.getElementById('sync-btn-records'),
        document.getElementById('sync-btn-tables')
    ];

    try {
        // Disable all sync buttons
        syncButtons.forEach(btn => {
            if (btn) btn.disabled = true;
        });

        showMessage('Syncing database from disk...', 'info');

        const response = await fetch('/api/sync', { method: 'POST' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        showMessage(`Database synced! Loaded ${result.tablesLoaded} table(s)`, 'success');

        // Refresh all data views
        await refreshTables();
        await loadStats();

        // If on records tab and a table is selected, reload records
        const recordsTab = document.getElementById('records-tab');
        if (recordsTab.classList.contains('active') && currentTable) {
            loadRecords();
        }

        // If on tables tab, reload table list
        const tablesTab = document.getElementById('tables-tab');
        if (tablesTab.classList.contains('active')) {
            await loadTablesList();
        }
    } catch (error) {
        showMessage('Error syncing database: ' + error.message, 'error');
    } finally {
        // Re-enable all sync buttons
        syncButtons.forEach(btn => {
            if (btn) btn.disabled = false;
        });
    }
}

async function createBackup() {
    try {
        const response = await fetch('/api/backup', { method: 'POST' });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        showMessage(`Backup created: ${result.backupPath}`, 'success');
        loadStats();
        loadBackups(); // Refresh backup list if visible
    } catch (error) {
        showMessage('Error creating backup: ' + error.message, 'error');
    }
}

async function loadBackups() {
    try {
        const response = await fetch('/api/backups');
        const backups = await response.json();

        const backupsSection = document.getElementById('backups-section');
        const backupsList = document.getElementById('backups-list');

        if (backups.length === 0) {
            backupsList.innerHTML = '<p>No backups available</p>';
        } else {
            backupsList.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Backup File</th>
                            <th>Size</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${backups.map(backup => `
                            <tr>
                                <td>${backup.fileName}</td>
                                <td>${formatBytes(backup.size)}</td>
                                <td>${new Date(backup.created).toLocaleString()}</td>
                                <td class="actions">
                                    <button onclick='restoreBackup("${backup.path}")' class="btn-primary btn-sm">
                                        Restore
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        backupsSection.style.display = 'block';
    } catch (error) {
        showMessage('Error loading backups: ' + error.message, 'error');
    }
}

async function restoreBackup(backupPath) {
    if (!confirm(`WARNING: This will replace ALL current data with the backup data.\n\nAre you sure you want to restore from:\n${backupPath.split('/').pop()}?`)) {
        return;
    }

    try {
        const response = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backupPath })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        showMessage('Database restored successfully! Reloading...', 'success');
        
        // Reload the page to refresh all data
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        showMessage('Error restoring backup: ' + error.message, 'error');
    }
}

// ==================== UTILITIES ====================

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showMessage(text, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type} show`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}