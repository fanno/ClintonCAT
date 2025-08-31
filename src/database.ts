import { CompanyPage, ICompanyCargo } from '@/models/company';
import { IIncidentCargo, IncidentPage } from '@/models/incident';
import { Page } from '@/models/page';
import { IProductCargo, ProductPage } from '@/models/product';
import { IProductLineCargo, ProductLinePage } from '@/models/product-line';
import escapeRegex from '@/utils/helpers/escape-regex';
import pagesDbJsonFile from '../data/pages_db.json'; // assert { type: 'json' };

import fuzzysort from 'fuzzysort';

export interface ICargoExport {
    Company: ICompanyCargo[];
    Incident: IIncidentCargo[];
    Product: IProductCargo[];
    ProductLine: IProductLineCargo[];
}

export class CATWikiPageSearchResults {
    private _pageEntries: Page[] = [];

    constructor(pageEntries: Page[] = []) {
        this.addPageEntries(pageEntries);
    }

    public addPageEntry(pageEntry: Page): void {
        this._pageEntries = [...this._pageEntries, pageEntry];
    }

    public addPageEntries(pageEntries: readonly Page[]): void {
        for (const pageEntry of pageEntries) {
            this.addPageEntry(pageEntry);
        }
    }

    get totalPagesFound(): number {
        return this._pageEntries.length;
    }

    get pageEntries(): readonly Page[] {
        return this._pageEntries;
    }
}

export class PagesDB {
    static readonly PAGES_DB_JSON_URL: string =
        'https://raw.githubusercontent.com/WKDLabs/CATWikiCargoPrototype/refs/heads/export/data/all_cargo_combined.json';
    private companyPages: CompanyPage[] = [];
    private incidentPages: IncidentPage[] = [];
    private productPages: ProductPage[] = [];
    private productLinePages: ProductLinePage[] = [];

    static readonly pagesDbDefault: ICargoExport = pagesDbJsonFile;

    get allPages(): Page[] {
        return ([] as Page[]).concat(this.companyPages, this.incidentPages, this.productPages, this.productLinePages);
    }

    // load the baked in pagesdb json as an initial db, just in case...
    public initDefaultPages(): void {
        this.setPages(PagesDB.pagesDbDefault);
    }

    public getDefaultPages(): ICargoExport {
        return PagesDB.pagesDbDefault;
    }

    public setPages(cargoExport: ICargoExport) {
        this.companyPages = cargoExport.Company.map((companyEntry) => CompanyPage.fromCargoExport(companyEntry));
        this.incidentPages = cargoExport.Incident.map((incidentEntry) => IncidentPage.fromCargoExport(incidentEntry));
        this.productPages = cargoExport.Product.map((productEntry) => ProductPage.fromCargoExport(productEntry));
        this.productLinePages = cargoExport.ProductLine.map((productLineEntry) =>
            ProductLinePage.fromCargoExport(productLineEntry)
        );
    }
    public getPagesForDomain(domain: string): CATWikiPageSearchResults {
        return this.fuzzySearch(domain);
    }

    public getPagesForCategory(categoryName: string): CATWikiPageSearchResults {
        const lowerCategoryName = categoryName.toLowerCase();
        const results = new CATWikiPageSearchResults();
        const pageEntries = this.allPages.filter((page) => {
            if (page instanceof CompanyPage) {
                return page.industries.some((industry) => industry.toLowerCase() === lowerCategoryName);
            }
            if (page instanceof ProductPage || page instanceof ProductLinePage) {
                return page.categories.some((category) => category.toLowerCase() === lowerCategoryName);
            }
            return false;
        });
        results.addPageEntries(pageEntries);
        return results;
    }

    public simpleSearch(query: string): CATWikiPageSearchResults {
        const lowerQuery = query.toLowerCase();
        const results = new CATWikiPageSearchResults();
        for (const page of this.allPages) {
            if (page.pageName.toLowerCase().includes(lowerQuery)) {
                results.addPageEntry(page);
            }
        }
        return results;
    }

