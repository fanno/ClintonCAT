import { CompanyPage, ICompanyCargo } from '@/models/company';
import { IIncidentCargo, IncidentPage } from '@/models/incident';
import { Page } from '@/models/page';
import { IProductCargo, ProductPage } from '@/models/product';
import { IProductLineCargo, ProductLinePage } from '@/models/product-line';
import escapeRegex from '@/utils/helpers/escape-regex';
import pagesDbJsonFile from '../data/pages_db.json'; // assert { type: 'json' };

import { FussySearch, IFussySearchOptions } from '@/utils/fuzzysearch';

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

    public fuzzyTextSearch(innerText: string, options: IFussySearchDatabaseOptions): CATWikiPageSearchResults {
        const results = new CATWikiPageSearchResults();
        const now = Date.now();

        const content = innerText
            .split(/\r?\n/)
            .map((line) => line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim())
            .filter((line) => {
                const min = options.minLength ?? 0;
                const max = options.maxLength ?? 0;

                return line.length >= min && (max == 0 || line.length <= max);
            });

        let resultMap = new Map<number, IFussySearch>();

        console.log('SearchInnerText: options', options);

        const search: IFussySearch = {
            rules: {},
        };

        content.forEach((text) => {
            search.text = text;
            this.companyPages.forEach((page) => {
                search.rules.scoreThresshold = options.companyPages.pageName.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'companyPages.pageName';
                    search.rules = options.companyPages.pageName;
                    search.query = page.pageName;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.companyPages.parentCompany.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'companyPages.parentCompany';
                    search.rules = options.companyPages.parentCompany;
                    search.query = page.parentCompany;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
            });

            this.incidentPages.forEach((page) => {
                search.rules.scoreThresshold = options.incidentPages.pageName.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'incidentPages.pageName';
                    search.rules = options.incidentPages.pageName;
                    search.query = page.pageName;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.incidentPages.productLine.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'incidentPages.productLine';
                    search.rules = options.incidentPages.productLine;
                    search.query = page.productLine;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.incidentPages.product.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'incidentPages.product';
                    search.rules = options.incidentPages.product;
                    search.query = page.product;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
            });

            this.productPages.forEach((page) => {
                search.rules.scoreThresshold = options.productPages.pageName.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'productPages.pageName';
                    search.rules = options.productPages.pageName;
                    search.query = page.pageName;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.productPages.productLine.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'productPages.productLine';
                    search.rules = options.productPages.productLine;
                    search.query = page.productLine;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.productPages.company.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'productPages.company';
                    search.rules = options.productPages.company;
                    search.query = page.company;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
            });

            this.productLinePages.forEach((page) => {
                search.rules.scoreThresshold = options.productLinePages.pageName.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'productLinePages.pageName';
                    search.rules = options.productLinePages.pageName;
                    search.query = page.pageName;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
                search.rules.scoreThresshold = options.productLinePages.company.scoreThresshold ?? 0;
                if (search.rules.scoreThresshold > 0) {
                    search.pageID = page.pageId;
                    search.context = 'productLinePages.company';
                    search.rules = options.productLinePages.company;
                    search.query = page.company;

                    resultMap = this.fuzzyTextPageSearch(search, resultMap);
                }
            });
        });

        const end = Date.now();
        const total = end - now;
        console.log('fuzzyTextSearch', total, resultMap);

        this.allPages.forEach((page) => {
            if (resultMap.has(page.pageId)) {
                results.addPageEntry(page);
            }
        });
        return results;
    }

    public fuzzyTextPageSearch(
        search: IFussySearch,
        current: Map<number, IFussySearch>,
        skipFounedPages: boolean = true
    ): Map<number, IFussySearch> {
        search.query = search.query ?? '';
        if (search.query.length <= 0) return current;

        search.rules.scoreThresshold = search.rules.scoreThresshold ?? 0;
        if (search.rules.scoreThresshold <= 0) return current;

        search.pageID = search.pageID ?? 0;

        if (search.pageID <= 0) return current;
        if (skipFounedPages && current.has(search.pageID)) return current;
        search.text = search.text ?? '';

        const options: IFussySearchOptions = {
            caseSensetive: search.rules.caseSensetive,
        };

        const score = FussySearch.score(search.query, search.text, options);
        if (score >= search.rules.scoreThresshold) {
            const currentScore = current.get(search.pageID)?.score ?? 0;
            if (score > currentScore) {
                current.set(search.pageID, {
                    ...search,
                    score: score,
                } as IFussySearch);
            }
        }
        return current;
    }
}

export interface IFussySearchDatabaseOptions {
    companyPages: IFussySearchPageNameOption & IFussySearchParentCompany;
    incidentPages: IFussySearchPageNameOption & IFussySearchProduct & IFussySearchProductLine;
    productPages: IFussySearchPageNameOption & IFussySearchCompany & IFussySearchProductLine;
    productLinePages: IFussySearchPageNameOption & IFussySearchProduct & IFussySearchCompany & IFussySearchProductLine;
    minLength?: number;
    maxLength?: number;
}

interface IFussySearchPageNameOption {
    pageName: IFussySearchRules;
}

interface IFussySearchParentCompany {
    parentCompany: IFussySearchRules;
}

interface IFussySearchCompany {
    company: IFussySearchRules;
}

interface IFussySearchProduct {
    product: IFussySearchRules;
}

interface IFussySearchProductLine {
    productLine: IFussySearchRules;
}

interface IFussySearchRules {
    scoreThresshold?: number;
    caseSensetive?: boolean;
}

export const FussySearchDefaultOptions: IFussySearchDatabaseOptions = {
    companyPages: {
        pageName: { scoreThresshold: 0 },
        parentCompany: { scoreThresshold: 0.97, caseSensetive: true },
    },
    incidentPages: {
        pageName: { scoreThresshold: 0 },
        product: { scoreThresshold: 0 },
        productLine: { scoreThresshold: 0 },
    },
    productPages: {
        pageName: { scoreThresshold: 0.75 },
        company: { scoreThresshold: 0.97, caseSensetive: true },
        productLine: { scoreThresshold: 0.75 },
    },
    productLinePages: {
        pageName: { scoreThresshold: 0.75 },
        company: { scoreThresshold: 0.97, caseSensetive: true },
        product: { scoreThresshold: 0.75 },
        productLine: { scoreThresshold: 0.75 },
    },
    minLength: 10,
};

export interface IFussySearch {
    query?: string;
    rules: IFussySearchRules;
    text?: string;
    context?: string;
    pageID?: number;
    score?: number;
}
