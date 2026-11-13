"""Regression guard for Android TV 1.0.82 audio routes.

The first PCM pipeline assumed every TV supported 24kHz mono MODE_STATIC.
A real device reported 'não foi possível iniciar a saída de áudio da TV'.
"""
from pathlib import Path
import unittest

BASE = Path(__file__).resolve().parents[2] / "app/src/main/java/top/monitorglobal/tv"


class AudioCompatTest(unittest.TestCase):
    def read(self, name):
        return (BASE / name).read_text(encoding="utf-8")

    def test_output_prefers_native_stereo_pcm_and_streaming_audio(self):
        src = self.read("TvSounds.java")
        self.assertIn("{48000,AudioFormat.CHANNEL_OUT_STEREO,2}", src)
        self.assertIn("{44100,AudioFormat.CHANNEL_OUT_STEREO,2}", src)
        self.assertIn("{24000,AudioFormat.CHANNEL_OUT_MONO,1}", src)
        self.assertIn("AudioTrack.MODE_STREAM", src)
        self.assertNotIn("AudioTrack.MODE_STATIC", src)
        self.assertIn("AudioTrack.getMinBufferSize", src)
        self.assertIn("AudioTrack.WRITE_BLOCKING", src)
        self.assertIn("PCM.execute(()->feed(prepared,token,cue,test))", src)
        self.assertIn("AudioTrack.PLAYSTATE_PLAYING", src)
        self.assertIn("ToneGenerator.TONE_PROP_BEEP", src)

    def test_streaming_is_cancelled_and_never_blocks_visual_alerts(self):
        src = self.read("TvSounds.java")
        self.assertIn("if(owner.generation!=token)return null;", src)
        self.assertIn("while(cursor<prepared.data.length&&generation==token)", src)
        self.assertIn("if(generation!=token||!enabled(context,cue))", src)
        self.assertIn("manager.abandonAudioFocusRequest(focus)", src)
        self.assertIn("AudioManager.STREAM_MUSIC", src)
        self.assertIn("PowerManager power", src)
        self.assertIn("TvSoundPattern.canReplace", src)
        for disallowed in ["setStreamVolume(", "adjustStreamVolume(", "setRingerMode("]:
            self.assertNotIn(disallowed, src)

    def test_preview_shows_actual_completion_or_error_not_stale_status(self):
        ui = self.read("TvSoundSettings.java")
        self.assertIn("registerOnSharedPreferenceChangeListener(statusListener)", ui)
        self.assertIn("unregisterOnSharedPreferenceChangeListener(statusListener)", ui)
        self.assertNotIn("250);", ui)
        self.assertIn('result.setText("Preparando teste de "+cue.label', ui)
        pattern = self.read("TvSoundPattern.java")
        self.assertIn("pcm(int level,int sampleRate,int channels)", pattern)


if __name__ == "__main__":
    unittest.main()
