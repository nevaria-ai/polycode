export type CliProfile = {
	id: string;
	name: string;
	command: string;
	args: string[];
	env: Record<string, string>;
	predefined: boolean;
	resumeFlag: string;
};
