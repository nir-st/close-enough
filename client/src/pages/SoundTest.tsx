import { useEffect } from 'react';
import * as sound from '../services/sound';

// Dev/preview page at /sounds — click buttons to hear each synthesized effect.
// Uses the real sound service so it always matches what plays in-game.
function SoundTest() {
  useEffect(() => { sound.unlockAudio(); }, []);

  const buttons: { label: string; play: () => void }[] = [
    { label: '🔼 Question appears', play: sound.playQuestionAppear },
    { label: '⏱️ Final-second tick', play: sound.playTick },
    { label: '⛔ Time\'s up', play: sound.playTimeUp },
    {
      label: '🥁 Drumroll → reveal',
      play: () => { sound.startDrumroll(); setTimeout(() => sound.playAnswerReveal(), 1300); }
    },
    { label: '🏆 Winner sting', play: sound.playWinner },
    { label: '🎉 Game over', play: sound.playGameOver }
  ];

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1 style={{ color: 'white', textAlign: 'center' }}>🔊 Sound Test</h1>
      <p style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 24 }}>
        Tap a button to hear it. These are the exact in-game sounds.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {buttons.map((b) => (
          <button
            key={b.label}
            className="btn-primary"
            style={{ fontSize: 18, padding: 16 }}
            onClick={() => { sound.unlockAudio(); b.play(); }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SoundTest;
