import { IElementData } from '@/common/services/content-scanner.types';
import { DOMMessengerAction, IDOMMessengerInterface, IShowInPageNotificationPayload } from './dom-messenger.types';
import browser from 'webextension-polyfill';

type DOMMessagePayload =
    | { action: DOMMessengerAction.DOM_QUERY_SELECTOR_ALL; selector: string }
    | { action: DOMMessengerAction.DOM_QUERY_SELECTOR_ALL_AS_TEXT; selector: string }
    | { action: DOMMessengerAction.DOM_QUERY_SELECTOR; selector: string }
    | { action: DOMMessengerAction.DOM_QUERY_SELECTOR_BY_PARENT_ID; id: string; selector: string }
    | { action: DOMMessengerAction.DOM_CREATE_ELEMENT; id: string; element: string; html: string }
    | ({ action: DOMMessengerAction.DOM_SHOW_IN_PAGE_NOTIFICATION } & IShowInPageNotificationPayload);

declare global {
    interface Window {
        __DOMMessengerListenerRegistered?: boolean;
    }
}

class DOMMessenger implements IDOMMessengerInterface {
    public async querySelectorAll(selector: string): Promise<IElementData[]> {
        console.log('querySelectorAll: ', selector);
        return (await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_QUERY_SELECTOR_ALL,
            selector: selector,
        })) as IElementData[];
    }

    // TODO: fix case when using id, e.g. '#product1 .h2' becomes ''# .h2' in the browser
    public async querySelector(selector: string): Promise<IElementData | null> {
        console.log('querySelector: ', selector);
        return (await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_QUERY_SELECTOR,
            selector: selector,
        })) as IElementData;
    }

    public async querySelectorByParentId(id: string, selector: string): Promise<IElementData | undefined | null> {
        console.log('querySelectorById: ', id, selector);
        return (await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_QUERY_SELECTOR_BY_PARENT_ID,
            id: id,
            selector: selector,
        })) as IElementData;
    }

    public async querySelectorAllAsText(selector: string): Promise<string> {
        console.log('querySelectorAll (as text): ', selector);
        return (await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_QUERY_SELECTOR_ALL_AS_TEXT,
            selector: selector,
        })) as string;
    }

    public async createElement(parentId: string, element: string, html: string): Promise<void> {
        console.log('createElement (id, element, html): ', parentId, element, html);
        await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_CREATE_ELEMENT,
            id: parentId,
            element: element,
            html: html,
        });
    }

    public async showInPageNotification(message: string): Promise<unknown> {
        console.log('showInPageNotification: ', message);
        return await this.sendMessageToCurrentTab({
            action: DOMMessengerAction.DOM_SHOW_IN_PAGE_NOTIFICATION,
            message: message,
        });
    }

    public async setBadgeText(text: string): Promise<unknown> {
        console.log('Setting badge text: ', text);
        const tab = await this.getCurrentTab();
        return await browser.action.setBadgeText({
            text: text,
            tabId: tab.id,
        });
    }

    // TODO: createElementWithChildSelector ?
    // public async createElementWithChildSelector(
    //     parentId: string,
    //     selector: string,
    //     newElement: string,
    //     html: string
    // ): Promise<void> {}

    // TODO: Execute JS?
    // see: https://developer.chrome.com/docs/extensions/reference/api/scripting
    // see:https://stackoverflow.com/questions/69348933/execute-javascript-in-a-new-tab-using-chrome-extension
    // see: https://developer.chrome.com/docs/extensions/reference/api/scripting

    // public async executeJSHelper() {
    //     const getTabId = () => {
    //         return this.getCurrentTab();
    //     };
    //     function getUserColor() {
    //         return 'green';
    //     }
    //     function changeBackgroundColor(backgroundColor: string) {
    //         document.body.style.backgroundColor = backgroundColor;
    //     }
    //
    //     browser.scripting
    //         .executeScript({
    //             target: { xtabId: getTabId() },
    //             func: changeBackgroundColor,
    //             args: [getUserColor()],
    //             world: 'MAIN',
    //         })
    //         .then(() => console.log('injected a function'));
    // }

    // ---

    private async sendMessageToCurrentTab(message: DOMMessagePayload): Promise<unknown> {
        const tab = await this.getCurrentTab();

        if (!tab.id) {
            throw new Error('No active tab found');
        }
        return await browser.tabs.sendMessage(tab.id, message);
    }

    private async getCurrentTab(): Promise<browser.Tabs.Tab> {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
    }

    private static elementDataFromNode(element: HTMLElement | null | undefined): IElementData | undefined {
        if (!element) {
            return undefined;
        } else {
            return {
                tag: element.tagName,
                id: element.id,
                className: element.className,
                innerText: element.innerText,
            } as IElementData;
        }
    }

    private static elementDataFromNodes(nodes: NodeListOf<HTMLElement>): (IElementData | undefined | null)[] {
        return Array.from(nodes).map((node) => DOMMessenger.elementDataFromNode(node));
    }

    public static registerMessageListener() {
        browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            const typedMessage = message as DOMMessagePayload;

            switch (typedMessage.action) {
                case DOMMessengerAction.DOM_QUERY_SELECTOR_ALL: {
                    if (!typedMessage.selector) {
                        throw new Error(`DOM_QUERY_SELECTOR_ALL requires a selector`);
                    }
                    const nodes: NodeListOf<HTMLElement> = document.querySelectorAll(typedMessage.selector);
                    const elementData = DOMMessenger.elementDataFromNodes(nodes);
                    // It doesn't seem possible to send a NodeList (as-is, cloned or deep copied) via `sendResponse`
                    sendResponse(elementData);
                    break;
                }

                case DOMMessengerAction.DOM_QUERY_SELECTOR: {
                    if (!typedMessage.selector) {
                        throw new Error(`DOM_QUERY_SELECTOR requires a selector`);
                    }
                    const element: HTMLElement | null = document.querySelector(typedMessage.selector);
                    sendResponse(DOMMessenger.elementDataFromNode(element));
                    break;
                }

                case DOMMessengerAction.DOM_QUERY_SELECTOR_BY_PARENT_ID: {
                    if (!typedMessage.selector) {
                        throw new Error(`DOM_QUERY_SELECTOR_BY_PARENT_ID requires a selector`);
                    }
                    if (!typedMessage.id) {
                        throw new Error(`DOM_QUERY_SELECTOR_BY_PARENT_ID requires an id`);
                    }
                    const parent = document.getElementById(typedMessage.id);
                    const element: HTMLElement | null | undefined = parent?.querySelector(typedMessage.selector);
                    sendResponse(DOMMessenger.elementDataFromNode(element));
                    break;
                }

                case DOMMessengerAction.DOM_QUERY_SELECTOR_ALL_AS_TEXT: {
                    if (!typedMessage.selector) {
                        throw new Error(`DOM_QUERY_SELECTOR_ALL_AS_TEXT requires a selector`);
                    }
                    const nodes: NodeListOf<HTMLElement> = document.querySelectorAll(typedMessage.selector);
                    const text = Array.from(nodes)
                        .map((node) => (node.textContent ?? '') + node.innerText)
                        .join('\n');
                    sendResponse(text);
                    break;
                }

                case DOMMessengerAction.DOM_CREATE_ELEMENT: {
                    if (!typedMessage.id) {
                        throw new Error(`DOM_CREATE_ELEMENT requires an id`);
                    }
                    if (!typedMessage.element) {
                        throw new Error(`DOM_CREATE_ELEMENT requires an element`);
                    }
                    if (!typedMessage.html) {
                        throw new Error(`DOM_CREATE_ELEMENT requires html`);
                    }
                    const parent = document.getElementById(typedMessage.id);
                    if (parent) {
                        const newElement = document.createElement(typedMessage.element);
                        console.log('DOM_CREATE_ELEMENT html: ', typedMessage.html);

                        newElement.innerHTML = typedMessage.html;
                        try {
                            parent.appendChild(newElement);
                        } catch (error) {
                            console.log('DOM_CREATE_ELEMENT failed ', error);
                        }
                    }

                    break;
                }
                case DOMMessengerAction.DOM_SHOW_IN_PAGE_NOTIFICATION: {
                    if (!typedMessage.message) {
                        throw new Error(`DOM_SHOW_IN_PAGE_NOTIFICATION requires a message`);
                    }
                    DOMMessenger.displayNotification(typedMessage.message);
                    sendResponse({ success: true });
                    break;
                }
                default:
                    break;
            }

            // Return true for async operations
            return true;
        });
    }

    /*
        makeId unique maybe this should be eutils helper ?
        Original code from https://stackoverflow.com/questions/1349404/generate-a-string-of-random-characters
    */
    static elementId: string = '';
    public static makeId(): string {
        if (DOMMessenger.elementId == '') {
            const length = 20;
            let result = '';
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const charactersLength = characters.length;
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            DOMMessenger.elementId = result;
        }
        return DOMMessenger.elementId;
    }

    static timeoutID: NodeJS.Timeout;
    private static displayNotification(message: string): void {
        /*
            if we are to use timeout we should clear,
            if not it creats a buggy behavior if more than one message is "displayed."
        */
        if (DOMMessenger.timeoutID) {
            clearTimeout(DOMMessenger.timeoutID);
        }

        /*
            All styling in this, function is up for change, improvement.
            the use of shadowDOM is in my opinion a must.
        */
        const containerId = DOMMessenger.makeId();
        const hostcontainer = document.getElementById(containerId);

        // remove the exsisting container, so a new can be created.
        if (hostcontainer) {
            hostcontainer.remove();
        }
        const host = document.createElement('div');
        host.id = containerId;

        const shadow = host.attachShadow({ mode: 'open' }); // should we use closed to protect the content ?

        // styling added here is to prevent css from "parent" to leak in to the shadowDOM
        // here the contailer styling can also be added if need be.
        shadow.innerHTML = `
            <style>
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

                /* Optionally restore HTML5 block elements */
                    div, p, h1, h2, h3, h4, h5, h6, section, article, header, footer {
                    display: block;
                }
                div {
                    all: initial;
                }
                body, div {
                    font-family: system-ui, sans-serif;
                    font-size: 14px;
                    color: black;
                    background: white;
                }        
            </style>
`;

        const container = document.createElement('div');
        shadow.appendChild(container);

        /*
            clear time out if mouse moves over the message assume user whants to interact with it.
        */
        container.onmouseover = () => {
            if (DOMMessenger.timeoutID) {
                clearTimeout(DOMMessenger.timeoutID);
            }
        };

        Object.assign(container.style, {
            background: '#fff',
            boxShadow: '0 4px 40px 3px rgb(0 0 0 / 100%)',
            padding: '10px',
            margin: '20px',
            width: '400px',
            height: 'auto',
            position: 'fixed',
            right: '0px',
            top: '0px',
            zIndex: '2147483647',
            display: 'inline-block',
            borderColor: 'red',
            borderStyle: 'solid',
            borderWidth: '2px',
            borderRadius: '0 0 1rem 1rem',
            marginTop: '0',
            borderTop: 'none',
        });

        const notificationElement = document.createElement('div');

        const closeElement = document.createElement('span');
        closeElement.appendChild(document.createTextNode('✖'));
        Object.assign(closeElement.style, {
            float: 'right',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginLeft: '10px',
        });
        closeElement.onclick = () => {
            if (DOMMessenger.timeoutID) {
                clearTimeout(DOMMessenger.timeoutID);
            }
            host.remove();
            /* TODO:
                feature so that we can "mute" further popups so they dont keep comming up every time up.
                if/when each individual page is listed in the message, each page should have its own "dismiss", button.
                    this should be the case so that only if new pages are displayed (maybe if modifyed too?),
                    not sure if cargo file will has this info
            */
        };

        const linkElement = document.createElement('a');
        linkElement.href = 'https://consumerrights.wiki/'; // should be a variable
        linkElement.target = '_blank';

        Object.assign(linkElement.style, {
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            minWidth: '13.875em',
            color: '#4b77d6',
            textDecoration: 'none',
        });

        const imgElement = document.createElement('img');
        imgElement.src = 'https://consumerrights.wiki/images/logo/new_fixed_logo.png'; // should be a variable
        Object.assign(imgElement.style, {
            width: '50px',
            height: '50px',
            display: 'inline-block',
        });

        const textSpanElement = document.createElement('span');
        const textStrongElement = document.createElement('strong');

        textStrongElement.appendChild(document.createTextNode('Consumer Rights Wiki'));

        textSpanElement.appendChild(textStrongElement);

        linkElement.appendChild(imgElement);
        linkElement.appendChild(textSpanElement);

        notificationElement.appendChild(closeElement);
        notificationElement.appendChild(linkElement);
        notificationElement.appendChild(document.createTextNode(message));
        container.prepend(notificationElement);

        document.body.appendChild(host);

        // i am not sure we really want this, if we do it should be a option from the user. (maybe time ajustable ?)
        DOMMessenger.timeoutID = setTimeout(() => {
            const hostcontainer = document.getElementById(containerId);
            if (hostcontainer) {
                hostcontainer.remove();
            }
        }, 5000);
    }
}

export default DOMMessenger;
