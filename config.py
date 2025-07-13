# store credentials to manage user access

# Admin credentials - modify these as needed
# Format: {'username': 'password'}
ADMIN_CREDENTIALS = {
    'admin': 'password123',  # Change this password!
    'veeresh': 'admin2024'   # Add more admin users as needed
}

# Application settings
APP_NAME = "Simple Ticketing System"
DEFAULT_ASSIGNEE = "Veeresh"

# Status options for tickets
STATUS_OPTIONS = [
    'In process',
    'Dormant', 
    'Closed'
]

# You can add more configuration options here as the system grows
# For example:
# - Email settings for notifications
# - Database connection strings
# - File upload settings
# - etc.