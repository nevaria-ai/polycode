package ops

import (
	"context"
	"encoding/json"
	"fmt"

	polydb "github.com/nevaria-ai/polycode/cgo/internal/db"
	"github.com/nevaria-ai/polycode/cgo/internal/dbstore"
)

const okJSON = `{"ok":true}`

type idArg struct {
	ID string `json:"id"`
}

type projectIDArg struct {
	ProjectID string `json:"project_id"`
}

type sessionIDArg struct {
	SessionID string `json:"session_id"`
}

type messageIDArg struct {
	MessageID string `json:"message_id"`
}

func jsonResult(v any, err error) (string, error) {
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func unmarshalArgs(argsJSON string, dst any) error {
	if argsJSON == "" {
		return nil
	}
	return json.Unmarshal([]byte(argsJSON), dst)
}

// WorkspaceOp dispatches workspace.sql queries. argsJSON uses snake_case keys matching sqlc params.
func WorkspaceOp(db *dbstore.DB, op string, argsJSON string) (string, error) {
	ctx := context.Background()
	q := db.Q

	switch op {
	case "CreateProject":
		var p polydb.CreateProjectParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.CreateProject(ctx, p)
		return jsonResult(row, err)
	case "ListProjects":
		rows, err := q.ListProjects(ctx)
		return jsonResult(rows, err)
	case "GetProject":
		var p idArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.GetProject(ctx, p.ID)
		return jsonResult(row, err)
	case "DeleteProject":
		var p idArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		err := q.DeleteProject(ctx, p.ID)
		if err != nil {
			return "", err
		}
		return okJSON, nil
	case "UpdateProjectExpandedState":
		var p polydb.UpdateProjectExpandedStateParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.UpdateProjectExpandedState(ctx, p)
		return jsonResult(row, err)
	case "CreateSession":
		var p polydb.CreateSessionParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.CreateSession(ctx, p)
		return jsonResult(row, err)
	case "GetSession":
		var p idArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.GetSession(ctx, p.ID)
		return jsonResult(row, err)
	case "ListSessionsByProject":
		var p projectIDArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		rows, err := q.ListSessionsByProject(ctx, p.ProjectID)
		return jsonResult(rows, err)
	case "ListAllSessions":
		rows, err := q.ListAllSessions(ctx)
		return jsonResult(rows, err)
	case "DeleteSession":
		var p idArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		err := q.DeleteSession(ctx, p.ID)
		if err != nil {
			return "", err
		}
		return okJSON, nil
	case "UpdateSessionTitle":
		var p polydb.UpdateSessionTitleParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		err := q.UpdateSessionTitle(ctx, p)
		if err != nil {
			return "", err
		}
		return okJSON, nil
	case "ArchiveSession":
		var p polydb.ArchiveSessionParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		err := q.ArchiveSession(ctx, p)
		if err != nil {
			return "", err
		}
		return okJSON, nil
	default:
		return "", fmt.Errorf("unknown workspace op: %q", op)
	}
}

// TranscriptOp dispatches transcript.sql queries.
func TranscriptOp(db *dbstore.DB, op string, argsJSON string) (string, error) {
	ctx := context.Background()
	q := db.Q

	switch op {
	case "CreateMessage":
		var p polydb.CreateMessageParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.CreateMessage(ctx, p)
		return jsonResult(row, err)
	case "ListMessagesBySession":
		var p sessionIDArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		rows, err := q.ListMessagesBySession(ctx, p.SessionID)
		return jsonResult(rows, err)
	case "GetMessage":
		var p idArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.GetMessage(ctx, p.ID)
		return jsonResult(row, err)
	case "NextMessagePosition":
		var p sessionIDArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		pos, err := q.NextMessagePosition(ctx, p.SessionID)
		return jsonResult(map[string]int64{"position": pos}, err)
	case "CreatePart":
		var p polydb.CreatePartParams
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		row, err := q.CreatePart(ctx, p)
		return jsonResult(row, err)
	case "ListPartsByMessage":
		var p messageIDArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		rows, err := q.ListPartsByMessage(ctx, p.MessageID)
		return jsonResult(rows, err)
	case "ListPartsBySession":
		var p sessionIDArg
		if err := unmarshalArgs(argsJSON, &p); err != nil {
			return "", err
		}
		rows, err := q.ListPartsBySession(ctx, p.SessionID)
		return jsonResult(rows, err)
	default:
		return "", fmt.Errorf("unknown transcript op: %q", op)
	}
}
