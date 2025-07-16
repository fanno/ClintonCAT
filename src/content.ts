import DOMMessenger from '@/common/helpers/dom-messenger';
import browser from 'webextension-polyfill';

DOMMessenger.registerMessageListener();

function sendPageInfo() {
    const pageInfoPayload = {
        domain: window.location.hostname,
        url: window.location.href,
    };

    void browser.runtime.sendMessage({
        type: 'pageInfo',
        payload: pageInfoPayload,
    });
}

sendPageInfo();

let lastUrl = location.href;
setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        sendPageInfo();
    }
}, 1000);
