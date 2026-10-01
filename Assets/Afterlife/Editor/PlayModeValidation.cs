using UnityEditor;
using UnityEditor.TestTools.TestRunner.Api;
using UnityEngine;

namespace Afterlife.Editor
{
    [InitializeOnLoad]
    public static class PlayModeValidation
    {
        static PlayModeValidation()
        {
            TestRunnerApi.RegisterTestCallback(new Results());
        }

        sealed class Results : ICallbacks
        {
            public void RunStarted(ITestAdaptor testsToRun) { }
            public void TestStarted(ITestAdaptor test) { }
            public void TestFinished(ITestResultAdaptor result)
            {
                if (result.Test.Method == null) return;
                if (result.TestStatus == TestStatus.Passed) Debug.Log("AFTERLIFE_PLAYMODE_PASS " + result.FullName);
                else Debug.LogError("AFTERLIFE_PLAYMODE_FAIL " + result.FullName + " " + result.Message);
            }
            public void RunFinished(ITestResultAdaptor result)
            {
                Debug.Log("AFTERLIFE_PLAYMODE_RESULT " + result.ResultState + " passed=" + result.PassCount + " failed=" + result.FailCount);
            }
        }

        [MenuItem("Afterlife/Run Watchtower Play Mode Test")]
        public static void RunWatchtowerTest()
        {
            AfterlifeProject.AssertBundleCurrent();
            var runner = ScriptableObject.CreateInstance<TestRunnerApi>();
            runner.Execute(new ExecutionSettings(new Filter
            {
                testMode = TestMode.PlayMode,
                assemblyNames = new[] { "Afterlife.PlayModeTests" }
            }));
        }
    }
}