    public findConsecutiveWords(query: string, maxResults = 1, onlyFromStart = true): CATWikiPageSearchResults {
        if (maxResults != 1) {
            throw new Error('Unimplemented: maxResults != 1');
        }
        if (!onlyFromStart) {
            throw new Error('Unimplemented: onlyFromStart = false');
        }

        const searchWords = query.toLowerCase().split(' ');
        let maxInOrderCount = 0;
        let foundPage = null;

        for (const page of this.allPages) {
            const titleWords = page.pageName.toLowerCase().split(' ');
            let thisInOrderCount = 0;
            const maxIndex = Math.min(searchWords.length, titleWords.length);

            for (let index = 0; index < maxIndex; index++) {
                if (searchWords[index] === titleWords[index]) {
                    thisInOrderCount++;
                }
            }
            if (thisInOrderCount > maxInOrderCount) {
                maxInOrderCount = thisInOrderCount;
                foundPage = page;
            }
        }
        const results = new CATWikiPageSearchResults();

        if (foundPage != null) {
            results.addPageEntry(foundPage);
        }
        return results;
    }

    public fuzzySearch(query: string, matchAllWords: boolean = false): CATWikiPageSearchResults {
        const lowerQueryWords = query.toLowerCase().split(/\s+/);
        const results = new CATWikiPageSearchResults();

        const pages = this.allPages
            .map((page) => {
                const lowerTitle = page.pageName.toLowerCase();
                let matchCount = 0;
                for (const word of lowerQueryWords) {
                    // Use word boundaries to reduce false positives
                    // and escape special regex characters to handle queries like "(test)".
                    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
                    if (regex.test(lowerTitle)) {
                        matchCount++;
                    }
                }
                return { pageEntry: page, matchCount };
            })
            .filter(({ matchCount }) => (matchAllWords ? matchCount === lowerQueryWords.length : matchCount > 0))
            .sort((a, b) => b.matchCount - a.matchCount)
            .map(({ pageEntry }) => pageEntry);

        results.addPageEntries(pages);
        return results;
    }

    public fuzzySearchInnerText(
        innerText: string,
        scoreThresshold: number = 0.85,
        minLength: number = 10
    ): CATWikiPageSearchResults {
        const results = new CATWikiPageSearchResults();

        const content = innerText
            .split(/\r?\n/)
            .map((line) => line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim())
            .filter((line) => line.length >= minLength);

        let resultMap = new Map<number, IFussySearchResult>();

        this.companyPages.forEach((page) => {
            resultMap = this.fuzzySearchContent(content, page.pageName, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.parentCompany, page.pageId, scoreThresshold, resultMap);
        });

        this.incidentPages.forEach((page) => {
            resultMap = this.fuzzySearchContent(content, page.pageName, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.productLine, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.product, page.pageId, scoreThresshold, resultMap);
        });

        this.productPages.forEach((page) => {
            resultMap = this.fuzzySearchContent(content, page.pageName, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.productLine, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.company, page.pageId, scoreThresshold, resultMap);
        });

        this.productLinePages.forEach((page) => {
            resultMap = this.fuzzySearchContent(content, page.pageName, page.pageId, scoreThresshold, resultMap);
            resultMap = this.fuzzySearchContent(content, page.company, page.pageId, scoreThresshold, resultMap);
        });

        console.log('fuzzySearchInnerText', resultMap);

        this.allPages.forEach((page) => {
            if (resultMap.has(page.pageId)) {
                results.addPageEntry(page);
            }
        });

        return results;
    }

    public fuzzySearchContent(
        content: string[],
        query: string,
        pageID: number,
        scoreThresshold: number,
        current: Map<number, IFussySearchResult>
    ): Map<number, IFussySearchResult> {
        const options = {
            all: false,
            threshold: scoreThresshold,
        };

        const results = fuzzysort.go(query, content, options);
        results.forEach((result) => {
            const score = current.get(pageID)?.score ?? 0;

            if (result.score > score) {
                const data: IFussySearchResult = {
                    score: result.score,
                    search: query,
                    text: result.target,
                };

                current.set(pageID, data);
            }
        });

        return current;
    }
}

interface IFussySearchResult {
    score: number;
    search: string;
    text: string;
}
