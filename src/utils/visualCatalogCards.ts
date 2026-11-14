import type { CatalogModelSuggestion, CatalogPhotoMatch } from '../services/aiVisualSearchService';

export type VisualCatalogCard = CatalogModelSuggestion & { imageId?: string };

/** One visual ranking, including catalog photos awaiting a product association. */
export function visualCatalogCards(models: CatalogModelSuggestion[], photos: CatalogPhotoMatch[]): VisualCatalogCard[] {
  const representedImages = new Set(models.filter(item => item.matchBasis === 'visual').map(item => item.image).filter(Boolean));
  const seen = new Set<string>();
  const cards: VisualCatalogCard[] = [...models];
  for (const photo of photos) {
    if (!photo.image || !Number.isFinite(photo.score) || representedImages.has(photo.image) || seen.has(photo.imageId)) continue;
    seen.add(photo.imageId);
    const family = photo.bindings.find(binding => binding.familyCode)?.familyCode || '';
    cards.push({
      imageId: photo.imageId, name: photo.label, image: photo.image,
      familyCode: family, familyName: photo.familyNames?.join('، ') || '',
      imageScope: family ? 'family' : 'none', matchBasis: 'visual',
      visualScore: photo.score, specs: [], reason: photo.reason,
    });
  }
  return cards.sort((a, b) => {
    const score = (item: VisualCatalogCard) => item.matchBasis === 'visual' && Number.isFinite(item.visualScore) ? item.visualScore! : -1;
    return score(b) - score(a);
  });
}
