export const SCALE_P2M = 100;

export const Materials = {
    steel: { E: 200e9, rho: 7850 },
    aluminum: { E: 70e9, rho: 2700 },
    concrete: { E: 30e9, rho: 2400 }
};

export const config = {
    material: 'steel',
    depth: 0.2,
    width: 0.1,
    meshDensity: 6,
    scale: 50,
    analysis: 'static'
};

export const state = {
    nodes: [],
    members: [],
    currentMode: 'draw',
    isDrawing: false,
    drawStartPos: null,
    mousePos: { x: 0, y: 0 },
    animationTime: 0,
    activeFENodes: [],
    activeFEElements: [],
    maxStressValue: 0,
    devicePixelRatio: window.devicePixelRatio || 1
};