import React from 'react';

import { IPageEntry, PageEntry } from '@/database';

import LocalStorage from '@/utils/helpers/local-storage';

export interface IInpagenotificationPage {
    page: PageEntry;
}

const InpagenotificationPage = ({ page }: IInpagenotificationPage) => {
    const componentReferance = React.createRef<HTMLParagraphElement>();

    const showPage = Date.now() > LocalStorage.readPage(page.pageId).timestamp + 60 * 60 * 1000; // curent mute 1 hour, TODO: should come from an option.

    const closePage = () => {
        const storedPage = LocalStorage.readPage(page.pageId);

        storedPage.timestamp = Date.now();

        LocalStorage.writePage(storedPage);

        if (componentReferance) {
            componentReferance.current?.remove();
        }
    };

    const seeMore = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        const categoryHeader = event.currentTarget as HTMLElement;
        if (categoryHeader) {
            const categoryContent = categoryHeader.parentElement?.parentElement?.querySelector('.page-info');
            if (categoryContent) {
                categoryContent.classList.toggle('hidden');

                categoryHeader.textContent = categoryContent.classList.contains('hidden') ? '⯈' : '▼';
            }
        }
    };

    if (showPage) {
        return (
            <>
                <p className="page" ref={componentReferance}>
                    <div className="page-menu">
                        <span className="page-more" onClick={seeMore}>
                            ⯈
                        </span>
                        <span className="page-close" onClick={closePage}>
                            ✖
                        </span>
                    </div>
                    <a href={page.url()} target="_blank">
                        {page.pageTitle}
                    </a>
                    <div className="page-info hidden">{page.popupText}</div>
                </p>
            </>
        );
    } else {
        return <></>;
    }
};

export interface IInpagenotificationMessage {
    message: string;
}

const InpagenotificationMessage = ({ message }: IInpagenotificationMessage) => {
    if (message && message.length > 0) {
        return (
            <>
                <p className="message">{message}</p>
            </>
        );
    } else {
        return <></>;
    }
};

export interface IInpagenotificationCategory {
    pages: [string, PageEntry[]];
}

const InpagenotificationCategory = ({ pages }: IInpagenotificationCategory) => {
    const cattegoryTitle = pages[0];
    const pagesList = pages[1];

    if (cattegoryTitle && pagesList) {
        const cattegoryPages = pagesList.map((page, index) => <InpagenotificationPage key={index} page={page} />);

        const toggleCategory = (event: React.MouseEvent<HTMLElement>) => {
            event.preventDefault();
            const categoryHeader = event.currentTarget as HTMLElement;
            if (categoryHeader) {
                const categoryContent = categoryHeader.parentElement?.querySelector('.category-content');
                const arrow = categoryHeader.querySelector('.arrow');
                const categoryTitle = categoryHeader.nextElementSibling;
                if (categoryContent && arrow && categoryTitle) {
                    categoryContent.classList.toggle('show-content');

                    arrow.textContent = categoryContent.classList.contains('show-content') ? '▼' : '⯈';
                }
            }
        };
        return (
            <>
                <div className="category">
                    <div className="category-header" onClick={toggleCategory}>
                        <span className="arrow">⯈</span> <span className="label">{cattegoryTitle}</span>
                    </div>
                    <div className="category-content">{cattegoryPages}</div>
                </div>
            </>
        );
    } else {
        return <></>;
    }
};

export interface IInpagenotification {
    containerId: string;
    message: string;
    pages: IPageEntry[];
}

