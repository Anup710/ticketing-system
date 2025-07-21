from flask import Flask, render_template, request, jsonify, session, send_from_directory
import json
import os
from datetime import datetime
from config import ADMIN_CREDENTIALS, REGULAR_USERS
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'  # Change this in production

# File to store ticket data
TICKETS_FILE = 'tickets.json'

# File upload configuration
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads', 'tickets')
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt'
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Create upload directory if it doesn't exist
print(f"Creating upload directory: {UPLOAD_FOLDER}")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
print(f"Upload directory exists: {os.path.exists(UPLOAD_FOLDER)}")
print(f"Upload directory is writable: {os.access(UPLOAD_FOLDER, os.W_OK)}")

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

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_unique_filename(original_filename):
    """Generate unique filename while preserving extension"""
    if not original_filename:
        return None
    
    # Get file extension
    ext = ''
    if '.' in original_filename:
        ext = '.' + original_filename.rsplit('.', 1)[1].lower()
    
    # Generate unique filename
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{ext}"

def save_uploaded_files(files):
    """Save uploaded files and return their info"""
    saved_files = []
    
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            try:
                # Generate unique filename
                original_name = secure_filename(file.filename)
                unique_name = generate_unique_filename(original_name)
                
                # Ensure upload directory exists
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
                
                # Save file
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
                print(f"Saving file to: {file_path}")
                file.save(file_path)
                
                # Verify file was saved
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"File saved successfully. Size: {file_size} bytes")
                    
                    # Store file info
                    file_info = {
                        'original_name': original_name,
                        'stored_name': unique_name,
                        'file_size': file_size,
                        'upload_time': datetime.now().isoformat()
                    }
                    saved_files.append(file_info)
                else:
                    print(f"Failed to save file: {file_path}")
                    
            except Exception as e:
                print(f"Error saving file {file.filename}: {str(e)}")
                continue
    
    print(f"Total files saved: {len(saved_files)}")
    return saved_files

@app.route('/')
def index():
    """Main page - displays the ticketing interface"""
    tickets = load_tickets()
    is_admin = session.get('is_admin', False)
    is_logged_in = session.get('username') is not None
    username = session.get('username', '')
    return render_template('index.html', tickets=tickets, is_admin=is_admin, 
                         is_logged_in=is_logged_in, username=username)

