import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

export function isOnPath(command: string, pathVariable: string | undefined): boolean {
  if (!pathVariable) return false;
  return pathVariable
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => {
      try {
        accessSync(join(dir, command), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
}
