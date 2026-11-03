import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenshotSize, captureMap } from '../src/ScreenshotCapture.js';

test('captures render at genuine 2K/4K dimensions while preserving aspect', () => {
    assert.deepEqual(screenshotSize(1024, 768, 2560), { width: 2560, height: 1920 });
    assert.deepEqual(screenshotSize(768, 1024, 3840), { width: 2880, height: 3840 });
    assert.deepEqual(screenshotSize(1024, 768, 0), { width: 1024, height: 768 });
    assert.deepEqual(screenshotSize(1920, 1080, 10000), { width: 3840, height: 2160 });
    assert.throws(() => screenshotSize(0, 0, 2560));
    assert.throws(() => screenshotSize(1024, 768, NaN));
});
test('copies the newly rendered image before restoring the live canvas', async () => {
    const canvas = { width: 1024, height: 768 };
    const renders: number[][] = []; const copies: number[][] = [];
    const copy = { width: 0, height: 0, getContext: () => ({ drawImage: (source: typeof canvas) => copies.push([source.width, source.height]) }), toBlob: (cb: (b: Blob) => void) => queueMicrotask(() => cb(new Blob(['image'], { type: 'image/png' }))) };
    Object.assign(globalThis, { document: { createElement: () => copy } });
    const blob = await captureMap(canvas as any, () => renders.push([canvas.width, canvas.height]), 2560);
    assert.deepEqual(renders, [[2560, 1920], [1024, 768]]);
    assert.deepEqual(copies, [[2560, 1920]]);
    assert.equal(canvas.width, 1024); assert.equal(canvas.height, 768);
    assert.equal(blob.type, 'image/png');
    assert.equal(copy.width, 1);
});
test('capture failures restore the viewport and redraw the normal map', async () => {
    const canvas = { width: 1024, height: 768 }; let calls = 0;
    Object.assign(globalThis, { document: { createElement: () => ({ getContext: () => null }) } });
    await assert.rejects(captureMap(canvas as any, () => { calls++; }, 3840), /unavailable/);
    assert.deepEqual(canvas, { width: 1024, height: 768 }); assert.equal(calls, 2);
});
