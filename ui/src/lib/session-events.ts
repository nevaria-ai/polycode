/**
 * Session Event Types
 *
 * Typed event name constants and discriminated unions for session event payloads.
 * These types ensure type safety when logging and replaying session events.
 *
 * Event Schema Version: 2 (message-based, replaces turn-based v1)
 */

// ============================================================================
// Event Name Constants
// ============================================================================

export const SESSION_EVENT_NAMES = {
	SESSION_CREATED: 'session.created',
	SESSION_ENDED: 'session.ended',
	SESSION_ARCHIVED: 'session.archived',
	SESSION_RENAMED: 'session.renamed',
	MESSAGE_USER_ADDED: 'message.user_added',
	MESSAGE_ASSISTANT_ADDED: 'message.assistant_added',
	SLASH_RESOLVED: 'slash.resolved',
	MENTION_RESOLVED: 'mention.resolved',
	CONTEXT_RESOLVED: 'context.resolved',
	CONTEXT_ATTACHED: 'context.attached',
	PROMPT_COMPILED: 'prompt.compiled',
	PROVIDER_RUN_STARTED: 'provider.run_started',
	PROVIDER_RUN_FINISHED: 'provider.run_finished',
	SESSION_COMPACTED: 'session.compacted',
	PIN_ADDED: 'pin.added',
	PIN_REMOVED: 'pin.removed'
} as const;

export type SessionEventName = (typeof SESSION_EVENT_NAMES)[keyof typeof SESSION_EVENT_NAMES];

// ============================================================================
// Payload Types
// ============================================================================

/**
 * Base event payload with optional metadata
 */
export interface BaseEventPayload {
	timestamp?: string;
	correlationId?: string;
}

/**
 * Payload for session.created event
 */
export interface SessionCreatedPayload extends BaseEventPayload {
	sessionId: string;
	projectId: string;
	worktreePath: string;
	initialTitle?: string;
}

/**
 * Payload for session.ended event
 */
export interface SessionEndedPayload extends BaseEventPayload {
	sessionId: string;
	reason?: 'user_action' | 'error' | 'timeout';
	totalMessages: number;
	durationMs?: number;
}

/**
 * Payload for session.archived event
 */
export interface SessionArchivedPayload extends BaseEventPayload {
	sessionId: string;
	reason?: 'manual' | 'age_limit' | 'storage_limit';
}

/**
 * Payload for session.renamed event
 */
export interface SessionRenamedPayload extends BaseEventPayload {
	sessionId: string;
	oldTitle: string | null;
	newTitle: string;
}

/**
 * Payload for message.user_added event
 */
export interface MessageUserAddedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	position: number;
	contentPreview: string; // First 100 chars
	attachedContextCount: number;
}

/**
 * Payload for message.assistant_added event
 */
export interface MessageAssistantAddedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	position: number;
	providerRunId?: string;
	contentPreview: string; // First 100 chars
	tokenCount?: number;
}

/**
 * Payload for slash.resolved event
 */
export interface SlashResolvedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	slashCommand: string;
	argument?: string;
	resolvedAction: string;
}

/**
 * Payload for mention.resolved event
 */
export interface MentionResolvedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	mentionType: 'file' | 'folder' | 'search' | 'url' | 'diagnostics';
	source: string; // Original @ reference
	resolvedPath?: string;
	itemId: string;
}

/**
 * Payload for context.resolved event
 * Emitted when @ mentions are resolved and attached to a message
 */
export interface ContextResolvedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	contextItemIds: string[];
	contextItemCount: number;
}

/**
 * Payload for context.attached event
 */
export interface ContextAttachedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	contextItemId: string;
	contextType: string;
	attachType: 'inline' | 'pinned';
}

/**
 * Payload for prompt.compiled event
 */
export interface PromptCompiledPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	totalTokens: number;
	contextItemCount: number;
	pinnedContextCount: number;
	systemPromptIncluded: boolean;
}

