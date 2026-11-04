import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Build dist/ once per test run; e2e files spawn the built CLI and run in parallel.
export default function setup(): void {
  execFileSync('npx', ['tsup', '--silent'], { cwd: join(import.meta.dirname, '../..'), stdio: 'ignore' });
}
