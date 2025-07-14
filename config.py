# Configuration file for the ticketing system

# Regular user credentials - modify these as needed
# Format: {'username': 'password'}
REGULAR_USERS = {
    'john_doe': 'user123',
    'jane_smith': 'pass456',
    'mike_wilson': 'secure789',
    'sarah_chen': 'mypass321',
    'raj_patel': 'password987',
    'lisa_brown': 'secure456',
    'tom_garcia': 'user654',
    'amy_jones': 'pass123',
    'david_kim': 'secure321',
    'emma_davis': 'user789'
}

# Admin credentials - modify these as needed
# Format: {'username': 'password'}
ADMIN_CREDENTIALS = {
    'admin': 'password123',  # Change this password!
    'veeresh': 'admin2024'   # Add more admin users as needed
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