import InputManager from './InputManager.js';

export class MobileControls {
    public elem = document.createElement('div');
    private pointers = new Map<number, HTMLButtonElement>();
    private buttons: HTMLButtonElement[] = [];
    private orbitMode = false;

    constructor(private input: InputManager) {
        this.elem.className = 'mobile-controls';
        this.elem.hidden = true;
        this.elem.setAttribute('aria-label', 'Map movement controls');
        const pad = document.createElement('div');
        pad.className = 'mobile-direction-pad';
        const flight = document.createElement('div');
        flight.className = 'mobile-flight-pad';
        this.elem.append(pad, flight);
        this.addButton(pad, '↑', 'Move forward', 'KeyW', '1 / 2');
        this.addButton(pad, '←', 'Move left', 'KeyA', '2 / 1');
        this.addButton(pad, '↓', 'Move backward', 'KeyS', '2 / 2');
        this.addButton(pad, '→', 'Move right', 'KeyD', '2 / 3');
        this.addButton(flight, 'Rise', 'Move up', 'PageUp');
        this.addButton(flight, 'Fall', 'Move down', 'PageDown');
        this.addButton(flight, 'Fast', 'Move faster', 'ShiftLeft');
        const hint = document.createElement('div');
        hint.className = 'mobile-control-hint';
        hint.textContent = 'Drag to look · Hold arrows to move · Pinch to travel';
        this.elem.append(hint);
        window.addEventListener('blur', () => this.release());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.release();
        });
    }

    private addButton(parent: HTMLElement, label: string, name: string, key: string, area?: string): void {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-label', name);
        button.setAttribute('aria-pressed', 'false');
        if (area !== undefined) button.style.gridArea = area;
        const releasePointer = (e: PointerEvent) => {
            this.input.setVirtualKey(e.pointerId, null);
            this.pointers.delete(e.pointerId);
            button.setAttribute('aria-pressed', [...this.pointers.values()].includes(button) ? 'true' : 'false');
        };
        button.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            button.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, button);
            this.input.setVirtualKey(e.pointerId, key);
            button.setAttribute('aria-pressed', 'true');
        });
        button.addEventListener('pointerup', releasePointer);
        button.addEventListener('pointercancel', releasePointer);
        button.addEventListener('lostpointercapture', releasePointer);
        parent.append(button);
        this.buttons.push(button);
    }

    public setOrbitMode(orbitMode: boolean): void {
        if (this.orbitMode === orbitMode) return;
        this.release();
        this.orbitMode = orbitMode;
        const labels = orbitMode ? ['Zoom+', 'Zoom−', 'Turn'] : ['Rise', 'Fall', 'Fast'];
        const names = orbitMode ? ['Zoom in', 'Zoom out', 'Hold to rotate with arrows'] : ['Move up', 'Move down', 'Move faster'];
        for (let i = 0; i < 3; i++) {
            this.buttons[i + 4].textContent = labels[i];
            this.buttons[i + 4].setAttribute('aria-label', names[i]);
        }
        this.buttons[0].setAttribute('aria-label', orbitMode ? 'Pan up' : 'Move forward');
        this.buttons[2].setAttribute('aria-label', orbitMode ? 'Pan down' : 'Move backward');
        this.elem.querySelector('.mobile-control-hint')!.textContent = orbitMode ? 'Drag to orbit · Pinch to zoom · Hold arrows to pan' : 'Drag to look · Hold arrows to move · Pinch to travel';
    }

    public release(): void {
        for (const pointer of this.pointers.keys()) this.input.setVirtualKey(pointer, null);
        this.pointers.clear();
        for (const button of this.buttons) button.setAttribute('aria-pressed', 'false');
    }

    public setInput(input: InputManager): void {
        this.release();
        this.input = input;
    }

    public setVisible(visible: boolean): void {
        if (!visible) this.release();
        this.elem.hidden = !visible;
    }
}
