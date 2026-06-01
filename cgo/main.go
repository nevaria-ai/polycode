package main

/*
#include <stdint.h>
*/
import "C"

import (
	"runtime/cgo"
	"unsafe"

	"github.com/codeignus/ffi/boundary"
	"github.com/nevaria-ai/polycode/cgo/internal/dbstore"
	"github.com/nevaria-ai/polycode/cgo/internal/ops"
)

//export db_open
func db_open(cPath *C.char) C.uintptr_t {
	h, err := dbstore.Open(C.GoString(cPath))
	if err != nil {
		return 0
	}
	return C.uintptr_t(h)
}

//export db_open_memory
func db_open_memory() C.uintptr_t {
	h, err := dbstore.Open(":memory:")
	if err != nil {
		return 0
	}
	return C.uintptr_t(h)
}

//export db_close
func db_close(handle C.uintptr_t) {
	_ = dbstore.Close(cgo.Handle(handle))
}

func exportOpInto(
	handle C.uintptr_t,
	callCtx unsafe.Pointer,
	run func(*dbstore.DB, string, string) (string, error),
) uint32 {
	read, transportStatus := boundary.ReadCall(callCtx)
	if transportStatus != boundary.FfiStatusOk {
		return transportStatus.Uint32()
	}

	opName, argsJSON, ok := splitOpPayload(read.Payload)
	if !ok {
		boundary.WriteCallError(callCtx, "invalid op payload")
		return boundary.FfiStatusInvalidArg.Uint32()
	}

	db, err := dbstore.FromHandle(cgo.Handle(handle))
	if err != nil {
		boundary.WriteCallError(callCtx, err.Error())
		return boundary.FfiStatusInvalidHandle.Uint32()
	}

	responseJSON, err := run(db, opName, argsJSON)
	if err != nil {
		boundary.WriteCallError(callCtx, err.Error())
		return boundary.FfiStatusUnknown.Uint32()
	}

	return boundary.WriteCall(callCtx, read.WriteOff, []byte(responseJSON)).Uint32()
}

//export workspace_op_into
func workspace_op_into(handle C.uintptr_t, callCtx unsafe.Pointer) uint32 {
	return exportOpInto(handle, callCtx, ops.WorkspaceOp)
}

//export transcript_op_into
func transcript_op_into(handle C.uintptr_t, callCtx unsafe.Pointer) uint32 {
	return exportOpInto(handle, callCtx, ops.TranscriptOp)
}

func main() {}
