import { execFileSync } from 'node:child_process'

if (process.env.SKIP_GIT_HOOKS !== '1') {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' })
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
  } catch {
    // Installing from an archive or deployment environment without Git is valid.
  }
}
