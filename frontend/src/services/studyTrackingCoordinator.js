// frontend/src/services/studyTrackingCoordinator.js
// Small in-memory registry used so AuthContext can finalize any active Study
// Session before the access token is revoked/removed during logout.
const activeFinalizers = new Set();

export function registerStudyTrackingFinalizer(finalizer) {
  if (typeof finalizer !== 'function') return () => {};

  activeFinalizers.add(finalizer);
  return () => activeFinalizers.delete(finalizer);
}

export async function finalizeActiveStudyTracking(reason = 'logout') {
  const finalizers = Array.from(activeFinalizers);
  if (finalizers.length === 0) return;

  await Promise.allSettled(
    finalizers.map((finalizer) => Promise.resolve(finalizer(reason)))
  );
}
