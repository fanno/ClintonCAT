export class FussySearch {
    static score(source: string, target: string, options: IFussySearchOptions): number {
        source = source.trim();
        target = target.trim();

        if (!options.caseSensetive) source = source.toLowerCase();
        if (!options.caseSensetive) target = target.toLowerCase();

        if (source.length == 0) return 0;
        if (target.length == 0) return 0;
        if (source === target) return 1;

        const sourceLength = source.length;
        const targetLength = target.length;

        const lcsLength = this.longestCommonSubstring(source, target);
        const longestContig = this.LongestContiguousMatch(source, target);

        // base = how much of source is covered
        let score = lcsLength / sourceLength;

        // penelty for queary
        const shortPenentyLength = options.shortPenentyLength ?? 7;
        const shortPenentyValue = options.shortPenentyValue ?? 0.05;
        if (sourceLength < shortPenentyLength) {
            const penalty = (shortPenentyLength - sourceLength) * shortPenentyValue;
            score -= penalty;
        }

        // penalty for long target strings
        score *= sourceLength / Math.max(sourceLength, targetLength);

        // bonus for contiguous matches
        score += (longestContig / sourceLength) * (options.contiguousMatchBonus ?? 0.3);

        return Math.min(1, Math.max(0, score));
    }

    static longestCommonSubstring(source: string, target: string): number {
        const sourceLength = source.length;
        const targetLength = target.length;

        let prev = new Array<number>(targetLength + 1).fill(0);
        let curr = new Array<number>(targetLength + 1).fill(0);
        let maxLen = 0;
        for (let i = 1; i <= sourceLength; i++) {
            for (let j = 1; j <= targetLength; j++) {
                if (source[i - 1] === target[j - 1]) {
                    curr[j] = prev[j - 1] + 1;
                    maxLen = Math.max(maxLen, curr[j]);
                } else {
                    curr[j] = 0;
                }
            }
            [prev, curr] = [curr, prev];
        }
        return maxLen;
    }

    static LongestContiguousMatch(source: string, target: string): number {
        const sourceLength = source.length;
        const targetLength = target.length;

        let longestContig = 0;
        for (let i = 0; i < sourceLength; i++) {
            for (let j = 0; j < targetLength; j++) {
                let k = 0;
                while (i + k < sourceLength && j + k < targetLength && source[i + k] === target[j + k]) {
                    k++;
                    longestContig = Math.max(longestContig, k);
                }
            }
        }
        return longestContig;
    }
}

export interface IFussySearchOptions {
    caseSensetive?: boolean;
    shortPenentyLength?: number;
    shortPenentyValue?: number;
    contiguousMatchBonus?: number;
}
