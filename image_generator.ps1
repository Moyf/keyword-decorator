# 加载System.Drawing程序集
Add-Type -AssemblyName System.Drawing

# 优化后的十六进制颜色转换函数
function ConvertFrom-HexColor {
    param (
        [Parameter(Mandatory=$true)]
        [ValidatePattern('^#[0-9a-fA-F]{6}$')]
        [string]$hexColor
    )
    
    try {
        $hex = $hexColor.Substring(1)
        $rgb = [Convert]::ToInt32($hex, 16)
        return [System.Drawing.Color]::FromArgb(
            [int]::Parse($hexColor.Substring(1, 2), [System.Globalization.NumberStyles]::HexNumber),
            [int]::Parse($hexColor.Substring(3, 2), [System.Globalization.NumberStyles]::HexNumber),
            [int]::Parse($hexColor.Substring(5, 2), [System.Globalization.NumberStyles]::HexNumber)
        )
    }
    catch {
        throw "无效的十六进制颜色格式: $hexColor"
    }
}

# 主要处理逻辑
try {
    # 参数验证
    if ($width -le 0 -or $height -le 0) {
        throw "宽度和高度必须大于0"
    }
    if ($opacity -lt 0 -or $opacity -gt 1) {
        throw "透明度必须在0到1之间"
    }

    $alpha = [math]::Round($opacity * 255)
    $baseColor = ConvertFrom-HexColor -hexColor $hexColor
    $color = [System.Drawing.Color]::FromArgb($alpha, $baseColor.R, $baseColor.G, $baseColor.B)

    # 使用using语句自动管理资源
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    try {
        $bitmap.MakeTransparent()
        using ($graphics = [System.Drawing.Graphics]::FromImage($bitmap)) {
            $graphics.Clear($color)
        }
        
        # 确保目标目录存在
        $directory = Split-Path -Parent $savePath
        if (!(Test-Path $directory)) {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }

        # 保存图片
        $bitmap.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "图片已成功保存到: $savePath"
    }
    finally {
        if ($bitmap) { $bitmap.Dispose() }
    }
}
catch {
    Write-Error "处理图片时发生错误: $_"
    exit 1
} 