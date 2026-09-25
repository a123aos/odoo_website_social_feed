import { ThreadsFeed } from "odoo_website_social_feed/static/src/snippets/s_threads_feed/threads_feed";

const originalStart = ThreadsFeed.prototype.start;

ThreadsFeed.prototype.start = async function (...args) {
    const params = new URLSearchParams(window.location.search);
    const isWebsiteBuilder =
        document.body.classList.contains("editor_enable") ||
        params.get("enable_editor") === "1";

    if (isWebsiteBuilder) {
        this.container?.replaceChildren();
        return;
    }

    return originalStart.apply(this, args);
};
