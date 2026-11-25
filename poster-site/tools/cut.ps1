param(
  [string]$Src,
  [string]$Dst,
  [int]$MaxDim = 1400,
  [double]$Black = 0,
  [double]$White = 255,
  [switch]$Invert,
  [double]$Threshold = 140,
  [ValidateSet("bright","dark","bg")] [string]$Mode = "bg",
  [double]$Tol = 26,
  [int]$Close = 4,
  [int]$KillShadow = 0,
  [int]$Feather = 2
)

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class CutTool
{
    public static string Run(string src, string dst, int maxDim, double black, double white, bool invert,
                             int mode, double threshold, double tol, int closeRadius, int killShadow, int feather)
    {
        Bitmap orig = new Bitmap(src);
        double s = Math.Min(1.0, (double)maxDim / Math.Max(orig.Width, orig.Height));
        int nw = Math.Max(2, (int)(orig.Width * s));
        int nh = Math.Max(2, (int)(orig.Height * s));

        Bitmap bmp = new Bitmap(nw, nh, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
            g.DrawImage(orig, 0, 0, nw, nh);
        }
        orig.Dispose();

        BitmapData d = bmp.LockBits(new Rectangle(0, 0, nw, nh), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = d.Stride;
        byte[] px = new byte[stride * nh];
        Marshal.Copy(d.Scan0, px, 0, px.Length);

        int total = nw * nh;
        double[] lum = new double[total];
        for (int y = 0; y < nh; y++)
            for (int x = 0; x < nw; x++)
            {
                int i = y * stride + x * 4;
                lum[y * nw + x] = 0.299 * px[i + 2] + 0.587 * px[i + 1] + 0.114 * px[i];
            }

        // ---------- background colour estimate (border ring, median per channel)
        double bgR = 0, bgG = 0, bgB = 0;
        {
            List<int> rr = new List<int>(), gg = new List<int>(), bb2 = new List<int>();
            int ring = Math.Max(2, Math.Min(nw, nh) / 40);
            for (int y = 0; y < nh; y++)
                for (int x = 0; x < nw; x++)
                {
                    bool border = x < ring || y < ring || x >= nw - ring || y >= nh - ring;
                    if (!border) continue;
                    int i = y * stride + x * 4;
                    rr.Add(px[i + 2]); gg.Add(px[i + 1]); bb2.Add(px[i]);
                }
            rr.Sort(); gg.Sort(); bb2.Sort();
            int mid = rr.Count / 2;
            bgR = rr[mid]; bgG = gg[mid]; bgB = bb2[mid];
        }

        // ---------- initial mask
        bool[] mask = new bool[total];
        for (int y = 0; y < nh; y++)
            for (int x = 0; x < nw; x++)
            {
                int p = y * nw + x;
                if (mode == 2)
                {
                    int i = y * stride + x * 4;
                    double dr = px[i + 2] - bgR, dg = px[i + 1] - bgG, db = px[i] - bgB;
                    mask[p] = (dr * dr + dg * dg + db * db) > (tol * tol * 3.0);
                }
                else if (mode == 0) mask[p] = lum[p] > threshold;
                else mask[p] = lum[p] < threshold;
            }

        // ---------- morphological closing (dilate then erode)
        for (int pass = 0; pass < closeRadius; pass++) mask = Dilate(mask, nw, nh);
        for (int pass = 0; pass < closeRadius; pass++) mask = Erode(mask, nw, nh);

        // ---------- keep largest connected component
        int[] label = new int[total];
        int best = 0, bestCount = 0, cur = 0;
        for (int p0 = 0; p0 < total; p0++)
        {
            if (!mask[p0] || label[p0] != 0) continue;
            cur++;
            int count = 0;
            Stack<int> q = new Stack<int>();
            q.Push(p0); label[p0] = cur;
            while (q.Count > 0)
            {
                int p = q.Pop(); count++;
                int x = p % nw, y = p / nw;
                if (x > 0 && mask[p - 1] && label[p - 1] == 0) { label[p - 1] = cur; q.Push(p - 1); }
                if (x < nw - 1 && mask[p + 1] && label[p + 1] == 0) { label[p + 1] = cur; q.Push(p + 1); }
                if (y > 0 && mask[p - nw] && label[p - nw] == 0) { label[p - nw] = cur; q.Push(p - nw); }
                if (y < nh - 1 && mask[p + nw] && label[p + nw] == 0) { label[p + nw] = cur; q.Push(p + nw); }
            }
            if (count > bestCount) { bestCount = count; best = cur; }
        }

        // ---------- hole filling
        bool[] solid = new bool[total];
        for (int p = 0; p < total; p++) solid[p] = label[p] == best;

        // ---------- optional shadow removal (drop dark areas far from bright surface)
        if (killShadow > 0)
        {
            bool[] bright = new bool[total];
            for (int p = 0; p < total; p++) bright[p] = lum[p] > 95.0;
            for (int i = 0; i < killShadow; i++) bright = Dilate(bright, nw, nh);
            for (int p = 0; p < total; p++) if (!bright[p]) solid[p] = false;
        }

        bool[] outside = new bool[total];
        Stack<int> st = new Stack<int>();
        for (int x = 0; x < nw; x++) { st.Push(x); st.Push((nh - 1) * nw + x); }
        for (int y = 0; y < nh; y++) { st.Push(y * nw); st.Push(y * nw + nw - 1); }
        while (st.Count > 0)
        {
            int p = st.Pop();
            if (outside[p] || solid[p]) continue;
            outside[p] = true;
            int x = p % nw, y = p / nw;
            if (x > 0) st.Push(p - 1);
            if (x < nw - 1) st.Push(p + 1);
            if (y > 0) st.Push(p - nw);
            if (y < nh - 1) st.Push(p + nw);
        }
        for (int p = 0; p < total; p++) if (!outside[p]) solid[p] = true;

        // ---------- alpha
        byte[] alpha = new byte[total];
        for (int p = 0; p < total; p++) alpha[p] = solid[p] ? (byte)255 : (byte)0;
        for (int pass = 0; pass < feather; pass++)
        {
            byte[] tmp = new byte[total];
            for (int y = 0; y < nh; y++)
                for (int x = 0; x < nw; x++)
                {
                    int sum = 0, cnt = 0;
                    for (int dy = -1; dy <= 1; dy++)
                    {
                        int yy = y + dy; if (yy < 0 || yy >= nh) continue;
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            int xx = x + dx; if (xx < 0 || xx >= nw) continue;
                            sum += alpha[yy * nw + xx]; cnt++;
                        }
                    }
                    tmp[y * nw + x] = (byte)(sum / cnt);
                }
            alpha = tmp;
        }

        // ---------- levels / invert / write
        double span = Math.Max(1.0, white - black);
        int minX = nw, minY = nh, maxX = -1, maxY = -1;
        for (int y = 0; y < nh; y++)
        {
            for (int x = 0; x < nw; x++)
            {
                int p = y * nw + x;
                int i = y * stride + x * 4;
                double v = (lum[p] - black) / span * 255.0;
                if (v < 0) v = 0; if (v > 255) v = 255;
                if (invert) v = 255 - v;
                byte b = (byte)v;
                px[i] = b; px[i + 1] = b; px[i + 2] = b;
                px[i + 3] = alpha[p];
                if (alpha[p] > 24)
                {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }

        Marshal.Copy(px, 0, d.Scan0, px.Length);
        bmp.UnlockBits(d);

        if (maxX < 0) { minX = 0; minY = 0; maxX = nw - 1; maxY = nh - 1; }
        Rectangle crop = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
        Bitmap outBmp = bmp.Clone(crop, PixelFormat.Format32bppArgb);
        outBmp.Save(dst, ImageFormat.Png);
        string info = "bg=" + (int)bgR + "," + (int)bgG + "," + (int)bgB + " comps=" + cur + " biggest=" + bestCount + " crop=" + crop.Width + "x" + crop.Height;
        outBmp.Dispose();
        bmp.Dispose();
        return info;
    }

    static bool[] Dilate(bool[] m, int w, int h)
    {
        bool[] o = new bool[m.Length];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                bool v = false;
                for (int dy = -1; dy <= 1 && !v; dy++)
                    for (int dx = -1; dx <= 1 && !v; dx++)
                    {
                        int yy = y + dy, xx = x + dx;
                        if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
                        if (m[yy * w + xx]) v = true;
                    }
                o[y * w + x] = v;
            }
        return o;
    }

    static bool[] Erode(bool[] m, int w, int h)
    {
        bool[] o = new bool[m.Length];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                bool v = true;
                for (int dy = -1; dy <= 1 && v; dy++)
                    for (int dx = -1; dx <= 1 && v; dx++)
                    {
                        int yy = y + dy, xx = x + dx;
                        if (yy < 0 || yy >= h || xx < 0 || xx >= w) { v = false; break; }
                        if (!m[yy * w + xx]) v = false;
                    }
                o[y * w + x] = v;
            }
        return o;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$m = @{ "bright" = 0; "dark" = 1; "bg" = 2 }[$Mode]
$res = [CutTool]::Run($Src, $Dst, $MaxDim, $Black, $White, [bool]$Invert, $m, $Threshold, $Tol, $Close, $KillShadow, $Feather)
"$([System.IO.Path]::GetFileName($Dst)) -> $res"
