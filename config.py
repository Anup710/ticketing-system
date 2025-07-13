# Configuration file for the ticketing system

# Admin credentials - modify these as needed
# Format: {'username': 'password'}
ADMIN_CREDENTIALS = {
    'wcadmin': 'Wipro@!23*',  # Change this password!
    'veeresh': 'admin2o25@98'   # Add more admin users as needed
}

# Application settings
APP_NAME = "WIN Hydraulics R&D Ticketing System"
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