$token = [Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "User")
if ($token) {
    Write-Host "User env: YES (starts with $($token.Substring(0,4))...)"
} else {
    Write-Host "User env: NOT SET"
}

$token2 = [Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "Machine")
if ($token2) {
    Write-Host "Machine env: YES (starts with $($token2.Substring(0,4))...)"
} else {
    Write-Host "Machine env: NOT SET"
}

$token3 = [Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "Process")
if ($token3) {
    Write-Host "Process env: YES (starts with $($token3.Substring(0,4))...)"
} else {
    Write-Host "Process env: NOT SET"
}
