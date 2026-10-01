// ZombieKitImporter.cs - sets pixel-art import settings, pivots, 9-slice borders and sprite-sheet slicing
// for every PNG under ZombieBaseKit/Art, driven by ZombieBaseKit/Data/unity_import.json.
// Needs the 2D Sprite package (com.unity.2d.sprite), which ships with the 2D project templates.
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public class ZombieKitImporter : AssetPostprocessor
{
    [System.Serializable] class Entry { public string path; public int w, h; public float px, py; public int fw, fh, cols, rows, border; public string[] rowNames; }
    [System.Serializable] class Table { public Entry[] entries; }

    public const int PixelsPerUnit = 16;
    static readonly Dictionary<string, Dictionary<string, Entry>> cache = new Dictionary<string, Dictionary<string, Entry>>();

    static Entry Find(string assetPath)
    {
        int i = assetPath.IndexOf("/Art/");
        if (i < 0) return null;
        string root = assetPath.Substring(0, i), json = root + "/Data/unity_import.json";
        if (!cache.TryGetValue(root, out var map))
        {
            if (!File.Exists(json)) return null;
            map = new Dictionary<string, Entry>();
            foreach (var e in JsonUtility.FromJson<Table>(File.ReadAllText(json)).entries) map[e.path] = e;
            cache[root] = map;
        }
        map.TryGetValue(assetPath.Substring(i + 1), out var hit);
        return hit;
    }

    void OnPreprocessTexture()
    {
        var e = Find(assetPath);
        if (e == null) return;
        var ti = (TextureImporter)assetImporter;
        ti.textureType = TextureImporterType.Sprite;
        ti.spritePixelsPerUnit = PixelsPerUnit;
        ti.filterMode = FilterMode.Point;
        ti.textureCompression = TextureImporterCompression.Uncompressed;
        ti.mipmapEnabled = false;
        ti.alphaIsTransparency = true;
        ti.wrapMode = TextureWrapMode.Clamp;
        ti.npotScale = TextureImporterNPOTScale.None;
        ti.maxTextureSize = 4096;

        var s = new TextureImporterSettings();
        ti.ReadTextureSettings(s);
        s.spriteMeshType = SpriteMeshType.FullRect;
        s.spriteExtrude = 0;
        s.spriteAlignment = (int)SpriteAlignment.Custom;
        s.spritePivot = new Vector2(e.px, e.py);
        s.spriteBorder = new Vector4(e.border, e.border, e.border, e.border);
        s.spriteMode = e.cols > 0 ? (int)SpriteImportMode.Multiple : (int)SpriteImportMode.Single;
        ti.SetTextureSettings(s);
        if (e.cols == 0) return;

        // Sheets: frame (col,row) starts at (col*fw, row*fh) from the top-left. Sprites are named
        // <file>_<row:00>_<rowName>_<col>, so sorting by name gives row-major order.
        var f = new SpriteDataProviderFactories();
        f.Init();
        var dp = f.GetSpriteEditorDataProviderFromObject(ti);
        dp.InitSpriteEditorDataProvider();
        var ids = new Dictionary<string, GUID>();
        foreach (var r in dp.GetSpriteRects()) ids[r.name] = r.spriteID;
        string baseName = Path.GetFileNameWithoutExtension(assetPath);
        var rects = new List<SpriteRect>();
        for (int r = 0; r < e.rows; r++)
            for (int c = 0; c < e.cols; c++)
            {
                string rn = e.rowNames != null && r < e.rowNames.Length ? e.rowNames[r] : "r";
                string n = baseName + "_" + r.ToString("00") + "_" + rn + "_" + c;
                rects.Add(new SpriteRect
                {
                    name = n,
                    spriteID = ids.TryGetValue(n, out var g) ? g : GUID.Generate(),
                    rect = new Rect(c * e.fw, e.h - (r + 1) * e.fh, e.fw, e.fh),
                    alignment = SpriteAlignment.Custom,
                    pivot = new Vector2(e.px, e.py)
                });
            }
        dp.SetSpriteRects(rects.ToArray());
#if UNITY_2021_2_OR_NEWER
        var nf = dp.GetDataProvider<ISpriteNameFileIdDataProvider>();
        if (nf != null) nf.SetNameFileIdPairs(rects.ConvertAll(x => new SpriteNameFileIdPair(x.name, x.spriteID)));
#endif
        dp.Apply();
    }

    static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
    {
        foreach (var p in imported) if (p.EndsWith("unity_import.json")) { cache.Clear(); break; }
    }

    [MenuItem("Tools/Zombie Base Kit/Reimport Art")]
    static void Reimport()
    {
        cache.Clear();
        foreach (var guid in AssetDatabase.FindAssets("t:Texture2D"))
        {
            var p = AssetDatabase.GUIDToAssetPath(guid);
            if (Find(p) != null) AssetDatabase.ImportAsset(p, ImportAssetOptions.ForceUpdate);
        }
    }
}
