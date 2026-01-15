let currentTable = 'users';
let tables = [];
let currentTableSchema = [];

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    refreshTables();
    loadStats();
    // Initialize foreign key table selectors on page load
    initializeForeignKeySelectors();
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
        const data = await response.json();
        tables = data.tables || data; // Support both old and new format

        const select = document.getElementById('table-select');
        select.innerHTML = tables.length > 0
            ? tables.map(t => `<option value="${t.name}">${t.name} (${t.recordCount} records)</option>`).join('')
            : '<option value="">No tables available</option>';

        if (tables.length > 0) {
            currentTable = tables[0].name;
            loadRecords();
        } else {
            // Clear records display when no tables exist
            currentTable = null;
            clearRecordsDisplay();
        }
    } catch (error) {
        showMessage('Error loading tables: ' + error.message, 'error');
    }
}

async function loadTablesList() {
    try {
        const response = await fetch('/api/tables');
        const data = await response.json();
        tables = data.tables || data; // Support both old and new format

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
                                ${col.isForeignKey && col.foreignKeyReference ? `<span class="badge badge-fk">FK → ${col.foreignKeyReference.table}.${col.foreignKeyReference.column}</span>` : ''}
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

    const columns = Array.from(columnDefs).map(def => {
        const isForeignKey = def.querySelector('.col-foreign-key').checked;
        const column = {
            name: def.querySelector('.col-name').value.trim(),
            dataType: def.querySelector('.col-type').value,
            isPrimaryKey: def.querySelector('.col-primary').checked,
            isUnique: def.querySelector('.col-unique').checked,
            isForeignKey: isForeignKey
        };

        if (isForeignKey) {
            const refTable = def.querySelector('.col-fk-table').value;
            const refColumn = def.querySelector('.col-fk-column').value;
            if (refTable && refColumn) {
                column.foreignKeyReference = {
                    table: refTable,
                    column: refColumn
                };
            }
        }

        return column;
    });

    if (!tableName || columns.length === 0) {
        showMessage('Please provide table name and at least one column', 'error');
        return;
    }

    // Validate foreign keys
    for (const col of columns) {
        if (col.isForeignKey && !col.foreignKeyReference) {
            showMessage(`Column '${col.name}' is marked as foreign key but has no reference selected`, 'error');
            return;
        }
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
        await resetColumnContainer();
        
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
        <label><input type="checkbox" class="col-foreign-key" onchange="toggleForeignKeyOptions(this)"> Foreign Key</label>
        <div class="foreign-key-options" style="display: none;">
            <select class="col-fk-table" onchange="loadForeignKeyColumns(this)">
                <option value="">Select table...</option>
            </select>
            <select class="col-fk-column">
                <option value="">Select column...</option>
            </select>
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="btn-danger btn-sm">Remove</button>
    `;
    container.appendChild(newDef);
    
    // Load available tables into the foreign key table selector
    loadForeignKeyTables(newDef.querySelector('.col-fk-table'));
}

// Toggle foreign key options visibility
function toggleForeignKeyOptions(checkbox) {
    const columnDef = checkbox.closest('.column-def');
    const fkOptions = columnDef.querySelector('.foreign-key-options');
    
    if (checkbox.checked) {
        fkOptions.style.display = 'flex';
        // Load tables when enabled
        loadForeignKeyTables(columnDef.querySelector('.col-fk-table'));
    } else {
        fkOptions.style.display = 'none';
        // Clear selections
        columnDef.querySelector('.col-fk-table').value = '';
        columnDef.querySelector('.col-fk-column').value = '';
    }
}

// Load available tables for foreign key reference
async function loadForeignKeyTables(selectElement) {
    try {
        const response = await fetch('/api/tables');
        const tablesData = await response.json();
        const tables = tablesData.tables || tablesData;
        
        selectElement.innerHTML = '<option value="">Select table...</option>';
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.name;
            option.textContent = table.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading tables for foreign key:', error);
    }
}

// Load columns from selected table for foreign key reference
async function loadForeignKeyColumns(tableSelectElement) {
    const columnDef = tableSelectElement.closest('.column-def');
    const columnSelect = columnDef.querySelector('.col-fk-column');
    const selectedTable = tableSelectElement.value;
    
    columnSelect.innerHTML = '<option value="">Select column...</option>';
    
    if (!selectedTable) {
        return;
    }
    
    try {
        const response = await fetch('/api/tables');
        const tablesData = await response.json();
        const tables = tablesData.tables || tablesData;
        const table = tables.find(t => t.name === selectedTable);
        
        if (table && table.columns) {
            table.columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col.name;
                option.textContent = `${col.name} (${col.dataType})`;
                columnSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading columns for foreign key:', error);
    }
}

// Reset column container to default state
async function resetColumnContainer() {
    const container = document.getElementById('columns-container');
    container.innerHTML = `
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
            <label><input type="checkbox" class="col-foreign-key" onchange="toggleForeignKeyOptions(this)"> Foreign Key</label>
            <div class="foreign-key-options" style="display: none;">
                <select class="col-fk-table" onchange="loadForeignKeyColumns(this)">
                    <option value="">Select table...</option>
                </select>
                <select class="col-fk-column">
                    <option value="">Select column...</option>
                </select>
            </div>
        </div>
    `;
    
    // Load tables for the initial column
    const fkTableSelect = container.querySelector('.col-fk-table');
    if (fkTableSelect) {
        await loadForeignKeyTables(fkTableSelect);
    }
}

// Initialize foreign key selectors for all existing column definitions
async function initializeForeignKeySelectors() {
    const fkTableSelects = document.querySelectorAll('.col-fk-table');
    for (const select of fkTableSelects) {
        await loadForeignKeyTables(select);
    }
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
        const tablesData = await tablesResponse.json();
        const allTables = tablesData.tables || tablesData; // Support both old and new format
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

// Clear records display when no tables exist
function clearRecordsDisplay() {
    const thead = document.getElementById('records-thead');
    const tbody = document.getElementById('records-tbody');
    const addRecordForm = document.getElementById('add-record-form');
    
    thead.innerHTML = '<tr><th>No Tables Available</th></tr>';
    tbody.innerHTML = '<tr><td>Create a table first to start adding records</td></tr>';
    addRecordForm.innerHTML = '<p>No table selected. Create or select a table to add records.</p>';
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

let editingRecord = null;

async function editRecord(record) {
    const primaryKeyCol = currentTableSchema.find(col => col.isPrimaryKey);
    
    if (!primaryKeyCol) {
        showMessage('Cannot edit: No primary key defined', 'error');
        return;
    }

    // Store the original record for submission
    editingRecord = record;
    
    // Generate form fields
    const fieldsContainer = document.getElementById('edit-record-fields');
    fieldsContainer.innerHTML = currentTableSchema.map(col => {
        const isPK = col.isPrimaryKey;
        const isUnique = col.isUnique;
        const currentValue = record[col.name];
        
        // Special handling for different data types
        let inputHtml = '';
        if (col.dataType === 'BOOLEAN') {
            const isChecked = currentValue === true || currentValue === 1 || currentValue === 'true';
            inputHtml = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input 
                        type="checkbox" 
                        id="edit-${col.name}" 
                        name="${col.name}"
                        ${isChecked ? 'checked' : ''}
                        ${isPK ? 'disabled' : ''}
                        style="width: 20px; height: 20px; cursor: pointer;"
                    >
                    <label for="edit-${col.name}" style="margin: 0; cursor: pointer;">
                        ${isChecked ? 'True' : 'False'} (Click to toggle)
                    </label>
                </div>
            `;
        } else {
            // Format the display value based on data type
            let displayValue = '';
            if (currentValue !== null && currentValue !== undefined) {
                if (col.dataType === 'DATE') {
                    // Convert ISO date to YYYY-MM-DD format for date inputs
                    const dateObj = currentValue instanceof Date ? currentValue : new Date(currentValue);
                    displayValue = dateObj.toISOString().split('T')[0];
                } else {
                    displayValue = currentValue;
                }
            }
            
            inputHtml = `
                <input 
                    type="${getInputType(col.dataType)}" 
                    id="edit-${col.name}" 
                    name="${col.name}"
                    value="${displayValue}"
                    ${isPK ? 'disabled' : ''}
                    placeholder="${isPK ? 'Cannot edit primary key' : 'Leave unchanged or enter new ' + col.name}"
                >
            `;
        }
        
        return `
            <div class="form-group">
                <label for="edit-${col.name}">
                    <span>${col.name}</span>
                    <span class="field-type">${col.dataType}</span>
                    ${isPK ? '<span class="field-badge badge-pk">PRIMARY KEY</span>' : ''}
                    ${isUnique && !isPK ? '<span class="field-badge badge-unique">UNIQUE</span>' : ''}
                    ${isPK ? '<span class="field-badge badge-readonly">READ-ONLY</span>' : ''}
                </label>
                ${inputHtml}
                ${isPK ? '<small>Primary keys cannot be modified</small>' : ''}
            </div>
        `;
    }).join('');
    
    // Show modal
    document.getElementById('edit-record-modal').style.display = 'block';
}

