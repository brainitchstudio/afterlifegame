using System;
using System.IO;
using UnityEngine;

namespace Afterlife
{
    public static class SaveStore
    {
        public static string Pathname => Path.Combine(Application.persistentDataPath, "afterlife-v3.json");
        public static bool HasSave => File.Exists(Pathname);
        public static void Write(Simulation game)
        {
            Directory.CreateDirectory(Application.persistentDataPath);
            string temp = Pathname + ".tmp";
            File.WriteAllText(temp, game.Serialize());
            if (File.Exists(Pathname)) File.Replace(temp, Pathname, Pathname + ".bak");
            else File.Move(temp, Pathname);
        }
        public static string Load(Simulation game)
        {
            if (!File.Exists(Pathname)) return "";
            try
            {
                string json = File.ReadAllText(Pathname);
                if (game.Restore(json)) return "";
                if (File.Exists(Pathname + ".bak") && game.Restore(File.ReadAllText(Pathname + ".bak")))
                    return "Recovered the previous autosave. The newest save failed validation.";
                // Preserve the rejected file before autosave can replace it.
                File.Copy(Pathname, Pathname + ".rejected-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"), true);
                return "Save could not be loaded; a copy was preserved. " + game.RestoreError(json);
            }
            catch (Exception ex) { return "Unable to read save: " + ex.Message; }
        }
    }
}
