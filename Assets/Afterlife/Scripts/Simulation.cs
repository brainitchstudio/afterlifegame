using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using Jint;
using UnityEngine;

namespace Afterlife
{
    /// <summary>Managed, in-process simulation. No browser, Node, HTTP, or CLR access from scripts.</summary>
    public sealed class Simulation : IDisposable
    {
        readonly Engine engine;
        readonly DeltaFrame cachedDelta = new DeltaFrame();
        readonly Frame liveFrame = new Frame();
        readonly Dictionary<int, EntityView> entityMap = new Dictionary<int, EntityView>(128);
        readonly List<EntityView> entityList = new List<EntityView>(128);

        public Simulation()
        {
            engine = new Engine(options => options.ExperimentalFeatures = ExperimentalFeature.Generators);
            var bundle = Resources.Load<TextAsset>("Simulation");
            if (!bundle) throw new FileNotFoundException("Simulation bundle missing. Run Tools/bundle-simulation.mjs.");
            foreach (var module in JsonUtility.FromJson<ModuleBundle>(bundle.text).modules)
                engine.Modules.Add(module.name, module.source);
            engine.Modules.Import("unity.mjs");
            ResetDelta();
        }

        public void Step(float seconds) => engine.Invoke("afStep", (double)seconds);
        public void SetBounds(float x, float y) => engine.Invoke("afBounds", (double)x, (double)y);

        public Frame ReadFrame()
        {
            string json = engine.Invoke("afDeltaFrame").AsString();
            JsonUtility.FromJsonOverwrite(json, cachedDelta);
            ApplyDelta(cachedDelta);
            return liveFrame;
        }

        public Frame ReadFullFrame() => Read<Frame>("afFrame");

        public void ResetDelta()
        {
            entityMap.Clear();
            entityList.Clear();
            engine.Invoke("afResetDelta");
        }

        void ApplyDelta(DeltaFrame delta)
        {
            liveFrame.elapsed = delta.elapsed;
            liveFrame.day = delta.day;
            liveFrame.hour = delta.hour;
            liveFrame.phase = delta.phase;
            liveFrame.status = delta.status;
            liveFrame.season = delta.season;
            liveFrame.wood = delta.wood;
            liveFrame.metal = delta.metal;
            liveFrame.food = delta.food;
            liveFrame.capacity = delta.capacity;
            liveFrame.kills = delta.kills;
            liveFrame.alarm = delta.alarm;
            liveFrame.landRevision = delta.landRevision;
            liveFrame.territory = delta.territory;
            liveFrame.incoming = delta.incoming;
            liveFrame.director = delta.director;
            liveFrame.effects = delta.effects;

            if (delta.removed != null)
            {
                for (int i = 0; i < delta.removed.Length; i++)
                    entityMap.Remove(delta.removed[i]);
            }

            if (delta.added != null)
            {
                for (int i = 0; i < delta.added.Length; i++)
                {
                    var e = delta.added[i];
                    if (entityMap.TryGetValue(e.id, out var existing))
                    {
                        existing.kind = e.kind;
                        existing.type = e.type;
                        existing.name = e.name;
                        existing.sprite = e.sprite;
                        existing.maxHP = e.maxHP;
                        existing.width = e.width;
                        existing.height = e.height;
                        existing.groundY = e.groundY;
                        existing.role = e.role;
                        existing.task = e.task;
                        existing.away = e.away;
                        existing.condition = e.condition;
                        existing.gear = e.gear;
                        existing.level = e.level;
                        existing.side = e.side;
                        existing.shift = e.shift;
                        existing.post = e.post;
                    }
                    else
                    {
                        entityMap[e.id] = e;
                    }
                }
            }

            int sCount = 0;
            int zCount = 0;
            if (delta.u != null)
            {
                for (int i = 0; i + 5 < delta.u.Length; i += 6)
                {
                    int id = (int)delta.u[i];
                    if (entityMap.TryGetValue(id, out var ent))
                    {
                        ent.x = delta.u[i + 1];
                        ent.y = delta.u[i + 2];
                        ent.hp = delta.u[i + 3];
                        int flags = (int)delta.u[i + 4];
                        ent.facing = (flags & 1) != 0 ? -1f : 1f;
                        ent.fighting = (flags & 2) != 0;
                        ent.downed = (flags & 4) != 0;
                        ent.hidden = (flags & 8) != 0;
                        ent.stationed = (flags & 16) != 0;
                        ent.away = (flags & 32) != 0;
                        ent.targetId = (int)delta.u[i + 5];
                        if (ent.kind != "building") ent.groundY = ent.y;

                        if (ent.kind == "survivor") sCount++;
                        else if (ent.kind == "zombie") zCount++;
                    }
                }
            }

            liveFrame.survivorCount = sCount;
            liveFrame.zombieCount = zCount;

            bool lengthChanged = liveFrame.entities == null || liveFrame.entities.Length != entityMap.Count;
            if (lengthChanged)
            {
                entityList.Clear();
                foreach (var kvp in entityMap) entityList.Add(kvp.Value);
                liveFrame.entities = entityList.ToArray();
            }
            else
            {
                int idx = 0;
                foreach (var kvp in entityMap)
                {
                    liveFrame.entities[idx++] = kvp.Value;
                }
            }
        }

