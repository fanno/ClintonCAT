import { IScanParameters } from '@/common/services/content-scanner.types';
import { BaseDomainScanner } from '../base-domain-scanner';
import { getDomainWithoutSuffix } from 'tldts';

export interface ISearchEngine {
    domain: string;
    search: string;
    path: string | null;
}

/**
 * configure dimain to search parameter
 */
const SearchEngines: ISearchEngine[] = [
    {
        domain: 'bing',
        search: 'q',
        path: null,
    },
    {
        domain: 'yahoo',
        search: 'p',
        path: null,
    },
    {
        domain: 'brave' /* domain is actuarly search.brave.com, but it still works. */,
        search: 'q',
        path: null,
    },
    {
        domain: 'duckduckgo',
        search: 'q',
        path: null,
    },
    {
        domain: 'archive',
        search: 'query',
        path: null,
    },
    {
        domain: 'facebook',
        search: 'q' /* when search is preformed it dont reload the whole page so we dont update, we need a "hook" that detect url change code can run there aswell*/,
        path: null,
    },
    {
        domain: 'x',
        search: 'q' /* when search is preformed it dont reload the whole page so we dont update, we need a "hook" that detect url change code can run there aswell*/,
        path: null,
    },
    {
        domain: 'wikipedia',
        search: 'search',
        path: '^/wiki/([^/?]+)',
    },
];

/**
 * Generic plugin that can cover manny search engines with little effort
 */
class GenericSearchEngineScanner extends BaseDomainScanner {
    metaInfo(): string {
        return 'generic-search-engine';
    }

    canScanContent(params: IScanParameters): boolean {
        for (const engine of SearchEngines) {
            if (params.mainDomain === engine.domain) {
                return params.mainDomain == engine.domain;
            }
        }
        return false;
    }

    protected getDomainKeyForSearch(params: IScanParameters): string {
        for (const engine of SearchEngines) {
            if (params.mainDomain === engine.domain) {
                return params.mainDomain;
            }
        }
        return '';
    }

    protected override extractEntity(url: string): string | null {
        const scannerName = this.constructor.name;
        try {
            const urlObject = new URL(url);
            const domain = getDomainWithoutSuffix(urlObject.host, { allowPrivateDomains: true }) ?? '';
            for (const engine of SearchEngines) {
                if (domain === engine.domain) {
                    if (engine.path) {
                        const match = urlObject.pathname.match(engine.path);
                        if (match) {
                            return match[1].toLowerCase();
                        }
                    }
                    return urlObject.searchParams.get(engine.search);
                }
            }
        } catch (error) {
            console.error(`${scannerName}: Error parsing URL:`, error);
        }

        console.log(`${scannerName}: Could not extract from URL: ${url}`);
        return null;
    }
}

export default GenericSearchEngineScanner;
