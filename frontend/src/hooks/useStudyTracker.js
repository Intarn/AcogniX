// frontend/src/hooks/useStudyTracker.js
import { useEffect, useRef } from 'react';
import { pingStudySession } from '../services/analyticsService';
import { registerStudyTrackingFinalizer } from '../services/studyTrackingCoordinator';

const CHECKPOINT_INTERVAL_MS = 30_000; // UC03: persist every 30 seconds
const IDLE_TIMEOUT_MS = 120_000;       // UC03 Alt Flow 1: pause after 2 minutes idle
const IDLE_CHECK_INTERVAL_MS = 1_000;

function createClientSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `study-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Tracks active study time only while an AI Project is selected.
 *
 * A Study Session starts on the first meaningful interaction, not merely when
 * the page is mounted. The latest active checkpoint is persisted every 30s.
 * The session is finalized when the Project is closed/switched, the page is
 * hidden/unmounted, or 2 consecutive minutes of inactivity are detected.
 */
export function useStudyTracker(projectId = null, isTrackingEnabled = true) {
  const trackerRef = useRef(null);
  const requestQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!isTrackingEnabled || !projectId) {
      trackerRef.current = null;
      return undefined;
    }

    let disposed = false;

    const startSessionIfNeeded = (timestamp) => {
      if (trackerRef.current) return;

      trackerRef.current = {
        sessionId: createClientSessionId(),
        startedAt: timestamp,
        lastActivityAt: timestamp,
        lastCheckpointAt: timestamp
      };
    };

    const recordActivity = () => {
      if (disposed || document.visibilityState !== 'visible') return;

      const now = Date.now();
      startSessionIfNeeded(now);
      trackerRef.current.lastActivityAt = now;
    };

    const enqueueRequest = (payload, keepalive) => {
      requestQueueRef.current = requestQueueRef.current
        .catch(() => null)
        .then(() => pingStudySession(payload, { keepalive }))
        .catch((err) => {
          console.warn('[StudyTracker] Failed to persist study session:', err);
          return null;
        });

      return requestQueueRef.current;
    };

    const sendSnapshot = ({ finalize = false, reason = 'checkpoint', keepalive = false } = {}) => {
      const snapshot = trackerRef.current;
      if (!snapshot) return Promise.resolve(null);

      // Nothing meaningful happened after the session started.
      if (snapshot.lastActivityAt <= snapshot.startedAt && !finalize) {
        return Promise.resolve(null);
      }

      const payload = {
        sessionId: snapshot.sessionId,
        projectId,
        startedAt: new Date(snapshot.startedAt).toISOString(),
        endedAt: new Date(snapshot.lastActivityAt).toISOString(),
        finalize,
        reason
      };

      // A finalization consumes the local session immediately so cleanup,
      // visibilitychange, and logout/navigation cannot submit it twice.
      if (finalize) {
        trackerRef.current = null;
      } else {
        snapshot.lastCheckpointAt = Date.now();
      }

      // Serialize checkpoint/finalize requests. If the Learner closes a Project
      // while a 30-second checkpoint is still in flight, the final snapshot is
      // queued instead of being silently dropped.
      return enqueueRequest(payload, keepalive);
    };

    const finalizeCurrentSession = (reason, keepalive = false) => {
      const snapshot = trackerRef.current;
      if (!snapshot) return Promise.resolve(null);

      // A single click/keypress with zero elapsed time should not create a
      // misleading positive duration. It is safe to discard locally.
      if (snapshot.lastActivityAt <= snapshot.startedAt) {
        trackerRef.current = null;
        return Promise.resolve(null);
      }

      return sendSnapshot({ finalize: true, reason, keepalive });
    };

    const meaningfulEvents = ['keydown', 'scroll', 'click', 'touchstart', 'wheel'];
    meaningfulEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });

    const timerId = window.setInterval(() => {
      const snapshot = trackerRef.current;
      if (!snapshot) return;

      const now = Date.now();
      const idleFor = now - snapshot.lastActivityAt;

      if (idleFor >= IDLE_TIMEOUT_MS) {
        // End at the final meaningful interaction so the idle period itself is
        // excluded from accumulated active study time.
        finalizeCurrentSession('idle-timeout');
        return;
      }

      if (now - snapshot.lastCheckpointAt >= CHECKPOINT_INTERVAL_MS) {
        sendSnapshot({ finalize: false, reason: '30-second-checkpoint' });
      }
    }, IDLE_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        finalizeCurrentSession('page-hidden', true);
      }
    };

    const handlePageHide = () => {
      finalizeCurrentSession('page-hide', true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    const unregisterLogoutFinalizer = registerStudyTrackingFinalizer((reason) =>
      finalizeCurrentSession(reason || 'logout', true)
    );

    return () => {
      unregisterLogoutFinalizer();
      disposed = true;
      window.clearInterval(timerId);
      meaningfulEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);

      // Covers Project switch/close and normal SPA navigation (including the
      // path to Settings before the Learner logs out).
      finalizeCurrentSession('project-closed-or-navigation', true);
    };
  }, [projectId, isTrackingEnabled]);
}
