import type { SceneDesc, SceneGroup } from './SceneBase.js';

export interface CatalogGame { system: string; group: SceneGroup; }
export function catalogGames(groups: (string | SceneGroup)[], includeHidden = false): CatalogGame[] {
    let system = 'Other';
    const result: CatalogGame[] = [];
    for (const item of groups) {
        if (typeof item === 'string') system = item;
        else if ((!item.hidden || includeHidden) && item.sceneDescs.some(d => typeof d !== 'string' && !d.hidden))
            result.push({ system, group: item });
    }
    return result;
}
export function sceneMaps(group: SceneGroup): SceneDesc[] {
    return group.sceneDescs.filter((d): d is SceneDesc => typeof d !== 'string' && !d.hidden);
}
export function matchesSearch(value: string, query: string): boolean {
    const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const text = normalize(value);
    return normalize(query).trim().split(/\s+/).every(token => text.includes(token));
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

export class GameBrowser {
    public elem = element('div', 'archive-browser');
    public onselect: (group: SceneGroup, desc: SceneDesc) => void = () => {};
    private games: CatalogGame[] = [];
    private system: string | null = null;
    private game: SceneGroup | null = null;
    private current: { group: string; map: string } | null = null;
    private query = '';
    private search = element('input', 'archive-search');
    private trail = element('div', 'archive-trail');
    private list = element('div', 'archive-list');
    private status = element('div', 'archive-status');
    private progress = element('div', 'archive-progress');
    private recent: { group: string; map: string }[] = [];

    constructor() {
        try { this.recent = JSON.parse(localStorage.getItem('noclip.archive.recent') || '[]').filter((r: any) => typeof r.group === 'string' && typeof r.map === 'string').slice(0, 6); } catch {}
        this.search.type = 'search';
        this.search.placeholder = 'Search games & maps';
        this.search.setAttribute('aria-label', 'Search games and maps');
        this.search.autocomplete = 'off';
        this.search.oninput = () => { this.query = this.search.value; this.render(); };
        const searchBox = element('div', 'archive-search-wrap');
        searchBox.append(element('span', 'archive-search-icon', '⌕'), this.search);
        this.list.setAttribute('aria-label', 'Game library');
        this.status.setAttribute('role', 'status');
        this.progress.setAttribute('role', 'progressbar');
        this.progress.setAttribute('aria-label', 'Map loading progress');
        this.progress.hidden = true;
        this.elem.append(searchBox, this.trail, this.list, this.status, this.progress);
    }

    public setCatalog(groups: (string | SceneGroup)[], includeHidden = false): void {
        this.games = catalogGames(groups, includeHidden);
        this.render();
    }
    public setCurrent(group: SceneGroup, desc: SceneDesc): void {
        this.current = { group: group.id, map: desc.id };
        this.game = group;
        this.system = this.games.find(g => g.group === group)?.system ?? null;
        this.recent = [this.current, ...this.recent.filter(r => r.group !== group.id || r.map !== desc.id)].slice(0, 6);
        try { localStorage.setItem('noclip.archive.recent', JSON.stringify(this.recent)); } catch {}
        this.render();
    }
    public setProgress(value: number): void {
        const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
        this.progress.hidden = pct === 100 || !Number.isFinite(pct);
        this.progress.style.setProperty('--load-progress', `${pct}%`);
        this.progress.setAttribute('aria-valuenow', String(pct));
        this.progress.setAttribute('aria-valuemin', '0');
        this.progress.setAttribute('aria-valuemax', '100');
        if (!this.progress.hidden) this.progress.textContent = `Loading world · ${pct}%`;
    }
    public focus(): void { this.search.focus(); }
    private navigate(system: string | null, game: SceneGroup | null): void {
        this.system = system; this.game = game; this.query = ''; this.search.value = ''; this.render();
    }
    private button(label: string, action: () => void, className = 'archive-crumb'): HTMLButtonElement {
        const b = element('button', className, label); b.type = 'button'; b.onclick = action; return b;
    }
    private heading(title: string, detail: string): void {
        const h = element('div', 'archive-section');
        h.append(element('h2', '', title), element('span', '', detail)); this.list.append(h);
    }
    private gameCard(item: CatalogGame): void {
        const card = this.button('', () => this.navigate(item.system, item.group), 'archive-game');
        const badge = element('span', 'archive-game-mark', item.group.name.slice(0, 1));
        const copy = element('span', 'archive-card-copy');
        copy.append(element('strong', '', item.group.name), element('small', '', `${item.system} · ${sceneMaps(item.group).length} worlds`));
        card.append(badge, copy, element('span', 'archive-arrow', '›')); this.list.append(card);
    }
    private mapCard(group: SceneGroup, desc: SceneDesc, subtitle?: string): void {
        const card = this.button('', () => this.onselect(group, desc), 'archive-map');
        const active = this.current?.group === group.id && this.current?.map === desc.id;
        if (active) card.setAttribute('aria-current', 'location');
        const copy = element('span', 'archive-card-copy');
        copy.append(element('strong', '', desc.name));
        if (subtitle) copy.append(element('small', '', subtitle));
        card.append(element('span', 'archive-map-mark', active ? '▶' : '◇'), copy, element('span', 'archive-arrow', active ? 'LIVE' : '↗'));
        this.list.append(card);
    }
    private render(): void {
        this.trail.replaceChildren(); this.list.replaceChildren();
        this.trail.append(this.button('Systems', () => this.navigate(null, null)));
        if (this.system) this.trail.append(element('span', '', '/'), this.button(this.system, () => this.navigate(this.system, null)));
        if (this.game) this.trail.append(element('span', '', '/'), element('span', 'archive-current-crumb', this.game.name));
        if (this.query.trim()) {
            this.heading('Search results', 'ALL SYSTEMS');
            let count = 0;
            for (const item of this.games) {
                if (count >= 100) break;
                if (matchesSearch(`${item.system} ${item.group.name} ${item.group.altName || ''}`, this.query)) { this.gameCard(item); count++; }
                else for (const desc of sceneMaps(item.group)) {
                    if (count >= 100) break;
                    if (matchesSearch(`${item.group.name} ${desc.name}`, this.query)) { this.mapCard(item.group, desc, item.group.name); count++; }
                }
            }
            if (count === 0) this.list.append(element('p', 'archive-empty', 'No worlds found. Try a different name.'));
            this.status.textContent = count === 100 ? 'Showing the first 100 matches · refine your search' : `${count} results`;
        } else if (this.game) {
            const maps = sceneMaps(this.game);
            this.heading(this.game.name, `${maps.length} WORLDS`);
            let section = '';
            for (const desc of this.game.sceneDescs) {
                if (typeof desc === 'string') section = desc;
                else if (!desc.hidden) {
                    if (section) { this.list.append(element('h3', 'archive-map-section', section)); section = ''; }
                    this.mapCard(this.game, desc);
                }
            }
            this.status.textContent = 'Select a world to enter the map';
        } else if (this.system) {
            const games = this.games.filter(g => g.system === this.system);
            this.heading(this.system, `${games.length} GAMES`);
            for (const game of games) this.gameCard(game);
            this.status.textContent = 'Select a game to browse its worlds';
        } else {
            this.heading('Choose your system', `${new Set(this.games.map(g => g.system)).size} SYSTEMS`);
            const grid = element('div', 'archive-systems');
            const abbreviations: Record<string, string> = { 'Nintendo 64': 'N64', GameCube: 'GCN', Wii: 'WII', 'Nintendo 3DS': '3DS', 'Nintendo DS': 'NDS', 'PlayStation 2': 'PS2', Xbox: 'XBOX', PC: 'PC', Experimental: 'LAB', Development: 'DEV' };
            let index = 0;
            for (const system of new Set(this.games.map(g => g.system))) {
                const games = this.games.filter(g => g.system === system);
                const card = this.button('', () => this.navigate(system, null), 'archive-system');
                card.style.setProperty('--system-accent', ['#a99bff', '#72d7c0', '#f6bd73', '#8ebcff'][index++ % 4]);
                card.append(element('span', 'archive-system-code', abbreviations[system] || system.slice(0, 3).toUpperCase()), element('strong', '', system), element('small', '', `${games.length} games · ${games.reduce((n, g) => n + sceneMaps(g.group).length, 0)} worlds`));
                grid.append(card);
            }
            this.list.append(grid);
            const recent = this.recent.flatMap(r => {
                const game = this.games.find(g => g.group.id === r.group)?.group;
                const desc = game && sceneMaps(game).find(d => d.id === r.map);
                return game && desc ? [{ game, desc }] : [];
            });
            if (recent.length) {
                this.heading('Recently explored', 'CONTINUE');
                for (const { game, desc } of recent) this.mapCard(game, desc, game.name);
            }
            this.status.textContent = `${this.games.length} games · a digital museum of video game worlds`;
        }
        this.list.scrollTop = 0;
    }
}
