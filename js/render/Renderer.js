import { Element2D } from '../engine/Element2D.js';

export class FEARenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.animationTime = 0;
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    static getColorSpectrum(val, max) {
        if(max === 0) return 'rgb(0, 255, 255)';
        const norm = Math.min(Math.max(val / max, 0), 1);
        const r = Math.min(Math.max(4 * norm - 2, 0), 1) * 255;
        const g = Math.min(Math.max(2 - 4 * Math.abs(norm - 0.5), 0), 1) * 255;
        const b = Math.min(Math.max(2 - 4 * norm, 0), 1) * 255;
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    render(nodes, macroMembers, feElements, config, maxStress, mousePos, isDrawing, drawStartPos) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animationTime += 0.05;

        // Draw structural engineering background grid pattern
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke(); }
        for (let y = 0; y < this.canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke(); }

        // Draw current mouse trace line segment boundary
        if (isDrawing && drawStartPos) {
            ctx.beginPath();
            ctx.strokeStyle = '#94a3b8';
            ctx.setLineDash([4, 4]);
            ctx.moveTo(drawStartPos.x, drawStartPos.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Render color-coded internal line segments based on analysis data
        if (feElements && feElements.length > 0) {
            feElements.forEach(el => {
                ctx.beginPath();
                ctx.lineWidth = config.depth * 50 + 2;
                ctx.strokeStyle = FEARenderer.getColorSpectrum(el.stress, maxStress);

                let amp = config.scale;
                if (config.analysis !== 'static') amp *= Math.sin(this.animationTime * 2);

                const sx = el.start.x + (el.start.ux || 0) * amp * Element2D.SCALE_P2M;
                const sy = el.start.y + (el.start.uy || 0) * amp * Element2D.SCALE_P2M;
                const ex = el.end.x + (el.end.ux || 0) * amp * Element2D.SCALE_P2M;
                const ey = el.end.y + (el.end.uy || 0) * amp * Element2D.SCALE_P2M;

                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            });
        } else {
            macroMembers.forEach(m => {
                ctx.beginPath();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 6;
                ctx.moveTo(m.start.x, m.start.y);
                ctx.lineTo(m.end.x, m.end.y);
                ctx.stroke();
            });
        }

        // Render system boundary elements and nodes
        nodes.forEach(n => {
            let amp = config.scale;
            if (config.analysis !== 'static') amp *= Math.sin(this.animationTime * 2);

            const nx = n.x + (n.ux || 0) * amp * Element2D.SCALE_P2M;
            const ny = n.y + (n.uy || 0) * amp * Element2D.SCALE_P2M;

            if (n.support === 'fixed') {
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(nx - 10, ny, 20, 8);
            } else if (n.support === 'pinned') {
                ctx.fillStyle = '#eab308';
                ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - 10, ny + 12); ctx.lineTo(nx + 10, ny + 12); ctx.closePath(); ctx.fill();
            }

            if (n.force) {
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(nx, ny - 40); ctx.lineTo(nx, ny - 5); ctx.lineTo(nx - 6, ny - 12); ctx.moveTo(nx, ny - 5); ctx.lineTo(nx + 6, ny - 12); ctx.stroke();
            }

            ctx.fillStyle = (Math.hypot(n.x - mousePos.x, n.y - mousePos.y) < 15) ? '#3b82f6' : '#fff';
            ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();
        });
    }
}