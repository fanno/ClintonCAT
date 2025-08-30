import { IContentScannerPlugin, IScanParameters } from '@/common/services/content-scanner.types';
import { CATWikiPageSearchResults } from '@/database';

import Flexisearch from 'flexsearch';
import pagesDbJsonFile from '../../data/pages_db.json'; // assert { type: 'json' };

export abstract class BaseDomainScanner implements IContentScannerPlugin {
    abstract metaInfo(): string;
    abstract canScanContent(params: IScanParameters): boolean;
    protected abstract getDomainKeyForSearch(params: IScanParameters): string;

    protected extractEntity(_url: string): string | null {
        return null;
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
            if (results.totalPagesFound > 0) {
                console.log(`${scannerId}: Found ${results.totalPagesFound.toString()} pages via ${description}.`);
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

    // eslint-disable-next-line @typescript-eslint/require-await
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

        const extractedEntity = this.extractEntity(params.url);

        if (extractedEntity) {
            console.log(`${scannerId}: Extracted entity: "${extractedEntity}"`);

            foundAnyPages =
                this.performSearch(
                    () => pagesDb.getPagesForCategory(extractedEntity),
                    `Category Match ('${extractedEntity}')`,
                    combinedResults,
                    scannerId
                ) || foundAnyPages;

            foundAnyPages =
                this.performSearch(
                    () => pagesDb.findConsecutiveWords(extractedEntity, 1, true),
                    `Consecutive Words Match ('${extractedEntity}')`,
                    combinedResults,
                    scannerId
                ) || foundAnyPages;

            foundAnyPages =
                this.performSearch(
                    () => pagesDb.simpleSearch(extractedEntity),
                    `Simple Substring Match ('${extractedEntity}')`,
                    combinedResults,
                    scannerId
                ) || foundAnyPages;

            foundAnyPages =
                this.performSearch(
                    () => pagesDb.fuzzySearch(extractedEntity),
                    `Fuzzy Word Match ('${extractedEntity}')`,
                    combinedResults,
                    scannerId
                ) || foundAnyPages;
        } else {
            console.log(`${scannerId}: No specific entity extracted from URL, skipping entity-based searches.`);
        }

        if (params.innerText) {
            const lines = params.innerText.split('\n');
            const index = new Flexisearch.Index();

            let c = 1;
            lines.forEach((line) => {
                if (line.length > 20) {
                    //console.log('Line:', line);
                    index.add(c, line);
                    c++;
                }
            });

            const indexResults = index.search('HERO12 Black');
            console.log('Flexisearch:Index', indexResults);

            /*
            const doc = new Flexisearch.Document({
                document: {
                    id: 'id',
                    index: 'content',
                },
            });
            */

            const doc = new Flexisearch.Document({
                document: {
                    id: 'PageID',
                    index: [
                        {
                            field: 'Description',
                            tokenize: 'forward',
                        },
                        {
                            field: 'PageName',
                            tokenize: 'forward',
                        },
                        {
                            field: 'Company',
                            tokenize: 'forward',
                        },
                    ],
                    store: true,
                },
            });

            for (let y = 0, record; y < pagesDbJsonFile.Company.length; y++) {
                record = pagesDbJsonFile.Company[y];
                doc.add(record);
            }
            for (let y = 0, record; y < pagesDbJsonFile.Incident.length; y++) {
                record = pagesDbJsonFile.Incident[y];
                doc.add(record);
            }
            for (let y = 0, record; y < pagesDbJsonFile.Product.length; y++) {
                record = pagesDbJsonFile.Product[y];
                doc.add(record);
            }
            for (let y = 0, record; y < pagesDbJsonFile.ProductLine.length; y++) {
                record = pagesDbJsonFile.ProductLine[y];
                doc.add(record);
            }

            //const docResults = doc.search('HERO12 Black');
            //let search = 'HERO12 Black';
            //search = 'Amazon';
            /*
            const rank = (resultSet: unknown) => {
                const resultMap = new Map();
                resultSet.forEach((result) => {
                    let docs = result.result;
                    docs.forEach((doc) => {
                        let currentVal = resultMap.get(doc.id);
                        if (!currentVal) {
                            currentVal = {
                                score: 1,
                                doc: doc.doc,
                            };
                            resultMap.set(doc.id, currentVal);
                        } else {
                            // More fields matching means a higher score/rank
                            currentVal.score++;
                        }
                    });
                });
                // Sort the map based on the score property
                return new Map(
                    [...resultMap].sort((a, b) => {
                        return b[1].score - a[1].score;
                    })
                );
            };
            */

            lines.forEach((line) => {
                if (line.length > 20) {
                    const docResults = doc.search(line, {
                        index: ['Description', 'PageName', 'Company'],
                        limit: 3,
                        suggest: true,
                        enrich: true,
                    });
                    if (docResults.length > 0) {
                        console.log('Flexisearch:Document', line, docResults);
                    } else {
                        //console.log('Flexisearch:Document', line);
                    }
                }
            });
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
