import { IContentScannerPlugin, IScanParameters } from '@/common/services/content-scanner.types';
import { CATWikiPageSearchResults } from '@/database';

export abstract class BaseDomainScanner implements IContentScannerPlugin {
    abstract metaInfo(): string;
    abstract canScanContent(params: IScanParameters): boolean;
    protected abstract getDomainKeyForSearch(params: IScanParameters): string;

    protected extractEntity(_url: string): string | null {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
    protected async searchContent(params: IScanParameters): Promise<string[]> {
        return [];
    }

    private performSearch(
        searchFn: () => CATWikiPageSearchResults,
        description: string,
        combinedResults: CATWikiPageSearchResults,
        scannerId: string
    ): boolean {
        let found = false;
        console.log(`${scannerId}: Attempting search: ${description}`);
        try {
            const results = searchFn();
            if (results.pageEntries.length > 0) {
                console.log(`${scannerId}: Found ${results.pageEntries.length.toString()} pages via ${description}.`);
                combinedResults.addPageEntries(results.pageEntries);
                found = true;
            } else {
                console.log(`${scannerId}: No pages found via ${description}.`);
            }
        } catch (error) {
            if (
                description.includes('Consecutive Words') &&
                error instanceof Error &&
                error.message.startsWith('Unimplemented')
            ) {
                console.warn(`${scannerId}: Skipped unimplemented search feature: ${description} (${error.message})`);
            } else {
                console.error(`${scannerId}: Error during search (${description}):`, error);
            }
        }
        return found;
    }

    async scan(params: IScanParameters): Promise<boolean> {
        const pagesDb = params.pagesDb;
        let foundAnyPages = false;
        const combinedResults = new CATWikiPageSearchResults();
        const scannerId = this.metaInfo() || this.constructor.name;

        console.log(`${scannerId}: Starting scan for URL: ${params.url}`);

        const domainSearchKey = this.getDomainKeyForSearch(params);
        foundAnyPages =
            this.performSearch(
                () => pagesDb.fuzzySearch(domainSearchKey),
                `Domain Key Fuzzy Search ('${domainSearchKey}')`,
                combinedResults,
                scannerId
            ) || foundAnyPages;

        let entries: string[] = [];

        const extractedEntity = this.extractEntity(params.url);
        if (extractedEntity) {
            entries.push(extractedEntity);
        }

        const searchContentResults = await this.searchContent(params);
        entries = entries.concat(searchContentResults);

        if (entries.length > 0) {
            entries.forEach((entry) => {
                console.log(`${scannerId}: Extracted entity: "${entry}"`);

                foundAnyPages =
                    this.performSearch(
                        () => pagesDb.getPagesForCategory(entry),
                        `Category Match ('${entry}')`,
                        combinedResults,
                        scannerId
                    ) || foundAnyPages;

                foundAnyPages =
                    this.performSearch(
                        () => pagesDb.findConsecutiveWords(entry, 1, true),
                        `Consecutive Words Match ('${entry}')`,
                        combinedResults,
                        scannerId
                    ) || foundAnyPages;

                foundAnyPages =
                    this.performSearch(
                        () => pagesDb.simpleSearch(entry),
                        `Simple Substring Match ('${entry}')`,
                        combinedResults,
                        scannerId
                    ) || foundAnyPages;

                foundAnyPages =
                    this.performSearch(
                        () => pagesDb.fuzzySearch(entry),
                        `Fuzzy Word Match ('${entry}')`,
                        combinedResults,
                        scannerId
                    ) || foundAnyPages;
            });
        } else {
            console.log(`${scannerId}: No specific entity extracted from URL, skipping entity-based searches.`);
        }

        const uniquePageIds = new Set<number>();
        const uniquePageEntries = combinedResults.pageEntries.filter((entry) => {
            if (uniquePageIds.has(entry.pageId)) {
                return false;
            }
            uniquePageIds.add(entry.pageId);
            return true;
        });

        const finalResults = new CATWikiPageSearchResults(uniquePageEntries);
        const totalUniquePagesFound = finalResults.totalPagesFound;

        if (totalUniquePagesFound > 0) {
            console.log(`${scannerId}: Notifying with ${totalUniquePagesFound.toString()} unique total pages found.`);
            params.notify(finalResults);
        } else {
            console.log(`${scannerId}: No relevant pages found after all searches.`);
        }

        return foundAnyPages;
    }
}
