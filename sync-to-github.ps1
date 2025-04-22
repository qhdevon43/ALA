param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Updated files"
)

# Fixed paths based on your setup
$sourceDir = "C:\Users\Administrator\CascadeProjects\ALA"
$destinationDir = "C:\Users\Administrator\GitHub\ALA"

# Copy all files from source to destination
Write-Host "Copying files from $sourceDir to $destinationDir..." -ForegroundColor Cyan
Copy-Item -Path "$sourceDir\*" -Destination $destinationDir -Recurse -Force

# Change to the GitHub repository directory
Set-Location -Path $destinationDir

# Check if git is available
$gitAvailable = $null
try {
    $gitAvailable = Get-Command "git" -ErrorAction Stop
} catch {
    $gitAvailable = $false
}

# If git is available, commit and push changes
if ($gitAvailable) {
    Write-Host "Committing changes to GitHub..." -ForegroundColor Cyan
    git add .
    git commit -m $CommitMessage
    git push
    Write-Host "Changes pushed to GitHub successfully!" -ForegroundColor Green
} else {
    Write-Host "Files copied successfully. Opening GitHub Desktop..." -ForegroundColor Yellow
    
    # Try to find GitHub Desktop and launch it
    $githubDesktopPath = "C:\Users\$env:USERNAME\AppData\Local\GitHubDesktop\GitHubDesktop.exe"
    
    if (Test-Path $githubDesktopPath) {
        Start-Process $githubDesktopPath
        Write-Host "GitHub Desktop launched. Please commit and push your changes." -ForegroundColor Cyan
    } else {
        # Try alternative locations
        $altPath1 = "C:\Users\$env:USERNAME\AppData\Local\Apps\GitHubDesktop\GitHubDesktop.exe"
        $altPath2 = "${env:ProgramFiles}\GitHub Desktop\GitHubDesktop.exe"
        $altPath3 = "${env:ProgramFiles(x86)}\GitHub Desktop\GitHubDesktop.exe"
        
        if (Test-Path $altPath1) {
            Start-Process $altPath1
            Write-Host "GitHub Desktop launched. Please commit and push your changes." -ForegroundColor Cyan
        } elseif (Test-Path $altPath2) {
            Start-Process $altPath2
            Write-Host "GitHub Desktop launched. Please commit and push your changes." -ForegroundColor Cyan
        } elseif (Test-Path $altPath3) {
            Start-Process $altPath3
            Write-Host "GitHub Desktop launched. Please commit and push your changes." -ForegroundColor Cyan
        } else {
            Write-Host "Could not find GitHub Desktop. Please open it manually to commit and push changes." -ForegroundColor Yellow
        }
    }
}

Write-Host "Sync complete!" -ForegroundColor Green
