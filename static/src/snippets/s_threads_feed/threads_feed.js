import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

export class ThreadsFeed extends Interaction {
    static selector = ".s_threads_feed";

    setup() {
        this.container = this.el.querySelector(".o_threads_feed_container");
        this.currentCarouselIndex = 0;
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

        const header = document.createElement("div");
        header.className = "o_threads_feed_header";

        const logoLink = document.createElement("a");
        logoLink.className = "o_threads_feed_logo";
        logoLink.href = profile.username
            ? `https://www.threads.com/@${encodeURIComponent(profile.username)}`
            : "https://www.threads.com/";
        logoLink.target = "_blank";
        logoLink.rel = "noopener noreferrer";
        logoLink.setAttribute("aria-label", "Open Threads profile");
        logoLink.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015c-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164c1.43 1.783 3.631 2.698 6.54 2.717c2.623-.02 4.358-.631 5.8-2.045c1.647-1.613 1.618-3.593 1.09-4.798c-.31-.71-.873-1.3-1.634-1.75c-.192 1.352-.622 2.446-1.284 3.272c-.886 1.102-2.14 1.704-3.73 1.79c-1.202.065-2.361-.218-3.259-.801c-1.063-.689-1.685-1.74-1.752-2.964c-.065-1.19.408-2.285 1.33-3.082c.88-.76 2.119-1.207 3.583-1.291a14 14 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757c-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.18c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388q.163.07.321.142c1.49.7 2.58 1.761 3.154 3.07c.797 1.82.871 4.79-1.548 7.158c-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69q-.362 0-.739.021c-1.836.103-2.98.946-2.916 2.143c.067 1.256 1.452 1.839 2.784 1.767c1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z"/>
            </svg>
        `;
        header.append(logoLink);
        this.container.append(header);

        const carousel = document.createElement("div");
        carousel.className = "o_threads_feed_carousel";

        const viewport = document.createElement("div");
        viewport.className = "o_threads_feed_viewport";

        const track = document.createElement("div");
        track.className = "o_threads_feed_track";
        viewport.append(track);
        carousel.append(viewport);

        for (const post of posts) {
            const article = this.renderPost(post, profile);
            track.append(article);
        }

        if (posts.length > this.getItemsPerView()) {
            const previous = this.createCarouselButton("Previous posts", "‹");
            const next = this.createCarouselButton("Next posts", "›");

            previous.addEventListener("click", () => {
                this.moveCarousel(viewport, -1);
            });
            next.addEventListener("click", () => {
                this.moveCarousel(viewport, 1);
            });

            carousel.append(previous, next);
        }

        this.container.append(carousel);
    }

    renderPost(post, profile) {
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

        const content = document.createElement("div");
        content.className = "o_threads_feed_post_content";

        if (post.text) {
            const text = document.createElement("p");
            text.className = "o_threads_feed_text";
            text.textContent = post.text;
            content.append(text);
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
                content.append(video);
            } else {
                const image = document.createElement("img");
                image.className = "o_threads_feed_media";
                image.alt = "";
                image.loading = "lazy";
                image.src = mediaUrl;
                content.append(image);
            }
        }

        if (content.childElementCount) {
            article.append(content);
        }

        const footer = document.createElement("div");
        footer.className = "o_threads_feed_post_footer";

        const metrics = this.renderMetrics(post.insights || {});
        if (metrics) {
            footer.append(metrics);
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

        return article;
    }

    getItemsPerView() {
        const width = window.innerWidth;
        if (width < 576) {
            return 1;
        }
        if (width < 992) {
            return 2;
        }
        return 3;
    }

    createCarouselButton(label, symbol) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "o_threads_feed_carousel_button";
        button.setAttribute("aria-label", label);
        button.textContent = symbol;
        return button;
    }

    moveCarousel(viewport, direction) {
        const amount = viewport.clientWidth * direction;
        viewport.scrollBy({
            left: amount,
            behavior: "smooth",
        });
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
