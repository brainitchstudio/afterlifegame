using System;
using System.Collections.Generic;
using UnityEngine;

namespace Afterlife
{
    /// <summary>
    /// Procedural retro sound synthesizer for Afterlife.
    /// Generates punchy chiptune audio clips dynamically in memory without external audio assets.
    /// </summary>
    public sealed class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Range(0f, 1f)] public float volume = 0.6f;
        public bool sfxEnabled = true;

        AudioSource sfxSource;
        AudioSource loopSource;

        readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        const int SampleRate = 22050;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
            sfxEnabled = PlayerPrefs.GetInt("Afterlife.Sound", 1) != 0;

            sfxSource = gameObject.AddComponent<AudioSource>();
            sfxSource.playOnAwake = false;
            sfxSource.spatialBlend = 0f; // 2D sound

            loopSource = gameObject.AddComponent<AudioSource>();
            loopSource.playOnAwake = false;
            loopSource.spatialBlend = 0f;
            loopSource.loop = true;

            GenerateClips();
        }

        void GenerateClips()
        {
            clips["click"] = MakeClickClip();
            clips["build"] = MakeBuildClip();
            clips["shoot"] = MakeShootClip();
            clips["hit"] = MakeHitClip();
            clips["repair"] = MakeRepairClip();
            clips["heal"] = MakeHealClip();
            clips["alarm"] = MakeAlarmClip();
            clips["dawn"] = MakeDawnClip();
            clips["dusk"] = MakeDuskClip();
            clips["defeat"] = MakeDefeatClip();
            clips["victory"] = MakeVictoryClip();
            clips["bash"] = MakeBashClip();
            clips["groan"] = MakeGroanClip();
        }

        static AudioClip CreateClip(string name, float duration, Func<float, float> waveGen)
        {
            int totalSamples = Mathf.CeilToInt(duration * SampleRate);
            float[] samples = new float[totalSamples];
            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / SampleRate;
                samples[i] = Mathf.Clamp(waveGen(t), -1f, 1f);
            }
            var clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        // Snappy UI click
        static AudioClip MakeClickClip()
        {
            return CreateClip("Click", 0.035f, t =>
            {
                float env = Mathf.Exp(-t * 120f);
                float wave = Mathf.Sin(2f * Mathf.PI * 1400f * t);
                return wave * env * 0.4f;
            });
        }

        // Thump + wood hammer knock
        static AudioClip MakeBuildClip()
        {
            return CreateClip("Build", 0.16f, t =>
            {
                float env1 = Mathf.Exp(-t * 40f);
                float f1 = Mathf.Lerp(220f, 90f, t / 0.16f);
                float knock1 = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * f1 * t)) * env1 * 0.5f;

                float t2 = Mathf.Max(0f, t - 0.06f);
                float env2 = Mathf.Exp(-t2 * 50f);
                float f2 = Mathf.Lerp(300f, 120f, t2 / 0.10f);
                float knock2 = (Mathf.Sin(2f * Mathf.PI * f2 * t2) > 0f ? 1f : -1f) * env2 * 0.4f;

                return (knock1 + knock2) * 0.6f;
            });
        }

        // Gunfire crack and noise burst
        static AudioClip MakeShootClip()
        {
            var rand = new System.Random(1337);
            return CreateClip("Shoot", 0.12f, t =>
            {
                float env = Mathf.Exp(-t * 35f);
                float freq = Mathf.Lerp(900f, 180f, t / 0.12f);
                float tonal = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * freq * t)) * 0.4f;
                float noise = ((float)rand.NextDouble() * 2f - 1f) * 0.6f;
                return (tonal + noise) * env * 0.7f;
            });
        }

        // Zombie damage / blunt hit
        static AudioClip MakeHitClip()
        {
            var rand = new System.Random(42);
            return CreateClip("Hit", 0.14f, t =>
            {
                float env = Mathf.Exp(-t * 28f);
                float freq = Mathf.Lerp(160f, 50f, t / 0.14f);
                float wave = Mathf.Sin(2f * Mathf.PI * freq * t);
                float crunch = ((float)rand.NextDouble() * 2f - 1f) * 0.35f;
                return (wave * 0.65f + crunch) * env * 0.6f;
            });
        }

        // Repair hammer metallic ping
        static AudioClip MakeRepairClip()
        {
            return CreateClip("Repair", 0.14f, t =>
            {
                float env = Mathf.Exp(-t * 30f);
                float tone = Mathf.Sin(2f * Mathf.PI * 720f * t) * 0.6f + Mathf.Sin(2f * Mathf.PI * 1440f * t) * 0.4f;
                return tone * env * 0.5f;
            });
        }

        // Uplifting medic chime
        static AudioClip MakeHealClip()
        {
            return CreateClip("Heal", 0.28f, t =>
            {
                float freq = t < 0.14f ? 523.25f : 659.25f; // C5 -> E5
                float subT = t < 0.14f ? t : (t - 0.14f);
                float env = Mathf.Exp(-subT * 18f);
                float wave = Mathf.Sin(2f * Mathf.PI * freq * t) + 0.3f * Mathf.Sin(2f * Mathf.PI * freq * 2f * t);
                return wave * env * 0.35f;
            });
        }

        // Emergency alarm warble
        static AudioClip MakeAlarmClip()
        {
            return CreateClip("Alarm", 0.32f, t =>
            {
                float freq = (t % 0.16f < 0.08f) ? 587.33f : 440f; // D5 / A4 warble
                float env = Mathf.Sin(Mathf.PI * Mathf.Clamp01(t / 0.32f));
                float wave = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * freq * t));
                return wave * env * 0.4f;
            });
        }

        // Dawn chime (C -> G -> C)
        static AudioClip MakeDawnClip()
        {
            return CreateClip("Dawn", 0.45f, t =>
            {
                float freq = t < 0.15f ? 523.25f : (t < 0.3f ? 783.99f : 1046.50f);
                float subT = t % 0.15f;
                float env = Mathf.Exp(-subT * 12f);
                return Mathf.Sin(2f * Mathf.PI * freq * t) * env * 0.35f;
            });
        }

        // Dusk warning chime (E -> C -> A low)
        static AudioClip MakeDuskClip()
        {
            return CreateClip("Dusk", 0.50f, t =>
            {
                float freq = t < 0.16f ? 659.25f : (t < 0.33f ? 523.25f : 440.00f);
                float subT = t % 0.16f;
                float env = Mathf.Exp(-subT * 10f);
                return (Mathf.Sin(2f * Mathf.PI * freq * t) * 0.8f + Mathf.Sin(2f * Mathf.PI * freq * 0.5f * t) * 0.3f) * env * 0.4f;
            });
        }

        // Game over fall
        static AudioClip MakeDefeatClip()
        {
            return CreateClip("Defeat", 0.8f, t =>
            {
                float freq = Mathf.Lerp(300f, 65f, t / 0.8f);
                float env = Mathf.Exp(-t * 4f);
                float wave = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * freq * t));
                return wave * env * 0.45f;
            });
        }

        // Victory fanfare
        static AudioClip MakeVictoryClip()
        {
            return CreateClip("Victory", 0.7f, t =>
            {
                float[] notes = { 523.25f, 659.25f, 783.99f, 1046.50f };
                int idx = Mathf.Min(3, Mathf.FloorToInt(t / 0.175f));
                float subT = t % 0.175f;
                float env = Mathf.Exp(-subT * 8f);
                return Mathf.Sin(2f * Mathf.PI * notes[idx] * t) * env * 0.4f;
            });
        }

        // Zombie wall/gate barricade impact bash
        static AudioClip MakeBashClip()
        {
            var rand = new System.Random(88);
            return CreateClip("Bash", 0.16f, t =>
            {
                float env = Mathf.Exp(-t * 22f);
                float freq = Mathf.Lerp(120f, 35f, t / 0.16f);
                float sub = Mathf.Sin(2f * Mathf.PI * freq * t) * 0.7f;
                float splinter = ((float)rand.NextDouble() * 2f - 1f) * 0.5f;
                return (sub + splinter) * env * 0.75f;
            });
        }

        // Low zombie moan / swarm roar
        static AudioClip MakeGroanClip()
        {
            return CreateClip("Groan", 0.45f, t =>
            {
                float env = Mathf.Sin(Mathf.PI * Mathf.Clamp01(t / 0.45f));
                float wobble = Mathf.Sin(2f * Mathf.PI * 5f * t) * 15f;
                float freq = 80f + wobble;
                float wave = Mathf.Sign(Mathf.Sin(2f * Mathf.PI * freq * t)) * 0.5f;
                float sub = Mathf.Sin(2f * Mathf.PI * (freq * 0.5f) * t) * 0.5f;
                return (wave + sub) * env * 0.4f;
            });
        }

        public void Play(string name, float pitch = 1f, float volumeScale = 1f)
        {
            if (!sfxEnabled || sfxSource == null) return;
            if (clips.TryGetValue(name, out var clip))
            {
                sfxSource.pitch = Mathf.Clamp(pitch, 0.5f, 2f);
                sfxSource.PlayOneShot(clip, volume * volumeScale);
            }
        }

        public void PlayClick() => Play("click", UnityEngine.Random.Range(0.95f, 1.05f), 0.7f);
        public void PlayBuild() => Play("build", UnityEngine.Random.Range(0.95f, 1.05f), 1f);
        public void PlayShoot() => Play("shoot", UnityEngine.Random.Range(0.92f, 1.08f), 0.9f);
        public void PlayHit() => Play("hit", UnityEngine.Random.Range(0.90f, 1.10f), 0.8f);
        public void PlayRepair() => Play("repair", UnityEngine.Random.Range(0.95f, 1.05f), 0.8f);
        public void PlayHeal() => Play("heal", 1f, 0.9f);
        public void PlayAlarm() => Play("alarm", 1f, 1f);
        public void PlayDawn() => Play("dawn", 1f, 0.9f);
        public void PlayDusk() => Play("dusk", 1f, 0.9f);
        public void PlayZombieBash() => Play("bash", UnityEngine.Random.Range(0.85f, 1.15f), 0.85f);
        public void PlayZombieGroan() => Play("groan", UnityEngine.Random.Range(0.85f, 1.15f), 0.75f);
        public void PlayOutcome(bool won) => Play(won ? "victory" : "defeat", 1f, 1f);

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
            foreach (var clip in clips.Values) if (clip) Destroy(clip);
            clips.Clear();
        }

        public void ToggleSound()
        {
            sfxEnabled = !sfxEnabled;
            PlayerPrefs.SetInt("Afterlife.Sound", sfxEnabled ? 1 : 0);
            PlayerPrefs.Save();
        }
    }
}
