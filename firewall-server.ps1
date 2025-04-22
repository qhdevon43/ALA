# Create a firewall rule to allow incoming connections on port 8090
Write-Host "Creating firewall rule for port 8090..."
New-NetFirewallRule -DisplayName "ALA Web Server" -Direction Inbound -Protocol TCP -LocalPort 8090 -Action Allow -ErrorAction SilentlyContinue

# Simple PowerShell web server for ALA
$port = 8090

# Create a listener on port 8090
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

# Get the IP address of the server
$IPAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | Select-Object -First 1).IPAddress

Write-Host "Arbitrage Log Analyzer (ALA) server started!"
Write-Host "Server is running at:"
Write-Host "  - Local: http://localhost:$port/"
if ($IPAddress) {
    Write-Host "  - Network: http://$($IPAddress):$port/"
    Write-Host "  - Public: http://146.70.30.154:$port/"
}
Write-Host "Press Ctrl+C to stop the server"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Get requested URL
        $requestUrl = $request.Url.LocalPath
        
        # Set default content type
        $contentType = "text/html"
        
        # Determine file path
        $filePath = ""
        if ($requestUrl -eq "/") {
            $filePath = "index.html"
        } else {
            $filePath = $requestUrl.TrimStart("/")
        }
        
        # Get full path
        $fullPath = Join-Path $PSScriptRoot $filePath
        
        # Check if file exists
        if (Test-Path $fullPath) {
            # Determine content type based on file extension
            $extension = [System.IO.Path]::GetExtension($fullPath)
            switch ($extension) {
                ".html" { $contentType = "text/html" }
                ".js" { $contentType = "application/javascript" }
                ".css" { $contentType = "text/css" }
                ".json" { $contentType = "application/json" }
                ".png" { $contentType = "image/png" }
                ".jpg" { $contentType = "image/jpeg" }
                ".gif" { $contentType = "image/gif" }
            }
            
            # Read file content
            $content = [System.IO.File]::ReadAllBytes($fullPath)
            
            # Set response
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            # File not found
            $response.StatusCode = 404
            $notFoundMessage = "404 - File not found: $filePath"
            $content = [System.Text.Encoding]::UTF8.GetBytes($notFoundMessage)
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        }
        
        # Close the response
        $response.Close()
    }
}
finally {
    # Stop the listener
    $listener.Stop()
}
