import DOMMessenger from '@/common/helpers/dom-messenger';
import browser from 'webextension-polyfill';

DOMMessenger.registerMessageListener();

const pageInfoPayload = {
    domain: window.location.hostname,
    url: window.location.href,
    innerText: document.body.innerText,
};

void browser.runtime.sendMessage({
    type: 'pageInfo',
    payload: pageInfoPayload,
});
