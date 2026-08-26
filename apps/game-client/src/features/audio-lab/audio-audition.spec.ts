import { describe, expect, it } from 'vitest';
import approvedManifest from '../../../public/assets/audio/approved/APPROVED_MANIFEST.json';
import manifest from '../../../public/assets/audio/candidates/AUDITION_MANIFEST.json';
import productionManifest from '../../../public/assets/audio/ASSET_MANIFEST.json';

const approvedSelections = {
  'kingdom-music': 'B', 'battle-music': 'A', collect: 'B', 'upgrade-start': 'C',
  'upgrade-complete': 'C', 'hero-upgrade': 'A', 'attack-start': 'A', 'sword-hit': 'A',
  'arrow-shot': 'B', 'magic-cast': 'C', victory: 'A', back: 'A',
  'building-select': 'A', 'hero-select': 'A', 'find-enemy': 'A',
};

describe('audio audition quality gate', () => {
  it('records and maps every explicit owner approval', () => {
    expect(productionManifest.catalogStatus).toBe('PARTIALLY_APPROVED');
    expect(productionManifest.productionMapping).toBe('15_OWNER_APPROVED_9_SILENT_PENDING');
    expect(approvedManifest.status).toBe('PARTIALLY_APPROVED');
    expect(approvedManifest.approvedGroupCount).toBe(15);
    expect(Object.fromEntries(approvedManifest.assets.map((asset) => [asset.group, asset.selectedCandidate])))
      .toEqual(approvedSelections);
    expect(approvedManifest.assets.every((asset) => asset.filename.startsWith('/assets/audio/approved/'))).toBe(true);
  });

  it('keeps approved groups out of the reduced pending audition', () => {
    expect(manifest.status).toBe('PARTIALLY_APPROVED');
    expect(manifest.productionMappingChanged).toBe(true);
    expect(manifest.approvedGroupCount).toBe(15);
    expect(manifest.pendingGroupCount).toBe(9);
    expect(manifest.candidates).toHaveLength(26);
    const groups = [...new Set(manifest.candidates.map((candidate) => candidate.group))];
    expect(groups).toEqual(['panel-open', 'shield-wall', 'defeat', 'ui-tap', 'arrow-impact', 'magic-impact', 'hero-defeated', 'incoming-attack', 'revenge-available']);
    for (const group of Object.keys(approvedSelections)) expect(groups).not.toContain(group);
    expect(manifest.candidates.filter((candidate) => candidate.group === 'panel-open')).toHaveLength(2);
    expect(manifest.candidates.filter((candidate) => candidate.auditionRound === 2)).toHaveLength(24);
  });

  it('records licensing and technical metadata for approved and pending files', () => {
    for (const asset of [...approvedManifest.assets, ...manifest.candidates]) {
      expect(asset.filename).toMatch(/^\/assets\/audio\/.+\.mp3$/);
      expect(asset.author.length).toBeGreaterThan(1);
      expect(asset.license).toMatch(/^CC(?:0|-BY)/);
      expect(asset.sourceReference).toMatch(/^https:\/\/opengameart\.org\/content\//);
      expect(asset.durationSeconds).toBeGreaterThan(0);
      expect(asset.codec).toBe('mp3');
      expect(asset.bitrate).toBeGreaterThan(64_000);
      expect(asset.sizeBytes).toBeGreaterThan(500);
    }
    expect(manifest.candidates.every((candidate) => candidate.productionSafe === 'YES' && candidate.approval === 'PENDING')).toBe(true);
  });
});
