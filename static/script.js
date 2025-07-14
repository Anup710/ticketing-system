// WIN Hydraulics R&D Ticketing System JavaScript v2.1

// Global variables
let tickets = [];
let isAdmin = false;
let isLoggedIn = false;
let currentUser = '';
let currentEditTicket = null;
let autoRefreshInterval = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Parse initial data from server (avoiding Jinja2 templating issues)
    try {
        tickets = JSON.parse(window.serverData.ticketsJson) || [];
        isAdmin = JSON.parse(window.serverData.isAdminJson) || false;
        isLoggedIn = JSON.parse(window.serverData.isLoggedInJson) || false;
        currentUser = JSON.parse(window.serverData.usernameJson) || '';
    } catch (error) {
        console.error('Error parsing server data:', error);
        tickets = [];
        isAdmin = false;
        isLoggedIn = false;
        currentUser = '';
    }
    
    // Update UI based on login status
    updateUIForLoginStatus();
    
    // Load tickets into table
    loadTicketsTable();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start auto-refresh if logged in
    if (isLoggedIn) {
        startAutoRefresh();
    }
});

// Update UI elements based on login status
function updateUIForLoginStatus() {
    const userInfo = document.getElementById('userInfo');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const adminBadge = document.getElementById('adminBadge');
    const userBadge = document.getElementById('userBadge');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const actionsHeader = document.getElementById('actionsHeader');
    
    if (isLoggedIn) {
        // Show user info
        userInfo.style.display = 'flex';
        welcomeMessage.textContent = `Welcome, ${currentUser}`;
        
        // Show appropriate badge
        if (isAdmin) {
            adminBadge.style.display = 'inline-block';
            userBadge.style.display = 'none';
            actionsHeader.style.display = 'table-cell';
        } else {
            adminBadge.style.display = 'none';
            userBadge.style.display = 'inline-block';
            actionsHeader.style.display = 'none';
        }
        
        // Show logout, hide login
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        // Not logged in - hide user info, show login
        userInfo.style.display = 'none';
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
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeLoginModal();
            closeTicketModal();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
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
    
    // Filter tickets based on user type
    let displayTickets = tickets;
    
    if (isLoggedIn && !isAdmin) {
        // Regular users: only show their own tickets
        displayTickets = tickets.filter(ticket => ticket.raised_by === currentUser);
    }
    // Admin users: see all tickets (no filtering)
    // Not logged in: see all tickets (no filtering)
    
    if (displayTickets.length === 0) {
        tableBody.innerHTML = '';
        noTicketsMessage.style.display = 'block';
        // Update message based on context
        const noTicketsText = isLoggedIn && !isAdmin ? 
            'You have not raised any tickets yet. Click "Add New Ticket" to create your first ticket.' :
            'No tickets found. Click "Add New Ticket" to create your first ticket.';
        noTicketsMessage.querySelector('p').textContent = noTicketsText;
        return;
    }
    
    noTicketsMessage.style.display = 'none';
    
    // Sort the filtered tickets based on current selection (default: newest date first)
    sortTickets(displayTickets);
    
    const tableRows = displayTickets.map(ticket => {
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
function sortTickets(ticketsToSort = tickets) {
    const sortBy = document.getElementById('sortBy').value;
    
    ticketsToSort.sort((a, b) => {
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
            isAdmin = result.user_type === 'admin';
            isLoggedIn = true;
            currentUser = result.username;
            
            closeLoginModal();
            updateUIForLoginStatus();
            loadTicketsTable();
            startAutoRefresh();
            
            const userType = isAdmin ? 'admin' : 'user';
            showMessage(`Successfully logged in as ${userType}!`, 'success');
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
        isLoggedIn = false;
        currentUser = '';
        
        stopAutoRefresh();
        updateUIForLoginStatus();
        loadTicketsTable();
        showMessage('Successfully logged out.', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('An error occurred during logout.', 'error');
    }
}

// Show add ticket modal
function showAddTicketModal() {
    // Check if user is logged in
    if (!isLoggedIn) {
        showMessage('Please log in to add a ticket.', 'error');
        showLoginModal();
        return;
    }
    
    currentEditTicket = null;
    document.getElementById('ticketModalTitle').textContent = 'Add New Ticket';
    document.getElementById('submitTicketBtn').textContent = 'Add Ticket';
    
    // Reset form
    document.getElementById('ticketForm').reset();
    
    // Set today's date and make it readonly (always readonly for everyone)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateRaised').value = today;
    document.getElementById('dateRaised').readOnly = true;
    
    // Auto-populate raised by with current user (readonly)
    document.getElementById('raisedBy').value = currentUser;
    document.getElementById('raisedBy').readOnly = true;
    
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
    document.getElementById('raisedBy').readOnly = true; // Cannot change who raised the ticket
    
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

// Handle ticket form submission
async function handleTicketSubmit(event) {
    event.preventDefault();
    
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
            isLoggedIn = result.is_logged_in || false;
            currentUser = result.username || '';
            updateUIForLoginStatus();
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
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        if (isLoggedIn) {
            startAutoRefresh();
            // Refresh immediately when tab becomes visible again
            refreshTable();
        }
    }
});