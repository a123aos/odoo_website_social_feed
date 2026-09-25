import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

let xWidgetsPromise;

function loadXWidgets() {
    if (window.twttr?.widgets) return Promise.resolve(window.twttr);
    if (xWidgetsPromise) return xWidgetsPromise;

    xWidgetsPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://platform.twitter.com/widgets.js";
        script.async = true;
        script.charset = "utf-8";
        script.onload = () => window.twttr?.widgets ? resolve(window.twttr) : reject(new Error("X widgets unavailable"));
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
        if (!this.container || !this.username || document.body.classList.contains("editor_enable")) return;

        const link = document.createElement("a");
        link.className = "twitter-timeline";
        link.href = `https://x.com/${encodeURIComponent(this.username)}`;
        link.textContent = _t("Posts by @%s", this.username);
        link.setAttribute("data-dnt", "true");
        this.container.replaceChildren(link);

        try {
            const twttr = await loadXWidgets();
            await twttr.widgets.load(this.container);
        } catch {
            // Keep the profile link as fallback.
        }
    }

    normalizeUsername(value) {
        return (value || "").trim()
            .replace(/^@+/, "")
            .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
            .split(/[/?#]/)[0];
    }
}

registry.category("public.interactions").add("website.x_feed", XFeed);