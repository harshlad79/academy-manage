export type OpenBankingTransaction = {
	externalId: string;
	amountKrw: number;
	depositedAt: Date;
	memo?: string;
};

function hashSeed(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	}
	return Math.abs(h);
}

/**
 * Deterministic stub: returns 0–2 mock deposits whose `depositedAt` falls in `[from, to]`.
 * Empty when `OPEN_BANKING_ENABLED` is not exactly `'true'`.
 */
export function fetchOpenBankingStubTransactions(opts: {
	from: Date;
	to: Date;
}): OpenBankingTransaction[] {
	if (process.env.OPEN_BANKING_ENABLED !== 'true') {
		return [];
	}

	const { from, to } = opts;
	const fromMs = from.getTime();
	const toMs = to.getTime();
	if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
		return [];
	}

	const key = `${from.toISOString()}\0${to.toISOString()}`;
	const seed = hashSeed(key);
	const count = seed % 3;
	if (count === 0) {
		return [];
	}

	const span = toMs - fromMs;
	const out: OpenBankingTransaction[] = [];

	for (let i = 0; i < count; i++) {
		const tNum = fromMs + Math.floor((span * ((seed + i * 7919) % 10000)) / 10000);
		const depositedAt = new Date(tNum);
		const amountKrw = ((seed + i * 17) % 900_000) + 1;
		out.push({
			externalId: `stub-${seed}-${i}`,
			amountKrw,
			depositedAt,
			memo: i === 0 ? 'open-banking stub' : undefined
		});
	}

	return out;
}

export function isOpenBankingConfigured(): boolean {
	const enabled = process.env.OPEN_BANKING_ENABLED === 'true';
	const id = (process.env.OPEN_BANKING_CLIENT_ID ?? '').trim();
	return enabled && id.length > 0;
}
