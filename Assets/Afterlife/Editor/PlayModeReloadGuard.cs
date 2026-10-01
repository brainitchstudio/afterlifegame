using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;

namespace Afterlife.Editor
{
    // Jint and the runtime-generated HUD are not Unity-serializable. End the live
    // session before assembly reload rather than leaving a partially restored game.
    [InitializeOnLoad]
    public static class PlayModeReloadGuard
    {
        static PlayModeReloadGuard()
        {
            CompilationPipeline.compilationStarted += BeforeCompilation;
        }

        static void BeforeCompilation(object context)
        {
            if (!EditorApplication.isPlaying) return;
            var game = Object.FindAnyObjectByType<AfterlifeGame>();
            if (!game) return;
            if (game.Ready && game.Simulation != null) game.Save();
            EditorApplication.isPlaying = false;
            Debug.Log("Afterlife stopped Play mode before script compilation. Press Play to continue from the autosave.");
        }
    }
}
