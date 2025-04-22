# External HTTP server for ALA
$port = 8090
$ip = "0.0.0.0"  # Listen on all interfaces

# Create TCP listener
$endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Parse($ip), $port)
$listener = New-Object System.Net.Sockets.TcpListener $endpoint
$listener.Start()

# Get the IP address of the server
$IPAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | Select-Object -First 1).IPAddress

Write-Host "Arbitrage Log Analyzer (ALA) server started!"
Write-Host "Server is running at:"
Write-Host "  - Local: http://localhost:$port/"
Write-Host "  - Network: http://$($IPAddress):$port/"
Write-Host "  - Public: http://146.70.30.154:$port/"
Write-Host "Press Ctrl+C to stop the server"

# Create a hashtable for MIME types
$mimeTypes = @{
    ".html" = "text/html"
    ".htm" = "text/html"
    ".css" = "text/css"
    ".js" = "application/javascript"
    ".json" = "application/json"
    ".jpg" = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png" = "image/png"
    ".gif" = "image/gif"
    ".ico" = "image/x-icon"
}

try {
    while ($true) {
        # Wait for a client connection
        $client = $listener.AcceptTcpClient()
        
        # Get the client stream
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader $stream
        $writer = New-Object System.IO.StreamWriter $stream
        $writer.AutoFlush = $true
        
        # Read the HTTP request
        $request = ""
        while (($line = $reader.ReadLine()) -ne $null) {
            $request += "$line`n"
            if ($line -eq "") { break }
        }
        
        # Parse the request to get the path
        $requestLine = $request.Split("`n")[0]
        $path = ($requestLine -split " ")[1]
        
        # Remove query string if present
        if ($path.Contains("?")) {
            $path = $path.Substring(0, $path.IndexOf("?"))
        }
        
        # Determine file path
        if ($path -eq "/") {
            $filePath = Join-Path $PSScriptRoot "index.html"
        } else {
            $filePath = Join-Path $PSScriptRoot ($path.TrimStart("/"))
        }
        
        # Check if file exists
        if (Test-Path $filePath -PathType Leaf) {
            # Get file extension for content type
            $extension = [System.IO.Path]::GetExtension($filePath)
            $contentType = $mimeTypes[$extension]
            if (-not $contentType) {
                $contentType = "application/octet-stream"
            }
            
            # Read file content
            $fileContent = [System.IO.File]::ReadAllBytes($filePath)
            $contentLength = $fileContent.Length
            
            # Send HTTP response
            $writer.WriteLine("HTTP/1.1 200 OK")
            $writer.WriteLine("Content-Type: $contentType")
            $writer.WriteLine("Content-Length: $contentLength")
            $writer.WriteLine("")
            $writer.Flush()
            
            # Send file content
            $stream.Write($fileContent, 0, $contentLength)
        } else {
            # File not found
            $notFoundMessage = "404 - File not found: $path"
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($notFoundMessage)
            
            # Send HTTP response
            $writer.WriteLine("HTTP/1.1 404 Not Found")
            $writer.WriteLine("Content-Type: text/plain")
            $writer.WriteLine("Content-Length: $($notFoundBytes.Length)")
            $writer.WriteLine("")
            $writer.Flush()
            
            # Send response content
            $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }
        
        # Close the client connection
        $client.Close()
    }
}
catch {
    Write-Host "Error: $_"
}
finally {
    # Stop the listener
    if ($listener) {
        $listener.Stop()
    }
}
