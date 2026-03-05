/**
 * Client-side video compression using Canvas + MediaRecorder.
 * Re-encodes video at a lower bitrate / resolution to stay under a target size.
 */

const TARGET_SIZE_MB = 18; // leave 2 MB margin vs the 20 MB analysis limit
const MAX_HEIGHT = 720;

export interface CompressionProgress {
  phase: "loading" | "compressing" | "done";
  /** 0-100 */
  percent: number;
}

type OnProgress = (p: CompressionProgress) => void;

/**
 * Returns the file as-is if it's already ≤ TARGET_SIZE_MB or not a video.
 * Otherwise re-encodes at lower bitrate/resolution.
 */
export async function compressVideoIfNeeded(
  file: File | Blob,
  onProgress?: OnProgress,
): Promise<File | Blob> {
  const isVideo =
    (file instanceof File ? file.type : "video/webm").startsWith("video/");
  if (!isVideo || file.size <= TARGET_SIZE_MB * 1024 * 1024) {
    onProgress?.({ phase: "done", percent: 100 });
    return file;
  }

  onProgress?.({ phase: "loading", percent: 0 });

  // 1. Load video metadata
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossible de charger la vidéo"));
      video.src = url;
    });

    // Wait for enough data to play
    await new Promise<void>((resolve) => {
      if (video.readyState >= 3) return resolve();
      video.oncanplay = () => resolve();
    });

    const duration = video.duration;
    if (!duration || !isFinite(duration) || duration < 0.5) {
      // Can't compress very short or unreadable videos
      onProgress?.({ phase: "done", percent: 100 });
      return file;
    }

    // 2. Calculate target dimensions
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (height > MAX_HEIGHT) {
      const scale = MAX_HEIGHT / height;
      width = Math.round(width * scale);
      height = MAX_HEIGHT;
    }
    // Ensure even dimensions (required by some codecs)
    width = width % 2 === 0 ? width : width - 1;
    height = height % 2 === 0 ? height : height - 1;

    // 3. Calculate target bitrate (bits/sec)
    const targetBytes = TARGET_SIZE_MB * 1024 * 1024;
    const targetBps = Math.floor((targetBytes * 8) / duration * 0.85); // 85% margin

    // 4. Set up canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // 5. Set up MediaRecorder from canvas stream
    const stream = canvas.captureStream(30);

    // Also capture audio if present
    let audioCtx: AudioContext | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;
    try {
      audioCtx = new AudioContext();
      audioSource = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      audioSource.connect(dest);
      // Also connect to speakers so the video plays (muted in element, audio via context)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      // No audio track or AudioContext not available — continue without audio
    }

    // Choose supported mimeType
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.min(targetBps, 2_500_000), // cap at 2.5 Mbps
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    onProgress?.({ phase: "compressing", percent: 0 });

    // 6. Play + draw loop
    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
      recorder.onerror = () => reject(new Error("Erreur de compression vidéo"));

      recorder.start(500); // collect every 500ms
      video.currentTime = 0;
      video.muted = false; // unmute so AudioContext gets signal
      video.play().catch(() => {
        // Autoplay might be blocked, try muted
        video.muted = true;
        video.play().catch(reject);
      });

      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        onProgress?.({
          phase: "compressing",
          percent: Math.min(99, Math.round((video.currentTime / duration) * 100)),
        });
        requestAnimationFrame(drawFrame);
      };
      requestAnimationFrame(drawFrame);

      video.onended = () => {
        // Draw last frame
        ctx.drawImage(video, 0, 0, width, height);
        setTimeout(() => recorder.stop(), 200);
      };
    });

    // Cleanup
    audioSource?.disconnect();
    audioCtx?.close().catch(() => {});

    onProgress?.({ phase: "done", percent: 100 });

    const fileName =
      file instanceof File ? file.name.replace(/\.[^.]+$/, ".webm") : `video-${Date.now()}.webm`;
    return new File([compressedBlob], fileName, { type: "video/webm" });
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
  }
}
