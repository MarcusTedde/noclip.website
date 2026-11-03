import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogGames, sceneMaps, matchesSearch } from '../src/GameBrowser.js';
const map = (id: string, hidden = false) => ({ id, name: id, hidden, createScene: async () => null });
const game = (id: string, hidden = false) => ({ id, name: id, hidden, sceneDescs: ['Area', map('Opening'), map('Debug', true)] });
test('catalog preserves console groups while excluding hidden and empty games', () => {
    const visible = game('Visible'); const secret = game('Secret', true);
    const entries = ['Nintendo 64', visible, secret, 'PC', { id: 'empty', name: 'Empty', sceneDescs: [] }];
    assert.deepEqual(catalogGames(entries as any).map(g => [g.system, g.group.id]), [['Nintendo 64', 'Visible']]);
    assert.equal(catalogGames(entries as any, true).length, 2);
    assert.deepEqual(sceneMaps(visible as any).map(d => d.id), ['Opening']);
});
test('search supports accents, case and multiple words', () => {
    assert.equal(matchesSearch('Pokémon Snap / Nintendo 64', 'POKEMON 64'), true);
    assert.equal(matchesSearch('Super Mario Sunshine', 'mario sunshine'), true);
    assert.equal(matchesSearch('Super Mario Sunshine', 'mario galaxy'), false);
});
