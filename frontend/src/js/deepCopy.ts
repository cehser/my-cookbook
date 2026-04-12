import yaml from "js-yaml";

/**
 * Create a deep copy of an object using YAML serialization
 * This preserves complex data structures better than JSON
 */
export function deepCopyYaml<T>(src: T): T {
  return yaml.load(yaml.dump(src)) as T;
}

/**
 * Create a deep copy of an object using JSON serialization
 * Faster than YAML but doesn't handle all data types (e.g., Date, undefined)
 */
export function deepCopyJSON<T>(src: T): T {
  return JSON.parse(JSON.stringify(src)) as T;
}