@app.route('/login', methods=['POST'])
def login():
    """User/Admin login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Check if admin
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        session['is_admin'] = True
        session['username'] = username
        session['user_type'] = 'admin'
        return jsonify({'success': True, 'user_type': 'admin', 'username': username})
    
    # Check if regular user
    elif username in REGULAR_USERS and REGULAR_USERS[username] == password:
        session['is_admin'] = False
        session['username'] = username
        session['user_type'] = 'user'
        return jsonify({'success': True, 'user_type': 'user', 'username': username})
    
    else:
        return jsonify({'success': False, 'error': 'Invalid credentials'})

@app.route('/logout')
def logout():
    """User/Admin logout endpoint"""
    session.pop('is_admin', None)
    session.pop('username', None)
    session.pop('user_type', None)
    return jsonify({'success': True})

@app.route('/add_ticket', methods=['POST'])
def add_ticket():
    """Add a new ticket with optional file attachments"""
    try:
        # Handle both form data and files
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            # Get form data
            data = {
                'date_raised': request.form.get('date_raised'),
                'issue': request.form.get('issue', ''),
                'raised_by': request.form.get('raised_by', ''),
                'status': request.form.get('status', 'In process'),
                'assigned_to': request.form.get('assigned_to', 'Veeresh'),
                'comments': request.form.get('comments', '')
            }
            
            # Handle file uploads (max 3 files)
            files = []
            for i in range(3):
                file_key = f'attachment_{i}'
                if file_key in request.files:
                    file = request.files[file_key]
                    if file.filename:  # Only process if file was selected
                        files.append(file)
            
            # Save files
            attachments = save_uploaded_files(files)
            
        else:
            # JSON request (backward compatibility)
            data = request.json or {}
            attachments = []
        
        tickets = load_tickets()
        
        new_ticket = {
            'sr_no': get_next_sr_no(),
            'date_raised': data.get('date_raised') or datetime.now().date().isoformat(),
            'issue': data.get('issue', ''),
            'raised_by': data.get('raised_by', ''),
            'status': data.get('status', 'In process'),
            'assigned_to': data.get('assigned_to', 'Veeresh'),
            'comments': data.get('comments', ''),
            'attachments': attachments,
            'created_at': datetime.now().isoformat()
        }
        
        tickets.append(new_ticket)
        save_tickets(tickets)
        
        return jsonify({'success': True, 'ticket': new_ticket})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

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
            # Update allowed fields (excluding attachments)
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

@app.route('/download_file/<filename>')
def download_file(filename):
    """Serve uploaded files securely"""
    try:
        # Debug: Print the full path being accessed
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        print(f"Looking for file at: {file_path}")
        print(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
        print(f"File exists: {os.path.exists(file_path)}")
        
        # List all files in upload directory for debugging
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            files_in_folder = os.listdir(app.config['UPLOAD_FOLDER'])
            print(f"Files in upload folder: {files_in_folder}")
        else:
            print(f"Upload folder does not exist: {app.config['UPLOAD_FOLDER']}")
        
        # Security: only allow files that exist and are in our upload folder
        if os.path.exists(file_path):
            # Check if file is within our upload folder (security check)
            try:
                common_path = os.path.commonpath([os.path.abspath(app.config['UPLOAD_FOLDER']), os.path.abspath(file_path)])
                if common_path == os.path.abspath(app.config['UPLOAD_FOLDER']):
                    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
                else:
                    print(f"Security check failed. Common path: {common_path}")
                    return jsonify({'error': 'Access denied'}), 403
            except ValueError:
                print("Path security check failed")
                return jsonify({'error': 'Invalid path'}), 400
        else:
            return jsonify({'error': 'File not found', 'path': file_path}), 404
            
    except Exception as e:
        print(f"Error serving file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_file_info/<int:sr_no>')
def get_file_info(sr_no):
    """Get file attachment info for a ticket"""
    tickets = load_tickets()
    ticket = next((t for t in tickets if t['sr_no'] == sr_no), None)
    
    if ticket and 'attachments' in ticket:
        return jsonify({'success': True, 'attachments': ticket['attachments']})
    else:
        return jsonify({'success': False, 'attachments': []})

@app.route('/debug_uploads')
def debug_uploads():
    """Debug endpoint to check upload folder status"""
    try:
        upload_info = {
            'upload_folder': app.config['UPLOAD_FOLDER'],
            'folder_exists': os.path.exists(app.config['UPLOAD_FOLDER']),
            'folder_writable': os.access(app.config['UPLOAD_FOLDER'], os.W_OK) if os.path.exists(app.config['UPLOAD_FOLDER']) else False,
            'files_in_folder': []
        }
        
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            try:
                files = os.listdir(app.config['UPLOAD_FOLDER'])
                for file in files:
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file)
                    upload_info['files_in_folder'].append({
                        'name': file,
                        'size': os.path.getsize(file_path),
                        'exists': os.path.exists(file_path)
                    })
            except Exception as e:
                upload_info['error_listing_files'] = str(e)
        
        return jsonify(upload_info)
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/get_tickets')
def get_tickets():
    """Get all tickets (API endpoint)"""
    tickets = load_tickets()
    return jsonify({
        'tickets': tickets, 
        'is_admin': session.get('is_admin', False),
        'is_logged_in': session.get('username') is not None,
        'username': session.get('username', '')
    })

if __name__ == '__main__':
    # Create empty tickets file if it doesn't exist
    if not os.path.exists(TICKETS_FILE):
        save_tickets([])
    
    app.run(debug=True, host='0.0.0.0', port=5000)