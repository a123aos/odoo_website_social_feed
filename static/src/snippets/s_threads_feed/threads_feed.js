import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

export class ThreadsFeed extends Interaction {
    static selector = ".s_threads_feed";

    setup() {
        this.container = this.el.querySelector(".o_threads_feed_container");
        this.username = this.normalizeUsername(this.el.dataset.threadsFeed);
    }

    start() {
        if (!this.container || !this.username || document.body.classList.contains("editor_enable")) return;

        const profileUrl = `https://www.threads.com/@${encodeURIComponent(this.username)}`;
        const iframe = document.createElement("iframe");
        iframe.className = "o_threads_feed_iframe";
        iframe.src = profileUrl;
        iframe.title = _t("Threads profile for @%s", this.username);
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";

        this.container.replaceChildren(iframe);
    }

    normalizeUsername(value) {
        return (value || "").trim()
            .replace(/^@+/, "")
            .replace(/^https?:\/\/(?:www\.)?threads\.(?:com|net)\//i, "")
            .split(/[/?#]/)[0];
    }
}

registry.category("public.interactions").add("website.threads_feed", ThreadsFeed);