import { describe, expect, it } from 'vitest';
import manifest from '../../../public/assets/audio/candidates/AUDITION_MANIFEST.json';
import productionManifest from '../../../public/assets/audio/ASSET_MANIFEST.json';

describe('audio audition quality gate', () => {
  it('keeps every legacy production asset explicitly rejected pending approval', () => {
    expect(productionManifest.catalogStatus).toBe('REJECTED_BY_PRODUCT_OWNER');
    expect(productionManifest.productionMapping).toBe('LEGACY_PENDING_HUMAN_APPROVAL');
    expect(productionManifest.assets).toHaveLength(24);
    expect(productionManifest.assets.every((asset) => asset.classification === 'REPLACE')).toBe(true);
  });

  it('provides the required candidate counts without approving or remapping production', () => {
    expect(manifest.status).toBe('PENDING_HUMAN_APPROVAL');
    expect(manifest.productionMappingChanged).toBe(false);
    expect(manifest.candidates).toHaveLength(61);
    const counts = Object.fromEntries([...new Set(manifest.candidates.map((candidate) => candidate.group))]
      .map((group) => [group, manifest.candidates.filter((candidate) => candidate.group === group).length]));
    for (const group of ['kingdom-music', 'battle-music', 'collect', 'upgrade-start', 'upgrade-complete', 'hero-upgrade', 'attack-start', 'sword-hit', 'arrow-shot', 'magic-cast', 'shield-wall', 'victory', 'defeat']) {
      expect(counts[group]).toBe(3);
    }
    for (const [group, count] of Object.entries(counts)) {
      expect(count, group).toBeGreaterThanOrEqual(group === 'kingdom-music' || group === 'battle-music' ? 3 : 2);
    }
  });

  it('records specific licensing and technical metadata for every candidate', () => {
    for (const candidate of manifest.candidates) {
      expect(candidate.filename).toMatch(/^\/assets\/audio\/candidates\/.+\.mp3$/);
      expect(candidate.source).toBe('OpenGameArt.org');
      expect(candidate.author.length).toBeGreaterThan(1);
      expect(candidate.license).toMatch(/^CC(?:0|-BY)/);
      expect(candidate.sourceReference).toMatch(/^https:\/\/opengameart\.org\/content\//);
      expect(candidate.productionSafe).toBe('YES');
      expect(candidate.approval).toBe('PENDING');
      expect(candidate.durationSeconds).toBeGreaterThan(0);
      expect(candidate.codec).toBe('mp3');
      expect(candidate.bitrate).toBeGreaterThan(64_000);
      expect(candidate.sizeBytes).toBeGreaterThan(500);
    }
  });
});
