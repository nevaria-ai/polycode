/**
 * Session Artifact Types
 *
 * Type definitions for artifacts produced during session execution.
 * Artifacts are auxiliary outputs like diffs, command results, diagnostics, etc.
 * Unlike parts which are the main timeline, artifacts are secondary payloads.
 *
 * These types provide structured metadata for different artifact types.
 */

// ============================================================================
// Artifact Type Constants
// ============================================================================

export const ARTIFACT_TYPES = {
	DIFF: 'diff',
	COMMAND_OUTPUT: 'command_output',
	DIAGNOSTICS: 'diagnostics',
	SEARCH_RESULTS: 'search_results',
	RAW_PROVIDER_OUTPUT: 'raw_provider_output',
	COMPACTION_SUMMARY: 'compaction_summary'
} as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[keyof typeof ARTIFACT_TYPES];

// ============================================================================
// Artifact Metadata Types
// ============================================================================

/**
 * Metadata for diff artifacts
 */
export interface DiffArtifactMetadata {
	filePath: string;
	oldHash?: string;
	newHash?: string;
	hunkCount: number;
	lineAdditions: number;
	lineDeletions: number;
	isBinary: boolean;
	diffFormat: 'unified' | 'git';
}

/**
 * Metadata for command output artifacts
 */
export interface CommandOutputArtifactMetadata {
	command: string;
	exitCode: number;
	durationMs?: number;
	shell?: string;
	workingDirectory?: string;
	timedOut?: boolean;
}

/**
 * Metadata for diagnostic artifacts
 */
export interface DiagnosticsArtifactMetadata {
	filePath?: string;
	diagnosticCount: number;
	errorCount: number;
	warningCount: number;
	infoCount: number;
	hintCount: number;
	source: 'typescript' | 'eslint' | 'pylint' | 'rustc' | 'go' | 'custom';
}

/**
 * Metadata for search results artifacts
 */
export interface SearchResultsArtifactMetadata {
	searchType: 'grep' | 'ripgrep' | 'find' | 'custom';
	query: string;
	path?: string;
	resultCount: number;
	fileCount: number;
	caseSensitive: boolean;
	regex: boolean;
	maxResults?: number;
}

/**
 * Metadata for raw provider output artifacts
 */
export interface RawProviderOutputMetadata {
	adapterType: 'claude-cli' | 'gemini-cli';
	model?: string;
	responseTimeMs?: number;
	tokenUsage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	truncated?: boolean;
	truncatedReason?: string;
	originalSize?: number;
	compressedSize?: number;
}

/**
 * Metadata for compaction summary artifacts
 */
export interface CompactionSummaryMetadata {
	sessionId: string;
	messagesBeforeCompaction: number;
	messagesAfterCompaction: number;
	messagesRemoved: number;
	summaryMessagePosition: number;
	tokensBeforeCompaction: number;
	tokensAfterCompaction: number;
	tokensSaved: number;
	compactionRatio: number; // percentage saved
	artifactsArchived: number;
	reason: 'token_limit' | 'manual' | 'auto';
}

/**
 * Discriminated union of all artifact metadata types
 */
export type ArtifactMetadata =
	| { type: 'diff'; metadata: DiffArtifactMetadata }
	| { type: 'command_output'; metadata: CommandOutputArtifactMetadata }
	| { type: 'diagnostics'; metadata: DiagnosticsArtifactMetadata }
	| { type: 'search_results'; metadata: SearchResultsArtifactMetadata }
	| { type: 'raw_provider_output'; metadata: RawProviderOutputMetadata }
	| { type: 'compaction_summary'; metadata: CompactionSummaryMetadata };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid artifact type
 */
export function isValidArtifactType(type: string): type is ArtifactType {
	return Object.values(ARTIFACT_TYPES).includes(type as ArtifactType);
}

/**
 * Type guard to check if metadata is valid for a given artifact type
 */
