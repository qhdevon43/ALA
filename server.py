import http.server
import socketserver
import os
import socket

# Get the local IP address
def get_local_ip():
    try:
        # Create a socket connection to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

PORT = 8090
local_ip = get_local_ip()

# Set up the handler
Handler = http.server.SimpleHTTPRequestHandler

# Allow reusing the address
socketserver.TCPServer.allow_reuse_address = True

# Create the server, binding to all interfaces
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Arbitrage Log Analyzer (ALA) server started!")
    print(f"Server is running at:")
    print(f"  - Local: http://localhost:{PORT}/")
    print(f"  - Network: http://{local_ip}:{PORT}/")
    print(f"  - Public: http://146.70.30.154:{PORT}/")
    print("Press Ctrl+C to stop the server")
    
    # Serve forever
    httpd.serve_forever()
