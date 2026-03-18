import * as v from 'valibot';

export const LimiterMemoryDriverConfigSchema = v.object({
	limit: v.optional(
		v.pipe(v.number(), v.minValue(0.0001, 'limit must be greater than 0')),
	),
	period: v.optional(
		v.pipe(v.number(), v.minValue(0.0001, 'period must be greater than 0')),
	),
	onException: v.optional(v.function()),
	cleanupInterval: v.optional(
		v.pipe(
			v.number(),
			v.minValue(0.0001, 'cleanup interval must be greater than 0'),
		),
	),
});

export type LimiterMemoryDriverConfig = {
	limit?: number;
	period?: number;
	onException?: () => void;
	cleanupInterval?: number;
};

export function parseLimiterMemoryDriverConfig(
	input: unknown,
): LimiterMemoryDriverConfig {
	return v.parse(
		LimiterMemoryDriverConfigSchema,
		input,
	) as LimiterMemoryDriverConfig;
}

export const nonEmptyStringSchema = (label: string) =>
	v.pipe(v.string(), v.nonEmpty(`${label} must be a non-empty string`));

export function validateNonEmptyString(
	value: unknown,
	label: string,
): asserts value is string {
	const result = v.safeParse(nonEmptyStringSchema(label), value);
	if (result.issues) {
		throw new Error(result.issues[0]?.message ?? 'validation failed');
	}
}
