# Run once: .\\.github\setup-branch-protection.ps1 -Token "ghp_yourtoken"
param([Parameter(Mandatory)][string]$Token)

$headers = @{
    Authorization  = "Bearer $Token"
    Accept         = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$body = @{
    required_status_checks = @{
        strict   = $true
        contexts = @(
            "Backend — Lint + Type Check + Tests",
            "Frontend — Lint + Type Check + Tests + Build"
        )
    }
    enforce_admins                  = $false
    required_pull_request_reviews   = @{
        required_approving_review_count = 1
        dismiss_stale_reviews           = $true
    }
    restrictions                    = $null
    allow_force_pushes              = $false
    allow_deletions                 = $false
} | ConvertTo-Json -Depth 5

$url = "https://api.github.com/repos/harshita-bamniya/Disha/branches/main/protection"
$response = Invoke-RestMethod -Method PUT -Uri $url -Headers $headers -Body $body -ContentType "application/json"
Write-Host "Branch protection applied to main." -ForegroundColor Green
$response | ConvertTo-Json -Depth 3
