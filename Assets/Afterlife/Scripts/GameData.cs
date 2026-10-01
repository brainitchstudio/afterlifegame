using System;

namespace Afterlife
{
    // Small serializable boundary types; the original simulation remains the authority.
    [Serializable] public class ModuleBundle { public ModuleSource[] modules; }
    [Serializable] public class ModuleSource { public string name, source; }
    [Serializable] public class AtlasManifest { public int width, height; public float[] fireAnchor; public AtlasEntry[] entries; }
    [Serializable] public class AtlasEntry { public string key; public int x, y, w, h; public float ax, ay; }
    [Serializable] public class WorldRect { public float left, right, top, bottom; }
    [Serializable] public class EntityView
    {
        public int id, level, targetId, shift, post;
        public string kind, type, name, sprite, role, task, condition, gear, side;
        public float x, y, groundY, hp, maxHP, width, height, facing;
        public bool hidden, away, stationed, downed, fighting, burning;
    }
    [Serializable] public class EffectView { public string type; public float x, y, tx, ty, life, maxLife; }
    [Serializable]
    public class DeltaFrame
    {
        public float elapsed, hour, wood, metal, food;
        public int day, capacity, kills, landRevision;
        public string phase, status, incoming, director, season;
        public bool alarm;
        public WorldRect territory;
        public EffectView[] effects;
        public int[] removed;
        public EntityView[] added;
        public float[] u;
        public int[] scavengedPois;
    }
    [Serializable]
    public class Frame
    {
        public float elapsed, hour, wood, metal, food;
        public int day, capacity, kills, landRevision;
        public string phase, status, incoming, director, season;
        public bool alarm;
        public WorldRect territory;
        public EntityView[] entities;
        public EffectView[] effects;
        public int survivorCount;
        public int zombieCount;
        public int[] scavengedPois;
    }
    [Serializable] public class Parcel { public int col, row; }
    [Serializable] public class TreeView { public float x, y, scale, alpha; public int kind; }
    [Serializable] public class MapPoiView { public int id; public string type, name, label; public float x, y; public int r; public bool scavenged; }
    [Serializable] public class MapPropView { public string key, k, anchor; public float x, y, order; }
    [Serializable] public class MapBuildingView { public string key, k; public float x, y, order, fw, fh; }
    [Serializable]
    public class TerrainData
    {
        public Parcel[] land, frontier;
        public TreeView[] trees;
        public MapPoiView[] pois;
        public MapPropView[] decor;
        public MapBuildingView[] worldBuildings;
        public string[] ground;
        public string season;
        public int mapWidth, mapHeight;
        public float originX, originY;
    }
    [Serializable] public class Rates { public float wood, metal, food; }
    [Serializable] public class GameEvent { public string title, message, tone; }
    [Serializable] public class Candidate { public int id; public string name, label, stats; public float expires; }
    [Serializable] public class WeaponView { public string id, name, cost; public int count; public bool enabled; }
    [Serializable]
    public class HudData
    {
        public string[] warnings;
        public GameEvent[] events;
        public Rates rates;
        public int freeBeds, partyCap;
        public float recruitTimer;
        public string recruitCost, landCost, repairAllCost, trader;
        public bool broadcasting, sheltered, tradeEnabled;
        public Candidate[] candidates;
        public WeaponView[] weapons;
    }
    [Serializable] public class Catalog { public BuildingOption[] buildings; public ExpeditionOption[] expeditions; public MapPoiView[] pois; }
    [Serializable] public class BuildingOption { public string id, name, description, cost, sprite; }
    [Serializable] public class ExpeditionOption { public string id, name, description, cost, reward; public float hours, risk; }
    [Serializable] public class PersonOption { public int id, level; public string name, description, role; public bool enabled; }
    [Serializable] public class UpgradeOption { public string id, name, description, cost, requires, parentName; public bool owned, enabled; public int buildingId; public string buildingType; }
    [Serializable] public class Details
    {
        public int id, shelter, slots, beds, shelteredCount;
        public float hp, maxHP;
        public string kind, type, name, description, repairCost, side, icon, color, tier, output, demolishRefund;
        public string roleName, roleDescription;
        public bool repairEnabled, demolish, away, attackEnabled, staffed, isShelteringHere;
        public string[] residents;
        public UpgradeOption[] upgrades;
        public PersonOption[] staff, assignable, posts;
        public WeaponView[] armory;

        // Survivor extended dossier fields
        public string role, job, jobName, condition, task, gear, weaponName, shiftName, postName, expedition;
        public int level, shift, post, buildingId;
        public float xp, xpNeeded, bleed;
        public float weaponDamage, weaponRange, weaponCooldown;
        public bool weaponIsMelee, sheltered;
        public int str, agi, end, intel, cha;
        public string primaryStat, secondaryStat, weakStat;
    }
    [Serializable] public class Placement { public string type; public float x, y; public int rotation; public bool ok; public string reason, sprite; }
    [Serializable] public class PartyView { public string reason, cost; public float risk; public PersonOption[] members; }
}
