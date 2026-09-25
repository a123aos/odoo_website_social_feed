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

            this.renderPosts(payload.data || [], payload.profile || {});
        } catch (error) {
            this.renderMessage(error.message || "Unable to load Threads feed.");
        }
    }

    renderPosts(posts, profile) {
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

            const avatar = document.createElement("span");
            avatar.className = "o_threads_feed_avatar";
            const avatarUrl = profile.threads_profile_picture_url;
            if (avatarUrl) {
                const avatarImage = document.createElement("img");
                avatarImage.className = "o_threads_feed_avatar";
                avatarImage.alt = profile.name || post.username || "Threads";
                avatarImage.src = avatarUrl;
                avatarImage.loading = "lazy";
                avatarImage.referrerPolicy = "no-referrer";
                avatar.append(avatarImage);
            } else {
                avatar.textContent = this.getInitial(profile.username || post.username);
            }
            header.append(avatar);

            const author = document.createElement("div");
            author.className = "o_threads_feed_author";

            const username = document.createElement("a");
            username.className = "o_threads_feed_username";
            username.href = post.username
                ? `https://www.threads.com/@${encodeURIComponent(post.username)}`
                : post.permalink || "https://www.threads.com/";
            username.target = "_blank";
            username.rel = "noopener noreferrer";
            username.textContent = post.username ? `@${post.username}` : "Threads";
            author.append(username);

            const source = document.createElement("span");
            source.className = "o_threads_feed_source";
            source.textContent = post.timestamp ? this.formatDate(post.timestamp) : "Threads";
            author.append(source);

            header.append(author);
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
                    video.playsInline = true;
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

            if (post.permalink) {
                const footer = document.createElement("div");
                footer.className = "o_threads_feed_post_footer";

                const link = document.createElement("a");
                link.href = post.permalink;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "View on Threads";
                footer.append(link);

                const metrics = this.renderMetrics(post.insights || {});
                if (metrics) {
                    footer.prepend(metrics);
                }

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

    renderMetrics(insights) {
        const values = [
            ["likes", "Likes"],
            ["replies", "Replies"],
            ["reposts", "Reposts"],
        ];
        const items = values
            .filter(([key]) => Number.isFinite(Number(insights[key])))
            .map(([key, label]) => {
                const item = document.createElement("span");
                item.className = "o_threads_feed_metric";
                item.textContent = label + ": " + this.formatCount(insights[key]);
                return item;
            });

        if (!items.length) {
            return null;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "o_threads_feed_metrics";
        for (const item of items) {
            wrapper.append(item);
        }
        return wrapper;
    }

    formatCount(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return "";
        }
        return new Intl.NumberFormat(undefined, {
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(number);
    }

    getInitial(username) {
        return (username || "T").replace(/^@+/, "").charAt(0).toUpperCase();
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
