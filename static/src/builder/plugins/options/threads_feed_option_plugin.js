import { SNIPPET_SPECIFIC_END } from "@html_builder/utils/option_sequence";
import { Plugin } from "@html_editor/plugin";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { withSequence } from "@html_editor/utils/resource";
import { BuilderAction } from "@html_builder/core/builder_action";
import { BaseOptionComponent } from "@html_builder/core/utils";

export class ThreadsFeedOption extends BaseOptionComponent {
    static template = "odoo_website_social_feed.ThreadsFeedOption";
    static selector = ".s_threads_feed";
}

class ThreadsFeedOptionPlugin extends Plugin {
    static id = "threadsFeedOption";
    resources = {
        builder_options: [withSequence(SNIPPET_SPECIFIC_END, ThreadsFeedOption)],
        builder_actions: { ThreadsFeedAction },
    };

    threadsUsernameFromUrl(url) {
        const match = (url || "").match(/^(?:https?:\/\/)?(?:www\.)?threads\.(?:com|net)\/([^/?#]+)\/?(?:[?#].*)?$/i);
        return match?.[1]?.replace(/^@+/, "");
    }
}

export class ThreadsFeedAction extends BuilderAction {
    static id = "threadsFeed";
    static dependencies = ["threadsFeedOption"];

    getValue({ editingElement }) { return editingElement.dataset.threadsFeed || ""; }

    apply({ editingElement, value }) {
        let username = (value || "").trim();
        if (/^(?:https?:\/\/)?(?:www\.)?threads\.(?:com|net)\//i.test(username)) {
            username = this.dependencies.threadsFeedOption.threadsUsernameFromUrl(username) || "";
        }
        username = username.replace(/^@+/, "").split(/[/?#]/)[0];
        editingElement.dataset.threadsFeed = username;
        if (!username) this.services.notification.add(_t("The Threads account name is not valid"), { type: "warning" });
    }
}

registry.category("website-plugins").add(ThreadsFeedOptionPlugin.id, ThreadsFeedOptionPlugin);