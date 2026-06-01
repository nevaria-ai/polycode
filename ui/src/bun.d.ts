/**
 * Bun Runtime Type Declarations
 *
 * This file provides TypeScript declarations for Bun-specific APIs.
 * Bun includes built-in support for SQLite via the 'bun:sqlite' module.
 *
 * See: https://bun.sh/docs/api/sqlite
 */

declare module 'bun:sqlite' {
	/**
	 * SQLite Database interface
	 */
	export class Database {
		constructor(path: string, options?: { readonly?: boolean; create?: boolean });

		/**
		 * Execute a SQL query
		 */
		exec(sql: string): void;

		/**
		 * Prepare a SQL statement
		 */
		prepare(sql: string): Statement;

		/**
		 * Close the database connection
		 */
		close(): void;

		/**
		 * Check if database is open
		 */
		get isOpen(): boolean;

		/**
		 * Get the database path
		 */
		get inTransaction(): boolean;
	}

	/**
	 * Prepared SQL Statement
	 */
	export class Statement {
		/**
		 * Execute the prepared statement with values
		 */
		run(values?: unknown[]): RunResult;

		/**
		 * Execute and get all results
		 */
		all(values?: unknown[]): unknown[];

		/**
		 * Execute and get first result
		 */
		get(values?: unknown[]): unknown | null;

		/**
		 * Execute and get final column value
		 */
		values(values?: unknown[]): unknown[];

		/**
		 * Get the SQL string
		 */
		get sql(): string;

		/**
		 * Get the database
		 */
		get database(): Database;
	}

	/**
	 * Result of a query execution
	 */
	export interface RunResult {
		/**
		 * Number of rows changed
		 */
		changes: number;

		/**
		 * Last inserted row ID
		 */
		lastInsertRowid: number | bigint;
	}
}
