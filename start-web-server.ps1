param(
    [int]$Port = 8080
)

# Get the IP address of the server
$IPAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | Select-Object -First 1).IPAddress

# Create HTTP listener
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://+:$Port/")
$Listener.Start()

Write-Host "Arbitrage Log Analyzer (ALA) server started!"
Write-Host "Server is running at:"
Write-Host "  - Local: http://localhost:$Port/"
if ($IPAddress) {
    Write-Host "  - Network: http://$($IPAddress):$Port/"
    Write-Host "  - You can access this from other devices on your network using the Network URL"
}
Write-Host "Press Ctrl+C to stop the server"

# Get the root directory
$RootDirectory = $PSScriptRoot

# MIME type mapping
$ContentTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

try {
    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response
        
        # Get requested URL path
        $Path = $Request.Url.LocalPath
        $Path = $Path.TrimStart("/")
        
        # Default to index.html for root path
        if ([string]::IsNullOrEmpty($Path)) {
            $Path = "index.html"
        }
        
        # Construct full file path
        $FilePath = Join-Path -Path $RootDirectory -ChildPath $Path
        
        # Check if file exists
        if (Test-Path -Path $FilePath -PathType Leaf) {
            # Determine content type based on file extension
            $Extension = [System.IO.Path]::GetExtension($FilePath)
            $ContentType = $ContentTypes[$Extension]
            
            if (-not $ContentType) {
                $ContentType = "application/octet-stream"
            }
            
            # Set content type
            $Response.ContentType = $ContentType
            
            # Read file content
            $FileContent = [System.IO.File]::ReadAllBytes($FilePath)
            
            # Set response length and write content
            $Response.ContentLength64 = $FileContent.Length
            $Response.OutputStream.Write($FileContent, 0, $FileContent.Length)
            
            # Log the request
            Write-Host "$(Get-Date) - $($Request.HttpMethod) $($Request.Url.LocalPath) - 200 OK"
        }
        else {
            # File not found - return 404
            $Response.StatusCode = 404
            $NotFoundMessage = "404 - File not found: $Path"
            $NotFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($NotFoundMessage)
            
            $Response.ContentType = "text/plain"
            $Response.ContentLength64 = $NotFoundBytes.Length
            $Response.OutputStream.Write($NotFoundBytes, 0, $NotFoundBytes.Length)
            
            # Log the request
            Write-Host "$(Get-Date) - $($Request.HttpMethod) $($Request.Url.LocalPath) - 404 Not Found"
        }
        
        # Close the response
        $Response.Close()
    }
}
finally {
    # Stop the listener when done
    $Listener.Stop()
    Write-Host "Server stopped"
}
