//  ShaderTypes.h
//  The one struct the CPU and the GPU both have to agree on.
//
//  Every field here is a `float` or an `int32_t` and the struct is padded to a
//  16-byte multiple by hand, so Swift's memory layout and MSL's are the same
//  without either side guessing. simd_float3 is 16-byte aligned in both, which
//  is why the three ramp stops sit at the end where the padding is free.

#ifndef ShaderTypes_h
#define ShaderTypes_h

#include <simd/simd.h>

typedef struct {
    simd_float2 res;      // render target size in pixels
    float pixelScale;     // renderWidth / outputWidth — grain is sized in OUTPUT pixels
    float seed;

    int32_t shape;
    int32_t tex;
    int32_t invert;
    int32_t chroma;

    float scale, angle, soft, warp;
    float detail, mottle, posX, posY;

    float exposure, contrast, black, gamma;
    float vignette, gloss;

    float texAmt, texScale;

    float grain, gSize, gDens, gResp;

    float bands, blur, streak, streakAng;

    float mid;
    float _pad0, _pad1, _pad2;

    // Big exports render in tiles, so `res` stays the FULL output size (uv,
    // aspect and grain must all be computed against the whole picture) and this
    // says which corner of it the current tile starts at.
    simd_float2 tileOrigin;
    simd_float2 _tilePad;

    simd_float3 c0;
    simd_float3 c1;
    simd_float3 c2;
} PlateUniforms;

#endif /* ShaderTypes_h */
