//  Plate.metal
//  A line-for-line port of src/shaders/plate.frag.glsl from the web app.
//
//  Two deliberate differences from the GLSL, both required for the pictures to
//  come out identical rather than merely similar:
//
//  1. Metal's [[position]] has its origin at the TOP-left; GL's gl_FragCoord is
//     bottom-left. Several fields are asymmetric in y (Limb's half-width grows
//     with p.y), so the y axis is flipped once at the top of the fragment and
//     `frag` is used everywhere the GLSL said gl_FragCoord.
//  2. MSL has no radians(), so radiansOf() stands in.
//
//  Everything else — the hash constants, the loop counts, the magic numbers —
//  is verbatim on purpose. If the web shader changes, this changes with it.

#include <metal_stdlib>
#include "ShaderTypes.h"

using namespace metal;

constexpr constant float kDegToRad = 0.017453292519943295;
static inline float radiansOf(float d) { return d * kDegToRad; }

static inline float2x2 rot(float a) {
    float s = sin(a), c = cos(a);
    return float2x2(c, -s, s, c);          // same column-major layout as GLSL mat2
}

static inline float h21(float2 p) {
    float3 q = fract(float3(p.x, p.y, p.x) * float3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

static inline float vn(float2 p) {
    float2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i), b = h21(i + float2(1, 0)), c = h21(i + float2(0, 1)), d = h21(i + float2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

static inline float fbm(float2 p, constant PlateUniforms &u) {
    float s = 0.0, a = 0.5, t = 0.0;
    for (int i = 0; i < 6; i++) {
        float w = clamp(u.detail - float(i), 0.0, 1.0);
        s += a * w * vn(p); t += a * w;
        p = rot(0.7) * p * 2.03 + 13.7; a *= 0.55;
    }
    return s / max(t, 1e-4);
}

static float field(float2 p, float2 sv, constant PlateUniforms &u) {
    float L;

    if (u.shape == 0) {                                   // Limb — soft lit column
        float cx = 0.20 * sin(p.y * 1.7 + sv.x) + 0.08 * sin(p.y * 3.6 + sv.y);
        float hw = 0.30 + 0.10 * p.y + 0.05 * sin(p.y * 2.6 + sv.x);
        float d  = abs(p.x - cx) - max(hw, 0.03);
        float m  = 1.0 / (1.0 + exp(clamp(d * (9.0 / max(u.soft, 0.03)), -40.0, 40.0)));
        float lat = (p.x - cx) / max(hw, 1e-3);
        L = m * mix(0.05, 1.0, smoothstep(-1.25, 0.85, lat));
    } else if (u.shape == 1) {                            // Shaft — directional beam
        float uu = p.x, sp = max(u.soft * 0.75, 0.05);
        L  = exp(-pow(max((uu + 0.30) / sp, 0.0), 1.45));
        L += 0.22 * exp(-pow(abs(uu + 0.72) / (sp * 1.3), 2.0));
        L *= 0.94;
    } else if (u.shape == 2) {                            // Satin — folded wave bands
        float2 q = p * 3.0 + sv;
        float w = fbm(q * 0.22, u);
        q += (u.warp * 2.2) * (float2(w, fbm(q * 0.22 + 7.3, u)) - 0.5);
        L = 0.5 + 0.5 * sin((q.x * 1.6 + q.y * 1.05 + w * 4.0) * max(u.bands * 0.5, 0.25));
    } else if (u.shape == 3) {                            // Dune — ridged drifts
        float2 q = p * float2(1.0, 0.40) * 2.2 + sv;
        q += u.warp * 1.4 * (float2(fbm(q * 0.35, u), fbm(q * 0.35 + 3.1, u)) - 0.5);
        float r = 0.0, a = 0.6, t = 0.0;
        for (int i = 0; i < 5; i++) {
            float w = clamp(u.detail - float(i), 0.0, 1.0);
            r += a * w * (1.0 - abs(2.0 * vn(q) - 1.0)); t += a * w;
            q = rot(0.35) * q * 1.9; a *= 0.5;
        }
        L = pow(clamp(r / max(t, 1e-4), 0.0, 1.0), 1.4);
    } else if (u.shape == 4) {                            // Plume — drifting smoke
        float2 q = p * 2.6 + sv;
        q += u.warp * 2.4 * (float2(fbm(q * 0.8, u), fbm(q * 0.8 + 4.2, u)) - 0.5);
        float n = fbm(q, u);
        float mask = smoothstep(0.80, 0.06, length(p * float2(0.90, 0.75)));
        L = clamp(n * 1.75 * mask, 0.0, 1.0);
    } else if (u.shape == 5) {                            // Orb — lit sphere
        float2 q = p * 1.9;
        float r = length(q);
        float z = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
        float3 n = float3(q, z + 1e-3);
        n.xy += u.warp * 0.35 * (float2(fbm(q * 2.2 + sv, u), fbm(q * 2.2 + sv + 9.1, u)) - 0.5);
        n = normalize(n);
        float lam = max(dot(n, normalize(float3(-0.55, 0.5, 0.62))), 0.0);
        float edge = 1.0 / (1.0 + exp(clamp((r - 1.0) * (9.0 / max(u.soft, 0.03)), -40.0, 40.0)));
        L = pow(lam, 1.35) * edge + 0.07 * exp(-max(r - 1.0, 0.0) * 4.0);
    } else if (u.shape == 6) {                            // Chrome — liquid metal contours
        float2 q = p * 2.0 + sv;
        float2 w1 = float2(vn(q * 0.9), vn(q * 0.9 + float2(5.2, 1.3))) - 0.5;
        float2 w2 = float2(vn(q * 1.9 + 3.0 * w1), vn(q * 1.9 + 3.0 * w1 + float2(8.3, 2.8))) - 0.5;
        float f = fbm(q + u.warp * 3.4 * w1 + u.warp * 1.6 * w2, u);
        L = 0.5 + 0.5 * sin((f * 2.0 - 1.0) * max(u.bands, 0.4) * 3.14159);
    } else {                                              // Bloom — soft merging blobs
        float acc = 0.0;
        float2 wq = p * 1.6 + sv;
        float2 wp = p + u.warp * 0.55 * (float2(fbm(wq, u), fbm(wq + float2(4.9, 2.2), u)) - 0.5);
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float2 c = float2(sin(sv.x * 1.3 + fi * 2.13) * 0.52, cos(sv.y * 1.1 + fi * 1.71) * 0.66);
            float rr = 0.30 + 0.20 * sin(sv.x * 1.7 + fi * 3.31);
            float2 dv = (wp - c) * float2(1.0, 0.78);
            acc += rr * rr / max(dot(dv, dv), 2e-3);
        }
        L = smoothstep(0.45, 2.1, acc);
    }

    L *= mix(1.0, 0.45 + 1.05 * fbm(p * 1.5 + sv * 0.3, u), u.mottle);
    return L;
}

// Blur happens in scene units on the FIELD, not on pixels, which is why a 4K
// export and a 400px preview agree about how soft an edge is.
static float plateValue(float2 p, float2 sv, constant PlateUniforms &u) {
    if (u.blur < 0.002) return field(p, sv, u);
    float r = u.blur * 0.42 / max(u.scale, 0.05);
    float a = radiansOf(u.streakAng - u.angle);
    float2 dir = float2(cos(a), sin(a)), per = float2(-dir.y, dir.x);
    float s = 0.0, wt = 0.0;
    for (int i = 0; i < 9; i++) {
        float fi = float(i) + 0.5;
        float ang = fi * 2.39996, rad = sqrt(fi / 9.0);
        float2 k = float2(cos(ang), sin(ang)) * rad;
        float2 off = (dir * k.x * (1.0 + u.streak * 6.0) + per * k.y * (1.0 - 0.85 * u.streak)) * r;
        float w = 1.0 - 0.45 * rad;
        s += w * field(p + off, sv, u); wt += w;
    }
    s += 1.7 * field(p, sv, u); wt += 1.7;
    return s / wt;
}

struct VertexOut {
    float4 position [[position]];
};

// One full-screen triangle, no vertex buffer — same gl_VertexID trick the web
// app uses.
vertex VertexOut plateVertex(uint vid [[vertex_id]]) {
    float2 p = float2(float((vid << 1) & 2), float(vid & 2));
    VertexOut out;
    out.position = float4(p * 2.0 - 1.0, 0.0, 1.0);
    return out;
}

fragment float4 plateFragment(VertexOut in [[stage_in]],
                              constant PlateUniforms &u [[buffer(0)]]) {
    // Position within the FULL output image, then flipped in y so this is
    // gl_FragCoord exactly (see the header comment). Both steps matter: the
    // tile offset makes a strip of a 4K export identical to the same strip of
    // a one-shot render, and the flip keeps asymmetric fields upright.
    float2 full = float2(in.position.x, in.position.y) + u.tileOrigin;
    float2 frag = float2(full.x, u.res.y - full.y);

    float2 uv = frag / u.res;
    float asp = u.res.x / u.res.y;
    float2 p = (uv - 0.5) * float2(asp, 1.0) / max(min(asp, 1.0), 1e-3);
    p = rot(radiansOf(u.angle)) * p;
    p = p / max(u.scale, 0.05) - float2(u.posX, u.posY);

    float2 sv = float2(u.seed * 37.1, u.seed * -21.7);
    float L = plateValue(p, sv, u);

    float2 tp = rot(radiansOf(u.angle + 35.0)) * (uv - 0.5) * float2(asp, 1.0)
              / max(min(asp, 1.0), 1e-3) * max(u.texScale, 0.05);

    if (u.tex > 0 && u.tex < 4) {
        float t = 0.0;
        if (u.tex == 1) {                                  // Dash
            float2 c = fract(tp * 20.0 + float2(0.0, floor(tp.x * 20.0) * 0.5)) - 0.5;
            float perp  = abs(dot(c, float2(-0.707, 0.707)));
            float along = abs(dot(c, float2( 0.707, 0.707)));
            t = 1.35 * smoothstep(0.15, 0.03, perp) * smoothstep(0.46, 0.24, along) - 0.18;
        } else if (u.tex == 2) {                           // Brush
            t = (vn(float2(tp.x * 150.0, tp.y * 4.0)) - 0.5) * 2.0;
        } else {                                           // Weave
            t = sin(tp.x * 40.0) * sin(tp.y * 40.0) * 0.85;
        }
        L *= 1.0 + u.texAmt * t * 0.5;
    }

    L = L * exp2(u.exposure);
    L = clamp((L - u.black) / max(1e-3, 1.0 - u.black), 0.0, 1.0);
    L = pow(L, max(u.gamma, 0.05));
    L = clamp((L - 0.45) * u.contrast + 0.45, 0.0, 1.0);
    if (u.gloss > 0.001) {
        float gw = mix(0.5, 0.035, u.gloss);
        L = mix(L, smoothstep(0.5 - gw, 0.5 + gw, L), min(u.gloss * 1.35, 1.0));
    }
    L *= mix(1.0, smoothstep(1.45, 0.30, length((uv - 0.5) * float2(asp, 1.0) * 2.0)), u.vignette);
    if (u.invert == 1) L = 1.0 - L;

    if (u.tex == 4) {                                      // Dots — a halftone screen
        float2 c = fract(tp * 100.0) - 0.5;
        float rr = length(c) * 1.95;
        float rad = clamp(sqrt(L), 0.0, 1.0) * 1.02;
        float dotv = smoothstep(rad + 0.16, rad - 0.16, rr);
        L = mix(L, mix(dotv, L, 0.18), clamp(u.texAmt, 0.0, 1.0));
    }

    float3 col = L < u.mid
        ? mix(u.c0, u.c1, L / max(u.mid, 1e-3))
        : mix(u.c1, u.c2, (L - u.mid) / max(1.0 - u.mid, 1e-3));

    // Grain cells are sized in OUTPUT pixels, so a preview shows the grain the
    // export will actually have rather than the grain of a smaller image.
    float cell = max(u.gSize * u.pixelScale, 0.35);
    float2 gp = floor(frag / cell);
    float n1 = h21(gp + u.seed * 13.1);
    float n2 = h21(gp * 1.37 + float2(91.7, 17.3) + u.seed * 7.3);
    float present = step(1.0 - u.gDens, n2);
    float lum = dot(col, float3(0.299, 0.587, 0.114));
    float resp = mix(1.0, (4.0 * lum * (1.0 - lum)) * 0.95 + 0.12, u.gResp);
    float amt = u.grain * present * resp;
    float3 g = (u.chroma == 1)
        ? float3(n1, h21(gp + float2(5.2, 8.1) + u.seed), h21(gp + float2(19.4, 3.7) + u.seed)) - 0.5
        : float3(n1 - 0.5);
    col += g * 2.0 * amt;
    col += (h21(frag + u.seed * 3.0) - 0.5) / 255.0;       // dither the ramp

    return float4(clamp(col, 0.0, 1.0), 1.0);
}
