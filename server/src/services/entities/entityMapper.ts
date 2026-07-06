import { GLiNEREntities } from './types';

export const mapGLiNEREntitiesToFlatArray = (entities: GLiNEREntities): string[] => {
  const flatArray: string[] = [];

  if (entities.persons) flatArray.push(...entities.persons);
  if (entities.organizations) flatArray.push(...entities.organizations);

  // Deduplicate and trim
  const cleaned = flatArray.map(e => e.trim()).filter(e => e.length > 0);
  return Array.from(new Set(cleaned));
};
