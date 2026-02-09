# PowerShell script to generate simple icon PNG files for Ghost Tab extension
# Requires .NET Framework (usually pre-installed on Windows)

Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param([int]$Size)
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Create gradient background
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($Size, $Size),
        [System.Drawing.Color]::FromArgb(102, 126, 234),
        [System.Drawing.Color]::FromArgb(118, 75, 162)
    )
    $graphics.FillRectangle($brush, 0, 0, $Size, $Size)
    
    # Draw white snowflake
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1, $Size / 16))
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $centerX = $Size / 2
    $centerY = $Size / 2
    $radius = $Size * 0.3
    
    for ($i = 0; $i -lt 6; $i++) {
        $angle = ([Math]::PI / 3) * $i
        $x1 = $centerX + [Math]::Cos($angle) * $radius
        $y1 = $centerY + [Math]::Sin($angle) * $radius
        $x2 = $centerX + [Math]::Cos($angle) * $radius * 0.5
        $y2 = $centerY + [Math]::Sin($angle) * $radius * 0.5
        
        $graphics.DrawLine($pen, $centerX, $centerY, $x1, $y1)
        $graphics.DrawLine($pen, $x2, $y2, 
            ($centerX + [Math]::Cos($angle + [Math]::PI / 6) * $radius * 0.7),
            ($centerY + [Math]::Sin($angle + [Math]::PI / 6) * $radius * 0.7))
    }
    
    # Center dot
    $brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.FillEllipse($brush2, $centerX - ($Size * 0.08), $centerY - ($Size * 0.08), 
                         $Size * 0.16, $Size * 0.16)
    
    # Save
    $outputPath = Join-Path $PSScriptRoot "icons\icon$Size.png"
    if (-not (Test-Path "icons")) {
        New-Item -ItemType Directory -Path "icons" | Out-Null
    }
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    $brush2.Dispose()
    
    Write-Host "Created: $outputPath" -ForegroundColor Green
}

Write-Host "Generating Ghost Tab icons..." -ForegroundColor Cyan
Create-Icon -Size 16
Create-Icon -Size 48
Create-Icon -Size 128
Write-Host "`nDone! Icons created in the 'icons' folder." -ForegroundColor Green
