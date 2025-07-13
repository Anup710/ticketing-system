from flask import Flask, render_template, request, jsonify, session
import json
import os
from datetime import datetime
from config import ADMIN_CREDENTIALS

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'  # Change this in production

# File to store ticket data
TICKETS_FILE = 'tickets.json'

def load_tickets():
    """Load tickets from JSON file"""
    if os.path.exists(TICKETS_FILE):
        try:
            with open(TICKETS_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
                else:
                    return []
        except (json.JSONDecodeError, FileNotFoundError):
            # If file is corrupted or empty, start with empty list
            return []
    return []

def save_tickets(tickets):
    """Save tickets to JSON file"""
    with open(TICKETS_FILE, 'w') as f:
        json.dump(tickets, f, indent=2)

def get_next_sr_no():
    """Get the next serial number for new tickets"""
    tickets = load_tickets()
    if not tickets:
        return 1
    return max(ticket['sr_no'] for ticket in tickets) + 1

@app.route('/')
def index():
    """Main page - displays the ticketing interface"""
    tickets = load_tickets()
    is_admin = session.get('is_admin', False)
    return render_template('index.html', tickets=tickets, is_admin=is_admin)

@app.route('/login', methods=['POST'])
def login():
    """Admin login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        session['is_admin'] = True
        session['username'] = username
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'Invalid credentials'})

@app.route('/logout')
def logout():
    """Admin logout endpoint"""
    session.pop('is_admin', None)
    session.pop('username', None)
    return jsonify({'success': True})

@app.route('/add_ticket', methods=['POST'])
def add_ticket():
    """Add a new ticket"""
    data = request.json
    
    tickets = load_tickets()
    
    new_ticket = {
        'sr_no': get_next_sr_no(),
        'date_raised': data.get('date_raised') or datetime.now().date().isoformat(),
        'issue': data.get('issue', ''),
        'raised_by': data.get('raised_by', ''),
        'status': data.get('status', 'In process'),  # Default status
        'assigned_to': data.get('assigned_to', 'Veeresh'),  # Default assignee
        'comments': data.get('comments', ''),
        'created_at': datetime.now().isoformat()
    }
    
    tickets.append(new_ticket)
    save_tickets(tickets)
    
    return jsonify({'success': True, 'ticket': new_ticket})

@app.route('/update_ticket/<int:sr_no>', methods=['PUT'])
def update_ticket(sr_no):
    """Update an existing ticket (admin only)"""
    if not session.get('is_admin'):
        return jsonify({'success': False, 'error': 'Admin access required'})
    
    data = request.json
    tickets = load_tickets()
    
    # Find the ticket to update
    for ticket in tickets:
        if ticket['sr_no'] == sr_no:
            # Update allowed fields
            updatable_fields = ['issue', 'raised_by', 'status', 'assigned_to', 'comments', 'date_raised']
            for field in updatable_fields:
                if field in data:
                    ticket[field] = data[field]
            
            ticket['updated_at'] = datetime.now().isoformat()
            save_tickets(tickets)
            return jsonify({'success': True, 'ticket': ticket})
    
    return jsonify({'success': False, 'error': 'Ticket not found'})

@app.route('/delete_ticket/<int:sr_no>', methods=['DELETE'])
def delete_ticket(sr_no):
    """Delete a ticket (admin only)"""
    if not session.get('is_admin'):
        return jsonify({'success': False, 'error': 'Admin access required'})
    
    tickets = load_tickets()
    tickets = [ticket for ticket in tickets if ticket['sr_no'] != sr_no]
    save_tickets(tickets)
    
    return jsonify({'success': True})

@app.route('/get_tickets')
def get_tickets():
    """Get all tickets (API endpoint)"""
    tickets = load_tickets()
    return jsonify({'tickets': tickets, 'is_admin': session.get('is_admin', False)})

if __name__ == '__main__':
    # Create empty tickets file if it doesn't exist
    if not os.path.exists(TICKETS_FILE):
        save_tickets([])
    
    app.run(debug=True, host='0.0.0.0', port=5000)