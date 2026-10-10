$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$sourceRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$outputDirectory = Join-Path $sourceRoot '.local/submission'
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$archivePath = Join-Path $outputDirectory 'inventory-assignment-source.zip'
$manifestPath = Join-Path $outputDirectory 'manifest.json'
$excludedDirectories = @('node_modules', 'dist', 'coverage', '.git', '.local', 'test-results', 'playwright-report', 'target')
$files = [Collections.Generic.List[IO.FileInfo]]::new()
function Collect-Source([string]$directory) {
  foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
    if ($entry.PSIsContainer) {
      if ($entry.Name -notin $excludedDirectories) { Collect-Source $entry.FullName }
    } elseif (($entry.Name -notlike '.env*' -or $entry.Name -eq '.env.example') -and
              $entry.Name -notlike '*.log' -and $entry.Name -notlike '*.tsbuildinfo') {
      $files.Add($entry)
    }
  }
}
foreach ($directory in @('apps', 'docs', 'postman', 'tools', 'gateway')) { Collect-Source (Join-Path $sourceRoot $directory) }
foreach ($name in @('README.md','IMPLEMENTATION_PLAN.md','package.json','package-lock.json','.gitignore','.env.example')) {
  $files.Add((Get-Item -LiteralPath (Join-Path $sourceRoot $name)))
}
$manifest = @($files | Sort-Object FullName | ForEach-Object {
  @{ path = [IO.Path]::GetRelativePath($sourceRoot, $_.FullName).Replace('\','/'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = $_.Length }
})
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create)
$zip = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative = [IO.Path]::GetRelativePath($sourceRoot,$file.FullName).Replace('\','/')
    $entry = $zip.CreateEntry('inventory-assignment/' + $relative)
    $inputStream = $file.OpenRead(); $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
  }
} finally { $zip.Dispose(); $stream.Dispose() }
Write-Output "Created source ZIP with $($files.Count) files; SHA-256 manifest saved alongside it."
