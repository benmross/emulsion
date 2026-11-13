/* ============================== offline video ==============================
   MediaRecorder timestamps frames by wall clock: a plate that renders at 14 fps
   becomes a 14 fps video, however long the loop is meant to be. Here every frame
   is rendered at its exact loop phase, handed to a VideoEncoder with an exact
   timestamp, and muxed into an MP4 by hand — so render speed affects how long
   the export takes and nothing else.

   MP4 rather than WebM because this file's destination is an iPhone, which
   plays neither WebM nor VP9.
*/

const AVC_CODECS = [
  "avc1.640034", "avc1.4D4034", "avc1.640033",
  "avc1.4D4033", "avc1.42E034", "avc1.640028"
];

function canEncodeVideo(){
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function pickAvcConfig(width, height, bitrate, fps){
  if(!canEncodeVideo()) return null;
  for(const codec of AVC_CODECS){
    const cfg = {codec, width, height, bitrate, framerate: fps, avc:{format:"avc"}};
    try {
      const probe = await VideoEncoder.isConfigSupported(cfg);
      if(probe && probe.supported) return cfg;
    } catch(e){ /* try the next profile */ }
  }
  return null;
}

/* ---------- the smallest MP4 that holds one H.264 track ---------- */
const b32 = n => [(n>>>24)&255, (n>>>16)&255, (n>>>8)&255, n&255];
const b16 = n => [(n>>>8)&255, n&255];
const ascii = s => Array.from(s, c => c.charCodeAt(0));

function box(type, ...parts){
  const body = [].concat(...parts);
  return [...b32(body.length + 8), ...ascii(type), ...body];
}
function fullBox(type, version, flags, ...parts){
  return box(type, [version, (flags>>16)&255, (flags>>8)&255, flags&255], ...parts);
}

const MATRIX = [0x00010000,0,0, 0,0x00010000,0, 0,0,0x40000000].flatMap(b32);

function buildMoov({samples, description, width, height, fps, dataOffset}){
  const n = samples.length;
  const timescale = fps * 1000;          // exact for any integer fps
  const delta = 1000;
  const durationTicks = n * delta;
  const movieTimescale = 1000;
  const movieDuration = Math.round(n * 1000 / fps);
  const syncs = [];
  samples.forEach((s,i)=>{ if(s.key) syncs.push(i+1); });

  const avcC = box("avcC", Array.from(description));
  const avc1 = box("avc1",
    [0,0,0,0,0,0], b16(1),                       // reserved, data reference index
    b32(0),                                      // pre_defined(16) + reserved(16)
    b32(0), b32(0), b32(0),                      // pre_defined[3]
    b16(width), b16(height),
    b32(0x00480000), b32(0x00480000),            // 72 dpi
    b32(0), b16(1),                              // reserved, frame count
    new Array(32).fill(0),                       // compressor name
    b16(0x0018), b16(0xFFFF),                    // depth, pre_defined
    avcC
  );

  const stbl = box("stbl",
    fullBox("stsd", 0, 0, b32(1), avc1),
    fullBox("stts", 0, 0, b32(1), b32(n), b32(delta)),
    fullBox("stss", 0, 0, b32(syncs.length), syncs.flatMap(b32)),
    fullBox("stsc", 0, 0, b32(1), b32(1), b32(n), b32(1)),
    fullBox("stsz", 0, 0, b32(0), b32(n), samples.flatMap(s => b32(s.data.byteLength))),
    fullBox("stco", 0, 0, b32(1), b32(dataOffset))
  );

  return box("moov",
    fullBox("mvhd", 0, 0,
      b32(0), b32(0), b32(movieTimescale), b32(movieDuration),
      b32(0x00010000), b16(0x0100), b16(0), b32(0), b32(0),
      MATRIX, new Array(24).fill(0), b32(2)
    ),
    box("trak",
      fullBox("tkhd", 0, 3,
        b32(0), b32(0), b32(1), b32(0), b32(movieDuration),
        b32(0), b32(0), b16(0), b16(0), b16(0), b16(0),
        MATRIX, b32(width << 16), b32(height << 16)
      ),
      box("mdia",
        fullBox("mdhd", 0, 0, b32(0), b32(0), b32(timescale), b32(durationTicks), b16(0x55C4), b16(0)),
        fullBox("hdlr", 0, 0, b32(0), ascii("vide"), b32(0), b32(0), b32(0), ascii("EmulsionVideo\0")),
        box("minf",
          fullBox("vmhd", 0, 1, b16(0), b16(0), b16(0), b16(0)),
          box("dinf", fullBox("dref", 0, 0, b32(1), fullBox("url ", 0, 1))),
          stbl
        )
      )
    )
  );
}

function muxMP4({samples, description, width, height, fps}){
  const ftyp = box("ftyp", ascii("isom"), b32(512), ascii("isomiso2avc1mp41"));
  const mdatSize = samples.reduce((n,s)=> n + s.data.byteLength, 0) + 8;
  const dataOffset = ftyp.length + 8;
  const moov = buildMoov({samples, description, width, height, fps, dataOffset});

  const out = new Uint8Array(ftyp.length + mdatSize + moov.length);
  let at = 0;
  out.set(ftyp, at); at += ftyp.length;
  out.set([...b32(mdatSize), ...ascii("mdat")], at); at += 8;
  for(const s of samples){ out.set(s.data, at); at += s.data.byteLength; }
  out.set(moov, at);
  return new Blob([out], {type: "video/mp4"});
}

/* ---------- render every frame, encode, mux ---------- */
async function encodeLoopMP4(p, {fps, seconds, onProgress}){
  const width  = p.W - (p.W % 2);       // H.264 is 4:2:0 — both axes must be even
  const height = p.H - (p.H % 2);
  const total  = Math.max(2, Math.round(fps * seconds));
  // grain is expensive to compress, so budget generously by pixel count,
  // then clamp so the file still fits a 16 MB save
  const byPixels = Math.round(width * height * fps * 0.22);
  const byBudget = Math.round(9 * 8e6 / seconds);
  const bitrate = Math.max(2e6, Math.min(24e6, byPixels, byBudget));
  const config = await pickAvcConfig(width, height, bitrate, fps);
  if(!config) return null;

  const surface = makeExportSurface(width,height);
  const samples = [];
  let description = null, failed = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if(meta && meta.decoderConfig && meta.decoderConfig.description){
        description = new Uint8Array(meta.decoderConfig.description);
      }
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({data, key: chunk.type === "key"});
    },
    error: e => { failed = e; }
  });
  try{
    encoder.configure(config);
    const frameDur = Math.round(1e6 / fps);
    const gop = Math.max(1, Math.round(fps * 2));
    for(let i = 0; i < total && !failed; i++){
      surface.draw(p, width, height, 1, (i / total) * Math.PI * 2);
      const frame = new VideoFrame(surface.canvas, {timestamp: Math.round(i * 1e6 / fps), duration: frameDur});
      try { encoder.encode(frame, {keyFrame: i % gop === 0}); }
      finally { frame.close(); }
      if(onProgress) onProgress(i + 1, total);
      await new Promise(r => setTimeout(r, 0));
      while(encoder.encodeQueueSize > 6 && !failed) await new Promise(r => setTimeout(r, 8));
    }
    if(failed) throw failed;
    await encoder.flush();
    if(!description || !samples.length) return null;
    return muxMP4({samples, description, width, height, fps});
  } finally {
    try { if(encoder.state!=="closed") encoder.close(); } catch(e){}
    surface.dispose();
  }
}
