import { QRCodeSVG } from 'qrcode.react';
import './QRCodeDisplay.css';

interface QRCodeDisplayProps {
  joinUrl: string;
  roomCode: string;
  size?: number;
}

function QRCodeDisplay({ joinUrl, roomCode, size = 200 }: QRCodeDisplayProps) {
  return (
    <div className="qr-container">
      <div className="qr-code">
        <QRCodeSVG value={joinUrl} size={size} level="M" />
      </div>
      <div className="room-code-display">
        <p className="room-code-label">Room Code:</p>
        <p className="room-code-value">{roomCode}</p>
      </div>
      <p className="qr-instruction">Scan to join or enter code manually</p>
    </div>
  );
}

export default QRCodeDisplay;
