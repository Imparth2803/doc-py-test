import Document from '../models/Document';
import ProcessingJob from '../models/ProcessingJob';
import { logError } from '../utils/logger';

/**
 * Identifies and recovers documents stuck in PROCESSING state for too long.
 * Threshold: 30 minutes
 */
export const recoverZombieDocuments = async () => {
  const TIMEOUT_MS = 30 * 60 * 1000;
  const timeoutDate = new Date(Date.now() - TIMEOUT_MS);

  try {
    // Find documents stuck in PROCESSING
    // Check lastHeartbeatAt first, fallback to processingStartedAt
    const stuckDocuments = await Document.find({
      status: 'PROCESSING',
      $or: [
        { lastHeartbeatAt: { $lt: timeoutDate } },
        { 
          lastHeartbeatAt: { $exists: false }, 
          processingStartedAt: { $lt: timeoutDate } 
        }
      ]
    });

    if (stuckDocuments.length === 0) return;

    console.log(`[RECOVERY] Found ${stuckDocuments.length} zombie documents.`);

    for (const doc of stuckDocuments) {
      console.log(`[RECOVERY] Processing recovery for document: ${doc._id}`);

      // Mark document as FAILED
      doc.status = 'FAILED';
      doc.processingFailedAt = new Date();
      await doc.save();

      // Update associated ProcessingJob
      const job = await ProcessingJob.findOne({ documentId: doc._id });
      if (job) {
        job.status = 'FAILED';
        job.failedAt = new Date();
        job.errorMessage = "Processing timeout (Zombie Recovery)";
        job.errorLogs.push(`${new Date().toISOString()} - RECOVERY: Document was stuck in PROCESSING for > 30 mins.`);
        await job.save();
      }

      logError({
        documentId: doc._id.toString(),
        stage: "ZOMBIE_RECOVERY",
        message: "Processing timed out and was recovered by system."
      });
    }
  } catch (error: any) {
    console.error("[RECOVERY_ERROR]", error);
    logError({
      stage: "ZOMBIE_RECOVERY_CRITICAL",
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * Starts the recovery monitor
 */
export const startRecoveryMonitor = () => {
  console.log("[RECOVERY] Starting Zombie Document Recovery Monitor (Interval: 10m)");
  
  // Run every 10 minutes
  setInterval(recoverZombieDocuments, 10 * 60 * 1000);
  
  // Also run once on startup
  setTimeout(recoverZombieDocuments, 5000);
};
