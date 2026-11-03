import type { Viewer } from './viewer.js';

export class ScreenshotPanel {
    public button = document.createElement('button');
    private dialog = document.createElement('dialog');
    private viewer: Viewer;
    private preview = document.createElement('img');
    private status = document.createElement('p');
    private quality = document.createElement('select');
    private create = document.createElement('button');
    private save = document.createElement('button');
    private share = document.createElement('button');
    private blob: Blob | null = null;
    private url: string | null = null;
    private frozen = false;
    private generation = 0;

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.button.type = 'button'; this.button.className = 'capture-trigger';
        this.button.setAttribute('aria-label', 'Take map screenshot'); this.button.title = 'Take map screenshot';
        this.button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></svg>';
        this.dialog.className = 'capture-dialog'; this.dialog.setAttribute('aria-labelledby', 'capture-title');
        this.dialog.innerHTML = '<div class="capture-heading"><div><span class="archive-kicker">PHOTO MODE</span><h2 id="capture-title">Capture this world</h2></div></div>';
        const close = document.createElement('button'); close.type = 'button'; close.className = 'drawer-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close photo mode'); close.onclick = () => this.dialog.close();
        this.dialog.querySelector('.capture-heading')!.append(close);
        const description = document.createElement('p'); description.className = 'capture-description'; description.textContent = 'A clean PNG from your current camera. No menus or controls.';
        const label = document.createElement('label'); label.textContent = 'Image quality'; label.htmlFor = 'capture-quality';
        this.quality.id = 'capture-quality';
        for (const [value, text] of [['0', 'Screen resolution · up to 4K'], ['2560', '2K · 2560 px long edge'], ['3840', '4K · 3840 px long edge']]) {
            const option = document.createElement('option'); option.value = value; option.textContent = text; this.quality.append(option);
        }
        this.quality.value = '2560';
        this.preview.alt = 'Map screenshot preview'; this.preview.hidden = true;
        this.preview.addEventListener('contextmenu', e => e.stopPropagation());
        this.status.className = 'capture-status'; this.status.setAttribute('role', 'status');
        this.create.type = this.save.type = this.share.type = 'button';
        this.create.textContent = 'Capture PNG'; this.create.className = 'archive-primary'; this.create.onclick = () => void this.capture();
        this.save.textContent = 'Save PNG'; this.save.disabled = true; this.save.onclick = () => this.download();
        this.share.textContent = 'Share / Save image'; this.share.hidden = true; this.share.onclick = () => void this.shareImage();
        const actions = document.createElement('div'); actions.className = 'capture-actions'; actions.append(this.save, this.share);
        this.dialog.append(description, label, this.quality, this.create, this.preview, this.status, actions);
        document.body.append(this.dialog);
        this.button.onclick = () => this.open();
        this.dialog.addEventListener('close', () => {
            this.generation++;
            if (this.frozen) { this.viewer.externalControl = false; this.viewer.rafTime = window.performance.now(); this.viewer.inputManager.isMouseEnabled = true; this.viewer.inputManager.toplevel.focus({ preventScroll: true }); this.frozen = false; }
            this.releaseImage(); this.create.disabled = false;
        });
    }
    public setViewer(viewer: Viewer): void { if (this.dialog.open) this.dialog.close(); this.viewer = viewer; }
    private open(): void {
        if (!this.viewer.scene || this.viewer.externalControl) return;
        this.viewer.inputManager.reset(); this.viewer.inputManager.isMouseEnabled = false;
        this.viewer.externalControl = true; this.frozen = true;
        this.status.textContent = 'Camera paused · choose a quality and capture.';
        this.save.disabled = true; this.share.hidden = true; this.dialog.showModal();
    }
    private releaseImage(): void {
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = null; this.blob = null; this.preview.removeAttribute('src'); this.preview.hidden = true;
    }
    private async capture(): Promise<void> {
        const generation = ++this.generation;
        this.create.disabled = true; this.save.disabled = true; this.share.hidden = true;
        this.status.textContent = 'Rendering your screenshot…';
        try {
            const blob = await this.viewer.captureScreenshot(Number(this.quality.value));
            if (generation !== this.generation || !this.dialog.open) return;
            this.releaseImage(); this.blob = blob; this.url = URL.createObjectURL(blob);
            this.preview.src = this.url; this.preview.hidden = false; this.save.disabled = false;
            const file = new File([blob], this.filename(), { type: 'image/png' });
            this.share.hidden = !navigator.canShare?.({ files: [file] });
            this.status.textContent = `PNG ready · ${(blob.size / 1048576).toFixed(1)} MB`;
        } catch (error) { if (generation === this.generation) this.status.textContent = error instanceof Error ? error.message : 'Capture failed. Try Screen resolution.'; }
        finally { if (generation === this.generation) this.create.disabled = false; }
    }
    private filename(): string { return `${document.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 100)}_${Date.now()}.png`; }
    private download(): void {
        if (!this.url) return;
        const a = document.createElement('a'); a.href = this.url; a.download = this.filename(); document.body.append(a); a.click(); a.remove();
    }
    private async shareImage(): Promise<void> {
        if (!this.blob) return;
        try { await navigator.share({ files: [new File([this.blob], this.filename(), { type: 'image/png' })] }); }
        catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) this.status.textContent = 'Sharing is unavailable. Use Save PNG instead.'; }
    }
}
