// WIN Hydraulics R&D Ticketing System JavaScript

// Global variables
let tickets = [];
let isAdmin = false;
let currentEditTicket = null;
let autoRefreshInterval = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    // Parse initial data from server (avoiding Jinja2 templating issues)
    try {
        tickets = JSON.parse(window.serverData.ticketsJson) || [];
        isAdmin = JSON.parse(window.serverData.isAdminJson) || false;
    } catch (error) {
        console.error('Error parsing server data:', error);
        tickets = [];
        isAdmin = false;
    }

    // Update UI based on admin status
    updateUIForAdminStatus();

    // Load tickets into table
    loadTicketsTable();

    // Set up event listeners
    setupEventListeners();

    // Set today's date as default for new tickets and make it readonly
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateRaised').value = today;

    // Start auto-refresh (every 30 seconds)
    startAutoRefresh();
});

// Update UI elements based on admin status
function updateUIForAdminStatus() {
    const adminBadge = document.getElementById('adminBadge');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const actionsHeader = document.getElementById('actionsHeader');

    if (isAdmin) {
        adminBadge.style.display = 'inline-block';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        actionsHeader.style.display = 'table-cell';
    } else {
        adminBadge.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        actionsHeader.style.display = 'none';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login form submission
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Ticket form submission
    document.getElementById('ticketForm').addEventListener('submit', handleTicketSubmit);

    // Add input validation listeners
    document.getElementById('issue').addEventListener('input', validateIssueLength);
    document.getElementById('raisedBy').addEventListener('input', validateNameField);
    document.getElementById('dateRaised').addEventListener('change', validateDate);

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            closeLoginModal();
            closeTicketModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeLoginModal();
            closeTicketModal();
        }
    });
}

