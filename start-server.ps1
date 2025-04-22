$Hso = New-Object Net.HttpListener
$Hso.Prefixes.Add("http://localhost:8000/")
$Hso.Start()

Write-Host "Server started at http://localhost:8000/"
Write-Host "Press Ctrl+C to stop the server"

$Root = Resolve-Path "."

while ($Hso.IsListening) {
    $HC = $Hso.GetContext()
    $HRes = $HC.Response
    $HReq = $HC.Request
    
    $RequestedFile = $HReq.Url.LocalPath
    $RequestedFile = $RequestedFile.TrimStart("/")
    
    if ([string]::IsNullOrEmpty($RequestedFile)) {
        $RequestedFile = "index.html"
    }
    
    $FilePath = Join-Path $Root $RequestedFile
    
    if (Test-Path $FilePath -PathType Leaf) {
        $Buffer = [System.IO.File]::ReadAllBytes($FilePath)
        $HRes.ContentLength64 = $Buffer.Length
        
        # Set content type based on file extension
        $Extension = [System.IO.Path]::GetExtension($FilePath)
        switch ($Extension) {
            ".html" { $HRes.ContentType = "text/html" }
            ".css"  { $HRes.ContentType = "text/css" }
            ".js"   { $HRes.ContentType = "application/javascript" }
            default { $HRes.ContentType = "application/octet-stream" }
        }
        
        $HRes.OutputStream.Write($Buffer, 0, $Buffer.Length)
    } else {
        $HRes.StatusCode = 404
        $NotFoundMessage = "404 - File not found"
        $Buffer = [System.Text.Encoding]::UTF8.GetBytes($NotFoundMessage)
        $HRes.ContentLength64 = $Buffer.Length
        $HRes.OutputStream.Write($Buffer, 0, $Buffer.Length)
    }
    
    $HRes.Close()
}

$Hso.Stop()
