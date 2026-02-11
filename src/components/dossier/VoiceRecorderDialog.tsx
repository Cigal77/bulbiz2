import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Square, Trash2, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (blob: Blob, duration: number) => Promise<void>;
}

export function VoiceRecorderDialog({ open, onClose, onSave }: VoiceRecorderDialogProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const MAX_DURATION = 300; // 5 minutes

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 500);
    } catch {
      // Permission denied or no mic
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setSaving(true);
    try {
      await onSave(audioBlob, duration);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (recording) stopRecording();
    reset();
    onClose();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note vocale</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Timer */}
          <div className="text-4xl font-mono tabular-nums text-foreground">
            {formatTime(duration)}
          </div>

          {/* Waveform indicator */}
          {recording && (
            <div className="flex items-center gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-destructive rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Audio player */}
          {audioUrl && !recording && (
            <audio controls src={audioUrl} className="w-full" />
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            {!recording && !audioBlob && (
              <Button size="lg" onClick={startRecording} className="gap-2 rounded-full px-6">
                <Mic className="h-5 w-5" />
                Démarrer
              </Button>
            )}

            {recording && (
              <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2 rounded-full px-6">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}

            {audioBlob && !recording && (
              <>
                <Button variant="outline" onClick={reset} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Max {MAX_DURATION / 60} minutes • {recording ? "Enregistrement en cours…" : audioBlob ? "Réécouter puis enregistrer" : "Appuyez pour commencer"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
