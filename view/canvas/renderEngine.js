import { config, state, SCALE_P2M } from '../../core/physics/materialProfiles.js';
import { resizeCanvas, setupEventListeners, updateCanvasCursor } from '../ui/interaction.js';
import { getColorForStress } from '../../core/math/linearAlgebra.js';
import { updateTelemetryStream } from '../../core/telemetry/signalProcessor.js';
import { initTelemetryCanvas, drawTelemetryGraph } from '../telemetry/monitorDisplay.js';

// Centralized drawing properties ensuring core layout styling is completely untouched
const FEA_COLORS = {
    beamRegular: "#243149",       // Your exact original default structural beam line color
    beamDeformed: "#ef4444",      // Deformed color configuration
    nodes: "#00f2fe",             // Node joints
    textLabels: "#ffffff"         // Structural forces values
};

const canvas = document.getElementById('feaCanvas');
const ctx = canvas.getContext('2d');
const tCanvas = document.getElementById('telemetryCanvas');

export function init() {
    window.addEventListener('resize', () => {
        resizeCanvas();
        initTelemetryCanvas();
    }, { passive: true });

    resizeCanvas();
    initTelemetryCanvas();
    updateCanvasCursor();
    setupEventListeners();
    
    requestAnimationFrame(renderLoop);
}

function renderLoop() {
    state.animationTime += 0.05;
    ctx.save();
    ctx.scale(state.devicePixelRatio, state.devicePixelRatio);

    // Light-trail frame clearance
    ctx.fillStyle = 'rgba(9, 13, 22, 0.35)';
    ctx.fillRect(0, 0, canvas.width / state.devicePixelRatio, canvas.height / state.devicePixelRatio);

    // Draw Grid Coordinates
    ctx.strokeStyle = 'rgba(20, 28, 46, 0.4)'; ctx.lineWidth = 1;
    const gridSz = 40;
    for (let x = 0; x < canvas.width / state.devicePixelRatio; x += gridSz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / state.devicePixelRatio); ctx.stroke(); }
    for (let y = 0; y < canvas.height / state.devicePixelRatio; y += gridSz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / state.devicePixelRatio, y); ctx.stroke(); }

    if (state.isDrawing && state.drawStartPos) {
        ctx.beginPath(); ctx.strokeStyle = '#475569'; ctx.setLineDash([6, 4]);
        ctx.moveTo(state.drawStartPos.x, state.drawStartPos.y); ctx.lineTo(state.mousePos.x, state.mousePos.y); ctx.stroke(); ctx.setLineDash([]);
    }

    // Draw FE Elements
    if (state.activeFEElements && state.activeFEElements.length > 0) {
        state.activeFEElements.forEach(el => {
            ctx.beginPath(); ctx.lineWidth = config.depth * 50 + 3;
            ctx.strokeStyle = getColorForStress(el.stress, state.maxStressValue);
            let ampScale = config.scale;
            if (config.analysis !== 'static') ampScale *= Math.sin(state.animationTime * 2.5);

            const sx = el.start.x + (el.start.ux || 0) * ampScale * SCALE_P2M;
            const sy = el.start.y + (el.start.uy || 0) * ampScale * SCALE_P2M;
            const ex = el.end.x + (el.end.ux || 0) * ampScale * SCALE_P2M;
            const ey = el.end.y + (el.end.uy || 0) * ampScale * SCALE_P2M;

            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        });
    } else {
        // Enforcing core regular color properties back onto drawn layout nodes
        state.members.forEach(m => {
            ctx.beginPath(); 
            ctx.strokeStyle = FEA_COLORS.beamRegular; 
            ctx.lineWidth = 6;
            ctx.moveTo(m.start.x, m.start.y); 
            ctx.lineTo(m.end.x, m.end.y); 
            ctx.stroke();
        });
    }

    // Draw Boundary Conditions & External Forces
    state.nodes.forEach(n => {
        let ampScale = config.scale;
        if (config.analysis !== 'static') ampScale *= Math.sin(state.animationTime * 2.5);

        const nx = n.x + (n.ux || 0) * ampScale * SCALE_P2M;
        const ny = n.y + (n.uy || 0) * ampScale * SCALE_P2M;

        if (n.support === 'fixed') {
            ctx.fillStyle = '#ef4444'; ctx.fillRect(nx - 12, ny, 24, 6);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
            for(let i=-12; i<=12; i+=6) { ctx.beginPath(); ctx.moveTo(nx+i, ny); ctx.lineTo(nx+i-4, ny+6); ctx.stroke(); }
        } else if (n.support === 'pinned') {
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - 10, ny + 14); ctx.lineTo(nx + 10, ny + 14); ctx.closePath(); ctx.fill();
        }

        if (n.force) {
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.beginPath();
            ctx.moveTo(nx, ny - 45); ctx.lineTo(nx, ny - 5); ctx.lineTo(nx - 6, ny - 14); ctx.moveTo(nx, ny - 5); ctx.lineTo(nx + 6, ny - 14); ctx.stroke();
            ctx.fillStyle = '#10b981'; ctx.font = 'bold 10px sans-serif'; ctx.fillText("150 kN", nx + 10, ny - 25);
        }

        const isHovered = Math.hypot(n.x - state.mousePos.x, n.y - state.mousePos.y) < 20;
        if (isHovered && state.currentMode !== 'draw') {
            ctx.beginPath(); ctx.strokeStyle = state.currentMode === 'force' ? '#10b981' : '#ef4444'; ctx.lineWidth = 2;
            ctx.arc(nx, ny, 14, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.fillStyle = isHovered ? '#3b82f6' : '#fff';
        ctx.beginPath(); ctx.arc(nx, ny, isHovered ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();

    // Secondary Telemetry Calculations and View Pipeline Draw
    updateTelemetryStream(tCanvas);
    drawTelemetryGraph();

    requestAnimationFrame(renderLoop);
}