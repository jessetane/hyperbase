import cp from 'child_process'
import { Deferred } from './util.js'

export {
	spawn,
	delay
}

function spawn (cmd, opts = {}) {
	const parts = cmd.split(' ')
	cmd = parts[0]
	const args = parts.slice(1)
	const process = cp.spawn(cmd, args, opts)
	const onclose = new Deferred()
	let stdout = []
	let stderr = []
	process.stdout.on('data', data => stdout.push(data))
	process.stderr.on('data', data => stderr.push(data))
	process.on('close', code => {
		stdout = Buffer.concat(stdout).toString().trim()
		stderr = Buffer.concat(stderr).toString().trim()
		if (code === 0) {
			onclose.resolve({ stdout, stderr })
		} else {
			onclose.reject(new Error(cmd + ' exited nonzero: ' + code + ': ' + stderr))
		}
	})
	return {
		process,
		onclose,
		stdout: () => Buffer.concat(stdout).toString().trim(),
		stderr: () => Buffer.concat(stderr).toString().trim(),
	}
}

function delay (ms) {
	return new Promise(s => setTimeout(s, ms))
}
