using System;
using UnityEngine;

namespace Afterlife
{
    /// <summary>
    /// Attached to entity GameObjects in the Hierarchy so developers can inspect,
    /// select, and monitor survivors, buildings, and zombies directly in Unity.
    /// </summary>
    [SelectionBase]
    [DisallowMultipleComponent]
    public sealed class EntityAuthoring : MonoBehaviour
    {
        [Header("Identity")]
        [SerializeField] int entityId;
        [SerializeField] string kind = "";
        [SerializeField] string entityType = "";
        [SerializeField] string displayName = "";

        [Header("Durability & Health")]
        [SerializeField] float health;
        [SerializeField] float maxHealth;
        [SerializeField] int level = 1;
        [SerializeField] bool downed;
        [SerializeField] bool fighting;
        [SerializeField] bool stationed;
        [SerializeField] bool burning;

        [Header("Assignment & Role")]
        [SerializeField] string role = "";
        [SerializeField] string patrolSide = "";
        [SerializeField] string currentTask = "";
        [SerializeField] string condition = "";
        [SerializeField] string equippedGear = "";

        public int Id => entityId;
        public string Kind => kind;
        public string DisplayName => displayName;

        public void UpdateFrom(EntityView e)
        {
            entityId = e.id;
            kind = e.kind ?? "";
            entityType = e.type ?? "";
            displayName = e.name ?? "";
            health = e.hp;
            maxHealth = e.maxHP;
            level = e.level;
            downed = e.downed;
            fighting = e.fighting;
            stationed = e.stationed;
            burning = e.burning;
            role = e.role ?? "";
            patrolSide = e.side ?? "";
            currentTask = e.task ?? "";
            condition = e.condition ?? "";
            equippedGear = e.gear ?? "";
        }
    }
}
