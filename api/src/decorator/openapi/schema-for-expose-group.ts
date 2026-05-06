import type { SchemaObject } from 'openapi3-ts'
import { getMetadataArgsStorage as getTypeOrmMetadataArgsStorage } from 'typeorm'

/** Minimal surface used from class-transformer's metadata storage. */
type ExposeGroupStorage = {
  getExposedMetadatas(target: Function): Array<{
    propertyName?: string
    options?: { groups?: string[] }
  }>
}

function hasGroup(
  groups: string[] | undefined,
  group: string,
): groups is string[] {
  return Array.isArray(groups) && groups.includes(group)
}

function hasMeaningfulSchemaShape(schema: unknown): schema is SchemaObject {
  if (!schema || typeof schema !== 'object') return false
  const candidate = schema as SchemaObject & {
    $ref?: string
    oneOf?: unknown[]
    allOf?: unknown[]
    anyOf?: unknown[]
  }
  if (
    candidate.$ref ||
    candidate.oneOf ||
    candidate.allOf ||
    candidate.anyOf ||
    candidate.enum ||
    candidate.items ||
    candidate.properties
  ) {
    return true
  }
  if (candidate.type == null) {
    return false
  }
  if (candidate.type !== 'object') {
    return true
  }
  return candidate.additionalProperties != null
}

function isEntityLikeReflectedType(type: Function): boolean {
  const nonEntityTypes = new Set<Function>([
    String,
    Number,
    Boolean,
    Date,
    Array,
    Object,
  ])
  return !nonEntityTypes.has(type)
}

function resolveEntityPropertyType(
  entityClass: Function,
  propertyName: string,
): Function | undefined {
  const reflectedType = Reflect.getMetadata(
    'design:type',
    entityClass.prototype,
    propertyName,
  ) as Function | undefined
  if (reflectedType && isEntityLikeReflectedType(reflectedType)) {
    return reflectedType
  }

  const relationMeta = getTypeOrmMetadataArgsStorage().relations.find(
    (relation) =>
      relation.target === entityClass && relation.propertyName === propertyName,
  )
  if (typeof relationMeta?.type === 'function') {
    const type = relationMeta.type()
    if (typeof type === 'function' && isEntityLikeReflectedType(type)) {
      return type
    }
  }

  return reflectedType
}

function inferEntityRefSchema(
  entityClass: Function,
  propertyName: string,
  group: string,
  componentsSchemas: Record<string, SchemaObject>,
): SchemaObject | undefined {
  const propertyType = resolveEntityPropertyType(entityClass, propertyName)
  if (!propertyType || !isEntityLikeReflectedType(propertyType)) {
    return undefined
  }

  const groupedSchemaName = `${propertyType.name}_${group}`
  if (componentsSchemas[groupedSchemaName]) {
    return { $ref: `#/components/schemas/${groupedSchemaName}` } as SchemaObject
  }

  if (componentsSchemas[propertyType.name]) {
    return { $ref: `#/components/schemas/${propertyType.name}` } as SchemaObject
  }

  return undefined
}

/**
 * Build a JSON Schema object whose properties match {@link Expose} metadata for
 * class-transformer group `group` (e.g. OpenAPI response/body decorator
 * `response.transformGroups` / `response.options.serializationGroup`).
 *
 * Property shapes are taken from {@link componentsSchemas}[entityClass.name] when present;
 * otherwise {@link pickPropertySchema} can supply a fallback (e.g. properties without
 * class-validator decorators).
 */
export function schemaForClassTransformGroup(
  entityClass: Function,
  group: string,
  componentsSchemas: Record<string, SchemaObject>,
  classTransformerStorage: ExposeGroupStorage,
  pickPropertySchema?: (
    entityClass: Function,
    propertyName: string,
  ) => SchemaObject | undefined,
): SchemaObject {
  const componentName = entityClass.name
  const full = componentsSchemas[componentName]
  const properties: NonNullable<SchemaObject['properties']> = {}

  for (const meta of classTransformerStorage.getExposedMetadatas(entityClass)) {
    const prop = meta.propertyName
    if (!prop || !hasGroup(meta.options?.groups, group)) continue

    const fromCv = full?.properties?.[prop]
    if (hasMeaningfulSchemaShape(fromCv)) {
      properties[prop] = fromCv as SchemaObject
      continue
    }

    const fallback =
      pickPropertySchema?.(entityClass, prop) ??
      inferEntityRefSchema(entityClass, prop, group, componentsSchemas)
    if (fallback) {
      properties[prop] = fallback
    }
  }

  return {
    type: 'object',
    description: `Subset of ${componentName} serialized with class-transformer group "${group}".`,
    properties,
  }
}