/**
 * Payload for provider.run_started event
 */
export interface ProviderRunStartedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	providerRunId: string;
	adapterType: 'claude-cli' | 'gemini-cli';
	model?: string;
}

/**
 * Payload for provider.run_finished event
 */
export interface ProviderRunFinishedPayload extends BaseEventPayload {
	sessionId: string;
	messageId: string;
	providerRunId: string;
	status: 'succeeded' | 'failed_pre' | 'failed_exec' | 'failed_parse';
	durationMs?: number;
	tokenCount?: {
		input?: number;
		output?: number;
	};
	errorMessage?: string;
}

/**
 * Payload for session.compacted event
 */
export interface SessionCompactedPayload extends BaseEventPayload {
	sessionId: string;
	messagesCompacted: number;
	summaryId: string;
	summaryMessagePosition: number;
	tokensBeforeCompaction: number;
	tokensAfterCompaction: number;
	artifactIds: string[]; // IDs of created compaction_summary artifacts
}

/**
 * Payload for pin.added event
 */
export interface PinAddedPayload extends BaseEventPayload {
	sessionId: string;
	contextItemId: string;
	contextType: string;
}

/**
 * Payload for pin.removed event
 */
export interface PinRemovedPayload extends BaseEventPayload {
	sessionId: string;
	contextItemId: string;
	reason?: 'user_action' | 'context_no_longer_relevant';
}

// ============================================================================
// Discriminated Union
// ============================================================================

/**
 * Discriminated union of all event payloads
 * Use this to type-check event payloads based on event type
 */
export type SessionEventPayload =
	| { type: 'session.created'; payload: SessionCreatedPayload }
	| { type: 'session.ended'; payload: SessionEndedPayload }
	| { type: 'session.archived'; payload: SessionArchivedPayload }
	| { type: 'session.renamed'; payload: SessionRenamedPayload }
	| { type: 'message.user_added'; payload: MessageUserAddedPayload }
	| { type: 'message.assistant_added'; payload: MessageAssistantAddedPayload }
	| { type: 'slash.resolved'; payload: SlashResolvedPayload }
	| { type: 'mention.resolved'; payload: MentionResolvedPayload }
	| { type: 'context.resolved'; payload: ContextResolvedPayload }
	| { type: 'context.attached'; payload: ContextAttachedPayload }
	| { type: 'prompt.compiled'; payload: PromptCompiledPayload }
	| { type: 'provider.run_started'; payload: ProviderRunStartedPayload }
	| { type: 'provider.run_finished'; payload: ProviderRunFinishedPayload }
	| { type: 'session.compacted'; payload: SessionCompactedPayload }
	| { type: 'pin.added'; payload: PinAddedPayload }
	| { type: 'pin.removed'; payload: PinRemovedPayload };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an event name is valid
 */
export function isValidSessionEventName(name: string): name is SessionEventName {
	return Object.values(SESSION_EVENT_NAMES).includes(name as SessionEventName);
}

/**
 * Type guard to narrow event payload based on event type
 */
export function isSessionEventPayload(event: {
	type: string;
	payload: unknown;
}): event is SessionEventPayload {
	return isValidSessionEventName(event.type);
}

// ============================================================================
// Event Creation Helpers
// ============================================================================

/**
 * Create a typed session event object
 */
export function createSessionEvent<T extends SessionEventName>(
	type: T,
	payload: SessionEventPayload extends { type: T; payload: infer P } ? P : never
): SessionEventPayload {
	return { type, payload } as SessionEventPayload;
}

/**
 * Serialize an event payload to JSON string for storage
 */
export function serializeEventPayload(payload: SessionEventPayload['payload']): string {
	return JSON.stringify(payload);
}

/**
 * Deserialize a JSON string to an event payload
 * Note: This returns unknown and should be validated with a type guard
 */
export function deserializeEventPayload(json: string): unknown {
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}
