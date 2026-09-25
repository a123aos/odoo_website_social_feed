import { SNIPPET_SPECIFIC_END } from "@html_builder/utils/option_sequence";
import { Plugin } from "@html_editor/plugin";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { withSequence } from "@html_editor/utils/resource";
import { BuilderAction } from "@html_builder/core/builder_action";
import { BaseOptionComponent } from "@html_builder/core/utils";

export class XFeedOption extends BaseOptionComponent {
    static template = "odoo_website_social_feed.XFeedOption";
    static selector = ".s_x_feed";
}

class XFeedOptionPlugin extends Plugin {
    static id = "xFeedOption";
    resources = {
        builder_options: [withSequence(SNIPPET_SPECIFIC_END, XFeedOption)],
        builder_actions: { XFeedAction },
    };

    xFeedUsernameFromUrl(url) {
        const match = (url || "").match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
        return match?.[1]?.replace(/^@+/, "");
    }
}

export class XFeedAction extends BuilderAction {
    static id = "xFeed";
    static dependencies = ["xFeedOption"];

    getValue({ editingElement }) { return editingElement.dataset.xFeed || ""; }

    apply({ editingElement, value }) {
        let username = (value || "").trim();
        if (/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\//i.test(username)) {
            username = this.dependencies.xFeedOption.xFeedUsernameFromUrl(username) || "";
        }
        username = username.replace(/^@+/, "").split(/[/?#]/)[0];
        editingElement.dataset.xFeed = username;
        if (!username) this.services.notification.add(_t("The X account name is not valid"), { type: "warning" });
    }
}

registry.category("website-plugins").add(XFeedOptionPlugin.id, XFeedOptionPlugin);