import { PrismaClient, WorkflowStatus, ChangeType } from '@prisma/client';

const prisma = new PrismaClient();

export class WorkflowService {
  /**
   * Transition an observation to APPROVED status
   */
  static async approveObservation(observationId: string, userEmail: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const obs = await tx.observation.findUnique({
        where: { id: observationId },
      });

      if (!obs) {
        throw new Error(`Observation with ID ${observationId} not found.`);
      }

      if (obs.workflowStatus === WorkflowStatus.PUBLISHED) {
        throw new Error('Cannot approve an already published observation.');
      }

      const updated = await tx.observation.update({
        where: { id: observationId },
        data: {
          workflowStatus: WorkflowStatus.APPROVED,
          updatedBy: userEmail,
        },
      });

      // Write to ObservationHistory
      await tx.observationHistory.create({
        data: {
          observationId: obs.id,
          changeType: ChangeType.STATUS_CHANGE,
          fieldName: 'workflowStatus',
          oldValue: obs.workflowStatus,
          newValue: WorkflowStatus.APPROVED,
          reason: 'Observation approved by workflow',
          changedBy: userEmail,
        },
      });

      // Write to AuditLog
      await tx.auditLog.create({
        data: {
          userEmail,
          action: 'APPROVE',
          entityType: 'Observation',
          entityId: obs.id,
          newValues: { workflowStatus: WorkflowStatus.APPROVED },
        },
      });
    });
  }

  /**
   * Reject an observation with a reason
   */
  static async rejectObservation(observationId: string, reason: string, userEmail: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const obs = await tx.observation.findUnique({
        where: { id: observationId },
      });

      if (!obs) {
        throw new Error(`Observation with ID ${observationId} not found.`);
      }

      if (obs.workflowStatus === WorkflowStatus.PUBLISHED) {
        throw new Error('Cannot reject an already published observation.');
      }

      const updated = await tx.observation.update({
        where: { id: observationId },
        data: {
          workflowStatus: WorkflowStatus.REJECTED,
          updatedBy: userEmail,
        },
      });

      // Write to ObservationHistory
      await tx.observationHistory.create({
        data: {
          observationId: obs.id,
          changeType: ChangeType.STATUS_CHANGE,
          fieldName: 'workflowStatus',
          oldValue: obs.workflowStatus,
          newValue: WorkflowStatus.REJECTED,
          reason: reason || 'Observation rejected by workflow',
          changedBy: userEmail,
        },
      });

      // Write to AuditLog
      await tx.auditLog.create({
        data: {
          userEmail,
          action: 'REJECT',
          entityType: 'Observation',
          entityId: obs.id,
          newValues: { workflowStatus: WorkflowStatus.REJECTED, rejectionReason: reason },
        },
      });
    });
  }

  /**
   * Publish a set of observations. Uses standard transaction to execute.
   * If a unique index violation occurs, it is caught and reported.
   */
  static async publishObservations(observationIds: string[], userEmail: string): Promise<{ success: boolean; publishedCount: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const id of observationIds) {
          const obs = await tx.observation.findUnique({
            where: { id },
          });

          if (!obs) {
            throw new Error(`Observation with ID ${id} not found.`);
          }

          if (obs.isPublished) {
            continue; // Already published
          }

          // Update observation state
          await tx.observation.update({
            where: { id },
            data: {
              workflowStatus: WorkflowStatus.PUBLISHED,
              isPublished: true,
              publishedAt: new Date(),
              updatedBy: userEmail,
            },
          });

          // Write to ObservationHistory
          await tx.observationHistory.create({
            data: {
              observationId: obs.id,
              changeType: ChangeType.PUBLISH,
              fieldName: 'isPublished',
              oldValue: 'false',
              newValue: 'true',
              reason: 'Observation published to production',
              changedBy: userEmail,
            },
          });

          // Write to AuditLog
          await tx.auditLog.create({
            data: {
              userEmail,
              action: 'PUBLISH',
              entityType: 'Observation',
              entityId: obs.id,
              newValues: { isPublished: true, workflowStatus: WorkflowStatus.PUBLISHED },
            },
          });

          count++;
        }
        return count;
      });

      return { success: true, publishedCount: result };
    } catch (err: any) {
      // Catch duplicate key value unique constraint error from PostgreSQL (code 'P2002')
      if (err.code === 'P2002') {
        return {
          success: false,
          publishedCount: 0,
          error: 'Publishing conflict: Another version of this observation is already published.',
        };
      }
      return {
        success: false,
        publishedCount: 0,
        error: err.message || 'An error occurred during publishing.',
      };
    }
  }

  /**
   * Unpublish a set of observations
   */
  static async unpublishObservations(observationIds: string[], userEmail: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const id of observationIds) {
        const obs = await tx.observation.findUnique({
          where: { id },
        });

        if (!obs) {
          throw new Error(`Observation with ID ${id} not found.`);
        }

        if (!obs.isPublished) {
          continue;
        }

        await tx.observation.update({
          where: { id },
          data: {
            workflowStatus: WorkflowStatus.APPROVED, // Fallback to approved
            isPublished: false,
            publishedAt: null,
            updatedBy: userEmail,
          },
        });

        // Write to ObservationHistory
        await tx.observationHistory.create({
          data: {
            observationId: obs.id,
            changeType: ChangeType.UNPUBLISH,
            fieldName: 'isPublished',
            oldValue: 'true',
            newValue: 'false',
            reason: 'Observation unpublished',
            changedBy: userEmail,
          },
        });

        // Write to AuditLog
        await tx.auditLog.create({
          data: {
            userEmail,
            action: 'UNPUBLISH',
            entityType: 'Observation',
            entityId: obs.id,
            newValues: { isPublished: false, workflowStatus: WorkflowStatus.APPROVED },
          },
        });
      }
    });
  }
}
