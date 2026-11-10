import { prisma } from '../db.mjs';

export async function writeAudit(tx, { actorId = null, action, entityType = null, entityId = null, requestId = null, metadata = null }) {
  return tx.auditLog.create({
    data: { actorId, action, entityType, entityId, requestId, metadata },
  });
}
