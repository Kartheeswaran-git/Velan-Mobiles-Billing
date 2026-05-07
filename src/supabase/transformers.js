function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

export function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function camelizeRecord(input) {
  if (Array.isArray(input)) {
    return input.map(camelizeRecord);
  }
  if (!isObject(input)) {
    return input;
  }

  return Object.entries(input).reduce((accumulator, [key, value]) => {
    accumulator[toCamelCase(key)] = camelizeRecord(value);
    return accumulator;
  }, {});
}

export function snakeizeRecord(input) {
  if (Array.isArray(input)) {
    return input.map(snakeizeRecord);
  }
  if (!isObject(input)) {
    return input;
  }

  return Object.entries(input).reduce((accumulator, [key, value]) => {
    accumulator[toSnakeCase(key)] = snakeizeRecord(value);
    return accumulator;
  }, {});
}