function closeEditRecordModal() {
    document.getElementById('edit-record-modal').style.display = 'none';
    editingRecord = null;
}

async function submitEditRecord(event) {
    event.preventDefault();
    
    if (!editingRecord) {
        showMessage('No record to edit', 'error');
        return;
    }
    
    const primaryKeyCol = currentTableSchema.find(col => col.isPrimaryKey);
    const newValues = {};
    let hasChanges = false;

    // Collect new values from form - only include changed fields
    for (const col of currentTableSchema) {
        if (col.isPrimaryKey) continue;

        const input = document.getElementById(`edit-${col.name}`);
        const currentValue = editingRecord[col.name];
        
        let convertedValue, convertedCurrent;
        
        // Convert values based on data type for proper comparison
        if (col.dataType === 'INT') {
            convertedValue = input.value === '' ? null : parseInt(input.value, 10);
            convertedCurrent = currentValue === null || currentValue === undefined ? null : parseInt(currentValue, 10);
        } else if (col.dataType === 'BOOLEAN') {
            // For checkboxes, use the checked property
            convertedValue = input.checked;
            convertedCurrent = currentValue === true || currentValue === 1 || currentValue === 'true';
        } else if (col.dataType === 'DATE') {
            // Normalize dates to comparable strings (YYYY-MM-DD format)
            convertedValue = input.value || null;
            if (currentValue) {
                // Handle Date object or ISO string
                const dateObj = currentValue instanceof Date ? currentValue : new Date(currentValue);
                convertedCurrent = dateObj.toISOString().split('T')[0]; // Extract YYYY-MM-DD
            } else {
                convertedCurrent = null;
            }
        } else {
            // VARCHAR and other string types
            convertedValue = input.value || null;
            convertedCurrent = currentValue || null;
        }
        
        // Only include the field if it has actually changed
        if (convertedValue !== convertedCurrent) {
            hasChanges = true;
            newValues[col.name] = convertedValue;
        }
    }

    if (!hasChanges) {
        showMessage('No changes made', 'info');
        closeEditRecordModal();
        return;
    }

    // Debug: Log what we're sending
    console.log('Updating record with values:', newValues);
    console.log('Value types:', Object.entries(newValues).map(([key, val]) => 
        `${key}: ${typeof val} ${val instanceof Date ? '(Date object!)' : ''}`
    ));

    try {
        const response = await fetch(`/api/tables/${currentTable}/records`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: newValues,
                condition: {
                    column: primaryKeyCol.name,
                    operator: '=',
                    value: editingRecord[primaryKeyCol.name]
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showMessage('✓ Record updated successfully', 'success');
        closeEditRecordModal();
        await loadRecords();
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
// ==================== DATABASE MANAGEMENT ====================

let currentDatabase = 'default';

// Load all databases and populate selector
async function loadDatabaseSelector() {
    try {
        const response = await fetch('/api/databases');
        const data = await response.json();
        
        const select = document.getElementById('database-select');
        select.innerHTML = data.databases.map(db => 
            `<option value="${db.name}" ${db.current ? 'selected' : ''}>${db.name}${db.current ? ' (current)' : ''}</option>`
        ).join('');
        
        currentDatabase = data.currentDatabase;
    } catch (error) {
        console.error('Error loading databases:', error);
        showMessage('Error loading databases: ' + error.message, 'error');
    }
}

// Switch to a different database
async function switchDatabase() {
    const select = document.getElementById('database-select');
    const newDatabase = select.value;
    
    if (!newDatabase || newDatabase === currentDatabase) {
        return;
    }
    
    try {
        showMessage(`Switching to database '${newDatabase}'...`, 'info');
        
        const response = await fetch(`/api/databases/${newDatabase}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to switch database');
        }
        
        const result = await response.json();
        currentDatabase = newDatabase;
        
        showMessage(`✓ ${result.message} (${result.tablesLoaded} tables loaded)`, 'success');
        
        // Clear current table reference before refreshing
        currentTable = null;
        
        // Refresh all views
        await refreshTables();
        await loadStats();
        await loadDatabases();
        
    } catch (error) {
        console.error('Error switching database:', error);
        showMessage('Error switching database: ' + error.message, 'error');
        // Revert selector
        await loadDatabaseSelector();
    }
}

// Show create database modal
function showCreateDatabaseModal() {
    document.getElementById('create-database-modal').style.display = 'block';
    document.getElementById('new-database-name').value = '';
    document.getElementById('new-database-name').focus();
}

// Close create database modal
function closeCreateDatabaseModal() {
    document.getElementById('create-database-modal').style.display = 'none';
}

// Create a new database
async function createDatabase(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('new-database-name');
    const dbName = nameInput.value.trim();
    
    if (!dbName) {
        showMessage('Database name is required', 'error');
        return;
    }
    
    try {
        showMessage(`Creating database '${dbName}'...`, 'info');
        
        const response = await fetch('/api/databases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: dbName })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create database');
        }
        
        const result = await response.json();
        showMessage(`✓ ${result.message}`, 'success');
        
        closeCreateDatabaseModal();
        await loadDatabaseSelector();
        await loadDatabases();
        
    } catch (error) {
        console.error('Error creating database:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// Show database management panel
async function showDatabaseManagementPanel() {
    document.getElementById('database-management-modal').style.display = 'block';
    await loadDatabaseManagementContent();
}

// Close database management panel
function closeDatabaseManagementPanel() {
    document.getElementById('database-management-modal').style.display = 'none';
}

// Load database management content
async function loadDatabaseManagementContent() {
    const container = document.getElementById('database-management-content');
    container.innerHTML = '<p>Loading databases...</p>';
    
    try {
        const response = await fetch('/api/databases');
        const data = await response.json();
        
        if (data.databases.length === 0) {
            container.innerHTML = '<p>No databases found.</p>';
            return;
        }
        
        container.innerHTML = data.databases.map(db => `
            <div class="database-card ${db.current ? 'current' : ''}">
                <div class="database-card-header">
                    <h3>${db.name}</h3>
                    <span class="database-badge ${db.current ? 'badge-current' : 'badge-inactive'}">
                        ${db.current ? 'CURRENT' : 'INACTIVE'}
                    </span>
                </div>
                <div class="database-info">
                    ${db.current ? 'This is your active database' : 'Click "Use" to switch to this database'}
                </div>
                <div class="database-actions">
                    ${!db.current ? `<button onclick="useDatabaseFromPanel('${db.name}')" class="btn-primary">Use Database</button>` : ''}
                    ${!db.current ? `<button onclick="dropDatabaseFromPanel('${db.name}')" class="btn-danger">Delete</button>` : '<button disabled class="btn-secondary">Cannot Delete Current DB</button>'}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading databases:', error);
        container.innerHTML = `<p class="error">Error loading databases: ${error.message}</p>`;
    }
}

// Use database from panel
async function useDatabaseFromPanel(dbName) {
    try {
        showMessage(`Switching to database '${dbName}'...`, 'info');
        
        const response = await fetch(`/api/databases/${dbName}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to switch database');
        }
        
        const result = await response.json();
        currentDatabase = dbName;
        
        showMessage(`✓ ${result.message}`, 'success');
        
        // Clear current table reference before refreshing
        currentTable = null;
        
        await loadDatabaseSelector();
        await loadDatabaseManagementContent();
        await refreshTables();
        await loadStats();
        await loadDatabases();
        
    } catch (error) {
        console.error('Error switching database:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// Drop database from panel
async function dropDatabaseFromPanel(dbName) {
    if (!confirm(`Are you sure you want to delete the database '${dbName}'? This action cannot be undone!`)) {
        return;
    }
    
    try {
        showMessage(`Deleting database '${dbName}'...`, 'info');
        
        const response = await fetch(`/api/databases/${dbName}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete database');
        }
        
        const result = await response.json();
        showMessage(`✓ ${result.message}`, 'success');
        
        await loadDatabaseSelector();
        await loadDatabaseManagementContent();
        await loadDatabases();
        
    } catch (error) {
        console.error('Error deleting database:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// Load databases list for Databases tab
async function loadDatabases() {
    const container = document.getElementById('databases-list');
    container.innerHTML = '<p>Loading databases...</p>';
    
    try {
        const response = await fetch('/api/databases');
        const data = await response.json();
        
        if (data.databases.length === 0) {
            container.innerHTML = '<p>No databases found. Create one to get started!</p>';
            return;
        }
        
        container.innerHTML = data.databases.map(db => `
            <div class="database-card ${db.current ? 'current' : ''}">
                <div class="database-card-header">
                    <h3>${db.name}</h3>
                    <span class="database-badge ${db.current ? 'badge-current' : 'badge-inactive'}">
                        ${db.current ? 'CURRENT' : 'INACTIVE'}
                    </span>
                </div>
                <div class="database-info">
                    ${db.current ? '✓ This is your active database' : 'Switch to this database to view and edit its data'}
                </div>
                <div class="database-actions">
                    ${!db.current ? `<button onclick="switchToDatabase('${db.name}')" class="btn-primary">Switch to This Database</button>` : ''}
                    ${!db.current ? `<button onclick="deleteDatabase('${db.name}')" class="btn-danger">Delete Database</button>` : '<button disabled class="btn-secondary">Cannot Delete Current Database</button>'}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading databases:', error);
        container.innerHTML = `<p class="error">Error loading databases: ${error.message}</p>`;
    }
}

// Switch to database from Databases tab
async function switchToDatabase(dbName) {
    const select = document.getElementById('database-select');
    select.value = dbName;
    await switchDatabase();
}

// Delete database from Databases tab
async function deleteDatabase(dbName) {
    if (!confirm(`Are you sure you want to permanently delete the database '${dbName}'?\n\nThis will delete all tables and data in this database. This action cannot be undone!`)) {
        return;
    }
    
    try {
        showMessage(`Deleting database '${dbName}'...`, 'info');
        
        const response = await fetch(`/api/databases/${dbName}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete database');
        }
        
        const result = await response.json();
        showMessage(`✓ ${result.message}`, 'success');
        
        await loadDatabases();
        await loadDatabaseSelector();
        
    } catch (error) {
        console.error('Error deleting database:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// Initialize database selector on page load
window.addEventListener('DOMContentLoaded', () => {
    loadDatabaseSelector();
});

// Update showTab function to handle databases tab
const originalShowTab = showTab;
window.showTab = function(tabName) {
    originalShowTab(tabName);
    if (tabName === 'databases') {
        loadDatabases();
    } else if (tabName === 'indexes') {
        loadIndexes();
        populateIndexTableSelects();
    }
};

// Close modals when clicking outside
window.onclick = function(event) {
    const createModal = document.getElementById('create-database-modal');
    const managementModal = document.getElementById('database-management-modal');
    const editModal = document.getElementById('edit-record-modal');
    
    if (event.target === createModal) {
        closeCreateDatabaseModal();
    }
    if (event.target === managementModal) {
        closeDatabaseManagementPanel();
    }
    if (event.target === editModal) {
        closeEditRecordModal();
    }
};

// ==================== INDEX MANAGEMENT ====================

async function loadIndexes() {
    try {
        const filterTable = document.getElementById('index-filter-table')?.value || '';
        const url = filterTable ? `/api/indexes?table=${filterTable}` : '/api/indexes';
        
        const response = await fetch(url);
        const data = await response.json();
        
        const tbody = document.getElementById('indexes-tbody');
        
        if (!data.indexes || data.indexes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No indexes found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.indexes.map(idx => `
            <tr>
                <td>${idx.table}</td>
                <td><code>${idx.name}</code></td>
                <td>${idx.column}</td>
                <td><span class="badge">${idx.type}</span></td>
                <td>${idx.unique ? '<span class="badge badge-unique">UNIQUE</span>' : '<span class="badge-no">No</span>'}</td>
                <td>
                    <button onclick="dropIndex('${idx.name}', '${idx.table}')" class="btn-danger btn-sm">Drop</button>
                </td>
            </tr>
        `).join('');
        
        showMessage(`Loaded ${data.indexes.length} index(es)`, 'success');
    } catch (error) {
        showMessage('Error loading indexes: ' + error.message, 'error');
    }
}

async function populateIndexTableSelects() {
    try {
        const response = await fetch('/api/tables');
        const data = await response.json();
        const tables = data.tables || data;
        
        // Populate create index form table select
        const createSelect = document.getElementById('index-table-select');
        createSelect.innerHTML = '<option value="">Select a table...</option>' + 
            tables.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
        
        // Populate filter select
        const filterSelect = document.getElementById('index-filter-table');
        filterSelect.innerHTML = '<option value="">All tables</option>' + 
            tables.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    } catch (error) {
        showMessage('Error loading tables: ' + error.message, 'error');
    }
}

async function loadTableColumns() {
    const tableName = document.getElementById('index-table-select').value;
    const columnSelect = document.getElementById('index-column-select');
    
    if (!tableName) {
        columnSelect.innerHTML = '<option value="">Select a column...</option>';
        return;
    }
    
    try {
        const response = await fetch('/api/tables');
        const data = await response.json();
        const tables = data.tables || data;
        const table = tables.find(t => t.name === tableName);
        
        if (!table || !table.columns) {
            columnSelect.innerHTML = '<option value="">No columns found</option>';
            return;
        }
        
        columnSelect.innerHTML = '<option value="">Select a column...</option>' +
            table.columns.map(col => `<option value="${col.name}">${col.name} (${col.dataType})</option>`).join('');
    } catch (error) {
        showMessage('Error loading columns: ' + error.message, 'error');
    }
}

async function createIndex(event) {
    event.preventDefault();
    
    const tableName = document.getElementById('index-table-select').value;
    const columnName = document.getElementById('index-column-select').value;
    const indexName = document.getElementById('index-name').value;
    const unique = document.getElementById('index-unique').checked;
    
    if (!tableName || !columnName || !indexName) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/indexes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ indexName, tableName, columnName, unique })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`✓ ${data.message}`, 'success');
            document.getElementById('create-index-form').reset();
            loadIndexes();
        } else {
            showMessage(`Error: ${data.message}`, 'error');
        }
    } catch (error) {
        showMessage('Error creating index: ' + error.message, 'error');
    }
}

async function dropIndex(indexName, tableName) {
    if (!confirm(`Are you sure you want to drop index '${indexName}'?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/indexes/${indexName}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`✓ ${data.message}`, 'success');
            loadIndexes();
        } else {
            showMessage(`Error: ${data.message}`, 'error');
        }
    } catch (error) {
        showMessage('Error dropping index: ' + error.message, 'error');
    }
}

async function executeSQLQuery() {
    const query = document.getElementById('sql-query').value.trim();
    const resultDiv = document.getElementById('sql-result');
    
    if (!query) {
        showMessage('Please enter a SQL query', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Display result
            if (Array.isArray(data.result)) {
                // SELECT or SHOW INDEXES result
                if (data.result.length === 0) {
                    resultDiv.innerHTML = '<p class="success">Query executed successfully. No results returned.</p>';
                } else {
                    const headers = Object.keys(data.result[0]);
                    const tableHtml = `
                        <table class="result-table">
                            <thead>
                                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                            </thead>
                            <tbody>
                                ${data.result.map(row => `
                                    <tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <p class="success">${data.result.length} row(s) returned</p>
                    `;
                    resultDiv.innerHTML = tableHtml;
                }
            } else if (data.result && typeof data.result === 'object' && data.result.success) {
                // CREATE INDEX or DROP INDEX result
                resultDiv.innerHTML = `<p class="success">✓ ${data.result.message}</p>`;
            } else {
                resultDiv.innerHTML = `<p class="success">Query executed successfully</p>`;
            }
            
            showMessage('SQL executed successfully', 'success');
            loadIndexes(); // Refresh indexes if it was an index command
        } else {
            resultDiv.innerHTML = `<p class="error">Error: ${data.message}</p>`;
            showMessage(`SQL Error: ${data.message}`, 'error');
        }
    } catch (error) {
        resultDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        showMessage('Error executing SQL: ' + error.message, 'error');
    }
}
