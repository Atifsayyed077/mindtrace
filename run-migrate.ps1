# ============================================================
# MindTrace - one-time database setup
# ------------------------------------------------------------
# Run from the project folder (E:\brainny\mindtrace):
#   powershell -ExecutionPolicy Bypass -File .\run-migrate.ps1
#
# The database password is typed into THIS window only.
# It never appears in chat, logs, or the git repo.
# ============================================================
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

Write-Host ''
Write-Host '=== MindTrace database setup ===' -ForegroundColor Cyan

# Step 0 - make sure the supabase CLI has its config (creates supabase/config.toml)
if (-not (Test-Path (Join-Path $PSScriptRoot 'supabase\config.toml'))) {
  Write-Host 'Step 0/4 - initializing supabase config (one time)'
  npx --yes supabase@latest init | Out-Host
}

Write-Host 'Step 1/4 - linking project bmhkibyeytfxagirzzmr'
Write-Host '  > If asked for the database password, type it here (input hidden).' -ForegroundColor Yellow
Write-Host '  > Do not know it? Supabase dashboard -> Project Settings -> Database ->' -ForegroundColor Yellow
Write-Host '    "Reset database password", then rerun this script and use the new one.' -ForegroundColor Yellow
npx --yes supabase@latest link --project-ref bmhkibyeytfxagirzzmr | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Linking failed - fix the reason shown above, then rerun this script.' -ForegroundColor Red
  exit 1
}

Write-Host 'Step 2/4 - pushing migrations 0001..0004 (tables, RLS, storage bucket, functions)'
npx --yes supabase@latest db push --remote --yes | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Push failed - send the error text above to the assistant.' -ForegroundColor Red
  Write-Host 'Fallback: paste the whole supabase\MIGRATE.sql into the Supabase SQL editor and Run.' -ForegroundColor Yellow
  exit 1
}

Write-Host 'Step 3/4 - verifying all 7 tables via REST (no secrets printed)'
$base = 'https://bmhkibyeytfxagirzzmr.supabase.co'
$keyLine = Get-Content (Join-Path $PSScriptRoot '.env.local') | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' } | Select-Object -First 1
$key = $keyLine.Substring($keyLine.IndexOf('=') + 1).Trim('"')
$okCount = 0
foreach ($t in @('profiles','journeys','daily_sessions','user_responses','journal_entries','wellness_reports','certificates')) {
  $code = curl.exe -s -o NUL -w '%{http_code}' ('{0}/rest/v1/{1}?select=id&limit=1' -f $base, $t) -H ('apikey: ' + $key)
  if ($code -eq '200') { $okCount++; Write-Host ('  [ OK  ] ' + $t) -ForegroundColor Green }
  else { Write-Host ('  [FAIL ] ' + $t + ' (HTTP ' + $code + ')') -ForegroundColor Red }
}
Write-Host ('Tables ready: ' + $okCount + '/7')

Write-Host 'Step 4/4 - done'
if ($okCount -eq 7) {
  Write-Host 'DATABASE IS READY. Tell the assistant to run the full verification (login + profile + RPCs).' -ForegroundColor Green
} else {
  Write-Host 'Some tables are missing - rerun this script, or paste supabase\MIGRATE.sql in the SQL editor.' -ForegroundColor Yellow
}
