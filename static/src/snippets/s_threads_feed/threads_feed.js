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

            const displayName = document.createElement("a");
            displayName.className = "o_threads_feed_display_name";
            displayName.href = post.username
                ? `https://www.threads.com/@${encodeURIComponent(post.username)}`
                : post.permalink || "https://www.threads.com/";
            displayName.target = "_blank";
            displayName.rel = "noopener noreferrer";
            displayName.textContent = profile.name || "Threads";
            author.append(displayName);

            const username = document.createElement("div");
            username.className = "o_threads_feed_username";
            username.textContent = post.username ? `@${post.username}` : "";
            author.append(username);

            const source = document.createElement("span");
            source.className = "o_threads_feed_source";
            source.textContent = post.timestamp ? this.formatDate(post.timestamp) : "";
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
        const metrics = [
            ["likes", "Like", "M16.5 2c-1.666 0-3.278.707-4.5 1.937C10.778 2.707 9.166 2 7.5 2c-4.122 0-7 3.084-7 7.5 0 4.628 4.345 9.962 10.811 13.272a1.507 1.507 0 0 0 1.378 0C19.155 19.462 23.5 14.128 23.5 9.5c0-4.416-2.878-7.5-7-7.5Z"],
            ["replies", "Reply", "M12 3a9 9 0 0 0 0 18c1.414 0 2.75-.325 3.937-.904a1 1 0 0 1 .614-.086l4.206.752-.764-4.17a1 1 0 0 1 .086-.621C20.67 14.774 21 13.427 21 12a9 9 0 0 0-9-9z"],
            ["reposts", "Repost", "M4.516 6.999a8.99 8.99 0 0 1 7.483-4 9.002 9.002 0 0 1 8.294 5.498 1 1 0 0 0 1.842-.78A11.002 11.002 0 0 0 11.999 1C8.278 1 4.99 2.848 3 5.674V3a1 1 0 1 0-2 0v5a1 1 0 0 0 1 1h5a1 1 0 0 0 0-2H4.517zM2.396 14.971a1 1 0 0 1 1.31.532A9.002 9.002 0 0 0 12 21 8.99 8.99 0 0 0 19.483 17h-2.484a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.675A10.986 10.986 0 0 1 12 23a11.002 11.002 0 0 1-10.135-6.718 1 1 0 0 1 .532-1.31z"],
        ];

        const wrapper = document.createElement("div");
        wrapper.className = "o_threads_feed_metrics";

        for (const [key, title, path] of metrics) {
            const number = Number(insights[key]);
            if (!Number.isFinite(number) || number <= 0) {
                continue;
            }

            const item = document.createElement("span");
            item.className = "o_threads_feed_metric";
            item.title = title;
            item.setAttribute("aria-label", title + ": " + this.formatCount(number));

            const svg = document.createElement("svg");
            svg.className = "o_threads_feed_metric_icon";
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "currentColor");
            svg.setAttribute("aria-hidden", "true");

            const pathElement = document.createElement("path");
            pathElement.setAttribute("d", path);
            svg.append(pathElement);

            const count = document.createElement("span");
            count.textContent = this.formatCount(number);

            item.append(svg, count);
            wrapper.append(item);
        }

        return wrapper.childElementCount ? wrapper : null;
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
