from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    threads_client_id = fields.Char(
        string="Threads App ID",
        config_parameter="odoo_website_social_feed.threads_client_id",
    )
    threads_client_secret = fields.Char(
        string="Threads App Secret",
        config_parameter="odoo_website_social_feed.threads_client_secret",
    )
    threads_redirect_uri = fields.Char(
        string="Redirect URI",
        config_parameter="odoo_website_social_feed.threads_redirect_uri",
        default=lambda self: (
            self.env["ir.config_parameter"].sudo().get_param("web.base.url", "")
            + "/threads/callback"
        ),
    )
    threads_connected = fields.Boolean(
        string="Connected",
        config_parameter="odoo_website_social_feed.threads_connected",
        readonly=True,
    )
    threads_user_id = fields.Char(
        string="Threads User ID",
        config_parameter="odoo_website_social_feed.threads_user_id",
        readonly=True,
    )
    threads_token_expires_at = fields.Char(
        string="Token Expires At",
        config_parameter="odoo_website_social_feed.threads_token_expires_at",
        readonly=True,
    )

    def action_connect_threads(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "target": "self",
            "url": "/threads/connect",
        }
