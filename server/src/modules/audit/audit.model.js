import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Audit failures must never break the user-facing operation.
export async function audit(actorId, action, entity, entityId, changes) {
  try {
    await AuditLog.create({ actorId, action, entity, entityId, changes });
  } catch (err) {
    console.error('audit log failed', err.message);
  }
}
