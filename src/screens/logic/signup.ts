/** Sign up rule: every way to create a family account needs the parent or guardian box ticked first. */
import type { Result } from '../../shared/account';

/**
 * Runs one sign-up path (email, Apple, Google or Facebook) only when the grown-up box is ticked.
 * Unticked: nothing is called, `needAdult` shows the message, and the result is null.
 */
export async function startSignup<T>(adult: boolean, run: () => Promise<Result<T>>, needAdult: () => void): Promise<Result<T> | null> {
  if (!adult) {
    needAdult();
    return null;
  }
  return run();
}
