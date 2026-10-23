Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\BSOFT65\Downloads\Radiology_Triage_Logic.png'
$outputPath = 'D:\POC\health-care\Radiology_Triage_Logic_Updated.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

function Set-Label([string]$text, [int]$x, [int]$y, [int]$width, [int]$height, [string]$background, [string]$foreground, [float]$fontSize) {
    $bg = [System.Drawing.ColorTranslator]::FromHtml($background)
    $fg = [System.Drawing.ColorTranslator]::FromHtml($foreground)
    $bgBrush = [System.Drawing.SolidBrush]::new($bg)
    $fgBrush = [System.Drawing.SolidBrush]::new($fg)
    $font = [System.Drawing.Font]::new('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $rect = [System.Drawing.RectangleF]::new([single]$x, [single]$y, [single]$width, [single]$height)
    $graphics.FillRectangle($bgBrush, $rect)
    $graphics.DrawString($text, $font, $fgBrush, $rect, $format)
    $font.Dispose()
    $bgBrush.Dispose()
    $fgBrush.Dispose()
}

Set-Label 'DenseNet121' 668 249 220 58 '#E3F4F1' '#155E54' 31
Set-Label 'YOLO11n' 668 677 220 58 '#E3F4F1' '#155E54' 31
Set-Label 'MEDIUM PRIORITY' 1575 462 380 58 '#FEF3D7' '#8A5A00' 30
Set-Label 'LOW PRIORITY' 1575 722 380 58 '#E6F5EA' '#22633F' 30

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$format.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
