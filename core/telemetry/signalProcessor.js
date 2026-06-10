import { config, state } from '../physics/materialProfiles.js';

let telemetryDataHistory = Array(120).fill(0);

export function getTelemetryHistory() {
    return telemetryDataHistory;
}

export function clearTelemetryHistory() {
    telemetryDataHistory.fill(0);
}

export function updateTelemetryStream(tCanvas) {
    let frameValue = 0;
    
    if (state.activeFENodes && state.activeFENodes.length > 0) {
        if (config.analysis === 'static') {
            frameValue = state.activeFENodes.reduce((max, node) => Math.max(max, Math.abs(node.uy || 0)), 0) * 1000;
            const sensorNoise = (Math.random() - 0.5) * 0.015;
            if (frameValue > 0) frameValue += sensorNoise;
            
            document.getElementById('telemetry-val').innerText = frameValue.toFixed(3) + " mm";
        } else {
            let peakNode = state.activeFENodes.reduce((highest, current) => {
                return (Math.abs(current.uy || 0) > Math.abs(highest.uy || 0)) ? current : highest;
            }, state.activeFENodes[0]);

            let frequencyMap = { modal_1: 14.20, modal_2: 44.82, modal_3: 112.55 };
            let activeFreq = frequencyMap[config.analysis] || 0;

            let structuralDisplacement = (peakNode.uy || 0) * config.scale * 12;
            let dynamicWave = structuralDisplacement * Math.sin(state.animationTime * 2.5);

            let structuralNoise = Math.sin(state.animationTime * 12.0) * (structuralDisplacement * 0.08);
            let whiteNoise = (Math.random() - 0.5) * 0.4;

            frameValue = dynamicWave + structuralNoise + whiteNoise;
            document.getElementById('telemetry-val').innerText = activeFreq.toFixed(2) + " Hz";
        }
    } else {
        document.getElementById('telemetry-val').innerText = "0.00 STRN";
    }

    telemetryDataHistory.push(frameValue);
    if (telemetryDataHistory.length > tCanvas.width) {
        telemetryDataHistory.shift();
    }
}