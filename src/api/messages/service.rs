use serde::Deserialize;

use crate::api::messages::model::{Message, Part};
use crate::db::DbHandle;
use crate::error::AppError;

#[derive(Clone)]
pub struct Service {
    db: DbHandle,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub mentions: Option<Vec<String>>,
    pub slash_command: Option<String>,
}

impl Service {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub async fn send_message(
        &self,
        session_id: &str,
        req: &SendMessageRequest,
    ) -> Result<Message, AppError> {
        self.create_message(session_id, "user", &req.content).await
    }

    pub async fn list_messages(&self, session_id: &str) -> Result<Vec<Message>, AppError> {
        self.db
            .transcript_many(
                "ListMessagesBySession",
                &serde_json::json!({ "session_id": session_id }),
            )
            .map_err(AppError::from)
    }

    pub async fn create_agent_reply(
        &self,
        session_id: &str,
        _message_id: &str,
        content: &str,
    ) -> Result<Message, AppError> {
        self.create_message(session_id, "assistant", content).await
    }

    pub async fn get_message(&self, id: &str) -> Result<Option<Message>, AppError> {
        self.db
            .transcript_optional("GetMessage", &serde_json::json!({ "id": id }))
            .map_err(AppError::from)
    }

    pub async fn create_part(
        &self,
        message_id: &str,
        session_id: &str,
        part_type: &str,
        content: &str,
        position: i64,
        metadata: Option<&str>,
    ) -> Result<Part, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        self.db
            .transcript_one(
                "CreatePart",
                &serde_json::json!({
                    "id": id,
                    "message_id": message_id,
                    "session_id": session_id,
                    "type": part_type,
                    "content": content,
                    "position": position,
                    "metadata": metadata,
                }),
            )
            .map_err(AppError::from)
    }

    pub async fn get_parts_by_message(&self, message_id: &str) -> Result<Vec<Part>, AppError> {
        self.db
            .transcript_many(
                "ListPartsByMessage",
                &serde_json::json!({ "message_id": message_id }),
            )
            .map_err(AppError::from)
    }

    pub async fn get_parts_by_session(&self, session_id: &str) -> Result<Vec<Part>, AppError> {
        self.db
            .transcript_many(
                "ListPartsBySession",
                &serde_json::json!({ "session_id": session_id }),
            )
            .map_err(AppError::from)
    }

    async fn create_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<Message, AppError> {
        let id = uuid::Uuid::new_v4().to_string();
        #[derive(Deserialize)]
        struct NextPos {
            position: i64,
        }
        let NextPos { position } = self
            .db
            .transcript_one(
                "NextMessagePosition",
                &serde_json::json!({ "session_id": session_id }),
            )
            .map_err(AppError::from)?;

        self.db
            .transcript_one(
                "CreateMessage",
                &serde_json::json!({
                    "id": id,
                    "session_id": session_id,
                    "role": role,
                    "position": position,
                    "content": content,
                }),
            )
            .map_err(AppError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{memory_db, seed_project_and_session};

    #[tokio::test]
    async fn create_message() {
        let db = memory_db();
        let (_, session_id) = seed_project_and_session(db.clone()).await;
        let svc = Service::new(db);

        let msg = svc
            .send_message(
                &session_id,
                &SendMessageRequest {
                    content: "Hello, world!".into(),
                    mentions: None,
                    slash_command: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(msg.session_id, session_id);
        assert_eq!(msg.role, "user");
        assert_eq!(msg.content, "Hello, world!");
        assert_eq!(msg.position, 0);
    }

    #[tokio::test]
    async fn auto_increment_position() {
        let db = memory_db();
        let (_, session_id) = seed_project_and_session(db.clone()).await;
        let svc = Service::new(db);

        let req = |content: &str| SendMessageRequest {
            content: content.into(),
            mentions: None,
            slash_command: None,
        };

        let m0 = svc.send_message(&session_id, &req("a")).await.unwrap();
        let m1 = svc.send_message(&session_id, &req("b")).await.unwrap();
        let m2 = svc.send_message(&session_id, &req("c")).await.unwrap();

        assert_eq!(m0.position, 0);
        assert_eq!(m1.position, 1);
        assert_eq!(m2.position, 2);
    }
}
