export function screenshotSize(width: number, height: number, longEdge: number): { width: number; height: number } {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        throw new Error('The map has no drawable area.');
    if (!Number.isFinite(longEdge)) throw new Error('Choose a valid screenshot resolution.');
    const edge = longEdge === 0 ? Math.min(3840, Math.max(width, height)) : Math.min(3840, Math.max(320, longEdge));
    const scale = edge / Math.max(width, height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function captureMap(canvas: HTMLCanvasElement, render: () => void, longEdge: number): Promise<Blob> {
    const original = { width: canvas.width, height: canvas.height };
    const target = screenshotSize(original.width, original.height, longEdge);
    const copy = document.createElement('canvas');
    copy.width = target.width; copy.height = target.height;
    try {
        canvas.width = target.width; canvas.height = target.height;
        render();
        const context = copy.getContext('2d');
        if (!context) throw new Error('Image capture is unavailable on this device.');
        context.drawImage(canvas, 0, 0);
    } finally {
        canvas.width = original.width; canvas.height = original.height;
        render();
    }
    return new Promise((resolve, reject) => copy.toBlob(blob => {
        copy.width = copy.height = 1;
        if (blob) resolve(blob); else reject(new Error('Could not create the screenshot. Try Screen resolution.'));
    }, 'image/png'));
}
