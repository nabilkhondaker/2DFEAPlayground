import { state } from '../../core/physics/materialProfiles.js';
import { findNearNode, getPointerCoords } from './interaction.js';
import { solveFEA } from '../../core/physics/finiteElement.js';

const canvas = document.getElementById('feaCanvas');

export function handlePointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    const pos = getPointerCoords(e);
    const targetNode = findNearNode(pos);

    if (state.currentMode === 'draw') {
        state.isDrawing = true;
        state.drawStartPos = targetNode ? { x: targetNode.x, y: targetNode.y } : pos;
    } else if (targetNode) {
        if (state.currentMode === 'support_fixed') targetNode.support = targetNode.support === 'fixed' ? null : 'fixed';
        else if (state.currentMode === 'support_pinned') targetNode.support = targetNode.support === 'pinned' ? null : 'pinned';
        else if (state.currentMode === 'force') targetNode.force = targetNode.force ? null : { fx: 0, fy: 150000 };
        solveFEA();
    }
}

export function handlePointerMove(e) {
    state.mousePos = getPointerCoords(e);
}

export function handlePointerUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
    
    const pos = getPointerCoords(e);
    if (Math.hypot(state.drawStartPos.x - pos.x, state.drawStartPos.y - pos.y) < 10) return;

    let startNode = findNearNode(state.drawStartPos);
    if (!startNode) {
        startNode = { x: state.drawStartPos.x, y: state.drawStartPos.y, support: null, force: null, ux:0, uy:0, rz:0 };
        state.nodes.push(startNode);
    }

    let endNode = findNearNode(pos);
    if (!endNode) {
        endNode = { x: pos.x, y: pos.y, support: null, force: null, ux:0, uy:0, rz:0 };
        state.nodes.push(endNode);
    }

    if (startNode !== endNode) state.members.push({ start: startNode, end: endNode });
    solveFEA();
}