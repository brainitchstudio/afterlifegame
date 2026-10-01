using System;
using System.IO;
using Jint;
using UnityEditor;
using UnityEngine;

namespace Afterlife.Editor
{
    public static class SimulationRegression
    {
        [MenuItem("Afterlife/Run Original Regression Suite in Unity")]
        public static void Run()
        {
            AfterlifeProject.AssertBundleCurrent();
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            using (var engine = new Engine())
            {
                foreach (var m in JsonUtility.FromJson<ModuleBundle>(Resources.Load<TextAsset>("Simulation").text).modules) engine.Modules.Add(m.name,m.source);
                engine.SetValue("report",new Action<string>(Debug.Log));
                engine.Execute("globalThis.results={passed:0,failed:0,errors:[]};");
                engine.Modules.Add("node:test",@"
export default function test(name,fn){try{fn();results.passed++;report('PASS '+name);}catch(e){results.failed++;results.errors.push(name+': '+e.stack);report('FAIL '+name+': '+e.stack);}}");
                engine.Modules.Add("node:assert/strict",@"
const format=v=>JSON.stringify(v);
function fail(m){throw new Error(m||'Assertion failed');}
function equal(a,b,m){if(!Object.is(a,b))fail(m||format(a)+' !== '+format(b));}
function deep(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;if(Array.isArray(a)!==Array.isArray(b))return false;const x=Object.keys(a).sort(),y=Object.keys(b).sort();return x.length===y.length&&x.every((k,i)=>k===y[i]&&deep(a[k],b[k]));}
export default {equal,ok:(v,m)=>{if(!v)fail(m);},notEqual:(a,b,m)=>{if(Object.is(a,b))fail(m);},deepEqual:(a,b,m)=>{if(!deep(a,b))fail(m||format(a)+' differs from '+format(b));},notDeepEqual:(a,b,m)=>{if(deep(a,b))fail(m);},throws:fn=>{let threw=false;try{fn();}catch{threw=true;}if(!threw)fail('Expected throw');}};");
                string source=File.ReadAllText("tests/game.test.mjs").Replace("../Assets/Afterlife/Simulation/","");
                engine.Modules.Add("regression.mjs",source);engine.Modules.Import("regression.mjs");
                int failed=(int)engine.Evaluate("results.failed").AsNumber();
                Debug.Log("AFTERLIFE_REGRESSION " + engine.Evaluate("JSON.stringify(results)").AsString());
                if(failed>0)throw new Exception(failed+" embedded simulation regressions failed");
            }
        }
    }
}
