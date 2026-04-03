using System.Drawing;
using System.Drawing.Imaging;

public class ImageGenerator
{
    public static void GenerateColorImage(int width, int height, string hexColor, double opacity, string savePath)
    {
        if (width <= 0 || height <= 0)
            throw new ArgumentException("宽度和高度必须大于0");

        if (!hexColor.StartsWith("#") || hexColor.Length != 7)
            throw new ArgumentException("颜色格式必须为 #RRGGBB");

        if (opacity < 0 || opacity > 1)
            throw new ArgumentException("不透明度必须在0到1之间");

        // 快速解析十六进制颜色
        int rgb = Convert.ToInt32(hexColor.Substring(1), 16);
        Color baseColor = Color.FromArgb(
            (rgb >> 16) & 0xFF,
            (rgb >> 8) & 0xFF,
            rgb & 0xFF
        );

        // 计算alpha值（0-255）
        int alpha = (int)Math.Round(opacity * 255);
        Color finalColor = Color.FromArgb(alpha, baseColor);

        using (var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.Clear(finalColor);

            string? directory = Path.GetDirectoryName(savePath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            bitmap.Save(savePath, ImageFormat.Png);
        }
    }

    // Quicker将会调用的函数
    public static void Exec(Quicker.Public.IStepContext context)
    {
        try
        {
            // 从Quicker变量获取参数
            int width = context.TryGetVarInt("{宽}");
            int height = context.TryGetVarInt("{高}");
            string hexColor = context.TryGetVarString("{颜色}");
            double opacity = context.TryGetVarDouble("{透明度}");
            string savePath = context.TryGetVarString("{图片路径}");

            // 调用图片生成函数
            GenerateColorImage(width, height, hexColor, opacity, savePath);

            // 输出结果到Quicker
            context.SetVarString("生成结果", savePath);
        }
        catch (Exception ex)
        {
            // 错误处理
            context.ShowError($"生成图片失败: {ex.Message}");
        }
    }
} 