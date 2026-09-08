$ErrorActionPreference = 'Stop'
$fontRoot = Join-Path $PSScriptRoot '../public/fonts'
New-Item -ItemType Directory -Path $fontRoot -Force | Out-Null
$families = @(
  @{ Name = 'Inter'; Folder = 'inter'; Styles = '400,600,700,400italic,700italic' },
  @{ Name = 'Playfair Display'; Folder = 'playfairdisplay'; Styles = '400,600,700,400italic,700italic' },
  @{ Name = 'Montserrat'; Folder = 'montserrat'; Styles = '400,600,700,400italic,700italic' },
  @{ Name = 'Cormorant Garamond'; Folder = 'cormorantgaramond'; Styles = '400,600,700,400italic,700italic' },
  @{ Name = 'Cinzel'; Folder = 'cinzel'; Styles = '400,600,700' },
  @{ Name = 'Great Vibes'; Folder = 'greatvibes'; Styles = '400' }
)
$rules = [System.Collections.Generic.List[string]]::new()
$manifest = [System.Collections.Generic.List[object]]::new()
foreach ($family in $families) {
  $cssUrl = 'https://fonts.googleapis.com/css?family=' + [Uri]::EscapeDataString($family.Name) + ':' + $family.Styles
  $css = (Invoke-WebRequest -Uri $cssUrl -UseBasicParsing).Content
  foreach ($rule in [regex]::Matches($css, '@font-face\s*\{([^}]+)\}')) {
    $body = $rule.Groups[1].Value
    $weight = [regex]::Match($body, 'font-weight:\s*(\d+)').Groups[1].Value
    $style = [regex]::Match($body, 'font-style:\s*(\w+)').Groups[1].Value
    $source = [regex]::Match($body, 'url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)').Groups[1].Value
    if (!$source) { throw "Expected TrueType source for $($family.Name)" }
    $fileName = "$($family.Folder)-$weight-$style.ttf"
    $fontPath = Join-Path $fontRoot $fileName
    Invoke-WebRequest -Uri $source -OutFile $fontPath -UseBasicParsing
    $rules.Add("@font-face { font-family: '$($family.Name)'; font-style: $style; font-weight: $weight; font-display: block; src: url('/fonts/$fileName') format('truetype'); }")
    $manifest.Add(@{ family = $family.Name; weight = [int]$weight; style = $style; file = $fileName; source = $source; sha256 = (Get-FileHash -LiteralPath $fontPath -Algorithm SHA256).Hash })
  }
  $license = 'https://raw.githubusercontent.com/google/fonts/main/ofl/' + $family.Folder + '/OFL.txt'
  Invoke-WebRequest -Uri $license -OutFile (Join-Path $fontRoot "$($family.Folder)-OFL.txt") -UseBasicParsing
}
$rules | Set-Content -LiteralPath (Join-Path $fontRoot 'fonts.css') -Encoding utf8
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fontRoot 'manifest.json') -Encoding utf8
Write-Output "Bundled $($manifest.Count) font faces with licenses and source hashes."
