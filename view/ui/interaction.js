import { config, state } from '../../core/physics/materialProfiles.js';
import { solveFEA } from '../../core/physics/finiteElement.js';
import { clearTelemetryHistory } from '../../core/telemetry/signalProcessor.js';
import { handlePointerDown, handlePointerMove, handlePointerUp } from './pointerEvents.js';

const canvas = document.getElementById('feaCanvas');
let meshDebounceTimeout = null;

export function getPointerCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { 
        x: (e.clientX - rect.left), 
        y: (e.clientY - rect.top) 
    };
}

export function findNearNode(pos) {
    const threshold = window.innerWidth < 768 ? 28 : 22;
    return state.nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < threshold) || null;
}

export function resizeCanvas() {
    const displayWidth = canvas.parentElement.clientWidth;
    const displayHeight = canvas.parentElement.clientHeight;
    
    if (canvas.width !== displayWidth * state.devicePixelRatio || canvas.height !== displayHeight * state.devicePixelRatio) {
        canvas.width = displayWidth * state.devicePixelRatio;
        canvas.height = displayHeight * state.devicePixelRatio;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
    }
}

export function updateCanvasCursor() {
    canvas.className = ''; 
    canvas.classList.add(`mode-${state.currentMode}`);
}

export function setupEventListeners() {
    // 1. Interaction Mode Grid Switchers
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentMode = e.target.getAttribute('data-mode');
            updateCanvasCursor();
        }, { passive: true });
    });

    // 2. Structural Property Dropdowns & Sliders
    document.getElementById('material-preset').addEventListener('change', (e) => { 
        config.material = e.target.value; 
        solveFEA(); 
    });
    
    document.getElementById('param-depth').addEventListener('input', (e) => { 
        config.depth = parseFloat(e.target.value); 
        solveFEA(); 
    });
    
    // Debounced Mesh Density Slider to maximize structural performance during rapid input shifts
    document.getElementById('param-mesh').addEventListener('input', (e) => { 
        config.meshDensity = parseInt(e.target.value); 
        document.getElementById('stat-solver').innerText = "Recalculating...";
        document.getElementById('stat-solver').style.color = "#3b82f6";
        
        clearTimeout(meshDebounceTimeout);
        meshDebounceTimeout = setTimeout(() => { 
            solveFEA(); 
        }, 120);
    });

    document.getElementById('param-scale').addEventListener('input', (e) => { 
        config.scale = parseFloat(e.target.value); 
    });
    
    document.getElementById('analysis-type').addEventListener('change', (e) => { 
        config.analysis = e.target.value; 
        document.getElementById('legend-title').innerText = e.target.value === 'static' ? 'Bending Stress (σ)' : 'Relative Amplitude';
        solveFEA(); 
    });
    
    // 3. Planetary Gear Kinematic Shutter Clear Automation Loop
    document.getElementById('btn-clear').addEventListener('click', () => { 
        const overlay = document.getElementById('clear-transition-overlay');
        overlay.classList.add('active');

        setTimeout(() => {
            state.nodes = []; 
            state.members = []; 
            state.activeFENodes = []; 
            state.activeFEElements = []; 
            state.maxStressValue = 0;
            clearTelemetryHistory();
            
            document.getElementById('stat-nodes').innerText = "0";
            document.getElementById('stat-elements').innerText = "0";
            document.getElementById('legend-max').innerText = "0.00 MPa";
            
            const stat = document.getElementById('stat-solver');
            stat.innerText = "Stable"; 
            stat.style.color = "#4ade80";
        }, 450);

        setTimeout(() => { 
            overlay.classList.remove('active'); 
        }, 1400);
    });

    // 4. Register Unified Pointer System Engines
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);

    // 5. Image & Vector Snapshot Pipelines
    document.getElementById('btn-png').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'fea-playground.png'; 
        link.href = canvas.toDataURL("image/png"); 
        link.click();
    });

    document.getElementById('btn-svg').addEventListener('click', () => {
        // Safe placeholder context trap to prevent document breaks if clicked mid-setup
        console.log("Vector capture pipeline initialized.");
        alert("Downloaded!");
    });

    // --- Core Vector SVG Export Engine ---
document.getElementById('btn-svg').addEventListener('click', () => {
    if (state.nodes.length === 0) return;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width / state.devicePixelRatio} ${canvas.height / state.devicePixelRatio}" style="background-color: #060913;">`;
    
    // 1. Export Drawn Elements / Beams
    state.members.forEach(m => {
        svgContent += `<line x1="${m.start.x}" y1="${m.start.y}" x2="${m.end.x}" y2="${m.end.y}" stroke="#243149" stroke-width="6" stroke-linecap="round"/>`;
    });

    // 2. Export Nodes and Constraints
    state.nodes.forEach(n => {
        let nodeColor = "#ffffff";
        if (n.support === 'fixed') {
            svgContent += `<rect x="${n.x - 12}" y="${n.y}" width="24" height="6" fill="#ef4444"/>`;
        } else if (n.support === 'pinned') {
            svgContent += `<polygon points="${n.x},${n.y} ${n.x - 10},${n.y + 14} ${n.x + 10},${n.y + 14}" fill="#f59e0b"/>`;
        }
        if (n.force) {
            svgContent += `<path d="M${n.x},${n.y - 45} L${n.x},${n.y - 5} M${n.x - 6},${n.y - 14} L${n.x},${n.y - 5} L${n.x + 6},${n.y - 14}" stroke="#10b981" stroke-width="3"/>`;
        }
        svgContent += `<circle cx="${n.x}" cy="${n.y}" r="4" fill="${nodeColor}"/>`;
    });

    svgContent += '</svg>';

    // Create immediate download trigger
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.download = 'fea-playground-vector.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
});

// Keep your existing PNG export handler directly beneath it
document.getElementById('btn-png').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'fea-playground.png'; 
    link.href = canvas.toDataURL("image/png"); 
    link.click();
            alert("Downloaded!");
});
}