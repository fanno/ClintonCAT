import DOMMessenger from '@/common/helpers/dom-messenger';
import browser from 'webextension-polyfill';

DOMMessenger.registerMessageListener();

const containerId = DOMMessenger.containerId();

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

let updateTimerRunnig = true;

const observer = new MutationObserver((mutationsList) => {
    let _ignore = false;
    if (!updateTimerRunnig) {
        mutationsList.forEach((record) => {
            if (record.type === 'childList') {
                record.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement && node.id) {
                        if (node.id == containerId) {
                            _ignore = true;
                        }
                    }
                });
                record.removedNodes.forEach(() => {
                    _ignore = true;
                });
            }
        });

        if (!_ignore) {
            updateTimerRunnig = true;
            console.log('MutationObserver::setTimeout::SET');
            setTimeout(() => {
                console.log('MutationObserver::setTimeout::DONE');
                sendPageInfo();
                updateTimerRunnig = false;
            }, 5000);
        }
    }
});

const config = {
    childList: true, // observe direct children being added/removed
    subtree: true, // observe all descendants
    attributes: false, // observe attribute changes
    characterData: false, // observe text content changes
};

setTimeout(() => {
    updateTimerRunnig = false;
    observer.observe(document.body, config);
}, 20000);
