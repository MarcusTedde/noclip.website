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


test('virtual controls combine with physical keys and release independently', () => {
    const { input } = setup();
    input.keysDown.set('KeyW', false);
    input.setVirtualKey(1, 'KeyW');
    input.setVirtualKey(2, 'KeyD');
    assert.equal(input.isKeyDown('KeyW'), true);
    assert.equal(input.isKeyDown('KeyD'), true);
    input.setVirtualKey(1, null);
    assert.equal(input.isKeyDown('KeyW'), true);
    input.keysDown.delete('KeyW');
    assert.equal(input.isKeyDown('KeyW'), false);
    assert.equal(input.isKeyDown('KeyD'), true);
    input.setVirtualKey(2, null);
    assert.equal(input.isKeyDown('KeyD'), false);
});

test('two fingers holding one movement button require two releases', () => {
    const { input } = setup();
    input.setVirtualKey(1, 'KeyW');
    input.setVirtualKey(2, 'KeyW');
    input.setVirtualKey(1, null);
    assert.equal(input.isKeyDown('KeyW'), true);
    input.setVirtualKey(2, null);
    assert.equal(input.isKeyDown('KeyW'), false);
});

test('scene resets and backgrounding clear virtual movement', () => {
    const { input } = setup();
    input.setVirtualKey(1, 'KeyW');
    input.reset();
    assert.equal(input.isKeyDown('KeyW'), false);
    input.setVirtualKey(2, 'KeyD');
    windowTarget.dispatchEvent(new Event('blur'));
    assert.equal(input.isKeyDown('KeyD'), false);
});


test('virtual controls trigger camera shortcuts once per press', () => {
    const { input } = setup();
    input.setVirtualKey(1, 'KeyW');
    assert.equal(input.isKeyDownEventTriggered('KeyW'), true);
    input.afterFrame();
    assert.equal(input.isKeyDown('KeyW'), true);
    assert.equal(input.isKeyDownEventTriggered('KeyW'), false);
    input.setVirtualKey(2, 'KeyW');
    assert.equal(input.isKeyDownEventTriggered('KeyW'), false);
    input.setVirtualKey(1, null);
    input.setVirtualKey(2, null);
    input.setVirtualKey(3, 'KeyW');
    assert.equal(input.isKeyDownEventTriggered('KeyW'), true);
});


test('fast swipes on a small screen are not discarded as mouse noise', () => {
    const { canvas, input } = setup();
    canvas.clientWidth = 320;
    canvas.clientHeight = 568;
    touch(canvas, 'touchstart', [[10, 100]]);
    touch(canvas, 'touchmove', [[110, 180]]);
    assert.equal(input.getMouseDeltaX(), 312.5);
    assert.equal(input.getMouseDeltaY(), 250);
});
