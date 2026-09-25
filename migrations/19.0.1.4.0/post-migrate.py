from lxml import etree

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
        try:
            root = etree.fromstring(arch.encode("utf-8"))
        except (etree.XMLSyntaxError, UnicodeEncodeError):
            continue

        changed = False
        for node in root.xpath(
            '//*[contains(concat(" ", normalize-space(@class), " "), '
            '" o_threads_feed_container ")]'
        ):
            if len(node):
                node[:] = []
                changed = True

        if changed:
            view.write({"arch_db": etree.tostring(root, encoding="unicode")})
