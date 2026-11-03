import assert from 'node:assert/strict';
import { test } from 'node:test';

class Element extends EventTarget {
    children: Element[] = [];
    attributes = new Map<string, string>();
    style = {};
    hidden = false;
    textContent = '';
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    setPointerCapture(_id: number) {}
    append(...children: Element[]) { this.children.push(...children); }
}
const windowTarget = new EventTarget();
const documentTarget = Object.assign(new EventTarget(), { createElement: () => new Element(), hidden: false });
Object.assign(globalThis, { window: windowTarget, document: documentTarget });
const { MobileControls } = await import('../src/MobileControls.js');

function setup() {
    const keys = new Map<number, string>();
    const input = { setVirtualKey(id: number, key: string | null) { if (key === null) keys.delete(id); else keys.set(id, key); } };
    const controls = new MobileControls(input as any);
    const root = controls.elem as unknown as Element;
    const button = root.children[0].children[0];
    controls.setVisible(true);
    return { keys, controls, button };
}
function pointer(button: Element, type: string, id = 1) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: 'touch' }, button: { value: 0 } });
    button.dispatchEvent(event);
}

test('holding and releasing a touch button starts and stops movement', () => {
    const { keys, button } = setup();
    pointer(button, 'pointerdown');
    assert.equal(keys.get(1), 'KeyW');
    assert.equal(button.attributes.get('aria-pressed'), 'true');
    pointer(button, 'pointerup');
    assert.equal(keys.size, 0);
    assert.equal(button.attributes.get('aria-pressed'), 'false');
});

test('cancellation and capture loss stop movement', () => {
    const { keys, button } = setup();
    pointer(button, 'pointerdown');
    pointer(button, 'pointercancel');
    assert.equal(keys.size, 0);
    pointer(button, 'pointerdown');
    pointer(button, 'lostpointercapture');
    assert.equal(keys.size, 0);
});

test('hiding controls and changing renderer release the previous input', () => {
    const { keys, controls, button } = setup();
    pointer(button, 'pointerdown');
    controls.setVisible(false);
    assert.equal(keys.size, 0);
    controls.setVisible(true);
    pointer(button, 'pointerdown');
    controls.setInput({ setVirtualKey() {} } as any);
    assert.equal(keys.size, 0);
});

test('backgrounding clears held buttons', () => {
    const { keys, button } = setup();
    pointer(button, 'pointerdown');
    windowTarget.dispatchEvent(new Event('blur'));
    assert.equal(keys.size, 0);
    assert.equal(button.attributes.get('aria-pressed'), 'false');
});
