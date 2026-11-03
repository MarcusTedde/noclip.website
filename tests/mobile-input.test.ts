import assert from 'node:assert/strict';
import { test } from 'node:test';

const storage = { removeItem() {}, getItem() { return null; }, length: 0 };
const windowTarget = Object.assign(new EventTarget(), { localStorage: storage });
const documentTarget = Object.assign(new EventTarget(), { body: { tabIndex: 0 }, hidden: false });
Object.assign(globalThis, { window: windowTarget, document: documentTarget });
const { default: InputManager, DraggingMode } = await import('../src/InputManager.js');

function setup() {
    const canvas = Object.assign(new EventTarget(), { tabIndex: 0, clientWidth: 1000, clientHeight: 1000 });
    return { canvas, input: new InputManager(canvas as unknown as HTMLElement) };
}

function touch(canvas: EventTarget, type: string, points: number[][], otherPoints: number[][] = []) {
    const list = (positions: number[][]) => positions.map(([clientX, clientY]) => ({ clientX, clientY }));
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
        targetTouches: { value: list(points) },
        touches: { value: list([...points, ...otherPoints]) },
    });
    canvas.dispatchEvent(event);
    return event;
}

test('pinch and pan preserve every event between rendered frames', () => {
    const { canvas, input } = setup();
    touch(canvas, 'touchstart', [[100, 100], [200, 100]]);
    touch(canvas, 'touchmove', [[110, 110], [230, 110]]);
    const event = touch(canvas, 'touchmove', [[120, 120], [260, 120]]);
    assert.equal(input.getTouchDeltaX(), 40);
    assert.equal(input.getTouchDeltaY(), 20);
    assert.equal(input.getPinchDeltaDist(), 40);
    assert.equal(event.defaultPrevented, true);
    input.afterFrame();
    assert.equal(input.getTouchDeltaX(), 0);
    assert.equal(input.getPinchDeltaDist(), 0);
});

test('touches on other controls do not turn a look gesture into a pinch', () => {
    const { canvas, input } = setup();
    touch(canvas, 'touchstart', [[100, 100]], [[800, 800]]);
    touch(canvas, 'touchmove', [[110, 120]], [[800, 800]]);
    assert.equal(input.getMouseDeltaX(), 10);
    assert.equal(input.getMouseDeltaY(), 20);
    assert.equal(input.getPinchDeltaDist(), 0);
});

test('changing finger count rebases the gesture without a camera jump', () => {
    const { canvas, input } = setup();
    touch(canvas, 'touchstart', [[100, 100]]);
    touch(canvas, 'touchmove', [[110, 100]]);
    touch(canvas, 'touchstart', [[110, 100], [210, 100]]);
    assert.equal(input.getMouseDeltaX(), 0);
    touch(canvas, 'touchmove', [[110, 100], [230, 100]]);
    touch(canvas, 'touchend', [[110, 100]]);
    assert.equal(input.getPinchDeltaDist(), 0);
    touch(canvas, 'touchmove', [[115, 100]]);
    assert.equal(input.getMouseDeltaX(), 5);
});

test('cancelled gestures restore UI dragging state and clear pending movement', () => {
    const { canvas, input } = setup();
    const states: number[] = [];
    input.ondraggingmodechanged = () => states.push(input.getDraggingMode());
    touch(canvas, 'touchstart', [[100, 100]]);
    touch(canvas, 'touchmove', [[110, 100]]);
    touch(canvas, 'touchcancel', []);
    assert.deepEqual(states, [DraggingMode.Dragging, DraggingMode.None]);
    assert.equal(input.getMouseDeltaX(), 0);
});

test('backgrounding clears pressed keys and camera gestures', () => {
    const { canvas, input } = setup();
    input.keysDown.set('KeyW', true);
    touch(canvas, 'touchstart', [[100, 100], [200, 100]]);
    touch(canvas, 'touchmove', [[110, 100], [220, 100]]);
    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    documentTarget.hidden = false;
    assert.equal(input.isKeyDown('KeyW'), false);
    assert.equal(input.getDraggingMode(), DraggingMode.None);
    assert.equal(input.getPinchDeltaDist(), 0);
});