// Start auto-refresh functionality
function startAutoRefresh() {
    // Refresh every 30 seconds
    autoRefreshInterval = setInterval(refreshTable, 30000);
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Load tickets into the table
function loadTicketsTable() {
    const tableBody = document.getElementById('ticketsTableBody');
    const noTicketsMessage = document.getElementById('noTicketsMessage');

    if (tickets.length === 0) {
        tableBody.innerHTML = '';
        noTicketsMessage.style.display = 'block';
        return;
    }

    noTicketsMessage.style.display = 'none';

    // Sort tickets based on current selection (default: newest date first)
    sortTickets();

    const tableRows = tickets.map(ticket => {
        const statusClass = `status-${ticket.status.toLowerCase().replace(' ', '-')}`;
        const formattedDate = formatDate(ticket.date_raised);

        let actionsHtml = '';

        if (isAdmin) {
            actionsHtml = `
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-warning" onclick="editTicket(${ticket.sr_no})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteTicket(${ticket.sr_no})">Delete</button>
                    </div>
                </td>
            `;
        }

        return `
            <tr>
                <td>${ticket.sr_no}</td>
                <td>${formattedDate}</td>
                <td>${escapeHtml(ticket.issue)}</td>
                <td>${escapeHtml(ticket.raised_by)}</td>
                <td><span class="status-badge ${statusClass}">${ticket.status}</span></td>
                <td>${escapeHtml(ticket.assigned_to)}</td>
                <td>${escapeHtml(ticket.comments || '')}</td>
                ${actionsHtml}
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = tableRows;
}

// Sort tickets based on selected option
function sortTickets() {
    const sortBy = document.getElementById('sortBy').value;

    tickets.sort((a, b) => {
        switch (sortBy) {
            case 'date_desc':
                return new Date(b.date_raised) - new Date(a.date_raised);
            case 'date_asc':
                return new Date(a.date_raised) - new Date(b.date_raised);
            case 'status':
                // Custom status order: In process, Dormant, Closed
                const statusOrder = {
                    'In process': 1,
                    'Dormant': 2,
                    'Closed': 3
                };
                return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
            default:
                // Default to newest date first
                return new Date(b.date_raised) - new Date(a.date_raised);
        }
    });
}

// Sort table when dropdown changes
function sortTable() {
    loadTicketsTable();
}

// Format date for display (DD/MM/YYYY format)
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show success/error messages
function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    const content = document.getElementById('messageContent');

    content.textContent = message;
    content.className = `message ${type}`;
    container.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
        container.style.display = 'none';
    }, 3000);
}

// Show login modal
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('username').focus();
}

// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginForm').reset();
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    showLoading();

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            isAdmin = true;
            closeLoginModal();
            updateUIForAdminStatus();
            loadTicketsTable();
            showMessage('Successfully logged in as admin!', 'success');
        } else {
            showMessage('Invalid credentials. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('An error occurred during login. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/logout');
        isAdmin = false;
        updateUIForAdminStatus();
        loadTicketsTable();
        showMessage('Successfully logged out.', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('An error occurred during logout.', 'error');
    }
}

// Show add ticket modal
function showAddTicketModal() {
    currentEditTicket = null;
    document.getElementById('ticketModalTitle').textContent = 'Add New Ticket';
    document.getElementById('submitTicketBtn').textContent = 'Add Ticket';

    // Reset form
    document.getElementById('ticketForm').reset();

    // Set today's date and make it readonly (always readonly for everyone)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateRaised').value = today;
    document.getElementById('dateRaised').readOnly = true;

    document.getElementById('assignedTo').value = 'Veeresh';
    document.getElementById('status').value = 'In process';

    // Status field: readonly for regular users, editable for admin
    document.getElementById('status').disabled = !isAdmin;

    // Show/hide comments field based on admin status
    const commentsGroup = document.getElementById('commentsGroup');
    if (isAdmin) {
        commentsGroup.style.display = 'block';
    } else {
        commentsGroup.style.display = 'none';
    }

    // Make assignedTo readonly for regular users
    document.getElementById('assignedTo').readOnly = !isAdmin;

    document.getElementById('ticketModal').style.display = 'block';
    document.getElementById('issue').focus();
}

// Edit ticket (admin only)
function editTicket(srNo) {
    const ticket = tickets.find(t => t.sr_no === srNo);
    if (!ticket) return;

    currentEditTicket = ticket;
    document.getElementById('ticketModalTitle').textContent = 'Edit Ticket';
    document.getElementById('submitTicketBtn').textContent = 'Update Ticket';

    // Populate form with ticket data
    document.getElementById('dateRaised').value = ticket.date_raised;
    document.getElementById('dateRaised').readOnly = true; // Always readonly, even for admin

    document.getElementById('issue').value = ticket.issue;
    document.getElementById('raisedBy').value = ticket.raised_by;
    document.getElementById('status').value = ticket.status;
    document.getElementById('status').disabled = false; // Admin can edit status in edit mode
    document.getElementById('assignedTo').value = ticket.assigned_to;
    document.getElementById('comments').value = ticket.comments || '';

    // Show comments field for admin
    document.getElementById('commentsGroup').style.display = 'block';

    document.getElementById('ticketModal').style.display = 'block';
    document.getElementById('issue').focus();
}

// Close ticket modal
function closeTicketModal() {
    document.getElementById('ticketModal').style.display = 'none';
    document.getElementById('ticketForm').reset();
    currentEditTicket = null;
}

// Validation functions
function validateDate() {
    const dateInput = document.getElementById('dateRaised');
    const selectedDate = new Date(dateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    if (selectedDate < today) {
        showMessage('Cannot select past dates. Please select today or a future date.', 'error');
        dateInput.value = today.toISOString().split('T')[0]; // Reset to today
        return false;
    }
    return true;
}

function validateIssueLength() {
    const issueInput = document.getElementById('issue');
    const charCount = issueInput.value.length;
    const maxLength = 500;

    // Create or update character counter
    let counter = document.getElementById('issueCharCounter');
    if (!counter) {
        counter = document.createElement('small');
        counter.id = 'issueCharCounter';
        counter.style.color = '#666';
        counter.style.fontSize = '12px';
        issueInput.parentNode.appendChild(counter);
    }

    counter.textContent = `${charCount}/${maxLength} characters`;

    if (charCount > maxLength) {
        counter.style.color = '#e74c3c';
        issueInput.value = issueInput.value.substring(0, maxLength);
        showMessage('Issue description cannot exceed 500 characters.', 'error');
        return false;
    } else {
        counter.style.color = '#666';
    }
    return true;
}

function validateNameField() {
    const nameInput = document.getElementById('raisedBy');
    const name = nameInput.value;
    const maxLength = 20;

    // Create or update character counter
    let counter = document.getElementById('nameCharCounter');
    if (!counter) {
        counter = document.createElement('small');
        counter.id = 'nameCharCounter';
        counter.style.color = '#666';
        counter.style.fontSize = '12px';
        nameInput.parentNode.appendChild(counter);
    }

    counter.textContent = `${name.length}/${maxLength} characters`;

    if (name.length > maxLength) {
        counter.style.color = '#e74c3c';
        nameInput.value = name.substring(0, maxLength);
        showMessage('Name cannot exceed 20 characters.', 'error');
        return false;
    }

    // Check for valid characters (letters, spaces, periods, hyphens, apostrophes)
    const validNameRegex = /^[a-zA-Z\s\.\-']*$/;
    if (name && !validNameRegex.test(name)) {
        counter.style.color = '#e74c3c';
        counter.textContent = 'Only letters, spaces, periods, hyphens, and apostrophes allowed';
        return false;
    } else {
        counter.style.color = '#666';
    }

    return true;
}

// Handle ticket form submission
async function handleTicketSubmit(event) {
    event.preventDefault();

    // Perform client-side validations
    if (!validateDate() || !validateIssueLength() || !validateNameField()) {
        return;
    }

    const formData = {
        date_raised: document.getElementById('dateRaised').value,
        issue: document.getElementById('issue').value.trim(),
        raised_by: document.getElementById('raisedBy').value.trim(),
        status: document.getElementById('status').value,
        assigned_to: document.getElementById('assignedTo').value.trim(),
        comments: document.getElementById('comments').value.trim()
    };

    showLoading();

    try {
        let response;
        if (currentEditTicket) {
            // Update existing ticket
            response = await fetch(`/update_ticket/${currentEditTicket.sr_no}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Add new ticket
            response = await fetch('/add_ticket', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }

        const result = await response.json();

        if (result.success) {
            closeTicketModal();
            await refreshTable();
            if (currentEditTicket) {
                showMessage('Ticket updated successfully!', 'success');
            } else {
                showMessage('Ticket submitted successfully!', 'success');
            }
        } else {
            showMessage(result.error || 'An error occurred while saving the ticket.', 'error');
        }
    } catch (error) {
        console.error('Ticket submission error:', error);
        showMessage('An error occurred while saving the ticket. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Delete ticket (admin only)
async function deleteTicket(srNo) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/delete_ticket/${srNo}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            await refreshTable();
            showMessage('Ticket deleted successfully!', 'success');
        } else {
            showMessage(result.error || 'An error occurred while deleting the ticket.', 'error');
        }
    } catch (error) {
        console.error('Delete ticket error:', error);
        showMessage('An error occurred while deleting the ticket. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Refresh table data from server
async function refreshTable() {
    try {
        const response = await fetch('/get_tickets');
        const result = await response.json();

        if (result.tickets) {
            tickets = result.tickets;
            isAdmin = result.is_admin || false;
            updateUIForAdminStatus();
            loadTicketsTable();
        }
    } catch (error) {
        console.error('Refresh error:', error);
        showMessage('Error refreshing data from server.', 'error');
    }
}

// Show loading indicator
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

// Handle page visibility change (pause auto-refresh when tab is not visible)
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        // Refresh immediately when tab becomes visible again
        refreshTable();
    }
});