const Inpagenotification = () => {
    return (
        <>
            <style>
                {`
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
                `}
            </style>
            <div>hello world</div>
        </>
    );
};

/*
const rootElement: Nullable<HTMLElement> = document.getElementById('root');
if (!(rootElement instanceof HTMLElement)) throw Error('No root element was found');

createRoot(rootElement).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);


const rootElement: Nullable<HTMLElement> = document.getElementById('root');
if (!(rootElement instanceof HTMLElement)) throw Error('No root element was found');

createRoot(rootElement).render(
    <React.StrictMode>
        <Inpagenotification2 />
    </React.StrictMode>
);
*/
export default Inpagenotification;
