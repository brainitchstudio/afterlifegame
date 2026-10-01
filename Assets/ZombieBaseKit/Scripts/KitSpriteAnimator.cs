// KitSpriteAnimator.cs - plays a sliced kit sheet on a SpriteRenderer.
// Drag every sub-sprite of a sheet into Frames (they sort by name into row-major order).
// Walk sheets: 4 columns x 8 rows, rows s, n, e, w, se, sw, ne, nw. Call Face(velocity).
// Gunfire sheets: N columns x 16 rows, row i fires at i * 22.5 deg clockwise from east. Call Aim(direction).
using UnityEngine;

[RequireComponent(typeof(SpriteRenderer))]
public class KitSpriteAnimator : MonoBehaviour
{
    public Sprite[] frames;
    public int columns = 4;
    public float fps = 6;
    public bool loop = true;
    public int row;
    [Tooltip("Optional. When set, sortingOrder follows the feet so characters sort against map objects.")]
    public SurvivalMapLoader map;

    SpriteRenderer sr;
    float t;
    static readonly int[] OctantToRow = { 2, 4, 0, 5, 3, 7, 1, 6 }; // e, se, s, sw, w, nw, n, ne

    void Awake() { sr = GetComponent<SpriteRenderer>(); }

    void OnValidate()
    {
        if (frames != null) System.Array.Sort(frames, (a, b) => a && b ? string.CompareOrdinal(a.name, b.name) : 0);
    }

    static float ScreenAngle(Vector2 v) { float a = Mathf.Atan2(-v.y, v.x) * Mathf.Rad2Deg; return (a % 360 + 360) % 360; }

    public void Face(Vector2 v)
    {
        if (v.sqrMagnitude < 1e-6f) return;
        row = OctantToRow[Mathf.RoundToInt(ScreenAngle(v) / 45f) % 8];
    }

    public void Aim(Vector2 v, int rows = 16)
    {
        if (v.sqrMagnitude < 1e-6f) return;
        row = Mathf.RoundToInt(ScreenAngle(v) / (360f / rows)) % rows;
    }

    public void Restart() { t = 0; }

    void Update()
    {
        if (!sr || frames == null || frames.Length == 0) return;
        t += Time.deltaTime;
        int f = (int)(t * fps);
        f = loop ? f % columns : Mathf.Min(f, columns - 1);
        int i = row * columns + f;
        if (i < frames.Length) sr.sprite = frames[i];
        if (map && map.Data != null)
        {
            float localY = transform.position.y - map.transform.position.y;
            sr.sortingOrder = Mathf.RoundToInt((map.Data.height - localY) * map.Data.tileSize);
        }
    }
}
