{
    "name": "Website Social Feed",
    "summary": "X and Threads feeds for the Odoo Website Builder",
    "version": "19.0.1.3.0",
    "category": "Website/Website",
    "license": "LGPL-3",
    "depends": ["website"],
    "data": [
        "views/snippets/s_x_feed.xml",
        "views/snippets/s_threads_feed.xml",
        "views/snippets/snippets.xml",
        "views/res_config_settings_views.xml"
    ],
    "assets": {
        "web.assets_frontend": [
            "odoo_website_social_feed/static/src/snippets/s_x_feed/000.scss",
            "odoo_website_social_feed/static/src/snippets/s_threads_feed/threads_feed.js",
            "odoo_website_social_feed/static/src/snippets/s_threads_feed/000.scss"
        ],
        "website.website_builder_assets": [
            "odoo_website_social_feed/static/src/builder/plugins/options/x_feed_option_plugin.js",
            "odoo_website_social_feed/static/src/builder/plugins/options/x_feed_option.xml",
            "odoo_website_social_feed/static/src/builder/plugins/options/threads_feed_option_plugin.js",
            "odoo_website_social_feed/static/src/builder/plugins/options/threads_feed_option.xml"
        ]
    },
    "installable": True,
    "application": False
}
