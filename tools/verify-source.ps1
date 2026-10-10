$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$sourceRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$outputDirectory = Join-Path $sourceRoot '.local/submission'
$archivePath = Join-Path $outputDirectory 'inventory-assignment-source.zip'
$manifest = Get-Content -LiteralPath (Join-Path $outputDirectory 'manifest.json') -Raw | ConvertFrom-Json
$expected = @{}
foreach ($file in $manifest) { $expected['inventory-assignment/' + $file.path] = $file }
$privateValues = @()
foreach ($line in Get-Content -LiteralPath (Join-Path $sourceRoot '.env')) {
  if ($line -match '^(JWT_SECRET|DATABASE_URL|TEST_DATABASE_URL)=(.+)$') { $privateValues += $Matches[2] }
  if ($line -match '^(DATABASE_URL|TEST_DATABASE_URL)=(.+)$') {
    $connection = [Uri]$Matches[2]
    $privateValues += [Uri]::UnescapeDataString(($connection.UserInfo -split ':',2)[1])
  }
  if ($line -match '^WEBHOOK_SECRET=(.+)$' -and $Matches[1] -ne 'local-demo-webhook-secret') { $privateValues += $Matches[1] }
}
$zip = [IO.Compression.ZipArchive]::new([IO.File]::OpenRead($archivePath),[IO.Compression.ZipArchiveMode]::Read)
try {
  if ($zip.Entries.Count -ne $manifest.Count) { throw 'Archive/manifest count mismatch' }
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName.Contains('\') -or $entry.FullName.Contains('../') -or
        $entry.FullName -match '/(node_modules|dist|coverage|target|\.git|\.local)/' -or
        ($entry.FullName -match '/\.env[^/]*$' -and $entry.FullName -notmatch '/\.env\.example$')) { throw 'Unsafe or excluded archive path' }
    if (-not $expected.ContainsKey($entry.FullName)) { throw 'Unexpected archive entry' }
    $stream = $entry.Open(); $memory = [IO.MemoryStream]::new()
    try { $stream.CopyTo($memory) } finally { $stream.Dispose() }
    $bytes = $memory.ToArray(); $memory.Dispose()
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $hash = [Convert]::ToHexString($algorithm.ComputeHash($bytes)).ToLowerInvariant() } finally { $algorithm.Dispose() }
    if ($hash -ne $expected[$entry.FullName].sha256 -or $bytes.Length -ne $expected[$entry.FullName].bytes) { throw 'Archive checksum mismatch' }
    $text = [Text.Encoding]::UTF8.GetString($bytes)
    foreach ($value in $privateValues) { if ($text.Contains($value)) { throw 'Private configuration in archive' } }
    if ($text -match 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+') { throw 'Runtime JWT in archive' }
  }
} finally { $zip.Dispose() }
Write-Output "Verified $($manifest.Count) archive paths/checksums and private configuration exclusion."
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $outputDirectory 'SHA256.txt'), "$archiveHash  inventory-assignment-source.zip`n")
Write-Output "Archive SHA-256: $archiveHash"
