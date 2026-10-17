import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/** Lab-only iterations do not run the full game's hundreds of tests. Missing
 * history fails safely toward BOTH suites. Existing game checks keep their ID. */
export function validationScope(files) {
  return {
    game: files.some(path => !path.startsWith('labs/gecko-forge/')),
    forge: files.some(path => /^(labs\/gecko-forge\/|src\/(genetics|engine|phenotype)\/|\.github\/)/.test(path)),
  };
}
if (process.env.GITHUB_OUTPUT) {
  let scope = { game: true, forge: true };
  const { BASE_SHA, HEAD_SHA } = process.env;
  if (/^[a-f0-9]{40}$/.test(BASE_SHA ?? '') && !/^0+$/.test(BASE_SHA) && /^[a-f0-9]{40}$/.test(HEAD_SHA ?? '')) {
    try {
      const files = execFileSync('git', ['diff', '--name-only', BASE_SHA, HEAD_SHA], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      scope = validationScope(files);
    } catch { /* Conservative full validation when base history is unavailable. */ }
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `game=${scope.game}\nforge=${scope.forge}\n`);
}
