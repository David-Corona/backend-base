import { Prisma } from '@prisma/client';

export function getViolatedFields(
  meta: Prisma.PrismaClientKnownRequestError['meta'],
): string[] {
  if (meta == null) {
    return [];
  }

  if (Array.isArray(meta.target)) {
    return meta.target as string[];
  }

  const adapterError = meta as {
    driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } };
  };
  if (Array.isArray(adapterError.driverAdapterError?.cause?.constraint?.fields)) {
    return adapterError.driverAdapterError.cause.constraint.fields;
  }

  return [];
}
