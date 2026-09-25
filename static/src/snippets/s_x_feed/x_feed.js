import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

let xWidgetsPromise;

function loadXWidgets() {
    if (window.twttr?.widgets?.load) {
        return Promise.resolve(window.twttr);
    }
    if (xWidgetsPromise) {
        return xWidgetsPromise;
    }

    xWidgetsPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById("twitter-wjs");

        if (existingScript) {
            const waitForWidgets = () => {
                if (window.twttr?.widgets?.load) {
                    resolve(window.twttr);
                } else {
                    reject(new Error("X widgets unavailable"));
                }
            };

            if (window.twttr?.widgets?.load) {
                waitForWidgets();
            } else if (window.twttr?.ready) {
                window.twttr.ready(waitForWidgets);
            } else {
                existingScript.addEventListener("load", waitForWidgets, { once: true });
                existingScript.addEventListener(
                    "error",
                    () => reject(new Error("Unable to load X widgets.js")),
                    { once: true },
                );
            }
            return;
        }

        const script = document.createElement("script");
        script.id = "twitter-wjs";
        script.src = "https://platform.x.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";

        const twttr = (window.twttr = window.twttr || {});
        twttr._e = twttr._e || [];
        twttr.ready = twttr.ready || function (callback) {
            twttr._e.push(callback);
        };

        script.onload = () => {
            if (window.twttr?.widgets?.load) {
                resolve(window.twttr);
            } else {
                reject(new Error("X widgets unavailable"));
            }
        };
        script.onerror = () => reject(new Error("Unable to load X widgets.js"));

        document.head.appendChild(script);
    });

    return xWidgetsPromise;
}

export class XFeed extends Interaction {
    static selector = ".s_x_feed";

    setup() {
        this.container = this.el.querySelector(".o_x_feed_container");
        this.username = this.normalizeUsername(this.el.dataset.xFeed);
    }

    async start() {
        if (!this.container || !this.username || document.body.classList.contains("editor_enable")) {
            return;
        }

        const link = document.createElement("a");
        link.className = "twitter-timeline";
        link.href = `https://x.com/${encodeURIComponent(this.username)}`;
        link.textContent = _t("Posts by @%s", this.username);
        link.setAttribute("data-dnt", "true");
        link.setAttribute("data-height", "600");
        this.container.replaceChildren(link);

        try {
            const twttr = await loadXWidgets();
            await twttr.widgets.load(this.container);
        } catch (error) {
            // Keep the official profile timeline fallback link visible when the widget cannot load.
            console.warn("Unable to render X timeline", error);
        }
    }

    normalizeUsername(value) {
        return (value || "")
            .trim()
            .replace(/^@+/, "")
            .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
            .split(/[\/?#]/)[0];
    }
}

registry.category("public.interactions").add("website.x_feed", XFeed);
