// Bind one gh API request to its originating account. Credential output stays
// inside this short-lived process and is never sent to the plugin host.
import { execFile, spawn } from 'node:child_process'

const [gh, login, timeout, ...args] = process.argv.slice(2)
let child
process.once('SIGTERM', () => {
  child?.kill('SIGKILL')
  process.exit(1)
})

child = execFile(gh, ['auth', 'token', '--hostname', 'github.com', '--user', login], {
  encoding: 'utf8', timeout: Number(timeout), maxBuffer: 64 * 1024,
}, (error, output) => {
  const token = output.trim()
  if (error || !token) {
    process.stderr.write('无法使用当前账号的 gh 授权，请重新检查登录状态\n')
    process.exitCode = 1
    return
  }
  child = spawn(gh, args, { stdio: 'inherit', env: { ...process.env, GH_TOKEN: token } })
  child.on('error', (cause) => {
    process.stderr.write(`无法启动 gh API 请求（${cause.code ?? 'unknown'}）\n`)
    process.exitCode = 1
  })
  child.on('close', (code) => { process.exitCode = code ?? 1 })
})
child.stdin.end()
