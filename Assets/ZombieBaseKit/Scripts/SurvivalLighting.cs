// SurvivalLighting.cs - time-of-day colour grade for the kit. Put one in the scene and give sprites a
// material using ZombieBaseKit/GradedSprite. Values match Data/lighting.json (the grade used by the editors).
// Grade: rgb = (luma + (rgb - luma) * sat) * mul + add. Shadow pixels (partial alpha) get alpha * sh and colour shc.
// Glow: the three window-glass colours blend toward warm lamplight after dark (0 by day, 1 at night).
using UnityEngine;

[ExecuteAlways]
public class SurvivalLighting : MonoBehaviour
{
    public enum TimeOfDay { EarlyMorning, Morning, Day, EarlyEvening, Evening, Night, LateNight }

    [Tooltip("Blend smoothly through the day by hour. Off = hold the preset below.")]
    public bool useHour = true;
    [Range(0, 24)] public float hour = 12;
    public TimeOfDay preset = TimeOfDay.Day;

    struct Grade
    {
        public float sat, sh, dark, glow; public Vector3 mul, add, shc;
        public Grade(float sat, Vector3 mul, Vector3 add, float sh, Vector3 shc, float dark, float glow) { this.sat = sat; this.mul = mul; this.add = add; this.sh = sh; this.shc = shc / 255f; this.dark = dark; this.glow = glow; }
        public static Grade Lerp(Grade a, Grade b, float t) => new Grade(Mathf.Lerp(a.sat, b.sat, t), Vector3.Lerp(a.mul, b.mul, t), Vector3.Lerp(a.add, b.add, t), Mathf.Lerp(a.sh, b.sh, t), Vector3.Lerp(a.shc, b.shc, t) * 255f, Mathf.Lerp(a.dark, b.dark, t), Mathf.Lerp(a.glow, b.glow, t));
    }

    // dark = how strongly hand-held lights (torch, flashlight) should read at this time.
    static readonly Grade[] Presets =
    {
        new Grade(0.72f, new Vector3(0.80f, 0.76f, 0.88f), new Vector3(0.07f, 0.04f, 0.06f), 0.65f, new Vector3(34, 26, 48), 0.45f, 0.35f),
        new Grade(0.98f, new Vector3(1.04f, 0.97f, 0.84f), new Vector3(0.04f, 0.02f, 0.00f), 0.90f, new Vector3(26, 18, 20), 0f, 0f),
        new Grade(1.00f, Vector3.one, Vector3.zero, 1.00f, new Vector3(10, 8, 12), 0f, 0f),
        new Grade(1.06f, new Vector3(1.10f, 0.90f, 0.70f), new Vector3(0.05f, 0.02f, 0.00f), 1.10f, new Vector3(40, 18, 26), 0.3f, 0.2f),
        new Grade(0.72f, new Vector3(0.74f, 0.58f, 0.72f), new Vector3(0.05f, 0.02f, 0.07f), 0.80f, new Vector3(30, 14, 40), 0.75f, 0.7f),
        new Grade(0.45f, new Vector3(0.34f, 0.42f, 0.62f), new Vector3(0.01f, 0.02f, 0.05f), 0.60f, new Vector3(4, 8, 22), 1f, 1f),
        new Grade(0.30f, new Vector3(0.22f, 0.26f, 0.42f), new Vector3(0.00f, 0.01f, 0.03f), 0.50f, new Vector3(2, 4, 14), 1f, 0.8f),
    };
    // Hour each preset peaks at, in order; late night wraps past midnight.
    static readonly float[] Hours = { 5.5f, 8f, 12f, 17.5f, 19.5f, 22f, 26f };

    [Tooltip("Scales window glow everywhere. Per sprite, set _GlowScale on its material (0 = lights off).")]
    [Range(0, 1)] public float windowGlow = 1;

    public float Darkness { get; private set; }
    public float Glow { get; private set; }

    Grade Current()
    {
        if (!useHour) return Presets[(int)preset];
        float h = hour < Hours[0] ? hour + 24 : hour;
        for (int i = 0; i < Hours.Length; i++)
        {
            float h0 = Hours[i], h1 = i + 1 < Hours.Length ? Hours[i + 1] : Hours[0] + 24;
            if (h >= h0 && h < h1) return Grade.Lerp(Presets[i], Presets[(i + 1) % Presets.Length], Mathf.SmoothStep(0, 1, (h - h0) / (h1 - h0)));
        }
        return Presets[2];
    }

    void Update()
    {
        var g = Current();
        Darkness = g.dark;
        Glow = g.glow * windowGlow;
        Shader.SetGlobalFloat("_KitGlow", Glow);
        // Stored as offsets from "day" so the shader renders ungraded when no controller is present.
        Shader.SetGlobalFloat("_KitDesat", 1 - g.sat);
        Shader.SetGlobalVector("_KitMulOff", Vector3.one - g.mul);
        Shader.SetGlobalVector("_KitAdd", g.add);
        Shader.SetGlobalFloat("_KitShadowOff", 1 - g.sh);
        Shader.SetGlobalVector("_KitShadowColOff", g.shc - new Vector3(10, 8, 12) / 255f);
    }

    void OnDisable()
    {
        Shader.SetGlobalFloat("_KitGlow", 0); Shader.SetGlobalFloat("_KitDesat", 0); Shader.SetGlobalVector("_KitMulOff", Vector4.zero); Shader.SetGlobalVector("_KitAdd", Vector4.zero);
        Shader.SetGlobalFloat("_KitShadowOff", 0); Shader.SetGlobalVector("_KitShadowColOff", Vector4.zero);
    }
}
