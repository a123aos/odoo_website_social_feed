import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

export class ThreadsFeed extends Interaction {
    static selector = ".s_threads_feed";

    setup() {
        this.container = this.el.querySelector(".o_threads_feed_container");
    }

    async start() {
        if (!this.container || document.body.classList.contains("editor_enable")) {
            return;
        }

        try {
            const response = await fetch("/threads/feed?limit=10", {
                method: "GET",
                credentials: "same-origin",
            });
            const payload = await response.json();

            if (!response.ok || payload.error) {
                throw new Error(payload.error || "Unable to load Threads feed.");
            }

            this.renderPosts(payload.data || []);
        } catch (error) {
            this.renderMessage(error.message || "Unable to load Threads feed.");
        }
    }

    renderPosts(posts) {
        this.container.replaceChildren();

        if (!posts.length) {
            this.renderMessage("No Threads posts available.");
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const post of posts) {
            const article = document.createElement("article");
            article.className = "o_threads_feed_post";

            const header = document.createElement("div");
            header.className = "o_threads_feed_post_header";
            header.textContent = post.username ? `@${post.username}` : "";
            article.append(header);

            if (post.text) {
                const text = document.createElement("p");
                text.className = "o_threads_feed_text";
                text.textContent = post.text;
                article.append(text);
            }

            const mediaUrl = post.media_url || post.thumbnail_url;
            if (mediaUrl) {
                if (post.media_type === "VIDEO") {
                    const video = document.createElement("video");
                    video.className = "o_threads_feed_media";
                    video.src = mediaUrl;
                    video.controls = true;
                    video.preload = "metadata";
                    article.append(video);
                } else {
                    const image = document.createElement("img");
                    image.className = "o_threads_feed_media";
                    image.alt = "";
                    image.loading = "lazy";
                    image.src = mediaUrl;
                    article.append(image);
                }
            }

            const footer = document.createElement("div");
            footer.className = "o_threads_feed_post_footer";

            if (post.timestamp) {
                const date = document.createElement("time");
                date.dateTime = post.timestamp;
                date.textContent = this.formatDate(post.timestamp);
                footer.append(date);
            }

            if (post.permalink) {
                const link = document.createElement("a");
                link.href = post.permalink;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "View on Threads";
                footer.append(link);
            }

            if (footer.childElementCount) {
                article.append(footer);
            }

            fragment.append(article);
        }

        this.container.append(fragment);
    }

    renderMessage(message) {
        this.container.replaceChildren();
        const element = document.createElement("p");
        element.className = "o_threads_feed_message";
        element.textContent = message;
        this.container.append(element);
    }

    formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
        }).format(date);
    }
}

registry.category("public.interactions").add("website.threads_feed", ThreadsFeed);
