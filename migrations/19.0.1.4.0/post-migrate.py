from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})

    views = env["ir.ui.view"].search([
        ("arch_db", "ilike", "o_threads_feed_container"),
    ])

    for view in views:
        arch = view.arch_db
        marker = '<div class="o_threads_feed_container"'
        start = arch.find(marker)
        if start == -1:
            continue

        tag_end = arch.find(">", start)
        if tag_end == -1:
            continue

        # Keep the container element and its attributes, but discard any
        # previously rendered Threads feed that was persisted by Website Builder.
        close = arch.find("</div>", tag_end)
        if close == -1:
            continue

        replacement = arch[start:tag_end + 1] + "</div>"
        new_arch = arch[:start] + replacement + arch[close + len("</div>"):]

        if new_arch != arch:
            view.write({"arch_db": new_arch})
