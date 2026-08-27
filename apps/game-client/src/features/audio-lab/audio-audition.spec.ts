import { describe, expect, it } from 'vitest';
import approvedManifest from '../../../public/assets/audio/approved/APPROVED_MANIFEST.json';
import manifest from '../../../public/assets/audio/candidates/AUDITION_MANIFEST.json';
import productionManifest from '../../../public/assets/audio/ASSET_MANIFEST.json';

const approvedSelections = {
  'kingdom-music': 'B', 'battle-music': 'A', collect: 'B', 'upgrade-start': 'C',
  'upgrade-complete': 'C', 'hero-upgrade': 'A', 'attack-start': 'A', 'sword-hit': 'A',
  'arrow-shot': 'B', 'magic-cast': 'C', victory: 'A', back: 'A',
  'building-select': 'A', 'hero-select': 'A', 'find-enemy': 'A',
  'panel-open': 'B', 'shield-wall': 'B', defeat: 'A', 'ui-tap': 'A',
  'arrow-impact': 'C', 'magic-impact': 'A', 'hero-defeated': 'A',
  'incoming-attack': 'A', 'revenge-available': 'A',
};

describe('audio audition quality gate', () => {
  it('records and maps every explicit owner approval', () => {
    expect(productionManifest.catalogStatus).toBe('APPROVED');
    expect(productionManifest.productionMapping).toBe('24_OWNER_APPROVED_0_PENDING');
    expect(approvedManifest.status).toBe('APPROVED');
    expect(approvedManifest.approvedGroupCount).toBe(24);
    expect(Object.fromEntries(approvedManifest.assets.map((asset) => [asset.group, asset.selectedCandidate])))
      .toEqual(approvedSelections);
    expect(approvedManifest.assets.every((asset) => asset.filename.startsWith('/assets/audio/approved/'))).toBe(true);
  });

  it('closes the audition catalog after every group is approved', () => {
    expect(manifest.status).toBe('APPROVED');
    expect(manifest.productionMappingChanged).toBe(true);
    expect(manifest.approvedGroupCount).toBe(24);
    expect(manifest.pendingGroupCount).toBe(0);
    expect(manifest.pendingReason).toBeNull();
    expect(manifest.candidates).toHaveLength(0);
  });

  it('records licensing and technical metadata for every approved file', () => {
    for (const asset of approvedManifest.assets) {
      expect(asset.filename).toMatch(/^\/assets\/audio\/.+\.mp3$/);
      expect(asset.author.length).toBeGreaterThan(1);
      expect(asset.license).toMatch(/^CC(?:0|-BY)/);
      expect(asset.sourceReference).toMatch(/^https:\/\/opengameart\.org\/content\//);
      expect(asset.durationSeconds).toBeGreaterThan(0);
      expect(asset.codec).toBe('mp3');
      expect(asset.bitrate).toBeGreaterThan(64_000);
      expect(asset.sizeBytes).toBeGreaterThan(500);
    }
  });
});
