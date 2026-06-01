package main

import "bytes"

// splitOpPayload: `op + "\n" + args_json` in call_ctx scratch (input_off/len).
func splitOpPayload(payload []byte) (op, args string, ok bool) {
	i := bytes.IndexByte(payload, '\n')
	if i < 0 {
		return "", "", false
	}
	return string(payload[:i]), string(payload[i+1:]), true
}