        public TerrainData ReadTerrain() => Read<TerrainData>("afTerrain");
        public HudData ReadHud() => Read<HudData>("afHud");
        public Catalog ReadCatalog() => Read<Catalog>("afCatalog");
        public Details ReadDetails(int id) => Read<Details>("afDetails", id);
        public Placement Preview(string type, float x, float y, int rotation) => Read<Placement>("afPlacement", type, (double)x, (double)y, rotation);
        public PartyView Party(int[] ids, string kind) => Read<PartyView>("afParty", Json(ids), kind);
        public bool Command(string command, params object[] args)
        {
            bool res = engine.Invoke("afCommand", command, Json(args)).AsBoolean();
            if (command == "reset") ResetDelta();
            return res;
        }
        public bool GenerateWorld(string size = "medium", int seed = 1, object options = null) => options != null ? Command("generateWorld", size, seed, options) : Command("generateWorld", size, seed);
        public void BeginWorldGeneration(string size, int seed, object options = null)
        {
            if (options != null) engine.Invoke("afBeginWorld", size, seed, Json(options));
            else engine.Invoke("afBeginWorld", size, seed);
        }
        public WorldGenerationProgress AdvanceWorldGeneration() => JsonUtility.FromJson<WorldGenerationProgress>(engine.Invoke("afAdvanceWorld").AsString());
        public bool LoadSurvMap(string json) => Command("loadSurvMap", json);
        public bool LoadOutpostMap() => Command("loadOutpostMap");
        public bool SetSeason(string season) => Command("setSeason", season);
        public bool SetDifficulty(string difficulty) => Command("setDifficulty", difficulty);
        public string Serialize() => engine.Invoke("afSave").AsString();
        public string RestoreError(string json) => engine.Invoke("afRestoreError", json).AsString();
        public bool Restore(string json)
        {
            bool res = engine.Invoke("afRestore", json).AsBoolean();
            ResetDelta();
            return res;
        }
        T Read<T>(string function, params object[] args) => JsonUtility.FromJson<T>(engine.Invoke(function, args).AsString());
        public static string Json(object value)
        {
            if (value == null) return "null";
            if (value is string s) return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t") + "\"";
            if (value is bool b) return b ? "true" : "false";
            if (value is IEnumerable list)
            {
                var sb = new System.Text.StringBuilder("[");
                bool first = true;
                foreach (var item in list)
                {
                    if (!first) sb.Append(",");
                    sb.Append(Json(item));
                    first = false;
                }
                sb.Append("]");
                return sb.ToString();
            }
            return Convert.ToString(value, CultureInfo.InvariantCulture);
        }
        public void Dispose() => engine.Dispose();
    }

    [Serializable]
    public sealed class WorldGenerationProgress
    {
        public float progress;
        public string activity;
        public bool done;
    }
}
