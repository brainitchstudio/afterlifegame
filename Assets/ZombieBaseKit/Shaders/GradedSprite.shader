// Unlit sprite shader with the kit's time-of-day grade (driven by SurvivalLighting).
// Works with the Built-in pipeline and URP (as an unlit sprite). Grade maths runs in gamma space to match the editors.
Shader "ZombieBaseKit/GradedSprite"
{
    Properties
    {
        [PerRendererData] _MainTex ("Sprite", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _GlowScale ("Window Glow", Range(0,1)) = 1
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "PreviewType"="Plane" "CanUseSpriteAtlas"="True" }
        Cull Off ZWrite Off Lighting Off
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; fixed4 _Color;
            float _KitDesat, _KitShadowOff, _KitGlow, _GlowScale; float3 _KitMulOff, _KitAdd, _KitShadowColOff;
            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; };
            v2f vert (appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv; o.color = v.color * _Color; return o; }
            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv);
                float3 rgb = c.rgb;
                #ifndef UNITY_COLORSPACE_GAMMA
                rgb = LinearToGammaSpace(rgb);
                #endif
                if (c.a < 0.999)
                {
                    // Baked cast shadows are the only partial-alpha pixels.
                    rgb = float3(10, 8, 12) / 255.0 + _KitShadowColOff;
                    c.a = saturate(c.a * (1 - _KitShadowOff));
                }
                else
                {
                    float3 src = rgb;
                    float l = dot(rgb, float3(0.299, 0.587, 0.114));
                    rgb = saturate((l + (rgb - l) * (1 - _KitDesat)) * (1 - _KitMulOff) + _KitAdd);
                    // Window glass: three exact colours, each with its own lamplight target.
                    float g = _KitGlow * _GlowScale;
                    if (g > 0)
                    {
                        float3 d0 = abs(src - float3(31, 40, 37) / 255.0), d1 = abs(src - float3(52, 66, 60) / 255.0), d2 = abs(src - float3(86, 106, 96) / 255.0);
                        const float tol = 1.5 / 255.0;
                        if (all(d0 < tol)) rgb = lerp(rgb, float3(150, 96, 40) / 255.0, g);
                        else if (all(d1 < tol)) rgb = lerp(rgb, float3(214, 150, 64) / 255.0, g);
                        else if (all(d2 < tol)) rgb = lerp(rgb, float3(244, 212, 132) / 255.0, g);
                    }
                }
                #ifndef UNITY_COLORSPACE_GAMMA
                rgb = GammaToLinearSpace(rgb);
                #endif
                return fixed4(rgb, c.a) * i.color;
            }
            ENDCG
        }
    }
}
