param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage = "Automatic update"
)

# Store GitHub credentials (first time only)
# Uncomment this line the first time you run the script
# git config --global credential.helper store

# Add all changes
git add .

# Commit changes
git commit -m $CommitMessage

# Push to GitHub
git push

Write-Host "Changes pushed to GitHub successfully!" -ForegroundColor Green
Write-Host "Commit message: $CommitMessage" -ForegroundColor Cyan