const Inpagenotification = ({ containerId, message, pages }: IInpagenotification) => {
    /**
     * timeout even for hiding the notification after a set time
     *
     * TODO: make the time a variable ?
     */
    const timeoutID = setTimeout(() => {
        const container = document.getElementById(containerId);
        if (container) {
            container.remove();
        }
    }, 5000);

    const closeNotification = () => {
        const container = document.getElementById(containerId);
        if (timeoutID) {
            clearTimeout(timeoutID);
        }
        if (container) {
            container.remove();
        }
    };

    const mouseOver = () => {
        if (timeoutID) {
            clearTimeout(timeoutID);
        }
    };

    const _pages = new Map<string, PageEntry[]>();
    pages.forEach((page) => {
        if (!_pages.has(page.category)) {
            _pages.set(page.category, []);
        }
        _pages.get(page.category)?.push(new PageEntry(page));
    });

    const inpagenotificationCategorysPages = [..._pages].map((pages, index) => (
        <InpagenotificationCategory key={index} pages={pages} />
    ));

    return (
        <>
            <style>
                {`
                /**
                 * Start of css cascade prevention
                 */
                :host {
                    all: initial;
                    display: block;

                    /* Block inherited root styles */
                    font-family: system-ui, sans-serif;
                    color: black;
                    --main-color: initial;
                    --some-other-var: initial;
                }

                *, *::before, *::after {
                    all: unset;
                    display: revert;
                    box-sizing: border-box;
                }
                /**
                 * End of css cascade prevention
                 */

                /**
                 * Start Optionally restore HTML5 block elements
                 */
                div {
                    all: initial;
                }

                div, p, h1, h2, h3, h4, h5, h6, section, article, header, footer {
                    display: block;
                }

                body, div {
                    font-family: system-ui, sans-serif;
                    font-size: 14px;
                    color: black;
                    background: white;
                }
                /**
                 * End Optionally restore HTML5 block elements
                 */
                
                /**
                 * Start of css style for notification.
                 */
                .container {
                    background: rgb(255, 255, 255);
                    box-shadow: rgb(0, 0, 0) 0px 4px 40px 3px;
                    padding: 10px;
                    margin: 0px 20px 20px;
                    width: 250px;
                    height: auto;
                    position: fixed;
                    right: 0px;
                    top: 0px;
                    z-index: 2147483647;
                    display: inline-block;
                    border-color: currentcolor red red;
                    border-style: none solid solid;
                    border-width: medium 2px 2px;
                    border-radius: 0px 0px 1rem 1rem;
                }

                .message {
                    padding: 0.5em;
                    color: #333;
                    max-width: 400px;
                }

                .page {
                    padding: 0.5em;
                    color: #333;
                    max-width: 400px;
                }
                .page:not(:first-child) {
                    margin-top: 10px;
                }

                .page-menu {
                    float: right;
                    cursor: pointer;
                    font-weight:
                    bold;
                 
                    margin-left: 10px;
                }

                .page-more {
                    margin-right: 10px;
                }

                .page-close {
                }                    

                .wikilink {
                    height: 100%;
                    align-items: center;
                    min-width: 13.875em;
                    font-size: 1.5em;
                }

                a {
                    cursor: revert;
                    color: rgb(75, 119, 214);
                    text-decoration: none;
                }

                .category {
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    overflow: hidden;
                    font-family: Arial, sans-serif;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    background-color: #fff;                    
                }

                .category:not(:first-child) {
                    margin-top: 10px;
                }

                .category-header {
                    background-color: #f5f5f5;
                    padding: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    user-select: none;
                }

                .category-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    background-color: #fff;
                }

                .show-content {
                    max-height: 500px;
                }

                .page-info.hidden {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    background-color: #fff;
                }

                .categorys {
                    overflow-y: auto;
                    max-height: calc(100dvh - 115px);
                }
                `}
            </style>

            <div className="container" onMouseOver={mouseOver}>
                <div className="page-menu">
                    <span className="page-close" onClick={closeNotification}>
                        ✖
                    </span>
                </div>
                <a className="wikilink" href="https://consumerrights.wiki/" target="_blank">
                    <span>
                        <strong>Consumer Rights Wiki</strong>
                    </span>
                </a>
                <InpagenotificationMessage message={message} />
                <div className="categorys">{inpagenotificationCategorysPages}</div>
            </div>
        </>
    );
};

export default Inpagenotification;
