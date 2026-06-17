import { compareEntities } from './services/entities/entityComparator';
import { mapGLiNEREntitiesToFlatArray } from './services/entities/entityMapper';

const runTests = () => {
  console.log('--- TEST: Person Extraction Mapping ---');
  const glinerPerson = { persons: ['Parth Tawde'], organizations: [], locations: [] };
  const flatPerson = mapGLiNEREntitiesToFlatArray(glinerPerson);
  console.log('Mapped:', flatPerson);

  console.log('--- TEST: Organization Extraction Mapping ---');
  const glinerOrg = { persons: [], organizations: ['University of Hertfordshire'], locations: [] };
  const flatOrg = mapGLiNEREntitiesToFlatArray(glinerOrg);
  console.log('Mapped:', flatOrg);

  console.log('--- TEST: Location Extraction Mapping ---');
  const glinerLoc = { persons: [], organizations: [], locations: ['Hatfield'] };
  const flatLoc = mapGLiNEREntitiesToFlatArray(glinerLoc);
  console.log('Mapped:', flatLoc);

  console.log('--- TEST: Comparison Logic ---');
  const geminiEntities = ['Parth Tawde', 'University of Hertfordshire', 'Some Random Thing'];
  const glinerEntities = ['parth tawde', 'university of hertfordshire', 'London'];
  
  const comp = compareEntities(geminiEntities, glinerEntities);
  console.log('Comparison Result:', JSON.stringify(comp, null, 2));
};

runTests();
