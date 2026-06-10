import { config, state } from '../../core/physics/materialProfiles.js';
import { getTelemetryHistory } from '../../core/telemetry/signalProcessor.js';

const tCanvas = document.getElementById('telemetryCanvas');
const tCtx = tCanvas.getContext('2d');

export function initTelemetryCanvas() {
    tCanvas.width = tCanvas.clientWidth;
    tCanvas.height = tCanvas.clientHeight;
}

export function drawTelemetryGraph() {
    tCtx.clearRect(0, 0, tCanvas.width, tCanvas.height);
    const midY = tCanvas.height / 2;
    const history = getTelemetryHistory();

    // 1. Draw Oscilloscope Division Matrix Grid
    tCtx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
    tCtx.lineWidth = 1;
    for (let x = 0; x < tCanvas.width; x += 30) {
        tCtx.beginPath(); tCtx.moveTo(x, 0); tCtx.lineTo(x, tCanvas.height); tCtx.stroke();
    }
    for (let y = 0; y < tCanvas.height; y += 15) {
        tCtx.beginPath(); tCtx.moveTo(0, y); tCtx.lineTo(tCanvas.width, y); tCtx.stroke();
    }

    // 2. Center Zero Axis Datum
    tCtx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    tCtx.lineWidth = 1.2;
    tCtx.beginPath(); tCtx.moveTo(0, midY); tCtx.lineTo(tCanvas.width, midY); tCtx.stroke();

    // 3. Render Tracking Line
    if (state.activeFENodes && state.activeFENodes.length > 0) {
        tCtx.strokeStyle = config.analysis === 'static' ? '#10b981' : '#3b82f6';
        tCtx.lineWidth = 2; tCtx.lineJoin = 'round';
        tCtx.beginPath();

        for (let i = 0; i < history.length; i++) {
            let scaleFactor = config.analysis === 'static' ? 8 : 1.2;
            let y = midY - (history[i] * scaleFactor);
            y = Math.min(Math.max(y, 4), tCanvas.height - 4);

            if (i === 0) tCtx.moveTo(i, y);
            else tCtx.lineTo(i, y);
        }
        tCtx.stroke();

        // 4. Sweep Dot Indicator Head
        if (history.length > 0) {
            let lastIdx = history.length - 1;
            let scaleFactor = config.analysis === 'static' ? 8 : 1.2;
            let headY = Math.min(Math.max(midY - (history[lastIdx] * scaleFactor), 4), tCanvas.height - 4);

            tCtx.fillStyle = config.analysis === 'static' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)';
            tCtx.beginPath(); tCtx.arc(lastIdx, headY, 6, 0, Math.PI * 2); tCtx.fill();

            tCtx.fillStyle = config.analysis === 'static' ? '#10b981' : '#60a5fa';
            tCtx.beginPath(); tCtx.arc(lastIdx, headY, 2.5, 0, Math.PI * 2); tCtx.fill();
        }
    }
}