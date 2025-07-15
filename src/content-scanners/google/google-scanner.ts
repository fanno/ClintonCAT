import { IScanParameters } from '@/common/services/content-scanner.types';
import { BaseDomainScanner } from '../base-domain-scanner';

import { IElementData } from '@/common/services/content-scanner.types';

class GoogleScanner extends BaseDomainScanner {
    metaInfo(): string {
        return 'google';
    }

    canScanContent(params: IScanParameters): boolean {
        return params.mainDomain === 'google';
    }

    protected getDomainKeyForSearch(params: IScanParameters): string {
        return params.mainDomain;
    }

    protected async searchContent(params: IScanParameters): Promise<string[]> {
        let result: string[] = [];

        const urlObject = new URL(params.url);
        const udm = urlObject.searchParams.get('udm');
        if (udm) {
            if (udm == '3') {
                const query: IElementData[] = await params.dom.querySelectorAll('.gkQHve');

                query.forEach((element) => {
                    result.push(element.innerText);
                });

                result = this.processStrings(result);
            }
        }

        console.log(params.url);

        return result;
    }

    private processStrings(source: string[]): string[] {
        const result: string[] = [];

        source.forEach((line) => {
            line = line.toLowerCase();
            if (line.length > 3) {
                result.push(line);
            }
        });

        const uniqueWords: string[] = [...new Set<string>(result)];
        return uniqueWords;
    }

    protected override extractEntity(url: string): string | null {
        const urlObject = new URL(url);
        return urlObject.searchParams.get('q');
    }
}

export default GoogleScanner;