export function isValidArtifactMetadata(
	type: ArtifactType,
	metadata: unknown
): metadata is ArtifactMetadata {
	if (!metadata || typeof metadata !== 'object') {
		return false;
	}

	const meta = metadata as Record<string, unknown>;

	switch (type) {
		case 'diff':
			return (
				typeof meta.filePath === 'string' &&
				typeof meta.hunkCount === 'number' &&
				typeof meta.lineAdditions === 'number' &&
				typeof meta.lineDeletions === 'number' &&
				typeof meta.isBinary === 'boolean'
			);

		case 'command_output':
			return typeof meta.command === 'string' && typeof meta.exitCode === 'number';

		case 'diagnostics':
			return (
				typeof meta.diagnosticCount === 'number' &&
				typeof meta.errorCount === 'number' &&
				typeof meta.warningCount === 'number' &&
				typeof meta.source === 'string'
			);

		case 'search_results':
			return (
				typeof meta.searchType === 'string' &&
				typeof meta.query === 'string' &&
				typeof meta.resultCount === 'number'
			);

		case 'raw_provider_output':
			return typeof meta.adapterType === 'string';

		case 'compaction_summary':
			return (
				typeof meta.sessionId === 'string' &&
				typeof meta.messagesBeforeCompaction === 'number' &&
				typeof meta.messagesAfterCompaction === 'number' &&
				typeof meta.tokensBeforeCompaction === 'number' &&
				typeof meta.tokensAfterCompaction === 'number'
			);

		default:
			return false;
	}
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize artifact metadata to JSON string for storage
 */
export function serializeArtifactMetadata(metadata: ArtifactMetadata['metadata']): string {
	return JSON.stringify(metadata);
}

/**
 * Deserialize a JSON string to artifact metadata
 * Returns null if parsing fails
 */
export function deserializeArtifactMetadata(json: string): unknown {
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}

/**
 * Parse artifact metadata with type safety
 * Returns null if the metadata is invalid for the given type
 */
export function parseArtifactMetadata(type: ArtifactType, json: string | null): unknown {
	if (!json) {
		return null;
	}

	const metadata = deserializeArtifactMetadata(json);
	if (!metadata) {
		return null;
	}

	if (!isValidArtifactMetadata(type, metadata)) {
		return null;
	}

	return metadata;
}

// ============================================================================
// Artifact Creation Helpers
// ============================================================================

/**
 * Input for creating an artifact record.
 * Artifacts are auxiliary payloads attached to messages/parts.
 * Parts are the main timeline; artifacts are secondary outputs.
 */
export interface CreateArtifactInput {
	sessionId: string;
	messageId?: string;
	partId?: string;
	providerRunId?: string;
	type: ArtifactType;
	content: string;
	metadata?: ArtifactMetadata['metadata'];
}

export function createArtifactInput(input: CreateArtifactInput): {
	type: ArtifactType;
	content: string;
	metadata: string | null;
} {
	return {
		type: input.type,
		content: input.content,
		metadata: input.metadata ? serializeArtifactMetadata(input.metadata) : null
	};
}

/**
 * Calculate size metrics for artifacts
 */
export interface ArtifactSizeMetrics {
	contentSizeBytes: number;
	metadataSizeBytes: number;
	totalSizeBytes: number;
	estimatedTokenCount: number;
}

export function calculateArtifactSizeMetrics(
	content: string,
	metadata?: string | null
): ArtifactSizeMetrics {
	const contentSize = new Blob([content]).size;
	const metadataSize = metadata ? new Blob([metadata]).size : 0;
	const totalSize = contentSize + metadataSize;

	// Rough estimate: 4 chars per token, 1 byte per char (UTF-8 average)
	const estimatedTokens = Math.ceil(contentSize / 4);

	return {
		contentSizeBytes: contentSize,
		metadataSizeBytes: metadataSize,
		totalSizeBytes: totalSize,
		estimatedTokenCount: estimatedTokens
	};
}
