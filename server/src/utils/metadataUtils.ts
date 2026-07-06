/**
 * Safe utility to convert Mongoose Map, standard Map, or any object containing metadata
 * to a clean, plain JavaScript object. It explicitly strips any Mongoose internal properties
 * that might have leaked during object spreads.
 */
export const getPlainMetadata = (metadata: any): Record<string, any> => {
  if (!metadata) return {};

  let plain: Record<string, any>;

  // 1. Convert standard Map or Mongoose Map
  if (metadata instanceof Map) {
    plain = Object.fromEntries(metadata);
  }
  // 2. Convert objects exposing entries()
  else if (typeof metadata.entries === 'function') {
    try {
      plain = Object.fromEntries(metadata.entries());
    } catch (e) {
      plain = { ...metadata };
    }
  }
  // 3. Convert Mongoose Documents/Subdocuments exposing toObject()
  else if (typeof metadata.toObject === 'function') {
    const obj = metadata.toObject();
    if (obj instanceof Map) {
      plain = Object.fromEntries(obj);
    } else if (obj && typeof obj.entries === 'function') {
      try {
        plain = Object.fromEntries(obj.entries());
      } catch (e) {
        plain = { ...obj };
      }
    } else {
      plain = { ...obj };
    }
  }
  // 4. Default plain object spread
  else {
    plain = { ...metadata };
  }

  // 5. Defensively strip leaked Mongoose internal properties
  delete plain.$__parent;
  delete plain.$__path;
  delete plain.$__schemaType;
  delete plain.$__deferred;

  return plain;
};
